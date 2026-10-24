/**
 * The register of recorded H5P upstream problems (support/upstreamRegister.ts) names the element of every entry: an
 * entry whose markup pattern also matches a bare element would cover any new violation of its rule on the pages it
 * applies to, so the register could hide a new problem (D-080). These are checks of data, so they run without a
 * browser or services.
 *
 * Spec: UD-030
 */
import { describe, expect, it } from 'vitest';
import { matchesAnyElement, type UpstreamFinding } from './support/upstreamFindings.js';
import { UPSTREAM_FINDINGS } from './support/upstreamRegister.js';

const ENTRY: Omit<UpstreamFinding, 'html'> = {
  ruleId: 'color-contrast',
  surfaces: ['editor'],
  types: ['*'],
  why: 'test entry',
};

describe('[UD-030] the register of recorded H5P upstream problems', () => {
  it('[UD-030] has no entry that matches any element of its rule', () => {
    expect(UPSTREAM_FINDINGS.filter(matchesAnyElement).map((entry) => String(entry.html))).toEqual([]);
  });

  it('[UD-030] tells a catch-all pattern from one that names its element or is narrowed by a selector', () => {
    const verdicts = [
      matchesAnyElement({ ...ENTRY, html: /^</ }),
      matchesAnyElement({ ...ENTRY, html: /^<li/ }),
      matchesAnyElement({ ...ENTRY, html: /^<li class="reuse-question disabled"/ }),
      matchesAnyElement({ ...ENTRY, html: /^<ol>$/, target: /iframe > ol$/ }),
    ];
    expect(verdicts).toEqual([true, true, false, false]);
  });
});
