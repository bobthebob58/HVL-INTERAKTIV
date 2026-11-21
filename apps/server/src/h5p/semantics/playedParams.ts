/**
 * playedParams — fits the parameters the player page carries to their library's semantics, whatever the stored
 * row holds.
 *
 * Why: a save stores only what the semantics describe (D-123), but a row can be older than that rule, or written
 *      by something other than the editor's save. The player's scripts read parameters key by key, also keys and
 *      value shapes no field describes. H5P's own server software fits content each time it is shown; this does
 *      the same for our player page, so what a learner's browser gets never depends on how a row was written
 *      (D-124).
 * Spec: SEC-008, H5P-004
 * Invariants:
 *   - Every `integration.contents[…].jsonContent` of a rendered model is its stored parameters after
 *     ./semanticsConformance.ts: no key a field list does not name, and numbers, booleans, selects and file values
 *     of their field's type. Parameters that need no fix keep their exact text.
 *   - Nothing else is judged here: text was cleaned when the row was saved, and no sub-content is refused, so an
 *     activity that was allowed to be stored still plays.
 *   - A row the walker cannot read as its semantics describe fails the render with 400 `hvl:invalid-params`
 *     (./paramsWalker.ts); the editor's save never stores such a row.
 *   - The stored row is not changed; the model handed on is a copy.
 * Collaborators: ./semanticsConformance.ts, ./paramsWalker.ts, ../H5pPlayerFactory.ts (installs it),
 *   ../../http/routes/playerRoutes.ts (renders the model).
 * Tests: apps/server/test/h5p/semantics/playedParams.test.ts, apps/server/test/h5p/semantics/playedParams.int.test.ts
 */
import { LibraryName, type H5PPlayer, type IPlayerModel } from '@lumieducation/h5p-server';
import { walkParams, type SemanticsLookup } from './paramsWalker.js';
import { semanticsConformance } from './semanticsConformance.js';

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * The parameters of one activity, fitted to its semantics.
 * @param jsonContent - The parameters as the model carries them (JSON text).
 * @param library - The activity's main library, e.g. `H5P.Blanks 1.14`.
 * @param getSemantics - Semantics lookup.
 * @returns The same text when nothing needed fitting, otherwise the fitted parameters as JSON text.
 */
async function fittedJson(
  jsonContent: string,
  library: string,
  getSemantics: SemanticsLookup,
): Promise<string> {
  const params: unknown = JSON.parse(jsonContent);
  if (!isObject(params)) return jsonContent;
  const main = LibraryName.fromUberName(library, { useWhitespace: true });
  const conformance = semanticsConformance();
  await walkParams(params, main, getSemantics, conformance.visit, conformance.onFields);
  return conformance.apply() === 0 ? jsonContent : JSON.stringify(params);
}

/**
 * A player model whose activities' parameters are fitted to their semantics.
 * @param model - The model Lumi rendered.
 * @param getSemantics - Semantics lookup.
 * @returns A copy of the model with every `jsonContent` fitted; the model itself when it carries no content.
 * @throws H5pError `hvl:invalid-params` (400) for parameters that cannot be read as their semantics describe.
 * @spec SEC-008
 */
export async function withFittedContents(
  model: IPlayerModel,
  getSemantics: SemanticsLookup,
): Promise<IPlayerModel> {
  // WHY: the renderer hands over whatever Lumi built; read it as unknown rather than trust the type.
  const contents = (model as { integration?: { contents?: unknown } }).integration?.contents;
  if (!isObject(contents)) return model;
  const fitted: Record<string, unknown> = {};
  for (const [key, content] of Object.entries(contents)) {
    const { jsonContent, library } = isObject(content) ? content : {};
    fitted[key] =
      typeof jsonContent === 'string' && typeof library === 'string'
        ? { ...(content as object), jsonContent: await fittedJson(jsonContent, library, getSemantics) }
        : content;
  }
  const integration = { ...model.integration, contents: fitted as typeof model.integration.contents };
  return { ...model, integration };
}

/**
 * Makes every render of the player carry parameters fitted to their semantics.
 * @param player - The player, with the identity renderer installed (`render` resolves to the model).
 * @param getSemantics - Semantics lookup, on the same libraries the player loads.
 * @spec SEC-008
 */
export function fitPlayedContent(player: H5PPlayer, getSemantics: SemanticsLookup): void {
  const render = player.render.bind(player);
  player.render = async (contentId, actingUser, language, options) =>
    withFittedContents(
      (await render(contentId, actingUser, language, options)) as IPlayerModel,
      getSemantics,
    );
}
