import type { BetterSwaggerTypesConfig } from './types/config';

export type {
  BetterSwaggerTypesConfig,
  GeneratorConfig,
  NormalizedConfig,
  NormalizedGeneratorConfig,
  SchemaFormat,
  SchemaSourceConfig
} from './types/config';

export function defineConfig(config: BetterSwaggerTypesConfig): BetterSwaggerTypesConfig {
  return config;
}
