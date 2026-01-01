/**
 * Body parser middleware for EngineX
 *
 * Parses request bodies for various content types:
 * - application/json
 * - application/x-www-form-urlencoded
 * - text/*
 */

import type { Context, Next, Middleware } from "../application";

/**
 * Body parser options
 */
export interface BodyParserOptions {
  /**
   * Enable JSON parsing
   * @default true
   */
  json?: boolean;

  /**
   * Enable form parsing (x-www-form-urlencoded)
   * @default true
   */
  form?: boolean;

  /**
   * Enable text parsing
   * @default true
   */
  text?: boolean;

  /**
   * Maximum body size in bytes
   * @default 1mb (1048576)
   */
  maxSize?: number;

  /**
   * JSON types to parse
   * @default ["application/json", "application/json-patch+json", "application/vnd.api+json", "application/csp-report"]
   */
  jsonTypes?: string[];

  /**
   * Form types to parse
   * @default ["application/x-www-form-urlencoded"]
   */
  formTypes?: string[];

  /**
   * Text types to parse
   * @default ["text/*"]
   */
  textTypes?: string[];
}

/**
 * Check if content type matches pattern
 */
function matchContentType(contentType: string, patterns: string[]): boolean {
  const type = contentType.split(";")[0].trim().toLowerCase();

  for (const pattern of patterns) {
    if (pattern === type) return true;

    // Handle wildcards like "text/*"
    if (pattern.endsWith("/*")) {
      const prefix = pattern.slice(0, -1);
      if (type.startsWith(prefix)) return true;
    }
  }

  return false;
}

/**
 * Parse URL-encoded form data
 */
function parseForm(body: string): Record<string, string | string[]> {
  const result: Record<string, string | string[]> = {};
  const params = new URLSearchParams(body);

  for (const [key, value] of params) {
    if (key in result) {
      const existing = result[key];
      if (Array.isArray(existing)) {
        existing.push(value);
      } else {
        result[key] = [existing, value];
      }
    } else {
      result[key] = value;
    }
  }

  return result;
}

/**
 * Create body parser middleware
 *
 * In HybridApplication, the request body is already parsed by Bun's native
 * parser and available at ctx.body. This middleware provides additional
 * parsing for URL-encoded forms and ensures the body is properly parsed.
 *
 * @example
 * ```ts
 * // Default settings
 * app.use(bodyParser());
 *
 * // Custom settings
 * app.use(bodyParser({
 *   maxSize: 5 * 1024 * 1024, // 5MB
 *   json: true,
 *   form: true,
 *   text: false
 * }));
 *
 * // Access parsed body
 * app.use(async (ctx) => {
 *   console.log(ctx.body); // Already parsed
 * });
 * ```
 */
export function bodyParser(options: BodyParserOptions = {}): Middleware {
  const {
    json = true,
    form = true,
    text = true,
    maxSize = 1048576, // 1MB
    jsonTypes = [
      "application/json",
      "application/json-patch+json",
      "application/vnd.api+json",
      "application/csp-report",
    ],
    formTypes = ["application/x-www-form-urlencoded"],
    textTypes = ["text/*"],
  } = options;

  return async (ctx: Context, next: Next): Promise<void> => {
    // Skip if no body expected
    if (ctx.method === "GET" || ctx.method === "HEAD" || ctx.method === "DELETE") {
      await next();
      return;
    }

    // Body already parsed by Bun's native parser
    if (ctx.body !== null && ctx.body !== undefined && typeof ctx.body === "object") {
      await next();
      return;
    }

    const contentType = ctx.get("content-type") || "";
    const contentLength = parseInt(ctx.get("content-length") || "0", 10);

    // Check size limit
    if (contentLength > maxSize) {
      ctx.status = 413;
      ctx.responseBody = { error: "Payload Too Large" };
      return;
    }

    try {
      const rawBody = ctx.body;

      // JSON - parse string body if needed
      if (json && matchContentType(contentType, jsonTypes)) {
        if (typeof rawBody === "string") {
          (ctx as { body: unknown }).body = JSON.parse(rawBody);
        }
      }
      // Form - parse URL-encoded
      else if (form && matchContentType(contentType, formTypes)) {
        if (typeof rawBody === "string") {
          (ctx as { body: unknown }).body = parseForm(rawBody);
        }
      }
      // Text - keep as-is
      else if (text && matchContentType(contentType, textTypes)) {
        // Body is already a string, nothing to do
      }

      await next();
    } catch (err) {
      const error = err as Error;
      ctx.status = 400;
      ctx.responseBody = { error: `Invalid request body: ${error.message}` };
    }
  };
}

export default bodyParser;
