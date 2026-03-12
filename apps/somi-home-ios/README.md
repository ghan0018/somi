# SOMI Home - iOS App

Native iOS client for SOMI patients to view and complete their treatment exercises.

## Prerequisites

- Xcode 15+
- Homebrew (for XcodeGen)

## Setup

1. Install XcodeGen:
   ```bash
   brew install xcodegen
   ```

2. Generate the Xcode project:
   ```bash
   cd apps/somi-home-ios
   xcodegen generate
   ```

3. Open the project:
   ```bash
   open SOMIHome.xcodeproj
   ```

## Environment

The app reads `API_BASE_URL` from `Info.plist` (defaults to `http://localhost:3000`).

To change it, edit the build setting `API_BASE_URL` in your Xcode scheme or in `project.yml` before regenerating.

## Architecture

- **Pattern**: MVVM with `@MainActor` ViewModels
- **Networking**: URLSession async/await (no third-party dependencies)
- **Auth**: JWT tokens stored in Keychain
- **Offline**: Completions queued in Core Data, synced when connectivity returns
- **Target**: iOS 17.0+
