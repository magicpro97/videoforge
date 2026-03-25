# VideoForge Development

## Build & Test
- `npm run build` — Compile TypeScript
- `npm test` — Run tests with coverage (100% threshold)
- `npm run dev` — Build + run

## Conventions
- ESM modules with `.js` extensions in imports
- Dynamic imports for chalk and ora
- 100% test coverage enforced
- Tests use `--pool=forks --poolOptions.forks.maxForks=1`
