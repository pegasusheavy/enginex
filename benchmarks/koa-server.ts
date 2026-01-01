/**
 * Koa benchmark server
 */
import Koa from "koa";
import KoaRouter from "@koa/router";
import koaBodyParser from "koa-bodyparser";

const app = new Koa();
const router = new KoaRouter();

// Simple JSON response
router.get("/json", async (ctx) => {
  ctx.body = { message: "Hello, World!" };
});

// Path parameters
router.get("/users/:id", async (ctx) => {
  ctx.body = { id: ctx.params.id, name: `User ${ctx.params.id}` };
});

// Simulate database query delay
router.get("/db", async (ctx) => {
  await new Promise((resolve) => setTimeout(resolve, 1));
  ctx.body = { data: Array.from({ length: 10 }, (_, i) => ({ id: i, value: Math.random() })) };
});

// Plain text
router.get("/text", async (ctx) => {
  ctx.type = "text/plain";
  ctx.body = "Hello, World!";
});

// POST with body parsing
router.post("/echo", async (ctx) => {
  ctx.body = ctx.request.body;
});

// Multiple middleware
router.get("/middleware", async (ctx) => {
  ctx.state.step1 = true;
  ctx.state.step2 = true;
  ctx.state.step3 = true;
  ctx.body = { steps: ctx.state };
});

app.use(koaBodyParser());
app.use(router.routes());
app.use(router.allowedMethods());

const port = parseInt(process.env.PORT || "3002");
app.listen(port, () => {
  console.log(`Koa server running on http://localhost:${port}`);
});
