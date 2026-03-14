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

## Pass 2
### Changes
- Upgraded the internal manifest to v2 and added a per-schema `generationKey` derived from schema hash, schema identity, and normalized generator options.
- Kept manifest v1 readable, but treated it as an incremental-cache miss so the next successful run rewrites it as v2.
- Changed `generateProject` to parse all schemas, emit artifacts only for schemas whose `generationKey` changed, and still compute the full expected output path set for stale cleanup and manifest writing.
- Added an artifact-path helper so unchanged schemas can skip emission without risking stale-file deletion.
- Added regression coverage for single-schema rewrites in multi-schema projects and for v1-to-v2 manifest upgrades.

### Measurements
- `bun run check`: passed, vitest duration 547ms
- `bun run build`: ESM 63ms, DTS 550ms
- `bun run bench:generate`:
  - `basic`: avg 6.74ms, cold 29.44ms, warm 0.55ms
  - `multi`: avg 2.20ms, cold 6.53ms, warm 0.86ms
- `npm_config_cache=/tmp/bst-npm-cache npm_config_logs_dir=/tmp/bst-npm-logs npm pack --json --dry-run`:
  - tarball size 38352 bytes
  - unpacked size 167232 bytes
  - entry count 12

### Risks
- Incremental skipping currently starts after parsing; parse time still dominates if schemas become very large.
- Warm benchmark variance is now mostly from process/runtime overhead because the tracked fixtures are small.

### Next Pass
- Parallelize content writes while keeping stale deletion sequential and deterministic in the logs.
- Trim package size by excluding published sourcemaps, then add a dedicated pack dry-run script and wire it into release validation.
- Re-run the full measurement set and close the log with final numbers plus any remaining bottlenecks.

## Pass 3
### Changes
- Parallelized generated-file writes with `Promise.all` while preserving deterministic debug logging order and keeping stale deletion sequential.
- Added `scripts/pack-dry-run.mjs` plus `bun run pack:dry-run`, and made it fail if any published `.map` files remain.
- Excluded `dist/**/*.map` from the published package by tightening the package `files` whitelist.
- Updated `release:check` to run the dry-run pack validation before smoke-pack.
- Hardened `scripts/smoke-pack.mjs` to use temporary npm and bun cache/temp directories so the release check does not depend on a healthy global cache.

### Measurements
- `bun run check`: passed, vitest duration 652ms during the final `release:check`
- `bun run build`: ESM 63ms, DTS 562ms during the final `release:check`
- `bun run bench:generate`:
  - `basic`: avg 4.79ms, cold 21.71ms, warm 0.42ms
  - `multi`: avg 1.28ms, cold 4.29ms, warm 0.46ms
- `bun run pack:dry-run`:
  - tarball size 15342 bytes
  - unpacked size 58975 bytes
  - entry count 9
- `bun run release:check`: passed after allowing the smoke-pack dependency install to use the network

### Final Comparison
- Warm `basic` reruns improved from 4.06ms to 0.42ms.
- Warm `multi` reruns improved from 5.19ms to 0.46ms.
- Published tarball size dropped from 36492 bytes to 15342 bytes by removing sourcemaps.
- The release path is now self-checking for sourcemaps and isolated from the broken global npm cache.

### Remaining Notes
- Incremental work still parses every schema before deciding whether to emit; large-schema improvements beyond this point should target parse/ref-resolution cost.
