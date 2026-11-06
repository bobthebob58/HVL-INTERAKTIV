/**
 * Unit tests for which activities can never send Canvas a score (D-115's table): ImageHotspots, InteractiveVideo
 * without a submit screen and BranchingScenario without scoring, read from the real patterns' skeletons and from
 * hand-made params; every other pattern can send one.
 *
 * Spec: LTI-012, LTI-013
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { noScoreReasonOf } from '../../../src/lti/deepLinking/noScoreActivities.js';

const PATTERNS = fileURLToPath(new URL('../../../../../content/laeringsdesign/patterns/', import.meta.url));

/** A pattern's main library (machine name) and params, as the pattern builder stores them. */
const pattern = (id: string): { mainLibrary: string; params: unknown } => {
  const skeleton = JSON.parse(readFileSync(`${PATTERNS}${id}/skeleton.json`, 'utf8')) as {
    library: string;
    params: unknown;
  };
  return { mainLibrary: skeleton.library.split(' ')[0] ?? '', params: skeleton.params };
};
const reasonOfPattern = (id: string) => {
  const { mainLibrary, params } = pattern(id);
  return noScoreReasonOf(mainLibrary, params);
};
const video = (endscreens: unknown) => ({ interactiveVideo: { assets: { endscreens } } });
const scenario = (scoringOption: unknown) => ({
  branchingScenario: { scoringOptionGroup: { scoringOption } },
});

describe('[LTI-012] activities that send Canvas no score (D-115)', () => {
  it('[LTI-012] the patterns fa-hotspots and fa-video send no score, and say why', () => {
    expect(reasonOfPattern('fa-hotspots')).toBe('noStatements');
    expect(reasonOfPattern('fa-video')).toBe('noSubmitScreen');
  });

  it.each(['ea-diagnose', 'ea-retrieval', 'fa-slides', 'uv-case', 'uv-column', 'uv-module'])(
    '[LTI-012] the pattern %s can send a score',
    (id) => {
      expect(reasonOfPattern(id)).toBeUndefined();
    },
  );

  it('[LTI-012] an InteractiveVideo sends a score only with at least one submit screen', () => {
    expect(noScoreReasonOf('H5P.InteractiveVideo', video([{ time: 30, label: '0:30' }]))).toBeUndefined();
    expect(noScoreReasonOf('H5P.InteractiveVideo', video([]))).toBe('noSubmitScreen');
    expect(noScoreReasonOf('H5P.InteractiveVideo', {})).toBe('noSubmitScreen');
    expect(noScoreReasonOf('H5P.InteractiveVideo', video('not a list'))).toBe('noSubmitScreen');
  });

  it('[LTI-012] a BranchingScenario sends a score only with static or dynamic scoring; H5P’s default is none', () => {
    expect(noScoreReasonOf('H5P.BranchingScenario', scenario('static-end-score'))).toBeUndefined();
    expect(noScoreReasonOf('H5P.BranchingScenario', scenario('dynamic-score'))).toBeUndefined();
    expect(noScoreReasonOf('H5P.BranchingScenario', scenario('no-score'))).toBe('noScoring');
    expect(noScoreReasonOf('H5P.BranchingScenario', {})).toBe('noScoring');
    expect(noScoreReasonOf('H5P.BranchingScenario', null)).toBe('noScoring');
  });

  it('[LTI-012] an ImageHotspots never sends one, whatever its params; other types are never flagged', () => {
    expect(noScoreReasonOf('H5P.ImageHotspots', scenario('static-end-score'))).toBe('noStatements');
    expect(noScoreReasonOf('H5P.MultiChoice', video([]))).toBeUndefined();
    expect(noScoreReasonOf('H5P.Column', {})).toBeUndefined();
  });
});
