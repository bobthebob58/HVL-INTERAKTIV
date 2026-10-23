/**
 * me — the shapes of `GET /api/me` and `PUT /api/me/notices/:noticeId`: who is signed in, and which notices they
 * have dismissed.
 *
 * Why: the web app needs the person's mode, language and roles to choose its views, and PROD-011 remembers the
 *      dismissal of the formative-use notice per user (D-075). DATA-002 keeps names, e-mail addresses and IDs out of
 *      the answer: the web app never needs them.
 * Spec: PROD-011, DATA-002, DOC-012
 * Invariants:
 *   - `meSchema` has no field for a name, an e-mail address, a Feide ID, an LTI subject or a user ID.
 *   - A notice ID comes from `NOTICE_IDS`; anything else is unknown to the server.
 * Collaborators: ./apiRoutes.ts, apps/server/src/http/api/meRoutes.ts, apps/web.
 * Tests: packages/api-contract/test/schemas.test.ts
 */
import { z } from 'zod';

/** Notices a person can dismiss (D-075); their texts live with the pages that show them. */
export const NOTICE_IDS = ['formative-use'] as const;

/**
 * The current version of each notice. A dismissal of an older version does not hide a newer one (D-075); the web app
 * and the server-rendered Deep Linking picker show the same version.
 */
export const NOTICE_VERSIONS: Readonly<Record<(typeof NOTICE_IDS)[number], number>> = Object.freeze({
  'formative-use': 1,
});

/** A notice ID from the allowlist. */
export const noticeIdSchema = z.enum(NOTICE_IDS);
/** A notice ID from the allowlist. */
export type NoticeId = z.infer<typeof noticeIdSchema>;

/** A supported UI language; Nynorsk is the default (PROD-012). */
export const localeSchema = z.enum(['nn', 'nb', 'en']);
/** A supported UI language. */
export type ApiLocale = z.infer<typeof localeSchema>;

/** A role in HVL Interaktiv (spec 02 `AUTH-002`, `LTI-004`). */
export const roleSchema = z.enum(['learner', 'author', 'admin']);
/** A role in HVL Interaktiv. */
export type ApiRole = z.infer<typeof roleSchema>;

/** One dismissed notice: which one, and the version that was dismissed. */
export const dismissedNoticeSchema = z.strictObject({
  noticeId: noticeIdSchema,
  version: z.int().min(1),
});
/** One dismissed notice. */
export type DismissedNotice = z.infer<typeof dismissedNoticeSchema>;

/**
 * `GET /api/me` → 200: how the person signed in, their language, their roles and their dismissed notices.
 * @spec DATA-002
 */
export const meSchema = z.strictObject({
  /** `portal` (Feide session) or `lti` (a Canvas launch, ltik as Bearer token). */
  kind: z.enum(['portal', 'lti']),
  locale: localeSchema,
  roles: z.array(roleSchema),
  /** Always empty for learners, who never see these notices. */
  dismissedNotices: z.array(dismissedNoticeSchema),
});
/** The answer of `GET /api/me`. */
export type Me = z.infer<typeof meSchema>;

/**
 * `PUT /api/me/notices/:noticeId` body: the version of the notice the person dismissed.
 * @spec PROD-011
 */
export const noticeDismissalRequestSchema = z.strictObject({ version: z.int().min(1) });
/** The body of `PUT /api/me/notices/:noticeId`. */
export type NoticeDismissalRequest = z.infer<typeof noticeDismissalRequestSchema>;
