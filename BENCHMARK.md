# EngineX Benchmarks

Performance comparison between EngineX and Koa running on Bun.

## Test Environment

- **Runtime**: Bun 1.3.5
- **OS**: Linux (WSL2)
- **CPU**: Variable (benchmark on your hardware for accurate results)
- **Tool**: [autocannon](https://github.com/mcollina/autocannon)

## Benchmark Configuration

```
Duration:    5 seconds per test
Connections: 50 concurrent
Pipelining:  5 requests per connection
```

## Results

### Summary Table

| Endpoint     | EngineX (req/s) | Koa (req/s) | Difference |
| ------------ | --------------- | ----------- | ---------- |
| `/json`      | **47,000**      | 45,000      | **+4.4%**  |
| `/text`      | 46,700          | 44,000      | **+6.1%**  |
| `/users/:id` | **42,600**      | 30,000      | **+42%**   |
| **Average**  | **45,400**      | **39,700**  | **+14%**   |

> 🚀 **EngineX outperforms Koa!** The Trie-based router provides massive gains on parameterized routes.

### Why EngineX is Faster

| Optimization        | Impact                               |
| ------------------- | ------------------------------------ |
| Trie Router         | O(m) path matching vs regex scanning |
| Inline URL Parsing  | No regex for query string parsing    |
| Minimal Allocations | Fewer objects created per request    |
| Shared Method Refs  | Context methods defined once         |

## Running Benchmarks

### Prerequisites

```bash
bun install
```

### Run All Benchmarks

```bash
bun run bench
```

### Run Individual Servers

```bash
# Terminal 1: EngineX
bun run bench:enginex

# Terminal 2: Koa
bun run bench:koa

# Terminal 3: Run autocannon
npx autocannon -c 50 -d 5 -p 5 http://localhost:3001/json
npx autocannon -c 50 -d 5 -p 5 http://localhost:3002/json
```

### Benchmark Files

| File                           | Port | Description       |
| ------------------------------ | ---- | ----------------- |
| `benchmarks/enginex-server.ts` | 3001 | EngineX server    |
| `benchmarks/koa-server.ts`     | 3002 | Koa + @koa/router |

## Contributing

Found a performance improvement? We'd love to see it!

1. Run benchmarks before your change
2. Make your optimization
3. Run benchmarks after
4. Include before/after results in your PR

---

_Benchmarks last updated: January 2025_
_Hardware and runtime versions affect results - run on your own system for accurate comparisons_
