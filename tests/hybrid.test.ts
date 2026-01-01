/**
 * Tests for Application
 */
import { describe, test, expect, afterEach } from "bun:test";
import { Application, type Context } from "../src/application";

describe("Application", () => {
  let app: Application;

  afterEach(async () => {
    if (app) {
      await app.close();
    }
  });

  test("should create a new application", () => {
    app = new Application();
    expect(app).toBeDefined();
    expect(app.middleware).toEqual([]);
  });

  test("should register middleware", () => {
    app = new Application();
    const middleware = async (ctx: Context, next: () => Promise<void>) => {
      await next();
    };

    app.use(middleware);
    expect(app.middleware.length).toBe(1);
  });

  test("should chain middleware with use()", () => {
    app = new Application();
    const result = app.use(async () => {});

    expect(result).toBe(app); // Should return this for chaining
  });

  test("should throw on non-function middleware", () => {
    app = new Application();
    expect(() => {
      // @ts-expect-error - intentionally passing wrong type
      app.use("not a function");
    }).toThrow("middleware must be a function!");
  });

  test("should listen on port", async () => {
    app = new Application();
    app.use(async (ctx: Context) => {
      ctx.status = 200;
      ctx.responseBody = { message: "Hello" };
    });

    const result = app.listen(18787, "localhost");
    expect(result).toBe(app);

    // Wait for server to start
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Make request
    const response = await fetch("http://localhost:18787/");
    expect(response.status).toBe(200);

    const json = await response.json();
    expect(json.message).toBe("Hello");
  });

  test("should listen with callback", async () => {
    app = new Application();
    let callbackCalled = false;

    app.use(async (ctx: Context) => {
      ctx.status = 200;
      ctx.responseBody = "OK";
    });

    app.listen(18788, () => {
      callbackCalled = true;
    });

    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(callbackCalled).toBe(true);
  });

  test("should listen with options object", async () => {
    app = new Application();
    app.use(async (ctx: Context) => {
      ctx.status = 200;
      ctx.responseBody = "OK";
    });

    app.listen({ port: 18789, hostname: "localhost" });
    await new Promise((resolve) => setTimeout(resolve, 100));

    const response = await fetch("http://localhost:18789/");
    expect(response.status).toBe(200);
  });

  test("should close server", async () => {
    app = new Application();
    app.use(async (ctx: Context) => {
      ctx.status = 200;
      ctx.responseBody = "OK";
    });

    app.listen(18790);
    await new Promise((resolve) => setTimeout(resolve, 100));

    await app.close();

    // Server should be closed, but we can't easily test this
    // without getting a connection error
  });

  test("should parse query parameters", async () => {
    app = new Application();
    app.use(async (ctx: Context) => {
      ctx.status = 200;
      ctx.responseBody = ctx.query;
    });

    app.listen(18791);
    await new Promise((resolve) => setTimeout(resolve, 100));

    const response = await fetch("http://localhost:18791/?foo=bar&baz=qux");
    const json = await response.json();

    expect(json.foo).toBe("bar");
    expect(json.baz).toBe("qux");
  });

  test("should parse request headers", async () => {
    app = new Application();
    app.use(async (ctx: Context) => {
      ctx.status = 200;
      ctx.responseBody = {
        customHeader: ctx.get("x-custom-header"),
        contentType: ctx.get("content-type"),
      };
    });

    app.listen(18792);
    await new Promise((resolve) => setTimeout(resolve, 100));

    const response = await fetch("http://localhost:18792/", {
      headers: {
        "X-Custom-Header": "custom-value",
        "Content-Type": "application/json",
      },
    });
    const json = await response.json();

    expect(json.customHeader).toBe("custom-value");
    expect(json.contentType).toBe("application/json");
  });

  test("should set response headers", async () => {
    app = new Application();
    app.use(async (ctx: Context) => {
      ctx.set("X-Custom-Response", "response-value");
      ctx.set({ "X-Multi-1": "value1", "X-Multi-2": "value2" });
      ctx.status = 200;
      ctx.responseBody = "OK";
    });

    app.listen(18793);
    await new Promise((resolve) => setTimeout(resolve, 100));

    const response = await fetch("http://localhost:18793/");

    expect(response.headers.get("x-custom-response")).toBe("response-value");
    expect(response.headers.get("x-multi-1")).toBe("value1");
    expect(response.headers.get("x-multi-2")).toBe("value2");
  });

  test("should handle JSON request body", async () => {
    app = new Application();
    app.use(async (ctx: Context) => {
      ctx.status = 200;
      ctx.responseBody = { received: ctx.body };
    });

    app.listen(18794);
    await new Promise((resolve) => setTimeout(resolve, 100));

    const response = await fetch("http://localhost:18794/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ test: "data" }),
    });
    const json = await response.json();

    expect(json.received).toEqual({ test: "data" });
  });

  test("should handle text request body", async () => {
    app = new Application();
    app.use(async (ctx: Context) => {
      ctx.status = 200;
      ctx.responseBody = { received: ctx.body };
    });

    app.listen(18795);
    await new Promise((resolve) => setTimeout(resolve, 100));

    const response = await fetch("http://localhost:18795/", {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: "Hello World",
    });
    const json = await response.json();

    expect(json.received).toBe("Hello World");
  });

  test("should handle ctx.throw()", async () => {
    app = new Application();
    app.use(async (ctx: Context) => {
      ctx.throw(404, "Resource not found");
    });

    app.listen(18796);
    await new Promise((resolve) => setTimeout(resolve, 100));

    const response = await fetch("http://localhost:18796/");
    expect(response.status).toBe(404);

    const json = await response.json();
    expect(json.error).toBe("Resource not found");
  });

  test("should handle redirect", async () => {
    app = new Application();
    app.use(async (ctx: Context) => {
      if (ctx.path === "/old") {
        ctx.redirect("/new");
        return;
      }
      ctx.status = 200;
      ctx.responseBody = "Destination";
    });

    app.listen(18797);
    await new Promise((resolve) => setTimeout(resolve, 100));

    const response = await fetch("http://localhost:18797/old", {
      redirect: "manual",
    });

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("/new");
  });

  test("should emit error events", async () => {
    app = new Application();
    let errorEmitted = false;

    app.on("error", (err: Error, _ctx: Context) => {
      errorEmitted = true;
      expect(err.message).toBe("Test error");
    });

    app.use(async (_ctx: Context) => {
      throw new Error("Test error");
    });

    app.listen(18798);
    await new Promise((resolve) => setTimeout(resolve, 100));

    await fetch("http://localhost:18798/");
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(errorEmitted).toBe(true);
  });

  test("should use state object", async () => {
    app = new Application();
    app.use(async (ctx: Context, next: () => Promise<void>) => {
      ctx.state.user = { id: 123, name: "Test" };
      await next();
    });

    app.use(async (ctx: Context) => {
      ctx.status = 200;
      ctx.responseBody = ctx.state;
    });

    app.listen(18799);
    await new Promise((resolve) => setTimeout(resolve, 100));

    const response = await fetch("http://localhost:18799/");
    const json = await response.json();

    expect(json.user).toEqual({ id: 123, name: "Test" });
  });

  test("should return 404 by default", async () => {
    app = new Application();
    // No middleware - should return 404

    app.listen(18800);
    await new Promise((resolve) => setTimeout(resolve, 100));

    const response = await fetch("http://localhost:18800/");
    expect(response.status).toBe(404);
  });

  test("should provide path and method", async () => {
    app = new Application();
    app.use(async (ctx: Context) => {
      ctx.status = 200;
      ctx.responseBody = {
        method: ctx.method,
        path: ctx.path,
        url: ctx.url,
      };
    });

    app.listen(18801);
    await new Promise((resolve) => setTimeout(resolve, 100));

    const response = await fetch("http://localhost:18801/api/test?foo=bar");
    const json = await response.json();

    expect(json.method).toBe("GET");
    expect(json.path).toBe("/api/test");
    expect(json.url).toContain("/api/test?foo=bar");
  });

  test("should set content-type for string response", async () => {
    app = new Application();
    app.use(async (ctx: Context) => {
      ctx.status = 200;
      ctx.responseBody = "Plain text response";
    });

    app.listen(18802);
    await new Promise((resolve) => setTimeout(resolve, 100));

    const response = await fetch("http://localhost:18802/");
    expect(response.headers.get("content-type")).toBe("text/plain; charset=utf-8");
  });

  test("should set content-type for JSON response", async () => {
    app = new Application();
    app.use(async (ctx: Context) => {
      ctx.status = 200;
      ctx.responseBody = { key: "value" };
    });

    app.listen(18803);
    await new Promise((resolve) => setTimeout(resolve, 100));

    const response = await fetch("http://localhost:18803/");
    expect(response.headers.get("content-type")).toBe("application/json; charset=utf-8");
  });
});
