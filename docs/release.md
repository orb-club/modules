# Release Process

This package publishes to npm as `@orbclub/modules`.

## Source of Truth

Each npm version maps to one immutable git tag:

```bash
modules-v<version>
```

The release workflow refuses to publish unless the pushed tag exactly matches
the `package.json` version. For example, `package.json` version `1.2.3` must be
published from tag `modules-v1.2.3`.

Do not create a branch per version by default. Use git tags plus npm package
immutability for normal releases. Create a maintenance branch only when an older
minor line needs patches, using a name like `release/0.1.x`.

## npm Publishing Auth

The normal publish path is GitHub Actions trusted publishing.

npm trusted publisher setup requires the package to already exist in the npm
registry. For the first publish, add a temporary repository secret named
`NPM_TOKEN`, push the first release tag, then delete that secret after the
package is published.

After the package exists, configure the trusted publisher:

- npm package: `@orbclub/modules`
- GitHub repository: `orb-club/modules`
- Workflow path: `.github/workflows/release.yml`
- Environment: `npm`

Equivalent npm CLI command:

```bash
npm trust github @orbclub/modules --repo orb-club/modules --file release.yml --env npm
```

The workflow uses `id-token: write`, so npm can issue short-lived OIDC-backed
publish credentials. Public packages published from public repositories through
trusted publishing receive npm provenance automatically.

The first publish path uses the same workflow with `NPM_TOKEN` and
`npm publish --provenance`. After trusted publishing is configured, remove the
`NPM_TOKEN` secret so the workflow uses OIDC only.

## Release Checklist

Before publishing, verify that the exact package version does not already exist:

```bash
npm view @orbclub/modules@<version> version
```

```bash
bun install
bun run check
bun run test
bun run test:types
bun run lint
bun run build
npm pack --dry-run
git status --short
git push origin main
git tag -a modules-v<version> -m "@orbclub/modules v<version>"
git push origin modules-v<version>
```

The tag push starts `.github/workflows/release.yml`.

If trusted publishing is not configured yet, publish with the npm CLI after the
checks pass, then push the matching tag. The workflow is idempotent for already
published versions.

## Pinning npm to GitHub

Consumers pin an exact npm version:

```bash
npm install @orbclub/modules@<version>
```

To audit where that package came from:

```bash
npm view @orbclub/modules@<version> version gitHead dist.integrity
git rev-list -n 1 modules-v<version>
```

The npm version, git tag, and workflow provenance should all point to the same
repository state.
