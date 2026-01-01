/**
 * Logger middleware for EngineX
 *
 * Provides request/response logging with timing information.
 */

import type { Context, Next, Middleware } from "../application";

/**
 * Logger options
 */
export interface LoggerOptions {
  /**
   * Custom log function
   * @default console.log
   */
  logger?: (message: string) => void;

  /**
   * Skip logging for certain requests
   */
  skip?: (ctx: Context) => boolean;

  /**
   * Log format function
   */
  format?: (ctx: Context, time: number) => string;

  /**
   * Include timestamp
   * @default true
   */
  timestamp?: boolean;

  /**
   * Use colors (for terminal output)
   * @default true
   */
  colors?: boolean;
}

/**
 * ANSI color codes
 */
const colors = {
  reset: "\x1b[0m",
  dim: "\x1b[2m",
  green: "\x1b[32m",
  cyan: "\x1b[36m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  magenta: "\x1b[35m",
};

/**
 * Get status color
 */
function statusColor(status: number, useColors: boolean): string {
  if (!useColors) return "";

  if (status >= 500) return colors.red;
  if (status >= 400) return colors.yellow;
  if (status >= 300) return colors.cyan;
  if (status >= 200) return colors.green;
  return colors.dim;
}

/**
 * Format time in human-readable form
 */
function formatTime(ms: number): string {
  if (ms < 1) return `${(ms * 1000).toFixed(0)}µs`;
  if (ms < 1000) return `${ms.toFixed(0)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

/**
 * Default format function
 */
function defaultFormat(ctx: Context, time: number, useColors: boolean): string {
  const status = ctx.status;
  const method = ctx.method.padEnd(7);
  const path = ctx.path;
  const timeStr = formatTime(time);

  if (useColors) {
    const sc = statusColor(status, true);
    return `${colors.dim}<--${colors.reset} ${colors.cyan}${method}${colors.reset} ${path} ${sc}${status}${colors.reset} ${colors.dim}${timeStr}${colors.reset}`;
  }

  return `<-- ${method} ${path} ${status} ${timeStr}`;
}

/**
 * Create logger middleware
 *
 * @example
 * ```ts
 * // Default logger
 * app.use(logger());
 *
 * // Custom format
 * app.use(logger({
 *   format: (ctx, time) => `${ctx.method} ${ctx.path} - ${time}ms`
 * }));
 *
 * // Skip health checks
 * app.use(logger({
 *   skip: (ctx) => ctx.path === "/health"
 * }));
 * ```
 */
export function logger(options: LoggerOptions = {}): Middleware {
  const {
    logger: log = console.log,
    skip,
    format,
    timestamp = true,
    colors: useColors = true,
  } = options;

  return async (ctx: Context, next: Next): Promise<void> => {
    // Check if we should skip
    if (skip?.(ctx)) {
      await next();
      return;
    }

    const start = performance.now();

    // Log incoming request
    if (useColors) {
      log(`${colors.dim}-->${colors.reset} ${colors.cyan}${ctx.method}${colors.reset} ${ctx.path}`);
    } else {
      log(`--> ${ctx.method} ${ctx.path}`);
    }

    try {
      await next();
    } finally {
      const time = performance.now() - start;

      let message: string;
      if (format) {
        message = format(ctx, time);
      } else {
        message = defaultFormat(ctx, time, useColors);
      }

      if (timestamp) {
        const ts = new Date().toISOString();
        if (useColors) {
          message = `${colors.dim}[${ts}]${colors.reset} ${message}`;
        } else {
          message = `[${ts}] ${message}`;
        }
      }

      log(message);
    }
  };
}

export default logger;
