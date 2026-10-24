/**
 * validationMessages — the validator's finding messages in Nynorsk, Bokmål and English.
 *
 * Why: a finding's message is user-facing text, so it lives in locale files (DOC-009), with Nynorsk as the
 *      reference (PROD-012). The validator has its own catalogue (D-073) because the web app shows these messages
 *      next to editor fields, apart from the server's page and error strings.
 * Spec: UD-020, PED-020
 * Invariants:
 *   - `nn.json` is the reference: `ValidationMessageKey` is derived from it; doc-lint keeps nb and en in step.
 *   - A missing message falls back to Nynorsk, then to the key itself; it never throws.
 *   - `{{name}}` placeholders are filled from `values`; an unknown placeholder stays visible.
 *   - Numbers are written the way the locale writes them, with at most one decimal (`11,5` and `1 500` in nn and
 *     nb, `11.5` and `1,500` in en). Intl.NumberFormat with an explicit locale is pure, so the validator stays
 *     deterministic (D-073). Rules round a value before they pass it, so that it never contradicts the trigger.
 * Collaborators: ./locales/*.json, ./validateContent.ts, ../i18n/translate.ts (the `Leaves` key type).
 * Tests: apps/server/test/validation/validationMessages.test.ts
 */
import type { Leaves } from '../i18n/translate.js';
import en from './locales/en.json' with { type: 'json' };
import nb from './locales/nb.json' with { type: 'json' };
import nn from './locales/nn.json' with { type: 'json' };
import type { ValidationInput } from './types.js';

/** Every validator message key, e.g. `V-IMG-ALT.missing`. */
export type ValidationMessageKey = Leaves<typeof nn>;

/** Values for `{{placeholders}}`. */
export type MessageValues = Readonly<Record<string, string | number>>;

/** A message locale. */
export type ValidationLocale = ValidationInput['locale'];

const CATALOGUES: Readonly<Record<ValidationLocale, unknown>> = { nn, nb, en };

const NUMBER_FORMATS: Readonly<Record<ValidationLocale, Intl.NumberFormat>> = {
  nn: new Intl.NumberFormat('nn', { maximumFractionDigits: 1 }),
  nb: new Intl.NumberFormat('nb', { maximumFractionDigits: 1 }),
  en: new Intl.NumberFormat('en', { maximumFractionDigits: 1 }),
};

/**
 * Looks a key up in one catalogue only (no fallback).
 * @param key - A dotted key, e.g. `V-IMG-ALT.missing`.
 * @param locale - The catalogue.
 * @returns The template, or `undefined` when that catalogue lacks it.
 */
export function messageTemplate(key: string, locale: ValidationLocale): string | undefined {
  const value = key
    .split('.')
    .reduce<unknown>(
      (node, part) => (node as Record<string, unknown> | undefined)?.[part],
      CATALOGUES[locale],
    );
  return typeof value === 'string' ? value : undefined;
}

/**
 * The localised message for a finding.
 * @param key - The message key.
 * @param values - Placeholder values.
 * @param locale - The requested language.
 * @returns The filled-in message.
 */
export function validationMessage(
  key: ValidationMessageKey,
  values: MessageValues = {},
  locale: ValidationLocale = 'nn',
): string {
  const template = messageTemplate(key, locale) ?? messageTemplate(key, 'nn') ?? key;
  const numbers = NUMBER_FORMATS[locale];
  return template.replace(/\{\{(\w+)\}\}/g, (match, name: string) => {
    const value = Object.hasOwn(values, name) ? values[name] : undefined;
    if (value === undefined) return match;
    return typeof value === 'number' ? numbers.format(value) : value;
  });
}
