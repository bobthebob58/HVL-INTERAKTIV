/**
 * placeholderMarkerActivities — the activities probe P6 saves with the guidance marker `⟦…⟧` (D-086) in each field
 * kind a pattern skeleton fills, in each way the marker can be written in HTML, and a reader that finds every marked
 * string in stored parameters.
 *
 * Why: V-PLACEHOLDER must find the marker in whatever form it is stored. The probe writes it raw and as decimal,
 *      hexadecimal and named character references into rich-text fields (MultiChoice, a CoursePresentation text,
 *      Blanks, DragText), plain text fields (a button label with an `&`, distractors), a textarea (DragText's text,
 *      with the marker inside a draggable), a list item (a Blanks text block, with a marker inside a blank) and the
 *      metadata title.
 * Spec: PROD-001
 * Invariants: library versions are the newest installed minors (D-078); `markerLeaves` reports every string that
 *   holds a marker character or any reference that HTML decodes to one (also zero-padded or without `;`), so a lost,
 *   split or re-encoded marker shows up.
 * Collaborators: ./placeholderMarker.browser.int.test.ts, ./placeholderMarkerCreation.ts, ./placeholderMarkerStored.ts.
 * Tests: apps/server/test/learningDesign/patterns/placeholderMarker.browser.int.test.ts
 */

/** The ways the probe writes `⟦` and `⟧`: raw, and as every HTML character reference that means them. */
export const MARKER_FORMS = {
  raw: ['⟦', '⟧'],
  decimal: ['&#10214;', '&#10215;'],
  hexUpper: ['&#x27E6;', '&#x27E7;'],
  hexLower: ['&#x27e6;', '&#x27e7;'],
  named: ['&lobrk;', '&robrk;'],
  namedLong: ['&LeftDoubleBracket;', '&RightDoubleBracket;'],
} as const;

/** One way of writing the marker. */
export type MarkerForm = keyof typeof MARKER_FORMS;

/** Wraps guidance text in the marker, written in one form. */
type Mark = (text: string) => string;

const markIn =
  (form: MarkerForm): Mark =>
  (text) =>
    `${MARKER_FORMS[form][0]}${text}${MARKER_FORMS[form][1]}`;

/** One activity of the probe. */
export interface MarkedActivity {
  /** The main library's machine name without `H5P.`, e.g. `MultiChoice`. */
  readonly type: string;
  /** Main library as `H5P.Name x.y`. */
  readonly library: string;
  readonly params: Record<string, unknown>;
  /** The metadata title, also marked. */
  readonly title: string;
}

const multiChoice = (m: Mark): Record<string, unknown> => ({
  question: `<p>${m('Skriv spørsmålet her')}</p>`,
  answers: [
    {
      text: `<div>${m('Rett svar')}</div>`,
      correct: true,
      tipsAndFeedback: { chosenFeedback: `<div>${m('Forklar kvifor svaret er rett')}</div>` },
    },
    { text: '<div>Feil svar</div>', correct: false },
  ],
  // WHY: an ampersand inside a marker shows which references stay encoded once stored.
  UI: { checkAnswerButton: m('Sjekk & send') },
});

const coursePresentation = (m: Mark): Record<string, unknown> => ({
  presentation: {
    slides: [
      {
        elements: [
          {
            x: 5,
            y: 5,
            width: 90,
            height: 40,
            action: {
              library: 'H5P.AdvancedText 1.1',
              params: { text: `<p>${m('Skriv teksten på lysbiletet')}</p>` },
              subContentId: '3f1d6f0e-6c1b-4a51-9f0b-0d6a3c2e7b11',
              metadata: { contentType: 'Text', license: 'U', title: 'Tekst' },
            },
          },
        ],
      },
    ],
  },
});

const blanks = (m: Mark): Record<string, unknown> => ({
  text: `<p>${m('Skriv kva studenten skal fylle inn')}</p>`,
  questions: [`<p>${m('Skriv setninga')} med *omgrep* og *${m('svar')}*</p>`],
});

const dragText = (m: Mark): Record<string, unknown> => ({
  taskDescription: `<p>${m('Skriv oppgåva')}</p>`,
  textField: `${m('Skriv teksten')} med *dra* og *${m('ord')}*.`,
  distractors: `*${m('distraktor')}*`,
});

/**
 * The four activities with every marker written in one form.
 * @param form - How `⟦` and `⟧` are written.
 * @returns MultiChoice, CoursePresentation, Blanks and DragText, in that order.
 */
export function markedActivities(form: MarkerForm): MarkedActivity[] {
  const m = markIn(form);
  return [
    { type: 'MultiChoice', library: 'H5P.MultiChoice 1.16', params: multiChoice(m) },
    { type: 'CoursePresentation', library: 'H5P.CoursePresentation 1.28', params: coursePresentation(m) },
    { type: 'Blanks', library: 'H5P.Blanks 1.14', params: blanks(m) },
    { type: 'DragText', library: 'H5P.DragText 1.10', params: dragText(m) },
  ].map((a) => ({ ...a, title: m(`Tittel: ${a.type}`) }));
}

/**
 * A marker character or any character reference to one (case-insensitive, as HTML reads hex). WHY: HTML, sanitize-html
 * and htmlparser2 also decode a numeric reference with leading zeros or without its `;` (`&#010214`).
 */
const ANY_MARKER =
  /[⟦⟧]|&#(?:0*1021[45](?![0-9])|x0*27e[67](?![0-9a-f]))|&(?:lobrk|robrk|LeftDoubleBracket|RightDoubleBracket);/i;

/**
 * Every string in a parameter tree that holds a marker in any form, by path.
 * @param value - Parameters (or any JSON value).
 * @param path - The path of `value`; empty at the root.
 * @returns Path (`a.b[0].c`) → the stored string.
 */
export function markerLeaves(value: unknown, path = ''): Record<string, string> {
  if (typeof value === 'string') return ANY_MARKER.test(value) ? { [path]: value } : {};
  if (Array.isArray(value)) {
    return Object.assign({}, ...value.map((item: unknown, i) => markerLeaves(item, `${path}[${i}]`)));
  }
  if (typeof value !== 'object' || value === null) return {};
  const entries = Object.entries(value as Record<string, unknown>);
  return Object.assign({}, ...entries.map(([k, v]) => markerLeaves(v, path ? `${path}.${k}` : k)));
}
