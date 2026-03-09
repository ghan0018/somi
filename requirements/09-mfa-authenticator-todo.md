# 09 – MFA Authenticator App (Backlog)

> **Status:** Not yet implemented — placeholder validation exists in the current codebase.

---

## Overview

Therapist and admin users require MFA for login. The planned approach uses **TOTP authenticator apps** (e.g., Google Authenticator, Authy, 1Password) rather than SMS-based codes.

---

## Current State

- The `User` model already has `mfaEnabled: boolean` and `mfaSecret?: string` fields.
- Login flow checks `mfaEnabled` and returns `{ mfaRequired: true, challengeId }` when MFA is needed.
- `POST /v1/auth/mfa/verify` accepts a `challengeId` + 6-digit `code` — currently validates with a placeholder check (not real TOTP).
- Admin UI has a "Reset MFA" button that clears `mfaEnabled` and `mfaSecret`.

---

## Planned Implementation

### 1. TOTP Enrollment Flow

1. **User initiates enrollment** — `POST /v1/me/mfa/enroll`
   - Server generates a TOTP secret (e.g., using `otplib` or `speakeasy`).
   - Returns the secret as a `otpauth://` URI and a base64-encoded QR code image.
   - Secret is stored temporarily (not yet committed to user record).

2. **User scans QR code** in their authenticator app.

3. **User verifies** — `POST /v1/me/mfa/enroll/verify`
   - User submits a 6-digit code from their authenticator app.
   - Server validates the code against the temporary secret.
   - On success: persists `mfaSecret` and sets `mfaEnabled: true`.
   - Returns backup/recovery codes (one-time use).

### 2. TOTP Login Verification

1. Login returns `{ mfaRequired: true, challengeId }` for users with `mfaEnabled: true`.
2. `POST /v1/auth/mfa/verify` validates the 6-digit code against the stored `mfaSecret` using TOTP algorithm (30-second window, +-1 step tolerance).
3. On success: returns access + refresh tokens.

### 3. Recovery Codes

- Generate 8-10 single-use recovery codes during enrollment.
- Store hashed in a `mfaRecoveryCodes` array on the User model.
- Each code can be used once in place of a TOTP code during login.
- Warn user when recovery codes are running low.

### 4. Admin Reset

- Already implemented: `POST /v1/admin/users/:userId/reset-mfa`
- Clears `mfaEnabled`, `mfaSecret`, and `mfaRecoveryCodes`.
- User must re-enroll on next login.

---

## Backend Changes Needed

| File | Change |
|------|--------|
| `package.json` (somi-connect) | Add `otplib` dependency |
| `models/user.model.ts` | Add `mfaRecoveryCodes: [String]` field |
| `services/auth.service.ts` | Implement real TOTP verification in `verifyMfa()` |
| `routes/auth.routes.ts` | Add `POST /v1/me/mfa/enroll` and `POST /v1/me/mfa/enroll/verify` |
| `services/mfa.service.ts` | New file: `generateSecret()`, `generateQrCode()`, `verifyTotp()`, `generateRecoveryCodes()` |

## Frontend Changes Needed

| File | Change |
|------|--------|
| `pages/MfaEnrollPage.tsx` | New page: QR code display, code verification form |
| `pages/LoginPage.tsx` | MFA step: 6-digit code input after initial login |
| `api/auth.ts` | Add `enrollMfa()`, `verifyMfaEnroll()` functions |
| `router` | Add `/mfa/enroll` route, redirect after login if MFA not set up |

---

## Dependencies

- `otplib` — TOTP generation and verification
- `qrcode` — QR code generation (server-side, returns base64 PNG)

---

## Security Considerations

- TOTP secrets must be encrypted at rest (use field-level encryption or KMS).
- Recovery codes must be hashed (bcrypt) before storage.
- Rate-limit MFA verification attempts (max 5 per challenge).
- Challenge IDs should expire after 5 minutes.
- Audit log all MFA events: enroll, verify, reset, recovery code use.
