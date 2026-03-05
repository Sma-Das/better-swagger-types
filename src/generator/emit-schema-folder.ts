import path from 'node:path';

import openapiTS, { astToString } from 'openapi-typescript';

import { GENERATED_BANNER, HTTP_METHOD_ORDER } from '../core/constants';
import { sanitizeIdentifier } from './naming';
import type { GeneratedFile, GeneratedSchemaArtifacts, LoadedConfig, ParsedSchema } from '../types/internal';
import { toPosixPath } from '../utils/fs';

interface OperationDescriptor {
  method: string;
  path: string;
  typeName: string;
  hasRequestBody: boolean;
  successCodes: string[];
}

export async function emitSchemaArtifacts(
  parsedSchema: ParsedSchema,
  loadedConfig: LoadedConfig
): Promise<GeneratedSchemaArtifacts> {
  const schemaDirectory = path.join(loadedConfig.configDir, loadedConfig.config.output, parsedSchema.source.folderName);
  const baseTypes = await openapiTS(parsedSchema.document as never, {
    alphabetize: true,
    silent: true,
    cwd: loadedConfig.configDir
  });

  const files: GeneratedFile[] = [
    {
      path: path.join(schemaDirectory, 'paths.ts'),
      contents: `${GENERATED_BANNER}${astToString(baseTypes)}`
    },
    {
      path: path.join(schemaDirectory, 'meta.ts'),
      contents: emitMetaFile(parsedSchema, loadedConfig)
    },
    {
      path: path.join(schemaDirectory, 'index.ts'),
      contents: emitSchemaIndexFile(loadedConfig)
    }
  ];

  if (loadedConfig.config.generator.emitSchemas) {
    files.push({
      path: path.join(schemaDirectory, 'schemas.ts'),
      contents: emitSchemasFile(parsedSchema)
    });
  }

  if (loadedConfig.config.generator.emitOperations) {
    files.push({
      path: path.join(schemaDirectory, 'operations.ts'),
      contents: emitOperationsFile(parsedSchema)
    });
    files.push({
      path: path.join(schemaDirectory, 'endpoints.ts'),
      contents: emitEndpointsFile(parsedSchema)
    });
  }

  return {
    source: parsedSchema,
    files
  };
}

export function emitRootIndexFile(parsedSchemas: ParsedSchema[], loadedConfig: LoadedConfig): GeneratedFile {
  const rootIndexPath = path.join(loadedConfig.configDir, loadedConfig.config.output, 'index.ts');
  const exports = parsedSchemas
    .slice()
    .sort((left, right) => left.source.namespace.localeCompare(right.source.namespace))
    .map((schema) => `export * as ${schema.source.namespace} from './${toPosixPath(path.join(schema.source.folderName, 'index'))}';`)
    .join('\n');

  return {
    path: rootIndexPath,
    contents: `${GENERATED_BANNER}${exports}\n`
  };
}

function emitSchemaIndexFile(loadedConfig: LoadedConfig): string {
  const lines = [
    GENERATED_BANNER.trimEnd(),
    `export * from './paths';`
  ];

  if (loadedConfig.config.generator.emitSchemas) {
    lines.push(`export * from './schemas';`);
  }

  if (loadedConfig.config.generator.emitOperations) {
    lines.push(`export * from './operations';`);
    lines.push(`export * from './endpoints';`);
  }

  lines.push(`export * from './meta';`, '');
  return `${lines.join('\n')}\n`;
}

function emitSchemasFile(parsedSchema: ParsedSchema): string {
  const schemaKeys = getComponentKeys(parsedSchema.document, 'schemas');
  const aliases = assignStableAliases(schemaKeys);

  const lines = [
    GENERATED_BANNER.trimEnd(),
    `import type { components } from './paths';`,
    '',
    `export type Components = components;`,
    `export type Schemas = components extends { schemas: infer T } ? T : never;`,
    `export type Parameters = components extends { parameters: infer T } ? T : never;`,
    `export type Responses = components extends { responses: infer T } ? T : never;`,
    `export type RequestBodies = components extends { requestBodies: infer T } ? T : never;`,
    `export type Headers = components extends { headers: infer T } ? T : never;`
  ];

  for (const schemaKey of schemaKeys) {
    const alias = aliases.get(schemaKey);
    if (!alias) {
      continue;
    }

    lines.push(`export type ${alias} = Schemas[${JSON.stringify(schemaKey)}];`);
  }

  lines.push('');
  return `${lines.join('\n')}\n`;
}

function emitOperationsFile(parsedSchema: ParsedSchema): string {
  const operations = collectOperations(parsedSchema.document);

  const lines = [
    GENERATED_BANNER.trimEnd(),
    `import type { paths } from './paths';`,
    '',
    `type ValueOf<T> = T[keyof T];`,
    `type ExtractContent<T> = T extends { content: infer Content extends Record<PropertyKey, unknown> } ? ValueOf<Content> : void;`,
    `type ResponseMapOf<T> = T extends { responses: infer R } ? R : never;`,
    '',
    ...operations.flatMap((operation) => {
      const baseAlias = `${operation.typeName}Base`;
      const responsesAlias = `${operation.typeName}Responses`;
      return [
        `type ${baseAlias} = paths[${JSON.stringify(operation.path)}][${JSON.stringify(operation.method)}];`,
        `type ${responsesAlias} = ${baseAlias} extends { responses: infer R } ? R : {};`
      ];
    }),
    operations.length > 0 ? '' : '',
    'export type Operations = {'
  ];

  for (const operation of operations) {
    const baseAlias = `${operation.typeName}Base`;
    const responsesAlias = `${operation.typeName}Responses`;
    const responseUnion =
      operation.successCodes.length > 0
        ? operation.successCodes.map((status) => `ExtractContent<${responsesAlias}[${JSON.stringify(status)}]>`).join(' | ')
        : 'unknown';

    lines.push(`  ${operation.typeName}: {`);
    lines.push(`    method: ${JSON.stringify(operation.method)};`);
    lines.push(`    path: ${JSON.stringify(operation.path)};`);
    lines.push(`    params: ${baseAlias} extends { parameters: infer P } ? P : {};`);
    if (operation.hasRequestBody) {
      lines.push(`    requestBody: ${baseAlias} extends { requestBody: infer B } ? ExtractContent<B> : never;`);
    }
    lines.push(`    responses: ${responsesAlias};`);
    lines.push(`    response: ${responseUnion};`);
    lines.push('  };');
  }

  lines.push('};');
  lines.push('');
  lines.push('export type OperationName = keyof Operations;');
  lines.push('export type OperationFor<Name extends OperationName> = Operations[Name];');
  lines.push('export type ResponseFor<T, Code extends keyof ResponseMapOf<T>> = ExtractContent<ResponseMapOf<T>[Code]>;');
  lines.push('export type SuccessResponseFor<T> = T extends { response: infer R } ? R : never;');
  lines.push('');

  return `${lines.join('\n')}\n`;
}

function emitEndpointsFile(parsedSchema: ParsedSchema): string {
  const operations = collectOperations(parsedSchema.document);
  const lines = [
    GENERATED_BANNER.trimEnd(),
    `import type { Operations, ResponseFor, SuccessResponseFor } from './operations';`,
    '',
    'type ResponseMapOf<T> = T extends { responses: infer R } ? R : never;',
    '',
    'export type Endpoints = {'
  ];

  for (const operation of operations) {
    lines.push(`  ${JSON.stringify(`${operation.method.toUpperCase()} ${operation.path}`)}: Operations[${JSON.stringify(operation.typeName)}];`);
  }

  lines.push('};');
  lines.push('');
  lines.push('export type EndpointKey = keyof Endpoints;');
  lines.push('export type EndpointFor<Key extends EndpointKey> = Endpoints[Key];');
  lines.push('export type ParamsFor<T> = T extends { params: infer P } ? P : never;');
  lines.push('export type RequestBodyFor<T> = T extends { requestBody: infer B } ? B : never;');
  lines.push('export type EndpointResponseFor<T, Code extends keyof ResponseMapOf<T>> = ResponseFor<T, Code>;');
  lines.push('export type EndpointSuccessResponseFor<T> = SuccessResponseFor<T>;');
  lines.push('');

  return `${lines.join('\n')}\n`;
}

function emitMetaFile(parsedSchema: ParsedSchema, loadedConfig: LoadedConfig): string {
  const sourceLabel = parsedSchema.source.source.startsWith('http://') || parsedSchema.source.source.startsWith('https://')
    ? parsedSchema.source.source
    : toPosixPath(path.relative(loadedConfig.configDir, parsedSchema.source.source));

  return `${GENERATED_BANNER}export const meta = ${JSON.stringify(
    {
      name: parsedSchema.source.effectiveName,
      namespace: parsedSchema.source.namespace,
      source: sourceLabel,
      format: parsedSchema.format,
      openapiVersion: parsedSchema.openapiVersion,
      schemaHash: parsedSchema.schemaHash
    },
    null,
    2
  )} as const;\n`;
}

function getComponentKeys(document: Record<string, unknown>, componentName: string): string[] {
  const components = (document.components ?? {}) as Record<string, unknown>;
  const value = components[componentName];
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return [];
  }

  return Object.keys(value as Record<string, unknown>).sort((left, right) => left.localeCompare(right));
}

function assignStableAliases(keys: string[]): Map<string, string> {
  const grouped = new Map<string, string[]>();
  for (const key of keys) {
    const candidate = sanitizeIdentifier(key);
    const bucket = grouped.get(candidate) ?? [];
    bucket.push(key);
    grouped.set(candidate, bucket);
  }

  const aliases = new Map<string, string>();
  for (const [candidate, originals] of grouped.entries()) {
    originals.sort((left, right) => left.localeCompare(right));
    for (const [index, original] of originals.entries()) {
      aliases.set(original, index === 0 ? candidate : `${candidate}${index + 1}`);
    }
  }

  return aliases;
}

function collectOperations(document: Record<string, unknown>): OperationDescriptor[] {
  const pathsObject = ((document.paths ?? {}) as Record<string, Record<string, Record<string, unknown>>>) ?? {};
  const pending: Array<Omit<OperationDescriptor, 'typeName'> & { requestedName: string }> = [];

  for (const routePath of Object.keys(pathsObject).sort((left, right) => left.localeCompare(right))) {
    const pathItem = pathsObject[routePath] ?? {};
    for (const method of HTTP_METHOD_ORDER) {
      const operation = pathItem[method];
      if (!operation || typeof operation !== 'object') {
        continue;
      }

      const operationId = typeof operation.operationId === 'string' && operation.operationId.trim() !== ''
        ? sanitizeIdentifier(operation.operationId)
        : undefined;
      const requestedName = operationId ?? sanitizeIdentifier(buildFallbackOperationName(method, routePath));
      const responses = operation.responses as Record<string, unknown> | undefined;
      const successCodes = Object.keys(responses ?? {})
        .filter((status) => /^2\d\d$/.test(String(status)))
        .sort((left, right) => left.localeCompare(right));

      pending.push({
        method,
        path: routePath,
        requestedName,
        hasRequestBody: Object.prototype.hasOwnProperty.call(operation, 'requestBody'),
        successCodes
      });
    }
  }

  const grouped = new Map<string, Array<Omit<OperationDescriptor, 'typeName'> & { requestedName: string }>>();
  for (const operation of pending) {
    const bucket = grouped.get(operation.requestedName) ?? [];
    bucket.push(operation);
    grouped.set(operation.requestedName, bucket);
  }

  const operations: OperationDescriptor[] = [];
  for (const [requestedName, entries] of grouped.entries()) {
    entries.sort((left, right) => `${left.method} ${left.path}`.localeCompare(`${right.method} ${right.path}`));
    entries.forEach((entry, index) => {
      operations.push({
        method: entry.method,
        path: entry.path,
        typeName: index === 0 ? requestedName : `${requestedName}${index + 1}`,
        hasRequestBody: entry.hasRequestBody,
        successCodes: entry.successCodes
      });
    });
  }

  operations.sort((left, right) => `${left.method} ${left.path}`.localeCompare(`${right.method} ${right.path}`));
  return operations;
}

function buildFallbackOperationName(method: string, routePath: string): string {
  const segments = routePath
    .split('/')
    .filter(Boolean)
    .map((segment) => {
      if (segment.startsWith('{') && segment.endsWith('}')) {
        return `By${sanitizeIdentifier(segment.slice(1, -1))}`;
      }
      return sanitizeIdentifier(segment);
    })
    .join('');

  return `${sanitizeIdentifier(method)}${segments || 'Root'}`;
}
