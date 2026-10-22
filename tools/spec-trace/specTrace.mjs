/**
 * specTrace — builds the requirement → code → test traceability matrix.
 *
 * Why: evaluators must be able to pick any requirement in docs/specs and find the code that
 *      implements it and the tests that prove it, and CI must fail when specs and code drift apart.
 * Spec: DOC-004
 * Invariants:
 *   - Output is deterministic (sorted, no timestamps): regenerating an unchanged tree gives no diff.
 *   - Uses only Node built-ins, so it runs before `npm install`.
 * Collaborators: reads docs/specs/*.md, docs/DOCUMENTATION-STANDARD.md, all other Markdown files and
 *   source files under apps/, packages/, tools/, content/. Writes docs/TRACEABILITY.md.
 * Tests: tools/spec-trace/test/specTrace.test.mjs
 * Usage: see tools/spec-trace/README.md (`--check`, `--done-through=S1`, `SPEC_TRACE_ROOT=<dir>`).
 */
import { readFileSync, writeFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, relative, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { leadingIds, testTitles } from './testTitles.mjs';

const ROOT = process.env.SPEC_TRACE_ROOT
  ? resolve(process.env.SPEC_TRACE_ROOT)
  : fileURLToPath(new URL('../../', import.meta.url));
const OUTPUT = 'docs/TRACEABILITY.md';
const REQUIREMENT_SOURCES = ['docs/specs', 'docs/DOCUMENTATION-STANDARD.md'];
const CODE_DIRS = ['apps', 'packages', 'tools', 'content'];
const CODE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.mjs', '.cjs', '.css', '.yaml', '.yml', '.sh']);
const SKIP_DIRS = new Set([
  'node_modules',
  '.git',
  '.next',
  'dist',
  'build',
  'coverage',
  'vendor',
  'generated',
]);
// WHY: apps/server/h5p holds H5P's own fetched core and editor files (D-027); they are not ours to trace.
const SKIP_PATHS = new Set([join('apps', 'server', 'h5p')]);

// A requirement heading looks like: "#### SEC-001 · MUST · S2 · Sanitise SVG files"
const HEADING = /^#### ([A-Z][A-Z0-9]*-\d{3}) · (MUST|SHOULD|COULD) · (S\d) · (.+)$/;
const TEST_FILE = /(\.(test|spec)\.[cm]?[jt]sx?$)|([\\/]e2e[\\/])/;

/** Recursively lists files under `dir` (relative to ROOT), skipping build output. */
function listFiles(dir) {
  const abs = join(ROOT, dir);
  if (!existsSync(abs)) return [];
  if (statSync(abs).isFile()) return [dir];
  return readdirSync(abs, { withFileTypes: true })
    .flatMap((entry) => {
      const child = join(dir, entry.name);
      if (SKIP_DIRS.has(entry.name) || SKIP_PATHS.has(child)) return [];
      return entry.isDirectory() ? listFiles(child) : [child];
    })
    .sort();
}

/** Parses every requirement heading into { id, priority, session, title, file }. */
function readRequirements() {
  const requirements = [];
  for (const file of REQUIREMENT_SOURCES.flatMap(listFiles).filter((f) => f.endsWith('.md'))) {
    for (const line of readFileSync(join(ROOT, file), 'utf8').split('\n')) {
      const match = HEADING.exec(line.trim());
      if (match) {
        const [, id, priority, session, title] = match;
        requirements.push({ id, priority, session, title, file });
      }
    }
  }
  return requirements;
}

/** Returns a regex matching any ID whose prefix is used by a defined requirement. */
function idPattern(requirements) {
  const prefixes = [...new Set(requirements.map((r) => r.id.split('-')[0]))].sort();
  // WHY: matching only known prefixes avoids false hits such as "SHA-256" or "CVE-2025".
  return new RegExp(`\\b(?:${prefixes.join('|')})-\\d{3}\\b`, 'g');
}

/** Collects which files reference which IDs, split into code and test references. */
function scanSources(pattern) {
  const code = new Map();
  const tests = new Map();
  const add = (map, id, file) => map.set(id, [...new Set([...(map.get(id) ?? []), file])].sort());
  for (const file of CODE_DIRS.flatMap(listFiles)) {
    if (!CODE_EXTENSIONS.has(extname(file))) continue;
    const text = readFileSync(join(ROOT, file), 'utf8');
    if (TEST_FILE.test(file)) {
      // Tests count only when the ID opens the title of an it()/test() call that runs: it('[SEC-001] …').
      // WHY: an ID in a comment, a fixture string or a describe() title alone proves nothing; skipped tests neither (D-033).
      for (const t of testTitles(text).filter((c) => c.active && c.fn !== 'describe')) {
        for (const id of leadingIds(t.title)) add(tests, id, file);
      }
    } else {
      // Code counts only through "Spec:" header lines or "@spec" TSDoc tags.
      for (const line of text.split('\n').filter((l) => /Spec:|@spec\b/.test(l))) {
        for (const m of line.matchAll(pattern)) add(code, m[0], file);
      }
    }
  }
  return { code, tests };
}

/** Finds references (in Markdown and code) to IDs that no spec defines. */
function findDanglingReferences(requirements, pattern) {
  const known = new Set(requirements.map((r) => r.id));
  const files = [
    ...listFiles('docs').filter((f) => f.endsWith('.md')),
    ...readdirSync(ROOT).filter((f) => f.endsWith('.md')),
    ...CODE_DIRS.flatMap(listFiles).filter((f) => CODE_EXTENSIONS.has(extname(f))),
  ];
  const problems = [];
  for (const file of [...new Set(files)].filter((f) => f !== OUTPUT)) {
    const lines = readFileSync(join(ROOT, file), 'utf8').split('\n');
    lines.forEach((line, i) => {
      for (const m of line.matchAll(pattern)) {
        if (!known.has(m[0])) problems.push(`${file}:${i + 1} references unknown requirement ${m[0]}`);
      }
    });
  }
  return problems;
}

/** Renders the Markdown matrix. */
function render(requirements, { code, tests }) {
  const status = (r) => (tests.has(r.id) ? 'tested' : code.has(r.id) ? 'in code' : 'planned');
  const count = (pred) => requirements.filter(pred).length;
  const out = [
    '# Traceability Matrix',
    '',
    '> Generated by `tools/spec-trace/specTrace.mjs`. Do not edit by hand. Regenerate with',
    '> `node tools/spec-trace/specTrace.mjs` (or `npm run spec:trace` once Session 1 has added `package.json`).',
    '',
    'Status meanings: **planned**, no code references it yet; **in code**, referenced by a `Spec:`',
    'header or `@spec` tag; **tested**, at least one test title carries the ID in brackets.',
    '',
    '| | MUST | SHOULD | COULD | Total |',
    '|---|---|---|---|---|',
  ];
  for (const s of ['planned', 'in code', 'tested']) {
    const n = (p) => count((r) => r.priority === p && status(r) === s);
    out.push(`| ${s} | ${n('MUST')} | ${n('SHOULD')} | ${n('COULD')} | ${count((r) => status(r) === s)} |`);
  }
  for (const file of [...new Set(requirements.map((r) => r.file))]) {
    out.push(
      '',
      `## [${file}](${relative('docs', file)})`,
      '',
      '| ID | Priority | Session | Requirement | Code | Tests | Status |',
      '|---|---|---|---|---|---|---|',
    );
    for (const r of requirements.filter((x) => x.file === file)) {
      const list = (m) => (m.get(r.id) ?? []).map((f) => `\`${f}\``).join('<br>') || '—';
      out.push(
        `| ${r.id} | ${r.priority} | ${r.session} | ${r.title.replace(/\|/g, '\\|')} | ${list(code)} | ${list(tests)} | ${status(r)} |`,
      );
    }
  }
  return `${out.join('\n')}\n`;
}

function main() {
  const args = process.argv.slice(2);
  const check = args.includes('--check');
  const doneThrough = Number((args.find((a) => a.startsWith('--done-through=')) ?? '=S0').split('=S')[1]);
  const requirements = readRequirements();
  const pattern = idPattern(requirements);
  const refs = scanSources(pattern);
  const markdown = render(requirements, refs);
  const problems = [];

  const seen = new Set();
  for (const r of requirements) {
    if (seen.has(r.id)) problems.push(`duplicate requirement ID ${r.id} in ${r.file}`);
    seen.add(r.id);
  }
  problems.push(...findDanglingReferences(requirements, pattern));
  for (const r of requirements) {
    if (r.priority === 'MUST' && Number(r.session.slice(1)) <= doneThrough && !refs.tests.has(r.id)) {
      problems.push(`${r.id} (MUST, ${r.session}) has no test whose title contains [${r.id}]`);
    }
  }

  if (check) {
    const current = existsSync(join(ROOT, OUTPUT)) ? readFileSync(join(ROOT, OUTPUT), 'utf8') : '';
    if (current !== markdown)
      problems.push(`${OUTPUT} is out of date; run node tools/spec-trace/specTrace.mjs`);
  } else {
    writeFileSync(join(ROOT, OUTPUT), markdown);
    console.log(`Wrote ${OUTPUT} (${requirements.length} requirements).`);
  }
  for (const p of problems) console.error(`✗ ${p}`);
  if (check && problems.length > 0) process.exit(1);
  if (check) console.log(`✓ ${requirements.length} requirements, traceability up to date.`);
}

main();
