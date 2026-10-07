# Authentication API

**Version:** `1.0.0`  
**Base URL:** `<BASE_URL>`

A production-oriented authentication and authorization REST API built with Node.js, Express, TypeScript, Prisma, and MariaDB/PostgreSQL.

The API provides user registration, login, access-token authentication, refresh-token handling, password recovery, password reset, user profile retrieval, and logout functionality.

---

## Table of Contents

- [Overview](#overview)
- [Tech Stack](#tech-stack)
- [Authentication Architecture](#authentication-architecture)
- [Token Strategy](#token-strategy)
- [Authorization](#authorization)
- [API Response Format](#api-response-format)
- [Authentication Routes](#authentication-routes)
  - [Register](#1-register)
  - [Login](#2-login)
  - [Refresh Token](#3-refresh-token)
  - [Forgot Password](#4-forgot-password)
  - [Reset Password](#5-reset-password)
  - [Profile](#6-profile)
  - [Logout](#7-logout)
- [Complete Authentication Flow](#complete-authentication-flow)
- [Password Recovery Flow](#password-recovery-flow)
- [HTTP Status Codes](#http-status-codes)
- [Security](#security)
- [Database](#database)
- [Environment Variables](#environment-variables)
- [API Summary](#api-summary)
- [Version](#version)

---

# Overview

This API provides authentication and authorization functionality for applications that require secure user accounts and protected resources.

The backend is written in **TypeScript** and compiled to JavaScript for production execution.

The authentication system uses:

- Short-lived access tokens
- Long-lived refresh tokens
- HTTP-only cookies
- Bearer token authentication
- Database-backed user roles
- Password hashing with Argon2
- Request validation with Zod
- Rate limiting
- Secure HTTP headers
- CORS protection

---

# Tech Stack

| Technology | Purpose |
|---|---|
| Node.js | JavaScript runtime |
| TypeScript | Backend development |
| Express | HTTP server and REST API |
| JSON Web Token | Access and refresh token authentication |
| Prisma | ORM and database access |
| Zod | Request validation |
| Argon2 | Password hashing |
| Cookie Parser | Cookie parsing |
| CORS | Cross-Origin Resource Sharing |
| dotenv | Environment configuration |
| Helmet | HTTP security headers |
| Pino | Application logging |
| Pino HTTP | HTTP request logging |
| Express Rate Limiter | Rate limiting |
| Nodemailer | Password recovery emails |
| MariaDB | Development database |
| PostgreSQL | Production database |

---

# Authentication Architecture

The API uses a combination of **short-lived access tokens** and **long-lived refresh tokens**.

```text
                         Client
                           │
                           │ Login
                           ▼
                    ┌───────────────┐
                    │   /auth/login │
                    └───────┬───────┘
                            │
                 ┌──────────┴──────────┐
                 │                     │
                 ▼                     ▼
          Access Token          Refresh Token
          15 minutes              7 days
                 │                     │
                 │                     ▼
                 │               HTTP-only
                 │                  Cookie
                 │
                 ▼
        Protected API Requests
                 │
                 ▼
        Authorization: Bearer
                 │
                 ▼
           Access Token
            Validation
```

---

# Token Strategy

## Access Token

The access token is:

- Short-lived
- Valid for approximately **15 minutes**
- Sent using the `Authorization` header
- Used to access protected resources

Example:

```http
Authorization: Bearer <access_token>
```

---

## Refresh Token

The refresh token:

- Is valid for approximately **7 days**
- Is always stored as a cookie
- Uses `HttpOnly`
- Uses `SameSite=Lax`
- Is used to obtain a new access token
- Is not intended to be accessed directly by frontend JavaScript

Example cookie configuration:

```text
HttpOnly: true
SameSite: Lax
Max-Age: 7 days
```

For production deployments using HTTPS, the cookie should also use:

```text
Secure: true
```

---

# Authorization

Authorization is based on the user's role stored in the database.

Example:

```text
User
├── id
├── name
├── email
├── password
└── role
```

The authenticated user's role can determine whether they are permitted to access a protected resource.

Example:

```text
Authenticated User
        │
        ▼
    Access Token
        │
        ▼
   User Identity
        │
        ▼
     User Role
        │
        ├── user  ──► User Resources
        │
        └── admin ──► Administrative Resources
```

---

# API Response Format

Successful responses generally follow:

```json
{
  "message": "Operation successful",
  "data": {}
}
```

Error responses generally follow:

```json
{
  "message": "Error message",
  "data": {}
}
```

The `data` property may contain additional validation or error information when applicable.

---

# Authentication Routes

## 1. Register

### Endpoint

```http
POST /auth/register
```

### Description

Creates a new user account.

### Request Headers

```http
Content-Type: application/json
```

### Rate Limit

> Configure according to the application's authentication rate-limiting policy.

### Request Body

```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "StrongPassword123!"
}
```

### Successful Response

**Status:** `201 Created`

```json
{
  "message": "User created successfully",
  "data": {
    "email": "john@example.com",
    "id": "user-id",
    "name": "John Doe"
  }
}
```

### Error Responses

#### Validation Error

**Status:** `400 Bad Request`

Returned when the request does not satisfy the Zod validation schema.

```json
{
  "message": "Validation failed",
  "data": "<validation error>"
}
```

#### User Already Exists

**Status:** `409 Conflict`

```json
{
  "message": "User already exists"
}
```

#### Internal Server Error

**Status:** `500 Internal Server Error`

```json
{
  "message": "Internal server issue"
}
```

---

# 2. Login

### Endpoint

```http
POST /auth/login
```

### Description

Authenticates an existing user and issues an access token and refresh token.

### Request Headers

```http
Content-Type: application/json
```

### Request Body

```json
{
  "email": "john@example.com",
  "password": "StrongPassword123!"
}
```

### Successful Response

**Status:** `200 OK`

```json
{
  "data": {
    "id": "user-id",
    "email": "john@example.com",
    "name": "John Doe"
  },
  "accessToken": "<access_token>"
}
```

The refresh token is sent as an HTTP-only cookie.

Example cookie properties:

```text
HttpOnly: true
SameSite: Lax
Max-Age: 7 days
```

### Error Responses

#### Validation Error

**Status:** `400 Bad Request`

```json
{
  "message": "Validation error",
  "data": "<validation error>"
}
```

#### User Not Found

**Status:** `404 Not Found`

```json
{
  "message": "User not found"
}
```

#### Invalid Password

**Status:** `403 Forbidden`

```json
{
  "message": "Invalid password"
}
```

> `401 Unauthorized` is also a common choice for authentication failures. Keep the status convention consistent throughout the implementation.

---

# 3. Refresh Token

### Endpoint

```http
POST /auth/refresh
```

### Description

Generates a new access token using the refresh token stored in the client's HTTP-only cookie.

### Request Headers

```http
Content-Type: application/json
```

No refresh token needs to be manually added to the request body.

The refresh token is automatically sent through the cookie.

### Successful Response

**Status:** `200 OK`

```json
{
  "accessToken": "<new_access_token>"
}
```

The refresh token remains managed through the HTTP-only cookie according to the server's refresh-token policy.

### Error Response

#### Invalid Refresh Token

**Status:** `403 Forbidden`

```json
{
  "message": "Invalid token"
}
```

---

# 4. Forgot Password

### Endpoint

```http
POST /auth/forgot_password
```

### Description

Starts the password recovery process.

The endpoint generates a password-reset token and sends a password-reset link to the user's registered email address.

### Request Headers

```http
Content-Type: application/json
```

### Request Body

```json
{
  "email": "john@example.com"
}
```

### Rate Limit

> Configure according to the application's password-recovery rate limit.

### Successful Response

**Status:** `200 OK`

The API sends an email containing a frontend password-reset link.

Example:

```text
https://frontend.example.com/reset-password?token=<reset_token>
```

> Password-reset tokens should be short-lived and invalidated after successful use.

---

# 5. Reset Password

### Endpoint

```http
POST /auth/reset_password
```

### Description

Resets a user's password using a valid password-reset token.

### Request Body

```json
{
  "password": "NewStrongPassword123!",
  "resetToken": "<reset_token>"
}
```

### Password Reset Process

1. Receive the new password and reset token.
2. Validate the request.
3. Verify the reset token.
4. Check token expiration.
5. Hash the new password using Argon2.
6. Update the user's password.
7. Invalidate the password-reset token.

### Successful Response

**Status:** `200 OK`

```json
{
  "message": "Password reset successfully"
}
```

---

# 6. Profile

### Endpoint

```http
GET /auth/profile
```

### Authentication

Requires a valid access token.

```http
Authorization: Bearer <access_token>
```

The authentication middleware may also support cookie-based access-token retrieval if implemented by the application.

### Description

Returns information about the currently authenticated user.

### Successful Response

**Status:** `200 OK`

```json
{
  "message": "User authenticated",
  "user": {
    "email": "john@example.com",
    "createdAt": "2026-10-07T12:00:00.000Z",
    "loggedInAt": "2026-10-07T18:30:00.000Z",
    "name": "John Doe"
  }
}
```

---

# 7. Logout

### Endpoint

```http
POST /auth/logout
```

### Description

Terminates the current authenticated session.

The logout operation invalidates the relevant authentication state and clears/nullifies the refresh-token information.

The refresh-token cookie is also cleared.

### Successful Response

**Status:** `200 OK`

```json
{
  "message": "Logged out successfully"
}
```

---

# Protected Route Authentication

Protected routes require authentication.

The API uses the Bearer authentication scheme for access tokens.

```http
Authorization: Bearer <access_token>
```

The access token has a lifetime of approximately:

```text
15 minutes
```

The refresh token has a lifetime of approximately:

```text
7 days
```

The refresh token is always handled through an HTTP-only cookie.

---

# Complete Authentication Flow

```text
                     ┌──────────────┐
                     │    Client    │
                     └──────┬───────┘
                            │
                       Register
                            │
                            ▼
                    ┌───────────────┐
                    │ /auth/register│
                    └───────┬───────┘
                            │
                            ▼
                         Database
                            │
                            │
                         Login
                            │
                            ▼
                     ┌──────────────┐
                     │ /auth/login  │
                     └──────┬───────┘
                            │
                 ┌──────────┴──────────┐
                 │                     │
                 ▼                     ▼
           Access Token          Refresh Token
             15 min                 7 days
                 │                     │
                 │                HTTP-only
                 │                   Cookie
                 │
                 ▼
          Protected Routes
                 │
                 │ Access Token
                 ▼
          /auth/profile
                 │
                 ▼
          Authenticated User


Access Token Expired
        │
        ▼
 /auth/refresh
        │
        ▼
 New Access Token
        │
        ▼
 Continue API Requests
```

---

# Password Recovery Flow

```text
User
 │
 │ Forgot Password
 ▼
/auth/forgot_password
 │
 ▼
Generate Reset Token
 │
 ▼
Send Email
 │
 ▼
Frontend Reset Page
 │
 ▼
/auth/reset_password
 │
 ▼
Verify Token
 │
 ▼
Hash New Password
 │
 ▼
Update User
```

---

# HTTP Status Codes

| Status Code | Meaning |
|---|---|
| `200` | Request successful |
| `201` | Resource successfully created |
| `400` | Invalid request / validation failure |
| `401` | Authentication required or missing |
| `403` | Forbidden / invalid authentication credentials |
| `404` | Resource or user not found |
| `409` | Resource conflict |
| `429` | Too many requests |
| `500` | Internal server error |

---

# Security

The API implements several security mechanisms.

## Password Hashing

Passwords are hashed using **Argon2** before being stored in the database.

Plaintext passwords are never stored.

## Access Tokens

Access tokens are short-lived and expire after approximately 15 minutes.

## Refresh Tokens

Refresh tokens are:

- Stored in HTTP-only cookies
- Limited to approximately 7 days
- Not exposed to client-side JavaScript
- Used to obtain new access tokens

## Cookies

Refresh-token cookies use:

```text
HttpOnly: true
SameSite: Lax
```

For production HTTPS deployments:

```text
Secure: true
```

## Request Validation

Incoming request data is validated using Zod before being processed.

## Rate Limiting

Authentication-sensitive endpoints are rate-limited to reduce abuse and brute-force attempts.

## HTTP Security Headers

Helmet is used to configure security-related HTTP headers.

## CORS

Cross-Origin Resource Sharing is configured to restrict requests to trusted frontend origins.

## CSRF Consideration

Because the refresh token is stored in a cookie, CSRF protection should be considered for state-changing endpoints in production.

Recommended protections include:

- Appropriate `SameSite` cookie configuration
- Strict CORS origin validation
- CSRF tokens where required by the deployment architecture
- HTTPS
- Avoiding unnecessary cookie-based authentication for state-changing operations

---

# Database

## Development

The development environment uses:

```text
MariaDB
```

## Production

The production environment uses:

```text
PostgreSQL
```

Prisma provides the database abstraction layer.

```text
Express
   │
   ▼
Services
   │
   ▼
Prisma
   │
   ├── Development → MariaDB
   │
   └── Production  → PostgreSQL
```

---

# Environment Variables

Example environment configuration:

```env
PORT=5000

DATABASE_URL=""

JWT_ACCESS_SECRET=""
JWT_REFRESH_SECRET=""

ACCESS_TOKEN_EXPIRES_IN="15m"
REFRESH_TOKEN_EXPIRES_IN="7d"

CLIENT_URL=""

NODE_ENV="development"

SMTP_HOST=""
SMTP_PORT=""
SMTP_USER=""
SMTP_PASSWORD=""
```

Never commit real credentials or secrets to the repository.

Use an `.env.example` file to document required environment variables.

---

# Production Security Checklist

Before deploying:

- [ ] Use HTTPS.
- [ ] Set refresh-token cookies to `Secure`.
- [ ] Use strong, randomly generated JWT secrets.
- [ ] Never expose refresh tokens to frontend JavaScript.
- [ ] Use short-lived access tokens.
- [ ] Apply rate limiting to authentication endpoints.
- [ ] Validate all incoming request data.
- [ ] Never expose password hashes.
- [ ] Never expose refresh tokens in JSON responses.
- [ ] Restrict CORS to trusted origins.
- [ ] Configure CSRF protection where required.
- [ ] Keep dependencies updated.
- [ ] Store secrets using environment variables or a secrets manager.
- [ ] Do not commit `.env`.
- [ ] Use production database credentials.
- [ ] Use secure logging that does not record passwords or tokens.

---

# API Summary

| Method | Endpoint | Authentication | Description |
|---|---|---|---|
| `POST` | `/auth/register` | Public | Create a new user |
| `POST` | `/auth/login` | Public | Authenticate user |
| `POST` | `/auth/refresh` | Refresh Cookie | Generate a new access token |
| `POST` | `/auth/forgot_password` | Public | Start password recovery |
| `POST` | `/auth/reset_password` | Reset Token | Set a new password |
| `GET` | `/auth/profile` | Access Token | Get authenticated user |
| `POST` | `/auth/logout` | Authenticated | End current session |

---

# Recommended Project Files

A production repository should include:

```text
.
├── README.md
├── .env.example
├── .gitignore
├── package.json
├── pnpm-lock.yaml
├── tsconfig.json
├── prisma/
│   └── schema.prisma
└── src/
    ├── config/
    ├── controllers/
    ├── middleware/
    ├── routes/
    ├── services/
    ├── utils/
    ├── app.ts
    └── server.ts
```

The exact structure may vary depending on the implementation.

---

# Git Security

Never commit:

```text
.env
node_modules/
dist/
*.log
```

Recommended `.gitignore` entries:

```gitignore
node_modules/
dist/
.env
.env.*
!.env.example
*.log
```

Never commit:

- JWT secrets
- Database passwords
- SMTP passwords
- API keys
- Private keys
- Refresh tokens
- User passwords

---

# Development

Install dependencies:

```bash
pnpm install
```

Run the development server:

```bash
pnpm dev
```

Build the project:

```bash
pnpm build
```

Run the production build:

```bash
pnpm start
```

Generate Prisma Client:

```bash
pnpm prisma generate
```

Run Prisma migrations:

```bash
pnpm prisma migrate dev
```

Open Prisma Studio:

```bash
pnpm prisma studio
```

---

# API Testing

Authentication endpoints should be tested for:

- User registration
- Duplicate email registration
- Invalid registration data
- Password hashing
- Successful login
- Invalid password
- Non-existent user
- Access-token expiration
- Refresh-token validation
- Refresh-token expiration
- Logout
- Protected profile access
- Password recovery
- Invalid reset token
- Expired reset token
- Password reset
- Rate limiting
- CORS behavior
- Authorization by user role

---

# Version

**API Version:** `1.0.0`

**Authentication:** Bearer Access Token + HTTP-only Refresh Token Cookie

**Access Token Lifetime:** `15 minutes`

**Refresh Token Lifetime:** `7 days`

**Development Database:** MariaDB

**Production Database:** PostgreSQL
