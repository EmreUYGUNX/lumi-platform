# 🔐 PHASE 3: AUTHENTICATION & RBAC

**Status**: 🔄 **READY TO START**
**Priority**: 🔴 CRITICAL
**Dependencies**: Phase 0, Phase 1, Phase 2
**Estimated Time**: 12 days
**Complexity**: Very High

---

## 📋 PHASE OVERVIEW

**Version**: 1.0
**Last Updated**: 2025-10-01
**Phase Type**: Security & Authorization Core
**Success Criteria**: Production-ready JWT authentication with enterprise-grade RBAC system

### 🎯 PHASE OBJECTIVES

Phase 3 implements the complete authentication and authorization system using JWT tokens, bcrypt password hashing, role-based access control (RBAC), and comprehensive security features including account lockout, session management, and audit logging.

**Primary Objectives:**

1. ✅ Implement JWT-based authentication (access + refresh tokens)
2. ✅ Create bcrypt password hashing system (12+ rounds - S1)
3. ✅ Build comprehensive RBAC system (roles, permissions, resource-based)
4. ✅ Implement secure session management with fingerprinting
5. ✅ Create account security features (lockout, 2FA ready)
6. ✅ Build email verification and password reset flows
7. ✅ Implement token rotation and replay detection
8. ✅ Create security event logging and monitoring
9. ✅ Build admin route protection (S3 compliance)
10. ✅ Implement rate limiting for auth endpoints

### 🎨 DESIGN PHILOSOPHY

This phase follows **"Zero Trust, Maximum Security"** principle:

- **Defense in Depth**: Multiple security layers
- **Principle of Least Privilege**: Minimal permissions by default
- **Secure by Default**: All auth endpoints protected
- **Audit Everything**: Comprehensive logging
- **Session Security**: Fingerprinting and device tracking
- **Token Rotation**: Automatic refresh token rotation
- **Replay Protection**: Detect and prevent token reuse

---

## 🎯 CRITICAL REQUIREMENTS

### Security Standards (S1-S4)

- **S1**: ⚠️ **CRITICAL** - bcrypt with saltRounds >= 12, NO plain passwords
- **S2**: Input sanitization on ALL auth endpoints
- **S3**: ⚠️ **CRITICAL** - Admin routes require 'admin' role, all violations logged
- **S4**: JWT secrets from environment (32+ characters), no hardcoded secrets

### Performance Standards (P1-P2)

- **P1**: Token generation < 100ms
- **P1**: RBAC permission check < 50ms
- **P1**: Session validation < 100ms

### Quality Standards (Q1-Q3)

- **Q1**: Zero ESLint/TypeScript errors
- **Q2**: Standard response format for all endpoints
- **Q3**: All security events logged with timestamps

### Authentication Requirements

```typescript
// JWT Token Structure
interface AccessToken {
  sub: string;          // User ID
  email: string;
  roleIds: string[];
  permissions: string[];
  sessionId: string;
  iat: number;
  exp: number;          // 15 minutes
  jti: string;          // Token ID
}

interface RefreshToken {
  sub: string;          // User ID
  sessionId: string;
  iat: number;
  exp: number;          // 14 days
  jti: string;
}

// Password Requirements
- Minimum 12 characters
- At least 1 uppercase letter
- At least 1 lowercase letter
- At least 1 number
- At least 1 special character
- Optional: haveibeenpwned API check
```

---

## ✅ IMPLEMENTATION CHECKLIST

### 1. Configuration & Environment (15 items)

#### 1.1 Environment Variables

- [ ] Add JWT_ACCESS_SECRET to .env (min 32 chars)
- [ ] Add JWT_REFRESH_SECRET to .env (min 32 chars)
- [ ] Add JWT_ACCESS_TTL (default: 15m)
- [ ] Add JWT_REFRESH_TTL (default: 14d)
- [ ] Add COOKIE_DOMAIN configuration
- [ ] Add COOKIE_SECRET (for signed cookies)
- [ ] Add FRONTEND_URL for CORS and redirects
- [ ] Add EMAIL_VERIFICATION_TTL (default: 24h)
- [ ] Add PASSWORD_RESET_TTL (default: 1h)
- [ ] Add SESSION_FINGERPRINT_SECRET
- [ ] Add LOCKOUT_DURATION (default: 15m)
- [ ] Add MAX_LOGIN_ATTEMPTS (default: 5)

#### 1.2 Config Validation

- [ ] Create auth config schema with Zod
- [ ] Validate all JWT secrets >= 32 chars
- [ ] Validate TTL values are valid durations
- [ ] Export typed AuthConfig interface

### 2. Password Security (12 items)

#### 2.1 Bcrypt Utilities (S1)

- [ ] Create `apps/backend/src/lib/crypto/password.ts`
- [ ] Implement `hashPassword(password: string)` with saltRounds = 12
- [ ] Implement `verifyPassword(password: string, hash: string)`
- [ ] Add timing-safe comparison
- [ ] Create password strength validator
  - [ ] Check minimum length (12 chars)
  - [ ] Check uppercase requirement
  - [ ] Check lowercase requirement
  - [ ] Check number requirement
  - [ ] Check special character requirement
- [ ] Optional: Implement haveibeenpwned API check
- [ ] Create password validation tests
- [ ] Document password policy

### 3. JWT Token Management (25 items)

#### 3.1 Token Service

- [ ] Create `apps/backend/src/modules/auth/token.service.ts`
- [ ] Implement `generateAccessToken(user, session)`
  - [ ] Include sub, email, roleIds, permissions
  - [ ] Include sessionId for tracking
  - [ ] Generate unique jti
  - [ ] Set 15 minute expiration
  - [ ] Sign with JWT_ACCESS_SECRET
- [ ] Implement `generateRefreshToken(user, session)`
  - [ ] Include sub, sessionId
  - [ ] Generate unique jti
  - [ ] Set 14 day expiration
  - [ ] Sign with JWT_REFRESH_SECRET
- [ ] Implement `verifyAccessToken(token)`
  - [ ] Verify signature
  - [ ] Check expiration
  - [ ] Validate structure
  - [ ] Return decoded payload
- [ ] Implement `verifyRefreshToken(token)`
  - [ ] Verify signature
  - [ ] Check expiration
  - [ ] Check not revoked
  - [ ] Return decoded payload
- [ ] Implement `revokeToken(sessionId)`
  - [ ] Mark session as revoked
  - [ ] Update revokedAt timestamp
  - [ ] Log security event
- [ ] Implement `rotateRefreshToken(oldToken)`
  - [ ] Verify old token
  - [ ] Generate new token pair
  - [ ] Revoke old token
  - [ ] Detect replay attacks
- [ ] Create token blacklist (Redis-based)
- [ ] Implement token cleanup job

#### 3.2 Token Middleware

- [ ] Create `apps/backend/src/middleware/auth/deserializeUser.ts`
- [ ] Extract token from Authorization header (Bearer)
- [ ] Extract refresh token from httpOnly cookie
- [ ] Verify access token
- [ ] Load user with roles and permissions
- [ ] Attach user to req.user
- [ ] Handle token expiration gracefully
- [ ] Add token correlation to logs

### 4. Session Management (18 items)

#### 4.1 Session Service

- [ ] Create `apps/backend/src/modules/auth/session.service.ts`
- [ ] Implement `createSession(userId, fingerprint)`
  - [ ] Generate session ID
  - [ ] Hash refresh token before storage (S1)
  - [ ] Store device fingerprint
  - [ ] Store IP address
  - [ ] Store user agent
  - [ ] Set expiration (14 days)
  - [ ] Return session record
- [ ] Implement `validateSession(sessionId)`
  - [ ] Check session exists
  - [ ] Check not expired
  - [ ] Check not revoked
  - [ ] Verify fingerprint match
  - [ ] Return session data
- [ ] Implement `revokeSession(sessionId)`
  - [ ] Set revokedAt timestamp
  - [ ] Log security event
- [ ] Implement `revokeAllUserSessions(userId)`
  - [ ] Find all user sessions
  - [ ] Revoke each session
  - [ ] Log security event

#### 4.2 Device Fingerprinting

- [ ] Create fingerprint generation utility
- [ ] Combine IP + User-Agent + Accept headers
- [ ] Generate cryptographic hash (SHA-256)
- [ ] Store fingerprint with session
- [ ] Validate fingerprint on token refresh
- [ ] Send alert email on fingerprint change
- [ ] Document fingerprint strategy

### 5. RBAC System (30 items)

#### 5.1 RBAC Service

- [ ] Create `apps/backend/src/modules/auth/rbac.service.ts`
- [ ] Implement `getUserRoles(userId)`
  - [ ] Fetch user roles from database
  - [ ] Return role names array
- [ ] Implement `getUserPermissions(userId)`
  - [ ] Fetch role-based permissions
  - [ ] Fetch user-specific permissions
  - [ ] Merge and deduplicate
  - [ ] Cache for performance
  - [ ] Return permission keys array
- [ ] Implement `hasRole(userId, roleName)`
  - [ ] Check user has specific role
  - [ ] Support multiple role check
- [ ] Implement `hasPermission(userId, permissionKey)`
  - [ ] Check user has specific permission
  - [ ] Support wildcard permissions
  - [ ] Support resource-based permissions
- [ ] Implement `assignRole(userId, roleId)`
  - [ ] Create UserRole record
  - [ ] Clear permission cache
  - [ ] Log audit event
- [ ] Implement `revokeRole(userId, roleId)`
  - [ ] Delete UserRole record
  - [ ] Clear permission cache
  - [ ] Log audit event
- [ ] Implement `grantPermission(userId, permissionId)`
  - [ ] Create UserPermission record
  - [ ] Clear permission cache
- [ ] Implement permission caching (Redis)
  - [ ] Cache user permissions (5 min TTL)
  - [ ] Invalidate on role/permission changes

#### 5.2 RBAC Middleware

- [ ] Create `apps/backend/src/middleware/auth/requireAuth.ts`
  - [ ] Check req.user exists
  - [ ] Return 401 if not authenticated
  - [ ] Log unauthorized access attempts
- [ ] Create `apps/backend/src/middleware/auth/requireRole.ts`
  - [ ] Accept role names array
  - [ ] Check user has at least one role
  - [ ] Return 403 if role check fails
  - [ ] Log forbidden access attempts
- [ ] Create `apps/backend/src/middleware/auth/requirePermission.ts`
  - [ ] Accept permission keys array
  - [ ] Check user has all required permissions
  - [ ] Return 403 if permission check fails
  - [ ] Log permission violations
- [ ] Create `apps/backend/src/middleware/auth/authorizeResource.ts`
  - [ ] Check resource ownership
  - [ ] Support admin override
  - [ ] Return 403 if not authorized

#### 5.3 Admin Route Protection (S3)

- [ ] Protect all `/api/v1/admin/*` routes
- [ ] Use requireAuth + requireRole(['admin'])
- [ ] Log all admin access attempts
- [ ] Return 403 with clear error message
- [ ] Create admin route test suite

### 6. Authentication Endpoints (35 items)

#### 6.1 Auth Controller

- [ ] Create `apps/backend/src/modules/auth/auth.controller.ts`
- [ ] Create `apps/backend/src/modules/auth/auth.service.ts`

#### 6.2 POST /api/v1/auth/register

- [ ] Create Zod validation schema
  - [ ] email: valid email format
  - [ ] password: meets strength requirements
  - [ ] firstName: min 2 chars
  - [ ] lastName: min 2 chars
  - [ ] phone: optional, valid format
- [ ] Check email not already registered
- [ ] Hash password with bcrypt (S1)
- [ ] Create user record
- [ ] Assign default 'customer' role
- [ ] Generate email verification token
- [ ] Send verification email
- [ ] Create security event log
- [ ] Return Q2 response format
- [ ] Apply rate limiting (5 req/15min)

#### 6.3 POST /api/v1/auth/login

- [ ] Create Zod validation schema
- [ ] Find user by email
- [ ] Check account not locked
- [ ] Verify password with bcrypt
- [ ] Handle failed login attempts
  - [ ] Increment failedLoginCount
  - [ ] Lock account after 5 failures
  - [ ] Set lockoutUntil timestamp
  - [ ] Send lockout notification email
- [ ] Reset failedLoginCount on success
- [ ] Check email verified (optional)
- [ ] Generate device fingerprint
- [ ] Create session record
- [ ] Generate access + refresh tokens
- [ ] Set httpOnly refresh cookie
- [ ] Log successful login event
- [ ] Return tokens in Q2 format
- [ ] Apply rate limiting (5 req/15min per IP)

#### 6.4 POST /api/v1/auth/refresh

- [ ] Extract refresh token from cookie
- [ ] Verify refresh token signature
- [ ] Validate session exists and active
- [ ] Verify fingerprint matches
- [ ] Detect token replay
  - [ ] Check if token already used
  - [ ] Revoke all sessions if replay detected
  - [ ] Send security alert email
  - [ ] Log security event
- [ ] Generate new token pair
- [ ] Hash and store new refresh token
- [ ] Revoke old refresh token
- [ ] Update session record
- [ ] Return new tokens in Q2 format

#### 6.5 POST /api/v1/auth/logout

- [ ] Extract session ID from access token
- [ ] Revoke session
- [ ] Clear refresh cookie (Max-Age=0)
- [ ] Log logout event
- [ ] Return success in Q2 format

#### 6.6 POST /api/v1/auth/logout-all

- [ ] Get user ID from token
- [ ] Revoke all user sessions
- [ ] Clear refresh cookie
- [ ] Log logout event
- [ ] Return success in Q2 format

#### 6.7 GET /api/v1/auth/me

- [ ] Require authentication
- [ ] Return current user data
- [ ] Include roles and permissions
- [ ] Return Q2 format

#### 6.8 POST /api/v1/auth/verify-email

- [ ] Accept verification token
- [ ] Find token record
- [ ] Check token not expired
- [ ] Check token not already used
- [ ] Update user.emailVerifiedAt
- [ ] Mark token as used
- [ ] Log verification event
- [ ] Return success in Q2 format

#### 6.9 POST /api/v1/auth/resend-verification

- [ ] Require authentication
- [ ] Check email not already verified
- [ ] Generate new verification token
- [ ] Send verification email
- [ ] Return success in Q2 format
- [ ] Apply rate limiting (3 req/hour)

#### 6.10 POST /api/v1/auth/forgot-password

- [ ] Accept email address
- [ ] Find user by email
- [ ] Generate password reset token
- [ ] Hash token before storage
- [ ] Send reset email with signed link
- [ ] ALWAYS return success (prevent enumeration)
- [ ] Log reset request
- [ ] Apply rate limiting (3 req/hour per IP)

#### 6.11 POST /api/v1/auth/reset-password

- [ ] Accept token and new password
- [ ] Find token record
- [ ] Check token not expired
- [ ] Check token not already used
- [ ] Validate new password strength
- [ ] Hash new password with bcrypt
- [ ] Update user password
- [ ] Mark token as used
- [ ] Revoke all user sessions
- [ ] Send password changed email
- [ ] Log password reset event
- [ ] Return success in Q2 format

#### 6.12 PUT /api/v1/auth/change-password

- [ ] Require authentication
- [ ] Accept current and new password
- [ ] Verify current password
- [ ] Validate new password strength
- [ ] Check new != current
- [ ] Hash new password
- [ ] Update user password
- [ ] Revoke all other sessions (keep current)
- [ ] Send password changed email
- [ ] Log password change event
- [ ] Return success in Q2 format

### 7. Security Features (25 items)

#### 7.1 Account Lockout

- [ ] Implement lockout after 5 failed attempts
- [ ] Set lockout duration (15 minutes)
- [ ] Clear lockout after duration expires
- [ ] Send lockout notification email
- [ ] Log lockout events
- [ ] Support manual unlock (admin)
- [ ] Display time remaining on lockout

#### 7.2 Two-Factor Authentication (Ready)

- [ ] Add twoFactorSecret field to User
- [ ] Add twoFactorEnabled boolean
- [ ] Create 2FA setup endpoint (future)
- [ ] Create 2FA verify endpoint (future)
- [ ] Document 2FA implementation plan
- [ ] Add 2FA backup codes (future)

#### 7.3 Email Verification

- [ ] Generate cryptographically secure tokens
- [ ] Hash tokens before database storage
- [ ] Set expiration (24 hours)
- [ ] Send verification emails via Mailhog
- [ ] Create signed verification URLs
- [ ] Handle token expiration gracefully
- [ ] Support resend functionality

#### 7.4 Password Reset

- [ ] Generate cryptographically secure tokens
- [ ] Hash tokens before database storage
- [ ] Set expiration (1 hour)
- [ ] Send reset emails via Mailhog
- [ ] Create signed reset URLs
- [ ] Revoke all sessions after reset
- [ ] Log password reset events

#### 7.5 Security Event Logging

- [ ] Create SecurityEventLogger service
- [ ] Log login success/failure
- [ ] Log account lockouts
- [ ] Log password changes
- [ ] Log token replay attempts
- [ ] Log permission violations
- [ ] Log admin access attempts
- [ ] Log session revocations
- [ ] Include IP, user agent, timestamp
- [ ] Send to Sentry for critical events

### 8. Email Templates & Notifications (15 items)

#### 8.1 Email Service Setup

- [ ] Configure Mailhog for development
- [ ] Create email template system
- [ ] Implement HTML email templates
- [ ] Add plain text fallbacks
- [ ] Support template variables

#### 8.2 Email Templates

- [ ] Create welcome email template
- [ ] Create email verification template
- [ ] Create password reset template
- [ ] Create password changed notification
- [ ] Create account locked notification
- [ ] Create new device login alert
- [ ] Create session revoked notification
- [ ] Create 2FA setup template (future)

#### 8.3 Email Utilities

- [ ] Create signed URL generator
- [ ] Implement email rate limiting
- [ ] Add email queue (future: Bull/BullMQ)
- [ ] Create email delivery logging

### 9. Rate Limiting & Protection (12 items)

#### 9.1 Auth-Specific Rate Limits

- [ ] Login endpoint: 5 attempts / 15 min per IP
- [ ] Register endpoint: 5 attempts / 15 min per IP
- [ ] Forgot password: 3 attempts / hour per IP
- [ ] Resend verification: 3 attempts / hour per user
- [ ] Refresh token: 10 attempts / minute per IP
- [ ] Change password: 5 attempts / hour per user

#### 9.2 Redis Rate Limiter

- [ ] Implement Redis-based rate limiting
- [ ] Add in-memory fallback
- [ ] Return 429 with retry-after header
- [ ] Log rate limit violations
- [ ] Support IP whitelist

#### 9.3 Brute Force Protection

- [ ] Track failed login attempts per email
- [ ] Implement progressive delays
- [ ] Support CAPTCHA trigger (future)

### 10. Middleware Integration (10 items)

#### 10.1 Cookie Configuration

- [ ] Set httpOnly flag (prevent XSS)
- [ ] Set secure flag (HTTPS only)
- [ ] Set sameSite=strict (CSRF protection)
- [ ] Set domain from config
- [ ] Set path=/api
- [ ] Sign cookies with secret
- [ ] Set appropriate Max-Age

#### 10.2 Security Headers (from Phase 1)

- [ ] Ensure Helmet configured
- [ ] Ensure CORS configured
- [ ] Ensure input sanitization active
- [ ] Ensure HPP protection active

### 11. Monitoring & Observability (12 items)

#### 11.1 Prometheus Metrics

- [ ] Create `login_success_total` counter
- [ ] Create `login_failure_total` counter
- [ ] Create `registration_total` counter
- [ ] Create `password_reset_total` counter
- [ ] Create `token_refresh_total` counter
- [ ] Create `account_lockout_total` counter
- [ ] Create `session_revoked_total` counter
- [ ] Create `permission_violation_total` counter

#### 11.2 Logging & Alerts

- [ ] Log all authentication events
- [ ] Log all authorization failures
- [ ] Send Sentry alerts for:
  - [ ] Token replay attempts
  - [ ] Multiple failed logins
  - [ ] Permission violations
  - [ ] Suspicious activity patterns

### 12. Testing (40 items)

#### 12.1 Unit Tests - Password

- [ ] Test hashPassword generates bcrypt hash
- [ ] Test verifyPassword with correct password
- [ ] Test verifyPassword with wrong password
- [ ] Test password strength validation
- [ ] Test all password requirements

#### 12.2 Unit Tests - Tokens

- [ ] Test access token generation
- [ ] Test refresh token generation
- [ ] Test token verification
- [ ] Test token expiration
- [ ] Test token rotation
- [ ] Test replay detection

#### 12.3 Unit Tests - RBAC

- [ ] Test getUserRoles
- [ ] Test getUserPermissions
- [ ] Test hasRole
- [ ] Test hasPermission
- [ ] Test permission caching
- [ ] Test permission invalidation

#### 12.4 Integration Tests - Auth Flow

- [ ] Test complete registration flow
- [ ] Test email verification flow
- [ ] Test login with valid credentials
- [ ] Test login with invalid password
- [ ] Test account lockout after failures
- [ ] Test login during lockout
- [ ] Test token refresh flow
- [ ] Test logout flow
- [ ] Test logout all devices
- [ ] Test password reset request
- [ ] Test password reset completion
- [ ] Test password change

#### 12.5 Integration Tests - RBAC

- [ ] Test protected route without auth (401)
- [ ] Test admin route without admin role (403)
- [ ] Test admin route with admin role (200)
- [ ] Test resource authorization
- [ ] Test permission-based access

#### 12.6 Security Tests

- [ ] Test S1: bcrypt hash format validation
- [ ] Test S2: input sanitization on auth endpoints
- [ ] Test S3: admin route protection
- [ ] Test S4: no hardcoded secrets
- [ ] Test token replay prevention
- [ ] Test session hijacking prevention
- [ ] Test CSRF protection with sameSite
- [ ] Test rate limiting enforcement

#### 12.7 Performance Tests

- [ ] Test token generation < 100ms
- [ ] Test RBAC check < 50ms
- [ ] Test login flow < 500ms
- [ ] Test concurrent logins

### 13. Documentation (15 items)

#### 13.1 API Documentation

- [ ] Update OpenAPI spec with all auth endpoints
- [ ] Document request/response schemas
- [ ] Document authentication flow
- [ ] Document token refresh flow
- [ ] Document error responses
- [ ] Create Postman collection

#### 13.2 Security Documentation

- [ ] Create RBAC matrix (roles × permissions)
- [ ] Document password policy
- [ ] Document lockout policy
- [ ] Document token lifecycle
- [ ] Create security incident runbook
- [ ] Document 2FA implementation plan

#### 13.3 Developer Guides

- [ ] Create authentication integration guide
- [ ] Create RBAC usage examples
- [ ] Create testing guide
- [ ] Document common security pitfalls
- [ ] Create troubleshooting guide

---

## 🧪 VALIDATION CRITERIA

### S1 Validation (Password Security)

```typescript
// Test bcrypt hash with 12+ rounds
describe("Password Security (S1)", () => {
  it("should hash password with bcrypt saltRounds >= 12", async () => {
    const hash = await hashPassword("testPassword123!");

    expect(hash).toMatch(/^\$2[aby]\$/); // bcrypt format

    // Extract rounds from hash
    const rounds = parseInt(hash.split("$")[2]);
    expect(rounds).toBeGreaterThanOrEqual(12);
  });

  it("should never store plain text passwords", async () => {
    const user = await authService.register({
      email: "test@example.com",
      password: "Password123!",
    });

    // Check database
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
    });

    expect(dbUser).toHaveProperty("passwordHash");
    expect(dbUser).not.toHaveProperty("password");
    expect(dbUser.passwordHash).not.toBe("Password123!");
  });
});
```

### S3 Validation (Admin Protection)

```typescript
// Test admin route protection
describe("Admin Route Protection (S3)", () => {
  it("should return 403 for non-admin users", async () => {
    const token = await generateUserToken({ roles: ["customer"] });

    const res = await request(app)
      .get("/api/v1/admin/users")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe("FORBIDDEN");
  });

  it("should allow admin users", async () => {
    const token = await generateUserToken({ roles: ["admin"] });

    const res = await request(app)
      .get("/api/v1/admin/users")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it("should log all admin access attempts", async () => {
    const logSpy = jest.spyOn(logger, "info");
    const token = await generateUserToken({ roles: ["customer"] });

    await request(app).get("/api/v1/admin/users").set("Authorization", `Bearer ${token}`);

    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining("admin access denied"),
      expect.any(Object),
    );
  });
});
```

### Complete Auth Flow Test

```typescript
describe("Complete Authentication Flow", () => {
  it("should handle full user journey", async () => {
    // 1. Register
    const registerRes = await request(app).post("/api/v1/auth/register").send({
      email: "user@example.com",
      password: "SecurePass123!",
      firstName: "John",
      lastName: "Doe",
    });

    expect(registerRes.status).toBe(201);
    const userId = registerRes.body.data.user.id;

    // 2. Verify email
    const verifyToken = await getVerificationToken(userId);
    const verifyRes = await request(app)
      .post("/api/v1/auth/verify-email")
      .send({ token: verifyToken });

    expect(verifyRes.status).toBe(200);

    // 3. Login
    const loginRes = await request(app).post("/api/v1/auth/login").send({
      email: "user@example.com",
      password: "SecurePass123!",
    });

    expect(loginRes.status).toBe(200);
    expect(loginRes.body.data).toHaveProperty("accessToken");
    expect(loginRes.body.data).toHaveProperty("refreshToken");

    const { accessToken, refreshToken } = loginRes.body.data;

    // 4. Access protected route
    const meRes = await request(app)
      .get("/api/v1/auth/me")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(meRes.status).toBe(200);
    expect(meRes.body.data.user.email).toBe("user@example.com");

    // 5. Refresh token
    const refreshRes = await request(app)
      .post("/api/v1/auth/refresh")
      .set("Cookie", `refreshToken=${refreshToken}`);

    expect(refreshRes.status).toBe(200);
    expect(refreshRes.body.data).toHaveProperty("accessToken");

    // 6. Logout
    const logoutRes = await request(app)
      .post("/api/v1/auth/logout")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(logoutRes.status).toBe(200);

    // 7. Verify token is revoked
    const meAfterLogout = await request(app)
      .get("/api/v1/auth/me")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(meAfterLogout.status).toBe(401);
  });
});
```

### Token Replay Detection Test

```typescript
describe("Token Replay Detection", () => {
  it("should detect and prevent token reuse", async () => {
    const { refreshToken } = await loginUser();

    // First refresh (legitimate)
    const refresh1 = await request(app)
      .post("/api/v1/auth/refresh")
      .set("Cookie", `refreshToken=${refreshToken}`);

    expect(refresh1.status).toBe(200);

    // Second refresh with same token (replay attempt)
    const refresh2 = await request(app)
      .post("/api/v1/auth/refresh")
      .set("Cookie", `refreshToken=${refreshToken}`);

    expect(refresh2.status).toBe(401);
    expect(refresh2.body.error.code).toBe("TOKEN_REUSE_DETECTED");

    // All user sessions should be revoked
    const sessions = await prisma.userSession.findMany({
      where: { userId: testUser.id, revokedAt: null },
    });

    expect(sessions).toHaveLength(0);
  });
});
```

### Performance Benchmarks

```yaml
Token Operations:
  Access Token Generation: < 100ms (P1)
  Refresh Token Generation: < 100ms (P1)
  Token Verification: < 50ms
  Token Rotation: < 200ms

RBAC Operations:
  Get User Roles: < 50ms
  Get User Permissions: < 50ms (P1)
  Check Permission: < 50ms (P1)
  Permission Cache Hit: < 10ms

Auth Endpoints:
  Register: < 500ms
  Login: < 500ms
  Refresh: < 300ms
  Logout: < 100ms
  Password Reset: < 400ms
```

---

## 📊 SUCCESS METRICS

### Completion Metrics

- ✅ 100% of checklist items completed (230+/230+)
- ✅ All auth endpoints implemented
- ✅ RBAC system complete
- ✅ All security features implemented
- ✅ Test coverage > 90%
- ✅ Documentation complete

### Security Metrics

- ✅ S1 Compliance: bcrypt saltRounds >= 12
- ✅ S2 Compliance: All inputs sanitized
- ✅ S3 Compliance: Admin routes protected
- ✅ S4 Compliance: No hardcoded secrets
- ✅ Token Replay: 100% detection rate
- ✅ Account Lockout: Working correctly
- ✅ Security Events: All logged

### Performance Metrics

- ✅ Token Generation: < 100ms (P1)
- ✅ RBAC Check: < 50ms (P1)
- ✅ Login Flow: < 500ms
- ✅ Permission Cache: > 95% hit rate

### Quality Metrics

- ✅ Test Coverage: > 90%
- ✅ TypeScript: 0 errors
- ✅ ESLint: 0 errors
- ✅ Q2 Format: 100% compliance
- ✅ OpenAPI: Complete and valid

---

## 🚨 COMMON PITFALLS TO AVOID

### 1. Weak Password Hashing (S1 Violation)

❌ **WRONG**: Using MD5 or SHA-256

```typescript
// ❌ INSECURE!
const hash = crypto.createHash("sha256").update(password).digest("hex");
```

✅ **CORRECT**: bcrypt with 12+ rounds

```typescript
// ✅ S1 Compliant
import bcrypt from "bcryptjs";
const hash = await bcrypt.hash(password, 12);
```

### 2. Storing Plain Refresh Tokens

❌ **WRONG**: Storing token directly

```typescript
// ❌ Security risk!
await prisma.userSession.create({
  data: { refreshToken: token }, // Plain text!
});
```

✅ **CORRECT**: Hash before storage

```typescript
// ✅ Secure
const hash = await bcrypt.hash(token, 10);
await prisma.userSession.create({
  data: { refreshTokenHash: hash },
});
```

### 3. Not Checking Admin Role (S3 Violation)

❌ **WRONG**: No role check

```typescript
// ❌ S3 Violation!
router.get("/api/v1/admin/users", requireAuth, getUsers);
```

✅ **CORRECT**: Explicit admin requirement

```typescript
// ✅ S3 Compliant
router.get(
  "/api/v1/admin/users",
  requireAuth,
  requireRole(["admin"]), // S3
  getUsers,
);
```

### 4. User Enumeration via Error Messages

❌ **WRONG**: Revealing if email exists

```typescript
// ❌ Security issue!
if (!user) {
  return res.status(404).json({ error: "User not found" });
}
```

✅ **CORRECT**: Generic error message

```typescript
// ✅ Prevents enumeration
if (!user || !(await verifyPassword(password, user.passwordHash))) {
  return res.status(401).json({ error: "Invalid credentials" });
}
```

### 5. No Token Replay Protection

❌ **WRONG**: Allowing unlimited refreshes

```typescript
// ❌ Vulnerable to replay!
const newToken = await generateRefreshToken(user);
return res.json({ refreshToken: newToken });
```

✅ **CORRECT**: Rotate and revoke

```typescript
// ✅ Replay protected
await revokeToken(oldToken);
const newToken = await generateRefreshToken(user);
await storeTokenHash(newToken);
return res.json({ refreshToken: newToken });
```

### 6. Weak JWT Secrets (S4 Violation)

❌ **WRONG**: Short or predictable secrets

```typescript
// ❌ Weak secret!
const JWT_SECRET = "secret123";
```

✅ **CORRECT**: Strong random secrets

```typescript
// ✅ Strong (32+ chars)
const JWT_SECRET = process.env.JWT_ACCESS_SECRET; // S4
// e.g., "8f7d6e5c4b3a2918f7d6e5c4b3a2918f7d6e5c4b3a29"
```

### 7. Missing Rate Limiting on Auth

❌ **WRONG**: No rate limiting

```typescript
// ❌ Brute force vulnerable!
router.post("/api/v1/auth/login", login);
```

✅ **CORRECT**: Rate limited

```typescript
// ✅ Protected
router.post(
  "/api/v1/auth/login",
  authRateLimiter, // 5 req/15min
  login,
);
```

### 8. Not Revoking Sessions on Password Change

❌ **WRONG**: Old sessions remain valid

```typescript
// ❌ Security gap!
await prisma.user.update({
  where: { id },
  data: { passwordHash: newHash },
});
```

✅ **CORRECT**: Revoke all sessions

```typescript
// ✅ Force re-login
await prisma.user.update({
  where: { id },
  data: { passwordHash: newHash },
});
await revokeAllUserSessions(id);
sendPasswordChangedEmail(user);
```

---

## 📦 DELIVERABLES

### Core Services

1. ✅ `apps/backend/src/lib/crypto/password.ts` - Bcrypt utilities
2. ✅ `apps/backend/src/modules/auth/token.service.ts` - JWT management
3. ✅ `apps/backend/src/modules/auth/session.service.ts` - Session management
4. ✅ `apps/backend/src/modules/auth/rbac.service.ts` - RBAC logic
5. ✅ `apps/backend/src/modules/auth/auth.service.ts` - Auth business logic
6. ✅ `apps/backend/src/modules/auth/auth.controller.ts` - Auth endpoints
7. ✅ `apps/backend/src/modules/auth/security-event.service.ts` - Event logging

### Middleware

8. ✅ `apps/backend/src/middleware/auth/deserializeUser.ts` - Token extraction
9. ✅ `apps/backend/src/middleware/auth/requireAuth.ts` - Auth guard
10. ✅ `apps/backend/src/middleware/auth/requireRole.ts` - Role guard
11. ✅ `apps/backend/src/middleware/auth/requirePermission.ts` - Permission guard
12. ✅ `apps/backend/src/middleware/auth/authorizeResource.ts` - Resource authorization
13. ✅ `apps/backend/src/middleware/auth/authRateLimiter.ts` - Auth rate limiting

### Utilities

14. ✅ `apps/backend/src/lib/crypto/token.ts` - Token utilities
15. ✅ `apps/backend/src/lib/crypto/fingerprint.ts` - Device fingerprinting
16. ✅ `apps/backend/src/lib/email/templates/` - Email templates
17. ✅ `apps/backend/src/lib/email/email.service.ts` - Email service

### Validation & DTOs

18. ✅ `apps/backend/src/modules/auth/dto/register.dto.ts` - Register schema
19. ✅ `apps/backend/src/modules/auth/dto/login.dto.ts` - Login schema
20. ✅ `apps/backend/src/modules/auth/dto/reset-password.dto.ts` - Reset schema
21. ✅ `apps/backend/src/modules/auth/dto/change-password.dto.ts` - Change schema

### Routes

22. ✅ `apps/backend/src/modules/auth/auth.routes.ts` - Auth routes
23. ✅ `apps/backend/src/routes/admin.ts` - Admin routes (updated with S3)

### Configuration

24. ✅ `apps/backend/src/config/auth.config.ts` - Auth configuration
25. ✅ `.env.template` - Auth environment variables

### Tests

26. ✅ `apps/backend/src/__tests__/unit/auth/` - Unit tests
27. ✅ `apps/backend/src/__tests__/integration/auth/` - Integration tests
28. ✅ `apps/backend/src/__tests__/security/auth.security.test.ts` - Security tests

### Documentation

29. ✅ `docs/backend/auth/authentication.md` - Auth system docs
30. ✅ `docs/backend/auth/rbac.md` - RBAC documentation
31. ✅ `docs/backend/auth/security.md` - Security features
32. ✅ `docs/backend/auth/rbac-matrix.md` - Roles × Permissions matrix
33. ✅ `docs/backend/auth/token-lifecycle.md` - Token flow diagrams
34. ✅ `docs/backend/auth/troubleshooting.md` - Common issues
35. ✅ `docs/api/auth-endpoints.md` - API documentation
36. ✅ `postman/Lumi-Auth.postman_collection.json` - Postman collection
37. ✅ `PHASE-3-COMPLETION-REPORT.md` - Phase report

---

## 🧪 TESTING STRATEGY

### Test Coverage Requirements

```yaml
Unit Tests:
  password.ts: 100%
  token.service.ts: 95%
  session.service.ts: 95%
  rbac.service.ts: 95%
  auth.service.ts: 90%

Integration Tests:
  All auth endpoints: 100%
  RBAC middleware: 100%
  Security features: 100%

Security Tests:
  S1-S4 compliance: 100%
  Attack scenarios: 100%
```

---

## 📚 OPERATIONAL READINESS

### Runbook

#### User Management

```bash
# Create admin user (via seed or manual)
pnpm --filter @lumi/backend prisma:seed

# Check user roles
SELECT u.email, r.name
FROM "User" u
JOIN "UserRole" ur ON u.id = ur."userId"
JOIN "Role" r ON ur."roleId" = r.id
WHERE u.email = 'admin@lumi.com';

# Unlock locked account
UPDATE "User"
SET "lockoutUntil" = NULL, "failedLoginCount" = 0
WHERE email = 'user@example.com';
```

#### Session Management

```bash
# View active sessions
SELECT
  u.email,
  s.id,
  s."createdAt",
  s."expiresAt",
  s."ipAddress"
FROM "UserSession" s
JOIN "User" u ON s."userId" = u.id
WHERE s."revokedAt" IS NULL;

# Revoke user sessions
UPDATE "UserSession"
SET "revokedAt" = NOW()
WHERE "userId" = 'user-id-here';
```

#### Security Monitoring

```bash
# Check failed logins
SELECT
  type,
  COUNT(*),
  MAX("createdAt") as last_attempt
FROM "SecurityEvent"
WHERE type = 'LOGIN_FAILED'
  AND "createdAt" > NOW() - INTERVAL '1 hour'
GROUP BY type;

# Check token replay attempts
SELECT *
FROM "SecurityEvent"
WHERE type = 'TOKEN_REPLAY_DETECTED'
ORDER BY "createdAt" DESC
LIMIT 10;
```

---

## 📊 PHASE COMPLETION CRITERIA

### Pre-Completion Checklist

- [ ] All 230+ checklist items completed
- [ ] S1: bcrypt with 12+ rounds validated
- [ ] S2: Input sanitization on all auth endpoints
- [ ] S3: Admin routes protected with role check
- [ ] S4: No hardcoded secrets, all in env
- [ ] All auth endpoints working
- [ ] RBAC system functional
- [ ] Token rotation working
- [ ] Replay detection working
- [ ] Email templates created
- [ ] Rate limiting configured
- [ ] Test coverage > 90%
- [ ] All documentation complete
- [ ] Security audit passed
- [ ] Performance benchmarks met

---

**END OF PHASE 3 DOCUMENTATION**

_Last Updated: 2025-10-01_
_Version: 1.0_
_Status: Ready for Implementation_
