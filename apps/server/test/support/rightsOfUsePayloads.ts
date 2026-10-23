/**
 * rightsOfUsePayloads — author data that tries to run script in H5P Core's "Rights of use" dialog.
 *
 * Why: h5p.js builds that dialog by joining strings: metadata fields, file copyright objects, source links,
 *      image paths and alt texts end up in HTML and attributes unescaped (D-039). Each value sets a window flag
 *      if it ever runs, so a browser test can prove that none does after a save.
 * Spec: SEC-008
 * Invariants: every flag name starts with `__hvl`; the payloads are saved through the normal save route, so
 *   the server's cleaning is what the test checks.
 * Tests: shared by apps/server/test/http/player.browser.int.test.ts.
 */

/** Main metadata in which every field the dialog shows tries to run script. */
export const RIGHTS_PAYLOAD = {
  title: 'Rettar',
  license: 'CC BY',
  licenseVersion: '4.0',
  source: 'https://x.example/"><img src=x onerror="window.__hvlSource=1">',
  licenseExtras: '<img src=x onerror="window.__hvlExtras=1">',
  yearFrom: '<img src=x onerror="window.__hvlYear=1">',
  contentType: 'Quiz<img src=x onerror="window.__hvlType=1">',
  authors: [{ name: 'Ola<img src=x onerror="window.__hvlAuthor=1">', role: 'Author' }],
};

/** The flags RIGHTS_PAYLOAD sets if any of it runs. */
export const RIGHTS_FLAGS = ['__hvlSource', '__hvlExtras', '__hvlYear', '__hvlType', '__hvlAuthor'];

const image = (path: string, alt: unknown, title: string) => ({
  params: { contentName: 'Image', file: { path, width: 4, height: 4 }, alt },
  metadata: { license: 'CC BY', title },
});

/** Copyright data under keys no semantics field defines; h5p.js `findCopyrights` still renders all of it. */
export const COPYRIGHT_PARAMS = {
  question: 'Kva?',
  media: {
    path: 'images/a.png',
    mime: 'image/png',
    copyright: {
      license: 'CC BY',
      title: '<img src=x onerror="window.__hvlMedia=1">',
      // WHY: WHATWG keeps a quote in the host raw, so this would leave the dialog's href="…".
      source: 'https://evil.example"onmouseover=window.__hvlhostquote=1//x/',
    },
  },
  hidden: {
    file: {
      path: 'images/b.png',
      mime: 'image/png',
      copyright: { license: 'CC BY', author: '<img src=x onerror="window.__hvlHidden=1">' },
    },
  },
  picture: {
    ...image('images/c.png', 'x" onerror="window.__hvlAlt=1', 'Bilete'),
    metadata: {
      license: 'CC BY',
      title: 'Bilete',
      licenseExtras: '<img src=x onerror="window.__hvlSubMeta=1">',
    },
  },
  nested: {
    metadata: {
      license: 'CC BY',
      title: 'Ytre',
      inner: image('images/d.png', 'y" onerror="window.__hvlNested=1', 'Indre'),
    },
  },
  listed: image('images/e.png', ['z" onerror="window.__hvlListed=1'], 'Liste'),
  deep: {
    metadata: {
      license: 'CC BY',
      title: 'Djup',
      licenseExtras: [[[[[[[['<img src=x onerror="window.__hvlDeep=1">']]]]]]]],
    },
  },
};

/** The flags COPYRIGHT_PARAMS sets if any of it runs (the host-quote link runs on mouseover). */
export const COPYRIGHT_FLAGS = [
  '__hvlMedia',
  '__hvlhostquote',
  '__hvlHidden',
  '__hvlAlt',
  '__hvlSubMeta',
  '__hvlNested',
  '__hvlListed',
  '__hvlDeep',
];

/** Images in COPYRIGHT_PARAMS with a safe path, each shown as a thumbnail in the dialog. */
export const COPYRIGHT_THUMBNAILS = 3;
