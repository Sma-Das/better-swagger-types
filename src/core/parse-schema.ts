import SwaggerParser from '@apidevtools/swagger-parser';
import swagger2openapi from 'swagger2openapi';

import type { LoadedSchemaSource, Logger, ParsedSchema } from '../types/internal';
import { sha256, stableStringify } from '../utils/hash';
import { isUrl } from '../utils/fs';

interface ParseSchemaOptions {
  resolveRefs: boolean;
  logger: Logger;
}

export async function parseSchema(source: LoadedSchemaSource, options: ParseSchemaOptions): Promise<ParsedSchema> {
  const rawDocument = parseJson(source.contents, source.source);
  const detectedFormat = detectFormat(rawDocument);
  const actualFormat = resolveFormat(source.format, detectedFormat, source.source);
  const parserOptions = {
    resolve: {
      http: {
        headers: source.headers
      }
    }
  } as const;

  let normalizedDocument: Record<string, unknown>;
  const warnings: string[] = [];

  if (actualFormat === 'swagger2') {
    const converted = isUrl(source.source)
      ? await swagger2openapi.convertObj(rawDocument, { patch: true, warnOnly: true })
      : await swagger2openapi.convertFile(source.source, { patch: true, warnOnly: true });

    normalizedDocument = converted.openapi as Record<string, unknown>;
  } else if (!isUrl(source.source) && source.sourceKind !== 'url') {
    await SwaggerParser.validate(source.source, parserOptions);
    normalizedDocument = options.resolveRefs
      ? (await SwaggerParser.bundle(source.source, parserOptions)) as Record<string, unknown>
      : rawDocument;
  } else {
    await SwaggerParser.validate(rawDocument as never, parserOptions);
    normalizedDocument = options.resolveRefs
      ? (await SwaggerParser.bundle(rawDocument as never, parserOptions)) as unknown as Record<string, unknown>
      : rawDocument;
  }

  if (actualFormat === 'swagger2') {
    await SwaggerParser.validate(normalizedDocument as never, parserOptions);
    if (options.resolveRefs) {
      normalizedDocument = (await SwaggerParser.bundle(normalizedDocument as never, parserOptions)) as unknown as Record<string, unknown>;
    }
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
