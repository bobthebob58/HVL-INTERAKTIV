/**
 * branding — the institution's logo, as configuration: none until HVL supplies the official files.
 *
 * Why: spec 03 §2 makes the logo and the institution name configuration, because HVL has applied for university
 *      status under a new name. Until HVL (profil@hvl.no) supplies the logo files (Q2), the header shows the site
 *      name as text. A logo is never recoloured, cropped or animated, so it is a plain image file with its own size.
 * Spec: UD-013, UD-001
 * Invariants:
 *   - A logo is a first-party file under `public/` (DATA-011); its alternative text is the site name.
 *   - The Norwegian (Nynorsk-name) logo serves both `nn` and `nb`.
 * Collaborators: ../components/SiteHeader.tsx.
 * Tests: apps/web/test/components/SiteHeader.test.tsx
 */
import type { Locale } from '../i18n/translate';

/** One logo file. */
export interface BrandLogo {
  /** A path under `public/`, e.g. `/brand/hvl-logo-nn.svg`. */
  readonly src: string;
  readonly width: number;
  readonly height: number;
}

/** The configured logos by language group; empty until HVL supplies them. */
export const BRAND_LOGOS: Readonly<Partial<Record<'no' | 'en', BrandLogo>>> = {};

/**
 * The logo for a page locale.
 * @param locale - The page locale.
 * @returns The logo, or undefined when none is configured (the header then shows text).
 */
export const brandLogo = (locale: Locale): BrandLogo | undefined =>
  locale === 'en' ? (BRAND_LOGOS.en ?? BRAND_LOGOS.no) : BRAND_LOGOS.no;
