/**
 * Tests for CORS middleware
 */
import { describe, test, expect, afterEach } from "bun:test";
import { Application, cors } from "../src";

describe("CORS middleware", () => {
  let app: Application;
  let basePort = 19100;

  function getPort(): number {
    return basePort++;
  }

  afterEach(async () => {
    if (app) {
      await app.close();
    }
  });

  test("should set Access-Control-Allow-Origin to * by default", async () => {
    app = new Application();
    app.use(cors());
    app.use(async (ctx) => {
      ctx.status = 200;
      ctx.responseBody = "OK";
    });

    const port = getPort();
    app.listen(port);
    await new Promise((resolve) => setTimeout(resolve, 100));

    const res = await fetch(`http://localhost:${port}/`, {
      headers: { Origin: "http://example.com" },
    });

    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });

  test("should set specific origin", async () => {
    app = new Application();
    app.use(cors({ origin: "https://example.com" }));
    app.use(async (ctx) => {
      ctx.status = 200;
      ctx.responseBody = "OK";
    });

    const port = getPort();
    app.listen(port);
    await new Promise((resolve) => setTimeout(resolve, 100));

    const res = await fetch(`http://localhost:${port}/`, {
      headers: { Origin: "http://other.com" },
    });

    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("https://example.com");
  });

  test("should handle multiple origins", async () => {
    app = new Application();
    app.use(cors({ origin: ["https://a.com", "https://b.com"] }));
    app.use(async (ctx) => {
      ctx.status = 200;
      ctx.responseBody = "OK";
    });

    const port = getPort();
    app.listen(port);
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Origin in list
    const res1 = await fetch(`http://localhost:${port}/`, {
      headers: { Origin: "https://a.com" },
    });
    expect(res1.headers.get("Access-Control-Allow-Origin")).toBe("https://a.com");

    // Origin not in list
    const res2 = await fetch(`http://localhost:${port}/`, {
      headers: { Origin: "https://c.com" },
    });
    expect(res2.headers.get("Access-Control-Allow-Origin")).toBeNull();
  });

  test("should handle dynamic origin function", async () => {
    app = new Application();
    app.use(
      cors({
        origin: (ctx) => {
          const origin = ctx.get("origin");
          if (origin?.endsWith(".example.com")) {
            return origin;
          }
          return false;
        },
      })
    );
    app.use(async (ctx) => {
      ctx.status = 200;
      ctx.responseBody = "OK";
    });

    const port = getPort();
    app.listen(port);
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Allowed origin
    const res1 = await fetch(`http://localhost:${port}/`, {
      headers: { Origin: "https://app.example.com" },
    });
    expect(res1.headers.get("Access-Control-Allow-Origin")).toBe("https://app.example.com");

    // Disallowed origin
    const res2 = await fetch(`http://localhost:${port}/`, {
      headers: { Origin: "https://evil.com" },
    });
    expect(res2.headers.get("Access-Control-Allow-Origin")).toBeNull();
  });

  test("should handle preflight OPTIONS request", async () => {
    app = new Application();
    app.use(cors());
    app.use(async (ctx) => {
      ctx.status = 200;
      ctx.responseBody = "OK";
    });

    const port = getPort();
    app.listen(port);
    await new Promise((resolve) => setTimeout(resolve, 100));

    const res = await fetch(`http://localhost:${port}/api/data`, {
      method: "OPTIONS",
      headers: {
        Origin: "http://example.com",
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "Content-Type",
      },
    });

    expect(res.status).toBe(204);
    expect(res.headers.get("Access-Control-Allow-Methods")).toContain("POST");
    expect(res.headers.get("Access-Control-Allow-Headers")).toBe("Content-Type");
  });

  test("should set credentials header", async () => {
    app = new Application();
    app.use(cors({ credentials: true, origin: "https://example.com" }));
    app.use(async (ctx) => {
      ctx.status = 200;
      ctx.responseBody = "OK";
    });

    const port = getPort();
    app.listen(port);
    await new Promise((resolve) => setTimeout(resolve, 100));

    const res = await fetch(`http://localhost:${port}/`, {
      headers: { Origin: "https://example.com" },
    });

    expect(res.headers.get("Access-Control-Allow-Credentials")).toBe("true");
  });

  test("should set expose headers", async () => {
    app = new Application();
    app.use(cors({ exposeHeaders: ["X-Custom-Header", "X-Request-Id"] }));
    app.use(async (ctx) => {
      ctx.status = 200;
      ctx.responseBody = "OK";
    });

    const port = getPort();
    app.listen(port);
    await new Promise((resolve) => setTimeout(resolve, 100));

    const res = await fetch(`http://localhost:${port}/`, {
      headers: { Origin: "http://example.com" },
    });

    expect(res.headers.get("Access-Control-Expose-Headers")).toContain("X-Custom-Header");
    expect(res.headers.get("Access-Control-Expose-Headers")).toContain("X-Request-Id");
  });

  test("should set max age", async () => {
    app = new Application();
    app.use(cors({ maxAge: 3600 }));
    app.use(async (ctx) => {
      ctx.status = 200;
      ctx.responseBody = "OK";
    });

    const port = getPort();
    app.listen(port);
    await new Promise((resolve) => setTimeout(resolve, 100));

    const res = await fetch(`http://localhost:${port}/`, {
      method: "OPTIONS",
      headers: {
        Origin: "http://example.com",
        "Access-Control-Request-Method": "GET",
      },
    });

    expect(res.headers.get("Access-Control-Max-Age")).toBe("3600");
  });

  test("should set custom allowed methods", async () => {
    app = new Application();
    app.use(cors({ allowMethods: ["GET", "POST"] }));
    app.use(async (ctx) => {
      ctx.status = 200;
      ctx.responseBody = "OK";
    });

    const port = getPort();
    app.listen(port);
    await new Promise((resolve) => setTimeout(resolve, 100));

    const res = await fetch(`http://localhost:${port}/`, {
      method: "OPTIONS",
      headers: {
        Origin: "http://example.com",
        "Access-Control-Request-Method": "GET",
      },
    });

    expect(res.headers.get("Access-Control-Allow-Methods")).toBe("GET, POST");
  });

  test("should set custom allowed headers", async () => {
    app = new Application();
    app.use(cors({ allowHeaders: ["Authorization", "Content-Type"] }));
    app.use(async (ctx) => {
      ctx.status = 200;
      ctx.responseBody = "OK";
    });

    const port = getPort();
    app.listen(port);
    await new Promise((resolve) => setTimeout(resolve, 100));

    const res = await fetch(`http://localhost:${port}/`, {
      method: "OPTIONS",
      headers: {
        Origin: "http://example.com",
        "Access-Control-Request-Method": "GET",
        "Access-Control-Request-Headers": "X-Custom",
      },
    });

    expect(res.headers.get("Access-Control-Allow-Headers")).toBe("Authorization, Content-Type");
  });
});
