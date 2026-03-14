# better-swagger-types

Prisma-style TypeScript type generation for Swagger / OpenAPI JSON schemas.

`better-swagger-types` generates stable, ergonomic TypeScript output into `lib/generated` without forcing an HTTP client. The generated code is types-first by default and works well with `fetch`, `axios`, `swr`, and React Query.

## Features

- Prisma-like `init` and `generate` workflow
- Multiple schemas with friendly names and namespaces
- Local file, directory, glob, and remote URL schema sources
- OpenAPI v3 and Swagger v2 support
- Deterministic output with stable operation naming
- Optional simple path aliases such as `HereTooSomethingHereV1API`
- Generated `paths`, `schemas`, `simple`, `operations`, `endpoints`, and `meta` files
- Optional watch mode and clean command
- No runtime dependency required in generated files

## Installation

```bash
bun add -d better-swagger-types
```

npm also works:

```bash
npm install --save-dev better-swagger-types
```

## Quick Start

Initialize the config file:

```bash
bunx better-swagger-types --init
```

Generate types:

```bash
bunx better-swagger-types generate
```

Default command behavior is `generate`, so this is equivalent:

```bash
bunx better-swagger-types
```

## Commands

```bash
better-swagger-types --init
better-swagger-types init [--config <path>] [--force]
better-swagger-types generate [--config <path>] [--no-cache] [--verbose]
better-swagger-types dev [--config <path>] [--no-cache] [--verbose]
better-swagger-types clean [--config <path>] [--verbose]
```

## Config

`better-swagger-types` creates `api.swagger-types.ts` in your project root.

```ts
import { defineConfig } from 'better-swagger-types/config';

export default defineConfig({
  output: 'lib/generated',
  prismaStyleNodeModulesOutput: false,
  schemas: [
    {
      name: 'core',
      source: './schemas/core.json',
      headers: {
        Authorization: `Bearer ${process.env.API_TOKEN ?? ''}`
      },
      format: 'auto',
      namespace: 'Core'
    }
  ],
  generator: {
    emitOperations: true,
    emitSchemas: true,
    emitSimpleAliases: false,
    resolveRefs: true,
    naming: 'stable'
  }
});
```

### Config Options

- `output`: relative or absolute output directory for generated files
- `prismaStyleNodeModulesOutput`: writes a marker manifest to `node_modules/.better-swagger-types`
- `schemas`: one or more schema source definitions
- `schemas[].name`: friendly schema name
- `schemas[].source`: file path, directory, glob, or `http(s)` URL
- `schemas[].headers`: headers for remote fetches
- `schemas[].format`: `auto`, `openapi3`, or `swagger2`
- `schemas[].namespace`: optional TS namespace override
- `generator.emitOperations`: emit `operations.ts` and `endpoints.ts`
- `generator.emitSchemas`: emit `schemas.ts`
- `generator.emitSimpleAliases`: emit path-derived aliases in `simple.ts`
- `generator.resolveRefs`: validate and bundle refs when possible
- `generator.naming`: currently supports `stable`

## Generated Output

```text
lib/generated/
  index.ts
  core/
    index.ts
    paths.ts
    schemas.ts
    simple.ts      # when emitSimpleAliases is true
    operations.ts
    endpoints.ts
    meta.ts
```

Generated files include:

- `paths.ts`: OpenAPI-style `paths` mapping plus canonical component types
- `schemas.ts`: schema component aliases such as `User` and `CreateUserInput`
- `simple.ts`: optional path-derived aliases such as `UsersByIdAPI` and `HereTooSomethingHereV1API`
- `operations.ts`: operation-level ergonomic mapping keyed by stable names
- `endpoints.ts`: endpoint mapping keyed by `"METHOD /path"`
- `meta.ts`: deterministic metadata including schema hash

### Simple Path Aliases

Enable `generator.emitSimpleAliases` to emit a `simple.ts` file with path item aliases derived from route paths.

```ts
import type { Simple } from './lib/generated';

type UsersByIdAPI = Simple.UsersByIdAPI;
type HereTooSomethingHereV1API = Simple.HereTooSomethingHereV1API;
```

## Usage Examples

### `fetch`

```ts
import type { Core } from './lib/generated';

type GetUserEndpoint = Core.Endpoints['GET /users/{id}'];
type GetUserParams = Core.ParamsFor<GetUserEndpoint>;
type GetUserResponse = Core.EndpointSuccessResponseFor<GetUserEndpoint>;

async function getUser(params: GetUserParams): Promise<GetUserResponse> {
  const response = await fetch(`/users/${params.path.id}`);
  return response.json() as Promise<GetUserResponse>;
}
```

### `axios`

```ts
import axios from 'axios';
import type { Core } from './lib/generated';

type CreateUser = Core.Endpoints['POST /users'];

async function createUser(body: Core.RequestBodyFor<CreateUser>) {
  return axios.post<Core.EndpointSuccessResponseFor<CreateUser>>('/users', body);
}
```

### SWR

```ts
import useSWR from 'swr';
import type { Core } from './lib/generated';

type GetUser = Core.Endpoints['GET /users/{id}'];
type GetUserResponse = Core.EndpointSuccessResponseFor<GetUser>;

const fetcher = async (url: string): Promise<GetUserResponse> => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error('Request failed');
  }
  return response.json() as Promise<GetUserResponse>;
};

export function useUser(id: string) {
  return useSWR(`/users/${id}`, fetcher);
}
```

### React Query

```ts
import { useQuery } from '@tanstack/react-query';
import type { Core } from './lib/generated';

type GetUser = Core.Endpoints['GET /users/{id}'];

export function useUser(id: string) {
  return useQuery<Core.EndpointSuccessResponseFor<GetUser>>({
    queryKey: ['user', id],
    queryFn: async () => {
      const response = await fetch(`/users/${id}`);
      return response.json() as Promise<Core.EndpointSuccessResponseFor<GetUser>>;
    }
  });
}
```

## Schema Sources

### Single file

```ts
schemas: [{ name: 'core', source: './schemas/core.json' }]
```

### Directory

A directory expands non-recursively to all `*.json` files. If multiple files are found, each one becomes its own generated schema namespace.

```ts
schemas: [{ name: 'services', source: './schemas', namespace: 'Services' }]
```

### Glob

```ts
schemas: [{ name: 'apis', source: './schemas/**/*.json' }]
```

### Remote URL

```ts
schemas: [
  {
    name: 'remote',
    source: 'https://example.com/openapi.json',
    headers: {
      Authorization: `Bearer ${process.env.API_TOKEN ?? ''}`
    }
  }
]
```

Remote schemas are cached in `.better-swagger-types/cache/`. If the server returns `ETag` or `Last-Modified`, subsequent runs use conditional requests automatically. Use `--no-cache` to bypass the cache.

## Troubleshooting

### Config missing

Run:

```bash
bunx better-swagger-types --init
```

### Remote URL fails

- confirm the URL returns JSON
- verify any auth headers in `schemas[].headers`
- rerun with `--verbose` to see cache and resolution details

### Invalid schema

`better-swagger-types` validates the document and surfaces parser errors with path context. Fix the schema and rerun generation.

### Output path contains old files

Run:

```bash
bunx better-swagger-types clean
```

### Missing `operationId`

This is fine. `better-swagger-types` falls back to a stable `Method + Path` name such as `GetUsersById`.

## Development

```bash
bun run build
bun run typecheck
bun run test
```

Example schemas live in `examples/`.

## Release Automation

Automated npm publishing is configured through [`deploy.yml`](.github/workflows/deploy.yml).

The workflow is designed for npm trusted publishing via GitHub Actions OIDC:

- publishes only from `v*` git tags
- requires the GitHub Actions job to obtain an OIDC token
- uses the GitHub Environment named `release`
- runs `bun run release:check` before publishing
- performs a packaged-artifact smoke test before `npm publish`

### One-time setup

1. In GitHub, create an environment named `release`.
2. In that environment, require at least one reviewer and disable self-review if you want a manual approval gate before publish.
3. In npm package settings for `better-swagger-types`, configure a trusted publisher for:
   - owner: `Sma-Das`
   - repository: `better-swagger-types`
   - workflow filename: `deploy.yml`
4. In npm package settings, prefer tokenless publishing by disallowing classic automation tokens once trusted publishing is working.

### Release flow

```bash
npm version patch
git push origin main --follow-tags
```

That pushes a tag such as `v0.1.4`, triggers the deploy workflow, validates the packaged artifact, and publishes to npm if the `release` environment and npm trusted publisher both allow it.
