# 🚀 PHASE 7: AUTH ORCHESTRATION (ENTERPRISE)

**Status**: 🔄 **IN PROGRESS**
**Priority**: 🔴 CRITICAL
**Dependencies**: Phase 0, 1, 2, 3, 4, 5, 6
**Estimated Time**: 16 days
**Complexity**: Enterprise-Level

---

## 📋 DOCUMENT OVERVIEW

**Version**: 1.0
**Last Updated**: 2025-10-01
**Phase Code**: PHASE-7
**Module Focus**: Complete Authentication & Account Management System
**Expected Lines of Code**: ~15,800 lines
**Test Coverage Target**: ≥85%
**Test Timeout**: 45s (network latency simulation)

---

## 🎯 PHASE OBJECTIVES

### Primary Goals

1. **Auth Flow Integration** - Complete login, register, forgot/reset password, email verification, magic link
2. **Session Lifecycle** - httpOnly cookies, CSRF tokens, refresh scheduling, idle timeout, cross-tab sync
3. **Device Trust** - Fingerprinting, remembered devices, trusted networks, geolocation
4. **Account Workspace** - Dashboard with profile, addresses, security, sessions, billing, notifications
5. **RBAC UX** - Feature-flag based UI variations for admin/staff/merchant/customer roles
6. **Security Operations** - Session management, password updates, 2FA placeholder, audit trail
7. **Observability** - Auth metrics, suspicious login detection, audit feed, compliance exports
8. **Accessibility** - WCAG 2.2 AA compliance, keyboard navigation, screen readers

### Success Criteria

- ✅ Phase 3 backend auth services fully integrated
- ✅ Complete auth flows (login, register, forgot, reset, verify, magic link)
- ✅ Session refresh with httpOnly cookies + CSRF tokens
- ✅ Idle timeout (15min) and background refresh (30min before expiry)
- ✅ Cross-tab session synchronization via BroadcastChannel
- ✅ Account workspace with 7 sections (overview, profile, addresses, security, notifications, billing, sessions)
- ✅ RBAC guards enforced in middleware and client components (S3)
- ✅ Device fingerprinting and trusted device management
- ✅ Audit trail with infinite scroll and CSV export
- ✅ WCAG 2.2 AA compliance (axe + manual testing)
- ✅ Lighthouse TTI < 2s, input latency < 100ms
- ✅ 99.9% auth uptime SLO

---

## 🎯 CRITICAL REQUIREMENTS

### Security Standards (S1-S4)

**S1: Password Security**
- Never store passwords in client state
- Only httpOnly cookies for auth tokens
- Secure HTTPS-only transmission
- Password strength validation (min 8 chars, uppercase, lowercase, number, special)

**S2: Input Sanitization & CSRF**
- All form inputs sanitized before submission
- CSRF token validation on state-changing requests
- Captcha fallback for high-risk operations
- Rate limiting feedback in UI

**S3: RBAC & Authorization**
- Middleware guards for `/dashboard`, `/admin` routes
- Server component role checks
- Feature flags for role-based UI variations
- Audit logging for all admin actions

**S4: Environment Security**
- All secrets from environment variables
- No hardcoded API keys or tokens
- Secure cookie configuration (sameSite: strict, secure: true)
- Session storage for sensitive tokens only

### Performance Standards (P1/P2)

**P1: Query Optimization**
- TanStack Query cache invalidation strategy
- Optimistic updates for cart and profile
- No N+1 fetches
- Stale time: 60s for auth data

**P2: Page Performance**
- Time to Interactive (TTI): < 2s
- Input latency: < 100ms
- Asset lazy loading
- Code splitting for auth routes

### API Integration (Q2)

**Q2 Format Compliance**
```typescript
// All auth API responses
{
  "success": true,
  "data": {
    "user": {...},
    "session": {...}
  },
  "meta": {
    "timestamp": "2025-10-01T12:00:00Z",
    "requestId": "uuid-v4"
  }
}
```

---

## 🏗️ ARCHITECTURE OVERVIEW

### Directory Structure

```
apps/frontend/
├── app/
│   ├── (auth)/
│   │   ├── login/
│   │   │   ├── page.tsx
│   │   │   ├── loading.tsx
│   │   │   └── error.tsx
│   │   ├── register/
│   │   │   ├── page.tsx
│   │   │   ├── loading.tsx
│   │   │   └── error.tsx
│   │   ├── forgot-password/
│   │   ├── reset-password/
│   │   ├── verify-email/
│   │   ├── magic-link/
│   │   ├── two-step/                # 2FA placeholder
│   │   ├── layout.tsx               # Auth layout
│   │   └── success/
│   │       └── page.tsx             # Generic success page
│   ├── (dashboard)/
│   │   └── (account)/
│   │       ├── @sidebar/            # Parallel route
│   │       │   └── default.tsx
│   │       ├── @modal/              # Parallel route
│   │       │   └── default.tsx
│   │       ├── layout.tsx           # Account layout
│   │       ├── page.tsx             # Account overview
│   │       ├── profile/
│   │       │   ├── page.tsx
│   │       │   └── loading.tsx
│   │       ├── addresses/
│   │       │   ├── page.tsx
│   │       │   ├── new/
│   │       │   └── [id]/edit/
│   │       ├── security/
│   │       │   ├── page.tsx
│   │       │   ├── password/
│   │       │   ├── two-factor/
│   │       │   └── backup-codes/
│   │       ├── sessions/
│   │       │   └── page.tsx
│   │       ├── notifications/
│   │       │   └── page.tsx
│   │       ├── billing/             # Phase 10
│   │       │   └── page.tsx
│   │       └── privacy/
│   │           └── page.tsx
│   └── onboarding/
│       ├── layout.tsx
│       ├── page.tsx                 # Onboarding wizard
│       ├── profile/
│       ├── address/
│       ├── security/
│       └── preferences/
├── src/
│   ├── features/
│   │   ├── auth/
│   │   │   ├── components/
│   │   │   │   ├── LoginForm.tsx
│   │   │   │   ├── RegisterForm.tsx
│   │   │   │   ├── ForgotPasswordForm.tsx
│   │   │   │   ├── ResetPasswordForm.tsx
│   │   │   │   ├── VerifyEmailForm.tsx
│   │   │   │   ├── MagicLinkForm.tsx
│   │   │   │   ├── TwoFactorForm.tsx
│   │   │   │   └── SocialLoginButtons.tsx
│   │   │   ├── hooks/
│   │   │   │   ├── useLogin.ts
│   │   │   │   ├── useRegister.ts
│   │   │   │   ├── useForgotPassword.ts
│   │   │   │   ├── useResetPassword.ts
│   │   │   │   ├── useVerifyEmail.ts
│   │   │   │   ├── useMagicLink.ts
│   │   │   │   └── useLogout.ts
│   │   │   ├── mutations/
│   │   │   ├── schemas/
│   │   │   │   ├── login.schema.ts
│   │   │   │   ├── register.schema.ts
│   │   │   │   └── password.schema.ts
│   │   │   └── __tests__/
│   │   └── account/
│   │       ├── components/
│   │       │   ├── AccountOverview.tsx
│   │       │   ├── ProfileForm.tsx
│   │       │   ├── AddressBook.tsx
│   │       │   ├── AddressForm.tsx
│   │       │   ├── SecurityCenter.tsx
│   │       │   ├── PasswordUpdateForm.tsx
│   │       │   ├── SessionsList.tsx
│   │       │   ├── SessionCard.tsx
│   │       │   ├── NotificationSettings.tsx
│   │       │   ├── AuditFeed.tsx
│   │       │   ├── ConsentCenter.tsx
│   │       │   └── OnboardingWizard.tsx
│   │       ├── hooks/
│   │       │   ├── useProfile.ts
│   │       │   ├── useUpdateProfile.ts
│   │       │   ├── useAddresses.ts
│   │       │   ├── useSessions.ts
│   │       │   ├── useRevokeSession.ts
│   │       │   ├── useAuditLog.ts
│   │       │   └── useAccountStats.ts
│   │       └── __tests__/
│   ├── lib/
│   │   └── auth/
│   │       ├── api.ts              # Auth API client
│   │       ├── contracts.ts        # API type definitions
│   │       ├── transformers.ts     # Data transformers
│   │       ├── guards.ts           # Client-side guards
│   │       ├── session.ts          # Session utilities
│   │       ├── metrics.ts          # Auth analytics
│   │       ├── device.ts           # Device fingerprinting
│   │       └── __tests__/
│   │           └── contracts.test.ts
│   ├── providers/
│   │   ├── SessionProvider.tsx
│   │   └── SessionListener.tsx
│   ├── store/
│   │   └── session.ts              # Zustand session store
│   └── components/
│       └── ui/
│           └── feedback/
│               ├── FormAlert.tsx
│               ├── InputHint.tsx
│               ├── InlineBanner.tsx
│               ├── ActivityTimeline.tsx
│               ├── MaintenanceRibbon.tsx
│               └── RateLimitNotice.tsx
├── docs/
│   └── frontend/
│       └── auth-orchestration.md
└── middleware.ts                   # Enhanced auth middleware
```

---

## ✅ IMPLEMENTATION CHECKLIST

### 1. Auth API Integration (26 items)

#### 1.1 Auth API Client
- [ ] Create `src/lib/auth/api.ts`
  - [ ] `login(credentials)` - POST /api/v1/auth/login
  - [ ] `register(data)` - POST /api/v1/auth/register
  - [ ] `logout()` - POST /api/v1/auth/logout
  - [ ] `refreshToken()` - POST /api/v1/auth/refresh
  - [ ] `forgotPassword(email)` - POST /api/v1/auth/forgot-password
  - [ ] `resetPassword(token, password)` - POST /api/v1/auth/reset-password
  - [ ] `verifyEmail(token)` - POST /api/v1/auth/verify-email
  - [ ] `resendVerification(email)` - POST /api/v1/auth/resend-verification
  - [ ] `magicLink(email)` - POST /api/v1/auth/magic-link
  - [ ] `getProfile()` - GET /api/v1/auth/me
  - [ ] `updateProfile(data)` - PUT /api/v1/auth/me
  - [ ] `updatePassword(data)` - PUT /api/v1/auth/password

#### 1.2 Request/Response Contracts
- [ ] Create `src/lib/auth/contracts.ts`
  - [ ] Define `LoginRequest` type
  - [ ] Define `LoginResponse` type
  - [ ] Define `RegisterRequest` type
  - [ ] Define `RegisterResponse` type
  - [ ] Define `SessionData` type
  - [ ] Define `UserProfile` type
  - [ ] Create Zod schemas for validation
  - [ ] Add Q2 format type guards

#### 1.3 Data Transformers
- [ ] Create `src/lib/auth/transformers.ts`
  - [ ] `transformUserProfile()` - API → UI format
  - [ ] `transformSessionData()` - API → store format
  - [ ] `transformDeviceData()` - Extract device info
  - [ ] Add timezone/locale utilities

#### 1.4 Contract Testing
- [ ] Create `src/lib/auth/__tests__/contracts.test.ts`
  - [ ] Test login request/response format
  - [ ] Test register request/response format
  - [ ] Test all auth endpoints with MSW
  - [ ] Validate Q2 format compliance

---

### 2. Session Lifecycle Management (32 items)

#### 2.1 Session Store (Zustand)
- [ ] Create `src/store/session.ts`
  - [ ] Define session state interface
    - [ ] `user: UserProfile | null`
    - [ ] `isAuthenticated: boolean`
    - [ ] `roles: string[]`
    - [ ] `permissions: string[]`
    - [ ] `sessionExpiry: Date | null`
    - [ ] `deviceFingerprint: string | null`
    - [ ] `trustedDevices: TrustedDevice[]`
  - [ ] Define session actions
    - [ ] `setSession(data)`
    - [ ] `clearSession()`
    - [ ] `updateUser(data)`
    - [ ] `addTrustedDevice(device)`
    - [ ] `removeTrustedDevice(deviceId)`
  - [ ] Add persist middleware
    - [ ] sessionStorage for tokens
    - [ ] localStorage for preferences
  - [ ] Add immer middleware for immutability

#### 2.2 Session Provider
- [ ] Create `src/providers/SessionProvider.tsx`
  - [ ] Initialize session on mount
  - [ ] Hydrate from storage
  - [ ] Setup refresh timer (30min before expiry)
  - [ ] Setup idle timer (15min inactivity)
  - [ ] Handle session expiry
  - [ ] Provide session context to app
- [ ] Create `src/providers/SessionListener.tsx`
  - [ ] Setup BroadcastChannel for cross-tab sync
  - [ ] Listen for logout events
  - [ ] Listen for session refresh events
  - [ ] Sync session state across tabs
  - [ ] Setup Sentry scope with user context

#### 2.3 Refresh Scheduler
- [ ] Create `src/lib/auth/session.ts`
  - [ ] `scheduleRefresh()` - Set timeout for refresh
  - [ ] `cancelRefresh()` - Clear refresh timeout
  - [ ] `performRefresh()` - Call refresh API
  - [ ] Handle refresh failures
  - [ ] Exponential backoff on errors
  - [ ] Max retry attempts (3)

#### 2.4 Idle Timeout
- [ ] Implement idle detection
  - [ ] Track last activity timestamp
  - [ ] Listen to user events (click, keypress, scroll)
  - [ ] Set idle timeout (15 minutes)
  - [ ] Show warning modal at 13 minutes
  - [ ] Auto-logout at 15 minutes
  - [ ] Reset timer on activity

#### 2.5 Cross-Tab Synchronization
- [ ] Setup BroadcastChannel API
  - [ ] Channel name: `lumi-session`
  - [ ] Broadcast login event
  - [ ] Broadcast logout event
  - [ ] Broadcast session refresh event
  - [ ] Listen and sync in other tabs
  - [ ] Fallback to localStorage events (Safari)

---

### 3. Auth Pages & Forms (38 items)

#### 3.1 Login Page
- [ ] Create `app/(auth)/login/page.tsx`
- [ ] Create `LoginForm` component
  - [ ] Email input with validation
  - [ ] Password input with show/hide toggle
  - [ ] Remember me checkbox
  - [ ] Submit button with loading state
  - [ ] Forgot password link
  - [ ] Register link
  - [ ] Social login buttons (placeholder)
- [ ] Create `useLogin` hook
  - [ ] useMutation for login API
  - [ ] Set session on success
  - [ ] Redirect to dashboard
  - [ ] Show error toast on failure
  - [ ] Optimistic UI update
- [ ] Add device/locale metadata to payload
- [ ] Add login analytics event

#### 3.2 Register Page
- [ ] Create `app/(auth)/register/page.tsx`
- [ ] Create `RegisterForm` component
  - [ ] Full name input
  - [ ] Email input with validation
  - [ ] Password input with strength meter
  - [ ] Confirm password input
  - [ ] Terms & conditions checkbox
  - [ ] Marketing consent checkbox
  - [ ] Submit button with loading state
  - [ ] Login link
- [ ] Create `useRegister` hook
  - [ ] useMutation for register API
  - [ ] Redirect to verify email page
  - [ ] Show success toast
  - [ ] Handle duplicate email error
- [ ] Add registration analytics event

#### 3.3 Forgot Password Page
- [ ] Create `app/(auth)/forgot-password/page.tsx`
- [ ] Create `ForgotPasswordForm` component
  - [ ] Email input
  - [ ] Submit button with loading state
  - [ ] Back to login link
  - [ ] Success message display
- [ ] Create `useForgotPassword` hook
  - [ ] useMutation for forgot password API
  - [ ] Show success message
  - [ ] Email verification code sent
  - [ ] Handle unknown email error

#### 3.4 Reset Password Page
- [ ] Create `app/(auth)/reset-password/page.tsx`
- [ ] Create `ResetPasswordForm` component
  - [ ] New password input with strength meter
  - [ ] Confirm password input
  - [ ] Submit button with loading state
  - [ ] Token validation on mount
- [ ] Create `useResetPassword` hook
  - [ ] useMutation for reset password API
  - [ ] Parse token from URL
  - [ ] Redirect to login on success
  - [ ] Handle invalid/expired token error

#### 3.5 Verify Email Page
- [ ] Create `app/(auth)/verify-email/page.tsx`
- [ ] Create `VerifyEmailForm` component
  - [ ] Auto-verify on mount (token in URL)
  - [ ] Manual verification input
  - [ ] Resend verification button
  - [ ] Success/error state display
- [ ] Create `useVerifyEmail` hook
  - [ ] useMutation for verify email API
  - [ ] Auto-login on success
  - [ ] Handle already verified case

#### 3.6 Magic Link Page
- [ ] Create `app/(auth)/magic-link/page.tsx`
- [ ] Create `MagicLinkForm` component
  - [ ] Email input
  - [ ] Submit button
  - [ ] Link sent confirmation
- [ ] Create `useMagicLink` hook
  - [ ] useMutation for magic link API
  - [ ] Show link sent message
  - [ ] Auto-login from link (token in URL)

#### 3.7 Two-Factor Auth (Placeholder)
- [ ] Create `app/(auth)/two-step/page.tsx`
- [ ] Create `TwoFactorForm` component
  - [ ] 6-digit code input
  - [ ] Submit button
  - [ ] Backup codes link
  - [ ] Trust this device checkbox
- [ ] Note: Full 2FA implementation in Phase 16

---

### 4. Account Workspace (48 items)

#### 4.1 Account Overview
- [ ] Create `app/(dashboard)/(account)/page.tsx`
- [ ] Create `AccountOverview` component
  - [ ] Welcome message with user name
  - [ ] Account completion progress bar
  - [ ] Quick stats cards (orders, wishlist, reviews)
  - [ ] Recent activity timeline
  - [ ] Quick actions (update profile, add address)
  - [ ] Security alerts (unverified email, weak password)

#### 4.2 Profile Management
- [ ] Create `app/(dashboard)/(account)/profile/page.tsx`
- [ ] Create `ProfileForm` component
  - [ ] Full name input
  - [ ] Email input (read-only, link to change)
  - [ ] Phone number input with validation
  - [ ] Date of birth picker
  - [ ] Gender select
  - [ ] Bio textarea
  - [ ] Avatar upload
  - [ ] Language preference select
  - [ ] Timezone select
  - [ ] Currency preference select
  - [ ] Submit button with loading state
- [ ] Create `useProfile` hook (query)
- [ ] Create `useUpdateProfile` hook (mutation)
  - [ ] Optimistic update
  - [ ] Cache invalidation
  - [ ] Success toast
  - [ ] Handle validation errors

#### 4.3 Address Book
- [ ] Create `app/(dashboard)/(account)/addresses/page.tsx`
- [ ] Create `AddressBook` component
  - [ ] Address cards list
  - [ ] Default address badge
  - [ ] Edit button per address
  - [ ] Delete button per address
  - [ ] Add new address button
- [ ] Create `app/(dashboard)/(account)/addresses/new/page.tsx`
- [ ] Create `app/(dashboard)/(account)/addresses/[id]/edit/page.tsx`
- [ ] Create `AddressForm` component
  - [ ] Label input (Home, Work, etc.)
  - [ ] Full name input
  - [ ] Phone number input
  - [ ] Address line 1 input
  - [ ] Address line 2 input (optional)
  - [ ] City input
  - [ ] State/Province select
  - [ ] Postal code input
  - [ ] Country select
  - [ ] Set as default checkbox
  - [ ] Submit button
- [ ] Create `useAddresses` hook (query)
- [ ] Create `useCreateAddress` hook (mutation)
- [ ] Create `useUpdateAddress` hook (mutation)
- [ ] Create `useDeleteAddress` hook (mutation)
- [ ] Create `useSetDefaultAddress` hook (mutation)

#### 4.4 Security Center
- [ ] Create `app/(dashboard)/(account)/security/page.tsx`
- [ ] Create `SecurityCenter` component
  - [ ] Password strength indicator
  - [ ] Last password change date
  - [ ] Change password button
  - [ ] Two-factor auth status (placeholder)
  - [ ] Backup codes status (placeholder)
  - [ ] Trusted devices count
  - [ ] Security recommendations
- [ ] Create `app/(dashboard)/(account)/security/password/page.tsx`
- [ ] Create `PasswordUpdateForm` component
  - [ ] Current password input
  - [ ] New password input with strength meter
  - [ ] Confirm new password input
  - [ ] Password requirements checklist
  - [ ] Submit button
- [ ] Create `useUpdatePassword` hook
  - [ ] Check against breached passwords API (HaveIBeenPwned)
  - [ ] Force logout all sessions option
  - [ ] Success toast

#### 4.5 Sessions Management
- [ ] Create `app/(dashboard)/(account)/sessions/page.tsx`
- [ ] Create `SessionsList` component
  - [ ] Current session indicator
  - [ ] Session cards with details
  - [ ] Revoke all sessions button
  - [ ] Auto-refresh every 30s
- [ ] Create `SessionCard` component
  - [ ] Device name and icon (desktop, mobile, tablet)
  - [ ] Browser and OS info
  - [ ] Location (city, country) with flag
  - [ ] IP address (masked)
  - [ ] Last active (relative time)
  - [ ] Created at date
  - [ ] Trusted device badge
  - [ ] Revoke button
- [ ] Create `useSessions` hook (query)
  - [ ] Auto-refetch every 30s
  - [ ] Poll for updates
- [ ] Create `useRevokeSession` hook (mutation)
  - [ ] Optimistic update
  - [ ] Broadcast to other tabs
  - [ ] Success toast
- [ ] Create `useRevokeAllSessions` hook (mutation)
  - [ ] Confirm modal
  - [ ] Force logout all tabs
  - [ ] Redirect to login

#### 4.6 Notifications Settings
- [ ] Create `app/(dashboard)/(account)/notifications/page.tsx`
- [ ] Create `NotificationSettings` component
  - [ ] Email notification toggles
    - [ ] Order updates
    - [ ] Shipping notifications
    - [ ] Marketing emails
    - [ ] Product recommendations
    - [ ] Newsletter
  - [ ] Push notification toggles
    - [ ] Order updates
    - [ ] Price drops
    - [ ] Back in stock
  - [ ] SMS notification toggles (Phase 12)
  - [ ] Notification frequency select
  - [ ] Save button
- [ ] Create `useNotificationSettings` hook (query)
- [ ] Create `useUpdateNotificationSettings` hook (mutation)

#### 4.7 Billing & Invoices (Placeholder)
- [ ] Create `app/(dashboard)/(account)/billing/page.tsx`
- [ ] Note: Full implementation in Phase 10
- [ ] Placeholder UI with "Coming Soon" message

#### 4.8 Privacy & Data
- [ ] Create `app/(dashboard)/(account)/privacy/page.tsx`
- [ ] Create `ConsentCenter` component
  - [ ] Cookie consent history
  - [ ] Marketing consent toggle
  - [ ] Data processing consent
  - [ ] Third-party sharing consent
  - [ ] Consent history timeline
- [ ] Create `AuditFeed` component
  - [ ] Infinite scroll list
  - [ ] Activity cards (login, profile update, order, etc.)
  - [ ] Filter by action type
  - [ ] Date range filter
  - [ ] Export to CSV button
  - [ ] Export to PDF button (placeholder)
- [ ] Create data export/erase request buttons
  - [ ] Request data download (GDPR compliance)
  - [ ] Request account deletion
  - [ ] Confirm modals

---

### 5. Device Trust & Fingerprinting (18 items)

#### 5.1 Device Fingerprinting
- [ ] Create `src/lib/auth/device.ts`
  - [ ] Generate device fingerprint
    - [ ] User agent
    - [ ] Screen resolution
    - [ ] Timezone
    - [ ] Language
    - [ ] Platform
    - [ ] Canvas fingerprint (optional)
  - [ ] Hash fingerprint for privacy
  - [ ] Store in session store

#### 5.2 Trusted Device Management
- [ ] Add device registration on login
  - [ ] "Trust this device" checkbox
  - [ ] Store device in session
  - [ ] Send to backend for storage
- [ ] Display trusted devices in security center
  - [ ] Device list with details
  - [ ] Remove device button
  - [ ] Last used date
- [ ] Create `useTrustedDevices` hook (query)
- [ ] Create `useAddTrustedDevice` hook (mutation)
- [ ] Create `useRemoveTrustedDevice` hook (mutation)

#### 5.3 Geolocation & IP Tracking
- [ ] Add geolocation to login payload
  - [ ] City, country from IP (backend)
  - [ ] Display in session list
  - [ ] Flag unusual locations
- [ ] Create location detection service
  - [ ] Use IP geolocation API
  - [ ] Cache location data
  - [ ] Privacy-respecting (no GPS)

---

### 6. RBAC & Feature Flags (22 items)

#### 6.1 Role-Based Guards
- [ ] Update `middleware.ts`
  - [ ] Extract user role from session
  - [ ] Protect `/dashboard/*` (authenticated only)
  - [ ] Protect `/admin/*` (admin role only)
  - [ ] Protect `/account/*` (authenticated only)
  - [ ] Redirect unauthenticated to `/login`
  - [ ] Redirect unauthorized to `/403`

#### 6.2 Client-Side Guards
- [ ] Create `src/lib/auth/guards.ts`
  - [ ] `requireAuth()` HOC
  - [ ] `requireRole(role)` HOC
  - [ ] `requirePermission(permission)` HOC
  - [ ] `useAuth()` hook with guards
  - [ ] `useRole()` hook
  - [ ] `usePermission()` hook

#### 6.3 Feature Flag Integration
- [ ] Add feature flags to session store
  - [ ] `featureFlags: Record<string, boolean>`
  - [ ] Fetch from backend on login
  - [ ] Update on session refresh
- [ ] Create `useFeatureFlag(flag)` hook
- [ ] Create conditional render components
  - [ ] `<FeatureFlag flag="new-checkout">`
  - [ ] `<RoleGuard role="admin">`
  - [ ] `<PermissionGuard permission="products:write">`

#### 6.4 UI Variations by Role
- [ ] Admin-specific UI elements
  - [ ] Admin menu in sidebar
  - [ ] Admin badge in header
  - [ ] Quick admin actions
- [ ] Staff-specific UI elements
  - [ ] Staff tools menu
  - [ ] Order management shortcuts
- [ ] Customer UI (default)
  - [ ] Hide admin features
  - [ ] Standard customer navigation

---

### 7. Onboarding Wizard (16 items)

#### 7.1 Wizard State Machine
- [ ] Create `app/onboarding/page.tsx`
- [ ] Create `OnboardingWizard` component
  - [ ] Multi-step form (4 steps)
  - [ ] Progress indicator
  - [ ] Step validation
  - [ ] Back/Next navigation
  - [ ] Skip option (optional steps)
  - [ ] Save progress to backend

#### 7.2 Step 1: Profile Completion
- [ ] Full name input
- [ ] Phone number input
- [ ] Date of birth input
- [ ] Gender select
- [ ] Avatar upload
- [ ] Next button

#### 7.3 Step 2: Address
- [ ] Address form (reuse AddressForm)
- [ ] Set as default automatically
- [ ] Skip button
- [ ] Next button

#### 7.4 Step 3: Security
- [ ] Password strength check
- [ ] Two-factor setup (placeholder)
- [ ] Backup codes (placeholder)
- [ ] Skip button
- [ ] Next button

#### 7.5 Step 4: Preferences
- [ ] Notification settings (subset)
- [ ] Language preference
- [ ] Currency preference
- [ ] Marketing consent
- [ ] Complete button

#### 7.6 Completion & Progress
- [ ] Calculate completion percentage
  - [ ] Profile: 40%
  - [ ] Address: 20%
  - [ ] Security: 20%
  - [ ] Preferences: 20%
- [ ] Display progress bar in account overview
- [ ] Show incomplete sections in overview
- [ ] Resume wizard from last step

---

### 8. Observability & Analytics (24 items)

#### 8.1 Auth Metrics
- [ ] Create `src/lib/auth/metrics.ts`
  - [ ] `trackLogin(success, method, duration)`
  - [ ] `trackRegister(success, method)`
  - [ ] `trackLogout(reason)`
  - [ ] `trackSessionRefresh(success)`
  - [ ] `trackPasswordReset(success)`
  - [ ] `trackEmailVerification(success)`
  - [ ] Custom dimensions: role, device, channel

#### 8.2 Sentry Integration
- [ ] Add auth transactions to Sentry
  - [ ] Login transaction
  - [ ] Register transaction
  - [ ] Session refresh transaction
- [ ] Add breadcrumbs for auth events
  - [ ] Login attempt
  - [ ] Logout
  - [ ] Session expired
  - [ ] Suspicious login detected
- [ ] Set user context in Sentry scope
  - [ ] User ID
  - [ ] Email (hashed)
  - [ ] Role

#### 8.3 Audit Logging
- [ ] Create audit log entries for:
  - [ ] Login (success/failure)
  - [ ] Logout
  - [ ] Password change
  - [ ] Email change
  - [ ] Profile update
  - [ ] Address add/update/delete
  - [ ] Session revoke
  - [ ] Two-factor enable/disable
  - [ ] Data export request
  - [ ] Account deletion request
- [ ] Include metadata:
  - [ ] User ID
  - [ ] Action type
  - [ ] Timestamp
  - [ ] IP address
  - [ ] Device fingerprint
  - [ ] User agent

#### 8.4 Suspicious Activity Detection
- [ ] Flag unusual login patterns
  - [ ] New device
  - [ ] New location
  - [ ] Unusual time
  - [ ] Multiple failed attempts
- [ ] Send alerts to:
  - [ ] Sentry (breadcrumb)
  - [ ] Email notification
  - [ ] Security center banner
- [ ] Create incident webhook (Phase 16)

---

### 9. Accessibility & UX (28 items)

#### 9.1 WCAG 2.2 AA Compliance
- [ ] Form accessibility
  - [ ] Proper label associations
  - [ ] ARIA labels for inputs
  - [ ] Error messages in aria-describedby
  - [ ] Required field indicators
  - [ ] Focus visible styles
  - [ ] Focus trap in modals
- [ ] Keyboard navigation
  - [ ] Tab order correct
  - [ ] Enter to submit forms
  - [ ] Escape to close modals
  - [ ] Arrow keys in lists
  - [ ] Keyboard shortcuts documented
- [ ] Screen reader support
  - [ ] Semantic HTML
  - [ ] ARIA live regions for updates
  - [ ] ARIA announcements for errors
  - [ ] Skip to content link
  - [ ] Descriptive link text

#### 9.2 Error Handling & Validation
- [ ] Create `FormAlert` component
  - [ ] Success, error, warning, info variants
  - [ ] Icon support
  - [ ] Dismissible option
  - [ ] Animation on mount
- [ ] Create `InputHint` component
  - [ ] Help text below input
  - [ ] Error message styling
  - [ ] Character count
- [ ] Create inline validation
  - [ ] Real-time validation on blur
  - [ ] Debounced async validation (email uniqueness)
  - [ ] Password strength meter
  - [ ] Clear error messages

#### 9.3 Loading States & Feedback
- [ ] Create skeleton loaders
  - [ ] Profile form skeleton
  - [ ] Address list skeleton
  - [ ] Session list skeleton
  - [ ] Audit feed skeleton
- [ ] Create loading indicators
  - [ ] Button loading spinner
  - [ ] Page loading overlay
  - [ ] Inline loading spinner
- [ ] Create progress indicators
  - [ ] Form submission progress
  - [ ] File upload progress
  - [ ] Multi-step wizard progress

#### 9.4 Offline & Slow Network UX
- [ ] Create offline fallback page
  - [ ] Offline indicator
  - [ ] Retry button
  - [ ] Cached content display
- [ ] Add retry logic
  - [ ] Exponential backoff
  - [ ] Max retry attempts
  - [ ] User-initiated retry
- [ ] Add network status indicator
  - [ ] Online/offline badge
  - [ ] Slow network warning

---

### 10. Testing & Quality Assurance (34 items)

#### 10.1 Unit Tests
- [ ] Test `useLogin` hook
  - [ ] Successful login
  - [ ] Failed login (wrong credentials)
  - [ ] Network error
- [ ] Test `useRegister` hook
  - [ ] Successful registration
  - [ ] Duplicate email error
  - [ ] Validation errors
- [ ] Test `useForgotPassword` hook
- [ ] Test `useResetPassword` hook
- [ ] Test session store
  - [ ] setSession action
  - [ ] clearSession action
  - [ ] Persist to storage
  - [ ] Hydrate from storage
- [ ] Test auth guards
  - [ ] requireAuth redirects unauthenticated
  - [ ] requireRole checks role
  - [ ] requirePermission checks permission

#### 10.2 Integration Tests
- [ ] Test login flow
  - [ ] Submit form
  - [ ] Set session
  - [ ] Redirect to dashboard
  - [ ] Show success toast
- [ ] Test registration flow
  - [ ] Submit form
  - [ ] Redirect to verify email
  - [ ] Show success message
- [ ] Test password reset flow
  - [ ] Request reset
  - [ ] Receive email (mock)
  - [ ] Reset password
  - [ ] Redirect to login
- [ ] Test session refresh
  - [ ] Auto-refresh before expiry
  - [ ] Handle refresh failure
  - [ ] Force logout on failure
- [ ] Test cross-tab sync
  - [ ] Login in tab 1
  - [ ] Session syncs to tab 2
  - [ ] Logout in tab 1
  - [ ] Tab 2 logs out

#### 10.3 E2E Tests (Playwright)
- [ ] Create `tests/e2e/auth-orchestration.spec.ts`
- [ ] Test complete registration flow
  - [ ] Fill form
  - [ ] Submit
  - [ ] Verify email (mock)
  - [ ] Login
  - [ ] Complete onboarding
- [ ] Test login and account navigation
  - [ ] Login
  - [ ] Navigate to profile
  - [ ] Update profile
  - [ ] Navigate to sessions
  - [ ] Logout
- [ ] Test password reset
  - [ ] Request reset
  - [ ] Click email link (mock)
  - [ ] Reset password
  - [ ] Login with new password
- [ ] Test session management
  - [ ] View sessions
  - [ ] Revoke session
  - [ ] Revoke all sessions
- [ ] Test mobile viewport
- [ ] Test slow network scenario
- [ ] Test offline scenario

#### 10.4 Accessibility Tests
- [ ] Run axe-core tests
  - [ ] Login page: 0 violations
  - [ ] Register page: 0 violations
  - [ ] Profile page: 0 violations
  - [ ] Sessions page: 0 violations
- [ ] Run pa11y tests
- [ ] Manual keyboard navigation test
- [ ] Manual screen reader test (NVDA/JAWS)

#### 10.5 Performance Tests
- [ ] Lighthouse audit
  - [ ] Login page: Performance ≥90
  - [ ] Account overview: Performance ≥90
  - [ ] TTI < 2s
  - [ ] Input latency < 100ms
- [ ] Web Vitals monitoring
  - [ ] LCP < 2s
  - [ ] FID < 100ms
  - [ ] CLS < 0.1

#### 10.6 Security Tests
- [ ] CSRF protection test
  - [ ] Verify CSRF token required
  - [ ] Reject invalid CSRF tokens
- [ ] Session fixation test
  - [ ] New session on login
  - [ ] Old session invalidated
- [ ] Dependency audit
  - [ ] Run `pnpm audit`
  - [ ] Fix high/critical vulnerabilities

---

### 11. Operations & Runbook (20 items)

#### 11.1 Feature Flag Rollout
- [ ] Create rollout plan document
  - [ ] Stage 1: Internal testing (5% users)
  - [ ] Stage 2: Beta users (25% users)
  - [ ] Stage 3: General availability (100% users)
  - [ ] Rollback criteria
  - [ ] Monitoring metrics (p95 sign-in, failure ratio)

#### 11.2 Incident Response
- [ ] Create `docs/frontend/auth-runbook.md`
  - [ ] Common issues and fixes
  - [ ] Session refresh failures
  - [ ] CSRF token mismatches
  - [ ] Captcha fallback triggers
  - [ ] Rate limit exceeded
  - [ ] Device fingerprint issues
- [ ] Define SLO: 99.9% auth uptime
- [ ] Create escalation ladder
  - [ ] Tier 1: Frontend team
  - [ ] Tier 2: Backend team
  - [ ] Tier 3: DevOps/SRE
- [ ] Setup PagerDuty integration
  - [ ] Auth failure rate > 5%
  - [ ] Session refresh failure rate > 10%
  - [ ] Login latency > 3s (p95)

#### 11.3 Support Documentation
- [ ] Create customer support articles
  - [ ] How to reset password
  - [ ] How to verify email
  - [ ] How to manage sessions
  - [ ] How to enable 2FA
  - [ ] How to request data export
- [ ] Create internal troubleshooting guide
- [ ] Create incident communication templates
  - [ ] Auth service degradation
  - [ ] Planned maintenance
  - [ ] Security incident

#### 11.4 Release Checklist
- [ ] Pre-release
  - [ ] All tests passing (unit, integration, E2E)
  - [ ] Coverage ≥85%
  - [ ] Lighthouse scores ≥90
  - [ ] Accessibility audit clean
  - [ ] Security audit clean
  - [ ] Feature flags configured
- [ ] Deployment
  - [ ] Database migrations (if any)
  - [ ] Environment variables updated
  - [ ] CDN cache purged
  - [ ] Monitoring dashboards ready
- [ ] Post-release
  - [ ] Smoke tests passing
  - [ ] Monitor error rates
  - [ ] Monitor performance metrics
  - [ ] Stakeholder sign-off

---

## 🧪 VALIDATION CRITERIA

### Functional Validation

```bash
# Run all auth tests
pnpm --filter @lumi/frontend test -- --runTestsByPath "src/features/auth/**/__tests__/**" "src/features/account/**/__tests__/**"

# Run contract tests
pnpm --filter @lumi/frontend test -- --runTestsByPath "src/lib/auth/__tests__/contracts.test.ts"

# Run integration tests
pnpm --filter @lumi/frontend test:integration

# Run E2E tests
pnpm --filter @lumi/frontend exec playwright test tests/e2e/auth-orchestration.spec.ts

# Check coverage (must be ≥85%)
pnpm --filter @lumi/frontend test:coverage
```

### Auth Flow Validation

```typescript
// Test login flow
test('complete login flow', async () => {
  const { result } = renderHook(() => useLogin());

  await act(async () => {
    await result.current.mutateAsync({
      email: 'test@example.com',
      password: 'Password123!',
      rememberMe: true
    });
  });

  expect(result.current.isSuccess).toBe(true);
  expect(sessionStore.getState().isAuthenticated).toBe(true);
  expect(sessionStore.getState().user?.email).toBe('test@example.com');
});

// Test session refresh
test('auto-refresh session before expiry', async () => {
  vi.useFakeTimers();
  const { result } = renderHook(() => useSession());

  // Fast-forward to 2 minutes before expiry
  vi.advanceTimersByTime(28 * 60 * 1000);

  await waitFor(() => {
    expect(result.current.isRefreshing).toBe(true);
  });

  await waitFor(() => {
    expect(result.current.isRefreshing).toBe(false);
    expect(result.current.session).toBeDefined();
  });

  vi.useRealTimers();
});
```

### Security Validation (S1-S4)

```typescript
// S1: No password in client state
test('password not stored in session', () => {
  const sessionState = sessionStore.getState();
  expect(sessionState).not.toHaveProperty('password');
  expect(JSON.stringify(sessionState)).not.toContain('password');
});

// S2: CSRF token validation
test('CSRF token required for state changes', async () => {
  const response = await fetch('/api/v1/auth/logout', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer token' }
    // Missing CSRF token
  });
  expect(response.status).toBe(403); // Forbidden
});

// S3: RBAC middleware enforcement
test('admin routes protected', async () => {
  const response = await fetch('/admin/users', {
    headers: { 'Authorization': 'Bearer customer-token' }
  });
  expect(response.status).toBe(403); // Forbidden
});

// S4: No hardcoded secrets
test('no secrets in client bundle', () => {
  const bundleContent = fs.readFileSync('.next/static/chunks/main.js', 'utf-8');
  expect(bundleContent).not.toMatch(/secret_key|api_secret|private_key/i);
});
```

### Accessibility Validation

```bash
# Run axe tests
pnpm --filter @lumi/frontend test:a11y

# Expected: 0 violations
```

```typescript
import { axe } from 'jest-axe';

test('login page is accessible', async () => {
  const { container } = render(<LoginPage />);
  const results = await axe(container);
  expect(results).toHaveNoViolations();
});
```

### Performance Validation

```typescript
// Lighthouse test
const lighthouse = await runLighthouse('/login');
expect(lighthouse.performance).toBeGreaterThan(90);
expect(lighthouse.accessibility).toBeGreaterThan(90);
expect(lighthouse.bestPractices).toBeGreaterThan(90);

// TTI check
expect(lighthouse.metrics.interactive).toBeLessThan(2000); // < 2s
```

---

## 📊 SUCCESS METRICS

### Code Quality Metrics
- ✅ Test coverage: ≥85%
- ✅ TypeScript: 0 errors
- ✅ ESLint: 0 errors
- ✅ Contract tests: 100% passing
- ✅ E2E tests: 100% passing

### Performance Metrics
- ✅ Lighthouse Performance: ≥90
- ✅ TTI: < 2s
- ✅ Input latency: < 100ms
- ✅ LCP: < 2s
- ✅ CLS: < 0.1

### Security Metrics (S1-S4)
- ✅ No passwords in client state
- ✅ CSRF protection: 100% coverage
- ✅ RBAC: All routes protected
- ✅ No hardcoded secrets

### Accessibility Metrics
- ✅ WCAG 2.2 AA: 100% compliance
- ✅ axe violations: 0
- ✅ Keyboard navigation: Fully functional
- ✅ Screen reader: Fully compatible

### Business Metrics
- ✅ Auth uptime SLO: 99.9%
- ✅ Login success rate: >95%
- ✅ Session refresh success: >98%
- ✅ Average login time: <1.5s

---

## 🚨 COMMON PITFALLS TO AVOID

### 1. Storing Password in Client State (S1)
❌ **Wrong:**
```typescript
const [password, setPassword] = useState('');
sessionStore.setState({ password }); // NEVER!
```

✅ **Correct:**
```typescript
// Only use controlled state for form input
const [password, setPassword] = useState('');
// Submit directly to API, never store
await login({ email, password });
setPassword(''); // Clear immediately
```

### 2. Missing CSRF Protection (S2)
❌ **Wrong:**
```typescript
await fetch('/api/v1/auth/logout', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${token}` }
});
```

✅ **Correct:**
```typescript
await fetch('/api/v1/auth/logout', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'X-CSRF-Token': csrfToken
  }
});
```

### 3. Weak Client-Side Guards (S3)
❌ **Wrong:**
```typescript
// Only client-side check
if (!user || user.role !== 'admin') {
  return <div>Unauthorized</div>;
}
// Attacker can bypass in DevTools
```

✅ **Correct:**
```typescript
// Middleware guard (server-side)
export function middleware(req: NextRequest) {
  const session = getSession(req);
  if (!session || session.role !== 'admin') {
    return NextResponse.redirect('/403');
  }
}

// Client guard as UX enhancement only
if (!user || user.role !== 'admin') {
  return <div>Unauthorized</div>;
}
```

### 4. No Session Refresh
❌ **Wrong:**
```typescript
// Session expires, user gets logged out unexpectedly
```

✅ **Correct:**
```typescript
// Auto-refresh 30min before expiry
useEffect(() => {
  const expiresIn = session.expiresAt - Date.now();
  const refreshAt = expiresIn - 30 * 60 * 1000; // 30min before

  const timer = setTimeout(() => {
    refreshToken();
  }, refreshAt);

  return () => clearTimeout(timer);
}, [session]);
```

### 5. No Cross-Tab Sync
❌ **Wrong:**
```typescript
// Logout in tab 1, tab 2 still shows as logged in
```

✅ **Correct:**
```typescript
// BroadcastChannel sync
const channel = new BroadcastChannel('lumi-session');

channel.addEventListener('message', (event) => {
  if (event.data.type === 'logout') {
    clearSession();
    window.location.href = '/login';
  }
});

// When logging out
channel.postMessage({ type: 'logout' });
```

### 6. Missing Idle Timeout
❌ **Wrong:**
```typescript
// User walks away, session stays active indefinitely
```

✅ **Correct:**
```typescript
// Track last activity
let lastActivity = Date.now();

['click', 'keypress', 'scroll'].forEach(event => {
  window.addEventListener(event, () => {
    lastActivity = Date.now();
  });
});

// Check idle every minute
setInterval(() => {
  const idle = Date.now() - lastActivity;
  if (idle > 15 * 60 * 1000) { // 15 min
    logout();
  }
}, 60 * 1000);
```

### 7. Poor Error Messages
❌ **Wrong:**
```typescript
throw new Error('Login failed');
```

✅ **Correct:**
```typescript
if (error.code === 'INVALID_CREDENTIALS') {
  toast.error('Invalid email or password. Please try again.');
} else if (error.code === 'ACCOUNT_LOCKED') {
  toast.error('Your account has been locked due to multiple failed login attempts. Please reset your password or contact support.');
} else {
  toast.error('An unexpected error occurred. Please try again later.');
}
```

### 8. No Loading States
❌ **Wrong:**
```tsx
<button onClick={handleLogin}>Login</button>
```

✅ **Correct:**
```tsx
<button onClick={handleLogin} disabled={isLoading}>
  {isLoading ? <Spinner /> : 'Login'}
</button>
```

---

## 📦 DELIVERABLES

### 1. Auth Pages
- ✅ Login page with form
- ✅ Register page with form
- ✅ Forgot password page
- ✅ Reset password page
- ✅ Verify email page
- ✅ Magic link page
- ✅ Two-factor page (placeholder)

### 2. Account Workspace
- ✅ Account overview dashboard
- ✅ Profile management
- ✅ Address book
- ✅ Security center
- ✅ Sessions management
- ✅ Notification settings
- ✅ Privacy & audit feed
- ✅ Billing (placeholder)

### 3. Session Management
- ✅ Zustand session store
- ✅ Session provider with refresh
- ✅ Idle timeout (15min)
- ✅ Cross-tab sync (BroadcastChannel)
- ✅ Device fingerprinting
- ✅ Trusted device management

### 4. RBAC & Guards
- ✅ Middleware auth protection
- ✅ Client-side guards (HOCs, hooks)
- ✅ Feature flag system
- ✅ Role-based UI variations

### 5. Onboarding
- ✅ Multi-step wizard (4 steps)
- ✅ Progress tracking
- ✅ Skip/resume functionality

### 6. Observability
- ✅ Auth analytics (login, register, etc.)
- ✅ Sentry integration
- ✅ Audit logging
- ✅ Suspicious activity detection

### 7. Testing
- ✅ Unit tests (≥85% coverage)
- ✅ Integration tests
- ✅ Contract tests (MSW)
- ✅ E2E tests (Playwright)
- ✅ Accessibility tests (axe)
- ✅ Performance tests (Lighthouse)

### 8. Documentation
- ✅ Auth orchestration guide
- ✅ API contract documentation
- ✅ Runbook for incidents
- ✅ Support articles
- ✅ Release notes

---

## 📈 PHASE COMPLETION REPORT TEMPLATE

```markdown
# PHASE 7: Auth Orchestration - Completion Report

## Implementation Summary
- **Start Date**: [Date]
- **End Date**: [Date]
- **Duration**: [Days]
- **Team Members**: [Names]

## Completed Items
- [x] Total Items: 302/302 (100%)
- [x] Auth API Integration: 26/26
- [x] Session Management: 32/32
- [x] Auth Pages: 38/38
- [x] Account Workspace: 48/48
- [x] Device Trust: 18/18
- [x] RBAC & Guards: 22/22
- [x] Onboarding: 16/16
- [x] Observability: 24/24
- [x] Accessibility: 28/28
- [x] Testing: 34/34
- [x] Operations: 20/20

## Metrics Achieved
- **Test Coverage**: X% (Target: ≥85%)
- **Lighthouse Performance**: X (Target: ≥90)
- **TTI**: Xms (Target: <2000ms)
- **Accessibility**: 0 violations
- **Auth Uptime**: X% (Target: 99.9%)

## Security Compliance
- ✅ S1: No client-side password storage
- ✅ S2: CSRF protection active
- ✅ S3: RBAC enforced
- ✅ S4: No hardcoded secrets

## Known Issues
- [List any known issues or technical debt]

## Next Phase Preparation
- Phase 8 dependencies ready: ✅
- Auth context projection: ✅
- Session metadata: ✅
```

---

## 🎯 NEXT PHASE PREVIEW

**Phase 8: E-commerce Interface**
- Homepage with hero and featured products
- Product catalog with filters and search
- Product detail with variant selection
- Shopping cart (mini + full page)
- Multi-step checkout flow
- Mobile-first, PWA-ready

**Dependencies from Phase 7:**
- Session management ✅
- User profile data ✅
- Address management ✅
- Auth guards ✅
- Feature flags ✅

---

**END OF PHASE 7 DOCUMENTATION**

_Version 1.0 | Last Updated: 2025-10-01_
