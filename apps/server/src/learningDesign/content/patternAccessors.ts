/**
 * patternAccessors — typed reads of the loaded patterns for the routes: finding a pattern, its catalogue card, the
 * fields of its page, the references it cites, and the skeleton of one content type.
 *
 * Why: the catalogue and the pattern page (PED-003, PED-010, workstream W1) and creation (PROD-001, D-085) read the
 *      same frozen patterns (D-082). These accessors give them the contract's shapes, so no route reaches into the
 *      loader's types or repeats a lookup.
 * Spec: PED-010, PED-011, PROD-001
 * Invariants:
 *   - Pure reads of frozen content; nothing here reads a file or changes a pattern.
 *   - Unknown IDs and content types give undefined, never a throw, so a route decides its own answer (404, 400).
 *   - `available` is not part of a card: it depends on the installed libraries at the moment of the request
 *     (`PatternCreator.availability`, D-085).
 * Collaborators: ./patternContent.ts, ./referencesContent.ts, ../patterns/PatternCreator.ts, the studio routes (W1),
 *   @hvl-interaktiv/api-contract (`PatternSummary`, `PatternDetail`).
 * Tests: apps/server/test/learningDesign/content/patternContent.test.ts
 */
import type { AuthorableContentType, PatternDetail, PatternSummary } from '@hvl-interaktiv/api-contract';
import type { LocalisedText } from './contentText.js';
import type { PatternContent, StudioPattern, StudioPatternSkeleton } from './patternContent.js';
import { findReference, type ReferencesContent, type StudioReference } from './referencesContent.js';

/** A pattern's catalogue card without `available` (which the creator decides per request). */
export type PatternCardFields = Omit<PatternSummary, 'available'>;

/** The fields of a pattern's page beyond its card; `whyItWorks` is Markdown for the guide's node builder (W1). */
export interface PatternPageFields extends Pick<PatternDetail, 'studentMinutes'> {
  readonly whenToUse: LocalisedText;
  readonly example: LocalisedText;
  /** Markdown with `[@key]` citations, in nn, nb and en. */
  readonly whyItWorks: LocalisedText;
  /** Every cited reference, in citation order. */
  readonly references: readonly StudioReference[];
}

/**
 * Finds a pattern by its ID.
 * @param content - The loaded patterns.
 * @param patternId - The ID from the request (untrusted).
 * @returns The pattern, or undefined when there is none with that ID.
 * @spec PED-010
 */
export function findPattern(content: PatternContent, patternId: string): StudioPattern | undefined {
  return content.patterns.find((pattern) => pattern.id === patternId);
}

/**
 * The fields of a pattern's catalogue card.
 * @param pattern - A loaded pattern.
 * @returns ID, phases, content types, name, purpose and build time.
 * @spec PED-010
 */
export function patternCard(pattern: StudioPattern): PatternCardFields {
  const { id, phases, contentTypes, name, purpose, buildMinutes } = pattern;
  return { id, phases: [...phases], contentTypes: [...contentTypes], name, purpose, buildMinutes };
}

/**
 * The references a pattern cites, in citation order.
 * @param pattern - A loaded pattern.
 * @param references - The loaded references (every cited key exists once loading has succeeded).
 * @returns The references.
 * @spec PED-010
 */
export function citedReferences(pattern: StudioPattern, references: ReferencesContent): StudioReference[] {
  return pattern.citations.flatMap((key) => {
    const reference = findReference(references, key);
    return reference ? [reference] : [];
  });
}

/**
 * The fields of a pattern's page beyond its card.
 * @param pattern - A loaded pattern.
 * @param references - The loaded references.
 * @returns When to use it, an example, why it works (Markdown), the student minutes and the cited references.
 * @spec PED-010
 */
export function patternPage(pattern: StudioPattern, references: ReferencesContent): PatternPageFields {
  const { whenToUse, example, whyItWorks, studentMinutes } = pattern;
  return { whenToUse, example, whyItWorks, studentMinutes, references: citedReferences(pattern, references) };
}

/**
 * The skeleton a pattern creates for one content type.
 * @param pattern - A loaded pattern.
 * @param contentType - One of its content types (untrusted).
 * @returns The skeleton, or undefined when the pattern does not offer that type.
 * @spec PROD-001
 */
export function patternSkeleton(
  pattern: StudioPattern,
  contentType: AuthorableContentType,
): StudioPatternSkeleton | undefined {
  return pattern.skeletons.find((skeleton) => skeleton.contentType === contentType);
}
