/**
 * patternYaml — the schema of a pattern's `pattern.yaml`: what the pattern is for (in nn, nb and en), its phases
 * and content types, its times, and the texts its skeleton's `{{token}}`s are filled with.
 *
 * Why: ALU writes patterns without code (PED-011, D-084). PED-010 lists the fields; a strict schema refuses a
 *      misspelt key or a missing language by name and line, as every other content file does (D-082).
 * Spec: PED-010, PED-011
 * Invariants:
 *   - `id` has the contract's pattern ID form; the loader checks that it equals the folder's name.
 *   - `phases` are one or two phase keys, each once, returned in content order (forarbeid, underveis,
 *     etterarbeid); the first is the default when creating. `contentTypes` are one or two of the ten, each once, in
 *     the file's order (the order of the skeleton files).
 *   - Every text has nn, nb and en. `name` and `purpose` are one line; `whenToUse`, `example` and `whyItWorks` may
 *     have line breaks (`whyItWorks` cites research as `[@key]`). A token text is one line of plain text with no
 *     `{{` or `}}`.
 *   - `buildMinutes` and `studentMinutes` are whole minutes from 1 to 600.
 * Collaborators: ./contentText.ts, ./patternFolder.ts (reads the file), @hvl-interaktiv/api-contract,
 *   ../patterns/skeletonTokens.ts (`TOKEN_NAME`); content/laeringsdesign/README.md (the guide for ALU).
 * Tests: apps/server/test/learningDesign/content/patternContent.test.ts
 */
import {
  AUTHORABLE_CONTENT_TYPES,
  PHASE_KEYS,
  patternIdSchema,
  type AuthorableContentType,
  type PhaseKey,
} from '@hvl-interaktiv/api-contract';
import { z } from 'zod';
import { TOKEN_NAME } from '../patterns/skeletonTokens.js';
import { localisedContentText, type LocalisedText } from './contentText.js';

/** The longest skeleton text a pattern gives a token (its field may allow less; the content check says). */
export const TOKEN_TEXT_MAX_LENGTH = 1000;

/** A loaded pattern.yaml. */
export interface PatternFile {
  /** The pattern ID, the folder's name, e.g. `fa-video`. */
  readonly id: string;
  /** One or two phases, in content order. */
  readonly phases: readonly PhaseKey[];
  /** One or two content types, in the file's order. */
  readonly contentTypes: readonly AuthorableContentType[];
  readonly name: LocalisedText;
  /** One line on what the pattern does. */
  readonly purpose: LocalisedText;
  readonly whenToUse: LocalisedText;
  readonly example: LocalisedText;
  /** Why it works, in Markdown, citing research as `[@key]`. */
  readonly whyItWorks: LocalisedText;
  readonly buildMinutes: number;
  readonly studentMinutes: number;
  /** Token name → its text in nn, nb and en. */
  readonly texts: Readonly<Record<string, LocalisedText>>;
}

const distinct = (list: readonly string[]) => new Set(list).size === list.length;

const phaseKey = z.enum(PHASE_KEYS, {
  error: (issue) =>
    issue.input === undefined
      ? undefined
      : `"${String(issue.input)}" is not a phase key; use ${PHASE_KEYS.join(', ')}`,
});

const contentType = z.enum(AUTHORABLE_CONTENT_TYPES, {
  error: (issue) =>
    issue.input === undefined
      ? undefined
      : `"${String(issue.input)}" is not one of the ten content types (e.g. H5P.Blanks)`,
});

const minutes = z
  .int('must be a whole number of minutes')
  .min(1, 'must be at least 1 minute')
  .max(600, 'must be at most 600 minutes');

const tokenText = localisedContentText({ maxLength: TOKEN_TEXT_MAX_LENGTH });

/** The schema of pattern.yaml. */
export const patternFileSchema: z.ZodType<PatternFile> = z.strictObject({
  id: z
    .string()
    .refine(
      (id) => patternIdSchema.safeParse(id).success,
      'is not a pattern ID: lower-case letters, digits and hyphens, starting with a letter (e.g. fa-video)',
    ),
  phases: z
    .array(phaseKey)
    .min(1, 'lists no phase')
    .max(2, 'lists more than two phases')
    .refine(distinct, 'lists a phase twice')
    .transform((keys) => PHASE_KEYS.filter((key) => keys.includes(key))),
  contentTypes: z
    .array(contentType)
    .min(1, 'lists no content type')
    .max(2, 'lists more than two content types')
    .refine(distinct, 'lists a content type twice'),
  name: localisedContentText({ maxLength: 80 }),
  purpose: localisedContentText({ maxLength: 200 }),
  whenToUse: localisedContentText({ maxLength: 600, singleLine: false }),
  example: localisedContentText({ maxLength: 600, singleLine: false }),
  whyItWorks: localisedContentText({ maxLength: 2000, singleLine: false }),
  buildMinutes: minutes,
  studentMinutes: minutes,
  texts: z.record(
    z.string().regex(TOKEN_NAME, 'is not a token name: a letter, then letters, digits or hyphens'),
    tokenText.refine(
      // WHY: one pass fills the tokens (../patterns/skeletonTokens.ts), so `{{x}}` in a text would reach authors as is.
      (text) => !Object.values(text).some((value) => /\{\{|\}\}/.test(value)),
      'holds {{ or }}; a text is filled into the skeleton as it is and cannot hold a token',
    ),
  ),
});
