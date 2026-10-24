/**
 * Unit tests for the pure parts of the editor page's script (src/h5p/render/client/editorPage.js), run without a
 * browser: the status text of a refused save (the server's reason, or the page's own for a blocked save of a
 * published activity) and the errors it lists with "Gå til feltet".
 *
 * Spec: PROD-003, UD-013
 */
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';
import { t } from '../../../src/i18n/translate.js';

interface Messages {
  readonly failed: string;
  readonly blockedErrors?: string;
  readonly blocked?: string;
}

interface EditorScript {
  hvliSaveFailureText(status: number, body: unknown, messages: Messages): string;
  hvliOpenErrors(body: unknown): { readonly path: string }[];
}

// WHY: the page loads ./editorFieldReveal.js and ./editorFields.js before editorPage.js; all define page-level functions.
const SOURCE = ['editorFieldReveal.js', 'editorFields.js', 'editorPage.js']
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
// The server's own text for a blocked save, as the content API sends it (default locale nn).
const SERVER_TEXT = t('error.publishedSaveBlocked');
const blocked = (findings: unknown[]) => ({
  success: false,
  errorCode: 'hvl:published-save-blocked',
  httpStatusCode: 409,
  message: SERVER_TEXT,
  findings,
});

describe('[PROD-003] the editor page announces why a save of a published activity was refused', () => {
  it('[PROD-003] gives the server’s message and how many errors still need a fix or a reason', () => {
    // Arrange
    const body = blocked([finding('error'), finding('error'), finding('error', true), finding('warning')]);
    // Act
    const text = script().hvliSaveFailureText(409, body, MESSAGES);
    // Assert
    expect(text).toBe(`${SERVER_TEXT} Feil som treng merksemd: 2.`);
  });

  it('[UD-013] without a count text from the server, gives the server’s message alone', () => {
    const text = script().hvliSaveFailureText(409, blocked([finding('error')]), { failed: 'Feil.' });
    expect(text).toBe(SERVER_TEXT);
  });

  it('[PROD-003] gives the page’s own blocked-save text, so Canvas is not told to unpublish', () => {
    const messages = { ...MESSAGES, blocked: 'Rett feila som er lista under, og lagre på nytt.' };
    const text = script().hvliSaveFailureText(409, blocked([finding('error')]), messages);
    expect(text).toBe('Rett feila som er lista under, og lagre på nytt. Feil som treng merksemd: 1.');
  });

  it('[PROD-003] hands over the errors no one has explained, for the list with "Gå til feltet"', () => {
    // Arrange
    const body = blocked([finding('error'), finding('error', true), finding('warning')]);
    // Act
    const open = script().hvliOpenErrors(body);
    // Assert
    expect(open).toEqual([finding('error')]);
    expect(
      script().hvliOpenErrors({ errorCode: 'hvl:content-changed', findings: [finding('error')] }),
    ).toEqual([]);
    expect(script().hvliOpenErrors(null)).toEqual([]);
  });

  it.each([
    [401, 'hvl:session-expired', 'Økta di har gått ut. Logg inn på nytt.'],
    [401, 'hvl:ltik-invalid', 'Tilgangen din har gått ut. Opne aktiviteten på nytt frå Canvas.'],
    [403, 'hvl:edit-not-allowed', 'Du har ikkje løyve til å endre denne aktiviteten.'],
    [409, 'hvl:content-changed', 'Aktiviteten vart endra i mellomtida.'],
    [400, 'h5p.subContentNotAllowed', 'Innhaldstypen er ikkje tillaten her.'],
  ])(
    '[UD-013] gives the server’s reason for a %i %s refusal, which a retry cannot fix',
    (status, code, text) => {
      const body = { success: false, errorCode: code, httpStatusCode: status, message: text };
      expect(script().hvliSaveFailureText(status, body, MESSAGES)).toBe(text);
    },
  );

  it.each([
    [500, { errorCode: 'hvl:published-save-blocked', message: 'x' }],
    [503, { errorCode: 'hvl:unavailable', message: 'x' }],
    [409, null],
    [403, { message: 'no code' }],
    [400, { errorCode: 'hvl:x', message: '' }],
    [0, undefined],
  ])('[UD-013] keeps the generic failure text for status %i without a readable reason', (status, body) => {
    expect(script().hvliSaveFailureText(status, body, MESSAGES)).toBe(MESSAGES.failed);
  });
});
