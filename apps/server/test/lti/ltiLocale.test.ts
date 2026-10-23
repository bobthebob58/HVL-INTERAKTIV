/**
 * Tests for choosing the UI language of an LTI launch: Canvas's locale tag mapped to Nynorsk, Bokmål or English,
 * Nynorsk for everything else.
 *
 * Spec: PROD-012
 */
import { describe, expect, it } from 'vitest';
import { localeFromLaunch, localeOfTag } from '../../src/lti/ltiLocale.js';

const PRESENTATION = 'https://purl.imsglobal.org/spec/lti/claim/launch_presentation';

describe('[PROD-012] locale of an LTI launch', () => {
  it.each([
    ['nn', 'nn'],
    ['nn-NO', 'nn'],
    ['NN_no', 'nn'],
    ['nb', 'nb'],
    ['nb-NO', 'nb'],
    ['no', 'nb'],
    ['no-NO', 'nb'],
    ['nb-x-k12', 'nb'],
    ['en', 'en'],
    ['en-GB', 'en'],
    ['en-AU', 'en'],
    ['en-GB-x-ukhe', 'en'],
    [' EN-us ', 'en'],
    ['de', 'nn'],
    ['sv-SE', 'nn'],
    ['se', 'nn'],
    ['nob', 'nn'],
    ['english', 'nn'],
    ['', 'nn'],
    ['__proto__', 'nn'],
    ['constructor', 'nn'],
  ])('[PROD-012] the tag %j selects %s', (tag, locale) => {
    expect(localeOfTag(tag)).toBe(locale);
  });

  it.each([
    ['launch_presentation.locale', { [PRESENTATION]: { locale: 'nb-NO' } }, 'nb'],
    ['the top-level locale', { locale: 'en-GB' }, 'en'],
    [
      'launch_presentation.locale over the top-level locale',
      { [PRESENTATION]: { locale: 'en' }, locale: 'nb' },
      'en',
    ],
    [
      'the top-level locale when launch_presentation has none',
      { [PRESENTATION]: { width: 800 }, locale: 'nb' },
      'nb',
    ],
    [
      'the top-level locale when launch_presentation.locale is blank',
      { [PRESENTATION]: { locale: ' ' }, locale: 'en' },
      'en',
    ],
    [
      'the top-level locale when launch_presentation is not an object',
      { [PRESENTATION]: 'nb', locale: 'en' },
      'en',
    ],
    ['Nynorsk when there is no locale', {}, 'nn'],
    ['Nynorsk when the locale is not text', { locale: ['en'], [PRESENTATION]: { locale: 7 } }, 'nn'],
    ['Nynorsk for an unsupported language', { [PRESENTATION]: { locale: 'de-DE' }, locale: 'en' }, 'nn'],
  ])('[PROD-012] uses %s', (_case, claims, locale) => {
    expect(localeFromLaunch(claims)).toBe(locale);
  });
});
