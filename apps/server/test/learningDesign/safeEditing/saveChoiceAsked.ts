/**
 * saveChoiceAsked — brings the real editor page in the portal to the open save choice: a draft MultiChoice another
 * learner has saved progress in, its editor framed in a page of ours as the run author, an option added in H5P's
 * form, and «Lagre» pressed until the server's 409 has opened the dialog.
 *
 * Why: the portal's round-trip and keyboard tests (PROD-013, D-093) start from the same refused structural save;
 *      one setup keeps them about what each choice does.
 * Spec: PROD-013
 * Invariants:
 *   - The run author signs in once per bench, through the real Feide redirects in the browser
 *     (../../support/runFeideAuthor.ts), and every page gets that storage in a context of its own.
 *   - "Another learner's" state is a row with a fresh pseudonym (./safeEditingBench.ts `addOtherLearnersState`).
 * Collaborators: ./saveChoiceBench.ts, ./safeEditingBench.ts, ../../support/runFeideAuthor.ts.
 * Tests: ./saveChoiceRoundTrip.browser.int.test.ts, ./saveChoiceKeyboard.browser.int.test.ts
 */
import type { Browser } from 'playwright-core';
import { signInRunAuthor, type BrowserStorage } from '../../support/runFeideAuthor.js';
import { addOption, openFramedEditor, pressSave, type FramedEditor } from './saveChoiceBench.js';
import type { BenchActivity, SafeEditingBench } from './safeEditingBench.js';

/** A structural save the server refused with the save choice open: the activity, the other learner, the editor. */
export interface AskedSave {
  readonly mc: BenchActivity;
  /** The other learner's learnerKey, whose state makes the save ask. */
  readonly other: string;
  readonly editor: FramedEditor;
  /** How many options the edit left. */
  readonly options: number;
}

const signedIn = new WeakMap<SafeEditingBench, BrowserStorage>();

/**
 * Imports a draft MultiChoice another learner has state in, frames its editor in a page of ours as the run author
 * (signed in once per bench through the real Feide redirects), adds an option and presses «Lagre» until the dialog
 * is open.
 * @param browser - The running Chromium.
 * @param bench - The safe-editing bench.
 * @param by - How «Lagre» is pressed.
 * @returns The activity, the other learner, the framed editor and the option count.
 */
export async function askedSave(
  browser: Browser,
  bench: SafeEditingBench,
  by: 'mouse' | 'keyboard' = 'mouse',
): Promise<AskedSave> {
  const storageState = signedIn.get(bench) ?? (await signInRunAuthor(browser, bench.tb));
  signedIn.set(bench, storageState);
  const mc = await bench.importExample('H5P.MultiChoice');
  const other = await bench.addOtherLearnersState(mc);
  const editor = await openFramedEditor(browser, {
    url: `${bench.tb.toolUrl}/w5b-activity-page`,
    editorUrl: `${bench.tb.toolUrl}/h5p/edit/${mc.id}`,
    storageState,
  });
  const options = await addOption(editor.form);
  await pressSave(editor, by);
  await editor.tool.locator('dialog[open]').waitFor({ timeout: 20_000 });
  return { mc, other, editor, options };
}
