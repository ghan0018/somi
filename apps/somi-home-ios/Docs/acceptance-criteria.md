# SOMI Home - Acceptance Criteria

Manual verification checklist for the SOMI Home mobile app (iOS and Android).

---

## Prerequisites / Test Setup

### 1. Create a test patient account

1. Log into the SOMI Clinic web app as an admin
2. Navigate to Patients > Add Patient
3. Create a patient with a known email and password (e.g., `testpatient@somi.test` / `Test1234!`)
4. Note the patient's ID for plan assignment

### 2. Create a test published plan

1. In the Clinic web app, navigate to the patient's Treatment Plan
2. Add at least 2 sessions with different exercises:
   - Session 1: "Morning Routine" (timesPerDay: 2) with exercises that have video, reps, sets
   - Session 2: "Evening Routine" (timesPerDay: 1) with exercises that have seconds only
3. For at least one exercise, set a `paramsOverride` different from defaults
4. Publish the plan

### 3. Backend base URL

- Local development: `http://localhost:3000`
- Staging: configure via `API_BASE_URL` in Info.plist (iOS) or `BuildConfig.API_BASE_URL` (Android)

### 4. Testing offline behavior

- Use Airplane Mode on the physical device or simulator
- On iOS Simulator: use Network Link Conditioner or disconnect Mac's network
- On Android Emulator: Settings > Network & internet > toggle Airplane mode

---

## 1. Authentication

- [ ] App launch shows Login screen when not authenticated
- [ ] App launch auto-restores session if valid tokens exist (Today tab shown, no login needed)
- [ ] Entering valid patient email + password and tapping Sign In leads to Today tab
- [ ] Entering wrong password shows inline error "Incorrect email or password", stays on login screen
- [ ] Tapping Sign In with no network shows inline error mentioning internet connection, stays on login screen
- [ ] Therapist/admin credentials show "SOMI Home is for patients only" message, stays on login screen
- [ ] After sign-in, restarting app shows Today tab without re-login
- [ ] Logging out clears session; app shows login on next launch

## 2. Today Tab -- Exercise List

- [ ] Today tab is the default tab on first launch (post-login)
- [ ] Today's date shown in navigation bar title
- [ ] All exercises from published plan shown with titles
- [ ] Each exercise shows correct parameters: reps, sets, and/or seconds (using paramsOverride if set, otherwise defaultParams)
- [ ] Previously completed exercises show teal completion indicators pre-populated on load
- [ ] Tapping completion circle/checkbox immediately shows it as complete (teal, no loading spinner)
- [ ] Tapping completion circle when offline: checkbox marks teal, sync badge appears
- [ ] Sync badge shows count of pending completions
- [ ] When connectivity restored: sync badge disappears (completions synced)
- [ ] Pull-to-refresh reloads exercise list
- [ ] If exercise has timesPerDay > 1: multiple completion indicators shown (one per occurrence)

## 3. Exercise Detail

- [ ] Tapping an exercise row navigates to Exercise Detail screen
- [ ] Exercise title, description, and parameters all displayed correctly
- [ ] Parameters show only non-nil values (e.g., if only reps set, only reps chip shown)
- [ ] If exercise has video (mediaId present) and online: video player shows and plays on tap
- [ ] If exercise has video and offline: "Internet connection required to play this video" message shown (no crash)
- [ ] If no video: no video section shown
- [ ] "Mark Complete" button visible and marks exercise complete (same behavior as list view)
- [ ] Back navigation returns to Today list with completion state preserved

## 4. Treatment Plan Tab

- [ ] Plan tab shows all sessions from published plan in order
- [ ] Each session shows its title (or "Session N") and all assigned exercises
- [ ] Each exercise in plan shows merged parameters
- [ ] No completion checkboxes on Plan tab (read-only)
- [ ] If no published plan: empty state message shown (no error, no crash)

## 5. Messages Tab

- [ ] Messages tab shows conversation with therapist
- [ ] Client messages right-aligned (teal)
- [ ] Therapist messages left-aligned (white/light)
- [ ] Message input field and Send button visible at bottom
- [ ] Typing text enables Send button
- [ ] Send button disabled when offline
- [ ] Tapping Send sends message and appears in conversation
- [ ] If no messages yet: empty state shown (not a crash/error screen)

## 6. Offline Behavior

- [ ] App opens and shows previously loaded Today data when offline (from last online session)
- [ ] Marking exercise complete when offline: optimistic UI works, sync badge appears
- [ ] Navigating to Exercise Detail when offline: everything except video works
- [ ] Sending messages when offline: Send button disabled, no crash
- [ ] Connectivity banner or sync badge accurately reflects pending state

## 7. Edge Cases and Security

- [ ] Very long exercise description: text wraps correctly, no overflow
- [ ] Exercise with all three params (reps + sets + seconds): all three chips/labels shown
- [ ] Exercise with only seconds: only seconds shown
- [ ] Session with timesPerDay = 3: three completion indicators shown per exercise
- [ ] App does not log PHI to console (spot check with Xcode/Logcat)
- [ ] Tokens stored in secure storage (Keychain on iOS, EncryptedSharedPreferences on Android)
- [ ] Force-killing and reopening app: session restores correctly, no data loss
- [ ] Rapid-tapping completion circle: only one completion recorded per occurrence (idempotency key prevents duplicates)
