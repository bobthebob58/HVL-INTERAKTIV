/**
 * lumiInternals — the Lumi classes we use that are not exported from the package index.
 *
 * Why: h5p-server 10.0.4 does not export its SemanticsEnforcer (needed to sanitise list items, D-039), and
 *      Lumi's SVG sanitiser is CommonJS with `exports.default`. Loading them in one place keeps the deep paths
 *      visible and makes them load the same way under Node, tsx and Vitest.
 * Spec: SEC-001, SEC-008
 * Invariants:
 *   - Only this module loads Lumi's internal modules at run time; other files import types only from
 *     `build/src/types.js`, which compile away. A Lumi upgrade that moves these files fails here at startup.
 * Collaborators: ./semantics/lumiTextSanitizer.ts, ../security/SvgSanitizer.ts.
 * Tests: apps/server/test/h5p/upstream/semanticsEnforcerListGap.test.ts,
 *   apps/server/test/security/upstream/lumiSvgSanitizer.test.ts
 */
import { createRequire } from 'node:module';

// WHY: these modules are CommonJS with `exports.default`. Node and Vitest unwrap such a default
// differently on `import`; `require` returns the same object in both.
const load = createRequire(import.meta.url);

/** Lumi's semantics enforcer (sanitises text, removes libraries a field does not offer). */
export const SemanticsEnforcer = (
  load(
    '@lumieducation/h5p-server/build/src/SemanticsEnforcer.js',
  ) as typeof import('@lumieducation/h5p-server/build/src/SemanticsEnforcer.js')
).default;

/** Lumi's DOMPurify-based SVG sanitiser (only reads paths ending in ".svg"). */
export const LumiSvgSanitizer = (
  load('@lumieducation/h5p-svg-sanitizer') as typeof import('@lumieducation/h5p-svg-sanitizer')
).default;
