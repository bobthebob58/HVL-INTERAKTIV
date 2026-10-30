/**
 * deepLinkItems — the content items a Deep Linking response returns to Canvas, and the checks on what the platform
 * accepts.
 *
 * Why: LTI-005 returns each chosen activity as an `ltiResourceLink` that launches `/lti/launch` with
 *      `custom.contentId`. Canvas turns a `lineItem` into a gradebook assignment only for `assignment_selection`, so
 *      only that placement gets one (D-061), and a platform that did not ask for several items must get one.
 * Spec: LTI-005, PROD-005, LTI-013
 * Invariants:
 *   - The placement is Canvas's placement claim *(verify, D-061)*, else our custom field `hvl_placement`; a known
 *     value maps to itself, anything else (or nothing) to `other`.
 *   - Each item: `type: 'ltiResourceLink'`, the activity title, `url` = `<PUBLIC_BASE_URL>/lti/launch`,
 *     `custom: { contentId }`, an `iframe` size hint, and a `lineItem` only for `assignment_selection`.
 *   - A `lineItem`'s label says the points are formative as `AGS_LABEL_MODE` chooses (D-105, ./formativeLabel.ts):
 *     «Tittel (formativ)» by default, or the title with Canvas's keep-the-name extension and a description.
 *   - Refused with DeepLinkItemsError: no activity; `accept_types` without `ltiResourceLink`; more than one activity
 *     unless `accept_multiple` is the boolean `true` (stricter than ltijs, which sends one silently).
 *   - A return URL is acceptable only as an absolute http(s) URL (D-061), never `javascript:` or `data:`.
 * Collaborators: ./deepLinkActivities.ts, ./deepLinkRoutes.ts, ./formativeLabel.ts, ../storage/ltiIdTokenClaims.ts
 *   (the claims kept for a resumed launch include both placement sources), ltijs `createDeepLinkingMessage`.
 * Tests: apps/server/test/lti/deepLinking/deepLinkItems.test.ts, apps/server/test/lti/deepLinking/formativeLabel.test.ts
 */
import { CANVAS_PLACEMENT_CLAIM, LTI_CUSTOM_CLAIM } from '../storage/ltiIdTokenClaims.js';
import { gradedNaming, PRESERVE_NAME_EXTENSION, type LineItemLabelling } from './formativeLabel.js';

/** Placements that open the picker, as far as the item shape depends on them. */
export type DeepLinkPlacement = 'assignment_selection' | 'link_selection' | 'editor_button' | 'other';

/** An activity the author chose in the picker (already checked: own or co-authored, published). */
export interface DeepLinkActivity {
  /** `H5PContent.id`. */
  readonly id: string;
  /** The activity's title; also the Canvas assignment name for `assignment_selection` (with D-105's label). */
  readonly title: string;
}

/** The `deep_linking_settings` claim fields this module reads; values are platform data, checked here. */
export interface DeepLinkSettings {
  /** Item types the platform accepts, e.g. `['ltiResourceLink']`. */
  readonly accept_types?: unknown;
  /** Whether several items may be returned. */
  readonly accept_multiple?: unknown;
}

/** The gradebook column Canvas creates for an `assignment_selection` item (spec 02 `LTI-005`). */
export type DeepLinkLineItem = {
  readonly scoreMaximum: 100;
  readonly label: string;
  readonly resourceId: string;
  readonly tag: 'hvl-interaktiv';
};

/** One LTI Deep Linking 2.0 `ltiResourceLink` item (a type alias, so it fits ltijs's `ContentItem`). */
export type DeepLinkResourceLink = {
  readonly type: 'ltiResourceLink';
  readonly title: string;
  readonly url: string;
  readonly custom: { readonly contentId: string };
  readonly iframe: { readonly width: number; readonly height: number };
  readonly lineItem?: DeepLinkLineItem;
  /** `preserve` mode only: the formative notice, which Canvas writes into the assignment description (D-105). */
  readonly text?: string;
  /** `preserve` mode only: Canvas keeps the teacher's assignment name (D-105). */
  readonly [PRESERVE_NAME_EXTENSION]?: true;
};

/** Why a set of items cannot be returned. */
export type DeepLinkRefusal = 'no-activity' | 'type-not-accepted' | 'multiple-not-accepted';

/** Thrown when the chosen activities cannot be returned to this Deep Linking request. */
export class DeepLinkItemsError extends Error {
  /**
   * @param reason - What the platform's settings or the choice do not allow.
   */
  constructor(readonly reason: DeepLinkRefusal) {
    super(`cannot return deep-link items: ${reason}`);
    this.name = 'DeepLinkItemsError';
  }
}

/** The size hint sent with every item; H5P content resizes itself, so the platform may ignore it. */
export const DEEP_LINK_IFRAME_SIZE = Object.freeze({ width: 800, height: 600 });

/** The line-item tag that marks columns created by HVL Interaktiv. */
export const LINE_ITEM_TAG = 'hvl-interaktiv';

/** The label mode when the caller names none: the spec as written (D-105). */
const SUFFIX: LineItemLabelling = { mode: 'suffix' };

const KNOWN_PLACEMENTS: readonly DeepLinkPlacement[] = [
  'assignment_selection',
  'link_selection',
  'editor_button',
];

const isObject = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * The placement that opened a Deep Linking request (D-061).
 * @param claims - The launch's ID-token claims (full, or the stored allowlist of a resumed launch).
 * @returns The known placement, or `other`.
 * @spec LTI-005
 */
export function placementOf(claims: Readonly<Record<string, unknown>>): DeepLinkPlacement {
  const custom = claims[LTI_CUSTOM_CLAIM];
  const fromCanvas = claims[CANVAS_PLACEMENT_CLAIM];
  // WHY: Canvas's own claim wins when present; `hvl_placement` is set per placement in the developer key (Q13).
  const value =
    typeof fromCanvas === 'string' ? fromCanvas : isObject(custom) ? custom.hvl_placement : undefined;
  return KNOWN_PLACEMENTS.find((known) => known === value) ?? 'other';
}

/**
 * Builds the items for the chosen activities (spec 02 `LTI-005`).
 * @param request - The chosen activities, the placement, `PUBLIC_BASE_URL`, the `deep_linking_settings` claim and,
 *   for graded items, how they are labelled formative (D-105; `suffix` when left out).
 * @returns One frozen `ltiResourceLink` item per activity, in the order chosen.
 * @throws DeepLinkItemsError when there is no activity, the platform does not accept `ltiResourceLink`, or several
 *   activities were chosen and `accept_multiple` is not `true`.
 * @example
 * buildDeepLinkItems({ activities: [{ id, title }], placement: placementOf(claims), publicBaseUrl, settings });
 * @spec LTI-005
 * @spec LTI-013
 */
export function buildDeepLinkItems(request: {
  readonly activities: readonly DeepLinkActivity[];
  readonly placement: DeepLinkPlacement;
  readonly publicBaseUrl: string;
  readonly settings: DeepLinkSettings;
  readonly labelling?: LineItemLabelling;
}): readonly DeepLinkResourceLink[] {
  const { activities, placement, publicBaseUrl, settings, labelling = SUFFIX } = request;
  if (activities.length === 0) throw new DeepLinkItemsError('no-activity');
  const acceptTypes = settings.accept_types;
  if (!Array.isArray(acceptTypes) || !acceptTypes.includes('ltiResourceLink')) {
    throw new DeepLinkItemsError('type-not-accepted');
  }
  // WHY: only the boolean `true` allows several items; Canvas sends `false` for `assignment_selection`, and ltijs
  // would otherwise drop the extra items without telling the author (D-061).
  if (activities.length > 1 && settings.accept_multiple !== true) {
    throw new DeepLinkItemsError('multiple-not-accepted');
  }
  // SECURITY: links always point at our own launch URL, never at a URL taken from the request (LTI-005).
  const url = new URL('/lti/launch', publicBaseUrl).href;
  return Object.freeze(activities.map((activity) => resourceLink(activity, placement, url, labelling)));
}

function resourceLink(
  activity: DeepLinkActivity,
  placement: DeepLinkPlacement,
  url: string,
  labelling: LineItemLabelling,
): DeepLinkResourceLink {
  const item: DeepLinkResourceLink = {
    type: 'ltiResourceLink',
    title: activity.title,
    url,
    custom: Object.freeze({ contentId: activity.id }),
    iframe: DEEP_LINK_IFRAME_SIZE,
  };
  // WHY: Canvas ignores a lineItem from link_selection and editor_button, so only the graded placement gets one.
  if (placement !== 'assignment_selection') return Object.freeze(item);
  // PEDAGOGY: the points are formative; the label or the description says so wherever Canvas shows them (LTI-013).
  const { label, itemFields } = gradedNaming(activity.title, labelling);
  const lineItem: DeepLinkLineItem = Object.freeze({
    scoreMaximum: 100,
    label,
    resourceId: activity.id,
    tag: LINE_ITEM_TAG,
  });
  return Object.freeze({ ...item, ...itemFields, lineItem });
}

/**
 * Tells whether a `deep_link_return_url` may receive the response form (D-061).
 * @param url - The claim's value.
 * @returns True only for an absolute `http:` or `https:` URL.
 * @spec LTI-005
 */
export function isAllowedReturnUrl(url: unknown): boolean {
  // SECURITY: the form posts to this URL; a `javascript:` or `data:` URL would run script in our origin.
  if (typeof url !== 'string' || !URL.canParse(url)) return false;
  const { protocol } = new URL(url);
  return protocol === 'https:' || protocol === 'http:';
}
