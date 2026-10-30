/**
 * xapi — the batch of xAPI statements the player's bridge posts to `POST /api/h5p/xapi`, cut down to what the server
 * reads, and the limits the bridge and the server share.
 *
 * Why: LTI-011 validates statements with a zod schema. D-115 fixes what the bridge sends: only what the server may
 *      store, each item cut down to the fields below, with the bridge's own `statementId` (the stored row's ID, so a
 *      statement sent twice is stored once) and `attemptId` (`<viewId>:<n>`, since H5P marks no attempts).
 * Spec: LTI-011, DATA-012, LTI-010
 * Invariants:
 *   - The batch names its activity and the content version the page was rendered with once, and holds 1 to 50 items.
 *   - The server parses the envelope first and each item on its own (`xapiStatementItemSchema`): an invalid item is
 *     discarded without blocking its batch (D-115). `xapiBatchSchema` is the same body for the OpenAPI document.
 *   - PRIVACY: an item's xAPI objects strip every key not named here (`actor`, question text, choices, feedback and
 *     other extensions), so parsing alone drops them (DATA-012); the learner comes from the request, never the body.
 *   - SPEC-DEVIATION: D-115 — the five LTI-011 verbs are all accepted, but the bridge sends only what is stored.
 *   - A score keeps `0 ≤ raw ≤ max` and `0 ≤ scaled ≤ 1` (LTI-011), and `scaled` matches `raw / max` within 0.0001.
 *   - No text the server stores holds U+0000, which PostgreSQL refuses, so a valid item can always be inserted.
 * Collaborators: ./xapiResponseCaps.ts, ./routes/gradeBridgeRoutes.ts, packages/hvl-h5p-theme/src/xapiBridge.js (step
 *   3), apps/server (the xAPI route and the DATA-012 mapper, step 3).
 * Tests: packages/api-contract/test/xapiSchemas.test.ts
 */
import { z } from 'zod';

/** The most items in one batch (D-115). */
export const XAPI_BATCH_MAX_STATEMENTS = 50;
/** The largest batch body the server reads; a larger one is refused with 413 (D-115). */
export const XAPI_BATCH_MAX_BYTES = 64 * 1024;
/** The bridge's own budget for one batch's JSON, so a `keepalive` flush fits the browser's 64 KiB (D-115). */
export const XAPI_BRIDGE_BATCH_BYTES = 60_000;
/** Statements one learner may send per activity and minute; more are answered 429 (LTI-011). */
export const XAPI_RATE_LIMIT_PER_MINUTE = 120;
/** How far `scaled` may differ from `raw / max`: H5P rounds it to four decimals (D-115). */
export const XAPI_SCALED_TOLERANCE = 0.0001;

/** The verbs LTI-011 accepts, as DATA-012's `verb` stores them. */
export const XAPI_VERBS = ['answered', 'completed', 'attempted', 'interacted', 'progressed'] as const;
/** An accepted verb. */
export type XapiVerb = (typeof XAPI_VERBS)[number];
/** The ADL namespace of H5P's verb IRIs; a stored verb is the IRI's last segment. */
export const XAPI_VERB_NAMESPACE = 'http://adlnet.gov/expapi/verbs/';
/** The IRIs of the accepted verbs, in the order of `XAPI_VERBS`, as H5P sends them in `verb.id`. */
export const XAPI_VERB_IDS = [
  'http://adlnet.gov/expapi/verbs/answered',
  'http://adlnet.gov/expapi/verbs/completed',
  'http://adlnet.gov/expapi/verbs/attempted',
  'http://adlnet.gov/expapi/verbs/interacted',
  'http://adlnet.gov/expapi/verbs/progressed',
] as const satisfies readonly `${typeof XAPI_VERB_NAMESPACE}${XapiVerb}`[];

/** H5P's extension on `object.definition` that names the activity (a content ID). */
export const H5P_LOCAL_CONTENT_ID_EXTENSION = 'http://h5p.org/x-api/h5p-local-content-id';
/** H5P's extension on `object.definition` that names the part of the activity a statement is about. */
export const H5P_SUBCONTENT_ID_EXTENSION = 'http://h5p.org/x-api/h5p-subContentId';

/** `<viewId>:<n>`: a page load's random UUID (lower case) and its attempt number from 1 (D-115). */
export const XAPI_ATTEMPT_ID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}:[1-9][0-9]{0,5}$/;

/** A bridge-made attempt ID; the server checks only its shape and reads the view part for the replay rule. */
export const xapiAttemptIdSchema = z
  .string()
  .regex(XAPI_ATTEMPT_ID)
  .describe('`<viewId>:<n>`: the page load’s UUID in lower case, a colon and the attempt number (1–999999).');

const activityRefSchema = z.object({ id: z.string().min(1).max(200) });

/**
 * Text the server stores (the `subContentId`, also read from `object.id`, and the answer). WHY: PostgreSQL text
 * cannot hold U+0000, and one such value would fail its whole batch's insert, not only its own item (D-115).
 */
const storableText = (schema: z.ZodString) =>
  schema.refine((text) => !text.includes('\u0000'), { message: 'U+0000 cannot be stored' });

/** `result.score` as H5P writes it (`setScoredResult`): `raw` always, `max` and `scaled` when it has a maximum. */
export const xapiScoreSchema = z
  .object({
    raw: z.number().min(0),
    max: z.number().min(0).optional(),
    min: z.number().optional(),
    scaled: z.number().min(0).max(1).optional(),
  })
  .refine(({ raw, max }) => max === undefined || raw <= max, { message: 'raw is above max' })
  // WHY: H5P sets `scaled` exactly when `max` is above 0, rounded to four decimals; grading reads `scaled` (D-115).
  .refine(
    ({ raw, max, scaled }) =>
      max !== undefined && max > 0
        ? scaled !== undefined && Math.abs(scaled - raw / max) <= XAPI_SCALED_TOLERANCE
        : scaled === undefined,
    { message: 'scaled must be raw / max (within 0.0001) exactly when max is above 0' },
  );
/** A score. */
export type XapiScore = z.infer<typeof xapiScoreSchema>;

/** One statement of a batch: the xAPI fields the server reads, with the bridge's statement and attempt IDs. */
export const xapiStatementItemSchema = z.object({
  /** `crypto.randomUUID()` per dispatched event; becomes `XapiStatement.id` (D-115). */
  statementId: z.uuid(),
  attemptId: xapiAttemptIdSchema,
  verb: z.object({ id: z.enum(XAPI_VERB_IDS) }),
  object: z.object({
    /** The bare content ID, or `<contentId>?subContentId=<id>`. */
    id: storableText(z.string().min(1).max(200)),
    definition: z
      .object({
        interactionType: z.string().max(32).optional(),
        extensions: z
          .object({
            [H5P_LOCAL_CONTENT_ID_EXTENSION]: z.string().max(64).optional(),
            [H5P_SUBCONTENT_ID_EXTENSION]: storableText(z.string().min(1).max(64)).optional(),
          })
          .optional(),
      })
      .optional(),
  }),
  // WHY: a missing context is valid: InteractiveBook and DragText send statements without one (D-115).
  context: z
    .object({
      contextActivities: z
        .object({
          parent: z.array(activityRefSchema).max(10).optional(),
          category: z.array(activityRefSchema).max(10).optional(),
        })
        .optional(),
    })
    .optional(),
  result: z
    .object({
      score: xapiScoreSchema.optional(),
      success: z.boolean().optional(),
      completion: z.boolean().optional(),
      /** ISO 8601, e.g. `PT3.67S`; an unreadable one is stored as no duration (D-115). */
      duration: z.string().max(64).optional(),
      // WHY: unbounded here: the server cuts it (./xapiResponseCaps.ts); the 64 KiB body limit bounds the request.
      /** Choice indices (`0[,]2`) or gap text joined by `[,]`; BranchingScenario sends a number. */
      response: z.union([storableText(z.string()), z.number()]).optional(),
    })
    .optional(),
});
/** One statement of a batch, after parsing: every key not named in the schema is gone. */
export type XapiStatementItem = z.infer<typeof xapiStatementItemSchema>;

/** The batch as the server first parses it: the envelope, with each item still unchecked. */
export const xapiBatchEnvelopeSchema = z.strictObject({
  /** The activity every item is about; an item about another one is discarded. */
  contentId: z.uuid(),
  /** The version the page was rendered with (D-093); 1 up to the activity's current version. */
  contentVersion: z.int().min(1),
  statements: z.array(z.unknown()).min(1).max(XAPI_BATCH_MAX_STATEMENTS),
});
/** A batch envelope. */
export type XapiBatchEnvelope = z.infer<typeof xapiBatchEnvelopeSchema>;

/** `POST /api/h5p/xapi` body: one activity and version, and 1 to 50 statements (LTI-011, D-115). */
export const xapiBatchSchema = xapiBatchEnvelopeSchema.extend({
  statements: z.array(xapiStatementItemSchema).min(1).max(XAPI_BATCH_MAX_STATEMENTS),
});
/** A batch of statements. */
export type XapiBatch = z.infer<typeof xapiBatchSchema>;
