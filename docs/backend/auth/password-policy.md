# Password Policy

Lumi enforces an enterprise-grade password policy to comply with S1 requirements. The policy is
implemented in `apps/backend/src/modules/auth/dto/common.ts` and validated on registration, password
change, and password reset.

## Requirements

| Rule              | Default       | Rationale                              |
| ----------------- | ------------- | -------------------------------------- |
| Minimum length    | 12 characters | Aligns with NIST SP 800-63 guidelines. |
| Uppercase         | At least 1    | Prevents all-lowercase phrases.        |
| Lowercase         | At least 1    | Prevents all-uppercase passwords.      |
| Number            | At least 1    | Encourages mixed character classes.    |
| Special character | At least 1    | Mitigates dictionary attacks.          |

Policy constants are defined in `DEFAULT_PASSWORD_POLICY` within `password.ts`. Custom deployments
can override the policy by injecting a different configuration, but values **must not** be weaker
than the defaults without explicit security review.

## Validation Behaviour

- Zod schemas trim whitespace and return clear error messages for each missing requirement.
- Validation errors propagate with `VALIDATION_ERROR` code and
  `error.details.issues[{ path, message }]`.
- Password reuse is blocked in `ChangePasswordRequestSchema` (`newPassword` must differ).

### Example Error Payload

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Registration payload validation failed.",
    "details": {
      "issues": [
        { "path": "password", "message": "Password must contain at least one special character." }
      ]
    }
  }
}
```

## Storage

- Bcrypt hashing with salt rounds ≥ 12 (configurable via `BCRYPT_SALT_ROUNDS`).
- Password hashes stored in `User.passwordHash` only; no plaintext persistence or logs.
- Password reset and verification tokens are also hashed before storage to avoid leakage if the
  database is compromised.

## Operational Guidance

- Encourage passphrase-style passwords (e.g. `CorrectHorse!Battery3Staple`).
- Reset credentials immediately after incident response events (token replay, suspicious access).
- Review password reset volume metrics for potential phishing campaigns.

## Future Enhancements

- Integrate Have I Been Pwned (HIBP) k-anonymity checks.
- Expose password strength meter in client applications using `validatePasswordStrength`.
- Introduce adaptive throttling for repeated password failures beyond the existing lockout policy.
