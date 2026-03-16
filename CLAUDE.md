# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**HackSMC** — pfSense NAT Management Portal. A self-service web portal for managing pfSense NAT port-forward rules with RBAC policy enforcement.

## Commands

### Backend (Spring Boot)
```bash
cd backend

# Compile
mvn compile

# Run (requires env vars, see below)
mvn spring-boot:run

# Package JAR
mvn package -DskipTests

# Run tests
mvn test

# Single test class
mvn test -Dtest=PolicyEngineTest
```

Required environment variables for the backend:
```
DB_PASSWORD      PostgreSQL password
JWT_SECRET       HS256 key (≥32 chars)
PFSENSE_API_KEY  pfSense REST API key
PFSENSE_BASE_URL https://pfsense.local  (default)
```

### Frontend (React + Vite)
```bash
cd frontend

# Install deps
npm install

# Dev server (proxies /api -> localhost:3000)
npm run dev

# Type-check + build
npm run build

# Preview production build
npm run preview
```

## Architecture

### Backend (`backend/`)

```
src/main/java/com/pfsmc/
├── PfsmcApplication.java
├── config/
│   ├── SecurityConfig.java     — stateless JWT filter chain, CORS
│   └── OpenApiConfig.java      — Swagger UI at /api/swagger-ui
├── security/
│   ├── JwtUtil.java            — sign/validate HMAC-SHA256 tokens
│   └── JwtAuthFilter.java      — extracts Bearer token → SecurityContext
├── entity/                     — JPA entities: User, Host, Policy, NatRule
├── repository/                 — Spring Data repos (one per entity)
├── service/
│   ├── AuthService.java        — login → JWT
│   ├── PolicyEngine.java       — validates protocol, port range, max rules
│   ├── NatRuleService.java     — orchestrates Policy + pfSense + DB
│   └── PfSenseApiClient.java   — Spring RestClient → pfSense REST API
├── controller/                 — REST endpoints (auth, hosts, nat/rules, policies)
├── dto/                        — LoginRequest, LoginResponse, CreateNatRuleRequest
└── exception/
    ├── PolicyViolationException.java  — thrown by PolicyEngine → 403
    └── GlobalExceptionHandler.java    — maps exceptions to RFC 9457 ProblemDetail
```

**Key flow — creating a NAT rule:**
1. `POST /api/nat/rules` hits `NatRuleController`
2. `NatRuleService.createRule()` verifies the host is owned by the authenticated user
3. `PolicyEngine.validateRule()` checks protocol, port range, and active rule count against `Policy`
4. Rule is saved as `PENDING`, then `PfSenseApiClient.createNatRule()` is called
5. On success, status is updated to `ACTIVE` with the pfSense-assigned rule ID

**Database migrations** live in `src/main/resources/db/migration/` (Flyway). Schema validation is enforced at startup (`ddl-auto: validate`).

### Frontend (`frontend/`)

```
src/
├── main.tsx                — entry: QueryClientProvider + BrowserRouter
├── App.tsx                 — routes with ProtectedRoute (checks localStorage token)
├── index.css               — CSS variables (dark theme), dot-grid, Space Mono + DM Sans
├── lib/
│   ├── api.ts              — axios instance with JWT interceptor + 401 redirect
│   ├── queryClient.ts      — TanStack Query client
│   └── utils.ts            — cn() helper
├── hooks/
│   ├── useHosts.ts         — GET /api/hosts
│   ├── useNatRules.ts      — GET/POST/DELETE /api/nat/rules
│   └── usePolicies.ts      — GET /api/policies
├── components/
│   └── Layout.tsx          — top nav (HackSMC brand, nav links, logout)
└── pages/
    ├── LoginPage.tsx        — JWT login, stores token under key "hacksmc_token"
    ├── DashboardPage.tsx    — host cards with rule usage bars and policy info
    └── NatRulesPage.tsx     — rules table, "New Rule" dialog (Radix Dialog),
                               inline delete confirm, toast notifications (Radix Toast)
```

The Vite dev server proxies `/api/*` to `http://localhost:3000`, so no CORS headers are needed during development.

### Deployment topology
```
VPN → HAProxy:443 (TLS, rate-limit)
         ├── Nginx:8080  → frontend static files
         └── Spring Boot:3000  → API
                  └── PostgreSQL:5432 (localhost only)
Spring Boot → pfSense REST API (HTTPS, NAT-only API key)
```

All services run as native systemd units (no Docker).

## Data model

```
User ──< Host ──1 Policy
User ──< NatRule >── Host
```

- A `Policy` is 1:1 with a `Host` and defines: allowed protocols, port range, max concurrent rules.
- `NatRule` status lifecycle: `PENDING → ACTIVE → DELETED`
- All queries are scoped to the authenticated user via `user_id` — there is no shared state between users.
