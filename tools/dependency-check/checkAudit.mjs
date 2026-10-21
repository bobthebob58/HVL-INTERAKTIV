/**
 * checkAudit — runs `npm audit` for production dependencies and fails on any unreviewed high or critical advisory.
 *
 * Why: SEC-007 lets the team accept a known advisory only after a person has reviewed it, written the
 *      decision down and set an expiry date. Plain `npm audit` cannot express such an exception.
 * Spec: SEC-007
 * Invariants:
 *   - Every high or critical advisory must match an entry in audit-exceptions.json by its GHSA ID.
 *   - An entry must name an existing decision (`### D-xxx` in docs/DECISIONS.md) and must not be expired.
 *   - An entry that no longer matches any advisory fails too, so the list never goes stale.
 * Collaborators: npm (audit), ./audit-exceptions.json, docs/DECISIONS.md, CI (`npm run check:audit`).
 * Tests: tools/dependency-check/test/checkAudit.test.mjs
 */
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const BLOCKING = new Set(['high', 'critical']);

/**
 * Extracts the blocking advisories from an `npm audit --json` report.
 * @param {{vulnerabilities?: Record<string, {via: (string|object)[]}>}} report - Parsed audit report.
 * @returns {{id: string, pkg: string, title: string}[]} Unique advisories, sorted by ID.
 */
export function blockingAdvisories(report) {
  const found = new Map();
  for (const entry of Object.values(report.vulnerabilities ?? {})) {
    for (const via of entry.via.filter((v) => typeof v === 'object' && BLOCKING.has(v.severity))) {
      const id = /GHSA-[\w-]+/.exec(via.url ?? '')?.[0] ?? `npm-${via.source}`;
      found.set(id, { id, pkg: via.name, title: via.title });
    }
  }
  return [...found.values()].sort((a, b) => a.id.localeCompare(b.id));
}

/**
 * Compares advisories with the reviewed exceptions.
 * @param {{id: string, pkg: string, title: string}[]} advisories - From `blockingAdvisories`.
 * @param {{advisory: string, package: string, decision: string, expires: string}[]} exceptions - Reviewed list.
 * @param {Set<string>} decisions - Decision IDs that exist in DECISIONS.md.
 * @param {string} today - ISO date (YYYY-MM-DD).
 * @returns {string[]} Problems; empty when every advisory is covered by a valid exception.
 */
export function evaluateAudit(advisories, exceptions, decisions, today) {
  const problems = [];
  for (const a of advisories) {
    const ex = exceptions.find((e) => e.advisory === a.id);
    if (!ex) problems.push(`${a.id} (${a.pkg}): unreviewed — ${a.title}`);
    else if (ex.expires < today)
      problems.push(`${a.id} (${a.pkg}): exception expired on ${ex.expires}; review it again`);
    else if (!decisions.has(ex.decision))
      problems.push(`${a.id} (${a.pkg}): exception names unknown decision ${ex.decision}`);
  }
  for (const e of exceptions.filter((x) => !advisories.some((a) => a.id === x.advisory))) {
    problems.push(`${e.advisory} (${e.package}): no longer reported; remove the exception`);
  }
  return problems;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const root = fileURLToPath(new URL('../../', import.meta.url));
  // WHY: npm audit exits 1 whenever it finds anything, so the exit code is ignored and the JSON decides.
  const run = spawnSync('npm', ['audit', '--omit=dev', '--json'], {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 1 << 26,
  });
  const advisories = blockingAdvisories(JSON.parse(run.stdout));
  const exceptions = JSON.parse(readFileSync(new URL('./audit-exceptions.json', import.meta.url), 'utf8'));
  const decisionText = readFileSync(join(root, 'docs/DECISIONS.md'), 'utf8');
  const decisions = new Set([...decisionText.matchAll(/^### (D-\d{3})\b/gm)].map((m) => m[1]));
  const problems = evaluateAudit(advisories, exceptions, decisions, new Date().toISOString().slice(0, 10));
  for (const p of problems) console.error(`✗ ${p}`);
  if (problems.length > 0) process.exit(1);
  console.log(
    `✓ check:audit: ${advisories.length} high/critical advisories, all covered by reviewed exceptions.`,
  );
}
