/**
 * EngineX benchmark server
 */
import { Application, Router, cors, logger } from "../src";

const app = new Application();
const router = new Router();

// Simple JSON response
router.get("/json", async (ctx) => {
  ctx.status = 200;
  ctx.responseBody = { message: "Hello, World!" };
});

// Path parameters
router.get("/users/:id", async (ctx) => {
  ctx.status = 200;
  ctx.responseBody = { id: ctx.params.id, name: `User ${ctx.params.id}` };
});

// Simulate database query delay
router.get("/db", async (ctx) => {
  await new Promise((resolve) => setTimeout(resolve, 1));
  ctx.status = 200;
  ctx.responseBody = {
    data: Array.from({ length: 10 }, (_, i) => ({ id: i, value: Math.random() })),
  };
});

// Plain text
router.get("/text", async (ctx) => {
  ctx.status = 200;
  ctx.set("content-type", "text/plain");
  ctx.responseBody = "Hello, World!";
});

// POST with body parsing
router.post("/echo", async (ctx) => {
  ctx.status = 200;
  ctx.responseBody = ctx.body;
});

// Multiple middleware
router.get("/middleware", async (ctx) => {
  ctx.state.step1 = true;
  ctx.state.step2 = true;
  ctx.state.step3 = true;
  ctx.status = 200;
  ctx.responseBody = { steps: ctx.state };
});

app.use(router.routes());

const port = parseInt(process.env.PORT || "3001");
app.listen(port, () => {
  console.log(`EngineX server running on http://localhost:${port}`);
});
