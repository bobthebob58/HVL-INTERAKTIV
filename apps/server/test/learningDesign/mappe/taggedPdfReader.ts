/**
 * taggedPdfReader — reads what an accessibility checker looks at in a PDF, with pdf.js (pdfjs-dist 6.4.299).
 *
 * Why: MAPPE-004 is verified by reading the PDF back: a structure tree, an outline, the document language, a title
 *      and real text. pdf.js exposes each of them (the catalog's /Lang as `info.Language`, the ViewerPreferences as
 *      a map, fonts through the operator list), so the probe needs no PDF parser of its own.
 * Spec: MAPPE-004
 * Invariants:
 *   - Reads only; the PDF bytes are copied, so the caller's buffer is never detached by pdf.js.
 *   - The loading task is destroyed after reading, so no fake worker stays alive between tests.
 * Collaborators: pdfjs-dist/legacy/build/pdf.mjs (the build for Node, with its fake worker).
 * Tests: apps/server/test/learningDesign/mappe/taggedPdf.browser.test.ts
 */
import {
  getDocument,
  OPS,
  VerbosityLevel,
  type PDFDocumentProxy,
  type PDFPageProxy,
} from 'pdfjs-dist/legacy/build/pdf.mjs';

/** One outline (bookmark) entry and its children, with the 1-based page it points at. */
export interface OutlineEntry {
  readonly title: string;
  readonly page: number;
  readonly items: readonly OutlineEntry[];
}

/** A font as the PDF stores it. */
export interface PdfFont {
  /** The BaseFont name; a six-letter tag and `+` mark an embedded subset. */
  readonly name: string;
  /** False when the PDF only names the font and a reader must substitute it. */
  readonly embedded: boolean;
}

/** What the probe reads from a PDF. */
export interface TaggedPdfFacts {
  readonly pages: number;
  /** The info dictionary's Title. */
  readonly title: unknown;
  /** The catalog's /Lang. */
  readonly language: unknown;
  /** MarkInfo /Marked: the PDF declares itself tagged. */
  readonly marked: boolean;
  /** ViewerPreferences /DisplayDocTitle (PDF/UA wants true). */
  readonly displayDocTitle: unknown;
  /** Whether an XMP metadata stream exists (it carries the PDF/UA identifier). */
  readonly hasXmpMetadata: boolean;
  readonly outline: readonly OutlineEntry[];
  /** Page 1's structure tree as `Role(children…)`, with NonStruct wrappers and content leaves left out. */
  readonly structure: string;
  /** The `lang` pdf.js reports on page 1's structure elements. */
  readonly structureLanguages: readonly string[];
  /** Scopes of the table header cells, in document order. */
  readonly headerScopes: readonly string[];
  /** How many header cells each data cell names in its /Headers. */
  readonly dataCellHeaderCounts: readonly number[];
  /** Every page's text items in reading order. */
  readonly textItems: readonly string[];
  /** Images painted on any page. */
  readonly imageCount: number;
  readonly fonts: readonly PdfFont[];
  /** Fonts that draw a text item holding æ, ø, å, Æ, Ø or Å. */
  readonly norwegianLetterFonts: readonly string[];
  /** Link annotation targets on every page. */
  readonly linkUrls: readonly string[];
}

interface StructNode {
  role?: string;
  lang?: string;
  scope?: string;
  headers?: string[];
  children?: StructNode[];
}

/** Summarises a structure node: wrappers (NonStruct) collapse into their children; content leaves vanish. */
function summarise(
  node: StructNode,
  facts: { langs: string[]; scopes: string[]; headers: number[] },
): string[] {
  const children = (node.children ?? []).flatMap((child) => summarise(child, facts));
  if (!node.role || node.role === 'NonStruct' || node.role === 'Root') return children;
  if (node.lang) facts.langs.push(node.lang);
  if (node.role === 'TH') facts.scopes.push(node.scope ?? 'none');
  if (node.role === 'TD') facts.headers.push(node.headers?.length ?? 0);
  return [children.length ? `${node.role}(${children.join(' ')})` : node.role];
}

/** Resolves an outline destination to its 1-based page number. */
async function pageOf(doc: PDFDocumentProxy, dest: string | unknown[] | null): Promise<number> {
  const explicit = typeof dest === 'string' ? await doc.getDestination(dest) : dest;
  const ref = explicit?.[0] as Parameters<PDFDocumentProxy['getPageIndex']>[0] | undefined;
  return ref ? (await doc.getPageIndex(ref)) + 1 : 0;
}

type RawOutline = Awaited<ReturnType<PDFDocumentProxy['getOutline']>>;

/** Maps pdf.js outline items to {@link OutlineEntry} trees. */
async function outlineOf(doc: PDFDocumentProxy, items: RawOutline | null): Promise<OutlineEntry[]> {
  return Promise.all(
    (items ?? []).map(async (item) => ({
      title: item.title,
      page: await pageOf(doc, item.dest),
      items: await outlineOf(doc, item.items as RawOutline),
    })),
  );
}

/** Reads one page's text, fonts, images and links into the accumulators. */
async function readPage(
  page: PDFPageProxy,
  into: {
    text: string[];
    fonts: Map<string, PdfFont>;
    letters: Set<string>;
    images: number;
    links: string[];
  },
): Promise<void> {
  const operators = await page.getOperatorList();
  const fontIds = new Set<string>();
  operators.fnArray.forEach((fn, index) => {
    if (fn === OPS.setFont) fontIds.add(String((operators.argsArray[index] as unknown[])[0]));
    if (fn === OPS.paintImageXObject || fn === OPS.paintInlineImageXObject) into.images += 1;
  });
  const names = new Map<string, string>();
  for (const id of fontIds) {
    // WHY: with fontExtraProperties the font object keeps its PDF name and whether the file was missing.
    const font = page.commonObjs.get(id) as { name: string; missingFile: boolean };
    names.set(id, font.name);
    into.fonts.set(font.name, { name: font.name, embedded: !font.missingFile });
  }
  for (const item of (await page.getTextContent()).items) {
    if (!('str' in item) || item.str.trim() === '') continue;
    into.text.push(item.str);
    if (/[æøåÆØÅ]/.test(item.str)) into.letters.add(names.get(item.fontName) ?? item.fontName);
  }
  for (const annotation of (await page.getAnnotations()) as { subtype: string; url?: string }[]) {
    if (annotation.subtype === 'Link' && annotation.url) into.links.push(annotation.url);
  }
}

/**
 * Reads the accessibility facts of a PDF.
 * @param pdf - The PDF file.
 * @returns The facts; see {@link TaggedPdfFacts}.
 */
export async function readTaggedPdf(pdf: Uint8Array): Promise<TaggedPdfFacts> {
  const task = getDocument({
    data: new Uint8Array(pdf),
    fontExtraProperties: true,
    // WHY: pdf.js prints warnings (such as Chromium's non-standard /Type in ViewerPreferences) to the test output.
    verbosity: VerbosityLevel.ERRORS,
  });
  try {
    const doc = await task.promise;
    const { info, metadata } = await doc.getMetadata();
    const fields = info as Record<string, unknown>;
    const preferences = await doc.getViewerPreferences();
    const facts = { langs: [] as string[], scopes: [] as string[], headers: [] as number[] };
    const first = await doc.getPage(1);
    const structure = summarise(((await first.getStructTree()) ?? {}) as StructNode, facts).join(' ');
    const into = {
      text: [] as string[],
      fonts: new Map<string, PdfFont>(),
      letters: new Set<string>(),
      images: 0,
      links: [] as string[],
    };
    for (let number = 1; number <= doc.numPages; number += 1) await readPage(await doc.getPage(number), into);
    return {
      pages: doc.numPages,
      title: fields.Title,
      language: fields.Language,
      // WHY: pdf.js 6.4.299 types getMarkInfo() as an object, but its worker builds a Map (Catalog#readMarkInfo).
      marked: ((await doc.getMarkInfo()) as unknown as Map<string, unknown> | null)?.get('Marked') === true,
      displayDocTitle: preferences?.get('DisplayDocTitle'),
      hasXmpMetadata: Boolean(metadata),
      outline: await outlineOf(doc, await doc.getOutline()),
      structure,
      structureLanguages: facts.langs,
      headerScopes: facts.scopes,
      dataCellHeaderCounts: facts.headers,
      textItems: into.text,
      imageCount: into.images,
      fonts: [...into.fonts.values()],
      norwegianLetterFonts: [...into.letters],
      linkUrls: into.links,
    };
  } finally {
    await task.destroy();
  }
}
