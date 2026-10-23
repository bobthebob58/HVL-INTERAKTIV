/**
 * h5pRouteDeps — what the H5P routes need from the H5P runtime, as one explicit object.
 *
 * Why: the routes are thin; all rules live in the editor, the player and the permission system. Passing them in
 *      as one typed object keeps the routes testable and makes it visible that no route builds its own engine.
 * Spec: H5P-004, H5P-006, H5P-007
 * Invariants:
 *   - `permissions` is the same HvlPermissionSystem instance the editor and player use.
 *   - `fileSanitizers` are the same sanitisers the editor runs; routes run them first only to give a specific reason.
 *   - `fileGrants` is the instance whose grants the player's HvlUrlGenerator puts into file URLs (D-058).
 * Collaborators: ./createH5pRouter.ts, ./routes/*, ../h5p/createH5pRuntime.ts.
 * Tests: apps/server/test/http/router.int.test.ts
 */
import type {
  H5PAjaxEndpoint,
  H5PPlayer,
  IFileSanitizer,
  IPermissionSystem,
} from '@lumieducation/h5p-server';
import type { Logger } from 'pino';
import type { ContentFileGrants } from '../h5p/contentFileGrants.js';
import type { HvlH5PEditor } from '../h5p/HvlH5PEditor.js';
import type { HvlH5pUser } from '../h5p/HvlH5pUser.js';
import type { H5pPageCspSettings } from './h5pPageCsp.js';

/** Everything the H5P routes use. */
export interface H5pRouteDeps {
  /** The editor (content types, saves, uploads, user data manager). */
  readonly editor: HvlH5PEditor;
  /** The player (renders an activity). */
  readonly player: H5PPlayer;
  /** Lumi's AJAX endpoint over the same editor. */
  readonly ajax: H5PAjaxEndpoint;
  /** The permission system of editor and player. */
  readonly permissions: IPermissionSystem<HvlH5pUser>;
  /** Sanitisers for uploaded files (file-type sniffer, SVG sanitiser). */
  readonly fileSanitizers: readonly IFileSanitizer[];
  /** Verifies the grants in content-file URLs (`/h5p/files/<grant>/…`). */
  readonly fileGrants: ContentFileGrants;
  /** Absolute folder of the H5P core client files. */
  readonly corePath: string;
  /** Absolute folder of the H5P editor client files. */
  readonly editorPath: string;
  /** H5P Core's inline-script hashes and the allowed outside media origins, for the page policy (D-070). */
  readonly pageCsp: H5pPageCspSettings;
  /** Server logger. */
  readonly logger: Logger;
}
