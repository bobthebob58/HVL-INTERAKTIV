/**
 * realPatterns — the repository's own patterns (`content/laeringsdesign/patterns/`) as the creation tests use them:
 * the folders on disk, every creation a pattern allows (each content type in each phase), and the creation of all of
 * them through the route of a running bench.
 *
 * Why: PED-010 asks that every pattern of spec 04 §4 instantiates. ALU adds, renames and edits patterns, so the tests
 *      read the folder list and the loaded patterns at test time and assert nothing about their texts or counts.
 * Spec: PED-010, PROD-001
 * Invariants:
 *   - A folder is a pattern folder when it is a directory whose name does not start with a dot (as the loader
 *     reads them, ../../../src/learningDesign/content/patternContent.ts).
 *   - Creations are made one after the other, in the order of `realPatternChoices`, so each answer belongs to its
 *     choice; a failed creation keeps its status and body for the test to report.
 * Collaborators: ./patternCreationBench.ts, ../../../src/learningDesign/content/loadStudioContent.ts.
 * Tests: apps/server/test/learningDesign/patterns/realPatternCreation.int.test.ts,
 *   apps/server/test/learningDesign/patterns/realPatternFindings.int.test.ts,
 *   apps/server/test/learningDesign/patterns/realPatternDefaults.int.test.ts,
 *   apps/server/test/learningDesign/content/realPatternContent.test.ts (the folder list)
 */
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import type { AuthorableContentType, PhaseKey } from '@hvl-interaktiv/api-contract';
import { REPOSITORY_ROOT } from '../../../src/learningDesign/content/contentProblem.js';
import type { PatternContent } from '../../../src/learningDesign/content/patternContent.js';
import { PATTERNS_DIR } from '../../../src/learningDesign/content/patternFolder.js';
import type { PatternCreationBench } from './patternCreationBench.js';

/** One creation a pattern allows. */
export interface RealPatternChoice {
  readonly patternId: string;
  readonly contentType: AuthorableContentType;
  readonly phase: PhaseKey;
}

/** A creation made through the route. */
export interface RealPatternCreation {
  readonly choice: RealPatternChoice;
  readonly language: 'nn' | 'nb' | 'en';
  readonly status: number;
  /** The new activity's ID, or '' when the creation failed. */
  readonly contentId: string;
  /** The answer's body, for a failure message. */
  readonly body: unknown;
}

/**
 * The pattern folders in the repository's content folder.
 * @returns Their names, sorted.
 */
export function realPatternFolders(): string[] {
  return readdirSync(join(REPOSITORY_ROOT, 'content', ...PATTERNS_DIR.split('/')), { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.'))
    .map((entry) => entry.name)
    .sort();
}

/**
 * Every creation the loaded patterns allow: each content type in each phase.
 * @param content - The loaded patterns.
 * @returns The choices, pattern by pattern.
 */
export function realPatternChoices(content: PatternContent): RealPatternChoice[] {
  return content.patterns.flatMap((pattern) =>
    pattern.contentTypes.flatMap((contentType) =>
      pattern.phases.map((phase) => ({ patternId: pattern.id, contentType, phase })),
    ),
  );
}

/**
 * Creates an activity for each choice through `POST /api/patterns/:patternId/activities`.
 * @param bench - A running bench with the real patterns.
 * @param choices - What to create.
 * @param language - The activities' language.
 * @returns One creation per choice, in order.
 */
export async function createRealPatterns(
  bench: PatternCreationBench,
  choices: readonly RealPatternChoice[],
  language: RealPatternCreation['language'],
): Promise<RealPatternCreation[]> {
  const created: RealPatternCreation[] = [];
  for (const choice of choices) {
    const { patternId, contentType, phase } = choice;
    const res = await bench.create(patternId, { language, contentType, phase });
    const contentId = (res.body as { contentId?: unknown }).contentId;
    created.push({
      choice,
      language,
      status: res.status,
      contentId: typeof contentId === 'string' ? contentId : '',
      body: res.body as unknown,
    });
  }
  return created;
}

/**
 * A short name of a creation for test messages, e.g. `ea-terms H5P.Blanks etterarbeid nn`.
 * @param creation - A creation.
 * @returns The name.
 */
export const creationName = ({ choice, language }: RealPatternCreation): string =>
  `${choice.patternId} ${choice.contentType} ${choice.phase} ${language}`;
