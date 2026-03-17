#!/bin/bash
# Full release script for Shadowoo mobile app
# Usage: ./scripts/release.sh [major|minor|patch]
#
# This script:
# 1. Bumps version
# 2. Commits and tags
# 3. Pushes (triggers CI/CD build + submit)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
APP_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

BUMP_TYPE="${1:-patch}"

echo "=== Shadowoo Release Pipeline ==="
echo ""

# Step 1: Version bump
echo "[1/4] Bumping version ($BUMP_TYPE)..."
"$SCRIPT_DIR/version-bump.sh" "$BUMP_TYPE"

# Read new version
NEW_VERSION=$(node -e "console.log(require('$APP_DIR/app.json').expo.version)")

# Step 2: Upload metadata via Fastlane
echo ""
echo "[2/4] Uploading metadata to App Store Connect..."
if command -v fastlane &> /dev/null; then
  cd "$APP_DIR"
  fastlane ios upload_metadata
else
  echo "  [SKIP] Fastlane not installed. Run: brew install fastlane"
fi

# Step 3: Git commit and tag
echo ""
echo "[3/4] Creating git commit and tag..."
cd "$APP_DIR"
git add app.json
git commit -m "chore: release v$NEW_VERSION"
git tag "v$NEW_VERSION"

# Step 4: Push (triggers CI/CD)
echo ""
echo "[4/4] Pushing to remote (triggers build + submit)..."
echo ""
echo "  Ready to push. Run:"
echo "    git push origin main --tags"
echo ""
echo "  This will trigger:"
echo "    - EAS Build (production profile)"
echo "    - Auto-submit to App Store Connect"
echo ""
echo "=== Release v$NEW_VERSION prepared ==="
