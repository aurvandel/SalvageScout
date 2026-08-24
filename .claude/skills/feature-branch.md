---
name: feature-branch
description: Create and manage feature branches using git worktrees for parallel development
type: interactive
---

# Feature Branch Skill

This skill manages git worktrees and feature branches, enabling parallel development with isolated Claude sessions.

## Usage

When working on a new feature, invoke this skill:

```
/feature-branch <feature-name>
```

For example:
```
/feature-branch auth-system
/feature-branch notification-service
```

## What This Skill Does

1. **Creates a git worktree** — Sets up an isolated working directory for your feature
2. **Creates a feature branch** — `feature/<feature-name>` with proper naming conventions
3. **Prepares for PR creation** — Tracks which worktree corresponds to which feature
4. **Enables parallel Claude sessions** — Each worktree can be worked on independently

## How to Use Multiple Features in Parallel

### In Claude Code

Open multiple Claude Code sessions (CLI, desktop app, or web):

```bash
# Terminal 1 - Start work on auth system
cd /home/coder/SalvageScout
claude
# Then: /feature-branch auth-system

# Terminal 2 - Start work on notifications in parallel
cd /home/coder/SalvageScout
claude
# Then: /feature-branch notification-service

# Terminal 3 - Continue work on main branch
cd /home/coder/SalvageScout
claude
# (stays on main branch)
```

Each session operates independently in its own worktree, preventing conflicts.

### Managing Worktrees

List active worktrees:
```bash
git worktree list
```

Remove a worktree when done:
```bash
git worktree prune
git worktree remove .git/worktrees/<feature-name>
```

## Workflow

### 1. Create Feature Branch
```
/feature-branch my-feature
```
This creates:
- `.git/worktrees/feature-my-feature/` working directory
- `feature/my-feature` branch

### 2. Make Changes
Make changes directly in your Claude session. The worktree is isolated from main.

### 3. Commit and Create PR
When ready, commit your changes and create a PR:
```
git add <files>
git commit -m "feat: add my feature"
gh pr create --title "feat: add my feature" --body "..."
```

### 4. Cleanup
After PR is merged:
```
git worktree prune
```

## Key Benefits

- **Parallel Development**: Multiple Claude sessions work simultaneously without blocking
- **Isolated State**: Each worktree has its own branch, node_modules, build artifacts
- **Clean Main Branch**: Main branch stays clean; all work is in feature branches
- **Easy PR Management**: One feature per branch, easy to track and review

## Prerequisites

- Git 2.5+ (for worktree support)
- GitHub CLI (`gh`) for PR creation (optional but recommended)

## Naming Conventions

- **Features**: `feature/kebab-case-name`
- **Bugfixes**: `bugfix/kebab-case-name`
- **Hotfixes**: `hotfix/kebab-case-name`
- **Chores**: `chore/kebab-case-name`

Example:
```
/feature-branch auth-system
# Creates: feature/auth-system

/feature-branch fix-login-redirect
# Creates: bugfix/fix-login-redirect (if you add bugfix/ prefix)
```

## Troubleshooting

### Worktree already exists
If you get "worktree already exists" error, check:
```bash
git worktree list
```

Remove the existing worktree:
```bash
git worktree remove .git/worktrees/<feature-name>
```

### Switch between worktrees
Each Claude session should be in its own directory. To switch:
```bash
cd /path/to/worktree/directory
```

### Merge conflicts
When creating the PR, GitHub will handle conflict detection. If conflicts exist:
1. Pull latest main in your worktree
2. Resolve conflicts locally
3. Commit and push
4. GitHub will update PR status

## Integration with Claude Code

This skill automatically:
- Detects your current worktree
- Tracks branch context
- Suggests appropriate git operations
- Reminds you to clean up after merging

Ask Claude: "Create a feature branch for [feature name]" or invoke `/feature-branch <name>` directly.
