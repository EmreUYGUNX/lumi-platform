if (!process.env.JWT_SECRET || process.env.JWT_SECRET === "") {
  process.env.JWT_SECRET = "test-secret-placeholder-32-chars!!";
}

if (!process.env.JWT_ACCESS_SECRET || process.env.JWT_ACCESS_SECRET === "") {
  process.env.JWT_ACCESS_SECRET = "test-access-secret-placeholder-32-chars!!";
}

if (!process.env.JWT_REFRESH_SECRET || process.env.JWT_REFRESH_SECRET === "") {
  process.env.JWT_REFRESH_SECRET = "test-refresh-secret-placeholder-32-chars!!";
}

if (!process.env.JWT_ACCESS_TTL || process.env.JWT_ACCESS_TTL === "") {
  process.env.JWT_ACCESS_TTL = "900";
}

if (!process.env.JWT_REFRESH_TTL || process.env.JWT_REFRESH_TTL === "") {
  process.env.JWT_REFRESH_TTL = `${14 * 24 * 60 * 60}`;
}

if (!process.env.COOKIE_DOMAIN || process.env.COOKIE_DOMAIN === "") {
  process.env.COOKIE_DOMAIN = "localhost";
}

if (!process.env.COOKIE_SECRET || process.env.COOKIE_SECRET === "") {
  process.env.COOKIE_SECRET = "test-cookie-secret-placeholder-32-chars!!";
}

if (!process.env.EMAIL_VERIFICATION_TTL || process.env.EMAIL_VERIFICATION_TTL === "") {
  process.env.EMAIL_VERIFICATION_TTL = `${24 * 60 * 60}`;
}

if (!process.env.PASSWORD_RESET_TTL || process.env.PASSWORD_RESET_TTL === "") {
  process.env.PASSWORD_RESET_TTL = `${60 * 60}`;
}

if (!process.env.SESSION_FINGERPRINT_SECRET || process.env.SESSION_FINGERPRINT_SECRET === "") {
  process.env.SESSION_FINGERPRINT_SECRET = "test-fingerprint-secret-placeholder-32-chars!!";
}

if (!process.env.LOCKOUT_DURATION || process.env.LOCKOUT_DURATION === "") {
  process.env.LOCKOUT_DURATION = "900";
}

if (!process.env.MAX_LOGIN_ATTEMPTS || process.env.MAX_LOGIN_ATTEMPTS === "") {
  process.env.MAX_LOGIN_ATTEMPTS = "5";
}

export {};
