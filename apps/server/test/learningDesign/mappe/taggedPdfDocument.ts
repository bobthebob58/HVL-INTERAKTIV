/**
 * taggedPdfDocument — the semantic HTML documents the MAPPE-004 tagged-PDF probe prints with Chromium.
 *
 * Why: D-096 renders the pedagogisk mappe as Markdown → semantic HTML → Chromium `page.pdf({ tagged, outline })`.
 *      The probe needs HTML shaped like that output (language, title, three heading levels, paragraphs, both list
 *      kinds, a table with header scopes, a link, and æøå ÆØÅ) to learn what Chromium turns it into.
 * Spec: MAPPE-004
 * Invariants:
 *   - Every document is self-contained: no script the PDF depends on, no remote file it needs. The isolation document
 *     is the one exception, and it exists to show that remote requests and scripts are blocked.
 *   - Every paragraph fits on one line of A4, so pdf.js returns each one as a single text item.
 * Collaborators: the HVL font stacks of packages/design-tokens/tokens.json (`font.ui` and `font.body`).
 * Tests: apps/server/test/learningDesign/mappe/taggedPdf.browser.test.ts
 */

/** The `<title>` of the portfolio document, which must become the PDF's info Title. */
export const PORTFOLIO_TITLE = 'Pedagogisk mappe – Ærleg øving i Åsane';

// WHY: the HVL token stacks (font.ui for headings, font.body for text), so the probe embeds the fonts the real
// mappe export asks for; the container's fontconfig picks the substitutes (Arial → Liberation Sans, for example).
const STYLE = `body { font-family: Georgia, "Times New Roman", serif; line-height: 1.5; text-align: left; }
h1, h2, h3, th, caption { font-family: Arial, "Helvetica Neue", Helvetica, sans-serif; }`;

/** Lines of text the PDF must hold as real text, in reading order (æøå ÆØÅ included). */
export const PORTFOLIO_TEXTS = [
  'Pedagogisk mappe',
  'Søknad om merittering frå Høgskulen på Vestlandet: ÆØÅ æøå.',
  'Del 1: Refleksjon over eiga undervisning',
  'Eg har utvikla læringsaktivitetar for førebuing og etterarbeid.',
  'Forarbeid i Canvas',
  'Øving i klasserommet',
  'Studentaktiv læring',
  'Først ein quiz',
  'Så ein refleksjon',
  'Aktivitetar i emnet',
  'Blåbærquiz',
  'Førebuing',
  'hvl.no',
  'Del 2: Vedlegg',
  'Åtte vedlegg følgjer.',
] as const;

/** The portfolio document: one page of everything the mappe export renders. */
export const PORTFOLIO_HTML = `<!DOCTYPE html>
<html lang="nn">
<head><meta charset="utf-8"><title>${PORTFOLIO_TITLE}</title><style>${STYLE}</style></head>
<body>
<h1>Pedagogisk mappe</h1>
<p>Søknad om merittering frå Høgskulen på Vestlandet: ÆØÅ æøå.</p>
<h2>Del 1: Refleksjon over eiga undervisning</h2>
<p>Eg har utvikla læringsaktivitetar for førebuing og etterarbeid.</p>
<ul><li>Forarbeid i Canvas</li><li>Øving i klasserommet</li></ul>
<h3>Studentaktiv læring</h3>
<ol><li>Først ein quiz</li><li>Så ein refleksjon</li></ol>
<table>
<caption>Aktivitetar i emnet</caption>
<thead><tr><th scope="col">Tittel</th><th scope="col">Fase</th></tr></thead>
<tbody><tr><th scope="row">Blåbærquiz</th><td>Førebuing</td></tr></tbody>
</table>
<p>Les meir på <a href="https://www.hvl.no/">hvl.no</a>.</p>
<h2>Del 2: Vedlegg</h2>
<p>Åtte vedlegg følgjer.</p>
</body>
</html>`;

/** The number of pages {@link tenPageHtml} prints on A4. */
export const TEN_PAGES = 10;

/**
 * A portfolio of {@link TEN_PAGES} chapters, each ending in a page break, to time a realistic export.
 * @returns HTML whose chapter `n` (1-based) is an `<h2>` on PDF page `n`.
 */
export function tenPageHtml(): string {
  const sentence = 'Læringsdesign handlar om å planleggje før, under og etter undervisninga. ';
  const chapters = Array.from(
    { length: TEN_PAGES },
    (_, index) => `<section>
<h2>Kapittel ${index + 1}: Øving og etterarbeid</h2>
${`<p>${sentence.repeat(8)}</p>`.repeat(3)}
<ul><li>Æ for ærleg</li><li>Ø for øving</li><li>Å for årsak</li></ul>
</section>`,
  ).join('\n');
  return `<!DOCTYPE html>
<html lang="nn">
<head><meta charset="utf-8"><title>Ti sider</title>
<style>${STYLE} section { break-after: page; } section:last-of-type { break-after: auto; }</style></head>
<body><h1>Pedagogisk mappe</h1>
${chapters}
</body>
</html>`;
}

/** Remote files the isolation document asks for; the export context must abort each request. */
export const REMOTE_FILES = ['https://fonts.example.org/hvl.css', 'https://images.example.org/logo.png'];

/** Text a script in the isolation document would add if JavaScript ran. */
export const SCRIPT_MARKER = 'Skriptet køyrde';

/** A document that tries to load remote files and run a script, to show that the export context blocks both. */
export const ISOLATION_HTML = `<!DOCTYPE html>
<html lang="nn">
<head><meta charset="utf-8"><title>Isolasjon</title><link rel="stylesheet" href="${REMOTE_FILES[0]}"></head>
<body>
<h1>Isolasjon</h1>
<p>Berre denne teksten.</p>
<img src="${REMOTE_FILES[1]}" alt="">
<script>document.body.append(${JSON.stringify(SCRIPT_MARKER)});</script>
</body>
</html>`;
