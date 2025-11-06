# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2025-11-06

### Added

- Automatic detection of dependency changes from `package.json` (supports `dependencies` and `devDependencies`). The action detects added, removed and version-updated packages and prepares changelog entries accordingly.
- Outputs to GitHub Actions: `changes-detected` (true when dependency changes are present) and `changelog-updated` (true when the changelog file was modified). These outputs make it easy to gate downstream steps (for example: only create a release when the changelog changed).
- Ability to update or insert entries into `CHANGELOG.md` following the Keep a Changelog format. The action will create or update an "Unreleased" or versioned entry describing dependency changes.
- Inputs for configuration: `github-token`, `package-json-path`, and `changelog-path` so the action can be used with custom paths or tokens.
- When run with a token that has `contents: write`, the action can commit and push changelog updates back to the repository so workflows can keep changelogs in sync automatically.
- A set of modular services implemented in TypeScript: `dependency-comparer.service`, `changelog-formatter.service`, `changelog.service`, `file.service`, and `git.service` to keep responsibilities clear and tests focused.
- A compiled runtime under `lib/` (and guidance to commit `dist/` for `uses: ./` local action runs) so the action can be executed from GitHub workflows without requiring on-run TypeScript compilation.
- Unit tests implemented with Vitest covering the core services and behavior.

### Changed

- Initial release — no prior versions to change from.

