/**
 * activityLanguage — the language an activity states for itself, read from its stored h5p.json-style metadata.
 *
 * Why: the language lives in two fields. H5P's editor saves `defaultLanguage`; a package's h5p.json carries
 *      `language`, and Lumi writes `language: 'en'` as a default on every editor save. Lumi's player reads only
 *      `language`, so a Nynorsk activity from our editor would be announced as English. One reading keeps the
 *      validator's V-LANG and the player's `lang` on the content container (UD-010) in agreement.
 * Spec: UD-010, UD-021
 * Invariants:
 *   - `defaultLanguage` wins over `language`; H5P's `und` ("undetermined"), blanks and anything that is not a
 *     language tag (`nn`, `nb`, `en`, `se`, `en-GB`, …) count as not stated.
 *   - Pure: no I/O (the validator imports it, D-073).
 * Collaborators: ./rules/languageRule.ts, ../http/routes/playerRoutes.ts, ../lti/play/ltiPlayRoutes.ts (the
 *   content container), ../lti/ltiRoutes.ts (for ../lti/play/appLaunchRoutes.ts, the Canvas page's title),
 *   ../content/contentSummaries.ts (the portal's activity list and activity page).
 * Tests: apps/server/test/validation/activityLanguage.test.ts
 */

const LANGUAGE_TAG = /^[a-z]{2,3}(?:-[A-Za-z0-9]{1,8})*$/;

const stated = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const tag = value.trim();
  return tag !== 'und' && LANGUAGE_TAG.test(tag) ? tag : undefined;
};

/**
 * The activity's language.
 * @param metadata - Stored metadata (h5p.json style), or anything else.
 * @returns A language tag, or undefined when the activity states none.
 */
export function activityLanguage(metadata: unknown): string | undefined {
  if (typeof metadata !== 'object' || metadata === null) return undefined;
  const { defaultLanguage, language } = metadata as { defaultLanguage?: unknown; language?: unknown };
  return stated(defaultLanguage) ?? stated(language);
}
