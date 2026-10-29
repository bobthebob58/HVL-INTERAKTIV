/**
 * studioContentAnswers — builds the public studio answers from the content loaded at start-up: the overview (phases,
 * the *samling* anchor and the catalogue with each pattern's availability), the guide in one language, and one
 * pattern's detail with its "why it works" as prose nodes.
 *
 * Why: the web app reads no files (D-068), so the guide and the catalogue reach it as JSON in the contract's shapes
 *      (D-082, D-083). Keeping the shaping apart from the routes lets it be tested without HTTP, and keeps the route
 *      file to the routes.
 * Spec: PED-001, PED-002, PED-003, PED-010, PED-011
 * Invariants:
 *   - Reads only the frozen `StudioContent` and the pattern creator's `availability`; never the database, so an
 *     answer holds nothing about people (D-089).
 *   - Phase labels and texts come only from the content (PED-001): a renamed label changes every answer.
 *   - `available` is asked per request, since an administrator may install a library at any time (D-085).
 *   - The guide answer is empty (no nodes, no references) while no guide is written yet.
 * Collaborators: ./studioContentRoutes.ts, ../content/loadStudioContent.ts, ../content/patternAccessors.ts,
 *   ../content/patternProse.ts, ../content/guideContent.ts, ../patterns/PatternCreator.ts,
 *   @hvl-interaktiv/api-contract.
 * Tests: apps/server/test/learningDesign/http/studioContentAnswers.test.ts,
 *   apps/server/test/learningDesign/http/studioContentRoutes.int.test.ts
 */
import type {
  ApiLocale,
  Guide,
  PatternDetail,
  PatternSummary,
  Reference,
  StudioOverview,
} from '@hvl-interaktiv/api-contract';
import type { LocalisedText } from '../content/contentText.js';
import type { StudioContent } from '../content/loadStudioContent.js';
import { findPattern, patternCard, patternPage } from '../content/patternAccessors.js';
import type { StudioPattern } from '../content/patternContent.js';
import { patternProseNodes } from '../content/patternProse.js';
import type { StudioReference } from '../content/referencesContent.js';
import type { PatternCreator } from '../patterns/PatternCreator.js';

/** What the answers ask the pattern creator: whether a pattern can be created now. */
export type PatternAvailabilityLookup = Pick<PatternCreator, 'availability'>;

const reference = ({ key, text, verify }: StudioReference): Reference => ({ key, text, verify });

const card = async (pattern: StudioPattern, creator: PatternAvailabilityLookup): Promise<PatternSummary> => ({
  ...patternCard(pattern),
  available: (await creator.availability(pattern.id))?.available ?? false,
});

/**
 * The studio's overview.
 * @param content - The studio content loaded at start-up.
 * @param creator - Says whether each pattern can be created with the libraries installed now.
 * @returns The review status, the anchor, the phases in order and every pattern's card.
 * @spec PED-001
 */
export async function studioOverviewAnswer(
  content: StudioContent,
  creator: PatternAvailabilityLookup,
): Promise<StudioOverview> {
  const { status, anchor, phases } = content.phases;
  return {
    status,
    anchor: { label: anchor.label, description: anchor.description },
    phases: phases.map(({ key, order, label, description, purpose, canvasPlacement }) => ({
      key,
      order,
      label,
      description,
      purpose,
      canvasPlacement,
    })),
    patterns: await Promise.all(content.patterns.patterns.map((pattern) => card(pattern, creator))),
  };
}

/**
 * The guide in one language.
 * @param content - The studio content loaded at start-up.
 * @param locale - The language asked for.
 * @returns The nodes and the cited references; both empty while no guide is written yet.
 * @spec PED-002
 */
export function guideAnswer(content: StudioContent, locale: ApiLocale): Guide {
  const document = content.guide.documents?.[locale];
  return {
    locale,
    status: content.phases.status,
    nodes: [...(document?.nodes ?? [])],
    references: (document?.references ?? []).map(reference),
  };
}

const proseOf = (text: LocalisedText): PatternDetail['whyItWorks'] => ({
  nn: patternProseNodes(text.nn),
  nb: patternProseNodes(text.nb),
  en: patternProseNodes(text.en),
});

/**
 * One pattern's page.
 * @param content - The studio content loaded at start-up.
 * @param creator - Says whether the pattern can be created now.
 * @param patternId - The ID from the path (untrusted).
 * @returns The detail, or undefined when there is no pattern with this ID.
 * @spec PED-010
 */
export async function patternDetailAnswer(
  content: StudioContent,
  creator: PatternAvailabilityLookup,
  patternId: string,
): Promise<PatternDetail | undefined> {
  const pattern = findPattern(content.patterns, patternId);
  if (!pattern) return undefined;
  const page = patternPage(pattern, content.references);
  return {
    ...(await card(pattern, creator)),
    whenToUse: page.whenToUse,
    whyItWorks: proseOf(page.whyItWorks),
    example: page.example,
    studentMinutes: page.studentMinutes,
    references: page.references.map(reference),
  };
}
