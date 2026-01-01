/**
 * High-performance Trie-based Router for EngineX
 *
 * Uses a radix trie for O(m) path matching where m is path length.
 * Much faster than regex-based routers for route lookup.
 */

import type { Context, Next, Middleware } from "../application";

export type RouteHandler = (ctx: Context, next: Next) => Promise<void> | void;
export type RouteParams = Record<string, string>;
export type HttpMethod = "GET" | "POST" | "PUT" | "DELETE" | "PATCH" | "HEAD" | "OPTIONS" | "ALL";

declare module "../application" {
  interface Context {
    params: RouteParams;
    routeName?: string;
  }
}

export interface RouterOptions {
  prefix?: string;
  sensitive?: boolean;
  strict?: boolean;
}

// Trie node types
const NODE_STATIC = 0;
const NODE_PARAM = 1;
const NODE_WILDCARD = 2;

interface TrieNode {
  type: number;
  segment: string; // For static nodes, the path segment
  paramName: string; // For param nodes, the parameter name
  children: Map<string, TrieNode>; // Static children by segment
  paramChild: TrieNode | null; // Single param child (:id)
  wildcardChild: TrieNode | null; // Single wildcard child (*)
  handlers: Map<string, { handler: RouteHandler; name?: string }>; // method -> handler
}

function createNode(
  type: number = NODE_STATIC,
  segment: string = "",
  paramName: string = ""
): TrieNode {
  return {
    type,
    segment,
    paramName,
    children: new Map(),
    paramChild: null,
    wildcardChild: null,
    handlers: new Map(),
  };
}

/**
 * High-performance Trie-based Router
 */
export class Router {
  private root: TrieNode = createNode();
  private prefix: string;
  private sensitive: boolean;
  private strict: boolean;
  private namedRoutes: Map<string, string> = new Map();

  constructor(options: RouterOptions = {}) {
    this.prefix = options.prefix ?? "";
    this.sensitive = options.sensitive ?? false;
    this.strict = options.strict ?? false;
  }

  /**
   * Split path into segments
   */
  private splitPath(path: string): string[] {
    // Remove leading/trailing slashes and split
    let p = path;
    if (p.startsWith("/")) p = p.slice(1);
    if (!this.strict && p.endsWith("/")) p = p.slice(0, -1);
    if (p === "") return [];
    return p.split("/");
  }

  /**
   * Insert a route into the trie
   */
  private insert(method: HttpMethod, path: string, handler: RouteHandler, name?: string): void {
    const fullPath = this.prefix + path;
    const segments = this.splitPath(fullPath);

    let node = this.root;

    for (const segment of segments) {
      if (!this.sensitive) {
        // Case insensitive matching for static segments
      }

      if (segment.startsWith(":")) {
        // Parameter segment
        const paramName = segment.slice(1);
        if (!node.paramChild) {
          node.paramChild = createNode(NODE_PARAM, "", paramName);
        }
        node = node.paramChild;
      } else if (segment === "*") {
        // Wildcard segment
        if (!node.wildcardChild) {
          node.wildcardChild = createNode(NODE_WILDCARD, "*", "");
        }
        node = node.wildcardChild;
        break; // Wildcard matches everything after
      } else {
        // Static segment
        const key = this.sensitive ? segment : segment.toLowerCase();
        let child = node.children.get(key);
        if (!child) {
          child = createNode(NODE_STATIC, segment);
          node.children.set(key, child);
        }
        node = child;
      }
    }

    // Store handler at this node
    node.handlers.set(method, { handler, name });

    // Store named route
    if (name) {
      this.namedRoutes.set(name, fullPath);
    }
  }

  /**
   * Match a path in the trie
   */
  private match(
    method: string,
    path: string
  ): { handler: RouteHandler; params: RouteParams; name?: string } | null {
    const segments = this.splitPath(path);
    const params: RouteParams = {};

    let node = this.root;
    let i = 0;

    while (i < segments.length) {
      const segment = segments[i];
      const key = this.sensitive ? segment : segment.toLowerCase();

      // Try static match first (fastest)
      const child = node.children.get(key);
      if (child) {
        node = child;
        i++;
        continue;
      }

      // Try param match
      if (node.paramChild) {
        params[node.paramChild.paramName] = decodeURIComponent(segment);
        node = node.paramChild;
        i++;
        continue;
      }

      // Try wildcard match
      if (node.wildcardChild) {
        // Wildcard captures the rest of the path
        node = node.wildcardChild;
        break;
      }

      // No match
      return null;
    }

    // Check for handlers at this node
    let handlerInfo = node.handlers.get(method);
    if (!handlerInfo) {
      handlerInfo = node.handlers.get("ALL");
    }

    if (handlerInfo) {
      return {
        handler: handlerInfo.handler,
        params,
        name: handlerInfo.name,
      };
    }

    return null;
  }

  /**
   * Get allowed methods for a path
   */
  private getAllowedMethods(path: string): string[] {
    const segments = this.splitPath(path);
    const methods: string[] = [];

    let node = this.root;
    let i = 0;

    while (i < segments.length) {
      const segment = segments[i];
      const key = this.sensitive ? segment : segment.toLowerCase();

      const child = node.children.get(key);
      if (child) {
        node = child;
        i++;
        continue;
      }

      if (node.paramChild) {
        node = node.paramChild;
        i++;
        continue;
      }

      if (node.wildcardChild) {
        node = node.wildcardChild;
        break;
      }

      return [];
    }

    for (const method of node.handlers.keys()) {
      if (method === "ALL") {
        return ["GET", "POST", "PUT", "DELETE", "PATCH", "HEAD", "OPTIONS"];
      }
      methods.push(method);
    }

    return methods;
  }

  // HTTP method handlers - compact implementation
  get(path: string, handler: RouteHandler): this;
  get(name: string, path: string, handler: RouteHandler): this;
  get(a: string, b: RouteHandler | string, c?: RouteHandler): this {
    return typeof b === "function"
      ? (this.insert("GET", a, b), this)
      : (this.insert("GET", b, c!, a), this);
  }

  post(path: string, handler: RouteHandler): this;
  post(name: string, path: string, handler: RouteHandler): this;
  post(a: string, b: RouteHandler | string, c?: RouteHandler): this {
    return typeof b === "function"
      ? (this.insert("POST", a, b), this)
      : (this.insert("POST", b, c!, a), this);
  }

  put(path: string, handler: RouteHandler): this;
  put(name: string, path: string, handler: RouteHandler): this;
  put(a: string, b: RouteHandler | string, c?: RouteHandler): this {
    return typeof b === "function"
      ? (this.insert("PUT", a, b), this)
      : (this.insert("PUT", b, c!, a), this);
  }

  delete(path: string, handler: RouteHandler): this;
  delete(name: string, path: string, handler: RouteHandler): this;
  delete(a: string, b: RouteHandler | string, c?: RouteHandler): this {
    return typeof b === "function"
      ? (this.insert("DELETE", a, b), this)
      : (this.insert("DELETE", b, c!, a), this);
  }

  patch(path: string, handler: RouteHandler): this;
  patch(name: string, path: string, handler: RouteHandler): this;
  patch(a: string, b: RouteHandler | string, c?: RouteHandler): this {
    return typeof b === "function"
      ? (this.insert("PATCH", a, b), this)
      : (this.insert("PATCH", b, c!, a), this);
  }

  head(path: string, handler: RouteHandler): this;
  head(name: string, path: string, handler: RouteHandler): this;
  head(a: string, b: RouteHandler | string, c?: RouteHandler): this {
    return typeof b === "function"
      ? (this.insert("HEAD", a, b), this)
      : (this.insert("HEAD", b, c!, a), this);
  }

  options(path: string, handler: RouteHandler): this;
  options(name: string, path: string, handler: RouteHandler): this;
  options(a: string, b: RouteHandler | string, c?: RouteHandler): this {
    return typeof b === "function"
      ? (this.insert("OPTIONS", a, b), this)
      : (this.insert("OPTIONS", b, c!, a), this);
  }

  all(path: string, handler: RouteHandler): this;
  all(name: string, path: string, handler: RouteHandler): this;
  all(a: string, b: RouteHandler | string, c?: RouteHandler): this {
    return typeof b === "function"
      ? (this.insert("ALL", a, b), this)
      : (this.insert("ALL", b, c!, a), this);
  }

  use(middleware: RouteHandler): this;
  use(path: string, middleware: RouteHandler): this;
  use(a: string | RouteHandler, b?: RouteHandler): this {
    return typeof a === "function"
      ? (this.insert("ALL", "/*", a), this)
      : (this.insert("ALL", a + "/*", b!), this);
  }

  group(prefix: string, setup: (router: Router) => void): this {
    const subRouter = new Router({
      prefix: this.prefix + prefix,
      sensitive: this.sensitive,
      strict: this.strict,
    });
    setup(subRouter);
    // Merge sub-router's trie into ours
    this.mergeNode(this.root, subRouter.root);
    for (const [name, path] of subRouter.namedRoutes) {
      this.namedRoutes.set(name, path);
    }
    return this;
  }

  private mergeNode(target: TrieNode, source: TrieNode): void {
    // Merge handlers
    for (const [method, handlerInfo] of source.handlers) {
      target.handlers.set(method, handlerInfo);
    }
    // Merge static children
    for (const [key, child] of source.children) {
      const targetChild = target.children.get(key);
      if (!targetChild) {
        target.children.set(key, child);
      } else {
        this.mergeNode(targetChild, child);
      }
    }
    // Merge param child
    if (source.paramChild) {
      if (!target.paramChild) {
        target.paramChild = source.paramChild;
      } else {
        this.mergeNode(target.paramChild, source.paramChild);
      }
    }
    // Merge wildcard child
    if (source.wildcardChild) {
      if (!target.wildcardChild) {
        target.wildcardChild = source.wildcardChild;
      } else {
        this.mergeNode(target.wildcardChild, source.wildcardChild);
      }
    }
  }

  url(name: string, params?: RouteParams): string {
    const path = this.namedRoutes.get(name);
    if (!path) throw new Error(`Route "${name}" not found`);

    if (!params) return path;

    let url = path;
    for (const [key, value] of Object.entries(params)) {
      url = url.replace(`:${key}`, encodeURIComponent(value));
    }
    return url;
  }

  /**
   * Returns middleware for processing routes
   */
  routes(): Middleware {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const router = this;

    return async (ctx: Context, next: Next): Promise<void> => {
      const result = router.match(ctx.method, ctx.path);

      if (result) {
        ctx.params = result.params;
        if (result.name) {
          ctx.routeName = result.name;
        }
        ctx.status = 200;
        await result.handler(ctx, next);
      } else {
        await next();
      }
    };
  }

  /**
   * Returns middleware for handling 405 Method Not Allowed
   */
  allowedMethods(): Middleware {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const router = this;

    return async (ctx: Context, next: Next): Promise<void> => {
      await next();

      if (ctx.responseBody === null && ctx.status === 404) {
        const methods = router.getAllowedMethods(ctx.path);

        if (methods.length > 0) {
          ctx.status = 405;
          ctx.set("Allow", methods.join(", "));
          ctx.responseBody = {
            error: "Method Not Allowed",
            allowedMethods: methods,
          };
        }
      }
    };
  }
}

export default Router;
