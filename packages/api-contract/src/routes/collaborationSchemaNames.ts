/**
 * collaborationSchemaNames — the component names of the schemas that collaboration routes (W4) use.
 *
 * Why: the OpenAPI document refers to request and answer schemas by name (D-077); D-099 splits the name lists by
 *      area like the registry (./collaborationRoutes.ts), so parallel work never edits the same list.
 * Spec: DOC-012
 * Invariants:
 *   - A name is unique across every area and both lists; ../apiSchemaNames.ts refuses a repeated name.
 * Collaborators: ./collaborationRoutes.ts, ../apiSchemaNames.ts, ../collaboration.ts.
 * Tests: packages/api-contract/test/openApi.test.ts
 */
import type { ApiSchemaNames } from '../apiRouteTypes.js';
import * as collaboration from '../collaboration.js';

/** The named schemas of this area; workstreams add the ones their routes use (W4). */
export const COLLABORATION_SCHEMA_NAMES: ApiSchemaNames = {
  request: {
    CoAuthorAddRequest: collaboration.coAuthorAddRequestSchema,
    BankListingRequest: collaboration.bankListingRequestSchema,
  },
  response: {
    Person: collaboration.personSchema,
    PeopleSearchResponse: collaboration.peopleSearchResponseSchema,
    CoAuthor: collaboration.coAuthorSchema,
    CoAuthorList: collaboration.coAuthorListSchema,
    BankListing: collaboration.bankListingSchema,
    BankEntry: collaboration.bankEntrySchema,
    BankList: collaboration.bankListSchema,
    DuplicateResponse: collaboration.duplicateResponseSchema,
  },
};
