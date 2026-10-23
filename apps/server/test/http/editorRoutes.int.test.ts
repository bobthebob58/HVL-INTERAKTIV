/**
 * Integration tests for the portal's editor pages: only those who may edit get them, under the strict H5P policy,
 * with no user identity in the page and grant-bearing file URLs.
 *
 * Spec: H5P-006, H5P-007, DATA-002, DATA-011, PROD-004
 */
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { openHttpTestbed, type HttpTestbed, type TestActor } from '../support/httpTestbed.js';
import { inlineScriptTags, integrationFromPage } from '../support/playerIntegration.js';
import { describeWithServices } from '../support/services.js';

interface EditorIntegration {
  user: Record<string, string>;
  contents?: Record<string, { contentUrl: string }>;
  editor: { filesPath: string; nodeVersionId?: string };
}

const configOf = (html: string) =>
  JSON.parse(/id="hvl-editor-config">(.*?)<\/script>/s.exec(html)?.[1] ?? '{}') as {
    contentId: string | null;
    token: { name: string; value: string } | null;
  };

describeWithServices('editor pages', () => {
  let tb: HttpTestbed;
  let owner: TestActor;
  let other: TestActor;
  let contentId: string;
  beforeAll(async () => {
    tb = await openHttpTestbed();
    owner = await tb.actor('author');
    other = await tb.actor('author');
    contentId = await tb.activity(owner);
  }, 60_000);
  afterAll(() => tb.close());

  describe('[H5P-006] who gets the editor', () => {
    it('[H5P-006] the owner gets the editor page under the strict policy, framed by our own pages only', async () => {
      // Act
      const res = await request(tb.app)
        .get(`/h5p/edit/${contentId}`)
        .set(...owner.header);
      // Assert
      expect(res.status).toBe(200);
      expect(res.headers['cache-control']).toBe('no-store');
      expect(res.headers['x-frame-options']).toBe('SAMEORIGIN');
      expect(res.headers['content-security-policy']).toMatch(/script-src 'self' 'sha256-[^;]+;/);
      expect(res.headers['content-security-policy']).not.toContain("'unsafe-inline' 'sha");
      expect(res.headers['content-security-policy']).toMatch(/frame-ancestors 'self'$/);
      expect(inlineScriptTags(res.text)).toEqual([]);
      expect(res.text).toContain('id="hvl-editor-save"');
    });

    it('[PROD-004] another author’s activity and an unknown ID get the same “not available” page', async () => {
      const foreign = await request(tb.app)
        .get(`/h5p/edit/${contentId}`)
        .set(...other.header);
      const unknown = await request(tb.app)
        .get('/h5p/edit/01a00000-0000-7000-8000-000000000000')
        .set(...owner.header);
      expect([foreign.status, unknown.status]).toEqual([404, 404]);
      expect(foreign.text).toBe(unknown.text);
      expect(foreign.text).not.toContain('h5p-integration');
    });

    it('[H5P-006] a learner gets no editor, not even a new one', async () => {
      const learner = await tb.actor('learner');
      for (const path of [`/h5p/edit/${contentId}`, '/h5p/new']) {
        expect(
          (
            await request(tb.app)
              .get(path)
              .set(...learner.header)
          ).status,
        ).toBe(403);
      }
    });

    it('[PROD-004] without a session the editor sends the browser to Feide login and back', async () => {
      const res = await request(tb.app).get(`/h5p/edit/${contentId}`);
      expect(res.status).toBe(302);
      expect(res.headers.location).toBe(
        `/auth/feide/login?returnTo=${encodeURIComponent(`/h5p/edit/${contentId}`)}`,
      );
    });
  });

  describe('[H5P-007] what the page carries', () => {
    it('[DATA-002] no user identity; files and uploads through grant-bearing URLs; the own CSRF token only', async () => {
      // Act
      const res = await request(tb.app)
        .get(`/h5p/edit/${contentId}`)
        .set(...owner.header);
      const integration = integrationFromPage<EditorIntegration>(res.text);
      // Assert
      expect(integration?.user).toEqual({ name: '', mail: '', id: '' });
      expect(integration?.contents?.[`cid-${contentId}`]?.contentUrl).toMatch(
        new RegExp(`^/h5p/files/[\\w-]+\\.\\d+\\.[\\w-]{43}/${contentId}$`),
      );
      expect(integration?.editor.filesPath).toMatch(
        new RegExp(`^/h5p/uploads/[\\w-]+\\.\\d+\\.[\\w-]{43}/${owner.actor.accountId}$`),
      );
      expect(configOf(res.text)).toMatchObject({ contentId, token: owner.actor.urlToken ?? null });
      expect(res.text).not.toContain(owner.actor.learnerKey);
    });

    it('[H5P-006] a new activity gets an upload grant and no content grant', async () => {
      const res = await request(tb.app)
        .get('/h5p/new')
        .set(...owner.header);
      const integration = integrationFromPage<EditorIntegration>(res.text);
      expect(res.status).toBe(200);
      expect(integration?.contents).toEqual({});
      expect(integration?.editor.filesPath).toContain(`/h5p/uploads/`);
      expect(configOf(res.text).contentId).toBeNull();
    });
  });
});
