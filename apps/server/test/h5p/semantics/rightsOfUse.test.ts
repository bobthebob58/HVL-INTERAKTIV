/**
 * Tests that everything H5P Core's "Rights of use" dialog renders is cleaned wherever it sits in the parameters:
 * metadata and copyright objects under any key, file paths and alt texts (D-039).
 *
 * Spec: SEC-008
 */
import { describe, it, expect, afterAll } from 'vitest';
import sanitizeHtml from 'sanitize-html';
import { LibraryManager, fsImplementations } from '@lumieducation/h5p-server';
import { LumiTextSanitizer, plainText, safeSourceUrl } from '../../../src/h5p/semantics/lumiTextSanitizer.js';
import { isSafeFilePath, sanitizeRightsOfUse } from '../../../src/h5p/semantics/rightsOfUse.js';
import { removeSyntheticLibraryDirs, syntheticLibraryDir } from '../../support/syntheticLibraries.js';

afterAll(removeSyntheticLibraryDirs);

const XSS = '<img src=x onerror=alert(1)>';
const text = new LumiTextSanitizer(
  new LibraryManager(
    new fsImplementations.FileLibraryStorage(syntheticLibraryDir([{ machineName: 'H5P.Any' }])),
  ),
);
const refusal = (params: unknown): unknown => {
  try {
    sanitizeRightsOfUse(params, text);
  } catch (error) {
    return error;
  }
  return undefined;
};

describe('[SEC-008] values the "Rights of use" dialog renders', () => {
  it('[SEC-008] metadata and copyright objects are plain text under any key and at any depth', () => {
    // Arrange: places h5p.js findCopyrights reads although no semantics field defines them.
    const params = {
      extra: { metadata: { license: 'CC BY', title: `T${XSS}`, authors: [{ name: XSS, role: 'Author' }] } },
      questions: [{ library: 'H5P.MultiChoice 1.16', params: { inner: { metadata: { title: `I${XSS}` } } } }],
      media: {
        path: 'images/a.png',
        mime: 'image/png',
        copyright: { license: 'CC BY', title: `M${XSS}`, source: 'javascript:alert(1)//' },
      },
      hidden: [
        { file: { path: 'images/b.png', copyright: { author: '<a href="https://evil.example">x</a>' } } },
      ],
    };
    // Act
    sanitizeRightsOfUse(params, text);
    // Assert
    expect(JSON.stringify(params)).not.toMatch(/<img|<a |onerror=alert\(1\)>/);
    expect(params.extra.metadata.title).toBe('T');
    expect(params.media.copyright).not.toHaveProperty('source');
    expect(params.hidden[0]?.file.copyright.author).toBe('x');
  });

  it('[SEC-008] the walk goes on inside metadata and copyright objects, and nothing past the depth limit stays', () => {
    // Arrange: h5p.js findCopyrights also walks into these objects, and joins nested arrays into HTML.
    const nestedImage = {
      params: { contentName: 'Image', alt: 'x" onerror="alert(1)' },
      metadata: { license: 'U' },
    };
    const deep = [[[[[[[[`D${XSS}`]]]]]]]];
    const params = {
      media: { copyright: { license: 'CC BY', nested: nestedImage } },
      sub: { metadata: { license: 'CC BY', licenseExtras: deep } },
    };
    // Act
    sanitizeRightsOfUse(params, text);
    // Assert
    expect(nestedImage.params.alt).toBe('x” onerror=”alert(1)');
    expect(JSON.stringify(params)).not.toMatch(/<img|"x"/);
    const pathInMetadata = { sub: { metadata: { license: 'U', image: { path: 'a.png" onerror="x' } } } };
    expect(refusal(pathInMetadata)).toMatchObject({ errorId: 'hvl:unsafe-file-path' });
  });

  it('[SEC-008] a source link with a quote in its host is removed; quotes elsewhere are percent-encoded', () => {
    expect(safeSourceUrl('https://evil.example"onmouseover=alert(1)//x/')).toBeUndefined();
    expect(safeSourceUrl("https://evil.example'x/")).toBeUndefined();
    expect(safeSourceUrl('https://x.example/a"b?c="d')).toBe('https://x.example/a%22b?c=%22d');
    const params = {
      media: { copyright: { license: 'CC BY', source: 'https://evil.example"onmouseover=alert(1)//' } },
    };
    sanitizeRightsOfUse(params, text);
    expect(params.media.copyright).not.toHaveProperty('source');
  });

  it('[SEC-008] metadata keeps no markup at all: links, emphasis, tables and script content are removed', () => {
    expect(
      plainText('<a href="https://e.example">lenke</a> <b>feit</b> <table><tr><td>t</td></tr></table>'),
    ).toBe('lenke feit t');
    expect(plainText('a & b <script>alert(1)</script><style>p{}</style>')).toBe('a &amp; b ');
  });

  it('[SEC-008] an alt text never carries a straight double quote, also after Lumi sanitises it again', () => {
    // Arrange
    const params = {
      picture: { params: { contentName: 'Image', alt: 'Ein "fin" dag" onerror="alert(1)' } },
      nested: [{ alt: '&quot;x&#34;' }],
    };
    // Act
    sanitizeRightsOfUse(params, text);
    // Assert: Lumi's own pass (sanitize-html defaults) runs after ours and decodes entities.
    const alts = [params.picture.params.alt, params.nested[0]?.alt ?? ''];
    for (const alt of [...alts, ...alts.map((a) => sanitizeHtml(a))]) expect(alt).not.toContain('"');
    expect(params.picture.params.alt).toBe('Ein ”fin” dag” onerror=”alert(1)');
    const listed = { picture: { params: { alt: ['x" onerror="alert(1)'] } } };
    sanitizeRightsOfUse(listed, text);
    expect(listed.picture.params.alt).toBe('');
  });

  it('[SEC-008] a file path that could leave an attribute or run as a link is refused with 400', () => {
    // Arrange
    const unsafe = [
      'images/a.png" onerror="alert(1)',
      'images/<x>.png',
      'images/`x`.png',
      'images/a\u0000.png',
      'javascript://%0aalert(1)',
      'JavaScript:alert(1)',
      'data:text/html,x',
    ];
    // Act and assert: every unsafe path is refused, and a save with it fails with 400.
    for (const path of unsafe) {
      expect(isSafeFilePath(path), path).toBe(false);
      expect(refusal({ media: { path } }), path).toMatchObject({
        errorId: 'hvl:unsafe-file-path',
        httpStatusCode: 400,
      });
    }
    // Act and assert: an array, which h5p.js would join into `src="…"`, is refused too.
    expect(refusal({ media: { path: ['https://x.example/a.png'] } })).toMatchObject({ httpStatusCode: 400 });
    // Act and assert: file names Lumi creates and web links pass.
    const safe = ['images/photo-1a2b.png#tmp', 'videos/v.mp4', 'https://www.youtube.com/watch?v=x&t=1'];
    for (const path of safe) expect(refusal({ media: { path } }), path).toBeUndefined();
  });

  it('[SEC-008] deeply nested parameters are walked without overflowing the stack', () => {
    let deep: Record<string, unknown> = { metadata: { license: 'U', title: XSS } };
    for (let i = 0; i < 100_000; i += 1) deep = { child: deep };
    sanitizeRightsOfUse(deep, text);
    let node = deep;
    while (node.child) node = node.child as Record<string, unknown>;
    expect(node.metadata).toEqual({ license: 'U' });
  });
});
