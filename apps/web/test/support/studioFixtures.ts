/**
 * studioFixtures — the studio answers the web tests give the guide and pattern pages: an overview with three phases
 * and four patterns, a guide that uses every node type, and one pattern's detail. Test data, not ALU's content.
 *
 * Why: the real guide and patterns are ALU's texts and change (D-082), so the page tests never assert them; these
 *      fixtures exercise every node, phase, filter and state with texts the tests own (PED-002, PED-003, PED-010).
 * Spec: NFR-004, PED-002, PED-003
 * Invariants:
 *   - The answers have the contract's shapes (`StudioOverview`, `Guide`, `PatternDetail`).
 *   - `fixture-quiz` is unavailable; the others can be created. Build times are 15, 30, 45 and 60 minutes.
 * Collaborators: apps/web/test/features/GuideView.test.tsx, PatternCatalogue.test.tsx, PhaseMatrix.test.tsx,
 *   PatternDetailView.test.tsx, studioPages.test.tsx.
 * Tests: these fixtures are test input.
 */
import type { Guide, PatternDetail, PatternSummary, StudioOverview } from '@hvl-interaktiv/api-contract';

const text = (nn: string) => ({ nn, nb: `${nn} (nb)`, en: `${nn} (en)` });
const words = (value: string) => [{ type: 'text' as const, value }];

const phase = (key: 'forarbeid' | 'underveis' | 'etterarbeid', order: number, label: string) => ({
  key,
  order,
  label: text(label),
  description: text(`Kva ${label} er.`),
  purpose: text(`Føremålet med ${label}.`),
  canvasPlacement: text(`${label} i Canvas.`),
});

const card = (
  id: string,
  phases: PatternSummary['phases'],
  contentTypes: PatternSummary['contentTypes'],
  buildMinutes: number,
  available = true,
): PatternSummary => ({
  id,
  phases,
  contentTypes,
  name: text(`Mønster ${id}`),
  purpose: text(`Føremål ${id}.`),
  buildMinutes,
  available,
});

/** An overview with three phases and four patterns. */
export const OVERVIEW: StudioOverview = {
  status: 'proposed',
  anchor: { label: text('Samlinga'), description: text('Økta der alle møtest.') },
  phases: [phase('forarbeid', 1, 'Før'), phase('underveis', 2, 'Mellom'), phase('etterarbeid', 3, 'Etter')],
  patterns: [
    card('fixture-video', ['forarbeid'], ['H5P.InteractiveVideo'], 30),
    card('fixture-case', ['underveis'], ['H5P.BranchingScenario'], 60),
    card('fixture-terms', ['etterarbeid'], ['H5P.DragText', 'H5P.Blanks'], 15),
    card('fixture-quiz', ['forarbeid', 'etterarbeid'], ['H5P.QuestionSet'], 45, false),
  ],
};

/** A guide in Nynorsk with every node type: headings, emphasis, links, citations, lists, a box and both markers. */
export const GUIDE: Guide = {
  locale: 'nn',
  status: 'proposed',
  nodes: [
    { type: 'heading', level: 2, children: words('Første del') },
    {
      type: 'paragraph',
      children: [
        ...words('Tekst med '),
        { type: 'strong', children: words('vekt') },
        ...words(' og '),
        { type: 'emphasis', children: words('trykk') },
        ...words(' '),
        { type: 'citation', key: 'ref-a' },
        ...words(' og '),
        { type: 'link', href: 'https://www.hvl.no/alu', children: words('ALU') },
        ...words(' og '),
        { type: 'link', href: '/laeringsdesign/monster/fixture-video', children: words('eit mønster') },
        ...words('.'),
      ],
    },
    {
      type: 'box',
      children: [
        { type: 'paragraph', children: [...words('Boksen '), { type: 'citation', key: 'ref-b' }] },
        {
          type: 'list',
          ordered: false,
          items: [{ type: 'listItem', children: [{ type: 'paragraph', children: words('Punkt i boksen') }] }],
        },
      ],
    },
    { type: 'marker', name: 'phase-matrix' },
    { type: 'heading', level: 3, children: words('Andre del') },
    {
      type: 'list',
      ordered: true,
      items: [
        { type: 'listItem', children: [{ type: 'paragraph', children: words('Steg ein') }] },
        { type: 'listItem', children: [{ type: 'paragraph', children: words('Steg to') }] },
      ],
    },
    { type: 'marker', name: 'pattern-catalogue' },
  ],
  references: [
    { key: 'ref-a', text: 'Forfattar, A. (2026). Den første kjelda.', verify: true, language: 'nn' },
    { key: 'ref-b', text: 'Author, B. (2026). The second source.', verify: false, language: 'en' },
  ],
};

/** The guide before it is written: no nodes, no references. */
export const NO_GUIDE: Guide = { locale: 'nn', status: 'proposed', nodes: [], references: [] };

/** The detail of a pattern with two phases and two content types. */
export const DETAIL: PatternDetail = {
  ...card('fixture-terms', ['forarbeid', 'etterarbeid'], ['H5P.DragText', 'H5P.Blanks'], 15),
  whenToUse: text('Når omgrepa er nye.'),
  whyItWorks: {
    nn: [
      {
        type: 'paragraph',
        children: [...words('Henting styrkjer minnet '), { type: 'citation', key: 'ref-a' }],
      },
    ],
    nb: [{ type: 'paragraph', children: words('Henting styrker hukommelsen') }],
    en: [{ type: 'paragraph', children: words('Retrieval strengthens memory') }],
  },
  example: text('Ein dra-og-slepp-tekst om cellar.'),
  studentMinutes: 10,
  references: [
    { key: 'ref-a', text: 'Forfattar, A. (2026). Den første kjelda.', verify: true, language: 'nn' },
  ],
};

/**
 * The fake-fetch answers of the public studio routes.
 * @param guide - The guide to answer; the full fixture guide by default.
 * @param overview - The overview to answer.
 * @returns Routes for `fakeFetch`.
 */
export const studioRoutes = (guide: Guide = GUIDE, overview: StudioOverview = OVERVIEW) => ({
  'GET /api/studio': { status: 200, body: overview },
  'GET /api/studio/guide/nn': { status: 200, body: guide },
  'GET /api/studio/guide/en': { status: 200, body: { ...guide, locale: 'en' } },
});
