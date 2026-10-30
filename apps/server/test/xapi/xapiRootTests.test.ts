/**
 * Unit tests of D-115's root tests: each structural condition alone misclassifies a case probe P1 saw, so only the
 * three together (and the main library's category for a result) find the root; and which stored rows are gradable.
 *
 * Spec: LTI-012, DATA-012
 */
import { randomUUID } from 'node:crypto';
import { xapiStatementItemSchema, type XapiStatementItem } from '@hvl-interaktiv/api-contract';
import { describe, expect, it } from 'vitest';
import {
  isAboutContent,
  isGradableResult,
  isRootResult,
  isRootStatement,
  mainLibraryCategory,
  subContentIdOf,
} from '../../src/xapi/xapiRootTests.js';

const C = '0192f0c4-2222-7000-8000-00000000c0de';
const PART = '6c1f0a52-3d8e-4b7a-9f21-5e4c8b0d7a11';
const SUB = 'http://h5p.org/x-api/h5p-subContentId';
const CATEGORY = 'http://h5p.org/libraries/H5P.QuestionSet-1.21';

/** A parsed statement with the given verb, object, extensions and context. */
const item = (verb: string, objectId: string, extra: Record<string, unknown> = {}): XapiStatementItem =>
  xapiStatementItemSchema.parse({
    statementId: randomUUID(),
    attemptId: `${randomUUID()}:1`,
    verb: { id: `http://adlnet.gov/expapi/verbs/${verb}` },
    object: { id: objectId, ...(extra.extensions ? { definition: { extensions: extra.extensions } } : {}) },
    ...(extra.context ? { context: extra.context } : {}),
  });
const withCategory = (category: string, parent?: string) => ({
  contextActivities: { category: [{ id: category }], ...(parent ? { parent: [{ id: parent }] } : {}) },
});

describe('[LTI-012] the root of an activity (D-115)', () => {
  it('[LTI-012] names the main library’s category with its saved version', () => {
    expect(mainLibraryCategory('H5P.QuestionSet 1.21')).toBe(CATEGORY);
    expect(mainLibraryCategory('H5P.QuestionSet')).toBeUndefined();
  });

  it('[LTI-012] takes the root’s own completed with the main library’s category for a root result', () => {
    const completed = item('completed', C, { context: withCategory(CATEGORY) });
    expect(isRootStatement(completed, C)).toBe(true);
    expect(isRootResult(completed, C, CATEGORY)).toBe(true);
  });

  it('[LTI-012] refuses InteractiveBook’s chapter completed, which has no parent but names its part', () => {
    const chapter = item('completed', `${C}?subContentId=${PART}`, {
      extensions: { [SUB]: PART },
      context: withCategory('http://h5p.org/libraries/H5P.Column-1.22'),
    });
    expect(isRootStatement(chapter, C)).toBe(false);
  });

  it('[LTI-012] refuses a child of content saved without subContentIds, which has a parent', () => {
    const child = item('answered', C, {
      context: withCategory('http://h5p.org/libraries/H5P.MultiChoice-1.16', C),
    });
    expect(isRootStatement(child, C)).toBe(false);
    expect(subContentIdOf(child)).toBeUndefined();
  });

  it('[LTI-012] refuses a root-shaped answer from another library, such as DragText’s context-less statements', () => {
    const contextless = item('answered', C);
    const nested = item('answered', C, {
      context: withCategory('http://h5p.org/libraries/H5P.DragText-1.10'),
    });
    expect(isRootStatement(contextless, C)).toBe(true);
    expect(isRootResult(contextless, C, CATEGORY)).toBe(false);
    expect(isRootResult(nested, C, CATEGORY)).toBe(false);
    expect(isRootResult(nested, C, undefined)).toBe(false);
  });

  it('[LTI-012] refuses a statement whose subContentId is only in the extension', () => {
    const tagged = item('completed', C, { extensions: { [SUB]: PART }, context: withCategory(CATEGORY) });
    expect(isRootStatement(tagged, C)).toBe(false);
    expect(subContentIdOf(tagged)).toBe(PART);
  });

  it('[DATA-012] reads the part from object.id when the extension is missing, and prefers the extension', () => {
    expect(subContentIdOf(item('answered', `${C}?subContentId=${PART}`))).toBe(PART);
    expect(subContentIdOf(item('answered', `${C}?subContentId=x`, { extensions: { [SUB]: PART } }))).toBe(
      PART,
    );
    expect(subContentIdOf(item('answered', `${C}?subContentId=`))).toBeUndefined();
  });

  it('[DATA-012] matches the activity in any case, and refuses another one named by the content-ID extension', () => {
    const local = 'http://h5p.org/x-api/h5p-local-content-id';
    expect(isAboutContent(item('attempted', C.toUpperCase()), C)).toBe(true);
    expect(isAboutContent(item('attempted', `${C}?subContentId=${PART}`), C)).toBe(true);
    expect(isAboutContent(item('attempted', C, { extensions: { [local]: randomUUID() } }), C)).toBe(false);
    expect(isAboutContent(item('attempted', randomUUID()), C)).toBe(false);
  });

  it('[LTI-012] grades only a stored root result with a maximum above 0', () => {
    expect(isGradableResult({ subContentId: null, verb: 'completed', scoreMax: 9 })).toBe(true);
    expect(isGradableResult({ subContentId: null, verb: 'answered', scoreMax: 1 })).toBe(true);
    expect(isGradableResult({ subContentId: null, verb: 'completed', scoreMax: 0 })).toBe(false);
    expect(isGradableResult({ subContentId: null, verb: 'completed', scoreMax: null })).toBe(false);
    expect(isGradableResult({ subContentId: null, verb: 'attempted', scoreMax: 1 })).toBe(false);
    expect(isGradableResult({ subContentId: PART, verb: 'answered', scoreMax: 1 })).toBe(false);
  });
});
