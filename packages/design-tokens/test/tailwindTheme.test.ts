/**
 * Tests that the generated Tailwind v4 theme works the way the web app imports it: `hvl-*` classes resolve to the
 * token custom properties and Tailwind's own palette is gone.
 *
 * Spec: UD-001, UD-002, UD-005
 */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { compile } from 'tailwindcss';
import { beforeAll, describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const TAILWIND_INDEX = resolve(dirname(require.resolve('tailwindcss/package.json')), 'index.css');

/** Resolves `@import` the way the web app's build does: package exports, then relative paths. */
async function loadStylesheet(id: string, base: string) {
  const path =
    id === 'tailwindcss' ? TAILWIND_INDEX : id.startsWith('.') ? resolve(base, id) : require.resolve(id);
  return { path, base: dirname(path), content: readFileSync(path, 'utf8') };
}

/** The rule Tailwind generated for one class, or undefined. */
const ruleFor = (css: string, cls: string) =>
  new RegExp(`\\.${cls.replaceAll('-', '\\-')} \\{([^}]*)\\}`).exec(css)?.[1]?.replace(/\s+/g, ' ').trim();

describe('the Tailwind v4 theme file', () => {
  let css = '';
  beforeAll(async () => {
    const input = "@import 'tailwindcss';\n@import '@hvl-interaktiv/design-tokens/tailwind-theme.css';\n";
    const compiler = await compile(input, { base: import.meta.dirname, loadStylesheet });
    css = compiler.build([
      'bg-hvl-surface',
      'text-hvl-ink',
      'border-hvl-accent',
      'bg-red-500',
      'text-white',
      'bg-black',
      'font-ui',
      'font-body',
      'font-sans',
      'min-h-target',
      'min-w-target',
      'size-target',
      'max-w-measure',
      'leading-body',
    ]);
  });

  it('[UD-001] hvl-* colour classes resolve to the token custom properties', () => {
    expect(ruleFor(css, 'bg-hvl-surface')).toBe('background-color: var(--hvl-surface);');
    expect(ruleFor(css, 'text-hvl-ink')).toBe('color: var(--hvl-ink);');
    expect(ruleFor(css, 'border-hvl-accent')).toContain('border-color: var(--hvl-accent);');
  });

  it("[UD-001] Tailwind's own palette produces no classes", () => {
    expect(ruleFor(css, 'bg-red-500')).toBeUndefined();
    expect(ruleFor(css, 'text-white')).toBeUndefined();
    expect(ruleFor(css, 'bg-black')).toBeUndefined();
    expect(css).not.toContain('--color-red-500');
  });

  it('[UD-001] the import brings the token values along', () => {
    expect(css).toContain('--hvl-primary-dark: #004357;');
  });

  it('[UD-002] font and leading classes use the HVL stacks and line height', () => {
    expect(ruleFor(css, 'font-ui')).toBe('font-family: var(--hvl-font-ui);');
    expect(ruleFor(css, 'font-sans')).toBe('font-family: var(--hvl-font-ui);');
    expect(ruleFor(css, 'font-body')).toBe('font-family: var(--hvl-font-body);');
    expect(ruleFor(css, 'leading-body')).toContain('line-height: var(--hvl-line-height-body);');
    expect(ruleFor(css, 'max-w-measure')).toBe('max-width: var(--hvl-measure);');
  });

  it('[UD-005] min-h-target, min-w-target and size-target give the 24 px pointer target', () => {
    expect(ruleFor(css, 'min-h-target')).toBe('min-height: var(--hvl-target-min);');
    expect(ruleFor(css, 'min-w-target')).toBe('min-width: var(--hvl-target-min);');
    expect(ruleFor(css, 'size-target')).toBe('width: var(--hvl-target-min); height: var(--hvl-target-min);');
  });
});
