/**
 * referencesContent — loads `content/laeringsdesign/references.yaml`, the full references the guide and the patterns
 * cite as `[@key]`, and checks that cited keys exist.
 *
 * Why: every factual claim on the guide page has a reference (PED-002), and a pattern's "why it works" cites the
 *      research too (PED-010). One file of references keeps each written once and lets ALU check them in one place
 *      (D-082); `verify: true` marks a reference ALU has not checked yet (Q17).
 * Spec: PED-001, PED-002
 * Invariants:
 *   - A key is lower-case letters, digits and hyphens, starts with a letter or digit, at most 64 characters
 *     (e.g. `guo2014`); a key is listed once.
 *   - `text` is the full reference as one line of plain text (no Markdown), at most 600 characters; `verify` is
 *     required, so a reference is never marked checked by omission.
 *   - The returned list keeps the file's order and matches `Reference` in `@hvl-interaktiv/api-contract`.
 * Collaborators: ./yamlContentFile.ts, ./contentText.ts, ./loadStudioContent.ts; the guide and pattern loaders use
 *   `unresolvedCitationProblems`; content/laeringsdesign/README.md (the guide for ALU).
 * Tests: apps/server/test/learningDesign/content/referencesContent.test.ts
 */
import { join } from 'node:path';
import { z } from 'zod';
import type { ContentProblem } from './contentProblem.js';
import { contentText } from './contentText.js';
import { readYamlContentFile, type ContentLoadResult } from './yamlContentFile.js';

/** The file, relative to the content folder. */
export const REFERENCES_FILE = 'laeringsdesign/references.yaml';

/** The form of a reference key, e.g. `guo2014` or `mogelvang2025`. */
export const REFERENCE_KEY_PATTERN = /^[a-z0-9][a-z0-9-]{0,63}$/;

/** One full reference. */
export interface StudioReference {
  /** The key cited as `[@key]`. */
  readonly key: string;
  /** The full reference in APA style, as plain text. */
  readonly text: string;
  /** True until ALU has checked the reference against the source (Q17). */
  readonly verify: boolean;
}

/** The loaded references.yaml. */
export interface ReferencesContent {
  readonly version: 1;
  /** Every reference once, in the file's order. */
  readonly references: readonly StudioReference[];
}

const referenceKey = z
  .string()
  .regex(
    REFERENCE_KEY_PATTERN,
    'is not a reference key: use lower-case letters, digits and hyphens, like guo2014',
  );

/** The schema of references.yaml. */
export const referencesFileSchema: z.ZodType<ReferencesContent> = z.strictObject({
  version: z.literal(1),
  references: z
    .record(referenceKey, z.strictObject({ text: contentText({ maxLength: 600 }), verify: z.boolean() }))
    .refine((references) => Object.keys(references).length > 0, 'lists no references')
    .transform((references) => Object.entries(references).map(([key, entry]) => ({ key, ...entry }))),
});

/**
 * Loads and checks references.yaml.
 * @param root - The content folder (the repository's `content/`, or a test fixture).
 * @returns The frozen references, or every problem, each naming the file, the line and the key.
 * @spec PED-002
 */
export function loadReferencesContent(root: string): ContentLoadResult<ReferencesContent> {
  return readYamlContentFile(join(root, REFERENCES_FILE), referencesFileSchema);
}

/**
 * Finds one reference by key.
 * @param content - The loaded references.
 * @param key - The cited key.
 * @returns The reference, or undefined when the file does not list the key.
 */
export function findReference(content: ReferencesContent, key: string): StudioReference | undefined {
  return content.references.find((reference) => reference.key === key);
}

/** One `[@key]` citation found in a content file. */
export interface ContentCitation {
  readonly key: string;
  /** The 1-based line of the citation, when known. */
  readonly line?: number;
}

/**
 * Checks that every cited key is in references.yaml (D-082), for the guide and pattern loaders.
 * @param content - The loaded references, or undefined when references.yaml itself failed (already reported).
 * @param file - The display path of the citing file.
 * @param citations - The citations in the citing file.
 * @returns One problem per citation of an unknown key; none when `content` is undefined.
 * @spec PED-002
 */
export function unresolvedCitationProblems(
  content: ReferencesContent | undefined,
  file: string,
  citations: readonly ContentCitation[],
): ContentProblem[] {
  if (!content) return [];
  return citations
    .filter(({ key }) => !findReference(content, key))
    .map(({ key, line }) => ({
      file,
      line,
      message: `cites [@${key}], but references.yaml has no reference with that key`,
    }));
}
