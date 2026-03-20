## fastlane documentation

# Installation

Make sure you have the latest version of the Xcode command line tools installed:

```sh
xcode-select --install
```

For _fastlane_ installation instructions, see [Installing _fastlane_](https://docs.fastlane.tools/#installing-fastlane)

# Available Actions

## iOS

### ios upload_metadata

```sh
[bundle exec] fastlane ios upload_metadata
```

Upload metadata to App Store Connect (no binary)

### ios upload_screenshots

```sh
[bundle exec] fastlane ios upload_screenshots
```

Upload screenshots to App Store Connect

### ios upload_all_metadata

```sh
[bundle exec] fastlane ios upload_all_metadata
```

Upload metadata + screenshots

### ios download_metadata

```sh
[bundle exec] fastlane ios download_metadata
```

Download existing metadata from App Store Connect

### ios download_screenshots

```sh
[bundle exec] fastlane ios download_screenshots
```

Download existing screenshots from App Store Connect

### ios screenshots

```sh
[bundle exec] fastlane ios screenshots
```

Capture screenshots from running simulators (Expo-compatible)

### ios bump_version

```sh
[bundle exec] fastlane ios bump_version
```

Bump version number

### ios release

```sh
[bundle exec] fastlane ios release
```

Full release: metadata + EAS build + submit

---

This README.md is auto-generated and will be re-generated every time [_fastlane_](https://fastlane.tools) is run.

More information about _fastlane_ can be found on [fastlane.tools](https://fastlane.tools).

The documentation of _fastlane_ can be found on [docs.fastlane.tools](https://docs.fastlane.tools).
