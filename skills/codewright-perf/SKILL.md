---
name: codewright:perf
description: "Performance testing with k6 — setup, run, analyze"
phase: operations
---

# Codewright Performance Testing

## Activation
When the user says: "codewright perf", "performance test", "load test", "k6", "teste de carga", "teste de performance", "artillery", "benchmark"

## Operation
<workflow>
  <step n="1" goal="Setup performance test">
    <action>Run: `npx codewright perf setup [k6|artillery]`</action>
    <action>**k6** (default): generates `perf-tests/load-test.js` with:
      - Ramp up: 30s → 10 virtual users
      - Steady: 1min at 10 virtual users
      - Ramp down: 30s → 0 users
      - Thresholds: p(95) response time &lt; 500ms, error rate &lt; 1%
      - URL defaults to http://localhost:3000 (auto-detected from package.json)
    </action>
    <action>**Artillery**: generates `perf-tests/artillery.yml` with:
      - Warm up: 60s, 5→20 requests/s
      - Sustained load: 120s at 20 requests/s
    </action>
  </step>
  <step n="2" goal="Customize the test scenario (optional)">
    <action>Edit `perf-tests/load-test.js` to adjust:
      - `BASE_URL` — set via `-e BASE_URL=&lt;url&gt;` at runtime or edit the default
      - `stages` — ramp up duration, target users, steady state, ramp down
      - `thresholds` — response time SLAs, max error rate
      - `http.get()` — change endpoint, add headers, add request body
      - `check()` — add custom assertions per request
    </action>
    <action>For Artillery, edit `perf-tests/artillery.yml`:
      - `target` — base URL
      - `phases` — arrival rate, duration
      - `scenarios` — endpoints, HTTP methods, payloads
    </action>
  </step>
  <step n="3" goal="Run the performance test">
    <action>Run: `npx codewright perf run [k6|artillery]`</action>
    <action>Or directly with k6: `k6 run perf-tests/load-test.js -e BASE_URL=http://localhost:3000`</action>
    <action>Prerequisites:
      - k6: `brew install k6` or `npm install -g k6`
      - Artillery: `npm install -g artillery`
    </action>
    <action>k6 generates real-time metrics in the terminal as the test runs</action>
  </step>
  <step n="4" goal="Analyze results">
    <action>Check key k6 metrics from the output:
      - `http_req_duration` — avg, p90, p95, p99 (latency distribution)
      - `http_req_failed` — error rate (percentage of failed requests)
      - `http_reqs` — throughput in requests/second
      - `vus` — virtual user count at each stage
      - `iterations` — total test iterations completed
    </action>
    <action>Compare against script thresholds:
      - `p(95)&lt;500ms` — if exceeded, suggest caching, query optimization, or pagination
      - `http_req_failed&lt;1%` — if exceeded, check endpoint stability and error responses
    </action>
    <action>Report a clear summary:
      - Thresholds passed/failed
      - Key metrics: p95, req/s, error rate
      - Optimization recommendations if thresholds were breached
    </action>
  </step>
</workflow>

## Finalization
Performance test executed. Report the results: thresholds passed/failed, key metrics (p95, req/s, error rate), and actionable optimization suggestions if any thresholds were exceeded. The script is saved at `perf-tests/load-test.js` for re-runs and iteration.
