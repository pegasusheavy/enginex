/**
 * EngineX Router Example
 *
 * Demonstrates the Router middleware with path parameters,
 * route grouping, and middleware composition.
 *
 * Run with: bun run examples/router-example.ts
 */
import { Application, Router, cors, errorHandler, logger } from "../src";

const app = new Application();

// ========== Middleware Stack ==========

// Logger - logs all requests with timing
app.use(
  logger({
    skip: (ctx) => ctx.path === "/health", // Skip health checks
  })
);

// Error handler - catches and formats errors
app.use(
  errorHandler({
    includeStack: process.env.NODE_ENV !== "production",
  })
);

// CORS - allow cross-origin requests
app.use(
  cors({
    origin: "*",
    credentials: false,
  })
);

// Custom middleware - add response time header
app.use(async (ctx, next) => {
  const start = Date.now();
  await next();
  ctx.set("X-Response-Time", `${Date.now() - start}ms`);
});

// ========== API Router ==========

const api = new Router({ prefix: "/api" });

// Health check
api.get("/health", async (ctx) => {
  ctx.responseBody = { status: "ok", timestamp: new Date().toISOString() };
});

// Users routes
api.group("/users", (users) => {
  // List users
  users.get("/", async (ctx) => {
    ctx.responseBody = {
      users: [
        { id: 1, name: "Alice" },
        { id: 2, name: "Bob" },
        { id: 3, name: "Charlie" },
      ],
    };
  });

  // Get user by ID
  users.get("/:id", async (ctx) => {
    const id = parseInt(ctx.params.id, 10);
    if (isNaN(id)) {
      ctx.throw(400, "Invalid user ID");
    }
    ctx.responseBody = { user: { id, name: `User ${id}` } };
  });

  // Create user
  users.post("/", async (ctx) => {
    const body = ctx.body as { name?: string };
    if (!body?.name) {
      ctx.throw(400, "Name is required");
    }
    ctx.status = 201;
    ctx.responseBody = {
      user: { id: Date.now(), name: body.name },
      message: "User created",
    };
  });

  // Update user
  users.put("/:id", async (ctx) => {
    const id = parseInt(ctx.params.id, 10);
    const body = ctx.body as { name?: string };
    ctx.responseBody = {
      user: { id, name: body?.name ?? "Updated User" },
      message: "User updated",
    };
  });

  // Delete user
  users.delete("/:id", async (ctx) => {
    const id = parseInt(ctx.params.id, 10);
    ctx.responseBody = { deleted: id, message: "User deleted" };
  });
});

// Posts routes with nested comments
api.group("/posts", (posts) => {
  posts.get("/", async (ctx) => {
    ctx.responseBody = {
      posts: [
        { id: 1, title: "Hello World", authorId: 1 },
        { id: 2, title: "EngineX is awesome", authorId: 2 },
      ],
    };
  });

  posts.get("/:postId", async (ctx) => {
    ctx.responseBody = {
      post: {
        id: parseInt(ctx.params.postId, 10),
        title: "Sample Post",
        content: "This is the post content...",
      },
    };
  });

  // Nested comments
  posts.get("/:postId/comments", async (ctx) => {
    ctx.responseBody = {
      postId: ctx.params.postId,
      comments: [
        { id: 1, text: "Great post!" },
        { id: 2, text: "Thanks for sharing" },
      ],
    };
  });

  posts.get("/:postId/comments/:commentId", async (ctx) => {
    ctx.responseBody = {
      postId: ctx.params.postId,
      comment: {
        id: parseInt(ctx.params.commentId, 10),
        text: "This is a comment",
      },
    };
  });
});

// Search with query params
api.get("/search", async (ctx) => {
  ctx.responseBody = {
    query: ctx.query,
    results: [
      { type: "user", id: 1, name: "Search Result 1" },
      { type: "post", id: 2, title: "Search Result 2" },
    ],
  };
});

// Catch-all for API 404s
api.all("/*", async (ctx) => {
  ctx.status = 404;
  ctx.responseBody = {
    error: "API endpoint not found",
    path: ctx.path,
    method: ctx.method,
  };
});

// ========== Static Routes ==========

const staticRouter = new Router();

staticRouter.get("/", async (ctx) => {
  ctx.set("Content-Type", "text/html");
  ctx.responseBody = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>EngineX Demo</title>
        <style>
          body { font-family: system-ui; max-width: 800px; margin: 50px auto; padding: 20px; }
          code { background: #f0f0f0; padding: 2px 6px; border-radius: 3px; }
          pre { background: #f0f0f0; padding: 15px; border-radius: 5px; overflow-x: auto; }
        </style>
      </head>
      <body>
        <h1>🚀 EngineX Framework</h1>
        <p>Welcome to the EngineX router demo!</p>
        <h2>API Endpoints</h2>
        <pre>
GET  /api/health
GET  /api/users
GET  /api/users/:id
POST /api/users
PUT  /api/users/:id
DELETE /api/users/:id
GET  /api/posts
GET  /api/posts/:postId
GET  /api/posts/:postId/comments
GET  /api/posts/:postId/comments/:commentId
GET  /api/search?q=term
        </pre>
        <h2>Try it</h2>
        <pre>curl http://localhost:8787/api/users
curl http://localhost:8787/api/users/123
curl -X POST -H "Content-Type: application/json" -d '{"name":"John"}' http://localhost:8787/api/users
curl http://localhost:8787/api/posts/1/comments</pre>
      </body>
    </html>
  `;
});

staticRouter.get("/health", async (ctx) => {
  ctx.responseBody = { status: "ok" };
});

// ========== Mount Routers ==========

app.use(api.routes());
app.use(staticRouter.routes());

// ========== Global 404 Handler ==========

app.use(async (ctx) => {
  ctx.status = 404;
  ctx.responseBody = { error: "Not Found", path: ctx.path };
});

// ========== Start Server ==========

const port = Number(process.env.PORT) || 8787;
const host = process.env.HOST || "localhost";

app.listen(port, host, () => {
  console.log(`
╔════════════════════════════════════════════════════════════════╗
║                    EngineX Router Demo                         ║
╠════════════════════════════════════════════════════════════════╣
║  HTTP: http://${host}:${port}
║                                                                ║
║  Endpoints:                                                    ║
║    /              - HTML homepage                              ║
║    /health        - Health check                               ║
║    /api/health    - API health check                           ║
║    /api/users     - Users CRUD                                 ║
║    /api/posts     - Posts with nested comments                 ║
║    /api/search    - Search with query params                   ║
╚════════════════════════════════════════════════════════════════╝
  `);
});
