# HackSMC — pfSense NAT Management Portal

Self-service Web-Portal zur Verwaltung von pfSense NAT Port-Forward-Regeln mit RBAC-Policy-Enforcement.

---

## Features

- **JWT-Authentifizierung** — stateless, HS256
- **NAT-Regeln** — erstellen, löschen, Status-Lifecycle: `PENDING → ACTIVE → DELETED`
- **Policy-Engine** — Protokoll, Port-Bereich, maximale Regelanzahl pro Host
- **Admin-Panel**
  - Benutzerverwaltung (anlegen, löschen, sperren/entsperren, Passwort zurücksetzen)
  - Host & Policy-Verwaltung
  - Globale NAT-Regelübersicht aller User
  - Audit-Log (Login, Regeländerungen, Admin-Aktionen)
  - pfSense-Status-Badge
- **Zwei Datenbank-Modi** — PostgreSQL (Produktion) oder H2 (lokal, kein Server nötig)

---

## Schnellstart

```bash
git clone https://github.com/errkyde/hacksmc.git
cd hacksmc
./start.sh
```

Beim ersten Aufruf wird interaktiv konfiguriert:

```
Wie soll HackSMC betrieben werden?
  1) Entwicklung  — Backend + Frontend direkt starten (kein Build)
  2) Produktion   — JAR bauen, systemd-Dienste einrichten & starten
```

**Entwicklungsmodus** fragt danach nach der Datenbank (PostgreSQL oder H2) und startet Backend + Frontend direkt.

**Produktionsmodus** fragt alle nötigen Parameter ab, baut dann automatisch JAR + Frontend, kopiert die Artefakte nach `/opt/hacksmc/`, generiert HAProxy- und Nginx-Konfigurationen und richtet systemd-Dienste ein.

Die Konfiguration wird in `config.env` gespeichert — beim nächsten Start läuft die App direkt ohne Rückfragen.

**Konfiguration zurücksetzen:**
```bash
./start.sh --reconfigure
```

---

## Voraussetzungen

| Tool | Version |
|------|---------|
| Java | 21 |
| Maven | 3.9+ |
| Node.js | 20+ |
| PostgreSQL | 15+ *(nur bei PostgreSQL-Modus)* |

---

## URLs nach dem Start

| Dienst | URL |
|--------|-----|
| Frontend | http://localhost:5173 |
| Backend API | http://localhost:3000 |
| Swagger UI | http://localhost:3000/api/swagger-ui |
| H2-Konsole | http://localhost:3000/h2-console *(nur H2-Modus)* |

---

## Standard-Zugangsdaten (Seed-Daten)

> Nur im Entwicklungsmodus vorhanden. **In Produktion sofort ändern.**

| Benutzer | Passwort | Rolle |
|----------|----------|-------|
| `admin` | `admin` | ADMIN |
| `phil` | `admin` | USER |

---

## Architektur

```
VPN → HAProxy:443 (TLS, Rate-Limit)
         ├── Nginx:8080      → Frontend (statische Dateien)
         └── Spring Boot:3000 → API
                  └── PostgreSQL:5432 (nur lokal)
Spring Boot → pfSense REST API (HTTPS, NAT-only API Key)
```

### Backend (`backend/`)

Spring Boot 3.4 · Java 21 · Maven

```
src/main/java/com/hacksmc/
├── config/          — SecurityConfig, OpenApiConfig
├── controller/      — Auth, Hosts, NatRules, Policies, Admin
├── dto/             — Request/Response-Records
├── entity/          — User, Host, Policy, NatRule, AuditLog
├── repository/      — Spring Data JPA Repos
├── security/        — JwtUtil, JwtAuthFilter
├── service/         — AuthService, NatRuleService, AdminService,
│                      PolicyEngine, PfSenseApiClient, AuditLogService
└── exception/       — GlobalExceptionHandler, PolicyViolationException
```

**Datenbank-Migrationen** (`src/main/resources/db/migration/`):

| Migration | Inhalt |
|-----------|--------|
| V1 | Schema (users, hosts, policies, nat_rules) |
| V2 | Seed-Daten (admin + demo-User) |
| V3 | Demo-Daten |
| V4 | `users.enabled` — User sperren/entsperren |
| V5 | `audit_log` Tabelle |

### Frontend (`frontend/`)

React 19 · Vite · Tailwind CSS · shadcn/ui · TanStack Query

```
src/
├── components/Layout.tsx    — Navigation, pfSense-Status-Badge
├── hooks/                   — useNatRules, useAdmin, useHosts, ...
├── lib/api.ts               — Axios + JWT-Interceptor (inkl. Ablauf-Check)
└── pages/
    ├── LoginPage.tsx
    ├── DashboardPage.tsx    — Host-Cards mit Regel-Übersicht
    ├── NatRulesPage.tsx     — Regelübersicht mit Status-Filter
    └── AdminPage.tsx        — Tabs: Benutzer | NAT-Regeln | Audit-Log
```

---

## Umgebungsvariablen

Werden in `config.env` gespeichert (nicht im Git).

| Variable | Beschreibung | Standard |
|----------|-------------|---------|
| `DB_MODE` | `postgres` oder `h2` | `postgres` |
| `DB_HOST` | PostgreSQL-Host | `localhost` |
| `DB_NAME` | Datenbankname | `hacksmc` |
| `DB_USER` | Datenbankbenutzer | `hacksmc` |
| `DB_PASSWORD` | Datenbankpasswort | — |
| `JWT_SECRET` | HMAC-SHA256-Key (mind. 32 Zeichen) | — |
| `PFSENSE_BASE_URL` | pfSense-URL | `https://pfsense.local` |
| `PFSENSE_API_KEY` | pfSense REST API Key | — |
| `PFSENSE_TRUST_ALL_CERTS` | TLS-Zertifikat ignorieren | `false` |

---

## Deployment (Produktion)

Einfach `./start.sh` ausführen und **Produktion** wählen. Das Skript erledigt automatisch:

1. Backend-JAR bauen (`mvn package`)
2. Frontend bauen (`npm run build`)
3. Artefakte nach `/opt/hacksmc/` kopieren
4. System-User `hacksmc` anlegen
5. HAProxy- und Nginx-Konfigurationen generieren
6. systemd-Services installieren und aktivieren
7. Alle Dienste starten

**Voraussetzungen für Produktion:**
- `sudo`-Rechte
- `haproxy`, `nginx` installiert
- TLS-Zertifikat als `.pem`-Datei vorhanden

Die Infra-Templates liegen unter `infra/`, die generierten Configs werden nicht eingecheckt:

```
infra/
├── haproxy.cfg.template
├── nginx.conf.template
└── systemd/
    ├── hacksmc-backend.service
    └── hacksmc-frontend.service
```

**Logs:**
```bash
sudo journalctl -u hacksmc-backend -f
sudo journalctl -u hacksmc-frontend -f
```
