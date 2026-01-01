/**
 * Tests for middleware composition
 */
import { describe, test, expect } from "bun:test";
import { compose, type Context, type Middleware } from "../src/application";

// Helper to create a test context
function createTestContext(): Context {
  return {
    method: "GET",
    path: "/test",
    url: "http://localhost/test",
    query: {},
    headers: {},
    body: null,
    status: 404,
    responseBody: null,
    responseHeaders: {},
    state: {},
    get(field: string) {
      return this.headers[field.toLowerCase()];
    },
    set(field: string | Record<string, string>, val?: string) {
      if (typeof field === "object") {
        for (const [k, v] of Object.entries(field)) {
          this.responseHeaders[k.toLowerCase()] = v;
        }
      } else if (val !== undefined) {
        this.responseHeaders[field.toLowerCase()] = val;
      }
    },
    throw(status: number, message?: string): never {
      const err = new Error(message || "Error") as Error & { status: number };
      err.status = status;
      throw err;
    },
    redirect(url: string) {
      this.status = 302;
      this.responseHeaders["location"] = url;
      this.responseBody = `Redirecting to ${url}`;
    },
  };
}

describe("compose", () => {
  test("should throw if not an array", () => {
    expect(() => {
      // @ts-expect-error - intentionally passing wrong type
      compose("not an array");
    }).toThrow("Middleware stack must be an array!");
  });

  test("should throw if middleware is not a function", () => {
    expect(() => {
      // @ts-expect-error - intentionally passing wrong type
      compose([1, 2, 3]);
    }).toThrow("Middleware must be composed of functions!");
  });

  test("should work with empty middleware array", async () => {
    const fn = compose([]);
    const ctx = createTestContext();

    await fn(ctx);
    // Should complete without error
    expect(ctx.status).toBe(404); // Unchanged
  });

  test("should execute single middleware", async () => {
    const middleware: Middleware = async (ctx, next) => {
      ctx.status = 200;
      ctx.responseBody = "Hello";
      await next();
    };

    const fn = compose([middleware]);
    const ctx = createTestContext();

    await fn(ctx);

    expect(ctx.status).toBe(200);
    expect(ctx.responseBody).toBe("Hello");
  });

  test("should execute middleware in order", async () => {
    const order: string[] = [];

    const m1: Middleware = async (ctx, next) => {
      order.push("m1-before");
      await next();
      order.push("m1-after");
    };

    const m2: Middleware = async (ctx, next) => {
      order.push("m2-before");
      await next();
      order.push("m2-after");
    };

    const m3: Middleware = async (ctx, next) => {
      order.push("m3-before");
      await next();
      order.push("m3-after");
    };

    const fn = compose([m1, m2, m3]);
    const ctx = createTestContext();

    await fn(ctx);

    expect(order).toEqual([
      "m1-before",
      "m2-before",
      "m3-before",
      "m3-after",
      "m2-after",
      "m1-after",
    ]);
  });

  test("should allow middleware to modify context", async () => {
    const m1: Middleware = async (ctx, next) => {
      ctx.state.m1 = true;
      await next();
    };

    const m2: Middleware = async (ctx, next) => {
      ctx.state.m2 = true;
      await next();
    };

    const fn = compose([m1, m2]);
    const ctx = createTestContext();

    await fn(ctx);

    expect(ctx.state.m1).toBe(true);
    expect(ctx.state.m2).toBe(true);
  });

  test("should allow middleware to short-circuit", async () => {
    const m1: Middleware = async (ctx, _next) => {
      ctx.status = 401;
      ctx.responseBody = "Unauthorized";
      // Not calling next() - short circuit
    };

    const m2: Middleware = async (ctx, next) => {
      ctx.status = 200;
      ctx.responseBody = "Should not reach";
      await next();
    };

    const fn = compose([m1, m2]);
    const ctx = createTestContext();

    await fn(ctx);

    expect(ctx.status).toBe(401);
    expect(ctx.responseBody).toBe("Unauthorized");
  });

  test("should throw if next() called multiple times", async () => {
    const m1: Middleware = async (ctx, next) => {
      await next();
      await next(); // This should throw
    };

    const fn = compose([m1]);
    const ctx = createTestContext();

    await expect(fn(ctx)).rejects.toThrow("next() called multiple times");
  });

  test("should pass errors up the chain", async () => {
    const m1: Middleware = async (ctx, next) => {
      try {
        await next();
      } catch {
        ctx.status = 500;
        ctx.responseBody = "Caught error";
      }
    };

    const m2: Middleware = async (_ctx, _next) => {
      throw new Error("Test error");
    };

    const fn = compose([m1, m2]);
    const ctx = createTestContext();

    await fn(ctx);

    expect(ctx.status).toBe(500);
    expect(ctx.responseBody).toBe("Caught error");
  });

  test("should work with async middleware", async () => {
    const m1: Middleware = async (ctx, next) => {
      await new Promise((resolve) => setTimeout(resolve, 10));
      ctx.state.m1Time = Date.now();
      await next();
    };

    const m2: Middleware = async (ctx, next) => {
      await new Promise((resolve) => setTimeout(resolve, 10));
      ctx.state.m2Time = Date.now();
      await next();
    };

    const fn = compose([m1, m2]);
    const ctx = createTestContext();

    await fn(ctx);

    expect(ctx.state.m1Time).toBeDefined();
    expect(ctx.state.m2Time).toBeDefined();
    expect(ctx.state.m2Time).toBeGreaterThanOrEqual(ctx.state.m1Time);
  });

  test("should work with synchronous middleware", async () => {
    const m1: Middleware = (ctx, next) => {
      ctx.state.sync = true;
      return next();
    };

    const fn = compose([m1]);
    const ctx = createTestContext();

    await fn(ctx);

    expect(ctx.state.sync).toBe(true);
  });

  test("should call final next if provided", async () => {
    let finalCalled = false;

    const m1: Middleware = async (ctx, next) => {
      ctx.state.m1 = true;
      await next();
    };

    const fn = compose([m1]);
    const ctx = createTestContext();

    await fn(ctx, async () => {
      finalCalled = true;
    });

    expect(ctx.state.m1).toBe(true);
    expect(finalCalled).toBe(true);
  });
});

describe("middleware patterns", () => {
  test("logger middleware pattern", async () => {
    const logs: string[] = [];

    const logger: Middleware = async (ctx, next) => {
      const start = Date.now();
      logs.push(`--> ${ctx.method} ${ctx.path}`);

      await next();

      const ms = Date.now() - start;
      logs.push(`<-- ${ctx.method} ${ctx.path} ${ctx.status} ${ms}ms`);
    };

    const handler: Middleware = async (ctx, _next) => {
      ctx.status = 200;
      ctx.responseBody = "OK";
    };

    const fn = compose([logger, handler]);
    const ctx = createTestContext();

    await fn(ctx);

    expect(logs.length).toBe(2);
    expect(logs[0]).toContain("--> GET /test");
    expect(logs[1]).toContain("<-- GET /test 200");
  });

  test("error handler middleware pattern", async () => {
    const errorHandler: Middleware = async (ctx, next) => {
      try {
        await next();
      } catch (err) {
        const error = err as Error & { status?: number };
        ctx.status = error.status || 500;
        ctx.responseBody = { error: error.message };
      }
    };

    const handler: Middleware = async (ctx, _next) => {
      ctx.throw(400, "Bad Request");
    };

    const fn = compose([errorHandler, handler]);
    const ctx = createTestContext();

    await fn(ctx);

    expect(ctx.status).toBe(400);
    expect((ctx.responseBody as any).error).toBe("Bad Request");
  });

  test("auth middleware pattern", async () => {
    const auth: Middleware = async (ctx, next) => {
      const token = ctx.get("authorization");
      if (!token) {
        ctx.status = 401;
        ctx.responseBody = { error: "Unauthorized" };
        return; // Short circuit
      }
      ctx.state.user = { id: 1, name: "Test User" };
      await next();
    };

    const handler: Middleware = async (ctx, _next) => {
      ctx.status = 200;
      ctx.responseBody = { user: ctx.state.user };
    };

    const fn = compose([auth, handler]);

    // Without auth
    const ctx1 = createTestContext();
    await fn(ctx1);
    expect(ctx1.status).toBe(401);

    // With auth
    const ctx2 = createTestContext();
    ctx2.headers["authorization"] = "Bearer token";
    await fn(ctx2);
    expect(ctx2.status).toBe(200);
    expect((ctx2.responseBody as any).user.name).toBe("Test User");
  });

  test("response time middleware pattern", async () => {
    const responseTime: Middleware = async (ctx, next) => {
      const start = Date.now();
      await next();
      const ms = Date.now() - start;
      ctx.set("X-Response-Time", `${ms}ms`);
    };

    const handler: Middleware = async (ctx, _next) => {
      await new Promise((resolve) => setTimeout(resolve, 10));
      ctx.status = 200;
      ctx.responseBody = "OK";
    };

    const fn = compose([responseTime, handler]);
    const ctx = createTestContext();

    await fn(ctx);

    expect(ctx.responseHeaders["x-response-time"]).toBeDefined();
    expect(ctx.responseHeaders["x-response-time"]).toMatch(/^\d+ms$/);
  });

  test("cors middleware pattern", async () => {
    const cors: Middleware = async (ctx, next) => {
      ctx.set("Access-Control-Allow-Origin", "*");
      ctx.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE");
      ctx.set("Access-Control-Allow-Headers", "Content-Type, Authorization");

      if (ctx.method === "OPTIONS") {
        ctx.status = 204;
        return;
      }

      await next();
    };

    const handler: Middleware = async (ctx, _next) => {
      ctx.status = 200;
      ctx.responseBody = "OK";
    };

    const fn = compose([cors, handler]);

    // Regular request
    const ctx1 = createTestContext();
    await fn(ctx1);
    expect(ctx1.status).toBe(200);
    expect(ctx1.responseHeaders["access-control-allow-origin"]).toBe("*");

    // Preflight request
    const ctx2 = createTestContext();
    ctx2.method = "OPTIONS";
    await fn(ctx2);
    expect(ctx2.status).toBe(204);
    expect(ctx2.responseHeaders["access-control-allow-methods"]).toContain("GET");
  });

  test("conditional middleware pattern", async () => {
    const conditionalMiddleware = (
      condition: (ctx: Context) => boolean,
      mw: Middleware
    ): Middleware => {
      return async (ctx, next) => {
        if (condition(ctx)) {
          await mw(ctx, next);
        } else {
          await next();
        }
      };
    };

    const apiOnly: Middleware = async (ctx, next) => {
      ctx.state.isApi = true;
      await next();
    };

    const wrapped = conditionalMiddleware((ctx) => ctx.path.startsWith("/api"), apiOnly);

    const fn = compose([wrapped]);

    // API path
    const ctx1 = createTestContext();
    ctx1.path = "/api/users";
    await fn(ctx1);
    expect(ctx1.state.isApi).toBe(true);

    // Non-API path
    const ctx2 = createTestContext();
    ctx2.path = "/home";
    await fn(ctx2);
    expect(ctx2.state.isApi).toBeUndefined();
  });
});

describe("context methods", () => {
  test("ctx.get() should be case-insensitive", () => {
    const ctx = createTestContext();
    ctx.headers["content-type"] = "application/json";

    expect(ctx.get("Content-Type")).toBe("application/json");
    expect(ctx.get("content-type")).toBe("application/json");
    expect(ctx.get("CONTENT-TYPE")).toBe("application/json");
  });

  test("ctx.set() should accept object", () => {
    const ctx = createTestContext();
    ctx.set({
      "X-Header-1": "value1",
      "X-Header-2": "value2",
    });

    expect(ctx.responseHeaders["x-header-1"]).toBe("value1");
    expect(ctx.responseHeaders["x-header-2"]).toBe("value2");
  });

  test("ctx.set() should accept key-value", () => {
    const ctx = createTestContext();
    ctx.set("X-Custom", "custom-value");

    expect(ctx.responseHeaders["x-custom"]).toBe("custom-value");
  });

  test("ctx.throw() should throw error with status", () => {
    const ctx = createTestContext();

    expect(() => ctx.throw(404, "Not Found")).toThrow("Not Found");

    try {
      ctx.throw(400, "Bad Request");
    } catch (err) {
      expect((err as any).status).toBe(400);
    }
  });

  test("ctx.redirect() should set status and location", () => {
    const ctx = createTestContext();
    ctx.redirect("/new-location");

    expect(ctx.status).toBe(302);
    expect(ctx.responseHeaders["location"]).toBe("/new-location");
    expect(ctx.responseBody).toContain("Redirecting to /new-location");
  });
});
