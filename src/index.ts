/**
 * EngineX - Koa-compatible HTTP server for Bun
 *
 * A high-performance, Koa-compatible HTTP framework built on Bun.serve.
 * Use the familiar middleware pattern you know from Koa with Bun's speed.
 *
 * @example
 * ```ts
 * import { Application, Router } from 'enginex';
 *
 * const app = new Application();
 * const router = new Router();
 *
 * router.get('/', async (ctx) => {
 *   ctx.responseBody = { message: 'Hello, World!' };
 * });
 *
 * app.use(router.routes());
 * app.listen(3000);
 * ```
 */

// Core
export { Application, compose } from "./application";
export type { Context, Middleware, Next, ServerOptions } from "./application";

// Middleware
export { Router, cors, bodyParser, logger, errorHandler, createError } from "./middleware";
export type {
  RouterOptions,
  RouteHandler,
  RouteParams,
  HttpMethod,
  CorsOptions,
  BodyParserOptions,
  LoggerOptions,
  ErrorHandlerOptions,
} from "./middleware";

// Default export
export { Application as default } from "./application";
