/**
 * The register of recorded H5P upstream problems (support/upstreamRegister.ts) names the element of every entry: an
 * entry whose markup pattern also matches a bare element, or one with a class or id H5P never writes (also one that
 * only shares the prefix the pattern names), and whose selector (if any) does not rule that element out, would cover
 * any new violation of its rule on the pages it applies to, so the register could hide a new problem (D-080). These
 * are checks of data, so they run without a browser or services. Each recorded English text must still be in the
 * code of the pinned library that writes it, so an entry goes when a library update fixes it (D-080).
 *
 * Spec: UD-030, UD-010
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { PINNED_LIBRARIES_DIR } from '../src/learningDesign/content/installedLibraries.js';
import { describeWithRealPackages } from '../test/support/realPackages.js';
import { matchesAnyElement } from './support/upstreamFindings.js';
import {
  UPSTREAM_ENGLISH_TEXTS,
  UPSTREAM_FINDINGS,
  type UpstreamFinding,
} from './support/upstreamRegister.js';

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
    // Arrange
    const catchAll: Omit<UpstreamFinding, 'ruleId' | 'surfaces' | 'types' | 'why'>[] = [
      { html: /^</ },
      { html: /^<li/ },
      { html: /^<li class="/ },
      { html: /^<span class="/ },
      { html: /^<div [^>]*>/ },
      { html: /^</, target: /./ },
      { html: /^<li/, target: /iframe > li$/ },
      { html: /^<div id="/, target: /^#/ },
      { html: /^<div class="h5p-/ },
      { html: /^<span class="h5p/ },
      { html: /^<[a-z]+ class="h5p-/ },
      { html: /^<li id="h5p-/ },
      { html: /^<li class="reuse-question/ },
      { html: /^<div/, target: /\.h5p-/ },
    ];
    const named: Omit<UpstreamFinding, 'ruleId' | 'surfaces' | 'types' | 'why'>[] = [
      { html: /^<li class="reuse-question disabled"/ },
      { html: /^<li (class="h5p-hub-tab-button"|id="h5p-[a-z]+" class="h5p-hub-media[ "])/ },
      { html: /^<span class="h5p-joubelui-score-bar-star"/ },
      { html: /^<div class="h5p-/, target: /\.h5p-dragnbar > div$/ },
      { html: /^<ol>$/, target: /\.h5p-hub-content-type-list > ol$/ },
    ];
    // Act
    const verdicts = (entries: typeof catchAll) =>
      entries.map((entry) => matchesAnyElement({ ...ENTRY, ...entry }));
    // Assert
    expect(verdicts(catchAll)).toEqual(catchAll.map(() => true));
    expect(verdicts(named)).toEqual(named.map(() => false));
  });
});

/** The text of every script file of an installed library folder. */
const scriptsOf = (folder: string): string =>
  readdirSync(folder, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.js'))
    .map((entry) => readFileSync(join(entry.parentPath, entry.name), 'utf8'))
    .join('\n');

describeWithRealPackages('[UD-010] the recorded English texts of the pinned libraries', () => {
  it.each(UPSTREAM_ENGLISH_TEXTS.map((entry) => [entry.text, entry] as const))(
    '[UD-010] "%s" is still written by the pinned library, so its entry still holds',
    (text, entry) => {
      // Act
      const scripts = scriptsOf(join(PINNED_LIBRARIES_DIR, entry.library.replace(' ', '-')));
      // Assert
      expect(scripts).toContain(text);
    },
  );
});
