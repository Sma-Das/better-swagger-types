export type SchemaFormat = 'auto' | 'openapi3' | 'swagger2';

export interface SchemaSourceConfig {
  name: string;
  source: string;
  headers?: Record<string, string>;
  format?: SchemaFormat;
  namespace?: string;
}

export interface GeneratorConfig {
  emitOperations?: boolean;
  emitSchemas?: boolean;
  emitSimpleAliases?: boolean;
  resolveRefs?: boolean;
  naming?: 'stable';
}

export interface BetterSwaggerTypesConfig {
  output: string;
  prismaStyleNodeModulesOutput?: boolean;
  schemas: SchemaSourceConfig[];
  generator?: GeneratorConfig;
}

export interface NormalizedGeneratorConfig {
  emitOperations: boolean;
  emitSchemas: boolean;
  emitSimpleAliases: boolean;
  resolveRefs: boolean;
  naming: 'stable';
}

export interface NormalizedConfig {
  output: string;
  prismaStyleNodeModulesOutput: boolean;
  schemas: SchemaSourceConfig[];
  generator: NormalizedGeneratorConfig;
}

export const DEFAULT_GENERATOR_CONFIG: NormalizedGeneratorConfig = {
  emitOperations: true,
  emitSchemas: true,
  emitSimpleAliases: false,
  resolveRefs: true,
  naming: 'stable'
};

export function normalizeConfig(config: BetterSwaggerTypesConfig): NormalizedConfig {
  return {
    output: config.output,
    prismaStyleNodeModulesOutput: config.prismaStyleNodeModulesOutput ?? false,
    schemas: config.schemas,
    generator: {
      emitOperations: config.generator?.emitOperations ?? DEFAULT_GENERATOR_CONFIG.emitOperations,
      emitSchemas: config.generator?.emitSchemas ?? DEFAULT_GENERATOR_CONFIG.emitSchemas,
      emitSimpleAliases: config.generator?.emitSimpleAliases ?? DEFAULT_GENERATOR_CONFIG.emitSimpleAliases,
      resolveRefs: config.generator?.resolveRefs ?? DEFAULT_GENERATOR_CONFIG.resolveRefs,
      naming: config.generator?.naming ?? DEFAULT_GENERATOR_CONFIG.naming
    }
  };
}
