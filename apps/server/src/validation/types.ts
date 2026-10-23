/**
 * types — the contract of the pre-publish validator: what goes in, what comes out, and the configuration it is
 * given.
 *
 * Why: the validator is pure (UD-020, D-073), and the publish API, the findings API and the tests all depend on the
 *      same shapes. Configuration (hint thresholds, captioned media origins) is loaded once at start-up outside
 *      this folder and passed in, so the function itself never reads a file or the environment.
 * Spec: UD-020, UD-021, PED-020
 * Invariants:
 *   - `path` is a JSON path into the activity's parameters (content.json) in dot-and-bracket form, e.g.
 *     `questions[2].params.answers[1].tipsAndFeedback.chosenFeedback`; the empty string means the activity as a
 *     whole, and `metadata.<field>` points into the metadata instead.
 *   - `requirement` is `UD-021` for `V-*` rules and `PED-020` for `PED-H*` rules.
 *   - `message` is plain language in the requested locale and says what to do.
 * Collaborators: ./validateContent.ts, ../http/api (findings and publish), ../config/validationContext.ts.
 * Tests: types only, checked by the compiler wherever they are used.
 */

/** How much a finding matters: only `error` can block publishing (PROD-003). */
export type FindingSeverity = 'error' | 'warning' | 'hint';

/** One problem the validator found. */
export interface Finding {
  /** e.g. `V-IMG-ALT` or `PED-H05`. */
  readonly ruleId: string;
  readonly severity: FindingSeverity;
  /** The spec ID the rule implements: `UD-021` or `PED-020`. */
  readonly requirement: string;
  /** Where in the parameters (see the module header), for "Go to field". */
  readonly path: string;
  /** Localised, plain language, says what to do. */
  readonly message: string;
}

/** The activity metadata the rules read (h5p.json-style; other fields are ignored). */
export interface ValidationMetadata {
  readonly title?: string;
  readonly defaultLanguage?: string;
  readonly [field: string]: unknown;
}

/** What is validated. */
export interface ValidationInput {
  /** e.g. `H5P.InteractiveVideo 1.28`. */
  readonly mainLibrary: string;
  /** The activity's parameters (content.json). */
  readonly params: unknown;
  readonly metadata: ValidationMetadata;
  /** The language of the messages. */
  readonly locale: 'nn' | 'nb' | 'en';
}

/** Thresholds of the pedagogical hint rules (content/laeringsdesign/hint-thresholds.yaml, spec 04 §5). */
export type HintThresholds = Readonly<Record<string, number>>;

/** Configuration the validator is given (D-073). */
export interface ValidationContext {
  readonly thresholds: HintThresholds;
  /** Origins whose videos count as captioned (`CAPTIONED_MEDIA_ORIGINS`), e.g. `https://hvl.cloud.panopto.eu`. */
  readonly captionedMediaOrigins: readonly string[];
}

/** The validator as its callers see it (the publish and findings APIs take it as a dependency). */
export type ContentValidator = (input: ValidationInput) => readonly Finding[];
