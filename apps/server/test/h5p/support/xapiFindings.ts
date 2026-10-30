/**
 * xapiFindings — checks a captured play against probe P1's findings and sums it up in the terms step 3 uses.
 *
 * Why: an upstream upgrade of H5P Core or a content type must fail loudly where the bridge (LTI-010), the
 *      ingestion route (LTI-011) and the mapper (DATA-012) would silently go wrong, so every broken expectation is
 *      reported with the finding it breaks. The labels are those of probe P1's report:
 *   F1  every statement reaches a listener exactly once, in the player document; none reaches the top window, which
 *       has no H5P; H5P embeds the content in a div (no H5P iframe, isFramed, no externalEmbed); no page errors.
 *       The top window is the test's host page, so a relay to it shows as a page error (it has no H5P to call).
 *   F4  the actor is H5P's anonymous user {name: '', mbox: 'mailto:'}.
 *   F5  object.id is the bare content ID, or `<contentId>?subContentId=<id>` for sub-content; every statement,
 *       the context-less restore events too, carries the h5p-local-content-id extension with the content ID (Core's
 *       setObject); the category names an H5P library; a parent is the activity or one of its items.
 *   F6  no `id` or `timestamp`; only LTI-011's verbs; the gradable root result differs by type (asserted per type).
 *   F7  score {min 0, raw, max, scaled = raw/max rounded to 4 decimals, absent when max is 0}; duration
 *       `PT<seconds>S`.
 *   F8  a choice response is the option indices joined by `[,]`; fill-in joins the gaps by `[,]` and keeps empty ones.
 *   F11 H5PIntegration has no reportingIsEnabled, and ajax.contentUserData carries `contentVersion`. D-115 (Q18)
 *       turns reportingIsEnabled on in step 3; that change updates this check and the InteractiveBook test.
 * Spec: H5P-009
 * Invariants:
 *   - `findingViolations` returns one line per broken expectation, each starting with its finding label.
 *   - The summary keeps only what the test asserts per type; it never holds learner data (the actor is anonymous).
 * Collaborators: ./xapiCapture.ts, ./xapiStatementShape.ts.
 * Tests: ../xapiQuestionTypes.browser.int.test.ts, ../xapiContainerTypes.browser.int.test.ts
 */
import type { CapturedStatement, XapiPlay } from './xapiCapture.js';
import {
  ACCEPTED_VERBS,
  ANONYMOUS_ACTOR,
  LOCAL_CONTENT_ID,
  STATEMENT_KEYS,
  VERB_BASE,
  isRootStatement,
  libraryOf,
  subContentIdOf,
  verbOf,
  type XapiStatement,
} from './xapiStatementShape.js';

/** What a play sent, in the terms of P1's report. */
export interface PlaySummary {
  /** `root attempted`, `sub answered`, … sent before the learner did anything, per view. */
  readonly onLoad: string[][];
  /** Every kind of statement sent, sorted and without repeats. */
  readonly kinds: string[];
  /** The gradable root results: root, `answered` or `completed`, with a score. */
  readonly rootResults: { view: number; verb: string; score: string; success?: boolean }[];
  /** Every scored sub-content statement as `library verb raw/max`, in the order sent. */
  readonly subResults: string[];
  /** Every response, by interaction type, in the order sent. */
  readonly responses: Record<string, (string | number)[]>;
}

const CATEGORY = /^http:\/\/h5p\.org\/libraries\/H5P\.\w+-\d+\.\d+$/;
const CHOICE_RESPONSE = /^\d+(\[,\]\d+)*$/;
const DURATION = /^PT\d+(\.\d+)?S$/;
const SAME = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);

/**
 * How P1 classifies a statement: `root` by the four-condition rule, `sub` with a subContentId, `no context` for the
 * restore events that carry no context at all (DragText, QuestionSet), or `unclassified`.
 * @param s - A captured statement.
 * @param contentId - The activity.
 * @param mainLibrary - The main library as `H5P.Name-1.2`.
 * @returns For example `root answered`.
 */
export function kindOf(s: CapturedStatement, contentId: string, mainLibrary: string): string {
  const st = s.statement;
  const kind = isRootStatement(st, contentId, mainLibrary)
    ? 'root'
    : subContentIdOf(st)
      ? 'sub'
      : st.context
        ? 'unclassified'
        : 'no context';
  return `${kind} ${verbOf(st)}`;
}

/**
 * Sums a play up for the per-type assertions.
 * @param play - A finished session.
 * @param mainLibrary - The main library as `H5P.Name-1.2`.
 * @returns The summary.
 */
export function summarise(play: XapiPlay, mainLibrary: string): PlaySummary {
  const kind = (s: CapturedStatement) => kindOf(s, play.contentId, mainLibrary);
  const onLoad = play.facts.map((_, i) =>
    play.statements.filter((s) => s.view === i + 1 && ['load', 'reload'].includes(s.step)).map(kind),
  );
  const rootResults = play.statements
    .filter((s) => /^root (answered|completed)$/.test(kind(s)) && s.statement.result?.score)
    .map(({ view, statement: st }) => ({
      view,
      verb: verbOf(st),
      score: `${st.result!.score!.raw}/${st.result!.score!.max}`,
      ...(st.result!.success === undefined ? {} : { success: st.result!.success }),
    }));
  const subResults = play.statements
    .filter((s) => kind(s).startsWith('sub ') && s.statement.result?.score)
    .map(({ statement: st }) => {
      const { raw, max } = st.result!.score!;
      return `${libraryOf(st) ?? 'no category'} ${verbOf(st)} ${raw}/${max}`;
    });
  const responses: Record<string, (string | number)[]> = {};
  for (const { statement: st } of play.statements) {
    if (st.result?.response === undefined) continue;
    (responses[st.object.definition?.interactionType ?? 'none'] ??= []).push(st.result.response);
  }
  const kinds = [...new Set(play.statements.map(kind))].sort();
  return { onLoad, kinds, rootResults, subResults, responses };
}

/**
 * Checks every captured statement and view against P1's findings F1 and F4–F8, and the player facts F1 and F11.
 * @param play - A finished session.
 * @returns One line per broken expectation, starting with its finding; empty when all hold.
 */
export function findingViolations(play: XapiPlay): string[] {
  const out: string[] = [];
  const cid = play.contentId;
  play.facts.forEach((f, i) => {
    const view = `view ${i + 1}:`;
    if (f.topHasH5P) out.push(`F1 ${view} the top window has H5P, so statements may reach it`);
    if (f.isFramed !== true || f.externalEmbed !== undefined || f.h5pIframes !== 0)
      out.push(
        `F1 ${view} H5P embeds differently (isFramed ${f.isFramed}, externalEmbed ${String(f.externalEmbed)}, ` +
          `${f.h5pIframes} H5P iframes), so its iframe relay may send statements twice`,
      );
    if (f.reportingIsEnabled !== undefined) out.push(`F11 ${view} H5PIntegration.reportingIsEnabled is set`);
    if (!/[?&]contentVersion=\d+/.test(f.contentUserDataUrl))
      out.push(`F11 ${view} ajax.contentUserData carries no contentVersion: ${f.contentUserDataUrl}`);
  });
  for (const error of play.errors) out.push(`F1 a page error was thrown: ${error}`);
  play.statements.forEach((s, i) =>
    out.push(...statementViolations(s.statement, cid).map((v) => `${v} (#${i})`)),
  );
  play.statements.forEach((s, i) => {
    const which = `#${i} ${verbOf(s.statement)} in step "${s.step}"`;
    if (s.frame !== 'player') out.push(`F1 ${which} reached a listener in the ${s.frame} frame`);
    if (s.seenBefore) out.push(`F1 ${which} reached a second listener (sent twice)`);
  });
  return out;
}

/** F4–F8 for one statement. */
function statementViolations(st: XapiStatement, cid: string): string[] {
  const out: string[] = [];
  // PRIVACY: the message names the actor's keys only, never their values (DATA-009).
  if (!SAME(st.actor, ANONYMOUS_ACTOR))
    out.push(`F4 the actor is not H5P's anonymous user (keys ${Object.keys(st.actor ?? {}).join(', ')})`);
  const sub = subContentIdOf(st);
  const objectId = sub ? `${cid}?subContentId=${sub}` : cid;
  if (st.object.id !== objectId) out.push(`F5 object.id is "${st.object.id.replace(cid, '<cid>')}"`);
  const local = st.object.definition?.extensions?.[LOCAL_CONTENT_ID];
  if (local !== cid)
    out.push(`F5 h5p-local-content-id is ${local === undefined ? 'missing' : 'not the content ID'}`);
  const activities = st.context?.contextActivities;
  // WHY: only sub-content may lack a category (InteractiveVideo's Summary statements); restore events have no context.
  if (!sub && st.context && !libraryOf(st))
    out.push('F5 a statement about the activity names no library category');
  if (activities?.category?.some((c) => !CATEGORY.test(c.id)))
    out.push('F5 a category is not an H5P library IRI');
  const parentOk = (id: string) => id === cid || new RegExp(`^${cid}\\?subContentId=[0-9a-f-]{36}$`).test(id);
  if (activities?.parent?.some((p) => !parentOk(p.id)))
    out.push('F5 a parent is not the activity or its item');
  const extra = Object.keys(st).filter((k) => !STATEMENT_KEYS.includes(k));
  if (extra.length) out.push(`F6 the statement has other top-level keys: ${extra.join(', ')}`);
  if (!st.verb.id.startsWith(VERB_BASE) || !(ACCEPTED_VERBS as readonly string[]).includes(verbOf(st)))
    out.push(`F6 the verb ${st.verb.id} is not one LTI-011 accepts`);
  const r = st.result;
  const score = r?.score;
  if (score && !(score.min === 0 && score.raw >= 0 && score.raw <= score.max))
    out.push(`F7 the score is out of LTI-011's bounds: ${JSON.stringify(score)}`);
  // WHY: Core's setScoredResult computes exactly this, and leaves scaled out when max is 0 (D-115's check rests on it).
  const scaled = score && score.max > 0 ? Math.round((score.raw / score.max) * 10000) / 10000 : undefined;
  if (score && score.scaled !== scaled)
    out.push(
      `F7 scaled ${score.scaled} is not raw/max rounded to 4 decimals (${scaled}; none when max is 0)`,
    );
  for (const flag of ['success', 'completion'] as const)
    if (r?.[flag] !== undefined && typeof r[flag] !== 'boolean')
      out.push(`F7 result.${flag} is not a boolean`);
  if (r?.duration !== undefined && !DURATION.test(r.duration)) out.push(`F7 the duration is "${r.duration}"`);
  const type = st.object.definition?.interactionType;
  if (r?.response !== undefined && typeof r.response !== 'string')
    out.push('F8 a sent response is not a string');
  if (type === 'choice' && r?.response !== undefined && !CHOICE_RESPONSE.test(String(r.response)))
    out.push(`F8 a choice response is "${r.response}", not indices joined by [,]`);
  return out;
}
