# 🛡️ IDXSOC
### AI-Powered Security Operations Platform for Campus Networks

> **Final Year Project** — AI-Driven Threat Detection & Forensic Analytics Platform

---

## ⚡ Quick Start

### 1. Configure environment

```bash
cd backend
cp .env.example .env
# Open .env and fill in your MongoDB URI, admin password, SMTP/Slack values
```

### 2. Start the Backend

```bash
# Create and activate virtual environment (Kali/Debian — required)
python3 -m venv .venv
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Run the API server
uvicorn main:app --reload --port 8000
```

### 3. Start the Frontend

```bash
cd frontend
npm install
npm run dev
```

Open **http://localhost:5173** — login with the credentials you set in `SEED_ADMIN_USER` / `SEED_ADMIN_PASSWORD` inside `backend/.env`.

> **Demo analyst accounts** (`analyst`, `j.chen`, `s.patel`) — default password: `changeme`.  
> Change passwords via the Admin Panel after first login.

---

## 🎯 Features

| Feature | Description |
|---|---|
| 🔴 Live Attack Map | World map with real-time attack origin markers |
| 📡 Live Event Stream | SSE-powered scrolling log feed |
| 🤖 AI Threat Engine | Detects SQLi, XSS, LFI, Brute Force, Scanners, Command Injection |
| 🔍 Investigation Queue | AI-flagged entries with evidence, confidence %, recommendations |
| 📊 Analytics | Charts, heatmaps, radar plots |
| 📁 Log Explorer | Upload Apache/Nginx/Syslog/CSV files for instant analysis |
| 🔐 Auth | Secure login page with role-based access control |
| 🗄️ Persistent Storage | MongoDB Atlas with TTL-based auto-expiry |

---

## 🤖 AI Detection Rules

| Threat | Method | Severity |
|---|---|---|
| SQL Injection | Regex patterns (UNION SELECT, OR 1=1, SLEEP) | CRITICAL |
| Command Injection | Shell metacharacters (`;`, `\|`, backtick) | CRITICAL |
| XSS | `<script>`, `onerror=`, `javascript:` | HIGH |
| Path Traversal / LFI | `../`, `/etc/passwd`, `php://filter` | HIGH |
| Brute Force | >8 POST /login from same IP in 60s | HIGH |
| Scanner Detected | User-Agent: sqlmap, nikto, masscan | HIGH |
| Admin Panel Probe | `/.env`, `/phpmyadmin`, `/.git` | MEDIUM |

---

## 🏗️ Architecture

```
Frontend (React + Vite)  →  http://localhost:5173
    ↕ REST API + SSE
Backend (Python FastAPI)  →  http://localhost:8000
    ├── AI Engine   (regex + statistical scoring)
    ├── Log Parser  (Apache / Nginx / Syslog / CSV)
    ├── Simulator   (80% normal, 20% attack traffic)
    └── Database    (MongoDB Atlas via Motor async driver)
```

---

## 🔐 Security Notes

- Passwords are stored as **bcrypt hashes** (cost factor 12) — never plain text
- All secrets are loaded from `backend/.env` — never hardcoded in source
- `backend/.env` is listed in `.gitignore` and will never be committed
- TTL index auto-deletes logs and threats after `DATA_RETENTION_DAYS` days
- Connection strings and tokens are masked in all log output

---

## 🔬 Test MongoDB Connection

```bash
cd backend
source .venv/bin/activate
python test_mongo.py
```
