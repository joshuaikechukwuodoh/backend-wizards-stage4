# API Documentation | Insighta Labs+

The Insighta Labs+ API is versioned and follows RESTful principles. All protected endpoints require a Bearer JWT token in the `Authorization` header.

## 🏁 Base URLs
- **Production**: `https://backend-wizards-stage3.vercel.app/api/v1`
- **Development**: `http://localhost:3000/api/v1`

## 🔐 Authentication Endpoints
### 1. Initiate GitHub Login
`GET /auth/github?redirect_to=URL`
- Redirects to GitHub for authorization.
- Query Parameter `redirect_to`: The URL to redirect back to after successful login (optional).

### 2. GitHub Callback
`GET /auth/callback?code=CODE&state=STATE`
- Handled internally to exchange code for JWT tokens.
- Alias: `GET /auth/github/callback`

### 3. Refresh Token
`POST /auth/refresh`
- Request Body: `{ "refresh_token": "UUID" }`
- Returns a new short-lived access token.

### 4. Logout
`POST /auth/logout`
- Request Body: `{ "refresh_token": "UUID" }`
- Revokes the refresh token and clears session data.

## 👤 User Endpoints
### 1. Get Current User
`GET /users/me`
- Requires Authentication.
- Returns the profile of the currently logged-in user.

## 📊 Profile Endpoints
### 1. List Profiles
`GET /profiles?page=1&limit=10`
- Requires Authentication.
- Supports pagination.

### 2. Natural Language Search
`GET /profiles/search?q=QUERY`
- Requires Authentication.
- Example Queries: `young males`, `adults from Nigeria`, `females from Kenya`.

### 3. Export CSV
`GET /profiles/export`
- **Requires Admin Role**.
- Returns a CSV file containing all profile data.

## 🛡 Security Features
- **Rate Limiting**: Applied globally and per-endpoint.
- **CORS**: Configured to allow specific origins.
- **RBAC**: Role-Based Access Control enforced on critical endpoints.
- **PKCE**: Implemented for the OAuth 2.0 flow.
- **CSRF**: Enforced on the web portal dashboard.

## 🔢 Error Codes
- `400`: Bad Request (Invalid parameters or query).
- `401`: Unauthorized (Missing or invalid token).
- `403`: Forbidden (Insufficient permissions / Wrong role).
- `404`: Not Found.
- `405`: Method Not Allowed.
- `429`: Too Many Requests.
- `500`: Internal Server Error.
