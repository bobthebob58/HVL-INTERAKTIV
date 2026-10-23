/**
 * coreInlineScripts — the CSP hashes of the constant inline scripts H5P Core writes into the iframes of embedded
 * content, read from the installed core files.
 *
 * Why: content types with the iframe embed type run inside an `about:blank` iframe whose head H5P Core writes,
 *      ending with one constant inline script (`h5p.js` `getHeadTags`). Such an iframe inherits the page's policy,
 *      so the policy must allow exactly that script by hash and nothing else inline (D-070). Reading it from the
 *      installed `h5p.js` keeps the hash right after a core update instead of breaking every embedded activity.
 * Spec: H5P-009, DATA-011
 * Invariants:
 *   - Only string literals of the form `'<script>…</script>'` in `js/h5p.js` count; their text is hashed exactly.
 *   - A core without such a literal is an error at start-up (the policy would otherwise be wrong silently).
 * Collaborators: ../createH5pRuntime.ts, ../../http/h5pPageCsp.ts.
 * Tests: apps/server/test/h5p/render/coreInlineScripts.test.ts
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const INLINE_SCRIPT_LITERAL = /'<script>([^'<]*)<\/script>'/g;

/**
 * The CSP source expressions (`'sha256-…'`) of the inline scripts in a core's `h5p.js`.
 * @param source - The text of `js/h5p.js`.
 * @returns One hash per distinct inline script.
 * @throws Error when the file contains none.
 */
export function inlineScriptHashes(source: string): string[] {
  const scripts = new Set([...source.matchAll(INLINE_SCRIPT_LITERAL)].map((m) => m[1] ?? ''));
  if (scripts.size === 0) throw new Error('H5P Core h5p.js writes no inline script we can hash (D-070)');
  return [...scripts].map((text) => `'sha256-${createHash('sha256').update(text, 'utf8').digest('base64')}'`);
}

/**
 * Reads the hashes from an installed core.
 * @param corePath - The core folder (`H5P_CORE_DIR`).
 * @returns The hashes for `script-src`.
 */
export function coreInlineScriptHashes(corePath: string): string[] {
  return inlineScriptHashes(readFileSync(join(corePath, 'js', 'h5p.js'), 'utf8'));
}
