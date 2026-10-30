/**
 * patternChoice — decides which phase and which skeleton a create-from-pattern request gets, from the pattern's own
 * lists, and refuses any other choice.
 *
 * Why: two patterns have a choice: `ea-terms` offers two content types and `ea-diagnose` two phases (D-085). The
 *      activity's metadata must carry a phase the pattern offers, and the skeleton must be the one the author chose.
 * Spec: PROD-001
 * Invariants:
 *   - Without `phase`, the pattern's first phase (in content order) is used; a phase it does not list is a 400.
 *   - Without `contentType`, a pattern with one content type uses it, and one with two is a 400; a type it does not
 *     list is a 400. Every 400 is `hvl:pattern-choice-invalid`, so it reveals nothing beyond the pattern's card.
 *   - Pure: no I/O.
 * Collaborators: ./PatternCreator.ts (the caller), ../content/patternAccessors.ts, ../../http/learningDesignErrors.ts.
 * Tests: apps/server/test/learningDesign/patterns/patternChoice.test.ts
 */
import type { PatternActivityRequest, PhaseKey } from '@hvl-interaktiv/api-contract';
import { learningDesignError } from '../../http/learningDesignErrors.js';
import { patternSkeleton } from '../content/patternAccessors.js';
import type { StudioPattern, StudioPatternSkeleton } from '../content/patternContent.js';

/** What a request creates: the phase for its metadata and the skeleton to build. */
export interface PatternChoice {
  readonly phase: PhaseKey;
  readonly skeleton: StudioPatternSkeleton;
}

/**
 * Chooses the phase and skeleton for a request.
 * @param pattern - The pattern.
 * @param request - The request's `phase` and `contentType`.
 * @returns The phase and the skeleton.
 * @throws HttpError 400 `hvl:pattern-choice-invalid` for a phase or content type the pattern does not offer, or
 *   no content type for a pattern with two.
 * @spec PROD-001
 */
export function choosePatternOption(
  pattern: StudioPattern,
  request: Pick<PatternActivityRequest, 'phase' | 'contentType'>,
): PatternChoice {
  const phase = request.phase ?? pattern.phases[0];
  if (phase === undefined || !pattern.phases.includes(phase))
    throw learningDesignError('hvl:pattern-choice-invalid');
  const [only, second] = pattern.contentTypes;
  const contentType = request.contentType ?? (second === undefined ? only : undefined);
  const skeleton = contentType === undefined ? undefined : patternSkeleton(pattern, contentType);
  if (!skeleton) throw learningDesignError('hvl:pattern-choice-invalid');
  return { phase, skeleton };
}
