# 🛡️ IDXSOC
### AI-Powered Security Operations Centre for Campus Networks

> **Final Year Project** — Real-time AI-driven threat detection, forensic analytics, and user management platform built for campus network environments.

---

## 📋 Table of Contents

- [Features](#-features)
- [Architecture](#-architecture)
- [Tech Stack](#-tech-stack)
- [Quick Start](#-quick-start)
- [Environment Variables](#-environment-variables)
- [Default Accounts](#-default-accounts)
- [API Reference](#-api-reference)
- [AI Detection Rules](#-ai-detection-rules)
- [Campus Network Zones](#-campus-network-zones)
- [Security Notes](#-security-notes)
- [Project Structure](#-project-structure)

---

## ✨ Features

### 🔴 Real-Time Monitoring
| Feature | Description |
|---|---|
| 📡 **Live Event Stream** | SSE-powered scrolling log feed with instant threat highlighting |
| 🎯 **Top Attackers Panel** | Live table of highest-threat source IPs with subnet zone classification |
| 🏫 **Campus Network Zones** | Dual event/threat bar chart per VLAN/subnet (Staff, Student, Lab, etc.) |
| 📈 **Activity Trend** | 12-hour area chart showing normal vs. threat traffic volume |

### 🤖 AI Threat Engine
| Feature | Description |
|---|---|
| 🔍 **Pattern Detection** | Regex + statistical rules for SQLi, XSS, LFI, Brute Force, Scanners |
| 📊 **Confidence Scoring** | Every threat scored 0–100% with evidence and recommendation |
| 🧾 **Investigation Queue** | AI-flagged entries with one-click resolve / escalate actions |
| 📁 **Log File Analysis** | Upload Apache, Nginx, Syslog, or CSV files for instant AI scan |

### 🔐 Authentication & User Management
| Feature | Description |
|---|---|
| 🪙 **JWT Auth** | Real token-based login — no demo tokens; tokens expire after 8 hours |
| 🔑 **Password Hashing** | bcrypt (cost 12) — plain text passwords never stored or logged |
| 🔒 **Forced Password Change** | Analyst accounts must change password on first login |
| 👤 **User Profile Menu** | Change password from any page via Topbar avatar dropdown |
| 🛡️ **Role-Based Access** | `admin` and `analyst` roles; admin-only routes protected on both sides |
| ➕ **User Creation** | Admin creates users with generated temp passwords (shown once, never stored) |
| 🔄 **Password Reset** | Admin can reset any user's password — new temp password returned once |

### 🗄️ Data & Storage
| Feature | Description |
|---|---|
| 🍃 **MongoDB Atlas** | All logs, threats, and users persisted in cloud Atlas cluster |
| ⏰ **Auto-Expiry (TTL)** | Logs and threats auto-deleted after `DATA_RETENTION_DAYS` days |
| 📊 **Analytics** | Charts, severity breakdowns, attack category totals, subnet distribution |
| 🧑‍💼 **Audit Log** | Admin panel for viewing system audit history |

### ⚙️ Admin Panel
- **User Management** — Create, edit, enable/disable users; generate temp passwords
- **Detection Rules** — Enable/disable threat rules, edit regex patterns, adjust severity
- **Whitelists** — Whitelist trusted IPs, user-agents, or URL paths
- **System Settings** — Configure alert thresholds and platform preferences
- **Audit Log** — Full history of admin actions

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────┐
│                 IDXSOC Platform                         │
│                                                         │
│  Frontend (React 18 + Vite)  →  http://(open URL link)  │
│  ┌──────────────────────────────────────────────────┐   │
│  │  Login  →  Dashboard  →  Investigation           │   │
│  │  LogExplorer  Analytics  Admin Panel             │   │
│  └──────────────────────────────────────────────────┘   │
│                   ↕  REST API + SSE                     │
│  Backend (Python FastAPI)  →  http:// URL               │
│  ┌──────────────────────────────────────────────────┐   │
│  │  AI Engine   (regex + scoring rules)             │   │
│  │  Log Parser  (Apache/Nginx/Syslog/CSV)           │   │
│  │  Simulator   (80% normal, 20% attack traffic)    │   │
│  │  Auth        (JWT + bcrypt)                      │   │
│  │  Alerting    (SMTP / Slack — configurable)       │   │
│  └──────────────────────────────────────────────────┘   │
│                   ↕  Motor async driver                 │
│  MongoDB Atlas (Cloud)                                  │
│  ┌──────────────────────────────────────────────────┐   │
│  │  logs  ·  threats  ·  users  ·  audit            │   │
│  └──────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 18, Vite, Recharts, Lucide React |
| **Backend** | Python 3.13, FastAPI, Uvicorn |
| **Database** | MongoDB Atlas (Motor async driver) |
| **Auth** | JWT (`python-jose`), bcrypt (cost 12) |
| **AI Engine** | Custom regex + statistical rule engine |
| **Alerting** | SMTP (Mailtrap-compatible), Slack Webhooks |
| **Styling** | Vanilla CSS (dark SOC theme, JetBrains Mono) |

---

## ⚡ Quick Start

### 1. Clone & Configure

```bash
git clone https://github.com/vivek4043/IDXSOC.git
cd IDXSOC

# Copy the example env and fill in your values
cp backend/.env.example backend/.env
```

Edit `backend/.env` — the minimum required fields are:

```env
MONGO_URI=mongodb+srv://<user>:<password>@<cluster>.mongodb.net/
MONGO_DB_NAME=idxsoc
SEED_ADMIN_USERNAME=admin
SEED_ADMIN_PASSWORD=YourSecurePasswordHere
JWT_SECRET=<run: python3 -c "import secrets; print(secrets.token_hex(32))">
```

### 2. Start the Backend

```bash
cd backend

# Create and activate virtual environment
python3 -m venv .venv
source .venv/bin/activate          # Linux / macOS
# .venv\Scripts\activate           # Windows

# Install dependencies
pip install -r requirements.txt

# Run the API server
uvicorn main:app --reload --port 8000
```

> On first startup, the platform **automatically seeds** the users collection and 200 demo log entries into MongoDB. Subsequent restarts skip seeding (fully idempotent).

### 3. Start the Frontend

```bash
cd frontend
npm install
npm run dev
```

Open **http://localhost:**** and log in with the admin credentials you set in `.env`.

### 4. Test MongoDB Connection (optional)

```bash
cd backend
source .venv/bin/activate
python test_mongo.py
```

---

## 🔧 Environment Variables

All variables are in `backend/.env`. Copy from `backend/.env.example`.

| Variable | Required | Description |
|---|---|---|
| `MONGO_URI` | ✅ | Full MongoDB Atlas SRV connection string |
| `MONGO_DB_NAME` | ✅ | Database name (default: `idxsoc`) |
| `DATA_RETENTION_DAYS` | — | TTL days for log/threat auto-deletion (default: `15`) |
| `SEED_ADMIN_USERNAME` | ✅ | Admin account username seeded on first run |
| `SEED_ADMIN_PASSWORD` | ✅ | Admin account password (bcrypt-hashed on write) |
| `JWT_SECRET` | ✅ | 64-char hex secret for signing JWTs |
| `JWT_EXPIRE_HOURS` | — | Token lifetime in hours (default: `8`) |
| `SMTP_HOST` | — | SMTP server hostname (e.g. `sandbox.smtp.mailtrap.io`) |
| `SMTP_PORT` | — | SMTP port (default: `2525`) |
| `SMTP_USERNAME` | — | SMTP login username |
| `SMTP_PASSWORD` | — | SMTP login password |
| `ALERT_RECIPIENT` | — | Email for threat alerts — **leave blank to disable** |
| `SLACK_WEBHOOK` | — | Slack incoming webhook URL — **leave blank to disable** |
| `EMAIL_PROVIDER` | — | `smtp` or `mailtrap` |
| `MAILTRAP_TOKEN` | — | Mailtrap API token (if using API mode) |

---

## 👥 Default Accounts

On first startup, the following accounts are seeded automatically:

| Username | Role | Must Change Password | Notes |
|---|---|---|---|
| *(from `SEED_ADMIN_USERNAME`)* | `admin` | No | Set credentials in `.env` |
| `analyst` | `analyst` | **Yes** | Temp password: `cha#####` |
| `j.chen` | `analyst` | **Yes** | Temp password: `cha#####` |
| `s.patel` | `analyst` | **Yes** | Temp password: `cha#####` |
| `m.rivera` | `analyst` (inactive) | **Yes** | Temp password: `cha#####` |

> ⚠️ Analyst accounts with `must_change_password = true` are gated behind the **Change Password** page on first login. They cannot access the dashboard until a new password is set.

---

## 📡 API Reference

### Authentication

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/api/auth/login` | Public | Verify credentials, return JWT + user info |
| `GET` | `/api/auth/me` | Bearer | Return logged-in user profile |
| `POST` | `/api/auth/change-password` | Bearer | Update password, clear `must_change_password` |

### User Management (Admin only)

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/api/users` | Bearer | List all users (no password hashes) |
| `POST` | `/api/users` | Admin | Create user — returns one-time temp password |
| `PUT` | `/api/users/{id}` | Admin | Update name / role |
| `PUT` | `/api/users/{id}/status` | Admin | Toggle active / inactive |
| `POST` | `/api/admin/users/{id}/reset-password` | Admin | Generate new temp password |

### Data & Analytics

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/stats` | Dashboard stats (events, threats, subnets, top IPs, trend) |
| `GET` | `/api/logs` | Paginated log list with filters (ip, severity, flagged, search) |
| `GET` | `/api/alerts` | Paginated threat/alert list with filters |
| `POST` | `/api/alerts/{id}/resolve` | Mark a threat as resolved |
| `GET` | `/api/live-feed` | SSE stream of real-time log events |
| `POST` | `/api/upload` | Upload log file for AI analysis |
| `GET` | `/api/health/db` | Database health check |

### Admin Panel APIs

| Method | Endpoint | Description |
|---|---|---|
| `GET/PUT` | `/api/rules` | List / update detection rules |
| `GET/POST/DELETE` | `/api/whitelists` | Manage IP / UA / path whitelists |
| `GET/PUT` | `/api/settings` | Read / write system settings |
| `GET` | `/api/audit` | Paginated audit log |

---

## 🤖 AI Detection Rules

| Threat | Detection Method | Severity |
|---|---|---|
| **SQL Injection** | Regex: `UNION SELECT`, `OR 1=1`, `SLEEP()`, `DROP TABLE` | CRITICAL |
| **Command Injection** | Shell metacharacters: `;`, `\|`, backtick, `&&` | CRITICAL |
| **XSS** | `<script>`, `onerror=`, `javascript:`, `alert(` | HIGH |
| **Path Traversal / LFI** | `../`, `/etc/passwd`, `php://filter`, `boot.ini` | HIGH |
| **Brute Force** | > 8 POST `/login` from same IP within 60 seconds | HIGH |
| **Scanner Detected** | User-Agent: `sqlmap`, `nikto`, `masscan`, `nmap` | HIGH |
| **Admin Probe** | `/.env`, `/phpmyadmin`, `/.git`, `/wp-admin` | MEDIUM |

Rules can be **enabled/disabled, severity-adjusted, and regex-edited** live from the Admin Panel → Detection Rules page.

---

## 🏫 Campus Network Zones

The dashboard **Campus Network Zones** panel classifies traffic by subnet:

| Subnet Prefix | Zone Label | Typical Use |
|---|---|---|
| `192.168.1.x` | Staff LAN | Faculty/staff offices |
| `192.168.0.x` | Student WiFi | General campus WiFi |
| `192.168.2.x` | Admin Network | Administrative systems |
| `10.0.x.x` | Lab Network | Computer labs |
| `10.10.x.x` | IoT / CCTV | Cameras and IoT devices |
| `172.16.x.x` | Server VLAN | Internal servers |
| `172.17.x.x` | Container Net | Docker / virtualised services |
| *(anything else)* | **External** ⚠️ | Internet — highlighted in red |

> Subnet definitions are in `backend/main.py` (`_CAMPUS_SUBNETS`) and can be customised to match your real campus VLAN layout.

---

## 🔐 Security Notes

- **Passwords**: stored exclusively as `bcrypt` hashes (cost factor 12) — never plain text, never logged
- **JWT**: tokens signed with `JWT_SECRET` from `.env`; expire after `JWT_EXPIRE_HOURS` hours
- **Secrets**: all credentials loaded from `backend/.env` via `python-dotenv` — never hardcoded in source
- **`.env` protection**: `backend/.env` is listed in `.gitignore` and has no entry in git history
- **Push protection**: GitHub Advanced Security scans are enabled; all prior secret patterns have been removed
- **TTL expiry**: MongoDB automatically deletes logs and threats after `DATA_RETENTION_DAYS` days
- **Temp passwords**: generated with `secrets.token_urlsafe(12)` — returned once to admin, never stored in plain text
- **Inactive accounts**: users with `status: inactive` are rejected at the JWT verification layer

---

## 📁 Project Structure

```
IDXSOC/
├── backend/
│   ├── .env                  # 🔒 Local secrets — NEVER commit
│   ├── .env.example          # Template with safe placeholder values
│   ├── requirements.txt      # Python dependencies
│   ├── main.py               # FastAPI app — routes, auth, JWT, stats
│   ├── database.py           # MongoDB connection, helpers, user ops, seeding
│   ├── ai_engine.py          # Threat detection rules engine
│   ├── log_parser.py         # Apache / Nginx / Syslog / CSV parser
│   ├── simulator.py          # Demo traffic generator (80/20 normal/attack)
│   ├── alerting.py           # SMTP and Slack alert dispatcher
│   └── test_mongo.py         # Connection health check script
│
└── frontend/
    └── src/
        ├── api.js                    # Central apiFetch() with JWT Bearer
        ├── App.jsx                   # Router, auth gate, change-password gate
        ├── pages/
        │   ├── Login.jsx             # Binary rain login screen
        │   ├── ChangePassword.jsx    # Forced password change (first login)
        │   ├── Dashboard.jsx         # Main SOC dashboard
        │   ├── Investigation.jsx     # Threat investigation queue
        │   ├── LogExplorer.jsx       # Searchable log table + file upload
        │   ├── Analytics.jsx         # Charts and trend analytics
        │   └── admin/
        │       ├── UserManagement.jsx   # Create/edit/reset users
        │       ├── DetectionRules.jsx   # Rule editor
        │       ├── Whitelists.jsx       # IP/UA/path whitelist manager
        │       ├── SystemSettings.jsx   # Platform config
        │       └── AuditLog.jsx         # Admin audit history
        └── components/
            ├── Sidebar.jsx          # Navigation sidebar with RBAC links
            ├── Topbar.jsx           # Clock, user avatar, change-password dropdown
            ├── LiveFeed.jsx         # SSE-powered real-time event ticker
            ├── SeverityBadge.jsx    # Colour-coded severity pill
            ├── ThreatCard.jsx       # Investigation threat card
            ├── AdminRoute.jsx       # Route guard for admin-only pages
            └── Clock.jsx            # Live date/time display
```

---

## 📄 Licence

This project is licensed under the Apache License 2.0.

Note: Older versions were licensed under the MIT License.

