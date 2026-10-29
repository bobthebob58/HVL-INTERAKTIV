/**
 * Unit tests for the save choice script (src/h5p/render/client/editorSaveChoice.js) in a simulated document (jsdom):
 * what the dialog holds in the portal and in Canvas, what each choice does after the 409
 * `hvl:learner-state-reset-needed`, and what the status region is told while its request runs (D-093, D-098). jsdom
 * has no `showModal`, so opening, focus, Tab, Escape and the page's status are proven in Chromium:
 * ../../learningDesign/safeEditing/saveChoiceRoundTrip.browser.int.test.ts.
 *
 * Spec: PROD-013, UD-006
 */
import { JSDOM } from 'jsdom';
import { describe, expect, it } from 'vitest';
import { saveChoiceMessages } from '../../../src/learningDesign/safeEditing/saveChoiceMessages.js';
import { runClientScripts } from './clientScripts.js';

type Choice = 'reset' | 'copy' | 'cancel';

interface ChoiceScript {
  hvliBuildChoice(
    texts: object,
    inCanvas: boolean,
  ): { dialog: HTMLDialogElement; buttons: HTMLButtonElement[] };
  hvliAnswerResetNeeded(content: object, page: object): Promise<void>;
  hvliSaveChoice: (texts: object, inCanvas: boolean) => Promise<Choice>;
  hvliSaveContent: (...args: unknown[]) => Promise<unknown>;
  hvliSaveAsCopy: (...args: unknown[]) => Promise<unknown>;
}

const PORTAL = saveChoiceMessages('nn', false);
const CANVAS = saveChoiceMessages('nn', true);

/** Loads the script into a fresh document; `posted` collects what it posts to the framing page. */
const load = () => {
  const dom = new JSDOM('<!doctype html><html lang="nn"><body></body></html>');
  const posted: unknown[] = [];
  const parent = { postMessage: (message: unknown) => posted.push(message) };
  const globals = {
    document: dom.window.document,
    window: { parent },
    location: { origin: 'https://x.test' },
  };
  return { posted, run: runClientScripts<ChoiceScript>(['editorSaveChoice.js'], globals) };
};

/** Answers the choice with `choice`, records each request, and returns what the page announced and settled. */
const answer = async (choice: Choice, inCanvas: boolean, fail?: object) => {
  const { posted, run } = load();
  const requests: string[] = [];
  const respond = (request: string) => {
    requests.push(request);
    return fail ? Promise.reject(fail) : Promise.resolve({ contentId: 'copy-1' });
  };
  run.hvliSaveChoice = () => Promise.resolve(choice);
  run.hvliSaveContent = (...args) => respond(`save ${String(args[3])}`);
  run.hvliSaveAsCopy = () => respond('copy');
  const settled: unknown[][] = [];
  const saved: unknown[] = [];
  /** Each announcement while a request runs, with the number of requests sent before it. */
  const announced: [string, number][] = [];
  const config = { inCanvas, saveChoice: inCanvas ? CANVAS : PORTAL, messages: { failed: 'Feil.' } };
  const page = {
    config,
    contentId: 'c1',
    saved: (result: unknown) => saved.push(result),
    settle: (...settledWith: unknown[]) => settled.push(settledWith),
    announce: (text: string) => announced.push([text, requests.length]),
  };
  await run.hvliAnswerResetNeeded({ library: 'H5P.MultiChoice 1.16', params: '{}' }, page);
  return { requests, settled, saved, posted, announced };
};

describe('[PROD-013] the save choice dialog', () => {
  it('[PROD-013] in the portal: a named, described dialog with reset, copy and «Avbryt» last, which has focus first', () => {
    // Arrange
    const { run } = load();
    // Act
    const { dialog, buttons } = run.hvliBuildChoice(PORTAL, false);
    // Assert
    const text = (id: string | null) => dialog.querySelector(`#${id ?? ''}`)?.textContent;
    expect(text(dialog.getAttribute('aria-labelledby'))).toBe(PORTAL.title);
    expect(dialog.querySelector('h2')?.id).toBe('hvl-save-choice-title');
    expect(text(dialog.getAttribute('aria-describedby'))).toBe(PORTAL.body);
    expect(buttons.map((b) => [b.value, b.textContent])).toEqual([
      ['reset', PORTAL.reset],
      ['copy', PORTAL.saveAsCopy],
      ['cancel', PORTAL.cancel],
    ]);
    expect(buttons[2]?.hasAttribute('autofocus')).toBe(true);
    expect(text(buttons[1]?.getAttribute('aria-describedby') ?? null)).toBe(PORTAL.saveAsCopyHint);
    expect(dialog.querySelector('form')?.getAttribute('method')).toBe('dialog');
  });

  it('[PROD-013] in Canvas: reset or «Avbryt» only, and the pointer to the portal is part of the description', () => {
    // Arrange
    const { run } = load();
    // Act
    const { dialog, buttons } = run.hvliBuildChoice(CANVAS, true);
    // Assert
    expect(buttons.map((b) => b.value)).toEqual(['reset', 'cancel']);
    expect(dialog.getAttribute('aria-describedby')).toBe('hvl-save-choice-text hvl-save-choice-note');
    expect(dialog.querySelector('#hvl-save-choice-note')?.textContent).toBe(CANVAS.canvasPointer);
    expect(dialog.textContent).not.toContain(PORTAL.saveAsCopy);
  });

  it('[UD-006] writes every text as text, never as markup', () => {
    const { run } = load();
    const { dialog } = run.hvliBuildChoice({ ...PORTAL, title: '<img src=x onerror=alert(1)>' }, false);
    expect(dialog.querySelector('img')).toBeNull();
    expect(dialog.querySelector('h2')?.textContent).toBe('<img src=x onerror=alert(1)>');
  });

  it('[PROD-013] «Nullstill framgangen og lagre» says it runs, resends the refused content confirmed and reports the reset', async () => {
    const { requests, settled, saved, announced } = await answer('reset', false);
    expect(announced).toEqual([[PORTAL.resetting, 0]]);
    expect(requests).toEqual(['save true']);
    expect(saved).toEqual([{ contentId: 'copy-1' }]);
    expect(settled).toEqual([[PORTAL.resetAndSaved]]);
  });

  it('[PROD-013] «Lagre som ny versjon» says it runs, saves a copy and asks the framing page to open its editor', async () => {
    const { requests, settled, posted, announced } = await answer('copy', false);
    expect(announced).toEqual([[PORTAL.copying, 0]]);
    expect(requests).toEqual(['copy']);
    expect(settled).toEqual([[PORTAL.savedAsCopy]]);
    expect(posted).toEqual([{ type: 'hvli:content-copied', contentId: 'copy-1' }]);
  });

  it('[PROD-013] «Avbryt» sends nothing, and Canvas never sends a copy request', async () => {
    // Arrange and act
    const cancelled = await answer('cancel', false);
    const canvasCopy = await answer('copy', true);
    // Assert
    expect([cancelled.requests, cancelled.settled]).toEqual([[], [[PORTAL.cancelled]]]);
    expect([canvasCopy.requests, canvasCopy.settled]).toEqual([[], [[CANVAS.cancelled]]]);
    expect([cancelled.announced, canvasCopy.announced]).toEqual([[], []]);
  });

  it('[UD-013] a refused retry settles with the server’s reason and the errors to list', async () => {
    const refusal = { statusText: 'Aktiviteten vart endra i mellomtida.', openErrors: [] };
    const { settled } = await answer('reset', false, refusal);
    expect(settled).toEqual([[refusal.statusText, []]]);
  });
});
