# tools/load

## Purpose

The load test of `NFR-001` (D-114 and its amendments): "an activity page becomes interactive in ≤ 3 s at p95 with
200 concurrent learners on one application node; API p95 ≤ 300 ms excluding file downloads". The runner starts the
server as one node with a mock Canvas, the ten real content types and QuestionSet's example published, in a
PostgreSQL database of its own (`apps/server/test/load/loadBench.ts`), and runs k6 2.3.0 in its image pinned by
digest against it. A virtual user is one learner in one Canvas course; one iteration is one visit:

1. the LTI launch as a browser makes it (the mock's login form, `POST /lti/login`, the mock's authorization answer,
   `POST /lti/launch` and ltijs's second post with the recovered state);
2. the player page `/lti/play?ltik=…` with every script and stylesheet it names, as with an empty cache;
3. the root `attempted` batch, then each answer after a think time (one xAPI batch with the question's `answered` and
   one learner-state save), and the root `completed` with the total.

| Measured | Threshold |
|---|---|
| `hvli_player_ready`: from the tool's `/lti/login` to the last script or stylesheet, less the mock Canvas's answer | p95 < 3 000 ms |
| `http_req_duration{kind:api}`: the xAPI batches and state saves | p95 < 300 ms |
| `http_req_failed` | < 1 % |
| `checks` | > 99 % |

Not measured: the browser's own work and Fast 4G's latency and bandwidth (k6 runs no browser); the bytes per visit
are reported so they can be held against Fast 4G's throughput. No URL is a metric tag and every request has a fixed
name, so an ltik never reaches a metric or the summary, and the runner removes token-like values from k6's output.

## How to run

Needs Docker (the image comes through the daemon, so a registry mirror serves it), the services of
`docker compose up -d` with `apps/server/.env`, and the real content types (`npm run h5p:fetch-libraries`).

```bash
npm run load:smoke                       # 20 learners for 30 s, think 2–4 s, 4 answers per visit
npm run load:full -- --out /srv/load     # 200 learners: 60 s up, 10 min, 30 s down; think 5–15 s, 6 answers
npx vitest run tools/load                # the [NFR-001] tests: profiles, container, readers, batches, the bench
```

The output folder (default under the system's temporary folder, 0700) holds `learners.json` (the bench's launch
addresses: no token, no `sub`), `summary.json` and `summary.txt` (k6's data and our summary) and `rows.json` (the rows
the load stored). Exit code 0: every threshold passed; 99: one failed; 1: another failure; 2: bad arguments. The full
run is HVL's, on hardware like a production node ([docs/ops/runbook.md](../../docs/ops/runbook.md), section 8).

## Folder structure

| File | Responsibility |
|---|---|
| `runLoad.mjs` | The command: the bench, k6 in its container, the bench's stop, the output folder |
| `benchProcess.mjs` | Starts the bench, waits for its ready line, stops it and reads its row counts |
| `k6Container.mjs` | The pinned image, its `docker run` arguments, the redaction of k6's output |
| `k6/visit.js` | k6's entry script: one visit per iteration, the metrics, `handleSummary` |
| `k6/launchSteps.js` | The launch and the player page with its assets, under k6 |
| `k6/playerPages.js` | Pure readers: forms, embedded JSON, a page's assets, the player's context |
| `k6/xapiBatches.js` | Pure builders: the bridge's batches and H5P's state saves |
| `k6/loadProfiles.js` | The profiles and thresholds, from `NFR-001`'s numbers |
| `k6/loadSummary.js` | The text summary from k6's end-of-test data |
| `test/` | `[NFR-001]` tests, among them one visit in Node against the real bench (`nodeVisit.mjs`) |
