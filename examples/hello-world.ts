/**
 * EngineX Hello World Example
 *
 * Uses Bun's native HTTP server with Koa-style middleware composition.
 * Run with: bun run examples/hello-world.ts
 */
import { Application, type Context } from "../src";

const app = new Application();

// Logger middleware
app.use(async (ctx: Context, next) => {
  const start = Date.now();
  console.log(`--> ${ctx.method} ${ctx.path}`);

  await next();

  const ms = Date.now() - start;
  ctx.set("X-Response-Time", `${ms}ms`);
  console.log(`<-- ${ctx.method} ${ctx.path} ${ctx.status} ${ms}ms`);
});

// Error handler middleware
app.use(async (ctx: Context, next) => {
  try {
    await next();
  } catch (err) {
    const error = err as Error & { status?: number };
    ctx.status = error.status || 500;
    ctx.responseBody = {
      error: error.message || "Internal Server Error",
    };
    console.error("Error:", error);
  }
});

// Router-like middleware
app.use(async (ctx: Context) => {
  const { method, path } = ctx;

  if (method === "GET" && path === "/") {
    ctx.status = 200;
    ctx.responseBody = {
      message: "Hello from EngineX!",
    };
    return;
  }

  if (method === "GET" && path === "/health") {
    ctx.status = 200;
    ctx.responseBody = { status: "ok" };
    return;
  }

  if (method === "POST" && path === "/echo") {
    ctx.status = 200;
    ctx.responseBody = {
      received: ctx.body,
      timestamp: new Date().toISOString(),
    };
    return;
  }

  if (method === "GET" && path === "/redirect") {
    ctx.redirect("/");
    return;
  }

  // 404 Not Found
  ctx.status = 404;
  ctx.responseBody = {
    error: "Not Found",
    path,
  };
});

// Error event handler
app.on("error", (err: Error, ctx: Context) => {
  console.error("Server error:", err, { path: ctx.path, method: ctx.method });
});

// Start server
const port = Number(process.env.PORT) || 8787;
const host = process.env.HOST || "localhost";

app.listen(port, host, () => {
  console.log(`
╔════════════════════════════════════════════════════════════════╗
║                      EngineX Server                            ║
╠════════════════════════════════════════════════════════════════╣
║  HTTP: http://${host}:${port}
║                                                                ║
║  Test with:                                                    ║
║    curl http://${host}:${port}/
║    curl http://${host}:${port}/health
║    curl -X POST -H "Content-Type: application/json" \\
║         -d '{"test":1}' http://${host}:${port}/echo
╚════════════════════════════════════════════════════════════════╝
  `);
});
