/**
 * checkLicences — fails when a production dependency has a licence that is not GPL-3.0-compatible.
 *
 * Why: the project is GPL-3.0-or-later because h5p-server is (NFR-005). Shipping a dependency under an
 *      incompatible or unknown licence would make the whole service undistributable.
 * Spec: NFR-005
 * Invariants:
 *   - Every package a production install contains counts: npm's `dev` flag is false (`npm query '*'`), even when a
 *     dev tool uses it too (D-071). Our own workspaces are skipped.
 *   - A separate program's own dependencies are skipped only when SEPARATE_PROGRAMS names them with a reason.
 *   - SPDX `OR` passes if any branch is allowed; `AND` passes only if every part is allowed; AND binds
 *     tighter than OR and parentheses group, as in the SPDX specification. Malformed expressions fail.
 *   - A package without usable metadata fails unless REVIEWED lists it with the licence a person read.
 *   - The checked set must contain every workspace the root `workspaces` names and every runtime dependency the
 *     root and workspace manifests declare (productionSetGuard.mjs); otherwise npm did not see the workspaces and
 *     the check fails.
 * Collaborators: npm (query), productionSetGuard.mjs, CI (`npm run check:licences`).
 * Tests: tools/dependency-check/test/checkLicences.test.mjs, tools/dependency-check/test/productionSetGuard.test.mjs
 */
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  expectedProductionPackages,
  incompleteSetProblems,
  readWorkspaceManifests,
} from './productionSetGuard.mjs';

/** SPDX identifiers that may be combined with GPL-3.0-or-later (FSF compatibility list). */
export const ALLOWED = new Set([
  '0BSD',
  'Apache-2.0',
  'BlueOak-1.0.0',
  'BSD-2-Clause',
  'BSD-3-Clause',
  // WHY: caniuse-lite (via next) is a data set; the FSF lists CC-BY-4.0 as GPLv3-compatible (D-071).
  'CC-BY-4.0',
  'CC0-1.0',
  'GPL-3.0-only',
  'GPL-3.0-or-later',
  'ISC',
  'LGPL-2.1-or-later',
  'LGPL-3.0-only',
  'LGPL-3.0-or-later',
  'MIT',
  // WHY: MIT without the attribution condition (@csstools/color-helpers via jsdom); it adds no restriction.
  'MIT-0',
  'MPL-2.0',
  'Python-2.0',
  'Unlicense',
  'Zlib',
]);

/**
 * Licences confirmed by reading the package's licence file, for packages with legacy metadata.
 * Key: `name@version`. Re-review when the version changes.
 */
export const REVIEWED = {
  // WHY: esprima 1.2.5 (via jsonpath) declares `licenses: [{type: "BSD"}]`; LICENSE.BSD has two clauses.
  'esprima@1.2.5': 'BSD-2-Clause',
  // WHY: declares "MIT and ISC" (lower case, not SPDX); LICENSE is MIT and the bundled d3 modules are ISC.
  '@visx/vendor@4.0.0-alpha.0': 'MIT AND ISC',
};

/**
 * Packages that ship only inside a separate program we run but never combine with our code (aggregation, not a
 * combined work). Key: `name@version`; value: the reason a person checked. Re-review when the version changes.
 */
export const SEPARATE_PROGRAMS = {
  // WHY: EPL-2.0 graph layout inside Prisma Studio (@prisma/studio-core), the GUI of the `prisma` CLI. Production
  // runs only `prisma migrate deploy`, as its own process; nothing of it is loaded into the server (D-071).
  'elkjs@0.11.1': 'EPL-2.0, Prisma Studio only',
};

/**
 * The packages a production install contains: npm sets `dev` only on packages that dev dependencies alone need.
 * @param {{dev?: boolean}[]} entries - Every entry from `npm query '*'`.
 * @returns {object[]} The entries without the dev flag.
 */
export const productionPackages = (entries) => entries.filter((entry) => entry.dev !== true);

/**
 * Decides whether an SPDX expression is allowed, honouring precedence: AND binds tighter than OR,
 * parentheses group, and `X WITH exception` is as allowed as `X` (exceptions only add permissions).
 * @param {string} expression - e.g. "MIT", "(MIT OR Apache-2.0)", "(MIT OR GPL-2.0-only) AND BSD-3-Clause".
 * @returns {boolean} True when the expression can be used under GPL-3.0-or-later; false when it is malformed.
 */
export function isAllowed(expression) {
  const tokens = expression.match(/\(|\)|[^\s()]+/g) ?? [];
  let at = 0;
  const peek = () => tokens[at];
  const next = () => tokens[at++];
  const identifier = (kind) => {
    const id = next();
    if (!id || ['AND', 'OR', 'WITH', '(', ')'].includes(id)) throw new Error(`${kind} identifier expected`);
    return id;
  };
  const atom = () => {
    if (peek() === '(') {
      next();
      const value = orExpr();
      if (next() !== ')') throw new Error('unbalanced parentheses');
      return value;
    }
    const id = identifier('licence');
    if (peek() === 'WITH') {
      next();
      identifier('exception');
    }
    return ALLOWED.has(id);
  };
  // WHY: the right-hand side is always parsed (not short-circuited), so every token is consumed and checked.
  const andExpr = () => {
    let value = atom();
    while (peek() === 'AND') {
      next();
      const right = atom();
      value = value && right;
    }
    return value;
  };
  const orExpr = () => {
    let value = andExpr();
    while (peek() === 'OR') {
      next();
      const right = andExpr();
      value = value || right;
    }
    return value;
  };
  try {
    const value = orExpr();
    return at === tokens.length && value;
  } catch {
    return false;
  }
}

/**
 * Reads the licence of one package entry from `npm query`.
 * @param {{name: string, version: string, license?: unknown, licenses?: {type: string}[]}} pkg - Query entry.
 * @returns {string | undefined} SPDX expression, or undefined when unknown.
 */
export function licenceOf(pkg) {
  const reviewed = REVIEWED[`${pkg.name}@${pkg.version}`];
  if (reviewed) return reviewed;
  if (typeof pkg.license === 'string') return pkg.license;
  if (pkg.license && typeof pkg.license === 'object' && 'type' in pkg.license)
    return String(pkg.license.type);
  return undefined;
}

/**
 * Checks a list of production packages.
 * @param {object[]} packages - Production entries (productionPackages).
 * @returns {string[]} One message per package that fails.
 */
export function checkLicences(packages) {
  return packages
    .filter((p) => p.name !== 'hvl-interaktiv' && !p.name.startsWith('@hvl-interaktiv/'))
    .filter((p) => !(`${p.name}@${p.version}` in SEPARATE_PROGRAMS))
    .flatMap((p) => {
      const licence = licenceOf(p);
      if (!licence)
        return [`${p.name}@${p.version}: no SPDX licence; read its licence file and add it to REVIEWED`];
      return isAllowed(licence)
        ? []
        : [`${p.name}@${p.version}: licence "${licence}" is not GPL-3.0-compatible`];
    });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const cwd = fileURLToPath(new URL('../../', import.meta.url));
  const out = execFileSync('npm', ['query', '*'], {
    cwd,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  const packages = productionPackages(JSON.parse(out));
  const expected = expectedProductionPackages(readWorkspaceManifests(cwd));
  const named = packages.filter((p) => typeof p.name === 'string');
  const problems = [...incompleteSetProblems(expected, packages), ...checkLicences(named)];
  for (const p of problems) console.error(`✗ ${p}`);
  if (problems.length > 0) process.exit(1);
  console.log(
    `✓ check:licences: ${packages.length} production packages (all ${expected.size} workspaces and declared ` +
      'runtime dependencies among them), all GPL-3.0-compatible.',
  );
}
