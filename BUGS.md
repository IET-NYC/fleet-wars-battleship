# BUGS.md

Running log of every real defect found while building Fleet Wars — from failing
tests, manual play, or code review. Entries are appended as they are found, not
written retroactively.

## Bug entries

### BUG-01: `npm run build` failed with "Cannot find type definition file for 'node'"
- **Found:** first run of `npm run build` on the fresh scaffold
- **Symptom:** `error TS2688: Cannot find type definition file for 'node'.` — the build aborted before Vite ever ran, so `tsc -b` gated every commit.
- **Root cause:** `tsconfig.node.json` declares `"types": ["node"]` (needed because `vite.config.ts` reads `process.env.VITE_BASE_PATH`), but `@types/node` was not in `devDependencies` after the dependency set was pinned to React 18 / Vite 5.
- **Fix:** added `@types/node` to `devDependencies` (commit `6eb07e6` lineage, PR #1).
- **Regression test:** `npm run build` in CI — the TypeScript project build is part of the build script, so a missing type package fails the pipeline.

## Testing approach

_Written at the end of the debugging phase._
