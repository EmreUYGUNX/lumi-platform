# User Management API

The User Management API powers customer-facing profile operations and administrator tooling for managing accounts. All endpoints follow the Q2 response contract and require authentication unless explicitly marked as public.

## Customer Endpoints

| Method   | Path                                            | Description                                                                            |
| -------- | ----------------------------------------------- | -------------------------------------------------------------------------------------- |
| `GET`    | `/api/v1/users/me`                              | Retrieve the authenticated user's profile, addresses, and preferences.                 |
| `PUT`    | `/api/v1/users/me`                              | Update profile fields (`firstName`, `lastName`, `phone`).                              |
| `PUT`    | `/api/v1/users/me/password`                     | Change account password (delegates to AuthService; revokes other sessions).            |
| `GET`    | `/api/v1/users/me/addresses`                    | List saved addresses sorted by default flag.                                           |
| `POST`   | `/api/v1/users/me/addresses`                    | Create address (first address auto-default).                                           |
| `PUT`    | `/api/v1/users/me/addresses/:addressId`         | Update an address owned by the user.                                                   |
| `DELETE` | `/api/v1/users/me/addresses/:addressId`         | Delete address; soft-deletes when referenced by active orders.                         |
| `PUT`    | `/api/v1/users/me/addresses/:addressId/default` | Atomically mark address as default.                                                    |
| `GET`    | `/api/v1/users/me/preferences`                  | Fetch localisation, notification, and marketing preferences.                           |
| `PUT`    | `/api/v1/users/me/preferences`                  | Update language, currency, notification channels, marketing consent, privacy settings. |

All customer routes enforce the customer rate limit (120 requests / 5 minutes per user/IP). Audit events are emitted for profile, address, and preference mutations.

## Admin Endpoints

| Method | Path                             | Description                                                                            |
| ------ | -------------------------------- | -------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `GET`  | `/api/v1/admin/users?format=json | csv`                                                                                   | Paginated user listing with filtering by status, role, search term. CSV export capped at 2,000 rows. |
| `GET`  | `/api/v1/admin/users/:id`        | Detailed user profile plus metrics (order count, last order) and recent audit entries. |
| `PUT`  | `/api/v1/admin/users/:id/status` | Update account status (`ACTIVE`, `SUSPENDED`, `DELETED`).                              |
| `POST` | `/api/v1/admin/users/:id/unlock` | Reset failed login counters, clear lockout, force status to `ACTIVE`.                  |

Admin routes require the `admin` role and are throttled at 300 requests / 5 minutes per operator. Each mutation logs an audit event with the acting administrator's ID and IP.

## Response Examples

**Profile Success**

```json
{
  "success": true,
  "data": {
    "user": {
      "id": "cly2y1l8c0001abcxyz",
      "email": "user@example.com",
      "firstName": "Ada",
      "lastName": "Lovelace",
      "status": "ACTIVE",
      "emailVerified": true,
      "roles": [],
      "permissions": [],
      "createdAt": "2025-02-18T10:00:00.000Z",
      "updatedAt": "2025-02-18T10:00:00.000Z",
      "twoFactorEnabled": false
    },
    "addresses": [
      {
        "id": "cly2y1l8c0003abcxyz",
        "label": "Home",
        "fullName": "Ada Lovelace",
        "line1": "10 Downing St",
        "city": "London",
        "country": "GB",
        "isDefault": true,
        "createdAt": "2025-02-18T10:00:00.000Z",
        "updatedAt": "2025-02-18T10:00:00.000Z"
      }
    ],
    "preferences": {
      "id": "cly2y1l8c0005abcxyz",
      "language": "tr-TR",
      "currency": "TRY",
      "marketingOptIn": false,
      "notifications": { "email": true, "sms": false, "push": false },
      "privacy": {
        "personalisedRecommendations": false,
        "dataSharing": false,
        "profileVisibility": "customers"
      },
      "createdAt": "2025-02-18T10:00:00.000Z",
      "updatedAt": "2025-02-18T10:05:00.000Z"
    }
  },
  "meta": {
    "requestId": "b2d7c760-75a6-4b2d-8ec7-5c4e2d61b52f",
    "timestamp": "2025-02-18T10:05:01.000Z"
  }
}
```

**Validation Error**

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request parameters",
    "details": [{ "field": "language", "message": "Language must follow IETF BCP-47 (eg. tr-TR)." }]
  },
  "meta": { "requestId": "..." }
}
```

## Notes

- All bodies validated with Zod; unknown fields are stripped.
- Address deletions fall back to soft-delete when referenced by active orders to preserve history.
- Preference updates automatically create a record on first access for backwards compatibility.
- CSV exports escape fields to comply with Excel/Sheets ingestion.
