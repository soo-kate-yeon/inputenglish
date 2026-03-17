#!/bin/bash
# Version bump script for Shadowoo mobile app
# Usage: ./scripts/version-bump.sh [major|minor|patch]

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
APP_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
APP_JSON="$APP_DIR/app.json"

BUMP_TYPE="${1:-patch}"

# Read current version from app.json
CURRENT_VERSION=$(node -e "console.log(require('$APP_JSON').expo.version)")

# Parse version parts
IFS='.' read -r MAJOR MINOR PATCH <<< "$CURRENT_VERSION"

case "$BUMP_TYPE" in
  major)
    MAJOR=$((MAJOR + 1))
    MINOR=0
    PATCH=0
    ;;
  minor)
    MINOR=$((MINOR + 1))
    PATCH=0
    ;;
  patch)
    PATCH=$((PATCH + 1))
    ;;
  *)
    echo "Usage: $0 [major|minor|patch]"
    exit 1
    ;;
esac

NEW_VERSION="$MAJOR.$MINOR.$PATCH"

# Update app.json using node (preserves JSON formatting)
node -e "
const fs = require('fs');
const appJson = JSON.parse(fs.readFileSync('$APP_JSON', 'utf8'));
appJson.expo.version = '$NEW_VERSION';
fs.writeFileSync('$APP_JSON', JSON.stringify(appJson, null, 2) + '\n');
"

echo "Version bumped: $CURRENT_VERSION -> $NEW_VERSION"
echo ""
echo "Next steps:"
echo "  git add app.json"
echo "  git commit -m \"chore: bump version to $NEW_VERSION\""
echo "  git tag v$NEW_VERSION"
echo "  git push origin main --tags"
