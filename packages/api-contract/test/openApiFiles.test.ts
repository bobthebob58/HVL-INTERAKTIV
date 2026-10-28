/**
 * Tests the OpenAPI builder's D-099 additions: file answers with a media type and the attachment header, query
 * parameters, and the merged schema-name lists that refuse a name used twice.
 *
 * Spec: DOC-012, MAPPE-001
 */
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { mergeSchemaNames } from '../src/apiSchemaNames.js';
import {
  buildOpenApiDocument,
  MARKDOWN_MEDIA_TYPE,
  mappeExportQuerySchema,
  mappeRequestSchema,
  PDF_MEDIA_TYPE,
  REQUEST_SCHEMAS,
  RESPONSE_SCHEMAS,
  type ApiResponse,
  type ApiRoute,
} from '../src/index.js';

type Operation = {
  parameters?: { name: string; in: string; required: boolean; schema: Record<string, unknown> }[];
  responses: Record<string, unknown>;
};

const exportRoute: ApiRoute = {
  operationId: 'probeExport',
  method: 'post',
  path: '/probe/:contentId/export',
  auth: 'portal',
  summary: 'A file answer whose type the query chooses.',
  params: z.strictObject({ contentId: z.uuid() }),
  query: mappeExportQuerySchema.extend({ page: z.int().min(1).optional() }),
  body: mappeRequestSchema,
  responses: { 200: { description: 'The file.', mediaType: [MARKDOWN_MEDIA_TYPE, PDF_MEDIA_TYPE] } },
};
const operationOf = (route: ApiRoute, path: string): Operation =>
  (buildOpenApiDocument([route]).paths[path] as Record<string, Operation>)[route.method] as Operation;

describe('[DOC-012] file answers, query parameters and schema names', () => {
  it('[MAPPE-001] a file answer lists each media type with a string schema and requires the attachment header', () => {
    // Act
    const answer = operationOf(exportRoute, '/api/probe/{contentId}/export').responses['200'];
    // Assert
    expect(answer).toEqual({
      description: 'The file.',
      headers: {
        'Content-Disposition': {
          description: expect.stringContaining('attachment'),
          required: true,
          schema: { type: 'string' },
        },
      },
      content: {
        'text/markdown; charset=utf-8': { schema: { type: 'string' } },
        'application/pdf': { schema: { type: 'string', format: 'binary' } },
      },
    });
  });

  it('[DOC-012] one media type is enough, and a JSON answer next to it keeps its schema reference', () => {
    // Arrange
    const route: ApiRoute = {
      ...exportRoute,
      responses: {
        200: { description: 'PDF.', mediaType: PDF_MEDIA_TYPE },
        400: exportRoute.responses[200]!,
      },
    };
    // Act
    const { responses } = operationOf(route, '/api/probe/{contentId}/export');
    // Assert
    expect(Object.keys((responses['200'] as { content: object }).content)).toEqual(['application/pdf']);
    expect(Object.keys((responses['400'] as { content: object }).content)).toHaveLength(2);
  });

  it('[DOC-012] query parameters follow the path parameters and are required unless optional', () => {
    // Act
    const parameters = operationOf(exportRoute, '/api/probe/{contentId}/export').parameters ?? [];
    // Assert
    expect(parameters.map(({ name, in: where, required }) => [name, where, required])).toEqual([
      ['contentId', 'path', true],
      ['format', 'query', true],
      ['page', 'query', false],
    ]);
    expect(parameters[1]?.schema).toMatchObject({ enum: ['md', 'pdf'] });
  });

  it('[DOC-012] refuses an answer that has both a JSON schema and a media type', () => {
    // Arrange
    const both = {
      description: 'Both.',
      schema: z.string(),
      mediaType: PDF_MEDIA_TYPE,
    } as unknown as ApiResponse;
    // Act and assert
    expect(() => buildOpenApiDocument([{ ...exportRoute, responses: { 200: both } }])).toThrow(
      /POST \/probe\/:contentId\/export: an answer has both a schema and a mediaType/,
    );
  });

  it('[DOC-012] merging name lists refuses a repeated name, a malformed name and a second name for one schema', () => {
    // Arrange
    const a = z.strictObject({ a: z.string() });
    const b = z.strictObject({ b: z.string() });
    // Act and assert
    expect(mergeSchemaNames([{ request: { A: a }, response: { A2: a, B: b } }]).response).toEqual({
      A2: a,
      B: b,
    });
    expect(() =>
      mergeSchemaNames([
        { request: { A: a }, response: {} },
        { request: {}, response: { A: b } },
      ]),
    ).toThrow(/the schema name A is used twice/);
    expect(() => mergeSchemaNames([{ request: { 'A B': a }, response: {} }])).toThrow(
      /not a valid component name/,
    );
    expect(() => mergeSchemaNames([{ request: {}, response: { A: a, B: a } }])).toThrow(
      /B names a schema twice/,
    );
  });

  it('[DOC-012] the real name lists are frozen, and the guide’s recursive nodes are components, never local $defs', () => {
    // Act
    const document = buildOpenApiDocument();
    const schemas = (document.components as { schemas: Record<string, unknown> }).schemas;
    // Assert
    expect(Object.isFrozen(REQUEST_SCHEMAS) && Object.isFrozen(RESPONSE_SCHEMAS)).toBe(true);
    expect(Object.keys(schemas)).toEqual(
      expect.arrayContaining(['GuideBlockNode', 'GuideProseNode', 'GuideInlineNode', 'GuideLinkContentNode']),
    );
    expect(JSON.stringify(document)).not.toContain('$defs');
  });
});
