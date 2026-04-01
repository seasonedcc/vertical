---
name: release
description: Release a new version of the itsvertical npm package. Bump version, build, publish, and create a GitHub release. Use when the user mentions releasing, publishing, cutting a release, or shipping a new version.
metadata:
  internal: true
---

# Release

Automate the release workflow for the `itsvertical` npm package.

## Instructions

### 1. Determine the next version

Find the latest git tag:

```bash
git tag --list 'v*' --sort=-version:refname | head -1
```

Read the current version from `package.json`.

Get the diff since the last release tag:

```bash
git log <last-tag>..HEAD --oneline
git diff <last-tag>..HEAD --stat
```

Determine the next version following semver. Since we're on `0.0.x`, breaking changes can go in patch releases. Bump the patch version unless the user specifies otherwise.

### 2. Bump version in package.json

Edit `package.json` to set the new version number.

### 3. Run pnpm install

```bash
pnpm install
```

This updates the lockfile with the new version.

### 4. Run checks

```bash
pnpm run lint-fix && pnpm run tsc && pnpm run test && pnpm run build
```

All must pass before proceeding.

### 5. Commit and push

Commit `package.json` and `pnpm-lock.yaml` with message `v<new-version>`. Push to `main`.

### 6. Ask the user to publish

Tell the user to run:

```
npm publish
```

**Do not run `npm publish` yourself** — it requires an OTP. Wait for the user to confirm they've published before continuing.

### 7. Create the GitHub release

Once the user confirms the publish, create a GitHub release.

Write release notes by analyzing the diff between the previous tag and `HEAD`. Follow the pattern from previous releases:

- A short title line describing the main theme
- A `### What's new` section with bullet points for each notable change
- An `### Also in this release` section for minor changes (if any)
- A `### New contributors` section if there are first-time contributors (see below)
- A `**Full diff**` link at the end

#### Check for new contributors

Find all contributors in this release and compare against previous releases:

```bash
# Contributors in this release
gh pr list --state merged --search "merged:>=<last-tag-date>" --json author --jq '.[].author.login' | sort -u

# All previous contributors
git log <last-tag> --format="%aN" | sort -u
```

For each new contributor, add a line like:
```
- @username made their first contribution in #<PR-number> 🎉
```

Use this format for the full diff link:
```
**Full diff**: https://github.com/seasonedcc/vertical/compare/v<previous>...v<new>
```

Create the release:

```bash
gh release create v<new-version> --title "v<new-version>" --notes "<release-notes>"
```

Use a HEREDOC for the notes to preserve formatting.
