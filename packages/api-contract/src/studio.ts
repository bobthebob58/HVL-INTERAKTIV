/**
 * studio — the shapes of the public studio answers: the phases, the pattern catalogue, one pattern's detail, the
 * references and the guide (`/laeringsdesign`).
 *
 * Why: the studio's texts live in `content/` for ALU to edit without code (PED-001, PED-011, D-082); the server
 *      loads and checks them at start-up and gives the web app read-only JSON in these shapes (D-068). Phase labels
 *      come only from this content, so a renamed label changes every page.
 * Spec: PED-001, PED-002, PED-003, PED-010, PED-011
 * Invariants:
 *   - A text the content holds in three languages is a `LocaleText` (`nn`, `nb`, `en`, none empty); the guide is
 *     long, so its answer holds one language.
 *   - Phase keys are stable codes (`forarbeid`, `underveis`, `etterarbeid`); labels never appear in code.
 *   - Nothing here is about people: these answers are public (D-089).
 * Collaborators: ./guideNodes.ts, ./me.ts (locale), ./patterns.ts, ./learningDesign.ts, ./planner.ts,
 *   apps/server/src/learningDesign/content/, apps/web.
 * Tests: packages/api-contract/test/studioSchemas.test.ts
 */
import { z } from 'zod';
import { guideBlockNodeSchema, guideProseNodeSchema, referenceKeySchema } from './guideNodes.js';
import { localeSchema } from './me.js';

/** The phase keys in content order (spec 04 §1); `underveis` is labelled «Mellomarbeid». */
export const PHASE_KEYS = ['forarbeid', 'underveis', 'etterarbeid'] as const;
/** A phase key. */
export const phaseKeySchema = z.enum(PHASE_KEYS);
/** A phase key. */
export type PhaseKey = z.infer<typeof phaseKeySchema>;

/** The ten content types authors may create (CLAUDE.md §1); `H5P.DragQuestion` is never one of them. */
export const AUTHORABLE_CONTENT_TYPES = [
  'H5P.CoursePresentation',
  'H5P.InteractiveVideo',
  'H5P.QuestionSet',
  'H5P.InteractiveBook',
  'H5P.Column',
  'H5P.DragText',
  'H5P.MultiChoice',
  'H5P.Blanks',
  'H5P.ImageHotspots',
  'H5P.BranchingScenario',
] as const;
/** The machine name of an authorable content type. */
export const authorableContentTypeSchema = z.enum(AUTHORABLE_CONTENT_TYPES);
/** The machine name of an authorable content type. */
export type AuthorableContentType = z.infer<typeof authorableContentTypeSchema>;

/** A pattern's ID, its folder name under `content/laeringsdesign/patterns/` (e.g. `fa-video`). */
export const patternIdSchema = z
  .string()
  .regex(/^[a-z][a-z0-9-]{1,63}$/)
  .describe('A pattern ID, e.g. `fa-video`.');
/** A pattern ID. */
export type PatternId = z.infer<typeof patternIdSchema>;

// WHY: a key listed twice would show one phase or type twice in the matrix, the catalogue filter or the planner.
const distinct = (keys: readonly string[]) => new Set(keys).size === keys.length;

/**
 * The same schema in each UI language.
 * @param schema - The schema of one language's value.
 * @returns A strict object with `nn`, `nb` and `en`.
 */
export const localised = <T extends z.ZodType>(schema: T) =>
  z.strictObject({ nn: schema, nb: schema, en: schema });

/** A text in Nynorsk, Bokmål and English, none of them empty. */
export const localeTextSchema = localised(z.string().min(1));
/** A text in the three UI languages. */
export type LocaleText = z.infer<typeof localeTextSchema>;

/** Whether ALU has confirmed the studio's texts; while `proposed`, the pages show a draft banner (D-082). */
export const contentReviewStatusSchema = z.enum(['proposed', 'confirmed-by-alu']);
/** Proposed, or confirmed by ALU. */
export type ContentReviewStatus = z.infer<typeof contentReviewStatusSchema>;

/** One phase of the phase matrix (spec 04 §3). */
export const phaseSchema = z.strictObject({
  key: phaseKeySchema,
  /** 1, 2, 3: the order of the matrix columns and the planner. */
  order: z.int().min(1),
  label: localeTextSchema,
  description: localeTextSchema,
  /** The pedagogical purpose (spec 04 §3). */
  purpose: localeTextSchema,
  /** Where it goes in Canvas, and its attempt policy (spec 04 §3). */
  canvasPlacement: localeTextSchema,
});
/** One phase. */
export type Phase = z.infer<typeof phaseSchema>;

/** One full reference, cited with `[@key]`; `verify` stays true until ALU has checked it. */
export const referenceSchema = z.strictObject({
  key: referenceKeySchema,
  text: z.string().min(1),
  verify: z.boolean(),
});
/** One reference. */
export type Reference = z.infer<typeof referenceSchema>;

/**
 * A pattern card in the catalogue (PED-003 filters by phase, content type and build time).
 * @spec PED-010
 */
export const patternSummarySchema = z.strictObject({
  id: patternIdSchema,
  /** One phase, or two (`ea-diagnose`), in content order. */
  phases: z.array(phaseKeySchema).min(1).max(PHASE_KEYS.length).refine(distinct, 'A phase is listed twice.'),
  /** One content type, or two (`ea-terms`). */
  contentTypes: z
    .array(authorableContentTypeSchema)
    .min(1)
    .max(2)
    .refine(distinct, 'A content type is listed twice.'),
  name: localeTextSchema,
  /** One line. */
  purpose: localeTextSchema,
  /** Minutes an author needs to build it. */
  buildMinutes: z.int().min(1).max(600),
  /** False when a library its skeleton needs is not installed (D-085): shown, but creation answers 409. */
  available: z.boolean(),
});
/** A pattern card. */
export type PatternSummary = z.infer<typeof patternSummarySchema>;

/**
 * One pattern's page: the card plus when to use it, why it works (with citations), an example and the references
 * it cites.
 * @spec PED-010
 */
export const patternDetailSchema = patternSummarySchema.extend({
  whenToUse: localeTextSchema,
  /** Paragraphs and lists with `[@key]` citations, built like the guide (D-083). */
  whyItWorks: localised(z.array(guideProseNodeSchema).min(1)),
  example: localeTextSchema,
  /** The suggested minutes for students, written to the new activity's metadata (D-085). */
  studentMinutes: z.int().min(1).max(600),
  /** Every reference the pattern cites, in citation order. */
  references: z.array(referenceSchema),
});
/** One pattern's page. */
export type PatternDetail = z.infer<typeof patternDetailSchema>;

/** The synchronous session the activities sit around (*samling*); shown in the matrix, never authored. */
export const studioAnchorSchema = z.strictObject({ label: localeTextSchema, description: localeTextSchema });
/** The *samling* anchor of the phase matrix. */
export type StudioAnchor = z.infer<typeof studioAnchorSchema>;

/**
 * The studio's overview: review status, the phases in order, the *samling* anchor and the pattern catalogue.
 * @spec PED-001
 */
export const studioOverviewSchema = z.strictObject({
  status: contentReviewStatusSchema,
  anchor: studioAnchorSchema,
  /** Every phase once, in content order. */
  phases: z
    .array(phaseSchema)
    .length(PHASE_KEYS.length)
    .refine((phases) => distinct(phases.map(({ key }) => key)), 'A phase is listed twice.'),
  patterns: z.array(patternSummarySchema),
});
/** The studio's overview. */
export type StudioOverview = z.infer<typeof studioOverviewSchema>;

/**
 * The guide in one language: its block nodes and every reference it cites, in citation order (PED-002). Both are
 * empty while the guide is not written yet; the page then shows the phase matrix and the catalogue alone.
 * @spec PED-002
 */
export const guideSchema = z.strictObject({
  locale: localeSchema,
  status: contentReviewStatusSchema,
  nodes: z
    .array(guideBlockNodeSchema)
    .describe('The guide’s blocks; empty while no guide is written yet (content/laeringsdesign/guide.*.md).'),
  references: z.array(referenceSchema),
});
/** The guide in one language. */
export type Guide = z.infer<typeof guideSchema>;

/** Path parameters of `GET /api/studio/guide/:locale`: the guide's language. */
export const guideParamsSchema = z.strictObject({ locale: localeSchema });
/** The path parameters of the guide route. */
export type GuideParams = z.infer<typeof guideParamsSchema>;
