/**
 * Tests for error handler middleware
 */
import { describe, test, expect, afterEach } from "bun:test";
import { Application, errorHandler, createError } from "../src";

describe("errorHandler middleware", () => {
  let app: Application;
  let basePort = 19200;

  function getPort(): number {
    return basePort++;
  }

  afterEach(async () => {
    if (app) {
      await app.close();
    }
  });

  test("should catch and handle errors", async () => {
    app = new Application();
    app.use(errorHandler());
    app.use(async (_ctx) => {
      throw new Error("Test error");
    });

    const port = getPort();
    app.listen(port);
    await new Promise((resolve) => setTimeout(resolve, 100));

    const res = await fetch(`http://localhost:${port}/`);
    expect(res.status).toBe(500);

    const json = await res.json();
    // Server errors don't expose message by default
    expect(json.error).toBe("Internal Server Error");
  });

  test("should expose client error messages", async () => {
    app = new Application();
    app.use(errorHandler());
    app.use(async (_ctx) => {
      const err = new Error("Bad request") as Error & { status: number };
      err.status = 400;
      throw err;
    });

    const port = getPort();
    app.listen(port);
    await new Promise((resolve) => setTimeout(resolve, 100));

    const res = await fetch(`http://localhost:${port}/`);
    expect(res.status).toBe(400);

    const json = await res.json();
    expect(json.error).toBe("Bad request");
  });

  test("should include stack in development mode", async () => {
    app = new Application();
    app.use(errorHandler({ includeStack: true }));
    app.use(async (_ctx) => {
      throw new Error("Test error");
    });

    const port = getPort();
    app.listen(port);
    await new Promise((resolve) => setTimeout(resolve, 100));

    const res = await fetch(`http://localhost:${port}/`);
    const json = await res.json();
    expect(json.stack).toBeDefined();
    expect(Array.isArray(json.stack)).toBe(true);
  });

  test("should use custom error handler", async () => {
    app = new Application();
    app.use(
      errorHandler({
        handler: (err, ctx) => {
          ctx.status = 418; // I'm a teapot
          ctx.responseBody = { custom: true, message: err.message };
        },
      })
    );
    app.use(async (_ctx) => {
      throw new Error("Oops");
    });

    const port = getPort();
    app.listen(port);
    await new Promise((resolve) => setTimeout(resolve, 100));

    const res = await fetch(`http://localhost:${port}/`);
    expect(res.status).toBe(418);

    const json = await res.json();
    expect(json.custom).toBe(true);
    expect(json.message).toBe("Oops");
  });

  test("should use custom status messages", async () => {
    app = new Application();
    app.use(
      errorHandler({
        messages: { 404: "Page not found" },
      })
    );
    app.use(async (_ctx) => {
      const err = new Error("Page not found") as Error & { status: number };
      err.status = 404;
      throw err;
    });

    const port = getPort();
    app.listen(port);
    await new Promise((resolve) => setTimeout(resolve, 100));

    const res = await fetch(`http://localhost:${port}/`);
    expect(res.status).toBe(404);

    const json = await res.json();
    // 4xx errors expose message
    expect(json.error).toBe("Page not found");
  });

  test("should pass through if no error", async () => {
    app = new Application();
    app.use(errorHandler());
    app.use(async (ctx) => {
      ctx.status = 200;
      ctx.responseBody = { success: true };
    });

    const port = getPort();
    app.listen(port);
    await new Promise((resolve) => setTimeout(resolve, 100));

    const res = await fetch(`http://localhost:${port}/`);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.success).toBe(true);
  });
});

describe("createError", () => {
  test("should create error with status", () => {
    const err = createError(404);
    expect(err.status).toBe(404);
    expect(err.statusCode).toBe(404);
    expect(err.message).toBe("Not Found");
    expect(err.expose).toBe(true); // 4xx exposes
  });

  test("should create error with custom message", () => {
    const err = createError(400, "Invalid input");
    expect(err.status).toBe(400);
    expect(err.message).toBe("Invalid input");
  });

  test("should create 5xx error with expose false", () => {
    const err = createError(500, "Server error");
    expect(err.status).toBe(500);
    expect(err.expose).toBe(false); // 5xx doesn't expose
  });

  test("should accept additional properties", () => {
    const err = createError(401, "Unauthorized", {
      headers: { "WWW-Authenticate": "Bearer" },
    });
    expect(err.headers).toEqual({ "WWW-Authenticate": "Bearer" });
  });
});
