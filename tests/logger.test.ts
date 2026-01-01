/**
 * Tests for logger middleware
 */
import { describe, test, expect, afterEach } from "bun:test";
import { Application, logger } from "../src";

describe("logger middleware", () => {
  let app: Application;
  let basePort = 19300;

  function getPort(): number {
    return basePort++;
  }

  afterEach(async () => {
    if (app) {
      await app.close();
    }
  });

  test("should log requests", async () => {
    const logs: string[] = [];
    app = new Application();
    app.use(
      logger({
        logger: (msg) => logs.push(msg),
        colors: false,
        timestamp: false,
      })
    );
    app.use(async (ctx) => {
      ctx.status = 200;
      ctx.responseBody = "OK";
    });

    const port = getPort();
    app.listen(port);
    await new Promise((resolve) => setTimeout(resolve, 100));

    await fetch(`http://localhost:${port}/test`);
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(logs.length).toBe(2);
    expect(logs[0]).toContain("--> GET");
    expect(logs[0]).toContain("/test");
    expect(logs[1]).toContain("<-- GET");
    expect(logs[1]).toContain("/test");
    expect(logs[1]).toContain("200");
  });

  test("should skip logging when skip returns true", async () => {
    const logs: string[] = [];
    app = new Application();
    app.use(
      logger({
        logger: (msg) => logs.push(msg),
        skip: (ctx) => ctx.path === "/health",
      })
    );
    app.use(async (ctx) => {
      ctx.status = 200;
      ctx.responseBody = "OK";
    });

    const port = getPort();
    app.listen(port);
    await new Promise((resolve) => setTimeout(resolve, 100));

    await fetch(`http://localhost:${port}/health`);
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(logs.length).toBe(0);

    await fetch(`http://localhost:${port}/other`);
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(logs.length).toBe(2);
  });

  test("should use custom format function", async () => {
    const logs: string[] = [];
    app = new Application();
    app.use(
      logger({
        logger: (msg) => logs.push(msg),
        timestamp: false,
        format: (ctx, time) => `CUSTOM: ${ctx.method} ${ctx.path} - ${Math.round(time)}ms`,
      })
    );
    app.use(async (ctx) => {
      ctx.status = 200;
      ctx.responseBody = "OK";
    });

    const port = getPort();
    app.listen(port);
    await new Promise((resolve) => setTimeout(resolve, 100));

    await fetch(`http://localhost:${port}/api`);
    await new Promise((resolve) => setTimeout(resolve, 50));

    // Second log uses custom format
    expect(logs[1]).toMatch(/^CUSTOM: GET \/api - \d+ms$/);
  });

  test("should include timestamp when enabled", async () => {
    const logs: string[] = [];
    app = new Application();
    app.use(
      logger({
        logger: (msg) => logs.push(msg),
        timestamp: true,
        colors: false,
      })
    );
    app.use(async (ctx) => {
      ctx.status = 200;
      ctx.responseBody = "OK";
    });

    const port = getPort();
    app.listen(port);
    await new Promise((resolve) => setTimeout(resolve, 100));

    await fetch(`http://localhost:${port}/`);
    await new Promise((resolve) => setTimeout(resolve, 50));

    // Check for ISO timestamp pattern
    expect(logs[1]).toMatch(/\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\]/);
  });

  test("should log even if middleware throws", async () => {
    const logs: string[] = [];
    app = new Application();
    app.use(
      logger({
        logger: (msg) => logs.push(msg),
        colors: false,
        timestamp: false,
      })
    );
    app.use(async (_ctx) => {
      throw new Error("Test error");
    });

    const port = getPort();
    app.listen(port);
    await new Promise((resolve) => setTimeout(resolve, 100));

    await fetch(`http://localhost:${port}/error`);
    await new Promise((resolve) => setTimeout(resolve, 50));

    // Should still log both request and response
    expect(logs.length).toBe(2);
    expect(logs[0]).toContain("--> GET");
    expect(logs[0]).toContain("/error");
    expect(logs[1]).toContain("<-- GET");
    expect(logs[1]).toContain("/error");
  });

  test("should format time correctly", async () => {
    const logs: string[] = [];
    app = new Application();
    app.use(
      logger({
        logger: (msg) => logs.push(msg),
        colors: false,
        timestamp: false,
      })
    );
    app.use(async (ctx) => {
      // Simulate some processing time
      await new Promise((resolve) => setTimeout(resolve, 10));
      ctx.status = 200;
      ctx.responseBody = "OK";
    });

    const port = getPort();
    app.listen(port);
    await new Promise((resolve) => setTimeout(resolve, 100));

    await fetch(`http://localhost:${port}/slow`);
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Time should be in ms format
    expect(logs[1]).toMatch(/\d+ms/);
  });
});
