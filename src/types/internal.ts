import type { NormalizedConfig, SchemaFormat, SchemaSourceConfig } from './config';

export type SourceKind = 'file' | 'directory' | 'glob' | 'url';

export interface Logger {
  info(message: string): void;
  warn(message: string): void;
  error(message: string): void;
  debug(message: string): void;
}

export interface LoadedConfig {
  configPath: string;
  configDir: string;
  config: NormalizedConfig;
}

export interface ResolvedSchemaSource {
  configuredName: string;
  configuredNamespace?: string | undefined;
  configuredSource: string;
  effectiveName: string;
  namespace: string;
  folderName: string;
  source: string;
  sourceKind: SourceKind;
  headers: Record<string, string>;
  format: SchemaFormat;
}

export interface LoadedSchemaSource extends ResolvedSchemaSource {
  contents: string;
  cacheKey?: string | undefined;
}

export interface ParsedSchema {
  source: LoadedSchemaSource;
  document: Record<string, unknown>;
  format: Exclude<SchemaFormat, 'auto'> | 'openapi3';
  openapiVersion: string;
  warnings: string[];
  schemaHash: string;
}

export interface GeneratedFile {
  path: string;
  contents: string;
}

export interface GeneratedSchemaArtifacts {
  source: ParsedSchema;
  files: GeneratedFile[];
}

export interface ManifestSchemaEntry {
  name: string;
  namespace: string;
  folderName: string;
  source: string;
  schemaHash: string;
}

export interface Manifest {
  version: 1;
  packageName: 'better-swagger-types';
  generatedAt: string;
  configPath: string;
  output: string;
  files: string[];
  schemas: ManifestSchemaEntry[];
}

export interface InitOptions {
  configPath: string;
  force: boolean;
}

export interface CommonCommandOptions {
  config?: string | undefined;
  verbose?: boolean | undefined;
}

export interface GenerateCommandOptions extends CommonCommandOptions {
  cache?: boolean | undefined;
}

export interface WatchCommandOptions extends GenerateCommandOptions {}

export interface CleanCommandOptions extends CommonCommandOptions {}

export interface ResolvedConfigSchema extends SchemaSourceConfig {
  format: SchemaFormat;
}
