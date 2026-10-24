/**
 * deepLinkRoutes — the Deep Linking picker (`GET /lti/deeplink`) and the API that signs the answer for Canvas
 * (`POST /lti/deeplink/response`).
 *
 * Why: LTI-005 and PROD-005: after a Deep Linking launch the teacher picks own or co-authored activities, and the
 *      tool returns a signed `LtiDeepLinkingResponse` to `deep_link_return_url`. ltijs signs it with the platform's
 *      key (`createDeepLinkingMessage`); this module decides what may be signed (D-061).
 * Spec: LTI-005, PROD-005, LTI-003, LTI-004, PROD-012
 * Invariants:
 *   - Both routes need the ltik of a Deep Linking launch by an author; any other ltik is 403
 *     `hvl:deep-link-not-allowed`. The page takes it from the query (D-058), the API only as a Bearer token.
 *   - Only own or co-authored published activities are signed (404 for anything else, 409 for a draft).
 *   - The return URL must be absolute http(s); the page's CSP lets forms go only to it and to us.
 *   - Responses are `no-store` with `Referrer-Policy: no-referrer`, framed only by `CANVAS_ORIGINS`.
 * Collaborators: ./deepLinkActivities.ts, ./deepLinkItems.ts, ../pages/deepLinkPickerPage.ts,
 *   ../ltikPrincipal.ts, ../http/ltiPageHeaders.ts, ../ltiRoutes.ts.
 * Tests: apps/server/test/lti/deepLinking/deepLinking.int.test.ts
 */
import { NOTICE_VERSIONS } from '@hvl-interaktiv/api-contract';
import express, { Router, type Request } from 'express';
import { canAuthor } from '../../auth/Principal.js';
import { authError } from '../../http/authErrors.js';
import { HttpError } from '../../http/HttpError.js';
import type { Database } from '../../infra/prismaClient.js';
import { setLtiPageLocale } from '../http/ltiErrorPages.js';
import { ltiPageCsp, setLtiPageHeaders } from '../http/ltiPageHeaders.js';
import { LTI_DEEP_LINK_PATH } from '../launch/onDeepLinking.js';
import type { ResolvedLtik } from '../ltikPrincipal.js';
import { DEEP_LINK_RESPONSE_PATH, deepLinkPickerPage } from '../pages/deepLinkPickerPage.js';
import { helpLinkFor } from '../../http/pages/helpLink.js';
import { chosenActivities, listPickerActivities, PICKER_LIMIT } from './deepLinkActivities.js';
import {
  buildDeepLinkItems,
  DeepLinkItemsError,
  isAllowedReturnUrl,
  placementOf,
  type DeepLinkPlacement,
  type DeepLinkSettings,
} from './deepLinkItems.js';

const DEEP_LINKING_SETTINGS_CLAIM = 'https://purl.imsglobal.org/spec/lti-dl/claim/deep_linking_settings';
const DEEP_LINKING_REQUEST = 'LtiDeepLinkingRequest';

/** What the Deep Linking routes need. */
export interface DeepLinkRouteDeps {
  readonly db: Database;
  /** Resolves the request's ltik into its launch (../ltikPrincipal.ts). */
  readonly resolveLtik: (ltik: string) => Promise<ResolvedLtik>;
  readonly canvasOrigins: readonly string[];
  /** `PUBLIC_BASE_URL`, for the launch URL of each item. */
  readonly publicBaseUrl: string;
}

/** The Deep Linking request a resolved ltik continues. */
interface DeepLinkRequest {
  readonly returnUrl: string;
  readonly settings: DeepLinkSettings;
  readonly placement: DeepLinkPlacement;
}

const isObject = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

function deepLinkRequestOf(resolved: ResolvedLtik): DeepLinkRequest {
  const { principal, context, facts } = resolved;
  // SECURITY: a resource-link ltik or a learner's ltik can neither open the picker nor get anything signed (LTI-004).
  if (facts.messageType !== DEEP_LINKING_REQUEST || !canAuthor(principal)) {
    throw authError('hvl:deep-link-not-allowed');
  }
  const settings = context.rawIdToken[DEEP_LINKING_SETTINGS_CLAIM];
  if (!isObject(settings) || !isAllowedReturnUrl(settings.deep_link_return_url)) {
    throw authError('hvl:deep-link-not-allowed');
  }
  return {
    returnUrl: settings.deep_link_return_url as string,
    settings,
    placement: placementOf(context.rawIdToken),
  };
}

/** The formative-use notice's current version, unless this teacher dismissed it (PROD-011, D-075). */
async function formativeNoticeVersion(db: Database, userId: string): Promise<number | undefined> {
  const current = NOTICE_VERSIONS['formative-use'];
  const dismissal = await db.noticeDismissal.findUnique({
    where: { userId_noticeId: { userId, noticeId: 'formative-use' } },
    select: { noticeVersion: true },
  });
  return dismissal && dismissal.noticeVersion >= current ? undefined : current;
}

const bearerOf = (req: Request): string | undefined =>
  /^Bearer ([\w.~+/=-]+)$/i.exec(req.headers.authorization ?? '')?.[1];

function contentIdsOf(body: unknown): string[] {
  const ids = isObject(body) ? body.contentIds : undefined;
  if (!Array.isArray(ids) || ids.length > PICKER_LIMIT || !ids.every((id) => typeof id === 'string')) {
    throw new HttpError(400, 'error.badRequest');
  }
  return ids as string[];
}

/**
 * Builds the picker page and the response API.
 * @param deps - Database, ltik resolver, Canvas origins and `PUBLIC_BASE_URL`.
 * @returns A router to mount at `/`.
 */
export function deepLinkRoutes(deps: DeepLinkRouteDeps): Router {
  const router = Router();
  router.get(LTI_DEEP_LINK_PATH, async (req, res) => {
    const ltik = typeof req.query.ltik === 'string' ? req.query.ltik : '';
    if (ltik === '') throw authError('hvl:ltik-invalid');
    const resolved = await deps.resolveLtik(ltik);
    setLtiPageLocale(res, resolved.principal.locale);
    const request = deepLinkRequestOf(resolved);
    const activities = await listPickerActivities(deps.db, resolved.principal.userId);
    const noticeVersion = await formativeNoticeVersion(deps.db, resolved.principal.userId);
    // SECURITY: the page's forms may go only to us and to the platform's return URL (D-061).
    const formAction = `form-action 'self' ${new URL(request.returnUrl).origin}`;
    setLtiPageHeaders(res, ltiPageCsp(deps.canvasOrigins, [formAction]));
    res.type('html').send(
      deepLinkPickerPage({
        locale: resolved.principal.locale,
        activities,
        multiple: request.settings.accept_multiple === true,
        graded: request.placement === 'assignment_selection',
        help: helpLinkFor(res, 'canvas'),
        ...(noticeVersion === undefined ? {} : { noticeVersion }),
      }),
    );
  });
  router.post(DEEP_LINK_RESPONSE_PATH, express.json({ limit: '16kb' }), async (req, res) => {
    // SECURITY: the API takes the ltik only as a header (LTI-003 step 3); a query copy would end up in logs.
    if (req.query.ltik !== undefined) throw authError('hvl:ltik-invalid');
    const ltik = bearerOf(req);
    if (ltik === undefined) throw authError('hvl:ltik-invalid');
    const resolved = await deps.resolveLtik(ltik);
    setLtiPageLocale(res, resolved.principal.locale);
    const request = deepLinkRequestOf(resolved);
    const activities = await chosenActivities(deps.db, resolved.principal.userId, contentIdsOf(req.body));
    let items;
    try {
      items = buildDeepLinkItems({
        activities,
        placement: request.placement,
        publicBaseUrl: deps.publicBaseUrl,
        settings: request.settings,
      });
    } catch (error) {
      if (error instanceof DeepLinkItemsError) throw authError('hvl:deep-link-choice-invalid');
      throw error;
    }
    const jwt = await resolved.context.deepLinking.createDeepLinkingMessage([...items]);
    setLtiPageHeaders(res, ltiPageCsp(deps.canvasOrigins));
    res.json({ returnUrl: request.returnUrl, jwt });
  });
  return router;
}
