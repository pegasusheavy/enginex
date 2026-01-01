/**
 * Tests for Router middleware
 */
import { describe, test, expect, afterEach } from "bun:test";
import { Application, Router } from "../src";

describe("Router", () => {
  let app: Application;
  let basePort = 19000;

  function getPort(): number {
    return basePort++;
  }

  afterEach(async () => {
    if (app) {
      await app.close();
    }
  });

  test("should create a router", () => {
    const router = new Router();
    expect(router).toBeDefined();
  });

  test("should match GET routes", async () => {
    app = new Application();
    const router = new Router();

    router.get("/", async (ctx) => {
      ctx.responseBody = { path: "root" };
    });

    router.get("/users", async (ctx) => {
      ctx.responseBody = { path: "users" };
    });

    app.use(router.routes());

    const port = getPort();
    app.listen(port);
    await new Promise((resolve) => setTimeout(resolve, 100));

    const res1 = await fetch(`http://localhost:${port}/`);
    expect((await res1.json()).path).toBe("root");

    const res2 = await fetch(`http://localhost:${port}/users`);
    expect((await res2.json()).path).toBe("users");
  });

  test("should match POST routes", async () => {
    app = new Application();
    const router = new Router();

    router.post("/users", async (ctx) => {
      ctx.responseBody = { method: "POST", body: ctx.body };
    });

    app.use(router.routes());

    const port = getPort();
    app.listen(port);
    await new Promise((resolve) => setTimeout(resolve, 100));

    const res = await fetch(`http://localhost:${port}/users`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Test" }),
    });

    const json = await res.json();
    expect(json.method).toBe("POST");
    expect(json.body.name).toBe("Test");
  });

  test("should handle path parameters", async () => {
    app = new Application();
    const router = new Router();

    router.get("/users/:id", async (ctx) => {
      ctx.responseBody = { userId: ctx.params.id };
    });

    router.get("/posts/:postId/comments/:commentId", async (ctx) => {
      ctx.responseBody = {
        postId: ctx.params.postId,
        commentId: ctx.params.commentId,
      };
    });

    app.use(router.routes());

    const port = getPort();
    app.listen(port);
    await new Promise((resolve) => setTimeout(resolve, 100));

    const res1 = await fetch(`http://localhost:${port}/users/123`);
    expect((await res1.json()).userId).toBe("123");

    const res2 = await fetch(`http://localhost:${port}/posts/456/comments/789`);
    const json2 = await res2.json();
    expect(json2.postId).toBe("456");
    expect(json2.commentId).toBe("789");
  });

  test("should handle PUT, DELETE, PATCH methods", async () => {
    app = new Application();
    const router = new Router();

    router.put("/users/:id", async (ctx) => {
      ctx.responseBody = { method: "PUT", id: ctx.params.id };
    });

    router.delete("/users/:id", async (ctx) => {
      ctx.responseBody = { method: "DELETE", id: ctx.params.id };
    });

    router.patch("/users/:id", async (ctx) => {
      ctx.responseBody = { method: "PATCH", id: ctx.params.id };
    });

    app.use(router.routes());

    const port = getPort();
    app.listen(port);
    await new Promise((resolve) => setTimeout(resolve, 100));

    const res1 = await fetch(`http://localhost:${port}/users/1`, { method: "PUT" });
    expect((await res1.json()).method).toBe("PUT");

    const res2 = await fetch(`http://localhost:${port}/users/2`, { method: "DELETE" });
    expect((await res2.json()).method).toBe("DELETE");

    const res3 = await fetch(`http://localhost:${port}/users/3`, { method: "PATCH" });
    expect((await res3.json()).method).toBe("PATCH");
  });

  test("should handle ALL method", async () => {
    app = new Application();
    const router = new Router();

    router.all("/api/*", async (ctx) => {
      ctx.responseBody = { method: ctx.method, path: ctx.path };
    });

    app.use(router.routes());

    const port = getPort();
    app.listen(port);
    await new Promise((resolve) => setTimeout(resolve, 100));

    const res1 = await fetch(`http://localhost:${port}/api/anything`, { method: "GET" });
    expect((await res1.json()).method).toBe("GET");

    const res2 = await fetch(`http://localhost:${port}/api/anything`, { method: "POST" });
    expect((await res2.json()).method).toBe("POST");
  });

  test("should support route prefix", async () => {
    app = new Application();
    const router = new Router({ prefix: "/api/v1" });

    router.get("/users", async (ctx) => {
      ctx.responseBody = { path: "/api/v1/users" };
    });

    app.use(router.routes());

    const port = getPort();
    app.listen(port);
    await new Promise((resolve) => setTimeout(resolve, 100));

    const res = await fetch(`http://localhost:${port}/api/v1/users`);
    expect(res.status).toBe(200);
    expect((await res.json()).path).toBe("/api/v1/users");
  });

  test("should support route groups", async () => {
    app = new Application();
    const router = new Router();

    router.group("/api", (api) => {
      api.get("/users", async (ctx) => {
        ctx.responseBody = { endpoint: "users" };
      });

      api.group("/admin", (admin) => {
        admin.get("/stats", async (ctx) => {
          ctx.responseBody = { endpoint: "admin-stats" };
        });
      });
    });

    app.use(router.routes());

    const port = getPort();
    app.listen(port);
    await new Promise((resolve) => setTimeout(resolve, 100));

    const res1 = await fetch(`http://localhost:${port}/api/users`);
    expect((await res1.json()).endpoint).toBe("users");

    const res2 = await fetch(`http://localhost:${port}/api/admin/stats`);
    expect((await res2.json()).endpoint).toBe("admin-stats");
  });

  test("should return 404 for unmatched routes", async () => {
    app = new Application();
    const router = new Router();

    router.get("/exists", async (ctx) => {
      ctx.responseBody = { ok: true };
    });

    app.use(router.routes());

    const port = getPort();
    app.listen(port);
    await new Promise((resolve) => setTimeout(resolve, 100));

    const res = await fetch(`http://localhost:${port}/does-not-exist`);
    expect(res.status).toBe(404);
  });

  test("should support named routes", async () => {
    const router = new Router();

    router.get("user", "/users/:id", async (ctx) => {
      ctx.responseBody = { id: ctx.params.id };
    });

    // Test URL generation
    const url = router.url("user", { id: "123" });
    expect(url).toBe("/users/123");
  });

  test("should call next() to pass through", async () => {
    app = new Application();
    const router = new Router();
    const order: string[] = [];

    router.get("/test", async (ctx, next) => {
      order.push("router");
      await next();
    });

    app.use(router.routes());

    app.use(async (ctx) => {
      order.push("fallback");
      ctx.responseBody = { order };
    });

    const port = getPort();
    app.listen(port);
    await new Promise((resolve) => setTimeout(resolve, 100));

    const res = await fetch(`http://localhost:${port}/test`);
    const json = await res.json();
    expect(json.order).toEqual(["router", "fallback"]);
  });

  test("should handle trailing slashes", async () => {
    app = new Application();
    const router = new Router();

    router.get("/users", async (ctx) => {
      ctx.responseBody = { found: true };
    });

    app.use(router.routes());

    const port = getPort();
    app.listen(port);
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Both should match (non-strict mode)
    const res1 = await fetch(`http://localhost:${port}/users`);
    expect(res1.status).toBe(200);

    const res2 = await fetch(`http://localhost:${port}/users/`);
    expect(res2.status).toBe(200);
  });

  test("should decode path parameters", async () => {
    app = new Application();
    const router = new Router();

    router.get("/search/:query", async (ctx) => {
      ctx.responseBody = { query: ctx.params.query };
    });

    app.use(router.routes());

    const port = getPort();
    app.listen(port);
    await new Promise((resolve) => setTimeout(resolve, 100));

    const res = await fetch(`http://localhost:${port}/search/${encodeURIComponent("hello world")}`);
    const json = await res.json();
    expect(json.query).toBe("hello world");
  });
});
