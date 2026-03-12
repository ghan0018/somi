# SOMI Home — Mobile Design Specification

**Version:** 1.0
**Last Updated:** 2026-03-12
**Audience:** iOS and Android developers

---

## 1. Overview

### Purpose
SOMI Home is a patient-facing mobile app for the SOMI clinic platform. Patients use it to view and complete their prescribed exercise programs, track daily progress, and communicate with their therapist.

### Target Users
Patients with clinic-provisioned credentials. The app is read-only for treatment plan content — all exercise authoring and plan management happens in the SOMI Clinic web app by therapists and admins.

### Navigation Model
Three-tab bottom navigation (post-login):
1. **Today** (default) — daily exercise checklist
2. **Plan** — read-only treatment plan overview
3. **Messages** — chat thread with therapist

---

## 2. Design Tokens

### Colors

| Token | Hex | Usage |
|---|---|---|
| Navy | `#1B3A4B` | Navigation bars, headers, primary text, inactive tab icons |
| Teal | `#6DB6B0` | Primary actions, CTA buttons, active tab tint, completion checkmarks, send button |
| Dark Teal | `#2C7A7B` | Pressed/selected states, parameter chip text |
| Gold | `#D4A843` | Accents, badges, highlights |
| Mint | `#F0F5F4` | Page/list backgrounds, secondary surfaces |
| White | `#FFFFFF` | Cards, content surfaces, nav bar title text |
| Teal Light | `#EAF5F4` | Parameter chip background |
| Body Text | `#333333` | Body/description text |
| Secondary Text | `#666666` | Labels, secondary info |
| Caption Text | `#999999` | Timestamps, minor labels |
| Error Red | `#E53E3E` | Inline error messages |
| Sync Amber BG | `#FFF3CD` | Pending sync banner background |
| Sync Amber Text | `#856404` | Pending sync banner text |

### Typography

| Style | Size | Weight | Color | Usage |
|---|---|---|---|---|
| Display | 24pt | Semibold | Navy | Login title (used sparingly) |
| Nav Title | 17pt | Semibold | White | Navigation bar titles |
| Section Header | 15pt | Semibold | Navy | Session headers, section labels |
| Body | 15pt | Regular | #333 | Descriptions, content text |
| Body Medium | 15pt | Medium | Navy | Exercise row titles (16pt) |
| Label | 13pt | Regular | #666 | Secondary labels |
| Chip Text | 13pt | Medium | #2C7A7B | Parameter chips |
| Caption | 11pt | Regular | #999 | Timestamps, minor labels |

**Font Families:**
- **Body text:** Inter (or platform equivalent — SF Pro on iOS, Roboto on Android)
- **Headings:** Playfair Display (or Georgia/serif fallback)

### Spacing

| Token | Value | Usage |
|---|---|---|
| xs | 4px | Tight gaps, inline spacing |
| sm | 8px | Between small elements, chip gaps |
| md | 12px | Between related elements |
| lg | 16px | Page padding, section gaps |
| xl | 24px | Between major sections |

### Layout

| Property | Value |
|---|---|
| Mobile page padding | 16px (horizontal) |
| Card padding | 16–20px |
| Border radius small | 8px |
| Border radius medium | 12px |
| Minimum touch target | 44pt (iOS) / 48dp (Android) |

---

## 3. Screen Specifications

### 3.1 Login Screen

**Layout:** Full screen, Mint (`#F0F5F4`) background.

**Structure:**
```
[Mint background fills entire screen]
  [Centered white card]
    - Card max-width: 360px (on large screens), full width minus 32px on phones
    - Card padding: 24px
    - Card border-radius: 12px
    - Card shadow: subtle drop shadow (0 2px 8px rgba(0,0,0,0.08))

    [SOMI Logo / Wordmark]
      - Centered horizontally
      - Margin bottom: 8px

    [Subtitle: "SOMI Home"]
      - 17pt, semibold, Navy
      - Centered
      - Margin bottom: 24px

    [Email Text Field]
      - Standard outlined input
      - Placeholder: "Email"
      - Keyboard type: email
      - Full width
      - Height: 48pt
      - Border: 1px solid #CCC, 8px radius
      - Margin bottom: 12px

    [Password Text Field]
      - Standard outlined input, secure entry
      - Placeholder: "Password"
      - Full width
      - Height: 48pt
      - Border: 1px solid #CCC, 8px radius
      - Margin bottom: 16px

    [Sign In Button]
      - Full width
      - Height: 48pt
      - Background: Teal (#6DB6B0)
      - Text: "Sign In", 16pt, semibold, White
      - Border-radius: 12px
      - Pressed state: Dark Teal (#2C7A7B)

    [Loading State]
      - When signing in: overlay spinner on button center
      - Button text replaced with spinner
      - Button remains teal but slightly dimmed (opacity 0.8)
      - All inputs disabled during loading

    [Error Message]
      - Appears below the Sign In button
      - Margin top: 12px
      - Text: 14pt, regular, Error Red (#E53E3E)
      - Centered
      - Example: "Invalid email or password"
```

**No "Forgot password?" link** — patients contact their therapist for credential issues.

---

### 3.2 Main Tab Bar

**Appears after successful login.** Root navigation container with three tabs.

| Tab | Label | Icon (iOS SF Symbol) | Icon (Android Material) | Default |
|---|---|---|---|---|
| Today | "Today" | `calendar` or `house.fill` | `Today` or `Home` | Yes |
| Plan | "Plan" | `list.bullet` or `list.clipboard` | `FormatListBulleted` | No |
| Messages | "Messages" | `message.fill` | `Message` | No |

**Tab Bar Styling:**
- Background: White (`#FFFFFF`)
- Active icon + label tint: Teal (`#6DB6B0`)
- Inactive icon + label tint: Navy (`#1B3A4B`)
- Top border: 1px solid `#E5E5E5` (subtle separator)
- Height: standard platform height (49pt iOS / 80dp Android including label)

---

### 3.3 Today Tab — Exercise List

**Navigation Bar:**
- Background: Navy (`#1B3A4B`)
- Title: "Today — Mon, Mar 12" (format: `Day, Mon Date`), 17pt semibold, White
- No right bar button items for MVP

**Content Area:**
- Background: Mint (`#F0F5F4`)
- Pull-to-refresh enabled

**Session Groups:**

If the patient's daily plan has multiple sessions, exercises are grouped under session headers.

```
[Sync Badge — if pending completions exist]
  - See Sync Badge component spec below

[Session Header]
  - Background: Mint (#F0F5F4) slightly darker or White with bottom border
  - Left text: Session title (e.g., "Morning Session" or "Session 1")
    - 15pt, semibold, Navy
  - Right text: "2 of 5 complete"
    - 13pt, regular, Teal (#6DB6B0)
  - Padding: 12px horizontal, 8px vertical

[ExerciseRow] — repeated for each exercise
  - See ExerciseRow component spec below
  - Subtle separator line between rows (1px, #E8EEF1)

[Next Session Header]
  ...
```

**If only one session:** The session header still appears but can use a default title like "Today's Exercises".

**Empty State:**
- Centered in available space (below nav bar, above tab bar)
- Icon: calendar with checkmark, 48pt, gray (#999)
- Title: "No exercises scheduled for today" — 17pt semibold, Navy
- Body: "Check back later or contact your therapist" — 14pt regular, #666, centered, max-width 260pt

**Loading State:**
- Skeleton placeholder rows (see Loading Skeleton component)
- Show 4–5 placeholder rows

---

### 3.4 Exercise Row Component

**Layout:** Horizontal row, white background, full width.

```
[Row — tappable entire area, navigates to Exercise Detail]
  Padding: 12px horizontal, 14px vertical
  Min height: 56pt

  [Left: Completion Checkbox(es)]
    - If timesPerDay == 1:
      [Single Circle]
        - Incomplete: outlined circle, 24x24pt, 2px border, Navy (#1B3A4B)
        - Complete: filled circle, 24x24pt, Teal (#6DB6B0), white checkmark icon centered
        - Touch target: minimum 44pt x 44pt (add padding around the visual circle)
        - Tapping checkbox toggles completion (does NOT navigate to detail)

    - If timesPerDay > 1:
      [Row of N small circles, side by side]
        - Each circle: 18x18pt, 4px gap between
        - Same incomplete/complete styling as above (scaled down)
        - Tapping a circle fills the next incomplete one (left to right)
        - Touch target per circle: minimum 44pt height, split width evenly

    Margin right: 12px

  [Center: Text Content]
    [Exercise Title]
      - 16pt, medium weight, Navy (#1B3A4B)
      - Single line, truncate with ellipsis if too long
      - Margin bottom: 4px

    [Parameters — inline text or chips]
      - 13pt, regular, Teal (#6DB6B0)
      - Format: "3 reps · 2 sets" or "30 sec" — parameters separated by " · "
      - Only show parameters that have non-nil values

  [Right: Chevron]
    - Chevron-right icon, 12pt, #999
    - Vertically centered
    - Margin left: 8px
```

**Interaction:**
- Tapping the checkbox area toggles completion (optimistic, immediate)
- Tapping the row body (title/params/chevron) navigates to Exercise Detail
- No long-press actions for MVP

---

### 3.5 Exercise Detail Screen

**Navigation Bar:**
- Background: Navy (`#1B3A4B`)
- Back arrow: White, navigates back to Today list
- Title: Exercise name, 17pt semibold, White (truncated with ellipsis if long)

**Content Area:**
- Background: White (`#FFFFFF`)
- Scrollable vertically

```
[Content — scrollable]
  Padding: 16px horizontal

  [Exercise Title]
    - 20pt, semibold, Navy (#1B3A4B)
    - Margin top: 16px, margin bottom: 12px

  [Parameter Chips — horizontal scrollable row]
    - Horizontal row, wraps if needed
    - Gap between chips: 8px
    - Margin bottom: 16px
    - Only show chips for parameters with non-nil values

    [Chip]
      - Background: Teal Light (#EAF5F4)
      - Text: Dark Teal (#2C7A7B), 13pt, medium
      - Padding: 6px vertical, 12px horizontal
      - Border-radius: 6px
      - Examples: "3 reps", "2 sets", "30 sec"

  [Description]
    - 15pt, regular, #333333
    - Line height: 1.5 (22.5pt)
    - Margin bottom: 20px
    - If no description: omit section entirely (no placeholder)

  [Video Player — if exercise has video URL]
    - Aspect ratio: 16:9
    - Container background: Black (#000000)
    - Full width (16px margin each side)
    - Border-radius: 8px (clip content)
    - Margin bottom: 20px

    [Before playback]
      - Large play button icon centered (white, 48pt, slight shadow)
      - "Tap to play" text below icon, 13pt, white, 60% opacity

    [During playback]
      - Standard platform video controls
      - Scrubber, play/pause, fullscreen toggle

    [Offline — no internet]
      - Background: Mint (#F0F5F4) instead of black
      - Wifi-off icon centered, 48pt, #999
      - Text below: "Internet connection required to play this video"
        - 15pt, regular, #666, centered
      - No play button shown

  [Spacer — flexible, pushes button to bottom]

[Mark Complete Button — fixed at bottom or within scroll]
  - Margin: 16px horizontal, 16px bottom (safe area aware)
  - Full width (minus margins)
  - Height: 48pt
  - Border-radius: 12px

  [Incomplete state]
    - Background: Teal (#6DB6B0)
    - Text: "Mark Complete", 16pt, semibold, White
    - Pressed: Dark Teal (#2C7A7B)

  [Complete state]
    - Background: White / transparent
    - Border: 2px solid Teal (#6DB6B0)
    - Text: "Completed", 16pt, semibold, Teal
    - Checkmark icon before text
    - Tapping again does NOT uncomplete (or shows confirmation to undo — TBD by product)

  [Multiple occurrences (timesPerDay > 1)]
    - Text: "Mark Session X Complete" (X = next incomplete occurrence number)
    - After all occurrences complete: show "All Complete" in outlined/ghost style
```

---

### 3.6 Treatment Plan Tab

**Navigation Bar:**
- Background: Navy (`#1B3A4B`)
- Title: "My Treatment Plan", 17pt semibold, White

**Content Area:**
- Background: Mint (`#F0F5F4`)

**If no published plan — Empty State:**
- Centered in content area
- Icon: clipboard or list icon, 48pt, gray (#999)
- Title: "Your treatment plan is being set up" — 17pt semibold, Navy
- Body: "Your therapist will publish your plan when it's ready" — 14pt regular, #666, centered, max-width 260pt

**If plan exists:**
```
[Scrollable List]

  [Session Section — repeated per session]
    [Session Header]
      - Background: White or slightly elevated
      - Left: Session title (e.g., "Morning Routine")
        - 15pt, semibold, Navy
      - Right: "5 exercises"
        - 13pt, regular, #666
      - Padding: 12px horizontal, 10px vertical
      - Bottom border: 1px #E8EEF1

    [Exercise Row — repeated per exercise in session]
      - White background
      - NO checkbox (read-only view)
      - Exercise title: 16pt, medium, Navy
      - Parameters inline: 13pt, Teal — "3 reps · 2 sets"
      - NO chevron (not tappable — no navigation to detail)
      - Padding: 12px horizontal, 12px vertical
      - Separator: 1px #E8EEF1 between rows

  [Next Session Section]
    ...
```

**No pull-to-refresh** needed on this tab (plan changes are infrequent; refreshes on tab switch).

---

### 3.7 Messages Tab

**Navigation Bar:**
- Background: Navy (`#1B3A4B`)
- Title: "Messages", 17pt semibold, White

**If no thread exists — Empty State:**
- Centered in content area
- Icon: message bubble, 48pt, gray (#999)
- Title: "No messages yet" — 17pt semibold, Navy
- Body: "Your messaging thread with your therapist will appear here" — 14pt regular, #666, centered, max-width 260pt

**If thread exists — Chat Interface:**

```
[Message List — scrollable, newest at bottom]
  Background: Mint (#F0F5F4)
  Padding: 8px horizontal

  [Message Bubble — Client (current user)]
    - Alignment: right
    - Background: Teal (#6DB6B0)
    - Text: 15pt, regular, White
    - Max width: 75% of screen width
    - Padding: 10px 14px
    - Border-radius: 12px (top-left, top-right, bottom-left), 4px (bottom-right)
    - Margin bottom: 2px

    [Timestamp]
      - Below bubble, right-aligned
      - 11pt, regular, #999
      - Format: "2:30 PM" (same day) or "Mar 10, 2:30 PM" (different day)
      - Margin bottom: 8px (gap before next message group)

  [Message Bubble — Therapist]
    - Alignment: left
    - Background: White (#FFFFFF)
    - Text: 15pt, regular, Navy (#1B3A4B)
    - Border: 1px solid #E5E5E5 (subtle)
    - Max width: 75% of screen width
    - Padding: 10px 14px
    - Border-radius: 12px (top-left, top-right, bottom-right), 4px (bottom-left)
    - Optional: therapist name/label above first message in a group, 11pt, #666

    [Timestamp]
      - Below bubble, left-aligned
      - Same styling as client timestamps

[Input Bar — fixed at bottom, above safe area]
  Background: White
  Top border: 1px solid #E5E5E5
  Padding: 8px 12px (+ safe area inset bottom)

  [Text Field]
    - Flex grow, min height 36pt, max height ~100pt (expands with text)
    - Background: #F5F5F5
    - Border-radius: 18px (pill shape)
    - Padding: 8px 16px
    - Placeholder: "Message your therapist..."
    - Font: 15pt regular

  [Send Button]
    - Right of text field, 8px gap
    - Icon: arrow-up or paper-plane, 20pt
    - Circle background: 36pt diameter
    - Active (text present + online): Teal background, White icon
    - Inactive (empty text or offline): Gray (#CCC) background, White icon
    - Touch target: 44pt minimum
```

**Offline State:**
- Banner below nav bar: "Connect to internet to send messages" — amber style (see Sync Badge)
- Send button becomes gray, disabled
- Existing messages remain visible and scrollable
- New messages from therapist will load when connection restores

---

## 4. Shared Component Library

### 4.1 EmptyState

**Usage:** Displayed when a screen has no content to show.

```
[Container — centered vertically and horizontally in available space]
  Max width: 280pt

  [Icon]
    - Size: 48pt
    - Color: Gray (#999) or Teal (#6DB6B0) depending on context
    - Margin bottom: 16px
    - Centered

  [Title]
    - 17pt, semibold, Navy (#1B3A4B)
    - Centered text alignment
    - Margin bottom: 8px

  [Body]
    - 14pt, regular, #666666
    - Centered text alignment
    - Max width: 260pt
    - Line height: 1.4

  [CTA Button — optional]
    - Margin top: 20px
    - Teal filled button, auto-width with 24px horizontal padding
    - Height: 40pt
    - Border-radius: 8px
    - Text: 15pt, medium, White
```

**Instances:**

| Screen | Icon | Title | Body |
|---|---|---|---|
| Today (empty) | calendar.badge.checkmark | No exercises scheduled for today | Check back later or contact your therapist |
| Plan (empty) | list.clipboard | Your treatment plan is being set up | Your therapist will publish your plan when it's ready |
| Messages (empty) | message | No messages yet | Your messaging thread with your therapist will appear here |

---

### 4.2 Sync Badge / Offline Banner

**Usage:** Appears below the navigation bar when completions are pending sync or the device is offline.

```
[Banner — full width, below nav bar]
  Background: Amber (#FFF3CD)
  Padding: 8px 16px
  Min height: 36pt

  [Icon — left]
    - Clock icon (pending sync) or wifi-slash icon (offline)
    - 16pt, Amber text (#856404)
    - Margin right: 8px

  [Text]
    - "2 completion(s) pending sync" or "No internet connection"
    - 13pt, medium, #856404
    - Vertically centered

[Success Flash — appears briefly when sync completes]
  Background: Teal (#6DB6B0) at 15% opacity, or light green
  Text: "All caught up!" — 13pt, medium, Teal
  Icon: checkmark circle
  Auto-dismisses after 2 seconds with fade-out
```

**States:**

| State | Icon | Text | Background |
|---|---|---|---|
| Pending sync | clock | "X completion(s) pending sync" | #FFF3CD |
| Offline | wifi.slash | "No internet connection" | #FFF3CD |
| Sync failed (3+ attempts) | exclamationmark.triangle | "Sync issue — will retry" | #FFF3CD |
| Sync complete (brief flash) | checkmark.circle | "All caught up!" | #E6F7F0 |

---

### 4.3 Loading Skeleton

**Usage:** Placeholder content shown while data is loading.

**Style:**
- Rounded rectangles matching the shape and position of real content
- Background: `#E8EEF1` (light gray)
- Animated shimmer: gradient sweep from left to right, 1.5s loop
  - Gradient: `#E8EEF1` to `#F5F5F5` to `#E8EEF1`

**Today Tab Skeleton:**
```
[Session Header Skeleton]
  - Rectangle: 120px x 14px (title), margin right auto
  - Rectangle: 80px x 12px (count), right-aligned

[Exercise Row Skeleton — repeat 4-5 times]
  - Circle: 24x24px (checkbox placeholder), left
  - Rectangle: 180px x 14px (title), 4px below
  - Rectangle: 100px x 12px (params)
  - Small rectangle: 8x14px (chevron), right
```

**Messages Skeleton:**
```
[Bubble Skeletons — alternating left/right]
  - Left bubble: 200px x 40px, border-radius 12px
  - Right bubble: 160px x 36px, border-radius 12px
  - Small rectangle below each: 60px x 10px (timestamp)
```

---

### 4.4 Parameter Chip

**Usage:** Displays exercise parameters as compact pills.

```
[Chip]
  Background: #EAF5F4 (Teal Light)
  Text color: #2C7A7B (Dark Teal)
  Font: 13pt, medium
  Padding: 6px vertical, 12px horizontal
  Border-radius: 6px
  No border
```

**Content Rules:**
- Only render chips for parameters with non-nil/non-zero values
- Standard labels: "X reps", "X sets", "X sec" (or "X min" for durations >= 60s)
- Display order: reps, sets, duration (consistent across all screens)

---

### 4.5 Completion Checkbox

**Single occurrence (timesPerDay == 1):**

| State | Visual |
|---|---|
| Incomplete | 24x24pt circle, 2px Navy border, transparent fill |
| Complete | 24x24pt circle, Teal fill, white checkmark icon (SF Symbol: checkmark, Material: Check) |
| Animating | Brief scale animation (1.0 -> 1.15 -> 1.0) + fill color transition, 200ms |

**Multiple occurrences (timesPerDay > 1):**

| Property | Value |
|---|---|
| Circle size | 18x18pt per circle |
| Gap | 4px between circles |
| Max circles shown | 5 (if more, show count text "X/Y" instead) |
| Fill order | Left to right |

**Touch target:** Always minimum 44pt x 44pt regardless of visual circle size. Extend tap area with invisible padding.

---

## 5. Platform Differences

### 5.1 iOS-Specific Implementation

**Navigation:**
- Use `NavigationStack` for push navigation (Today -> Exercise Detail)
- Use `TabView` with `.tabItem` modifier for bottom tab bar
- Tab bar tint: `.tint(Color("somiTeal"))`

**Navigation Bar:**
- Background: Navy using `.toolbarBackground(.visible, for: .navigationBar)` + `.toolbarBackground(Color("somiNavy"), for: .navigationBar)`
- Title color: White using `.toolbarColorScheme(.dark, for: .navigationBar)`
- Back button tint: White (inherits from `.tint(.white)` on NavigationStack)
- Status bar: Light content (white text) — automatic with dark toolbar background

**Icons:**
- Use SF Symbols throughout:
  - Today tab: `calendar`
  - Plan tab: `list.bullet`
  - Messages tab: `message.fill`
  - Checkbox complete: `checkmark.circle.fill`
  - Checkbox incomplete: `circle`
  - Row chevron: `chevron.right`
  - Wifi off: `wifi.slash`
  - Sync pending: `clock.arrow.circlepath`
  - Send message: `arrow.up.circle.fill`

**Pull-to-Refresh:**
- Use `.refreshable` modifier on Today tab's `List` or `ScrollView`
- Teal tint on spinner

**Keyboard:**
- Email field: `.keyboardType(.emailAddress)`, `.textContentType(.emailAddress)`, `.autocapitalization(.none)`
- Password field: `.textContentType(.password)`
- Message input: `.submitLabel(.send)`, `.onSubmit` to send

**Accessibility:**
- All interactive elements must have `.accessibilityLabel`
- Checkboxes: "Mark [exercise name] complete" / "[exercise name], completed"
- Exercise rows: "[exercise name], [parameters], double tap to view details"
- Minimum touch target: 44pt x 44pt

---

### 5.2 Android-Specific Implementation

**Navigation:**
- Use Jetpack Compose `NavHost` for navigation
- Use Material 3 `NavigationBar` (bottom) with 3 `NavigationBarItem`s
- Selected indicator: Teal tint

**Top App Bar:**
- Use Material 3 `TopAppBar` or `MediumTopAppBar`
- Background: Navy (`#1B3A4B`)
- Title/icon color: White
- Status bar: match Navy background using `WindowCompat` / system UI controller

**Icons:**
- Use Material Icons:
  - Today tab: `Icons.Filled.Today` or `Icons.Filled.Home`
  - Plan tab: `Icons.Filled.FormatListBulleted` or `Icons.AutoMirrored.Filled.List`
  - Messages tab: `Icons.Filled.Message`
  - Checkbox complete: `Icons.Filled.CheckCircle`
  - Checkbox incomplete: `Icons.Outlined.RadioButtonUnchecked`
  - Row chevron: `Icons.AutoMirrored.Filled.ChevronRight`
  - Wifi off: `Icons.Filled.WifiOff`
  - Sync pending: `Icons.Filled.Sync`
  - Send message: `Icons.AutoMirrored.Filled.Send`

**Pull-to-Refresh:**
- Use `PullToRefreshBox` (Material 3 pull-to-refresh)
- Indicator color: Teal

**Interactive Feedback:**
- Default Material ripple effect on all clickable items (automatic with `Modifier.clickable`)
- No custom ripple colors needed

**Snackbars:**
- Use `Snackbar` for brief status messages:
  - "Sync complete" — standard snackbar, auto-dismiss 2s
  - "Failed to send message" — snackbar with "Retry" action
  - "Completion saved" — not shown (optimistic, no confirmation needed)

**No FAB:** The "Mark Complete" button is an inline full-width button at the bottom of Exercise Detail, not a FloatingActionButton.

**Minimum touch targets:** 48dp for all interactive elements (Android accessibility standard).

---

## 6. Offline State Guide

### 6.1 Design Principle
The app remains fully browsable when offline. Only **write actions** (completions, sending messages) are affected. There is no full-screen offline takeover.

### 6.2 Exercise Completion (Offline)

| Step | Behavior |
|---|---|
| User taps checkbox | Checkbox fills immediately (optimistic, no spinner) |
| Background sync | Completion queued for sync |
| Sync badge appears | "1 completion(s) pending sync" below nav bar |
| Connection restores | Sync automatically, badge updates count |
| All synced | Brief "All caught up!" flash, badge disappears |

**Failure handling:**
- After 3+ failed sync attempts: badge text changes to "Sync issue — will retry"
- No error dialog or blocking modal
- Completions are never lost — persisted locally until sync succeeds

### 6.3 Video Playback (Offline)

Replace the video player container with:
```
[Offline Video Placeholder]
  Same 16:9 aspect ratio container
  Background: Mint (#F0F5F4)
  Centered vertically:
    [Wifi-off icon]
      - 48pt, #999
    [Text]
      - "Internet connection required to play this video"
      - 15pt, regular, #666, centered
      - Max width: 240pt
      - Margin top: 12px
```

This is informational, not an error. No retry button — video loads automatically when connection restores and user navigates to the screen.

### 6.4 Messages (Offline)

| Element | Offline Behavior |
|---|---|
| Message list | Remains visible and scrollable (cached messages) |
| Send button | Gray (#CCC), disabled |
| Input field | Still editable (user can type, just can't send) |
| Offline banner | "Connect to internet to send messages" — amber banner below nav bar |
| Connection restores | Banner dismisses, send button becomes Teal, pending text can be sent |

### 6.5 General Navigation (Offline)

| Screen | Behavior |
|---|---|
| Today tab | Fully functional with cached data. Completions work offline. |
| Plan tab | Fully functional with cached data. Read-only, no write actions. |
| Messages tab | Read-only. Can scroll history, cannot send. |
| Pull-to-refresh | Shows briefly then stops. No error — just no new data. |
| Login screen | Cannot authenticate. Show inline error: "No internet connection. Please try again when connected." |

---

## 7. Accessibility Requirements

### 7.1 General Requirements

| Requirement | Standard |
|---|---|
| Minimum touch target | 44pt (iOS) / 48dp (Android) |
| Color contrast (text) | Minimum 4.5:1 for body text, 3:1 for large text (WCAG AA) |
| Color contrast (interactive) | Minimum 3:1 for UI components |
| Dynamic Type / Font Scaling | Support system font size preferences |
| Screen reader | Full VoiceOver (iOS) and TalkBack (Android) support |
| Reduce Motion | Respect system "Reduce Motion" preference — disable shimmer, scale animations |

### 7.2 Color Contrast Verification

| Combination | Ratio | Pass? |
|---|---|---|
| Navy (#1B3A4B) on White (#FFF) | 10.2:1 | Yes (AAA) |
| White (#FFF) on Navy (#1B3A4B) | 10.2:1 | Yes (AAA) |
| White (#FFF) on Teal (#6DB6B0) | 2.7:1 | Fail for small text — use for large text/icons only |
| Dark Teal (#2C7A7B) on Teal Light (#EAF5F4) | 4.6:1 | Yes (AA) |
| Body (#333) on White (#FFF) | 12.6:1 | Yes (AAA) |
| Secondary (#666) on White (#FFF) | 5.7:1 | Yes (AA) |
| Caption (#999) on White (#FFF) | 2.8:1 | Borderline — acceptable for non-essential info |

**Note on Teal buttons:** White text on Teal (#6DB6B0) background does not meet AA for small text. Mitigations:
- Button text is 16pt semibold (qualifies as "large text" at 3:1 threshold)
- Ensure button text is at least 14pt bold / 18pt regular
- Alternative: use White (#FFF) on Dark Teal (#2C7A7B) for better contrast (5.1:1)

### 7.3 Screen Reader Labels

| Element | Label | Trait/Role |
|---|---|---|
| Exercise checkbox (incomplete) | "Mark [name] complete" | Button |
| Exercise checkbox (complete) | "[name], completed" | Button (selected) |
| Exercise row | "[name], [params]" | Button ("double tap to view details") |
| Parameter chip | "[value]" (e.g., "3 reps") | Static text |
| Send button (active) | "Send message" | Button |
| Send button (disabled) | "Send message, unavailable offline" | Button (disabled) |
| Sync badge | "2 completions pending sync" | Static text |
| Mark Complete button | "Mark complete" / "Completed" | Button |
| Video player (offline) | "Video unavailable offline" | Image |

### 7.4 Focus Order

Ensure logical focus order follows visual layout:
1. Navigation bar items (back button, title)
2. Sync badge (if present)
3. Content items top-to-bottom
4. Bottom action button (Mark Complete)
5. Tab bar items left-to-right
6. Input bar (Messages)

### 7.5 Motion & Animation

All animations should respect the system "Reduce Motion" preference:
- **Shimmer loading:** Replace with static gray placeholder
- **Checkbox scale animation:** Replace with instant state change
- **Sync badge appearance:** Replace with instant show/hide
- **Success flash:** Replace with static badge that auto-hides after 2s

---

## 8. Screen Flow Diagram

```
Login Screen
    |
    v (successful auth)
Tab Bar
    |
    +-- Today Tab (default)
    |       |
    |       +-- Exercise Detail (push)
    |               |
    |               +-- Back to Today (pop)
    |
    +-- Plan Tab
    |       (no navigation — read-only list)
    |
    +-- Messages Tab
            (no navigation — inline chat)
```

---

## 9. Edge Cases & Micro-interactions

### 9.1 Long Exercise Names
- Today row title: single line, truncate with ellipsis
- Detail screen title (nav bar): truncate with ellipsis
- Detail screen heading: wrap to multiple lines (no truncation)

### 9.2 Many Parameters
- If an exercise has many parameters, chips wrap to next line on Detail screen
- On Today row, inline text truncates with ellipsis

### 9.3 Many Sessions
- All sessions scroll naturally in the Today list
- No collapse/expand for MVP — all sessions expanded

### 9.4 Real-time Messages
- New messages from therapist should appear without manual refresh
- Use polling (every 30s) or WebSocket (future) for live updates
- New message scrolls list to bottom with brief animation

### 9.5 Keyboard Handling (Messages)
- Input bar rises above keyboard
- Message list scrolls to stay at bottom
- Tapping outside input dismisses keyboard
- "Send" on keyboard submits message (equivalent to send button)

---

*End of Design Specification*
