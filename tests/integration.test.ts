/**
 * Integration tests for EngineX
 *
 * Tests complete request/response cycles with multiple middleware
 */
import { describe, test, expect, afterEach } from "bun:test";
import { Application, Router, cors, errorHandler, logger, type Context } from "../src";

describe("Integration tests", () => {
  let app: Application;
  let basePort = 19400;

  function getPort(): number {
    return basePort++;
  }

  afterEach(async () => {
    if (app) {
      await app.close();
    }
  });

  test("full middleware stack", async () => {
    const logs: string[] = [];

    app = new Application();

    // Logger
    app.use(
      logger({
        logger: (msg) => logs.push(msg),
        colors: false,
        timestamp: false,
      })
    );

    // Error handler
    app.use(errorHandler({ includeStack: false }));

    // CORS
    app.use(cors({ origin: "https://example.com" }));

    // Custom middleware
    app.use(async (ctx, next) => {
      ctx.set("X-Powered-By", "EngineX");
      await next();
    });

    // Router
    const router = new Router();

    router.get("/", async (ctx) => {
      ctx.responseBody = { message: "Welcome to EngineX" };
    });

    router.get("/users/:id", async (ctx) => {
      ctx.responseBody = { user: { id: ctx.params.id } };
    });

    router.post("/users", async (ctx) => {
      ctx.status = 201;
      ctx.responseBody = { created: true, data: ctx.body };
    });

    router.get("/error", async (ctx) => {
      ctx.throw(400, "Bad request");
    });

    app.use(router.routes());

    const port = getPort();
    app.listen(port);
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Test GET /
    const res1 = await fetch(`http://localhost:${port}/`, {
      headers: { Origin: "https://example.com" },
    });
    expect(res1.status).toBe(200);
    expect(res1.headers.get("X-Powered-By")).toBe("EngineX");
    expect(res1.headers.get("Access-Control-Allow-Origin")).toBe("https://example.com");
    const json1 = await res1.json();
    expect(json1.message).toBe("Welcome to EngineX");

    // Test GET /users/:id
    const res2 = await fetch(`http://localhost:${port}/users/123`);
    expect(res2.status).toBe(200);
    const json2 = await res2.json();
    expect(json2.user.id).toBe("123");

    // Test POST /users
    const res3 = await fetch(`http://localhost:${port}/users`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "John" }),
    });
    expect(res3.status).toBe(201);
    const json3 = await res3.json();
    expect(json3.created).toBe(true);
    expect(json3.data.name).toBe("John");

    // Test error handling
    const res4 = await fetch(`http://localhost:${port}/error`);
    expect(res4.status).toBe(400);
    const json4 = await res4.json();
    expect(json4.error).toBe("Bad request");

    // Verify logging occurred
    expect(logs.length).toBeGreaterThan(0);
  });

  test("nested routers with API versioning", async () => {
    app = new Application();

    const v1Router = new Router({ prefix: "/api/v1" });
    const v2Router = new Router({ prefix: "/api/v2" });

    v1Router.get("/status", async (ctx) => {
      ctx.responseBody = { version: 1, status: "ok" };
    });

    v2Router.get("/status", async (ctx) => {
      ctx.responseBody = { version: 2, status: "ok", enhanced: true };
    });

    app.use(v1Router.routes());
    app.use(v2Router.routes());

    const port = getPort();
    app.listen(port);
    await new Promise((resolve) => setTimeout(resolve, 100));

    const res1 = await fetch(`http://localhost:${port}/api/v1/status`);
    expect((await res1.json()).version).toBe(1);

    const res2 = await fetch(`http://localhost:${port}/api/v2/status`);
    const json2 = await res2.json();
    expect(json2.version).toBe(2);
    expect(json2.enhanced).toBe(true);
  });

  test("authentication flow", async () => {
    app = new Application();

    // Auth middleware
    const auth = async (ctx: Context, next: () => Promise<void>) => {
      const token = ctx.get("authorization");

      if (ctx.path.startsWith("/public")) {
        await next();
        return;
      }

      if (!token || !token.startsWith("Bearer ")) {
        ctx.status = 401;
        ctx.responseBody = { error: "Unauthorized" };
        return;
      }

      const tokenValue = token.slice(7);
      if (tokenValue === "valid-token") {
        ctx.state.user = { id: 1, name: "Test User" };
        await next();
      } else {
        ctx.status = 403;
        ctx.responseBody = { error: "Forbidden" };
      }
    };

    const router = new Router();

    router.get("/public/info", async (ctx) => {
      ctx.responseBody = { info: "public data" };
    });

    router.get("/private/data", async (ctx) => {
      ctx.responseBody = { data: "secret", user: ctx.state.user };
    });

    app.use(auth);
    app.use(router.routes());

    const port = getPort();
    app.listen(port);
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Public endpoint - no auth needed
    const res1 = await fetch(`http://localhost:${port}/public/info`);
    expect(res1.status).toBe(200);

    // Private endpoint - no token
    const res2 = await fetch(`http://localhost:${port}/private/data`);
    expect(res2.status).toBe(401);

    // Private endpoint - invalid token
    const res3 = await fetch(`http://localhost:${port}/private/data`, {
      headers: { Authorization: "Bearer invalid" },
    });
    expect(res3.status).toBe(403);

    // Private endpoint - valid token
    const res4 = await fetch(`http://localhost:${port}/private/data`, {
      headers: { Authorization: "Bearer valid-token" },
    });
    expect(res4.status).toBe(200);
    const json4 = await res4.json();
    expect(json4.user.name).toBe("Test User");
  });

  test("rate limiting simulation", async () => {
    const requestCounts = new Map<string, number>();

    app = new Application();

    // Simple rate limiter
    app.use(async (ctx, next) => {
      const ip = ctx.get("x-forwarded-for") || "127.0.0.1";
      const count = (requestCounts.get(ip) || 0) + 1;
      requestCounts.set(ip, count);

      if (count > 3) {
        ctx.status = 429;
        ctx.set("Retry-After", "60");
        ctx.responseBody = { error: "Too Many Requests" };
        return;
      }

      ctx.set("X-RateLimit-Remaining", String(3 - count));
      await next();
    });

    app.use(async (ctx) => {
      ctx.status = 200;
      ctx.responseBody = { ok: true };
    });

    const port = getPort();
    app.listen(port);
    await new Promise((resolve) => setTimeout(resolve, 100));

    // First 3 requests should succeed
    for (let i = 0; i < 3; i++) {
      const res = await fetch(`http://localhost:${port}/`);
      expect(res.status).toBe(200);
      expect(res.headers.get("X-RateLimit-Remaining")).toBe(String(2 - i));
    }

    // 4th request should be rate limited
    const res = await fetch(`http://localhost:${port}/`);
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("60");
  });

  test("request timeout simulation", async () => {
    app = new Application();

    // Timeout middleware
    app.use(async (ctx, next) => {
      const timeout = 100; // 100ms timeout

      const timeoutPromise = new Promise<void>((_, reject) => {
        setTimeout(() => {
          reject(new Error("Request timeout"));
        }, timeout);
      });

      const nextPromise = next();

      try {
        await Promise.race([nextPromise, timeoutPromise]);
      } catch (err) {
        const error = err as Error & { status?: number };
        if (error.message === "Request timeout") {
          ctx.status = 408;
          ctx.responseBody = { error: "Request Timeout" };
        } else {
          throw err;
        }
      }
    });

    const router = new Router();

    router.get("/fast", async (ctx) => {
      ctx.responseBody = { fast: true };
    });

    router.get("/slow", async (ctx) => {
      await new Promise((resolve) => setTimeout(resolve, 200));
      ctx.responseBody = { slow: true };
    });

    app.use(router.routes());

    const port = getPort();
    app.listen(port);
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Fast request should succeed
    const res1 = await fetch(`http://localhost:${port}/fast`);
    expect(res1.status).toBe(200);

    // Slow request should timeout
    const res2 = await fetch(`http://localhost:${port}/slow`);
    expect(res2.status).toBe(408);
  });

  test("content negotiation", async () => {
    app = new Application();

    app.use(async (ctx) => {
      const accept = ctx.get("accept") || "*/*";
      const data = { message: "Hello" };

      if (accept.includes("application/json")) {
        ctx.set("Content-Type", "application/json");
        ctx.responseBody = data;
      } else if (accept.includes("text/html")) {
        ctx.set("Content-Type", "text/html");
        ctx.responseBody = `<html><body><h1>${data.message}</h1></body></html>`;
      } else if (accept.includes("text/plain")) {
        ctx.set("Content-Type", "text/plain");
        ctx.responseBody = data.message;
      } else {
        // Default to JSON
        ctx.responseBody = data;
      }
      ctx.status = 200;
    });

    const port = getPort();
    app.listen(port);
    await new Promise((resolve) => setTimeout(resolve, 100));

    // JSON
    const res1 = await fetch(`http://localhost:${port}/`, {
      headers: { Accept: "application/json" },
    });
    expect(res1.headers.get("Content-Type")).toContain("application/json");

    // HTML
    const res2 = await fetch(`http://localhost:${port}/`, {
      headers: { Accept: "text/html" },
    });
    expect(res2.headers.get("Content-Type")).toContain("text/html");
    const html = await res2.text();
    expect(html).toContain("<h1>Hello</h1>");

    // Plain text
    const res3 = await fetch(`http://localhost:${port}/`, {
      headers: { Accept: "text/plain" },
    });
    expect(res3.headers.get("Content-Type")).toContain("text/plain");
    const text = await res3.text();
    expect(text).toBe("Hello");
  });

  test("response streaming simulation", async () => {
    app = new Application();
    const router = new Router();

    router.get("/stream", async (ctx) => {
      // For now, just return complete data
      // Real streaming would require different Response handling
      const chunks = ["chunk1", "chunk2", "chunk3"];
      ctx.responseBody = { chunks };
    });

    app.use(router.routes());

    const port = getPort();
    app.listen(port);
    await new Promise((resolve) => setTimeout(resolve, 100));

    const res = await fetch(`http://localhost:${port}/stream`);
    const json = await res.json();
    expect(json.chunks).toEqual(["chunk1", "chunk2", "chunk3"]);
  });

  test("middleware order matters", async () => {
    const order: string[] = [];

    app = new Application();

    app.use(async (ctx, next) => {
      order.push("1-before");
      await next();
      order.push("1-after");
    });

    app.use(async (ctx, next) => {
      order.push("2-before");
      await next();
      order.push("2-after");
    });

    app.use(async (ctx, next) => {
      order.push("3-before");
      await next();
      order.push("3-after");
    });

    app.use(async (ctx) => {
      order.push("handler");
      ctx.responseBody = { order };
    });

    const port = getPort();
    app.listen(port);
    await new Promise((resolve) => setTimeout(resolve, 100));

    await fetch(`http://localhost:${port}/`);
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(order).toEqual([
      "1-before",
      "2-before",
      "3-before",
      "handler",
      "3-after",
      "2-after",
      "1-after",
    ]);
  });
});
