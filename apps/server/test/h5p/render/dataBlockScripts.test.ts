/**
 * Unit tests of where the H5P pages' scripts read their data from (D-140), run without a browser: the integration
 * script and the editor page's script read only the page's own block, the inert JSON script in the document's
 * head; the same ID on any other element is not read.
 *
 * Spec: SEC-008, H5P-009
 */
import { describe, expect, it } from 'vitest';
import { runClientScripts } from './clientScripts.js';

interface FakeElement {
  readonly tagName: string;
  readonly type?: string;
  readonly parentNode: object;
  readonly textContent: string;
}
const head = { nodeName: 'HEAD' };
const body = { nodeName: 'BODY' };
const ownBlock = (json: string): FakeElement => ({
  tagName: 'SCRIPT',
  type: 'application/json',
  parentNode: head,
  textContent: json,
});
/** The same JSON under the same ID, in places the page never writes its block. */
const FOREIGN: readonly [string, (json: string) => FakeElement][] = [
  ['a script in the body', (json) => ({ ...ownBlock(json), parentNode: body })],
  ['a script of another type', (json) => ({ ...ownBlock(json), type: 'text/plain' })],
  ['another element', (json) => ({ tagName: 'DIV', parentNode: body, textContent: json })],
  [
    'a form control named like the block',
    (json) => ({ tagName: 'INPUT', type: 'text', parentNode: head, textContent: json }),
  ],
];
const documentWith = (blocks: Record<string, FakeElement>) => ({
  head,
  getElementById: (id: string) => blocks[id] ?? null,
});

describe('[SEC-008] the integration script reads the page’s own block only', () => {
  const run = (block: FakeElement | undefined) => {
    const window: { H5PIntegration?: unknown } = {};
    runClientScripts(['h5pIntegration.js'], {
      window,
      document: documentWith(block ? { 'h5p-integration': block } : {}),
    });
    return window.H5PIntegration;
  };

  it('[H5P-009] the inert JSON script in the head becomes H5PIntegration', () => {
    expect(run(ownBlock('{"contents":{"cid-1":{}}}'))).toEqual({ contents: { 'cid-1': {} } });
    expect(run(undefined)).toBeUndefined();
  });

  it.each(FOREIGN)('[SEC-008] %s with the block’s ID is not read', (_name, element) => {
    expect(run(element('{"contents":{"cid-other":{}}}'))).toBeUndefined();
  });
});

describe('[SEC-008] the editor page’s script reads the page’s own block only', () => {
  // WHY: the page loads these in this order (../../../src/h5p/render/editorPage.ts).
  const SCRIPTS = [
    'editorFieldReveal.js',
    'editorFields.js',
    'editorSaveRequests.js',
    'editorSaveChoice.js',
    'editorStart.js',
    'editorPage.js',
  ];
  /** Runs the editor page's scripts and tells whether the page's script went on to read its settings. */
  const startsWith = (block: FakeElement): boolean => {
    let read = false;
    const element = {
      tagName: block.tagName,
      type: block.type,
      parentNode: block.parentNode,
      get textContent() {
        read = true;
        return block.textContent;
      },
    };
    try {
      runClientScripts(SCRIPTS, {
        window: { H5PEditor: {}, H5PIntegration: { editor: {} } },
        document: documentWith({ 'hvl-editor-config': element }),
      });
    } catch {
      // WHY: with its settings read, the script goes on into an editor these fakes do not hold.
    }
    return read;
  };

  it('[H5P-009] the inert JSON script in the head is read as the page’s settings', () => {
    expect(startsWith(ownBlock('{"contentId":"new"}'))).toBe(true);
  });

  it.each(FOREIGN)('[SEC-008] %s with the block’s ID is not read', (_name, element) => {
    expect(startsWith(element('{"contentId":"other"}'))).toBe(false);
  });
});
