# SOMI Home — Android

Native Android client for the SOMI Home patient-facing app. Built with Kotlin, Jetpack Compose, and Material 3.

## Prerequisites

- Android Studio Hedgehog (2023.1.1) or later
- JDK 17+
- Android SDK with API 35 installed

## Setup

1. Open `apps/somi-home-android/` as an Android Studio project
2. Sync Gradle and let dependencies download
3. Configure `API_BASE_URL` in `app/build.gradle.kts` if needed (defaults to `http://10.0.2.2:3000/` for emulator loopback)
4. Run on an emulator or device with Android 8.0+ (API 26+)

## Architecture

- **MVVM** with Hilt dependency injection
- **Retrofit + Moshi** for networking
- **Room** for offline completion queue
- **WorkManager** for background sync
- **ExoPlayer (Media3)** for exercise video playback
- **EncryptedSharedPreferences** for secure token storage

## Project Structure

```
app/src/main/java/com/somi/home/
├── core/
│   ├── auth/          # TokenManager, AuthRepository, AuthState
│   ├── connectivity/  # ConnectivityObserver
│   ├── database/      # Room database, DAO, entities
│   ├── models/        # API data models (Moshi)
│   ├── network/       # ApiService, AuthInterceptor
│   └── sync/          # CompletionSyncWorker
├── di/                # Hilt modules (App, Network, Database)
├── features/
│   ├── auth/          # LoginScreen + ViewModel
│   ├── messages/      # MessagesScreen + ViewModel
│   ├── plan/          # PlanScreen + ViewModel
│   └── today/         # TodayScreen, ExerciseDetailScreen + ViewModels
├── navigation/        # AppNavigation, NavRoutes
├── ui/
│   ├── components/    # EmptyStateView, SyncBadge, LoadingSkeleton, ParameterChip
│   └── theme/         # Color, Theme, Typography
├── MainActivity.kt
└── SOMIApp.kt
```

## Key Features

- **Today view**: Daily exercise assignments with completion tracking
- **Offline support**: Completions queued locally and synced when online
- **Treatment plan**: View full plan with expandable session cards
- **Messaging**: Real-time chat with therapist
- **Video playback**: Exercise demonstration videos via ExoPlayer
- **Secure auth**: JWT tokens stored in EncryptedSharedPreferences

## Backend

The app connects to the SOMI Connect backend (`services/somi-connect`). Make sure the backend is running locally before testing:

```bash
npm run dev -w somi-connect
```
