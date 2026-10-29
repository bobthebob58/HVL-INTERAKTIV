/**
 * patternFolder — loads one pattern folder, `content/laeringsdesign/patterns/<id>/`: its `pattern.yaml`, one
 * skeleton per content type, and every check between them.
 *
 * Why: a pattern is files ALU adds without code (PED-011, D-084). Everything that would make a pattern fail later
 *      (a token without a text, a library the editor would refuse, a text Lumi would cut, a citation of nothing)
 *      is found here, with the file and the key, before the server starts (D-082).
 * Spec: PED-010, PED-011
 * Invariants:
 *   - The folder holds exactly `pattern.yaml` and its skeleton files (./skeletonFile.ts `skeletonFileName`); any
 *     other file is a problem, except files whose names start with a dot (an editor's or the system's own).
 *   - `id` equals the folder's name; each skeleton's library is the content type its file is for.
 *   - The library checks run only when the caller passes the installed libraries (`content:check`); the server's
 *     start-up does not, and a pattern whose library is missing is then shown as unavailable (D-085).
 *   - Nothing is returned when any file has a problem.
 * Collaborators: ./patternContent.ts (the caller), ./contentSource.ts, ./patternYaml.ts, ./skeletonFile.ts,
 *   ./patternTokenChecks.ts, ./patternCitations.ts, ./patternProse.ts ("why it works" builds into the guide's
 *   prose nodes, D-083), ./skeletonLibraryChecks.ts, ./studioContentContext.ts.
 * Tests: apps/server/test/learningDesign/content/patternContent.test.ts,
 *   apps/server/test/learningDesign/content/patternLibraryChecks.test.ts
 */
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import type { AuthorableContentType } from '@hvl-interaktiv/api-contract';
import { contentDisplayPath, type ContentProblem } from './contentProblem.js';
import { problemAt, readContentSource, type ContentSource } from './contentSource.js';
import { citedReferenceKeys, patternCitationProblems } from './patternCitations.js';
import { patternProseProblems } from './patternProse.js';
import { patternTokenProblems } from './patternTokenChecks.js';
import { patternFileSchema, type PatternFile } from './patternYaml.js';
import { skeletonFileName, skeletonFileSchema, type SkeletonFile } from './skeletonFile.js';
import { skeletonLibraryProblems } from './skeletonLibraryChecks.js';
import type { StudioContentContext } from './studioContentContext.js';
import { contentLoadFailed, type ContentLoadResult } from './yamlContentFile.js';

/** The pattern folders, relative to the content folder. */
export const PATTERNS_DIR = 'laeringsdesign/patterns';

/** One skeleton of a loaded pattern. */
export interface StudioPatternSkeleton extends SkeletonFile {
  /** The content type it creates. */
  readonly contentType: AuthorableContentType;
  /** Its file, relative to the repository root, for messages. */
  readonly file: string;
}

/** A loaded, checked pattern. */
export interface StudioPattern extends PatternFile {
  /** The reference keys `whyItWorks` cites, in citation order. */
  readonly citations: readonly string[];
  /** One skeleton per content type, in the order of `contentTypes`. */
  readonly skeletons: readonly StudioPatternSkeleton[];
}

function strayFiles(folder: string, pattern: PatternFile): ContentProblem[] {
  const expected = new Set([
    'pattern.yaml',
    ...pattern.contentTypes.map((type) => skeletonFileName(pattern.contentTypes, type)),
  ]);
  return readdirSync(folder)
    .filter((name) => !name.startsWith('.') && !expected.has(name))
    .map((name) => ({
      file: contentDisplayPath(join(folder, name)),
      message:
        'is not a file of this pattern: the folder holds pattern.yaml and skeleton.json, or, for a pattern with ' +
        `two content types, one skeleton.<content type>.json each (here: ${[...expected].join(', ')})`,
    }));
}

function readSkeletons(folder: string, pattern: PatternFile) {
  const problems: ContentProblem[] = [];
  const loaded: { type: AuthorableContentType; source: ContentSource<SkeletonFile> }[] = [];
  for (const type of pattern.contentTypes) {
    const file = join(folder, skeletonFileName(pattern.contentTypes, type));
    // WHY: ALU reads this message; "cannot read the file (ENOENT)" would not say which skeleton is expected.
    if (!existsSync(file)) {
      problems.push({
        file: contentDisplayPath(file),
        message: `is missing: pattern.yaml lists ${type} under contentTypes, so the folder needs this skeleton`,
      });
      continue;
    }
    const read = readContentSource(file, skeletonFileSchema, 'json');
    if (!read.ok) {
      problems.push(...read.problems);
      continue;
    }
    const machineName = read.value.library.split(' ')[0];
    if (machineName !== type)
      problems.push(
        problemAt(
          read,
          ['library'],
          `names ${read.value.library}, but this file is the ${type} ` +
            'skeleton; its library must be that content type',
        ),
      );
    loaded.push({ type, source: read });
  }
  return { loaded, problems };
}

/**
 * Loads and checks one pattern folder.
 * @param context - The content folder, the loaded references and (from `content:check`) the installed libraries.
 * @param folderName - The folder's name under `laeringsdesign/patterns/`, which is the pattern's ID.
 * @returns The pattern, or every problem in its files.
 * @spec PED-011
 */
export function loadPatternFolder(
  context: StudioContentContext,
  folderName: string,
): ContentLoadResult<StudioPattern> {
  const folder = join(context.root, ...PATTERNS_DIR.split('/'), folderName);
  const pattern = readContentSource(join(folder, 'pattern.yaml'), patternFileSchema, 'yaml');
  if (!pattern.ok) return contentLoadFailed(pattern.problems);
  const problems: ContentProblem[] = [...strayFiles(folder, pattern.value)];
  if (pattern.value.id !== folderName)
    problems.push(
      problemAt(
        pattern,
        ['id'],
        `is "${pattern.value.id}", but the folder is called ` + `"${folderName}"; they must be the same`,
      ),
    );
  const skeletons = readSkeletons(folder, pattern.value);
  problems.push(
    ...skeletons.problems,
    ...patternCitationProblems(pattern, context.references),
    ...patternProseProblems(pattern),
  );
  const sources = skeletons.loaded.map(({ source }) => source);
  if (skeletons.problems.length === 0) problems.push(...patternTokenProblems(pattern, sources));
  const libraries = context.installedLibraries;
  if (libraries?.kind === 'installed' && skeletons.problems.length === 0) {
    for (const source of sources)
      problems.push(...skeletonLibraryProblems(source, pattern.value.texts, libraries.catalogue));
  }
  if (problems.length > 0) return contentLoadFailed(problems);
  return {
    ok: true,
    value: {
      ...pattern.value,
      citations: citedReferenceKeys(pattern.value.whyItWorks),
      skeletons: skeletons.loaded.map(({ type, source }) => ({
        ...source.value,
        contentType: type,
        file: source.file,
      })),
    },
  };
}
