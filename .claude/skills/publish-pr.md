---
name: publish-pr
description: Push branch and create a PR when work is ready
type: interactive
---

# Publish PR Skill

Creates and publishes a pull request for your current feature branch when work is complete.

## Usage

When your feature branch is ready for review:

```
/publish-pr
```

Or with optional custom title/description:

```
/publish-pr --title "Custom PR title" --body "Custom description"
```

## What This Skill Does

1. **Verifies branch state** — Checks that you're on a feature branch with commits
2. **Pushes to remote** — Pushes your branch to GitHub with `-u` flag
3. **Creates PR** — Generates a PR title and description from your commits
4. **Opens in browser** — Shows you the PR URL and returns it

## Example

```bash
# After you've made commits on fix/search-timeout
/publish-pr

# Returns:
# PR created: https://github.com/yourusername/SalvageScout/pull/42
```

## Commit Message Format

The skill uses your commit messages to auto-generate PR titles and descriptions:

- **Conventional commits** (`feat:`, `fix:`, `docs:`, etc.) are parsed
- First commit becomes PR title
- All commits appear in PR body
- Follows your repo's conventions

## PR Requirements

PRs must:
- Target `main` branch
- Have meaningful commit messages
- Be based on latest `main` (no merge conflicts)

## Troubleshooting

**"Not on a feature branch"**
- Make sure you've created a feature branch first (not on `main`)

**"No commits to push"**
- Create at least one commit with `git commit -m "..."`

**"Cannot push to remote"**
- Check GitHub credentials and network access
- Verify branch doesn't exist on remote yet

## Cleanup After Merge

Once your PR is merged:

```bash
# Delete local branch
git branch -d fix/your-feature

# Delete remote branch  
git push origin --delete fix/your-feature

# Clean up worktrees (if using feature-branch skill)
git worktree prune
```
