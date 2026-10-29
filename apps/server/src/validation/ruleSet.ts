/**
 * ruleSet — every rule the validator runs: the eleven universal-design rules of UD-021, V-PLACEHOLDER for the
 * guidance a pattern leaves (PROD-001, D-086) and the eleven pedagogical hint rules of spec 04 §5.
 *
 * Why: one list is the single place that says what the validator checks; the engine runs it, and the tests check
 *      that it is complete, that IDs are unique and that pedagogy never blocks publishing (PED rules are not errors).
 * Spec: UD-021, PED-020, PROD-001
 * Invariants:
 *   - Exactly one rule per rule ID, in the order of the spec tables.
 *   - Adding a rule means adding its file under ./rules/, its messages in ./locales/ and its fixtures.
 * Collaborators: ./rules/*.ts, ./validateContent.ts.
 * Tests: apps/server/test/validation/validateContent.test.ts
 */
import type { ValidationRule } from './rule.js';
import { branchColourRule } from './rules/branchColourRule.js';
import { branchingStructureHint } from './rules/branchingStructureHint.js';
import { chapterInteractionHint } from './rules/chapterInteractionHint.js';
import { colourWordsRule } from './rules/colourWordsRule.js';
import { columnActivitiesHint } from './rules/columnActivitiesHint.js';
import { headingOrderRule } from './rules/headingOrderRule.js';
import { hotspotOrderRule } from './rules/hotspotOrderRule.js';
import { imageAltLengthRule } from './rules/imageAltLengthRule.js';
import { imageAltRule } from './rules/imageAltRule.js';
import { languageRule } from './rules/languageRule.js';
import { linkTextRule } from './rules/linkTextRule.js';
import { overallFeedbackHint } from './rules/overallFeedbackHint.js';
import { placeholderRule } from './rules/placeholderRule.js';
import { questionSetSizeHint } from './rules/questionSetSizeHint.js';
import { retryAndSolutionsHint } from './rules/retryAndSolutionsHint.js';
import { slideWordsHint } from './rules/slideWordsHint.js';
import { tableHeadersRule } from './rules/tableHeadersRule.js';
import { videoCaptionsRule } from './rules/videoCaptionsRule.js';
import { videoInteractionGapHint } from './rules/videoInteractionGapHint.js';
import { videoLengthHint } from './rules/videoLengthHint.js';
import { videoSummaryHint } from './rules/videoSummaryHint.js';
import { videoTranscriptRule } from './rules/videoTranscriptRule.js';
import { wrongOptionFeedbackHint } from './rules/wrongOptionFeedbackHint.js';

/** Every validator rule: universal design first, then V-PLACEHOLDER, then the hints, each group in spec order. */
export const RULES: readonly ValidationRule[] = [
  imageAltRule,
  imageAltLengthRule,
  videoCaptionsRule,
  videoTranscriptRule,
  hotspotOrderRule,
  tableHeadersRule,
  headingOrderRule,
  linkTextRule,
  languageRule,
  colourWordsRule,
  branchColourRule,
  placeholderRule,
  videoLengthHint,
  videoInteractionGapHint,
  videoSummaryHint,
  questionSetSizeHint,
  wrongOptionFeedbackHint,
  branchingStructureHint,
  retryAndSolutionsHint,
  columnActivitiesHint,
  slideWordsHint,
  chapterInteractionHint,
  overallFeedbackHint,
];
