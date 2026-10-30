/**
 * coreSchemaNames — the component names of the schemas the routes before S5 use (./coreRoutes.ts).
 *
 * Why: the OpenAPI document refers to request and answer schemas by name (D-077). D-099 splits the name lists by
 *      area like the registry, so parallel work never edits the same list.
 * Spec: DOC-012
 * Invariants:
 *   - The names and their order are those of the document before the split, so its existing components stay
 *     byte-identical.
 * Collaborators: ./coreRoutes.ts, ../apiSchemaNames.ts, ../me.ts, ../content.ts, ../findings.ts,
 *   ../publishing.ts, ../sharing.ts, ../errors.ts.
 * Tests: packages/api-contract/test/openApi.test.ts
 */
import { openApiDocumentSchema, type ApiSchemaNames } from '../apiRouteTypes.js';
import { contentDetailSchema, contentListSchema, contentSummarySchema } from '../content.js';
import { errorBodySchema, publishBlockedBodySchema, publishConflictBodySchema } from '../errors.js';
import {
  acknowledgementSchema,
  findingsResponseSchema,
  findingWithAcknowledgementSchema,
} from '../findings.js';
import { dismissedNoticeSchema, meSchema, noticeDismissalRequestSchema } from '../me.js';
import * as publishing from '../publishing.js';
import { sharingRequestSchema, sharingResponseSchema } from '../sharing.js';

/** The named schemas of the routes before S5. */
export const CORE_SCHEMA_NAMES: ApiSchemaNames = {
  request: {
    NoticeDismissalRequest: noticeDismissalRequestSchema,
    AcknowledgementInput: publishing.acknowledgementInputSchema,
    PublishRequest: publishing.publishRequestSchema,
    UnpublishRequest: publishing.unpublishRequestSchema,
    SharingRequest: sharingRequestSchema,
  },
  response: {
    Me: meSchema,
    DismissedNotice: dismissedNoticeSchema,
    ContentSummary: contentSummarySchema,
    ContentList: contentListSchema,
    ContentDetail: contentDetailSchema,
    Acknowledgement: acknowledgementSchema,
    FindingWithAcknowledgement: findingWithAcknowledgementSchema,
    FindingsResponse: findingsResponseSchema,
    PublishResponse: publishing.publishResponseSchema,
    UnpublishResponse: publishing.unpublishResponseSchema,
    SharingResponse: sharingResponseSchema,
    ErrorBody: errorBodySchema,
    PublishBlockedBody: publishBlockedBodySchema,
    PublishConflictBody: publishConflictBodySchema,
    OpenApiDocument: openApiDocumentSchema,
  },
};
