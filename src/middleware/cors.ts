/**
 * CORS middleware for EngineX
 *
 * Provides Cross-Origin Resource Sharing (CORS) support with
 * configurable origins, methods, and headers.
 */

import type { Next, Middleware } from "../application";

/**
 * CORS middleware options
 */
export interface CorsOptions {
  /**
   * Origin(s) to allow
   * - string: exact origin (e.g., "https://example.com")
   * - string[]: multiple origins
   * - "*": all origins (not recommended for credentials)
   * - function: dynamic origin check
   * @default "*"
   */
  origin?: string | string[] | ((ctx: HybridContext) => string | false);

  /**
   * Allowed HTTP methods
   * @default ["GET", "HEAD", "PUT", "POST", "DELETE", "PATCH"]
   */
  allowMethods?: string[];

  /**
   * Allowed headers
   * @default Reflects the request's Access-Control-Request-Headers
   */
  allowHeaders?: string[];

  /**
   * Headers exposed to the client
   */
  exposeHeaders?: string[];

  /**
   * Allow credentials (cookies, authorization headers)
   * @default false
   */
  credentials?: boolean;

  /**
   * Cache duration for preflight requests (in seconds)
   * @default 86400 (24 hours)
   */
  maxAge?: number;

  /**
   * Keep headers on error
   * @default false
   */
  keepHeadersOnError?: boolean;
}

/**
 * Default allowed methods
 */
const DEFAULT_METHODS = ["GET", "HEAD", "PUT", "POST", "DELETE", "PATCH"];

/**
 * Create CORS middleware
 *
 * @example
 * ```ts
 * // Allow all origins
 * app.use(cors());
 *
 * // Specific origin
 * app.use(cors({ origin: "https://example.com" }));
 *
 * // Multiple origins
 * app.use(cors({ origin: ["https://a.com", "https://b.com"] }));
 *
 * // Dynamic origin
 * app.use(cors({
 *   origin: (ctx) => {
 *     const origin = ctx.get("origin");
 *     if (allowedOrigins.includes(origin)) {
 *       return origin;
 *     }
 *     return false;
 *   }
 * }));
 *
 * // With credentials
 * app.use(cors({
 *   origin: "https://example.com",
 *   credentials: true
 * }));
 * ```
 */
export function cors(options: CorsOptions = {}): Middleware {
  const {
    origin = "*",
    allowMethods = DEFAULT_METHODS,
    allowHeaders,
    exposeHeaders,
    credentials = false,
    maxAge = 86400,
    keepHeadersOnError = false,
  } = options;

  return async (ctx: HybridContext, next: Next): Promise<void> => {
    const requestOrigin = ctx.get("origin");

    // Determine the origin to send
    let allowOrigin: string | false = false;

    if (typeof origin === "function") {
      allowOrigin = origin(ctx);
    } else if (origin === "*") {
      // Wildcard - but can't use with credentials
      allowOrigin = credentials ? requestOrigin || "*" : "*";
    } else if (typeof origin === "string") {
      allowOrigin = origin;
    } else if (Array.isArray(origin)) {
      if (requestOrigin && origin.includes(requestOrigin)) {
        allowOrigin = requestOrigin;
      }
    }

    // No CORS needed if no origin header or origin not allowed
    if (!allowOrigin) {
      await next();
      return;
    }

    // Set CORS headers
    ctx.set("Access-Control-Allow-Origin", allowOrigin);

    if (credentials) {
      ctx.set("Access-Control-Allow-Credentials", "true");
    }

    if (exposeHeaders?.length) {
      ctx.set("Access-Control-Expose-Headers", exposeHeaders.join(", "));
    }

    // Handle preflight OPTIONS request
    if (ctx.method === "OPTIONS") {
      // Check for preflight request
      const requestMethod = ctx.get("access-control-request-method");

      if (!requestMethod) {
        // Not a preflight, pass through
        await next();
        return;
      }

      // Set preflight headers
      ctx.set("Access-Control-Allow-Methods", allowMethods.join(", "));

      // Allow headers
      const requestHeaders = ctx.get("access-control-request-headers");
      if (allowHeaders?.length) {
        ctx.set("Access-Control-Allow-Headers", allowHeaders.join(", "));
      } else if (requestHeaders) {
        ctx.set("Access-Control-Allow-Headers", requestHeaders);
      }

      // Cache duration
      if (maxAge > 0) {
        ctx.set("Access-Control-Max-Age", String(maxAge));
      }

      // Respond to preflight
      ctx.status = 204;
      ctx.responseBody = "";
      return;
    }

    // For actual requests, continue through middleware
    try {
      await next();
    } catch (err) {
      if (!keepHeadersOnError) {
        throw err;
      }

      // Re-set headers on error if keepHeadersOnError is true
      const error = err as Error & { status?: number };
      ctx.status = error.status || 500;
      ctx.responseBody = { error: error.message };
    }
  };
}

export default cors;
