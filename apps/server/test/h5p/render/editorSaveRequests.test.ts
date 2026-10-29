/**
 * Unit tests for the editor page's requests (src/h5p/render/client/editorSaveRequests.js), run without a browser
 * against a recording `fetch`: the save body with and without the author's confirmation, the copy request, the
 * token in a header only, and the refusal the page branches on (D-093).
 *
 * Spec: PROD-013, H5P-007, UD-013
 */
import { describe, expect, it } from 'vitest';
import { runClientScripts } from './clientScripts.js';

interface Sent {
  readonly url: string;
  readonly init: { method: string; headers: Record<string, string>; body: string };
}

interface Refusal {
  readonly status: number;
  readonly errorCode?: string;
  readonly resetNeeded: boolean;
  readonly statusText: string;
}

interface RequestScript {
  hvliSaveContent(
    content: object,
    contentId: string | null,
    config: object,
    confirm?: boolean,
  ): Promise<unknown>;
  hvliSaveAsCopy(content: object, contentId: string, config: object): Promise<unknown>;
  hvliSaveFailureText(status: number, body: unknown, messages: { failed: string }): string;
}

const MESSAGES = { failed: 'Klarte ikkje å lagre.' };
const PORTAL = { token: { name: 'csrf', value: 'csrf-1' }, messages: MESSAGES };
const CANVAS = { token: { name: 'ltik', value: 'ltik-1' }, messages: MESSAGES };
const CONTENT = {
  library: 'H5P.MultiChoice 1.16',
  params: JSON.stringify({ params: { question: 'Kva?' }, metadata: { title: 'Q' } }),
};

/** Loads the script with a `fetch` that records each request and answers `status` with `answer`. */
const script = (status = 200, answer: unknown = { contentId: 'c2' }) => {
  const sent: Sent[] = [];
  const fetch = (url: string, init: Sent['init']) => {
    sent.push({ url, init });
    return Promise.resolve({ ok: status < 300, status, json: () => Promise.resolve(answer) });
  };
  return { sent, run: runClientScripts<RequestScript>(['editorSaveRequests.js'], { fetch }) };
};

const resetNeeded = {
  success: false,
  errorCode: 'hvl:learner-state-reset-needed',
  httpStatusCode: 409,
  message: 'Endringa endrar oppbygginga av aktiviteten.',
};

describe('[PROD-013] the editor page’s save and copy requests', () => {
  it('[PROD-013] saves the open activity with PUT, and adds the confirmation only when the author gave it', async () => {
    // Arrange
    const { sent, run } = script();
    // Act
    await run.hvliSaveContent(CONTENT, 'c1', PORTAL);
    await run.hvliSaveContent(CONTENT, 'c1', PORTAL, true);
    await run.hvliSaveContent(CONTENT, null, PORTAL);
    // Assert
    const bodies = sent.map((s) => JSON.parse(s.init.body) as Record<string, unknown>);
    expect(sent.map((s) => `${s.init.method} ${s.url}`)).toEqual([
      'PUT /h5p/content/c1',
      'PUT /h5p/content/c1',
      'POST /h5p/content',
    ]);
    expect(bodies[0]).toEqual({ library: CONTENT.library, params: JSON.parse(CONTENT.params) });
    expect(bodies[1]).toEqual({ ...bodies[0], confirmLearnerStateReset: true });
    expect(bodies[2]).not.toHaveProperty('confirmLearnerStateReset');
  });

  it('[PROD-013] posts «Lagre som ny versjon» as `{ params, metadata, library }` to the copy route with the CSRF token', async () => {
    // Arrange
    const { sent, run } = script(201);
    // Act
    await run.hvliSaveAsCopy(CONTENT, 'c 1', PORTAL);
    // Assert: the editor's library goes along, so an upgraded minor version is kept (D-093, S5 W4)
    expect(sent[0]?.url).toBe('/h5p/content/c%201/copy');
    expect(sent[0]?.init.method).toBe('POST');
    expect(JSON.parse(sent[0]?.init.body ?? '')).toEqual({
      ...(JSON.parse(CONTENT.params) as object),
      library: CONTENT.library,
    });
    expect(sent[0]?.init.headers).toMatchObject({ 'X-CSRF-Token': 'csrf-1' });
  });

  it('[H5P-007] sends the ltik as Bearer in a header, never in the URL or the body', async () => {
    const { sent, run } = script();
    await run.hvliSaveContent(CONTENT, 'c1', CANVAS, true);
    expect(sent[0]?.init.headers).toMatchObject({ Authorization: 'Bearer ltik-1' });
    expect(`${sent[0]?.url} ${sent[0]?.init.body}`).not.toContain('ltik-1');
  });

  it('[PROD-013] marks a 409 learner-state refusal for the save choice, by its code and not its text', async () => {
    // Arrange
    const asked = script(409, resetNeeded);
    const other = script(409, { ...resetNeeded, errorCode: 'hvl:content-changed' });
    // Act
    const refusal = (await asked.run
      .hvliSaveContent(CONTENT, 'c1', PORTAL)
      .catch((e: unknown) => e)) as Refusal;
    const changed = (await other.run
      .hvliSaveContent(CONTENT, 'c1', PORTAL)
      .catch((e: unknown) => e)) as Refusal;
    // Assert
    expect(refusal).toMatchObject({ status: 409, errorCode: resetNeeded.errorCode, resetNeeded: true });
    expect(changed).toMatchObject({ status: 409, errorCode: 'hvl:content-changed', resetNeeded: false });
  });

  it.each([
    [500, 'hvl:duplicate-failed', 'Kopien kunne ikkje lagast.'],
    [404, 'hvl:activity-unavailable', 'Aktiviteten er ikkje tilgjengeleg.'],
    [403, 'hvl:duplicate-not-allowed', 'Du kan ikkje lage ein kopi.'],
  ])('[UD-013] gives the server’s reason for a refused copy (%i %s)', (status, errorCode, message) => {
    const body = { success: false, errorCode, httpStatusCode: status, message };
    expect(script().run.hvliSaveFailureText(status, body, MESSAGES)).toBe(message);
  });

  it('[UD-013] keeps the generic text for any other 5xx, which a retry may fix', () => {
    const body = { success: false, errorCode: 'hvl:unavailable', message: 'Intern feil' };
    expect(script().run.hvliSaveFailureText(500, body, MESSAGES)).toBe(MESSAGES.failed);
  });
});
