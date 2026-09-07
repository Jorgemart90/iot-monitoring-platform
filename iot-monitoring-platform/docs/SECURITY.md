# Demo security model

The portfolio demo intentionally keeps identity management small while applying the same boundaries expected from a production API.

## Roles

- `MASTER`: manages users and can access every device, rule, alert and metric.
- `DEMO`: temporary account with access only to its own data, up to 3 devices and 3 alert rules.

Demo users expire after `SESSION_EXPIRATION` seconds (24 hours by default). Expired users and their owned data are removed automatically.

## Session flow

1. `POST /api/v1/auth/login` authenticates the configured master user.
2. `POST /api/v1/auth/demo` creates a temporary demo account without collecting a password.
3. The API returns a short-lived JWT access token and sets an opaque refresh token in an `HttpOnly`, `SameSite=Lax` cookie.
4. `POST /api/v1/auth/refresh` rotates the refresh token. The stored value is a SHA-256 hash, never the raw token.
5. `POST /api/v1/auth/logout` or `DELETE /api/v1/auth/sessions/:id` revokes the server-side session immediately.

Every HTTP service validates the JWT signature, algorithm, issuer, audience and expiration. It also verifies the server-side session and current user status, so a revoked session cannot continue using an otherwise valid access token.

The master password is hashed with Node.js `scrypt` and a random salt. Master credentials and the JWT secret are supplied through environment variables and must be replaced outside local development.

## Demo isolation

Ownership is enforced in service queries, not only in the future frontend:

- devices have an `ownerId`;
- alert rules have an `ownerId`;
- analytics checks ownership before returning metrics or readings;
- alerts are filtered through their owning rule;
- SSE notifications are delivered only to the owner, while `MASTER` can observe all events.

## Production follow-ups

Before exposing the application publicly, use HTTPS, a managed secrets store, database migrations, distributed rate limiting and asymmetric JWT signing or an external OpenID Connect identity provider.
