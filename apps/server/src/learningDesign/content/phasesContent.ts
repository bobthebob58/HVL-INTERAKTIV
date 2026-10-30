/**
 * phasesContent — loads `content/laeringsdesign/phases.yaml`: the review status, the *samling* anchor, and the three
 * phases with their labels, descriptions, pedagogical purposes and Canvas placements in nn, nb and en.
 *
 * Why: phase labels are configuration, not code (spec 04 §1, PED-001): ALU renames a label in this file and every
 *      page, the planner and the portfolio follow. The phase matrix (spec 04 §3) needs each phase's purpose and its
 *      Canvas placement and attempt policy, so they live here too (D-082).
 * Spec: PED-001
 * Invariants:
 *   - The keys are exactly `forarbeid`, `underveis` and `etterarbeid` (`PHASE_KEYS`), each once; code uses only keys.
 *   - `order` is 1, 2 and 3, each once, and `phases` is returned sorted by it.
 *   - Every text exists in nn, nb and en; unknown and repeated keys are refused, naming the file, the key and the line.
 *   - `status: proposed` means ALU has not confirmed the texts; the studio pages then show a draft banner (D-082).
 * Collaborators: ./yamlContentFile.ts, ./contentText.ts, @hvl-interaktiv/api-contract (`PHASE_KEYS`,
 *   `contentReviewStatusSchema`), ./loadStudioContent.ts; content/laeringsdesign/README.md (the guide for ALU).
 * Tests: apps/server/test/learningDesign/content/phasesContent.test.ts
 */
import { join } from 'node:path';
import {
  contentReviewStatusSchema,
  PHASE_KEYS,
  type ContentReviewStatus,
  type PhaseKey,
} from '@hvl-interaktiv/api-contract';
import { z } from 'zod';
import { localisedContentText, type LocalisedText } from './contentText.js';
import { readYamlContentFile, type ContentLoadResult } from './yamlContentFile.js';

/** The file, relative to the content folder. */
export const PHASES_FILE = 'laeringsdesign/phases.yaml';

/** Where a phase sits around the *samling*, the synchronous session. */
export const PHASE_POSITIONS = ['before-samling', 'between-samlingar', 'after-samling'] as const;
/** Where a phase sits around the *samling*. */
export type PhasePosition = (typeof PHASE_POSITIONS)[number];

/** One phase of the phase matrix (spec 04 §3). */
export interface StudioPhase {
  /** The stable key code and the database use; never shown. */
  readonly key: PhaseKey;
  /** 1, 2 or 3: the order of the matrix columns, the filters and the planner. */
  readonly order: number;
  readonly position: PhasePosition;
  readonly label: LocalisedText;
  readonly description: LocalisedText;
  /** The pedagogical purpose (spec 04 §3, phase matrix). */
  readonly purpose: LocalisedText;
  /** Where the activity goes in Canvas, and its attempt policy (spec 04 §3, phase matrix). */
  readonly canvasPlacement: LocalisedText;
}

/** The *samling* in the middle of the matrix: shown to explain where the phases sit, never authored. */
export interface PhaseAnchor {
  readonly key: 'samling';
  readonly authored: false;
  readonly label: LocalisedText;
  readonly description: LocalisedText;
}

/** The loaded phases.yaml. */
export interface PhasesContent {
  readonly version: 1;
  /** `proposed` until ALU confirms the texts (D-082); the studio shows a draft banner meanwhile. */
  readonly status: ContentReviewStatus;
  readonly anchor: PhaseAnchor;
  /** Every phase once, sorted by `order`. */
  readonly phases: readonly StudioPhase[];
}

const LABEL = { maxLength: 60 } as const;
const TEXT = { maxLength: 400 } as const;

const phaseKey = z.enum(PHASE_KEYS, {
  error: (issue) =>
    issue.input === undefined
      ? undefined
      : `"${String(issue.input)}" is not a phase key; the keys are ${PHASE_KEYS.join(', ')}`,
});

const phaseSchema = z.strictObject({
  key: phaseKey,
  order: z.int().min(1).max(PHASE_KEYS.length),
  position: z.enum(PHASE_POSITIONS),
  label: localisedContentText(LABEL),
  description: localisedContentText(TEXT),
  purpose: localisedContentText(TEXT),
  canvasPlacement: localisedContentText(TEXT),
});

const phaseListSchema = z
  .array(phaseSchema)
  .superRefine((phases, context) => {
    for (const key of PHASE_KEYS) {
      if (!phases.some((phase) => phase.key === key))
        context.addIssue({ code: 'custom', message: `the phase ${key} is missing` });
    }
    phases.forEach((phase, index) => {
      if (phases.findIndex((other) => other.key === phase.key) < index)
        context.addIssue({
          code: 'custom',
          path: [index, 'key'],
          message: `the phase ${phase.key} is listed more than once`,
        });
      if (phases.findIndex((other) => other.order === phase.order) < index)
        context.addIssue({
          code: 'custom',
          path: [index, 'order'],
          message: `order ${phase.order} is given to two phases`,
        });
    });
  })
  .transform((phases) => [...phases].sort((a, b) => a.order - b.order));

/** The schema of phases.yaml. */
export const phasesFileSchema: z.ZodType<PhasesContent> = z.strictObject({
  version: z.literal(1),
  status: contentReviewStatusSchema,
  anchor: z.strictObject({
    key: z.literal('samling'),
    authored: z.literal(false),
    label: localisedContentText(LABEL),
    description: localisedContentText(TEXT),
  }),
  phases: phaseListSchema,
});

/**
 * Loads and checks phases.yaml.
 * @param root - The content folder (the repository's `content/`, or a test fixture).
 * @returns The frozen phases, or every problem, each naming the file, the line and the key.
 * @spec PED-001
 */
export function loadPhasesContent(root: string): ContentLoadResult<PhasesContent> {
  return readYamlContentFile(join(root, PHASES_FILE), phasesFileSchema);
}

/**
 * Finds one phase by key.
 * @param content - Loaded phases (every key is present once loading has succeeded).
 * @param key - The phase key.
 * @returns The phase with its texts.
 * @throws Error only if `content` did not come from `loadPhasesContent`.
 */
export function phaseOf(content: PhasesContent, key: PhaseKey): StudioPhase {
  const phase = content.phases.find((candidate) => candidate.key === key);
  if (!phase) throw new Error(`The loaded phases have no phase "${key}".`);
  return phase;
}
