/**
 * EngineX - Koa-compatible HTTP server for Bun
 *
 * A high-performance, Koa-compatible HTTP framework that wraps Bun.serve
 * with the familiar middleware pattern you know and love.
 */

import { EventEmitter } from "events";

export type Next = () => Promise<void>;

/**
 * Request/Response context
 *
 * Provides Koa-compatible access to request and response properties.
 */
export interface Context {
  // Request properties
  method: string;
  path: string;
  url: string;
  query: Record<string, string>;
  headers: Record<string, string>;
  body: unknown;
  params: Record<string, string>;
  request: Request;

  // Response properties
  status: number;
  responseBody: unknown;
  responseHeaders: Record<string, string>;

  // State
  state: Record<string, unknown>;

  // Methods
  get(field: string): string | undefined;
  set(field: string | Record<string, string>, val?: string): void;
  throw(status: number, message?: string): never;
  redirect(url: string): void;

  // Internal
  _reqHeaders: Headers;
}

export type Middleware = (ctx: Context, next: Next) => Promise<void> | void;

// Shared context methods - defined once, not per request
function ctxGet(this: Context, field: string): string | undefined {
  const lower = field.toLowerCase();
  let val = this.headers[lower];
  if (val === undefined) {
    val = this._reqHeaders.get(field) || "";
    this.headers[lower] = val;
  }
  return val || undefined;
}

function ctxSet(this: Context, field: string | Record<string, string>, val?: string): void {
  if (typeof field === "object") {
    for (const k in field) {
      this.responseHeaders[k.toLowerCase()] = field[k];
    }
  } else if (val !== undefined) {
    this.responseHeaders[field.toLowerCase()] = val;
  }
}

function ctxThrow(status: number, message?: string): never {
  const err = new Error(message || "Error") as Error & { status: number };
  err.status = status;
  throw err;
}

function ctxRedirect(this: Context, url: string): void {
  this.status = 302;
  this.responseHeaders.location = url;
  this.responseBody = `Redirecting to ${url}`;
}

/**
 * Compose middleware into a single function
 *
 * Implements the "onion model" where each middleware can run code
 * before and after the next middleware in the stack.
 *
 * @example
 * ```ts
 * const composed = compose([
 *   async (ctx, next) => {
 *     console.log('before');
 *     await next();
 *     console.log('after');
 *   },
 *   async (ctx) => {
 *     ctx.responseBody = 'Hello';
 *   }
 * ]);
 * ```
 */
export function compose(middleware: Middleware[]) {
  if (!Array.isArray(middleware)) {
    throw new TypeError("Middleware stack must be an array!");
  }

  for (const fn of middleware) {
    if (typeof fn !== "function") {
      throw new TypeError("Middleware must be composed of functions!");
    }
  }

  const len = middleware.length;

  if (len === 0) {
    return async (_ctx: Context, next?: Next): Promise<void> => {
      if (next) await next();
    };
  }

  return async function composed(ctx: Context, next?: Next): Promise<void> {
    let index = -1;

    const dispatch = async (i: number): Promise<void> => {
      if (i <= index) throw new Error("next() called multiple times");
      index = i;
      if (i < len) await middleware[i](ctx, () => dispatch(i + 1));
      else if (next) await next();
    };

    await dispatch(0);
  };
}

export interface ServerOptions {
  port?: number;
  hostname?: string;
}

// Pre-allocated frozen empty object
const EMPTY_QUERY: Record<string, string> = Object.freeze(Object.create(null));

/**
 * Koa-compatible HTTP Application for Bun
 *
 * @example
 * ```ts
 * import { Application } from 'enginex';
 *
 * const app = new Application();
 *
 * app.use(async (ctx, next) => {
 *   const start = Date.now();
 *   await next();
 *   ctx.set('X-Response-Time', `${Date.now() - start}ms`);
 * });
 *
 * app.use(async (ctx) => {
 *   ctx.status = 200;
 *   ctx.responseBody = { message: 'Hello, World!' };
 * });
 *
 * app.listen(3000, () => {
 *   console.log('Server running on http://localhost:3000');
 * });
 * ```
 */
export class Application extends EventEmitter {
  middleware: Middleware[] = [];
  private server: ReturnType<typeof Bun.serve> | null = null;

  /**
   * Add middleware to the application
   */
  use(fn: Middleware): this {
    if (typeof fn !== "function") {
      throw new TypeError("middleware must be a function!");
    }
    this.middleware.push(fn);
    return this;
  }

  /**
   * Start the HTTP server
   */
  listen(port?: number, hostname?: string, callback?: () => void): this;
  listen(port?: number, callback?: () => void): this;
  listen(options?: ServerOptions, callback?: () => void): this;
  listen(...args: unknown[]): this {
    let port = 3000;
    let hostname = "localhost";
    let callback: (() => void) | undefined;

    for (const arg of args) {
      if (typeof arg === "number") port = arg;
      else if (typeof arg === "string") hostname = arg;
      else if (typeof arg === "function") callback = arg as () => void;
      else if (arg && typeof arg === "object") {
        const opts = arg as ServerOptions;
        if (opts.port) port = opts.port;
        if (opts.hostname) hostname = opts.hostname;
      }
    }

    const fn = compose(this.middleware);
    const hasErrorListeners = this.listenerCount("error") > 0;
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const self = this;

    this.server = Bun.serve({
      port,
      hostname,
      fetch: async (req) => {
        const urlStr = req.url;
        const method = req.method;
        const reqHeaders = req.headers;

        // Inline URL parsing - avoid object creation
        let path: string;
        let query: Record<string, string>;

        const qIdx = urlStr.indexOf("?");
        const pStart = urlStr.indexOf("/", 8);

        if (qIdx === -1) {
          path = pStart === -1 ? "/" : urlStr.slice(pStart);
          query = EMPTY_QUERY;
        } else {
          path = urlStr.slice(pStart === -1 ? 0 : pStart, qIdx);
          query = Object.create(null);
          const qs = urlStr.slice(qIdx + 1);
          let i = 0;
          const len = qs.length;
          while (i < len) {
            const eqIdx = qs.indexOf("=", i);
            if (eqIdx === -1) break;
            let ampIdx = qs.indexOf("&", eqIdx);
            if (ampIdx === -1) ampIdx = len;
            const key = qs.slice(i, eqIdx);
            const val = qs.slice(eqIdx + 1, ampIdx);
            try {
              query[decodeURIComponent(key)] = decodeURIComponent(val);
            } catch {
              query[key] = val;
            }
            i = ampIdx + 1;
          }
        }

        // Create minimal context object
        const ctx: Context = {
          method,
          path,
          url: urlStr,
          query,
          headers: Object.create(null),
          body: null,
          params: Object.create(null),
          request: req,
          status: 404,
          responseBody: null,
          responseHeaders: Object.create(null),
          state: Object.create(null),
          _reqHeaders: reqHeaders,
          get: ctxGet,
          set: ctxSet,
          throw: ctxThrow,
          redirect: ctxRedirect,
        };

        // Parse body only for methods that have bodies
        if (method !== "GET" && method !== "HEAD") {
          const ct = reqHeaders.get("content-type");
          if (ct) {
            if (ct.indexOf("json") !== -1) {
              try {
                ctx.body = await req.json();
              } catch {
                // Ignore parse errors
              }
            } else if (ct.indexOf("text") !== -1) {
              try {
                ctx.body = await req.text();
              } catch {
                // Ignore parse errors
              }
            }
          }
        }

        try {
          await fn(ctx);
        } catch (err) {
          const error = err as Error & { status?: number };
          ctx.status = error.status || 500;
          ctx.responseBody = { error: error.message };
          if (hasErrorListeners) self.emit("error", error, ctx);
        }

        // Fast response building
        const body = ctx.responseBody;
        const resHeaders = ctx.responseHeaders;
        const status = ctx.status;

        if (body === null || body === undefined) {
          return new Response(null, { status, headers: resHeaders });
        }

        if (typeof body === "string") {
          if (!resHeaders["content-type"]) {
            resHeaders["content-type"] = "text/plain; charset=utf-8";
          }
          return new Response(body, { status, headers: resHeaders });
        }

        if (!resHeaders["content-type"]) {
          resHeaders["content-type"] = "application/json; charset=utf-8";
        }
        return new Response(JSON.stringify(body), { status, headers: resHeaders });
      },
    });

    if (callback) queueMicrotask(callback);
    return this;
  }

  /**
   * Stop the HTTP server
   */
  close(): Promise<void> {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.stop();
        this.server = null;
      }
      resolve();
    });
  }

  /**
   * Get the server port (if running)
   */
  get port(): number | undefined {
    return this.server?.port;
  }
}

export default Application;
