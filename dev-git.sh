#!/bin/bash

MAIN_BRANCH="master"
DEVELOPMENT_BRANCH="development"

ACTION=$1
TYPE=$2

if [ "$ACTION" == "branch" ]; then

  if [ "$#" -lt 3 ]; then
    echo "Usage: sh dev-git.sh <branch> <type> <branch-name|scope branch-name>"
    echo "Allowed branch types: feature, bugfix, hotfix"
    exit 1
  fi

  if [ "$#" -eq 3 ]; then
      BRANCH_NAME="$TYPE/${@:3}" # No scope
    else
      BRANCH_NAME="$TYPE/${@:3:1}/${@:4}" # With scope
    fi

    BASE_BRANCH=""
    if [ "$TYPE" == "feature" ]; then
      BASE_BRANCH=$DEVELOPMENT_BRANCH
    elif [ "$TYPE" == "bugfix" ]; then
      BASE_BRANCH=$DEVELOPMENT_BRANCH
    elif [ "$TYPE" == "hotfix" ]; then
      BASE_BRANCH=$MAIN_BRANCH
    else
      echo "ERROR: Invalid branch type. Allowed types: feature, bugfix, hotfix."
      exit 1
    fi

    PATTERN="^(feature|bugfix|hotfix)(\/[a-zA-Z0-9\-]+)?\/[a-zA-Z0-9\-]+$"
    if [[ ! "$BRANCH_NAME" =~ $PATTERN ]]; then
      echo "ERROR: Invalid branch name format."
      echo "Branch name must match the format: <type>/<scope>/<branch-name> or <type>/<branch-name>"
      exit 1
    fi

    if git show-ref --quiet refs/heads/"$BRANCH_NAME"; then
      echo "ERROR: Branch '$BRANCH_NAME' already exists."
      exit 1
    fi

    git checkout "$BASE_BRANCH" || exit 1
    git pull origin "$BASE_BRANCH" || exit 1

    git checkout -b "$BRANCH_NAME"
    echo "Switched to new branch '$BRANCH_NAME' from '$BASE_BRANCH'"

elif [ "$ACTION" == "commit" ]; then

  if [ "$#" -lt 3 ]; then
    echo "Usage: sh dev-git.sh <commit> <type> <commit-message>"
    echo "Allowed commit types: feat, fix, refactor, chore"
    exit 1
  fi

  MESSAGE="${@:3}"

  if [[ ! "$TYPE" =~ ^(feat|fix|refactor|chore)$ ]]; then
    echo "ERROR: Invalid commit type. Allowed types: feat, fix, refactor, chore."
    exit 1
  fi

  COMMIT_MSG="$TYPE: $MESSAGE"

  git add .

  git commit -m "$COMMIT_MSG"

  if [ $? -eq 0 ]; then
    echo "Commit successful with message: '$COMMIT_MSG'"
  else
    echo "ERROR: Commit failed."
    exit 1
  fi
elif [ "$ACTION" == "install" ]; then

  if [ "$#" -lt 2 ]; then
    echo "Usage: sh dev-git.sh install hooks"
    echo "Allowed install types: hooks"
    exit 1
  fi

  if [ "$TYPE" == "hooks" ]; then
    echo "Installing hooks..."

    mkdir -p .git/hooks

    cp .dev-git/hooks/commit-msg .git/hooks/commit-msg
    cp .dev-git/hooks/pre-push .git/hooks/pre-push

    chmod +x .git/hooks/commit-msg
    chmod +x .git/hooks/pre-push

    echo "Git hooks installed successfully."
  else
    echo "ERROR: Invalid install type. Allowed type: hooks."
    exit 1
  fi

else
  echo "ERROR: Invalid action. Use 'branch', 'commit', or 'install'."
  exit 1
fi
