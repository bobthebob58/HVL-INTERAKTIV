/**
 * contentVersionOnPages — puts the activity's version into the learner-state URL of every player page (portal
 * `/h5p/play/:id` and Canvas `/lti/play`), and reads it back from a state write.
 *
 * Why: D-093 (amendment of probe P3): a page opened before a structural save keeps posting its old state every few
 *      seconds. Each page therefore sends the `H5PContent.version` it was rendered with, as the query parameter
 *      `contentVersion` of H5P's `contentUserData` URL (h5p.js fills in only the path placeholders and keeps the
 *      query), and the state route drops a write whose version is no longer the activity's
 *      (../../http/routes/userDataRoutes.ts, ../../h5p/storage/stateWriteVersion.ts).
 * Spec: PROD-013, H5P-005
 * Invariants:
 *   - The version is read before Lumi renders: if a structural save lands in between, the page carries the older
 *     version and its writes are dropped (the learner loses only that visit's progress) instead of a newer version
 *     with the older parameters, whose writes would be kept and break the next resume.
 *   - The version is added only to a model Lumi rendered, so only after Lumi's View check; a refused render
 *     reveals nothing.
 *   - `contentVersion` is a positive integer of at most nine digits; anything else is 400 `error.badRequest`.
 * Collaborators: ../../h5p/H5pPlayerFactory.ts (wraps the player), ../../h5p/createH5pRuntime.ts (the reader),
 *   ../../http/routes/userDataRoutes.ts (reads the parameter), ../../infra/prismaClient.ts.
 * Tests: apps/server/test/learningDesign/safeEditing/contentVersionOnPages.test.ts,
 *   apps/server/test/learningDesign/safeEditing/staleStateWrites.int.test.ts
 */
import type { H5PPlayer, IPlayerModel } from '@lumieducation/h5p-server';
import { isContentUuid } from '../../h5p/contentIds.js';
import { HttpError } from '../../http/HttpError.js';
import type { Database } from '../../infra/prismaClient.js';

/** The query parameter of the state URL that carries the version. */
export const CONTENT_VERSION_PARAM = 'contentVersion';

const VERSION = /^[1-9]\d{0,8}$/;

/** Reads an activity's current version. */
export interface ContentVersionReader {
  /**
   * @param contentId - The activity, as the request names it.
   * @returns Its `H5PContent.version`, or undefined when there is no such activity.
   */
  currentVersion(contentId: string): Promise<number | undefined>;
}

/** `ContentVersionReader` on PostgreSQL. */
export class PrismaContentVersionReader implements ContentVersionReader {
  /**
   * @param db - Database client.
   */
  constructor(private readonly db: Database) {}

  /** The stored version; an ID that is no UUID is no activity and never reaches the database. */
  async currentVersion(contentId: string): Promise<number | undefined> {
    if (!isContentUuid(contentId)) return undefined;
    // WHY: lower case, as PostgreSQL returns it: Prisma batches `findUnique` calls of one tick and matches the rows
    // back by string equality, so an ID the URL spells in upper case could otherwise miss its row.
    const id = contentId.toLowerCase();
    const row = await this.db.h5PContent.findUnique({ where: { id }, select: { version: true } });
    return row?.version;
  }
}

/**
 * A player model whose learner-state URL carries the version.
 * @param model - The model Lumi rendered (the identity renderer of ../../h5p/H5pPlayerFactory.ts).
 * @param version - The activity's version, read before the render.
 * @returns A copy with `contentVersion=<version>` added to `integration.ajax.contentUserData`; the model unchanged
 *   when it has no such URL.
 */
export function withContentVersion(model: IPlayerModel, version: number): IPlayerModel {
  // WHY: the renderer hands over whatever Lumi built; read it as unknown rather than trust the type.
  const loose = model as { integration?: { ajax?: { contentUserData?: unknown } } };
  const url = loose.integration?.ajax?.contentUserData;
  if (typeof url !== 'string') return model;
  const contentUserData = `${url}${url.includes('?') ? '&' : '?'}${CONTENT_VERSION_PARAM}=${String(version)}`;
  const ajax = { ...model.integration.ajax, contentUserData };
  return { ...model, integration: { ...model.integration, ajax } };
}

/**
 * Makes every render of the player carry the activity's version in its learner-state URL.
 * @param player - The player, with the identity renderer installed (`render` resolves to the model).
 * @param versions - Reads the version.
 * @spec PROD-013
 */
export function stampContentVersion(player: H5PPlayer, versions: ContentVersionReader): void {
  const render = player.render.bind(player);
  player.render = async (contentId, actingUser, language, options) => {
    // WHY: before Lumi reads the parameters, see the module header.
    const version = await versions.currentVersion(String(contentId));
    const model = (await render(contentId, actingUser, language, options)) as IPlayerModel;
    return version === undefined ? model : withContentVersion(model, version);
  };
}

/**
 * Reads the version a state write was sent with.
 * @param value - `req.query.contentVersion`.
 * @returns The version, or undefined when the write names none (a client that is not our player page).
 * @throws HttpError 400 `error.badRequest` when the value is not one positive integer.
 */
export function contentVersionOf(value: unknown): number | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'string' || !VERSION.test(value)) throw new HttpError(400, 'error.badRequest');
  return Number(value);
}
