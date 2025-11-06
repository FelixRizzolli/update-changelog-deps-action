# update-changelog-deps-action

A focused GitHub Action that detects dependency changes (from `package.json`) and updates `CHANGELOG.md` automatically. It's ideal as a pre-step in a release workflow so changelogs are kept up-to-date and consistent.

## Highlights

- Detects dependency/version changes and updates or inserts entries into `CHANGELOG.md`.
- Emits outputs so downstream workflow steps can react (for example: only create a release if the changelog changed).
- Usable as a local action (`uses: ./`) during development or referenced from a published tag.

## Quick start

1. Ensure your workflow grants write permission to repository contents (needed to push changes):

```yaml
permissions:
  contents: write
```

2. Add a workflow that runs the action before your release step. Example:

```yaml
name: Create Release

on:
  push:
    branches: [ main ]
    paths: [ 'package.json', 'CHANGELOG.md' ]
  workflow_dispatch: {}

permissions:
  contents: write

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v5
        with:
          fetch-depth: 0

      - name: Update CHANGELOG
        id: update_changelog
        uses: ./
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
          package-json-path: 'package.json'
          changelog-path: 'CHANGELOG.md'

      - name: Run auto release
        if: steps.update_changelog.outputs.changelog-updated == 'true'
        uses: FelixRizzolli/auto-release-action@v1
        with:
          release_token: ${{ secrets.GITHUB_TOKEN }}
          package_json_path: 'package.json'
          changelog_path: 'CHANGELOG.md'
          tag_prefix: 'v'
          create_tag: 'true'
          create_release: 'true'
```

This pattern ensures a release is created only when the changelog was actually updated by the action.

## Inputs

| Name | Required | Default | Description |
|------|:--------:|:-------:|-------------|
| `github-token` | Yes | `${{ github.token }}` | GitHub token used to authenticate (needs `contents: write` to push changes) |
| `package-json-path` | No | `package.json` | Path to your `package.json` file |
| `changelog-path` | No | `CHANGELOG.md` | Path to your changelog file |

## Outputs

| Name | Description |
|------|-------------|
| `changes-detected` | `true` when dependency changes were detected |
| `changelog-updated` | `true` when `CHANGELOG.md` was modified |

## Behavior & expectations

- The action compares dependency versions and prepares an update to the changelog. It will commit and push the change when run with a token that has write permissions.
- Use the outputs to control subsequent workflow steps (for example, conditionally creating a release).
- When using `uses: ./` during development, ensure the compiled `dist/` is present if your action runtime expects it.

## Development

This repo uses TypeScript and Vitest for tests. Key scripts are defined in `package.json`.

Install dependencies:

```bash
pnpm install
```

Build (compiles TypeScript and bundles the runtime):

```bash
pnpm build
```

Run tests:

```bash
pnpm test
```

Run tests with coverage:

```bash
pnpm test:coverage
```

Type-check only:

```bash
pnpm type-check
```

Format / lint:

```bash
pnpm format
pnpm lint
```

Notes:

- The action runtime entry is `dist/index.js` (built from `lib/index.js`). Commit `dist/` when you want workflows to use the repository directly (`uses: ./`).

## Troubleshooting

- If pushes fail, double-check the `permissions` block and that you're providing a token (e.g., `${{ secrets.GITHUB_TOKEN }}`) with write permissions.
- If the action output is not available, ensure you set an `id` on the step (example: `id: update_changelog`) and reference `steps.<id>.outputs.<name>`.

## Contributing

Contributions are welcome. Please open issues or pull requests with focused changes and include tests for new behavior.

## License

MIT — see `LICENSE`.

## Maintainer

Felix Rizzolli — https://github.com/FelixRizzolli

