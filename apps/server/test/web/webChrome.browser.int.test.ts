/**
 * Browser tests for the built web app's chrome across pages: every route has its own document title, the help and
 * privacy links opened from an English Canvas launch show their pages in English, the activity title carries its own
 * language, a Next.js router refresh never writes the ltik back into the address, and under forced colours only the
 * selected tab is underlined.
 *
 * Spec: DATA-006, PROD-012, UD-010, UD-012, UD-013, LTI-003
 */
import { describe, expect, it } from 'vitest';
import { describeWithBrowser } from '../support/browser.js';
import { ACTIVITY, LTIK, LTIK_EN, openWebPage, serveBuiltWebApp, WEB_APP_BUILT } from './webTestServer.js';

(WEB_APP_BUILT ? describe : describe.skip)('[UD-013] the chrome of the built web app', () => {
  const base = serveBuiltWebApp();

  describeWithBrowser('[UD-013] chrome in Chromium', (browser) => {
    it('[UD-013] every route has its own title, its name first and the site name last (WCAG 2.4.2)', async () => {
      // Arrange
      const routes: readonly (readonly [string, string, number?])[] = [
        ['/', 'HVL Interaktiv'],
        ['/hjelp', 'Hjelp – HVL Interaktiv'],
        ['/personvern', 'Personvern – HVL Interaktiv'],
        ['/aktivitet/ny', 'Ny aktivitet – HVL Interaktiv'],
        [`/aktivitet/${ACTIVITY}`, 'Aktivitet – HVL Interaktiv'],
        ['/app/play', 'Opne aktiviteten frå Canvas – HVL Interaktiv'],
        [`/app/play?ltik=${LTIK}`, 'Celler og vev – HVL Interaktiv'],
        ['/laeringsdesign', 'Læringsdesign – HVL Interaktiv'],
        ['/laeringsdesign/monster/fa-video', 'Mønster – HVL Interaktiv'],
        ['/laeringsdesign/planlegg', 'Planleggar – HVL Interaktiv'],
        ['/laeringsdesign/innhaldsbank', 'Innhaldsbank – HVL Interaktiv'],
        ['/mappe', 'Pedagogisk mappe – HVL Interaktiv'],
        ['/finst-ikkje', 'Fann ikkje sida – HVL Interaktiv', 404],
        ['/laeringsdesign/monster/IKKJE..GYLDIG', 'Fann ikkje sida – HVL Interaktiv', 404],
      ];
      const titles: string[] = [];
      // Act
      for (const [path, , status] of routes) {
        const { page, problems } = await openWebPage(browser(), `${base()}${path}`, {
          documentStatus: status,
        });
        titles.push(await page.title());
        expect(problems).toEqual([]);
        await page.close();
      }
      // Assert
      expect(titles).toEqual(routes.map(([, title]) => title));
    });

    it.each([
      [
        'privacy',
        'contentinfo',
        'Privacy (opens in a new tab)',
        '/personvern?lang=en',
        'Privacy in HVL Interaktiv',
      ],
      ['help', 'banner', 'Help (opens in a new tab)', '/hjelp?lang=en', 'Help'],
    ] as const)(
      '[DATA-006] the %s link of an English launch opens its page in English, in a new tab',
      async (_case, landmark, name, href, heading) => {
        // Arrange
        const { page, problems } = await openWebPage(browser(), `${base()}/app/play?ltik=${LTIK_EN}`);
        const link = page.getByRole(landmark).getByRole('link', { name });
        // Act
        const [tab] = await Promise.all([page.context().waitForEvent('page'), link.click()]);
        await tab.waitForLoadState('domcontentloaded');
        // Assert
        expect(new URL(tab.url()).pathname + new URL(tab.url()).search).toBe(href);
        expect(await tab.getAttribute('html', 'lang')).toBe('en');
        expect(await tab.textContent('h1')).toBe(heading);
        expect(await page.getAttribute('html', 'lang')).toBe('en');
        expect(await page.getAttribute('h1', 'lang')).toBe('nn');
        expect(problems).toEqual([]);
        await page.close();
      },
    );

    it('[LTI-003] a router refresh after the launch never writes the ltik back into the address', async () => {
      // Arrange
      const { page, requests } = await openWebPage(browser(), `${base()}/app/play?ltik=${LTIK}`);
      await page.getByRole('heading', { level: 1, name: 'Celler og vev' }).waitFor();
      const before = requests.length;
      // Act
      await page.evaluate(() =>
        (window as unknown as { next: { router: { refresh(): void } } }).next.router.refresh(),
      );
      await page.waitForLoadState('networkidle');
      // Assert
      expect(new URL(page.url()).search).toBe('');
      expect(await page.evaluate(() => history.state && JSON.stringify(history.state).includes('ltik'))).toBe(
        false,
      );
      const later = requests.slice(before).filter((url) => new URL(url).pathname === '/app/play');
      expect(later.length).toBeGreaterThan(0);
      for (const url of later) expect(new URL(url).searchParams.has('ltik')).toBe(false);
      await page.close();
    });

    it('[UD-012] under forced colours only the selected tab keeps a visible underline', async () => {
      // Arrange
      const { page, problems } = await openWebPage(browser(), `${base()}/app/play?ltik=${LTIK}`, {
        context: { forcedColors: 'active' },
      });
      const tabs = page.getByRole('tab');
      await tabs.first().waitFor();
      // Act
      const borders = await tabs.evaluateAll((elements) =>
        elements.map((element) => {
          const probe = document.createElement('div');
          probe.style.color = 'Canvas';
          document.body.append(probe);
          const canvas = getComputedStyle(probe).color;
          probe.remove();
          const style = getComputedStyle(element);
          return {
            selected: element.getAttribute('aria-selected'),
            width: style.borderBottomWidth,
            visible: style.borderBottomColor !== canvas,
          };
        }),
      );
      // Assert
      expect(borders).toEqual([
        { selected: 'true', width: '4px', visible: true },
        { selected: 'false', width: '4px', visible: false },
      ]);
      expect(problems).toEqual([]);
      await page.close();
    });
  });
});
