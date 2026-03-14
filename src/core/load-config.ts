import path from 'node:path';

import { createJiti } from 'jiti';

import { DEFAULT_CONFIG_FILE } from './constants';
import { normalizeConfig, type BetterSwaggerTypesConfig } from '../types/config';
import type { LoadedConfig } from '../types/internal';
import { pathExists } from '../utils/fs';

export async function loadConfig(configPath?: string): Promise<LoadedConfig> {
  const resolvedPath = path.resolve(process.cwd(), configPath ?? DEFAULT_CONFIG_FILE);

  if (!(await pathExists(resolvedPath))) {
    throw new Error(`No config found at ${resolvedPath}. Run bunx better-swagger-types --init`);
  }

  const jiti = createJiti(import.meta.url, {
    fsCache: false,
    moduleCache: false,
    interopDefault: true
  });

  const loaded = await jiti.import<BetterSwaggerTypesConfig>(resolvedPath, { default: true });
  validateConfig(loaded, resolvedPath);

  return {
    configPath: resolvedPath,
    configDir: path.dirname(resolvedPath),
    config: normalizeConfig(loaded)
  };
}

function validateConfig(config: BetterSwaggerTypesConfig, resolvedPath: string): void {
  if (!config || typeof config !== 'object') {
    throw new Error(`Config at ${resolvedPath} must export a default object.`);
  }

  if (typeof config.output !== 'string' || config.output.trim() === '') {
    throw new Error('Config `output` must be a non-empty string.');
  }

  if (!Array.isArray(config.schemas) || config.schemas.length === 0) {
    throw new Error('Config `schemas` must be a non-empty array.');
  }

  for (const [index, schema] of config.schemas.entries()) {
    const prefix = `Config schemas[${index}]`;

    if (!schema || typeof schema !== 'object') {
      throw new Error(`${prefix} must be an object.`);
    }

    if (typeof schema.name !== 'string' || schema.name.trim() === '') {
      throw new Error(`${prefix}.name must be a non-empty string.`);
    }

    if (typeof schema.source !== 'string' || schema.source.trim() === '') {
      throw new Error(`${prefix}.source must be a non-empty string.`);
    }

    if (schema.namespace !== undefined && (typeof schema.namespace !== 'string' || schema.namespace.trim() === '')) {
      throw new Error(`${prefix}.namespace must be a non-empty string when provided.`);
    }

    if (schema.format !== undefined && !['auto', 'openapi3', 'swagger2'].includes(schema.format)) {
      throw new Error(`${prefix}.format must be one of: auto, openapi3, swagger2.`);
    }

    if (schema.headers !== undefined) {
      if (!schema.headers || typeof schema.headers !== 'object' || Array.isArray(schema.headers)) {
        throw new Error(`${prefix}.headers must be an object of string values.`);
      }

      for (const [headerName, headerValue] of Object.entries(schema.headers)) {
        if (typeof headerValue !== 'string') {
          throw new Error(`${prefix}.headers.${headerName} must be a string.`);
        }
      }
    }
  }

  if (config.generator !== undefined) {
    if (config.generator.emitOperations !== undefined && typeof config.generator.emitOperations !== 'boolean') {
      throw new Error('Config generator.emitOperations must be a boolean when provided.');
    }

    if (config.generator.emitSchemas !== undefined && typeof config.generator.emitSchemas !== 'boolean') {
      throw new Error('Config generator.emitSchemas must be a boolean when provided.');
    }

    if (config.generator.emitSimpleAliases !== undefined && typeof config.generator.emitSimpleAliases !== 'boolean') {
      throw new Error('Config generator.emitSimpleAliases must be a boolean when provided.');
    }

    if (config.generator.resolveRefs !== undefined && typeof config.generator.resolveRefs !== 'boolean') {
      throw new Error('Config generator.resolveRefs must be a boolean when provided.');
    }

    if (config.generator.naming !== undefined && config.generator.naming !== 'stable') {
      throw new Error('Config generator.naming must be `stable` when provided.');
    }
  }
}
