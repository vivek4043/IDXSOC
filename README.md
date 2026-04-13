# 🛡️ IDXSOC
### AI-Powered Security Operations Platform for Campus Networks

> **Final Year Project** — AI-Driven Threat Detection & Forensic Analytics Platform

---

## 🚀 Quick Start (IDXSOC)

### 1. Start the Backend (IDXSOC Engine + API)

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

### 2. Start the Frontend (IDXSOC Dashboard)

```bash
cd frontend
npm install
npm run dev
```

Open **http://localhost:5173** and login with:
- Username: `admin` | Password: `idxsoc@123`
- Username: `analyst` | Password: `analyst@456`

---

## 🎯 Features

| Feature | Description |
|---|---|
| 🔴 Live Attack Map | World map with real-time attack origin markers |
| 📡 Live Event Stream | SSE-powered scrolling log feed |
| 🤖 IDXSOC Threat Engine | Detects SQLi, XSS, LFI, Brute Force, Scanners, Command Injection |
| 🔍 Investigation Queue | AI-flagged entries with evidence, confidence %, recommendations |
| 📊 Analytics | Charts, heatmaps, radar plots |
| 📁 Log Explorer | Upload Apache/Nginx/Syslog/CSV files for instant analysis |
| 🔐 Auth | Secure login page with role-based access |

## 🤖 AI Detection Rules

| Threat | Method | Severity |
|---|---|---|
| SQL Injection | Regex patterns (UNION SELECT, OR 1=1, SLEEP) | CRITICAL |
| Command Injection | Shell metacharacters (`;`, `|`, backtick) | CRITICAL |
| XSS | `<script>`, `onerror=`, `javascript:` | HIGH |
| Path Traversal / LFI | `../`, `/etc/passwd`, `php://filter` | HIGH |
| Brute Force | >8 POST /login from same IP in 60s | HIGH |
| Scanner Detected | User-Agent: sqlmap, nikto, masscan | HIGH |
| Admin Panel Probe | `/.env`, `/phpmyadmin`, `/.git` | MEDIUM |

## 🏗️ Architecture

```
Frontend (React + Vite)
    ↕ REST API + SSE
Backend (Python FastAPI)
    ├── IDXSOC Engine (regex + statistical scoring)
    ├── Log Parser (Apache / Nginx / Syslog / CSV)
    └── Simulator (80% normal, 20% attack traffic)
```
