# Feature Branch Workflow with Git Worktrees

This project uses git worktrees to enable parallel development with Claude Code. This allows you to run multiple Claude sessions simultaneously, each working on a different feature without conflicts.

## Quick Start

### Single Feature Development

```bash
# Option 1: Use the helper script
./.claude/scripts/create-feature-branch.sh my-feature

# Option 2: Manual git commands
git worktree add -b feature/my-feature ../feature-my-feature
cd ../feature-my-feature
```

### Parallel Development

Open multiple terminal windows/sessions:

```bash
# Terminal 1 - Work on auth system
cd /home/coder/SalvageScout
./.claude/scripts/create-feature-branch.sh auth-system
cd ../feature-auth-system
claude  # Start Claude Code session here

# Terminal 2 - Work on API endpoints (in another terminal)
cd /home/coder/SalvageScout
./.claude/scripts/create-feature-branch.sh api-endpoints
cd ../feature-api-endpoints
claude  # Start another Claude Code session here

# Terminal 3 - Main branch work (optional)
cd /home/coder/SalvageScout
claude  # Work on main branch
```

Each terminal has its own isolated working directory and can run Claude independently.

## Understanding Git Worktrees

Git worktrees let you have multiple branches checked out simultaneously in different directories:

```
/home/coder/
├── SalvageScout/                    # Main worktree (main branch)
├── feature-auth-system/             # Feature worktree 1
├── bugfix-login-redirect/           # Feature worktree 2
└── feature-api-endpoints/           # Feature worktree 3
```

### Why Use Worktrees?

1. **No Conflicts**: Each worktree has its own `.git/index` and working directory
2. **Parallel Execution**: Run multiple Claude sessions simultaneously
3. **Isolated State**: `node_modules`, build artifacts, etc. are separate per worktree
4. **Clean History**: One feature per branch = clear commit history
5. **Easy Management**: Worktrees are tracked by git; use `git worktree list`

## Workflow Details

### 1. Create a Feature Branch

```bash
# Create feature branch for user authentication
./.claude/scripts/create-feature-branch.sh auth-system feature
```

This creates:
- Branch: `feature/auth-system`
- Directory: `../feature-auth-system/`

### 2. Work on the Feature

```bash
# Enter the worktree
cd ../feature-auth-system

# Start Claude Code
claude

# Make changes, commit, push
git add src/auth.ts
git commit -m "feat: add JWT authentication"
git push -u origin feature/auth-system
```

### 3. Create a Pull Request

```bash
# Inside the feature worktree
gh pr create \
  --title "feat: add JWT authentication" \
  --body "Implements JWT-based authentication system with refresh tokens"
```

Or use Claude directly:
```
Create a PR for this feature with a good title and description
```

### 4. Clean Up After Merging

```bash
# After your PR is merged on GitHub
git worktree list                          # See the worktree
git worktree remove .git/worktrees/feature-auth-system
```

Or prune all dead worktrees:
```bash
git worktree prune
```

## Naming Conventions

Follow these prefixes for consistency:

| Type    | Prefix | Example |
|---------|--------|---------|
| Feature | `feature/` | `feature/auth-system` |
| Bugfix  | `bugfix/` | `bugfix/login-redirect` |
| Hotfix  | `hotfix/` | `hotfix/security-patch` |
| Chore   | `chore/` | `chore/update-deps` |

### Using Different Branch Types

```bash
# Create a bugfix branch
./.claude/scripts/create-feature-branch.sh fix-login bugfix
# Creates: bugfix/fix-login in ../bugfix-fix-login/

# Create a hotfix
./.claude/scripts/create-feature-branch.sh security-patch hotfix
# Creates: hotfix/security-patch in ../hotfix-security-patch/

# Create a chore
./.claude/scripts/create-feature-branch.sh update-deps chore
# Creates: chore/update-deps in ../chore-update-deps/
```

## Common Commands

### List All Worktrees

```bash
git worktree list
```

Output example:
```
/home/coder/SalvageScout               (detached HEAD abc1234)
/home/coder/feature-auth-system        feature/auth-system abc5678
/home/coder/bugfix-login-redirect      bugfix/login-redirect def9012
```

### Switch Between Worktrees

```bash
# From one terminal, cd to a worktree
cd ../feature-auth-system
git status
git log

# Then start Claude for that worktree
claude
```

### Remove a Worktree

```bash
# Remove a specific worktree
git worktree remove .git/worktrees/feature-auth-system

# Prune all dead worktrees (branches that don't exist anymore)
git worktree prune

# Force remove if worktree is locked
git worktree remove --force .git/worktrees/feature-auth-system
```

### See What's in a Worktree

```bash
cd ../feature-auth-system
git log --oneline -5      # Recent commits
git status                # Current changes
git branch -vv            # Branch tracking info
```

## Running Multiple Claude Sessions

### Terminal Setup

```bash
# Terminal 1 - Create and work on feature 1
./.claude/scripts/create-feature-branch.sh feature-one
cd ../feature-feature-one
claude

# Terminal 2 - Create and work on feature 2 (while terminal 1 is open)
cd /home/coder/SalvageScout
./.claude/scripts/create-feature-branch.sh feature-two
cd ../feature-feature-two
claude

# Terminal 3 - Continue work on main (optional)
cd /home/coder/SalvageScout
claude
```

### Desktop App

If using Claude Code desktop app:
1. Open multiple windows with File → New Window
2. Each window can open a different worktree directory
3. Work in parallel without conflicts

## Troubleshooting

### Worktree Already Exists

```bash
# Error: worktree path already exists
# Solution: Check and remove existing worktree
git worktree list
git worktree remove .git/worktrees/feature-auth-system
```

### Can't Create Worktree

```bash
# Error: 'feature/auth-system' already exists as a branch
# Solution: Either use the existing branch or delete it
git branch -d feature/auth-system
# Then retry worktree creation
```

### Merge Conflicts When Creating PR

```bash
# GitHub detected conflicts
# Solution: Resolve in your worktree
git fetch origin
git rebase origin/main
# Fix conflicts in your editor
git add <resolved-files>
git rebase --continue
git push --force-with-lease origin feature/auth-system
```

### Worktree Locked

```bash
# Error: .git/worktrees/feature-name is locked
# Solution: Force remove
git worktree remove --force .git/worktrees/feature-name
```

## Integration with Claude Code

### Automatic Worktree Detection

When you run `claude` in a worktree directory, Claude automatically detects:
- Current branch name
- Worktree status
- Uncommitted changes

### Useful Slash Commands

```
/feature-branch <name>              # Create new feature branch
/code-review                        # Review changes before PR
gh pr create                        # Create pull request
```

## Best Practices

1. **One Feature Per Worktree**: Keep concerns separate
2. **Small, Focused PRs**: Makes code review easier
3. **Commit Often**: Push frequently to avoid losing work
4. **Branch Protection**: If using GitHub, protect main branch
5. **Keep Main Updated**: Periodically rebase on latest main
6. **Clean Up**: Remove worktrees after PRs are merged
7. **Clear Commit Messages**: Use conventional commits (feat:, fix:, chore:)

## Performance Considerations

- Each worktree has its own node_modules (~300MB+)
- Only create worktrees you're actively using
- Clean up completed worktrees to save disk space
- Limit to 3-5 parallel worktrees per machine

## Storage Requirements

- **Main repo**: ~1GB (with node_modules)
- **Per worktree**: ~1GB (with its own node_modules)
- **5 parallel worktrees**: ~6GB total

If storage is limited, remove node_modules after merging:
```bash
rm -rf ../feature-auth-system/node_modules
git worktree remove .git/worktrees/feature-auth-system
```

## See Also

- Git documentation: `man git-worktree`
- GitHub CLI: `gh pr --help`
- Project CLAUDE.md for project-specific guidelines
