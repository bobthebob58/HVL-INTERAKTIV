/**
 * checkLicences — fails when a production dependency has a licence that is not GPL-3.0-compatible.
 *
 * Why: the project is GPL-3.0-or-later because h5p-server is (NFR-005). Shipping a dependency under an
 *      incompatible or unknown licence would make the whole service undistributable.
 * Spec: NFR-005
 * Invariants:
 *   - Only production dependencies count (`npm query ':not(.dev)'`); our own workspaces are skipped.
 *   - SPDX `OR` passes if any branch is allowed; `AND` passes only if every part is allowed; AND binds
 *     tighter than OR and parentheses group, as in the SPDX specification. Malformed expressions fail.
 *   - A package without usable metadata fails unless REVIEWED lists it with the licence a person read.
 * Collaborators: npm (query), CI (`npm run check:licences`).
 * Tests: tools/dependency-check/test/checkLicences.test.mjs
 */
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

/** SPDX identifiers that may be combined with GPL-3.0-or-later (FSF compatibility list). */
export const ALLOWED = new Set([
  '0BSD',
  'Apache-2.0',
  'BlueOak-1.0.0',
  'BSD-2-Clause',
  'BSD-3-Clause',
  'CC0-1.0',
  'GPL-3.0-only',
  'GPL-3.0-or-later',
  'ISC',
  'LGPL-2.1-or-later',
  'LGPL-3.0-only',
  'LGPL-3.0-or-later',
  'MIT',
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
};

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
  const atom = () => {
    if (peek() === '(') {
      next();
      const value = orExpr();
      if (next() !== ')') throw new Error('unbalanced parentheses');
      return value;
    }
    const id = next();
    if (!id || ['AND', 'OR', 'WITH', ')'].includes(id)) throw new Error('licence identifier expected');
    if (peek() === 'WITH') {
      next();
      if (!next()) throw new Error('exception identifier expected');
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
 * @param {object[]} packages - Entries from `npm query ':not(.dev)'`.
 * @returns {string[]} One message per package that fails.
 */
export function checkLicences(packages) {
  return packages
    .filter((p) => p.name !== 'hvl-interaktiv' && !p.name.startsWith('@hvl-interaktiv/'))
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
  const out = execFileSync('npm', ['query', ':not(.dev)'], {
    cwd,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  const packages = JSON.parse(out);
  const problems = checkLicences(packages);
  for (const p of problems) console.error(`✗ ${p}`);
  if (problems.length > 0) process.exit(1);
  console.log(`✓ check:licences: ${packages.length} production packages, all GPL-3.0-compatible.`);
}
