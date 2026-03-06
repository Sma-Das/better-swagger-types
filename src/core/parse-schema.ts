import { bundle, type ParserOptions } from '@apidevtools/json-schema-ref-parser';
import swagger2openapi from 'swagger2openapi';

import type { LoadedSchemaSource, Logger, ParsedSchema } from '../types/internal';
import { sha256, stableStringify } from '../utils/hash';

interface ParseSchemaOptions {
  resolveRefs: boolean;
  logger: Logger;
}

export async function parseSchema(source: LoadedSchemaSource, options: ParseSchemaOptions): Promise<ParsedSchema> {
  const rawDocument = parseJson(source.contents, source.source);
  const detectedFormat = detectFormat(rawDocument);
  const actualFormat = resolveFormat(source.format, detectedFormat, source.source);
  const warnings: string[] = [];
  validateSourceDocument(rawDocument, actualFormat, source.source);

  let normalizedDocument =
    actualFormat === 'swagger2'
      ? await convertSwagger2Document(rawDocument, source.source)
      : rawDocument;

  validateOpenApi3Document(normalizedDocument, source.source);

  if (options.resolveRefs) {
    normalizedDocument = await bundleDocument(normalizedDocument, source);
    validateOpenApi3Document(normalizedDocument, source.source);
  }

  options.logger.debug(`Parsed ${source.source} as ${actualFormat}`);

  return {
    source,
    document: normalizedDocument,
    format: 'openapi3',
    openapiVersion: String(normalizedDocument.openapi ?? '3.0.0'),
    warnings,
    schemaHash: sha256(stableStringify(normalizedDocument))
  };
}

function parseJson(contents: string, source: string): Record<string, unknown> {
  try {
    return JSON.parse(contents) as Record<string, unknown>;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown JSON parse error';
    throw new Error(`Failed to parse ${source} as JSON: ${message}`);
  }
}

function detectFormat(document: Record<string, unknown>): 'openapi3' | 'swagger2' {
  if (typeof document.openapi === 'string') {
    return 'openapi3';
  }

  if (document.swagger === '2.0') {
    return 'swagger2';
  }

  throw new Error('Schema format could not be detected. Expected an `openapi` or `swagger` top-level field.');
}

function resolveFormat(
  configuredFormat: LoadedSchemaSource['format'],
  detectedFormat: 'openapi3' | 'swagger2',
  source: string
): 'openapi3' | 'swagger2' {
  if (configuredFormat === 'auto') {
    return detectedFormat;
  }

  if (configuredFormat !== detectedFormat) {
    throw new Error(`Schema ${source} was configured as ${configuredFormat} but detected as ${detectedFormat}.`);
  }

  return configuredFormat;
}

async function convertSwagger2Document(document: Record<string, unknown>, source: string): Promise<Record<string, unknown>> {
  try {
    const converted = await swagger2openapi.convertObj(document, { patch: true, warnOnly: true });
    return asObject(converted.openapi, `Converted OpenAPI document from ${source}`);
  } catch (error) {
    throw new Error(`Failed to convert Swagger 2 schema ${source}: ${getErrorMessage(error)}`);
  }
}

async function bundleDocument(document: Record<string, unknown>, source: LoadedSchemaSource): Promise<Record<string, unknown>> {
  const parserOptions: ParserOptions<Record<string, unknown>> = {
    continueOnError: false,
    mutateInputSchema: false,
    resolve: {
      external: true,
      http: {
        headers: source.headers
      }
    }
  };

  try {
    return asObject(await bundle(source.source, document, parserOptions), `Bundled OpenAPI document from ${source.source}`);
  } catch (error) {
    throw new Error(`Failed to resolve references for ${source.source}: ${getErrorMessage(error)}`);
  }
}

function validateSourceDocument(document: Record<string, unknown>, format: 'openapi3' | 'swagger2', source: string): void {
  if (format === 'swagger2') {
    assertStringField(document, 'swagger', source);
    assertObjectField(document, 'info', source);
    assertObjectField(document, 'paths', source);
    return;
  }

  validateOpenApi3Document(document, source);
}

function validateOpenApi3Document(document: Record<string, unknown>, source: string): void {
  assertStringField(document, 'openapi', source);
  assertObjectField(document, 'info', source);
  assertObjectField(document, 'paths', source);
}

function assertStringField(document: Record<string, unknown>, field: string, source: string): void {
  if (typeof document[field] !== 'string') {
    throw new Error(`Schema ${source} is invalid: expected top-level \`${field}\` to be a string.`);
  }
}

function assertObjectField(document: Record<string, unknown>, field: string, source: string): void {
  const value = document[field];

  if (!isRecord(value)) {
    throw new Error(`Schema ${source} is invalid: expected top-level \`${field}\` to be an object.`);
  }
}

function asObject(value: unknown, label: string): Record<string, unknown> {
  if (!isRecord(value)) {
    throw new Error(`${label} must be an object.`);
  }

  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown error';
}
