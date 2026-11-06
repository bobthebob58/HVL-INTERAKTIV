/**
 * canvasServiceTypes.d.mts — the TypeScript shapes of the mock Canvas's LTI Advantage services and their test
 * controls (`canvas.tokens`, `canvas.ags`, `canvas.nrps`); type-only, it has no JavaScript twin.
 *
 * Why: the grade bridge's integration tests (LTI-012, D-104) and the NRPS count's (LTI-008) are strict
 *      TypeScript; ./canvasTypes.d.mts adds these controls to `MockCanvas`, and ./mockPlatform.d.mts re-exports them.
 * Spec: LTI-008, LTI-012
 * Invariants: the shapes match what ./canvasServices.mjs and its modules return and accept.
 * Collaborators: ./canvasTypes.d.mts, ./mockPlatform.d.mts, ./canvasServices.mjs.
 * Tests: tools/mock-platform/test/canvasAgs.test.mjs (behaviour); `npx tsc -p apps/server --noEmit` (callers).
 */

/** A service a fault can target. */
export type FaultTarget = 'token' | 'scores' | 'lineItems' | 'memberships';

/** A fault for the next `count` requests (default 1): a status, a delay, or a delay and then a status. */
export interface ServiceFault {
  count?: number;
  /** 400–599, e.g. 503, 404 or 429. */
  status?: number;
  /** Seconds, sent as `Retry-After` (e.g. with 429). */
  retryAfter?: number;
  /** Milliseconds to wait first (at most 120 000); without `status` the request is then served normally. */
  delayMs?: number;
  /** An OAuth error code for the body, e.g. `invalid_grant`, instead of Canvas's `errors` list. */
  error?: string;
}

/** What was wrong with a client assertion, in check order. */
export type ClientAssertionProblem =
  | 'invalid-jwt'
  | 'wrong-alg'
  | 'unknown-kid'
  | 'bad-signature'
  | 'jwks-unavailable'
  | 'wrong-iss'
  | 'wrong-sub'
  | 'wrong-aud'
  | 'bad-iat'
  | 'expired'
  | 'missing-jti'
  | 'reused-jti'
  | 'unknown-client';

/** One request to the token endpoint. The access token itself is never recorded. */
export interface TokenRequestRecord {
  ok: boolean;
  status: number;
  /** The OAuth error code when refused. */
  error?: string;
  problems: ClientAssertionProblem[];
  /** The requested scopes. */
  scopes: string[];
  /** True when an injected fault answered. */
  fault: boolean;
  receivedAt: string;
}

/** The token endpoint's controls. */
export interface MockCanvasTokens {
  readonly requests: readonly TokenRequestRecord[];
  /** Forgets every access token, so the next service call answers 401. */
  revokeAll(): void;
  failNext(fault: ServiceFault): void;
}

/** An AGS line item as the service answers it; `id` is its URL. */
export interface LineItem {
  id: string;
  label: string;
  scoreMaximum: number;
  resourceLinkId?: string;
  resourceId?: string;
  tag?: string;
}

/** A line item to add; `courseId` defaults to `mock-course-1`, `id` to the next free number. */
export interface LineItemSpec {
  courseId?: string;
  id?: string;
  label: string;
  scoreMaximum: number;
  resourceLinkId?: string;
  resourceId?: string;
  tag?: string;
}

/** An AGS score body (AGS 2.0 §3.4). */
export interface AgsScore {
  userId: string;
  scoreGiven?: number;
  scoreMaximum?: number;
  comment?: string;
  timestamp: string;
  activityProgress: 'Initialized' | 'Started' | 'InProgress' | 'Submitted' | 'Completed';
  gradingProgress: 'FullyGraded' | 'Pending' | 'PendingManual' | 'Failed' | 'NotReady';
  [extension: string]: unknown;
}

/** One accepted score. */
export interface AcceptedScore {
  lineItemUrl: string;
  courseId: string;
  score: AgsScore;
  receivedAt: string;
}

/** Why a score post was refused; the first problem, in Canvas's check order, decides the answer. */
export type ScoreProblem =
  | 'unknown-line-item'
  | 'invalid-json'
  | 'unknown-user'
  | 'missing-activity-progress'
  | 'missing-grading-progress'
  | 'missing-timestamp'
  | 'bad-timestamp'
  | 'stale-timestamp'
  | 'bad-score-maximum'
  | 'bad-score-given'
  | 'bad-activity-progress'
  | 'bad-grading-progress'
  | 'unsupported-media-type';

/** One score post, accepted or not. `lineItemUrl` is undefined for an unknown or deleted line item. */
export interface ScorePostRecord {
  ok: boolean;
  status: number;
  problems: ScoreProblem[];
  lineItemUrl: string | undefined;
  /** The body, when the request got as far as reading it. */
  score?: Record<string, unknown>;
  fault: boolean;
  receivedAt: string;
}

/** The AGS controls. */
export interface MockCanvasAgs {
  /** Every accepted score, oldest first. */
  readonly scores: readonly AcceptedScore[];
  /** Every score post, including refused ones and injected faults. */
  readonly scorePosts: readonly ScorePostRecord[];
  /** The live line items of one course, or of all courses. */
  lineItems(courseId?: string): LineItem[];
  /** Adds a line item. Throws a RangeError for an invalid one or an ID in use. */
  addLineItem(spec: LineItemSpec): LineItem;
  /** Deletes a line item by URL, as a teacher deletes the assignment; false when there was none. */
  deleteLineItem(url: string): boolean;
  failNextScores(fault: ServiceFault): void;
  /** Faults for line-item reads and lists (not for creating). */
  failNextLineItemReads(fault: ServiceFault): void;
}

/** An NRPS member as the service answers it (no name, e-mail or picture: `privacy_level` `anonymous`). */
export interface NrpsMember {
  status?: 'Active' | 'Inactive' | 'Deleted';
  user_id: string;
  roles: string[];
}

/** The NRPS controls. */
export interface MockCanvasNrps {
  /** A copy of the course roster (default: the demo teacher and student, plus everyone launched there). */
  members(courseId: string): Required<NrpsMember>[];
  /** Replaces a course roster. Throws a TypeError for a member without `user_id` or with an unknown status. */
  setMembers(courseId: string, members: readonly NrpsMember[]): void;
  failNext(fault: ServiceFault): void;
}
