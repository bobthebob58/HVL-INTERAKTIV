/**
 * xapiStatements — the xAPI bridge's rules for H5P's statements: which are about the activity itself (root), which
 * carry a gradable root result, and how a statement is cut down to the fields the server reads.
 *
 * Why: D-115 lets the bridge send only what the server may store, each statement cut down, so that no question text,
 *      choice, feedback or actor leaves the page and a batch stays small: H5P does not bound answers (probe P1: one
 *      gap of 5 000 characters made a statement of 7 967 B), and the `keepalive` flush has 64 KiB. The bridge's
 *      attempt counter needs D-115's root tests, so they are repeated here from the server's module.
 * Spec: LTI-010, DATA-012
 * Invariants:
 *   - PRIVACY: a cut statement holds only `verb.id`, `object.id`, `object.definition.interactionType`, the extensions
 *     `h5p-local-content-id` and `h5p-subContentId`, the IDs of `context.contextActivities.parent` and `category`,
 *     and `result.score` (numbers), `success`, `completion`, `duration` and `response`; never `actor`, texts,
 *     choices or other extensions (DATA-012, D-115).
 *   - `response` is kept only for `choice` and `fill-in`: each gap (between `[,]`) cut to 100 code points, and none
 *     at all when the result is still over 1 000, as packages/api-contract/src/xapiResponseCaps.ts does on the server.
 *   - Root: `object.id` is the content ID, with no `h5p-subContentId` extension and no parent. A root result is a root
 *     `answered` or `completed` whose first category names the main library; it is gradable when `score.max` > 0.
 *   - Pure: reads only its arguments, never throws on any value, never changes what it is given. Defined once per
 *     window, as a read-only global, before ./xapiBridge.js reads it.
 * SPEC-DEVIATION: D-115 — LTI-010 posts each statement; the bridge sends only what the server stores, cut down.
 * Collaborators: ./xapiBridge.js (the only reader; loaded right after this file), apps/server/src/h5p/h5pAssets.ts
 *   (lists both as player-only scripts).
 * Tests: packages/hvl-h5p-theme/test/xapiStatements.test.ts
 */
(function hvlXapiStatements() {
  'use strict';
  if (window.hvliXapiStatements) return;

  var VERB_NAMESPACE = 'http://adlnet.gov/expapi/verbs/';
  var LOCAL_CONTENT_ID = 'http://h5p.org/x-api/h5p-local-content-id';
  var SUBCONTENT_ID = 'http://h5p.org/x-api/h5p-subContentId';
  var LIBRARY_CATEGORY = 'http://h5p.org/libraries/';
  var STORED_INTERACTION_TYPES = ['choice', 'fill-in'];
  var GAP_SEPARATOR = '[,]';
  var GAP_MAX = 100;
  var RESPONSE_MAX = 1000;

  function isObject(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  /** The object's definition, or an empty one. */
  function definitionOf(statement) {
    var object = isObject(statement) && isObject(statement.object) ? statement.object : {};
    return isObject(object.definition) ? object.definition : {};
  }

  function extensionsOf(statement) {
    var extensions = definitionOf(statement).extensions;
    return isObject(extensions) ? extensions : {};
  }

  function activitiesOf(statement) {
    var context = isObject(statement) && isObject(statement.context) ? statement.context : {};
    return isObject(context.contextActivities) ? context.contextActivities : {};
  }

  /** The verb's last segment (`answered`), or '' for a verb outside ADL's namespace. */
  function verbOf(statement) {
    var verb = isObject(statement) && isObject(statement.verb) ? statement.verb.id : undefined;
    return typeof verb === 'string' && verb.indexOf(VERB_NAMESPACE) === 0
      ? verb.slice(VERB_NAMESPACE.length)
      : '';
  }

  /** About the activity itself: D-115's three structural tests, which no single one of replaces. */
  function isRoot(statement, contentId) {
    if (!isObject(statement) || !isObject(statement.object) || statement.object.id !== contentId)
      return false;
    var parent = activitiesOf(statement).parent;
    return (
      extensionsOf(statement)[SUBCONTENT_ID] === undefined && !(Array.isArray(parent) && parent.length > 0)
    );
  }

  /** A root `answered` or `completed` whose first category is the main library (`H5P.MultiChoice 1.16`). */
  function isRootResult(statement, contentId, mainLibrary) {
    var verb = verbOf(statement);
    var category = activitiesOf(statement).category;
    var first = Array.isArray(category) && isObject(category[0]) ? category[0].id : undefined;
    return (
      (verb === 'answered' || verb === 'completed') &&
      typeof mainLibrary === 'string' &&
      first === LIBRARY_CATEGORY + mainLibrary.replace(' ', '-') &&
      isRoot(statement, contentId)
    );
  }

  /** A root result with a maximum above 0: the attempt counter moves on after it (D-115). */
  function isGradable(statement, contentId, mainLibrary) {
    var result = isObject(statement) && isObject(statement.result) ? statement.result : {};
    var max = isObject(result.score) ? result.score.max : undefined;
    return typeof max === 'number' && max > 0 && isRootResult(statement, contentId, mainLibrary);
  }

  /** Copies the named keys whose values pass `test`; undefined when none does. */
  function pick(source, keys, test) {
    var out = {};
    var found = false;
    keys.forEach(function copy(key) {
      if (!test(source[key])) return;
      out[key] = source[key];
      found = true;
    });
    return found ? out : undefined;
  }

  function isText(value) {
    return typeof value === 'string';
  }

  function isNumber(value) {
    return typeof value === 'number' && isFinite(value);
  }

  function isFlag(value) {
    return typeof value === 'boolean';
  }

  /** Activity references reduced to their IDs; undefined when there is no list. */
  function idsOf(list) {
    if (!Array.isArray(list)) return undefined;
    return list
      .filter(function hasId(activity) {
        return isObject(activity) && isText(activity.id);
      })
      .map(function idOnly(activity) {
        return { id: activity.id };
      });
  }

  /** The answer the server may store (D-115): capped per gap, dropped whole when still too long. */
  function cappedResponse(response, interactionType) {
    if (!isText(response) && !isNumber(response)) return undefined;
    if (STORED_INTERACTION_TYPES.indexOf(interactionType) < 0) return undefined;
    var capped = String(response)
      .split(GAP_SEPARATOR)
      .map(function capGap(gap) {
        return Array.from(gap).slice(0, GAP_MAX).join('');
      })
      .join(GAP_SEPARATOR);
    // PRIVACY: free text beyond DATA-012's 1 000 characters never leaves the page; it is dropped, not shortened,
    // since a shortened list would shift the gaps INS-003 groups by.
    return Array.from(capped).length > RESPONSE_MAX ? undefined : capped;
  }

  function cutResult(result, interactionType) {
    if (!isObject(result)) return undefined;
    var out = pick(result, ['success', 'completion'], isFlag) || {};
    var score = isObject(result.score)
      ? pick(result.score, ['raw', 'max', 'min', 'scaled'], isNumber)
      : undefined;
    if (score) out.score = score;
    if (isText(result.duration)) out.duration = result.duration;
    var response = cappedResponse(result.response, interactionType);
    if (response !== undefined) out.response = response;
    return Object.keys(out).length > 0 ? out : undefined;
  }

  /** The statement cut down to what the server reads (D-115); the caller has checked the verb and `object.id`. */
  function cut(statement) {
    var definition = definitionOf(statement);
    var interactionType = isText(definition.interactionType) ? definition.interactionType : undefined;
    var extensions = pick(extensionsOf(statement), [LOCAL_CONTENT_ID, SUBCONTENT_ID], isText);
    var out = { verb: { id: statement.verb.id }, object: { id: statement.object.id } };
    if (interactionType || extensions) {
      out.object.definition = {};
      if (interactionType) out.object.definition.interactionType = interactionType;
      if (extensions) out.object.definition.extensions = extensions;
    }
    var activities = pick(
      { parent: idsOf(activitiesOf(statement).parent), category: idsOf(activitiesOf(statement).category) },
      ['parent', 'category'],
      Array.isArray,
    );
    if (activities) out.context = { contextActivities: activities };
    var result = cutResult(statement.result, interactionType);
    if (result) out.result = result;
    return out;
  }

  Object.defineProperty(window, 'hvliXapiStatements', {
    value: Object.freeze({ verbOf: verbOf, isRoot: isRoot, isGradable: isGradable, cut: cut }),
  });
})();
