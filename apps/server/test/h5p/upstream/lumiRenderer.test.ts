/**
 * Pins upstream behaviour of Lumi's player template: the integration JSON is not script-safe (D-040).
 *
 * Spec: SEC-008
 */
import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
import type { IPlayerModel } from '@lumieducation/h5p-server';

const { default: renderPlayer } = createRequire(import.meta.url)(
  '@lumieducation/h5p-server/build/src/renderers/player.js',
) as typeof import('@lumieducation/h5p-server/build/src/renderers/player.js');

describe('[SEC-008] upstream: Lumi player template', () => {
  it('[SEC-008] lets "</script>" in a title end the integration script early', () => {
    const title = '</script><script>alert(1)</script>';
    const model = {
      contentId: '1',
      styles: [],
      scripts: [],
      integration: { contents: { 'cid-1': { metadata: { title } } } },
    } as unknown as IPlayerModel;
    // UPSTREAM: https://github.com/Lumieducation/H5P-Nodejs-library/blob/v10.0.4/packages/h5p-server/src/renderers/player.ts embeds JSON.stringify(integration),
    // which leaves "<" unescaped, so this markup would run for every learner. Our template (D-040) escapes it.
    expect(renderPlayer(model)).toContain(title);
  });
});
