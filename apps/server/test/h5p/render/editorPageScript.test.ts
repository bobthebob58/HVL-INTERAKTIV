/**
 * Unit tests for the pure parts of the editor page's scripts (src/h5p/render/client/editorPage.js and
 * editorFields.js), run without a
 * browser: the status text of a refused save of a published activity, and how "Gå til feltet" follows a finding's
 * path through H5P's editor widgets.
 *
 * Spec: PROD-003, UD-013, UD-006
 */
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';

interface Messages {
  readonly failed: string;
  readonly blockedErrors?: string;
}

interface Widget {
  readonly field?: { readonly name: string };
  readonly children?: readonly Widget[];
  readonly currentLibrary?: string;
  forEachChild?(task: (child: Widget, index: number) => unknown): void;
}

interface EditorScript {
  hvliSaveFailureText(status: number, body: unknown, messages: Messages): string;
  hvliFieldTokens(path: string): (string | number)[];
  hvliFieldChain(form: Widget, tokens: (string | number)[]): Widget[];
}

// WHY: the page loads ./editorFields.js before editorPage.js; both define page-level functions.
const SOURCE = ['editorFields.js', 'editorPage.js']
  .map((name) => readFileSync(new URL(`../../../src/h5p/render/client/${name}`, import.meta.url), 'utf8'))
  .join('\n');

/** Runs the script where no editor page exists: it defines its functions and starts nothing. */
const script = (): EditorScript => {
  const context: Record<string, unknown> = { window: {}, document: { getElementById: () => null } };
  runInNewContext(SOURCE, context);
  return context as unknown as EditorScript;
};

const MESSAGES: Messages = {
  failed: 'Klarte ikkje å lagre.',
  blockedErrors: 'Feil som treng merksemd: {{count}}.',
};
const finding = (severity: string, acknowledged = false) => ({
  ruleId: 'V-IMG-ALT',
  severity,
  path: 'alt',
  message: 'Bildet manglar alternativ tekst.',
  acknowledgement: acknowledged ? { reason: 'Kjem', at: '2026-10-23T12:00:00.000Z' } : null,
});
const blocked = (findings: unknown[]) => ({
  success: false,
  errorCode: 'hvl:published-save-blocked',
  httpStatusCode: 409,
  message: 'Aktiviteten er publisert, og endringa di gir feil som ingen har grunngjeve.',
  findings,
});

describe('[PROD-003] the editor page announces why a save of a published activity was refused', () => {
  it('[PROD-003] gives the server’s message and how many errors still need a fix or a reason', () => {
    // Arrange
    const body = blocked([finding('error'), finding('error'), finding('error', true), finding('warning')]);
    // Act
    const text = script().hvliSaveFailureText(409, body, MESSAGES);
    // Assert
    expect(text).toBe(
      'Aktiviteten er publisert, og endringa di gir feil som ingen har grunngjeve. Feil som treng merksemd: 2.',
    );
  });

  it('[UD-013] without a count text from the server, gives the server’s message alone', () => {
    const text = script().hvliSaveFailureText(409, blocked([finding('error')]), { failed: 'Feil.' });
    expect(text).toBe('Aktiviteten er publisert, og endringa di gir feil som ingen har grunngjeve.');
  });

  it.each([
    [500, { errorCode: 'hvl:published-save-blocked', message: 'x' }],
    [409, { errorCode: 'hvl:content-changed', message: 'Endra i mellomtida.' }],
    [409, null],
    [403, { errorCode: 'hvl:edit-not-allowed', message: 'Ikkje lov.' }],
  ])('[PROD-003] keeps the generic failure text for status %i and other answers', (status, body) => {
    expect(script().hvliSaveFailureText(status, body, MESSAGES)).toBe(MESSAGES.failed);
  });
});

describe('[UD-006] "Gå til feltet" follows a finding path through the editor', () => {
  it('[UD-006] splits a path into field names and list positions, leaving out sub-content `params`', () => {
    // Arrange
    const { hvliFieldTokens } = script();
    // Act and assert
    expect(hvliFieldTokens('content[1].content.params.alt')).toEqual(['content', 1, 'content', 'alt']);
    expect(hvliFieldTokens('questions[0].params.behaviour.feedbackOnWrong')).toEqual([
      'questions',
      0,
      'behaviour',
      'feedbackOnWrong',
    ]);
    expect(hvliFieldTokens('a[2][3]')).toEqual(['a', 2, 3]);
    expect(hvliFieldTokens('paramsList[0].params')).toEqual(['paramsList', 0]);
    expect(hvliFieldTokens('')).toEqual([]);
  });

  it('[UD-006] walks lists, groups and sub-content to the field and stops where the path leaves the form', () => {
    // Arrange: a Column form whose second item holds an image sub-content with an alt field.
    const alt: Widget = { field: { name: 'alt' } };
    const image: Widget = {
      field: { name: 'content' },
      currentLibrary: 'H5P.Image 1.1',
      children: [{ field: { name: 'file' } }, alt],
    };
    const item: Widget = {
      field: { name: 'content' },
      children: [image, { field: { name: 'useSeparator' } }],
    };
    const first: Widget = { field: { name: 'content' }, children: [] };
    const list: Widget = {
      field: { name: 'content' },
      forEachChild: (task) => [first, item].forEach((child, index) => task(child, index)),
    };
    const form: Widget = { children: [list] };
    const { hvliFieldChain, hvliFieldTokens } = script();
    // Act
    const chain = hvliFieldChain(form, hvliFieldTokens('content[1].content.params.alt'));
    const partial = hvliFieldChain(form, hvliFieldTokens('content[1].missing.alt'));
    // Assert
    expect(chain).toEqual([list, item, image, alt]);
    expect(partial).toEqual([list, item]);
    expect(hvliFieldChain(form, hvliFieldTokens('metadata.defaultLanguage'))).toEqual([]);
  });
});
