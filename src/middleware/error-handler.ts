/**
 * Error handler middleware for EngineX
 *
 * Provides centralized error handling with customizable responses.
 */

import type { Context, Next, Middleware } from "../application";

/**
 * HTTP error with status code
 */
export interface HttpError extends Error {
  status?: number;
  statusCode?: number;
  expose?: boolean;
  headers?: Record<string, string>;
}

/**
 * Error handler options
 */
export interface ErrorHandlerOptions {
  /**
   * Custom error handler function
   */
  handler?: (err: HttpError, ctx: Context) => void | Promise<void>;

  /**
   * Include stack trace in development
   * @default process.env.NODE_ENV !== "production"
   */
  includeStack?: boolean;

  /**
   * Custom error logger
   * @default console.error
   */
  logger?: (err: Error, ctx: Context) => void;

  /**
   * Always expose error message (even for 5xx errors)
   * @default false
   */
  exposeAll?: boolean;

  /**
   * Return JSON error responses
   * @default true
   */
  json?: boolean;

  /**
   * Custom error messages for status codes
   */
  messages?: Record<number, string>;
}

/**
 * Default HTTP status messages
 */
const STATUS_MESSAGES: Record<number, string> = {
  400: "Bad Request",
  401: "Unauthorized",
  402: "Payment Required",
  403: "Forbidden",
  404: "Not Found",
  405: "Method Not Allowed",
  406: "Not Acceptable",
  408: "Request Timeout",
  409: "Conflict",
  410: "Gone",
  413: "Payload Too Large",
  415: "Unsupported Media Type",
  422: "Unprocessable Entity",
  429: "Too Many Requests",
  500: "Internal Server Error",
  501: "Not Implemented",
  502: "Bad Gateway",
  503: "Service Unavailable",
  504: "Gateway Timeout",
};

/**
 * Create error handler middleware
 *
 * @example
 * ```ts
 * // Default error handler
 * app.use(errorHandler());
 *
 * // Custom handler
 * app.use(errorHandler({
 *   handler: (err, ctx) => {
 *     ctx.status = err.status || 500;
 *     ctx.responseBody = { error: err.message };
 *   }
 * }));
 *
 * // Include stack traces
 * app.use(errorHandler({
 *   includeStack: true
 * }));
 * ```
 */
export function errorHandler(options: ErrorHandlerOptions = {}): Middleware {
  const {
    handler,
    includeStack = process.env.NODE_ENV !== "production",
    logger = console.error,
    exposeAll = false,
    json = true,
    messages = {},
  } = options;

  const statusMessages = { ...STATUS_MESSAGES, ...messages };

  return async (ctx: Context, next: Next): Promise<void> => {
    try {
      await next();
    } catch (err) {
      const error = err as HttpError;

      // Use custom handler if provided
      if (handler) {
        await handler(error, ctx);
        return;
      }

      // Determine status code
      const status = error.status || error.statusCode || 500;
      ctx.status = status;

      // Set custom headers if present
      if (error.headers) {
        for (const [key, value] of Object.entries(error.headers)) {
          ctx.set(key, value);
        }
      }

      // Determine message
      let message: string;
      if (status < 500 || exposeAll || error.expose) {
        message = error.message;
      } else {
        message = statusMessages[status] || "Internal Server Error";
      }

      // Build response
      if (json) {
        const body: Record<string, unknown> = {
          error: message,
          status,
        };

        if (includeStack && error.stack) {
          body.stack = error.stack.split("\n").map((line) => line.trim());
        }

        ctx.responseBody = body;
      } else {
        ctx.responseBody = message;
      }

      // Log server errors
      if (status >= 500) {
        logger(error, ctx);
      }
    }
  };
}

/**
 * Create an HTTP error
 */
export function createError(
  status: number,
  message?: string,
  properties?: Partial<HttpError>
): HttpError {
  const error = new Error(message || STATUS_MESSAGES[status] || "Error") as HttpError;
  error.status = status;
  error.statusCode = status;
  error.expose = status < 500;

  if (properties) {
    Object.assign(error, properties);
  }

  return error;
}

export default errorHandler;
