# Auth Service

This is the authentication microservice for the monorepo application. It acts as a bridge between your frontend/backend and the Keycloak identity provider, providing endpoints for user authentication and token verification.

## Features

- **Token Issuance:** Issues access and refresh tokens using Keycloak's Resource Owner Password Credentials flow.
- **Token Verification:** Verifies JWT tokens by querying Keycloak's `/userinfo` endpoint.
- **CORS Support:** Configured for local development and production frontend domains.
- **Environment-based Configuration:** All sensitive data and URLs are managed via environment variables.