#!/bin/bash
# Create a new feature branch with git worktree
# Usage: ./create-feature-branch.sh <feature-name> [branch-type]
# Example: ./create-feature-branch.sh auth-system feature
#          ./create-feature-branch.sh fix-login bugfix

set -e

if [ -z "$1" ]; then
  echo "Usage: $0 <feature-name> [branch-type]"
  echo ""
  echo "Branch types: feature (default), bugfix, hotfix, chore"
  echo ""
  echo "Examples:"
  echo "  $0 auth-system              # Creates feature/auth-system"
  echo "  $0 fix-login bugfix         # Creates bugfix/fix-login"
  echo "  $0 critical-patch hotfix    # Creates hotfix/critical-patch"
  exit 1
fi

FEATURE_NAME="$1"
BRANCH_TYPE="${2:-feature}"

# Validate branch type
case "$BRANCH_TYPE" in
  feature|bugfix|hotfix|chore)
    ;;
  *)
    echo "Error: Invalid branch type '$BRANCH_TYPE'"
    echo "Valid types: feature, bugfix, hotfix, chore"
    exit 1
    ;;
esac

BRANCH_NAME="${BRANCH_TYPE}/${FEATURE_NAME}"
WORKTREE_NAME="${BRANCH_TYPE}-${FEATURE_NAME}"
WORKTREE_PATH="../${WORKTREE_NAME}"

# Check if worktree already exists
if git worktree list | grep -q "$WORKTREE_NAME"; then
  echo "Error: Worktree '${WORKTREE_NAME}' already exists"
  echo ""
  echo "Existing worktrees:"
  git worktree list
  echo ""
  echo "To remove it, run:"
  echo "  git worktree remove .git/worktrees/${WORKTREE_NAME}"
  exit 1
fi

# Create worktree
echo "Creating worktree: ${WORKTREE_NAME}..."
git worktree add -b "$BRANCH_NAME" "$WORKTREE_PATH"

# Print success message
echo ""
echo "✓ Feature branch created successfully!"
echo ""
echo "Branch:   $BRANCH_NAME"
echo "Worktree: $WORKTREE_PATH"
echo ""
echo "Next steps:"
echo "  1. cd $WORKTREE_PATH"
echo "  2. Make your changes"
echo "  3. Commit and push: git push -u origin $BRANCH_NAME"
echo "  4. Create PR: gh pr create --title 'Your title' --body 'Your description'"
echo ""
echo "To list all worktrees:"
echo "  git worktree list"
echo ""
echo "To remove this worktree when done:"
echo "  git worktree remove .git/worktrees/${WORKTREE_NAME}"
