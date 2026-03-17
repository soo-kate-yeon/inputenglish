# Shadowoo App Store Deployment Guide

## Prerequisites (One-time Setup)

### 1. Apple Developer Account

- [ ] Apple Developer Program membership ($99/year)
- [ ] App Store Connect access

### 2. EAS Project Setup

```bash
cd apps/mobile
eas login
eas init  # Gets EAS project ID
```

Then update `app.json`:

- `extra.eas.projectId` -> your EAS project ID
- `updates.url` -> `https://u.expo.dev/YOUR_PROJECT_ID`

### 3. App Store Connect - Create App

1. Go to https://appstoreconnect.apple.com
2. My Apps -> "+" -> New App
3. Fill in:
   - Platform: iOS
   - Name: Shadowoo
   - Primary Language: Korean
   - Bundle ID: kr.shadowoo.app
   - SKU: shadowoo
4. Note the **Apple ID** (number) from the app page URL

### 4. Update Credentials

**eas.json** - update `submit.production.ios`:

```json
{
  "ascAppId": "YOUR_APP_APPLE_ID",
  "appleTeamId": "YOUR_TEAM_ID"
}
```

**fastlane/Appfile** - update:

```ruby
apple_id("your@email.com")
team_id("YOUR_TEAM_ID")
itc_team_id("YOUR_ITC_TEAM_ID")
```

### 5. ASC API Key (for automated submission)

1. App Store Connect -> Users and Access -> Integrations -> App Store Connect API
2. Generate API Key (Admin role)
3. Download the .p8 file
4. Set as EAS secrets:

```bash
eas secret:create --name ASC_API_KEY_ID --value "YOUR_KEY_ID"
eas secret:create --name ASC_ISSUER_ID --value "YOUR_ISSUER_ID"
```

### 6. GitHub Secrets

Add to repository Settings -> Secrets:

- `EXPO_TOKEN` - from https://expo.dev/accounts/[account]/settings/access-tokens

---

## Automated Pipeline

### Tag-based Release (Recommended)

```bash
# Bump version + create tag
./scripts/version-bump.sh patch  # or minor, major

# Commit and push
git add app.json
git commit -m "chore: release v1.0.1"
git tag v1.0.1
git push origin main --tags
```

This triggers: EAS Build -> EAS Submit -> App Store Connect

### Manual Trigger

Go to GitHub Actions -> "Mobile Build & Submit" -> Run workflow

### Full Release Script

```bash
./scripts/release.sh patch
# Then: git push origin main --tags
```

---

## Metadata Management

### Upload metadata

```bash
cd apps/mobile
fastlane ios upload_metadata
```

### Upload screenshots

```bash
fastlane ios upload_screenshots
```

### Download existing metadata

```bash
fastlane ios download_metadata
```

---

## Manual Tasks Checklist

Before first submission:

- [ ] App Store screenshots (6.7", 6.5", 5.5" iPhone + iPad if applicable)
- [ ] App icon 1024x1024 (already exists in Xcode assets)
- [ ] Privacy Policy page at https://shadowoo.kr/privacy
- [ ] Support page at https://shadowoo.kr/support
- [ ] Review app metadata in `fastlane/metadata/ko/` and `en-US/`
- [ ] Set up RevenueCat production API keys
- [ ] Configure push notification certificates (APN)
- [ ] App Store review notes (demo account if needed)

---

## File Structure

```
apps/mobile/
├── eas.json                    # EAS Build + Submit config
├── app.json                    # Expo app config
├── Gemfile                     # Fastlane dependency
├── scripts/
│   ├── version-bump.sh         # Version bump utility
│   └── release.sh              # Full release pipeline
└── fastlane/
    ├── Appfile                 # App credentials
    ├── Fastfile                # Automation lanes
    ├── Deliverfile             # Deliver config
    ├── rating_config.json      # App age rating
    ├── metadata/
    │   ├── copyright.txt
    │   ├── primary_category.txt
    │   ├── ko/                 # Korean metadata
    │   │   ├── name.txt
    │   │   ├── subtitle.txt
    │   │   ├── description.txt
    │   │   ├── keywords.txt
    │   │   └── ...
    │   └── en-US/              # English metadata
    │       ├── name.txt
    │       └── ...
    └── screenshots/
        ├── ko/                 # Korean screenshots
        └── en-US/              # English screenshots
```

## blitz-mac (Optional - Local Automation)

Install from: https://github.com/blitzdotdev/blitz-mac
After install, enable in `.mcp.json` by setting `"disabled": false` for the blitz server.
Provides: simulator control, App Store Connect management, build pipeline via MCP.
