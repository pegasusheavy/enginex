<p align="center">
  <img src="https://raw.githubusercontent.com/pegasusheavy/enginex/main/.github/logo.svg" alt="EngineX" width="400">
</p>

<h1 align="center">EngineX</h1>

<p align="center">
  <strong>Koa-compatible HTTP server for Bun</strong>
</p>

<p align="center">
  <a href="#features">Features</a> •
  <a href="#installation">Installation</a> •
  <a href="#quick-start">Quick Start</a> •
  <a href="#api">API</a> •
  <a href="#middleware">Middleware</a>
</p>

---

## Overview

EngineX brings the beloved [Koa](https://koajs.com/) API to [Bun](https://bun.sh/). Use the familiar middleware pattern you know and love with Bun's blazing fast HTTP server.

```typescript
import { Application, Router, cors, logger } from "@pegasusheavy/enginex";

const app = new Application();
const router = new Router();

app.use(logger());
app.use(cors());

router.get("/", async (ctx) => {
  ctx.responseBody = { message: "Hello from EngineX! 🚀" };
});

router.get("/users/:id", async (ctx) => {
  ctx.responseBody = { userId: ctx.params.id };
});

app.use(router.routes());
app.listen(3000);
```

## Features

### 🚀 **Fast**

- Built on Bun's native HTTP server
- Optimized middleware composition
- Trie-based router for O(m) path matching

### 🎯 **Koa-Compatible API**

- Familiar `ctx` object with request/response helpers
- Onion-model middleware composition
- `async/await` throughout

### 🔧 **Batteries Included**

- **Router** - Path parameters, wildcards, route groups
- **CORS** - Configurable cross-origin support
- **Logger** - Beautiful request logging with timing
- **Error Handler** - Centralized error handling
- **Body Parser** - JSON, form, and text parsing

### 📦 **Zero Dependencies**

- Pure TypeScript
- Just Bun - no Node.js required

## Installation

```bash
bun add @pegasusheavy/enginex
```

### From Source

```bash
git clone https://github.com/pegasusheavy/enginex.git
cd enginex
bun install
bun test
```

## Quick Start

### Basic Server

```typescript
import { Application } from "@pegasusheavy/enginex";

const app = new Application();

// Simple middleware
app.use(async (ctx, next) => {
  const start = Date.now();
  await next();
  ctx.set("X-Response-Time", `${Date.now() - start}ms`);
});

// Response handler
app.use(async (ctx) => {
  ctx.status = 200;
  ctx.responseBody = { hello: "world" };
});

app.listen(3000, () => {
  console.log("Server running on http://localhost:3000");
});
```

### With Router

```typescript
import { Application, Router } from "@pegasusheavy/enginex";

const app = new Application();
const router = new Router();

router.get("/", async (ctx) => {
  ctx.responseBody = { message: "Home" };
});

router.get("/users", async (ctx) => {
  ctx.responseBody = { users: [] };
});

router.get("/users/:id", async (ctx) => {
  ctx.responseBody = { user: { id: ctx.params.id } };
});

router.post("/users", async (ctx) => {
  ctx.status = 201;
  ctx.responseBody = { created: true, data: ctx.body };
});

app.use(router.routes());
app.listen(3000);
```

### Full Stack Example

```typescript
import { Application, Router, cors, logger, errorHandler } from "@pegasusheavy/enginex";

const app = new Application();

// Middleware stack
app.use(logger({ skip: (ctx) => ctx.path === "/health" }));
app.use(errorHandler({ includeStack: process.env.NODE_ENV !== "production" }));
app.use(cors({ origin: "https://example.com", credentials: true }));

// API Router
const api = new Router({ prefix: "/api/v1" });

api.get("/health", async (ctx) => {
  ctx.responseBody = { status: "ok" };
});

api.group("/users", (users) => {
  users.get("/", async (ctx) => {
    ctx.responseBody = { users: await getUsers() };
  });

  users.get("/:id", async (ctx) => {
    const user = await getUser(ctx.params.id);
    if (!user) ctx.throw(404, "User not found");
    ctx.responseBody = { user };
  });

  users.post("/", async (ctx) => {
    const user = await createUser(ctx.body);
    ctx.status = 201;
    ctx.responseBody = { user };
  });
});

app.use(api.routes());
app.listen(3000);
```

## API

### Application

The main application class.

```typescript
const app = new Application();

// Register middleware
app.use(middleware);

// Start server
app.listen(port, hostname?, callback?);
app.listen(options, callback?);

// Stop server
await app.close();

// Error handling
app.on("error", (err, ctx) => {
  console.error("Server error:", err);
});
```

### Context (ctx)

The context object encapsulates the request and response.

#### Request Properties

| Property      | Type      | Description                    |
| ------------- | --------- | ------------------------------ |
| `ctx.method`  | `string`  | HTTP method (GET, POST, etc.)  |
| `ctx.path`    | `string`  | Request path                   |
| `ctx.url`     | `string`  | Full request URL               |
| `ctx.query`   | `object`  | Parsed query parameters        |
| `ctx.headers` | `object`  | Request headers                |
| `ctx.body`    | `unknown` | Parsed request body            |
| `ctx.params`  | `object`  | Route parameters (with Router) |

#### Response Properties

| Property              | Type      | Description          |
| --------------------- | --------- | -------------------- |
| `ctx.status`          | `number`  | Response status code |
| `ctx.responseBody`    | `unknown` | Response body        |
| `ctx.responseHeaders` | `object`  | Response headers     |

#### Methods

```typescript
// Get request header
ctx.get("Content-Type"); // "application/json"

// Set response header
ctx.set("X-Custom", "value");
ctx.set({ "X-One": "1", "X-Two": "2" });

// Redirect
ctx.redirect("/new-location");

// Throw error
ctx.throw(404, "Not Found");
ctx.throw(401, "Unauthorized");

// Access state (shared between middleware)
ctx.state.user = { id: 1 };
```

### Router

Path-based routing with parameter support.

```typescript
const router = new Router();
const router = new Router({ prefix: "/api" });

// HTTP methods
router.get(path, handler);
router.post(path, handler);
router.put(path, handler);
router.delete(path, handler);
router.patch(path, handler);
router.head(path, handler);
router.options(path, handler);
router.all(path, handler); // All methods

// Path parameters
router.get("/users/:id", async (ctx) => {
  console.log(ctx.params.id);
});

// Wildcards
router.all("/api/*", async (ctx) => {
  // Matches /api/anything
});

// Route groups
router.group("/admin", (admin) => {
  admin.get("/dashboard", handler);
  admin.get("/users", handler);
});

// Named routes
router.get("user", "/users/:id", handler);
router.url("user", { id: "123" }); // "/users/123"

// Mount routes
app.use(router.routes());
```

## Middleware

### Built-in Middleware

#### CORS

```typescript
import { cors } from "@pegasusheavy/enginex";

app.use(cors());
app.use(cors({ origin: "https://example.com" }));
app.use(
  cors({
    origin: ["https://a.com", "https://b.com"],
    allowMethods: ["GET", "POST", "PUT", "DELETE"],
    allowHeaders: ["Authorization", "Content-Type"],
    credentials: true,
    maxAge: 86400,
  })
);
```

#### Logger

```typescript
import { logger } from "@pegasusheavy/enginex";

app.use(logger());
app.use(
  logger({
    skip: (ctx) => ctx.path === "/health",
    colors: true,
    timestamp: true,
  })
);
```

#### Error Handler

```typescript
import { errorHandler, createError } from "@pegasusheavy/enginex";

app.use(errorHandler());
app.use(
  errorHandler({
    includeStack: process.env.NODE_ENV !== "production",
    json: true,
  })
);

// Throwing errors
ctx.throw(404, "Resource not found");
throw createError(400, "Invalid input", { expose: true });
```

#### Body Parser

```typescript
import { bodyParser } from "@pegasusheavy/enginex";

app.use(
  bodyParser({
    json: true,
    form: true,
    text: true,
    maxSize: 5 * 1024 * 1024, // 5MB
  })
);
```

### Custom Middleware

```typescript
// Logger middleware
const requestLogger = async (ctx, next) => {
  const start = Date.now();
  console.log(`--> ${ctx.method} ${ctx.path}`);
  await next();
  console.log(`<-- ${ctx.method} ${ctx.path} ${ctx.status} ${Date.now() - start}ms`);
};

// Auth middleware
const auth = async (ctx, next) => {
  const token = ctx.get("authorization");
  if (!token) ctx.throw(401, "Unauthorized");
  ctx.state.user = await validateToken(token);
  await next();
};

app.use(requestLogger);
app.use(auth);
```

## Performance

EngineX is optimized for performance:

- **Trie Router** - O(m) path matching where m is path length
- **Minimal Allocations** - Reuses objects where possible
- **Inline URL Parsing** - No regex for query strings
- **Native Bun** - Direct use of Bun.serve

See [BENCHMARK.md](./BENCHMARK.md) for detailed performance comparisons.

## Examples

See the [examples](./examples) directory:

- [`hello-world.ts`](./examples/hello-world.ts) - Basic server
- [`router-example.ts`](./examples/router-example.ts) - Full router demo

```bash
bun run examples/hello-world.ts
bun run examples/router-example.ts
```

## Testing

```bash
bun test
```

## Migrating from Koa

EngineX is designed to be a drop-in replacement for Koa on Bun:

```diff
- import Koa from 'koa';
- import Router from '@koa/router';
+ import { Application, Router } from 'enginex';

- const app = new Koa();
+ const app = new Application();

  const router = new Router();

  router.get('/', async (ctx) => {
-   ctx.body = { hello: 'world' };
+   ctx.responseBody = { hello: 'world' };
  });

  app.use(router.routes());
  app.listen(3000);
```

Key differences:

- `ctx.body` → `ctx.responseBody`
- Body is already parsed (no need for koa-bodyparser for simple cases)

## License

EngineX is dual-licensed under:

- [MIT License](LICENSE-MIT)
- [Apache License 2.0](LICENSE-APACHE)

---

<p align="center">
  Built with ❤️ by <a href="https://github.com/PegasusHeavyIndustries">Pegasus Heavy Industries</a>
</p>
