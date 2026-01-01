#!/usr/bin/env bun
/**
 * Benchmark runner - compares EngineX vs Koa
 *
 * Usage: bun benchmarks/run.ts
 */

import { spawn } from "bun";

interface BenchResult {
  requestsPerSec: number;
  latencyAvg: number;
  latencyP99: number;
  throughput: number;
}

const DURATION = 10;
const CONNECTIONS = 100;
const PIPELINING = 10;

const ENDPOINTS = [
  { path: "/json", method: "GET", description: "JSON response" },
  { path: "/text", method: "GET", description: "Plain text" },
  { path: "/users/123", method: "GET", description: "Path parameters" },
  { path: "/middleware", method: "GET", description: "Multiple middleware" },
];

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForServer(port: number, maxAttempts = 50): Promise<boolean> {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const res = await fetch(`http://localhost:${port}/json`, {
        signal: AbortSignal.timeout(500),
      });
      if (res.ok) return true;
    } catch {
      await sleep(200);
    }
  }
  return false;
}

async function runAutocannon(url: string): Promise<BenchResult> {
  const proc = spawn(
    [
      "npx",
      "autocannon",
      "-c",
      String(CONNECTIONS),
      "-d",
      String(DURATION),
      "-p",
      String(PIPELINING),
      "-j",
      url,
    ],
    {
      stdout: "pipe",
      stderr: "pipe",
    }
  );

  const output = await new Response(proc.stdout).text();
  await proc.exited;

  try {
    const result = JSON.parse(output);
    return {
      requestsPerSec: result.requests?.average || 0,
      latencyAvg: result.latency?.average || 0,
      latencyP99: result.latency?.p99 || 0,
      throughput: result.throughput?.average || 0,
    };
  } catch {
    console.error("Parse error. Raw output:", output.slice(0, 500));
    return { requestsPerSec: 0, latencyAvg: 0, latencyP99: 0, throughput: 0 };
  }
}

function formatNumber(n: number): string {
  return n.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

async function main() {
  console.log(`
╔══════════════════════════════════════════════════════════════════╗
║              EngineX vs Koa Benchmark                            ║
╠══════════════════════════════════════════════════════════════════╣
║  Duration: ${DURATION}s | Connections: ${CONNECTIONS} | Pipelining: ${PIPELINING}               ║
╚══════════════════════════════════════════════════════════════════╝
`);

  // Start EngineX server
  console.log("Starting EngineX server...");
  const enginexProc = spawn(["bun", "run", "benchmarks/enginex-server.ts"], {
    env: { ...process.env, PORT: "3001" },
    stdout: "inherit",
    stderr: "inherit",
  });

  // Start Koa server
  console.log("Starting Koa server...");
  const koaProc = spawn(["bun", "run", "benchmarks/koa-server.ts"], {
    env: { ...process.env, PORT: "3002" },
    stdout: "inherit",
    stderr: "inherit",
  });

  await sleep(1000);

  const enginexReady = await waitForServer(3001);
  const koaReady = await waitForServer(3002);

  if (!enginexReady) {
    console.error("❌ EngineX server failed to start");
    enginexProc.kill();
    koaProc.kill();
    process.exit(1);
  }

  if (!koaReady) {
    console.error("❌ Koa server failed to start");
    enginexProc.kill();
    koaProc.kill();
    process.exit(1);
  }

  console.log("✓ Both servers ready\n");

  const results: Array<{
    endpoint: string;
    description: string;
    enginex: BenchResult;
    koa: BenchResult;
  }> = [];

  for (const ep of ENDPOINTS) {
    console.log(`\n━━━ ${ep.description} (${ep.method} ${ep.path}) ━━━`);

    console.log("  Benchmarking EngineX...");
    const enginexResult = await runAutocannon(`http://localhost:3001${ep.path}`);

    console.log("  Benchmarking Koa...");
    const koaResult = await runAutocannon(`http://localhost:3002${ep.path}`);

    results.push({
      endpoint: ep.path,
      description: ep.description,
      enginex: enginexResult,
      koa: koaResult,
    });

    const speedup =
      koaResult.requestsPerSec > 0
        ? ((enginexResult.requestsPerSec / koaResult.requestsPerSec - 1) * 100).toFixed(1)
        : "N/A";

    console.log(`
  ┌─────────────────────────────────────────────────────┐
  │ EngineX: ${formatNumber(enginexResult.requestsPerSec).padStart(10)} req/s │ latency: ${enginexResult.latencyAvg.toFixed(2)}ms avg, ${enginexResult.latencyP99.toFixed(2)}ms p99
  │ Koa:     ${formatNumber(koaResult.requestsPerSec).padStart(10)} req/s │ latency: ${koaResult.latencyAvg.toFixed(2)}ms avg, ${koaResult.latencyP99.toFixed(2)}ms p99
  │ Speedup: ${speedup}%
  └─────────────────────────────────────────────────────┘`);
  }

  // Summary
  console.log(`

╔═══════════════════════════════════════════════════════════════════════════════╗
║                           BENCHMARK SUMMARY                                   ║
╠═════════════════════╦═════════════════╦═════════════════╦═════════════════════╣
║ Endpoint            ║ EngineX (req/s) ║ Koa (req/s)     ║ Difference          ║
╠═════════════════════╬═════════════════╬═════════════════╬═════════════════════╣`);

  let totalEngineX = 0;
  let totalKoa = 0;

  for (const r of results) {
    const diff =
      r.koa.requestsPerSec > 0 ? (r.enginex.requestsPerSec / r.koa.requestsPerSec - 1) * 100 : 0;
    const diffStr = diff >= 0 ? `+${diff.toFixed(1)}%` : `${diff.toFixed(1)}%`;

    console.log(
      `║ ${r.endpoint.padEnd(19)} ║ ${formatNumber(r.enginex.requestsPerSec).padStart(15)} ║ ${formatNumber(r.koa.requestsPerSec).padStart(15)} ║ ${diffStr.padStart(19)} ║`
    );

    totalEngineX += r.enginex.requestsPerSec;
    totalKoa += r.koa.requestsPerSec;
  }

  const avgEngineX = totalEngineX / results.length;
  const avgKoa = totalKoa / results.length;
  const avgDiff = avgKoa > 0 ? (avgEngineX / avgKoa - 1) * 100 : 0;
  const avgDiffStr = avgDiff >= 0 ? `+${avgDiff.toFixed(1)}%` : `${avgDiff.toFixed(1)}%`;

  console.log(`╠═════════════════════╬═════════════════╬═════════════════╬═════════════════════╣`);
  console.log(
    `║ AVERAGE             ║ ${formatNumber(avgEngineX).padStart(15)} ║ ${formatNumber(avgKoa).padStart(15)} ║ ${avgDiffStr.padStart(19)} ║`
  );
  console.log(`╚═════════════════════╩═════════════════╩═════════════════╩═════════════════════╝`);

  if (avgDiff > 0) {
    console.log(`\n🚀 EngineX is ${avgDiff.toFixed(1)}% faster than Koa on average!`);
  } else if (avgDiff < 0) {
    console.log(`\n📊 Koa is ${Math.abs(avgDiff).toFixed(1)}% faster than EngineX on average`);
  } else {
    console.log(`\n📊 EngineX and Koa perform similarly`);
  }

  // Cleanup
  enginexProc.kill();
  koaProc.kill();

  console.log("\n✓ Benchmark complete\n");
}

main().catch((err) => {
  console.error("Benchmark error:", err);
  process.exit(1);
});
