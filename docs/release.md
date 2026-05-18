# Release Process

This package publishes to npm as `@orbclub/modules`.

## Source of Truth

Each npm version maps to one immutable git tag:

```bash
modules-v0.1.0
```

The release workflow refuses to publish unless the pushed tag exactly matches
the `package.json` version. For example, `package.json` version `0.1.0` must be
published from tag `modules-v0.1.0`.

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

## First Publish

Before the first real publish, verify that the package does not already exist:

```bash
npm view @orbclub/modules version
```

Create a temporary npm automation token, store it as the GitHub repository
secret `NPM_TOKEN`, then create and push the release tag:

```bash
bun install
bun run check
bun run test
bun run test:types
bun run lint
bun run build
npm pack --dry-run
git status --short
git tag -a modules-v0.1.0 -m "@orbclub/modules v0.1.0"
git push origin main
git push origin modules-v0.1.0
```

The tag push starts `.github/workflows/release.yml`.

After the first publish, configure trusted publishing and delete the temporary
`NPM_TOKEN` secret.

## Pinning npm to GitHub

Consumers pin an exact npm version:

```bash
bun add @orbclub/modules@0.1.0
```

To audit where that package came from:

```bash
npm view @orbclub/modules@0.1.0 version gitHead dist.integrity
git rev-list -n 1 modules-v0.1.0
```

The npm version, git tag, and workflow provenance should all point to the same
repository state.
