/**
 * h5pTextsContent — the H5P texts' part of the content: loads `content/h5p-tekstar/` (HVL's Nynorsk and Bokmål texts
 * for the H5P libraries and `H5P-010`'s video guidance), checks it and builds the language overlay the engine uses.
 *
 * Why: the texts are ALU's to edit without code (D-111, D-082). The server's start-up loads them with the rest of
 *      `content/` and refuses a broken file; `npm run content:check` also checks them against the installed
 *      libraries; and the H5P engine gets the overlay built here (../../h5p/createH5pRuntime.ts).
 * Spec: H5P-008, H5P-010
 * Invariants:
 *   - The folder is optional until it is written: no file is "no texts" (the empty overlay); some but not all three
 *     files is a problem naming each missing one.
 *   - Every problem names the file and the line or key; nothing is returned when there is any problem.
 *   - The overlay's edits keep the files' order; the guidance adds a `description` edit for each video field in nn
 *     and nb, and gives its English text to the editor's semantics hook.
 * Collaborators: ./loadStudioContent.ts (calls it), ./runContentCheck.ts (the summary), ./h5pTextsYaml.ts,
 *   ./h5pTextsLibraryChecks.ts, ./contentSource.ts, ../../h5p/languageOverlay/languageOverlay.ts.
 * Tests: apps/server/test/learningDesign/content/h5pTextsContent.test.ts
 */
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import {
  EMPTY_LANGUAGE_OVERLAY,
  OVERLAY_LANGUAGES,
  type LanguageOverlay,
  type OverlayEdit,
  type OverlayLanguage,
} from '../../h5p/languageOverlay/languageOverlay.js';
import { contentDisplayPath, REPOSITORY_ROOT, type ContentProblem } from './contentProblem.js';
import { readContentSource, type ContentSource } from './contentSource.js';
import { deepFreeze } from './deepFreeze.js';
import { h5pTextsLibraryProblems } from './h5pTextsLibraryChecks.js';
import {
  libraryTextsSchema,
  videoGuidanceSchema,
  type LibraryTextsFile,
  type VideoGuidanceFile,
} from './h5pTextsYaml.js';
import { studioContentFile, type StudioContentContext } from './studioContentContext.js';
import { StudioContentError } from './StudioContentError.js';
import { contentLoadFailed, type ContentLoadResult } from './yamlContentFile.js';

/** The three files, relative to the content folder. */
export const H5P_TEXTS_FILES = {
  nn: 'h5p-tekstar/library-texts.nn.yaml',
  nb: 'h5p-tekstar/library-texts.nb.yaml',
  guidance: 'h5p-tekstar/video-guidance.yaml',
} as const;

/** The loaded H5P texts. */
export interface H5pTextsContent {
  /** What the engine lays over the libraries' language files; empty while the folder has no files. */
  readonly overlay: LanguageOverlay;
  /** Entries per language and guidance fields, with each file's status; undefined while there are no files. */
  readonly summary?: {
    readonly nn: number;
    readonly nb: number;
    readonly fields: number;
    readonly drafts: number;
  };
  /** Whether `content:check` compared the texts with the installed libraries. */
  readonly libraryCheck: 'checked' | 'libraries-missing' | 'not-requested';
}

type Edits = Record<string, Partial<Record<OverlayLanguage, OverlayEdit[]>>>;

const editsOf = (edits: Edits, library: string, language: OverlayLanguage): OverlayEdit[] => {
  const byLanguage = (edits[library] ??= {});
  return (byLanguage[language] ??= []);
};

function overlayOf(
  texts: Record<OverlayLanguage, LibraryTextsFile>,
  guidance: VideoGuidanceFile,
): LanguageOverlay {
  const edits: Edits = {};
  for (const language of OVERLAY_LANGUAGES) {
    for (const [library, section] of Object.entries(texts[language].libraries)) {
      const list = editsOf(edits, library, language);
      for (const [part, property] of [
        ['defaults', 'default'],
        ['labels', 'label'],
      ] as const)
        for (const [path, entry] of Object.entries(section[part] ?? {}))
          list.push({ kind: 'field', property, path, text: entry[language] ?? '', english: entry.en });
      for (const [key, entry] of Object.entries(section.libraryStrings ?? {}))
        list.push({ kind: 'libraryString', key, text: entry[language] ?? '', english: entry.en });
    }
    for (const { library, field } of guidance.fields)
      editsOf(edits, library, language).push({
        kind: 'field',
        property: 'description',
        path: field,
        text: guidance.description[language],
      });
  }
  const fields = guidance.fields.map(({ library, field }) => ({ library, path: field }));
  return { edits, videoGuidance: { fields, english: guidance.description.en } };
}

const countOf = (file: LibraryTextsFile) =>
  Object.values(file.libraries).reduce(
    (sum, section) =>
      sum +
      [section.defaults, section.labels, section.libraryStrings].reduce(
        (part, entries) => part + Object.keys(entries ?? {}).length,
        0,
      ),
    0,
  );

/**
 * Loads and checks `content/h5p-tekstar/`.
 * @param context - The content folder and (from `content:check`) the installed libraries.
 * @returns The overlay and its summary, or every problem in the three files.
 * @spec H5P-008
 */
export function loadH5pTextsContent(context: StudioContentContext): ContentLoadResult<H5pTextsContent> {
  const libraries = context.installedLibraries;
  const libraryCheck =
    libraries === undefined
      ? 'not-requested'
      : libraries.kind === 'installed'
        ? 'checked'
        : 'libraries-missing';
  const paths = Object.values(H5P_TEXTS_FILES).map((file) => studioContentFile(context, file));
  const missing = paths.filter((path) => !existsSync(path));
  if (missing.length === paths.length)
    return { ok: true, value: { overlay: EMPTY_LANGUAGE_OVERLAY, libraryCheck } };
  const problems: ContentProblem[] = missing.map((path) => ({
    file: contentDisplayPath(path),
    message:
      'is missing: the H5P texts need library-texts.nn.yaml, library-texts.nb.yaml and video-guidance.yaml',
  }));
  if (problems.length > 0) return contentLoadFailed(problems);
  const nn = readContentSource(
    studioContentFile(context, H5P_TEXTS_FILES.nn),
    libraryTextsSchema('nn'),
    'yaml',
  );
  const nb = readContentSource(
    studioContentFile(context, H5P_TEXTS_FILES.nb),
    libraryTextsSchema('nb'),
    'yaml',
  );
  const guidance = readContentSource(
    studioContentFile(context, H5P_TEXTS_FILES.guidance),
    videoGuidanceSchema,
    'yaml',
  );
  for (const loaded of [nn, nb, guidance]) if (!loaded.ok) problems.push(...loaded.problems);
  if (!nn.ok || !nb.ok || !guidance.ok) return contentLoadFailed(problems);
  const texts = [nn, nb] as ContentSource<LibraryTextsFile>[];
  if (libraries?.kind === 'installed')
    problems.push(...h5pTextsLibraryProblems({ libraryTexts: texts, guidance }, libraries.catalogue));
  if (problems.length > 0) return contentLoadFailed(problems);
  const overlay = overlayOf(
    { nn: nn.value as LibraryTextsFile, nb: nb.value as LibraryTextsFile },
    guidance.value,
  );
  const drafts = [nn.value, nb.value, guidance.value].filter((file) => file.status === 'draft').length;
  const summary = {
    nn: countOf(nn.value),
    nb: countOf(nb.value),
    fields: guidance.value.fields.length,
    drafts,
  };
  return { ok: true, value: deepFreeze({ overlay, summary, libraryCheck }) };
}

/**
 * This section's part of the one-line `npm run content:check` summary.
 * @param content - The loaded H5P texts.
 * @returns e.g. `H5P texts: 80 in nn, 85 in nb, video guidance on 2 fields (draft)`, or `no H5P texts yet`.
 * @spec H5P-008
 */
export function describeH5pTextsContent(content: H5pTextsContent): string {
  const { summary } = content;
  if (!summary) return 'no H5P texts yet';
  const status = summary.drafts > 0 ? ' (draft)' : '';
  const text = `H5P texts: ${summary.nn} in nn, ${summary.nb} in nb, video guidance on ${summary.fields} fields${status}`;
  return content.libraryCheck === 'libraries-missing'
    ? `${text} (not checked against the libraries: run npm run h5p:fetch-libraries)`
    : text;
}

/**
 * Loads only the language overlay, for an engine built without the start-up's content (the seed command, tests).
 * @param root - The content folder; the repository's `content/` by default.
 * @returns The overlay (empty while the folder has no files).
 * @throws StudioContentError listing every problem in the three files.
 * @spec H5P-008
 */
export function loadLanguageOverlay(root: string = join(REPOSITORY_ROOT, 'content')): LanguageOverlay {
  const loaded = loadH5pTextsContent({ root: resolve(root), phases: undefined, references: undefined });
  if (!loaded.ok) throw new StudioContentError(loaded.problems);
  return loaded.value.overlay;
}
