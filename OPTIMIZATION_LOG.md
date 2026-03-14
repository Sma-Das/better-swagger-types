# Optimization Log

## Baseline
- Worktree: `/private/tmp/better-swagger-types-optimize`
- Branch: `codex/optimize-three-pass-tmp`
- `bun run check`: passed, vitest duration 467ms
- `bun run build`: ESM 89ms, DTS 578ms
- `bun run bench:generate`:
  - `basic`: avg 12.03ms, cold 35.99ms, warm 4.06ms
  - `multi`: avg 6.50ms, cold 10.88ms, warm 5.19ms
- `npm_config_cache=/tmp/bst-npm-cache npm_config_logs_dir=/tmp/bst-npm-logs npm pack --json --dry-run`:
  - tarball size 36492 bytes
  - unpacked size 157815 bytes
  - entry count 9

## Pass 1
### Changes
- Added `scripts/benchmark-generate.mjs` plus `bun run bench:generate` for repeatable cold/warm generation measurements.
- Stopped rereading the manifest during generation by loading it once in `generateProject` and threading it into the write path.
- Stopped rewriting `.better-swagger-types/manifest.json` on unchanged runs when only `generatedAt` would differ.
- Collected operations once per schema emission and reused that result for both `operations.ts` and `endpoints.ts`.
- Added a regression test that verifies an unchanged rerun writes zero generated files and preserves manifest contents.

### Measurements
- `bun run check`: passed, vitest duration 483ms
- `bun run build`: ESM 67ms, DTS 560ms
- `bun run bench:generate`:
  - `basic`: avg 8.25ms, cold 23.30ms, warm 4.53ms
  - `multi`: avg 3.66ms, cold 5.43ms, warm 5.22ms
- `npm_config_cache=/tmp/bst-npm-cache npm_config_logs_dir=/tmp/bst-npm-logs npm pack --json --dry-run`:
  - tarball size 37392 bytes
  - unpacked size 161537 bytes
  - entry count 12

### Risks
- Pass 1 reduces no-op churn but still fully parses and emits every schema on each run.
- Bench variance remains noticeable on warm runs because the fixture set is small.

### Next Pass
- Introduce manifest v2 with a per-schema `generationKey`.
- After parsing current schemas, skip `emitSchemaArtifacts` for unchanged schemas while still computing the full expected file list for stale cleanup.
- Add tests that prove only the changed schema folder rewrites in multi-schema configs and that v1 manifests upgrade cleanly.
