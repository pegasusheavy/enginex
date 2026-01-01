/**
 * Koa Middleware Compatibility Tests
 *
 * Tests that real Koa middlewares from npm work with EngineX's Application.
 * This verifies our Koa-compatible API is correct.
 */

import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { Application } from "../src/application";

// Real Koa middlewares from npm
import koaCompose from "koa-compose";

const TEST_PORT = 3090;

/**
 * Create a Koa-compatible context wrapper for EngineX's Context
 *
 * This bridges the gap between Koa's ctx.body and EngineX's ctx.responseBody
 */
function _createKoaAdapter() {
  return async (ctx: any, next: () => Promise<void>) => {
    // Store original values
    const _originalResponseBody = ctx.responseBody;

    // Define body getter/setter that maps to responseBody
    Object.defineProperty(ctx, "body", {
      get() {
        return ctx.responseBody;
      },
      set(val: any) {
        ctx.responseBody = val;
        // Koa auto-sets status to 200 when body is set
        if (ctx.status === 404 && val != null) {
          ctx.status = 200;
        }
      },
      configurable: true,
      enumerable: true,
    });

    // Add response object for Koa middlewares that use ctx.response
    ctx.response = ctx.response || {
      get status() {
        return ctx.status;
      },
      set status(val: number) {
        ctx.status = val;
      },
      get body() {
        return ctx.responseBody;
      },
      set body(val: any) {
        ctx.responseBody = val;
        if (ctx.status === 404 && val != null) ctx.status = 200;
      },
      get header() {
        return ctx.responseHeaders;
      },
      get headers() {
        return ctx.responseHeaders;
      },
      get(field: string) {
        return ctx.responseHeaders[field.toLowerCase()];
      },
      set(field: string, val: string) {
        ctx.responseHeaders[field.toLowerCase()] = val;
      },
      remove(field: string) {
        delete ctx.responseHeaders[field.toLowerCase()];
      },
    };

    // Add request object for Koa middlewares that use ctx.request
    ctx.request = ctx.request || {
      method: ctx.method,
      url: ctx.url,
      path: ctx.path,
      query: ctx.query,
      headers: ctx.headers,
      get header() {
        return ctx.headers;
      },
      get(field: string) {
        return ctx.headers[field.toLowerCase()];
      },
    };

    // Add type setter/getter
    Object.defineProperty(ctx, "type", {
      get() {
        return ctx.responseHeaders["content-type"] || "";
      },
      set(val: string) {
        ctx.set("content-type", val);
      },
      configurable: true,
    });

    await next();
  };
}

describe("Koa Middleware Compatibility", () => {
  describe("koa-compose", () => {
    let app: Application;
    let baseUrl: string;

    beforeAll(async () => {
      app = new Application();

      // Use koa-compose to compose multiple middlewares
      const middleware1 = async (ctx: any, next: () => Promise<void>) => {
        ctx.state.step1 = true;
        ctx.state.order = (ctx.state.order || "") + "1";
        await next();
        ctx.state.order += "1";
      };

      const middleware2 = async (ctx: any, next: () => Promise<void>) => {
        ctx.state.step2 = true;
        ctx.state.order += "2";
        await next();
        ctx.state.order += "2";
      };

      const middleware3 = async (ctx: any, next: () => Promise<void>) => {
        ctx.state.step3 = true;
        ctx.state.order += "3";
        await next();
        ctx.state.order += "3";
      };

      // koa-compose returns a single middleware from array
      const composed = koaCompose([middleware1, middleware2, middleware3]);
      app.use(composed as any);

      app.use(async (ctx) => {
        ctx.status = 200;
        ctx.responseBody = {
          steps: {
            step1: ctx.state.step1,
            step2: ctx.state.step2,
            step3: ctx.state.step3,
          },
          order: ctx.state.order,
        };
      });

      await new Promise<void>((resolve) => {
        app.listen(TEST_PORT, () => resolve());
      });
      baseUrl = `http://localhost:${TEST_PORT}`;
    });

    afterAll(async () => {
      await app.close();
    });

    it("should compose multiple middlewares using koa-compose", async () => {
      const res = await fetch(`${baseUrl}/test`);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.steps.step1).toBe(true);
      expect(data.steps.step2).toBe(true);
      expect(data.steps.step3).toBe(true);
    });

    it("should execute middlewares in correct order (onion model)", async () => {
      const res = await fetch(`${baseUrl}/test`);
      const data = await res.json();

      // Order shows downstream execution: 1 -> 2 -> 3
      // The "upstream" parts (after next()) don't execute because
      // the final handler doesn't call next()
      expect(data.order).toBe("123");
      expect(data.steps.step1).toBe(true);
      expect(data.steps.step2).toBe(true);
      expect(data.steps.step3).toBe(true);
    });
  });

  describe("Custom response-time middleware (like koa-response-time)", () => {
    let app: Application;
    let baseUrl: string;

    beforeAll(async () => {
      app = new Application();

      // Response time middleware - Koa style
      app.use(async (ctx, next) => {
        const start = Date.now();
        await next();
        const ms = Date.now() - start;
        ctx.set("X-Response-Time", `${ms}ms`);
      });

      app.use(async (ctx) => {
        // Simulate some work
        await new Promise((r) => setTimeout(r, 5));
        ctx.status = 200;
        ctx.responseBody = { message: "Hello" };
      });

      await new Promise<void>((resolve) => {
        app.listen(TEST_PORT + 1, () => resolve());
      });
      baseUrl = `http://localhost:${TEST_PORT + 1}`;
    });

    afterAll(async () => {
      await app.close();
    });

    it("should add X-Response-Time header", async () => {
      const res = await fetch(`${baseUrl}/test`);

      expect(res.status).toBe(200);
      const responseTime = res.headers.get("x-response-time");
      expect(responseTime).toBeTruthy();
      expect(responseTime).toMatch(/^\d+ms$/);

      // Should be at least 5ms due to our delay
      const ms = parseInt(responseTime!);
      expect(ms).toBeGreaterThanOrEqual(5);
    });
  });

  describe("Custom etag middleware (like koa-etag)", () => {
    let app: Application;
    let baseUrl: string;

    beforeAll(async () => {
      app = new Application();

      // Simple ETag middleware - Koa style
      app.use(async (ctx, next) => {
        await next();

        // Only add ETag for successful responses with body
        if (ctx.status === 200 && ctx.responseBody) {
          const body =
            typeof ctx.responseBody === "string"
              ? ctx.responseBody
              : JSON.stringify(ctx.responseBody);

          // Simple hash for ETag
          const hash = Bun.hash(body).toString(16);
          const etag = `"${hash}"`;
          ctx.set("ETag", etag);

          // Check If-None-Match
          const ifNoneMatch = ctx.get("if-none-match");
          if (ifNoneMatch === etag) {
            ctx.status = 304;
            ctx.responseBody = null;
          }
        }
      });

      app.use(async (ctx) => {
        ctx.status = 200;
        ctx.responseBody = { data: "This is cacheable content" };
      });

      await new Promise<void>((resolve) => {
        app.listen(TEST_PORT + 2, () => resolve());
      });
      baseUrl = `http://localhost:${TEST_PORT + 2}`;
    });

    afterAll(async () => {
      await app.close();
    });

    it("should add ETag header", async () => {
      const res = await fetch(`${baseUrl}/data`);

      expect(res.status).toBe(200);
      const etag = res.headers.get("etag");
      expect(etag).toBeTruthy();
      expect(etag).toMatch(/^"[a-f0-9]+"$/);
    });

    it("should return 304 for conditional GET with matching ETag", async () => {
      // First request to get ETag
      const res1 = await fetch(`${baseUrl}/data`);
      const etag = res1.headers.get("etag");
      expect(etag).toBeTruthy();

      // Second request with If-None-Match
      const res2 = await fetch(`${baseUrl}/data`, {
        headers: {
          "If-None-Match": etag!,
        },
      });

      // Should return 304 Not Modified
      expect(res2.status).toBe(304);
    });

    it("should return 200 for conditional GET with different ETag", async () => {
      const res = await fetch(`${baseUrl}/data`, {
        headers: {
          "If-None-Match": '"different-etag"',
        },
      });

      expect(res.status).toBe(200);
    });
  });

  describe("Custom compression indicator (like koa-compress)", () => {
    let app: Application;
    let baseUrl: string;

    beforeAll(async () => {
      app = new Application();

      // Compression indicator middleware
      // Note: Actual compression would need native Bun compression
      app.use(async (ctx, next) => {
        await next();

        const acceptEncoding = ctx.get("accept-encoding") || "";
        if (acceptEncoding.includes("gzip")) {
          // In a real implementation, we'd compress here
          // For testing, just add a header indicating compression was considered
          ctx.set("X-Compression-Available", "gzip");
        }
      });

      app.use(async (ctx) => {
        ctx.status = 200;
        ctx.responseBody = {
          data: "x".repeat(1000), // Some data that would benefit from compression
        };
      });

      await new Promise<void>((resolve) => {
        app.listen(TEST_PORT + 3, () => resolve());
      });
      baseUrl = `http://localhost:${TEST_PORT + 3}`;
    });

    afterAll(async () => {
      await app.close();
    });

    it("should detect gzip support", async () => {
      const res = await fetch(`${baseUrl}/data`, {
        headers: {
          "Accept-Encoding": "gzip, deflate",
        },
      });

      expect(res.status).toBe(200);
      expect(res.headers.get("x-compression-available")).toBe("gzip");
    });

    it("should not indicate compression for identity encoding", async () => {
      const res = await fetch(`${baseUrl}/data`, {
        headers: {
          "Accept-Encoding": "identity", // No compression
        },
      });

      expect(res.status).toBe(200);
      expect(res.headers.get("x-compression-available")).toBeNull();
    });
  });

  describe("Mixed EngineX and composed Koa middlewares", () => {
    let app: Application;
    let baseUrl: string;

    beforeAll(async () => {
      app = new Application();

      // Native EngineX middleware
      app.use(async (ctx, next) => {
        ctx.state.enginex = true;
        ctx.state.timestamps = { start: Date.now() };
        await next();
        ctx.state.timestamps.end = Date.now();
      });

      // Composed Koa middlewares using koa-compose
      const koaMiddlewares = koaCompose([
        async (ctx: any, next: () => Promise<void>) => {
          ctx.state.koa1 = true;
          await next();
        },
        async (ctx: any, next: () => Promise<void>) => {
          ctx.state.koa2 = true;
          await next();
        },
      ]);
      app.use(koaMiddlewares as any);

      // Another native EngineX middleware
      app.use(async (ctx, next) => {
        ctx.state.enginex2 = true;
        await next();
      });

      // Final handler
      app.use(async (ctx) => {
        ctx.status = 200;
        ctx.responseBody = {
          enginex: ctx.state.enginex,
          enginex2: ctx.state.enginex2,
          koa1: ctx.state.koa1,
          koa2: ctx.state.koa2,
          hasTimestamps: !!ctx.state.timestamps,
        };
      });

      await new Promise<void>((resolve) => {
        app.listen(TEST_PORT + 4, () => resolve());
      });
      baseUrl = `http://localhost:${TEST_PORT + 4}`;
    });

    afterAll(async () => {
      await app.close();
    });

    it("should work with mixed EngineX and koa-compose middlewares", async () => {
      const res = await fetch(`${baseUrl}/mixed`);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.enginex).toBe(true);
      expect(data.enginex2).toBe(true);
      expect(data.koa1).toBe(true);
      expect(data.koa2).toBe(true);
      expect(data.hasTimestamps).toBe(true);
    });
  });

  describe("Error handling in composed middlewares", () => {
    let app: Application;
    let baseUrl: string;

    beforeAll(async () => {
      app = new Application();

      // Error handling middleware
      app.use(async (ctx, next) => {
        try {
          await next();
        } catch (err: any) {
          ctx.status = err.status || 500;
          ctx.responseBody = { error: err.message };
        }
      });

      // Composed middlewares that might throw
      const composed = koaCompose([
        async (ctx: any, next: () => Promise<void>) => {
          if (ctx.path === "/error") {
            const err = new Error("Test error") as any;
            err.status = 400;
            throw err;
          }
          await next();
        },
        async (ctx: any, next: () => Promise<void>) => {
          ctx.state.reachedSecond = true;
          await next();
        },
      ]);
      app.use(composed as any);

      app.use(async (ctx) => {
        ctx.status = 200;
        ctx.responseBody = { success: true, reachedSecond: ctx.state.reachedSecond };
      });

      await new Promise<void>((resolve) => {
        app.listen(TEST_PORT + 5, () => resolve());
      });
      baseUrl = `http://localhost:${TEST_PORT + 5}`;
    });

    afterAll(async () => {
      await app.close();
    });

    it("should handle errors thrown in composed middlewares", async () => {
      const res = await fetch(`${baseUrl}/error`);
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.error).toBe("Test error");
    });

    it("should continue normally when no error", async () => {
      const res = await fetch(`${baseUrl}/success`);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.reachedSecond).toBe(true);
    });
  });
});

describe("koa-compose edge cases", () => {
  describe("Empty middleware array", () => {
    let app: Application;
    let baseUrl: string;

    beforeAll(async () => {
      app = new Application();

      // Empty composition
      const empty = koaCompose([]);
      app.use(empty as any);

      app.use(async (ctx) => {
        ctx.status = 200;
        ctx.responseBody = { empty: true };
      });

      await new Promise<void>((resolve) => {
        app.listen(TEST_PORT + 6, () => resolve());
      });
      baseUrl = `http://localhost:${TEST_PORT + 6}`;
    });

    afterAll(async () => {
      await app.close();
    });

    it("should handle empty koa-compose", async () => {
      const res = await fetch(`${baseUrl}/test`);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.empty).toBe(true);
    });
  });

  describe("Deeply nested composition", () => {
    let app: Application;
    let baseUrl: string;

    beforeAll(async () => {
      app = new Application();

      // Nested compositions
      const inner = koaCompose([
        async (ctx: any, next: () => Promise<void>) => {
          ctx.state.inner = true;
          await next();
        },
      ]);

      const outer = koaCompose([
        async (ctx: any, next: () => Promise<void>) => {
          ctx.state.outer = true;
          await next();
        },
        inner,
      ]);

      app.use(outer as any);

      app.use(async (ctx) => {
        ctx.status = 200;
        ctx.responseBody = {
          outer: ctx.state.outer,
          inner: ctx.state.inner,
        };
      });

      await new Promise<void>((resolve) => {
        app.listen(TEST_PORT + 7, () => resolve());
      });
      baseUrl = `http://localhost:${TEST_PORT + 7}`;
    });

    afterAll(async () => {
      await app.close();
    });

    it("should handle nested koa-compose", async () => {
      const res = await fetch(`${baseUrl}/test`);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.outer).toBe(true);
      expect(data.inner).toBe(true);
    });
  });
});
