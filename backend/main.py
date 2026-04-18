"""
IDXSOC — FastAPI Backend
"""
import asyncio
import bcrypt
import json
import logging
import os
import random
import secrets
from collections import defaultdict
from contextlib import asynccontextmanager
from datetime import datetime, timedelta
from typing import Optional

from dotenv import load_dotenv
from fastapi import Depends, FastAPI, File, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from jose import JWTError, jwt

from ai_engine import analyze_log_entry, FAKE_GEO, RULES, WHITELISTS
from alerting import dispatch_alert
from log_parser import parse_log_content
from simulator import generate_batch
import database

load_dotenv()

# ── JWT config ─────────────────────────────────────────────────────
JWT_SECRET    = os.getenv("JWT_SECRET", "")
JWT_ALGORITHM = "HS256"
JWT_EXPIRE_H  = int(os.getenv("JWT_EXPIRE_HOURS", "8"))

if not JWT_SECRET:
    import warnings
    warnings.warn(
        "JWT_SECRET is not set in .env! Using an insecure random secret. "
        "All tokens will be invalidated on restart.",
        stacklevel=2,
    )
    JWT_SECRET = secrets.token_hex(32)   # ephemeral fallback


logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s — %(message)s",
)
logger = logging.getLogger("idxsoc.main")


# ── Helpers ────────────────────────────────────────────────────────────────────
def _parse_timestamp(ts_str: str) -> datetime:
    """
    Try to parse an ISO-8601 timestamp string into a datetime object.
    Falls back to utcnow() if the string is malformed.
    """
    try:
        return datetime.fromisoformat(ts_str.replace("Z", "+00:00")).replace(tzinfo=None)
    except Exception:
        return datetime.utcnow()


def _fake_geo_for(ip: str) -> dict:
    """Return a deterministic fake geo dict for a given IP."""
    if ip.startswith("192.168."):
        return {"country": "India (Campus)", "code": "IN", "lat": 20.59, "lon": 78.96}
    return FAKE_GEO[hash(ip) % len(FAKE_GEO)]


def _hourly_trend(logs: list[dict]) -> list[dict]:
    """Build a 24-bucket hourly event/alert count from a list of log dicts."""
    now = datetime.utcnow()
    buckets: dict[str, dict] = {}
    for h in range(23, -1, -1):
        label = (now - timedelta(hours=h)).strftime("%H:00")
        buckets[label] = {"normal": 0, "alerts": 0}

    for entry in logs:
        try:
            ts_raw = entry.get("timestamp") or entry.get("created_at", "")
            ts = _parse_timestamp(str(ts_raw)) if isinstance(ts_raw, str) else ts_raw
            if isinstance(ts, datetime):
                diff = (now - ts).total_seconds() / 3600
                if diff <= 24:
                    label = ts.strftime("%H:00")
                    if label in buckets:
                        key = "alerts" if entry.get("flagged") else "normal"
                        buckets[label][key] += 1
        except Exception:
            pass

    return [{"hour": k, **v} for k, v in buckets.items()]


# ── Core pipeline: analyse + persist ──────────────────────────────────────────
async def _add_entry(entry: dict) -> dict:
    """
    Run AI analysis on a raw log entry, write to MongoDB, dispatch alerts.

    Log document written to `logs` collection:
        ip, method, status, request, user_agent, source, timestamp (str),
        created_at (datetime), flagged (bool),
        severity, threat_name, threat_id, confidence, evidence, recommendation
        (all None/absent when not flagged)

    Threat document written to `threats` collection (flagged entries only):
        created_at, timestamp (datetime), ip,
        threat_name, threat_id, severity, confidence, evidence, recommendation,
        matched_rule, icon, category,
        status ("open"), resolved (False), resolved_at (None), resolved_by (None),
        log_entry (full original dict for frontend merge)
    """
    now = datetime.utcnow()
    ts_str = entry.get("timestamp", now.isoformat())
    ts_dt  = _parse_timestamp(ts_str)

    analysis = analyze_log_entry(entry)

    if analysis:
        td = analysis.to_dict()   # ThreatAnalysis fields as flat dict

        # ── Enrich the log document ───────────────────────────────────────────
        log_doc = {
            **entry,
            "created_at":     now,
            "timestamp":      ts_str,           # keep original string in log
            "flagged":        True,
            "severity":       td["severity"],
            "threat_name":    td["threat_name"],
            "threat_id":      td["threat_id"],
            "confidence":     td["confidence"],
            "evidence":       td["evidence"],
            "recommendation": td["recommendation"],
            "threat":         td,               # nested copy for backward-compat
        }

        # ── Threat document (separate collection) ─────────────────────────────
        threat_doc = {
            "created_at":     now,
            "timestamp":      ts_dt,            # datetime for TTL safety
            "ip":             entry.get("ip", "unknown"),
            "threat_name":    td["threat_name"],
            "threat_id":      td["threat_id"],
            "severity":       td["severity"],
            "category":       td.get("category", ""),
            "confidence":     td["confidence"],
            "evidence":       td["evidence"],
            "recommendation": td["recommendation"],
            "matched_rule":   td["matched_rule"],
            "icon":           td.get("icon", "🚨"),
            "status":         "open",
            "resolved":       False,
            "resolved_at":    None,
            "resolved_by":    None,
            "escalated":      False,
            "log_entry":      entry,            # raw entry for frontend merge
        }

        try:
            await database.insert_log(log_doc)
            await database.insert_threat(threat_doc)
        except Exception as exc:
            logger.error("DB write (threat) failed: %s", exc)

        # ── External alerting ─────────────────────────────────────────────────
        result = dispatch_alert(
            threat          = td,
            log_entry       = entry,
            email_recipient = SETTINGS.get("emailAlert", ""),
            slack_webhook   = SETTINGS.get("slackWebhook", ""),
        )
        if result.get("email_sent") or result.get("slack_sent"):
            logger.info(
                "Alert dispatched: %s from %s — email=%s slack=%s",
                td["threat_name"], entry.get("ip"),
                result["email_sent"], result["slack_sent"],
            )

        # Return enriched entry so SSE / upload callers get the full picture
        entry.update({
            "flagged":  True,
            "threat":   td,
            "severity": td["severity"],
        })

    else:
        log_doc = {
            **entry,
            "created_at": now,
            "timestamp":  ts_str,
            "flagged":    False,
            "threat":     None,
        }
        try:
            await database.insert_log(log_doc)
        except Exception as exc:
            logger.error("DB write (log) failed: %s", exc)

        entry.update({"flagged": False, "threat": None})

    return entry


# ── One-time demo seed ─────────────────────────────────────────────────────────
async def _seed_if_empty() -> None:
    """
    Insert 200 simulated historical entries ONLY when the logs collection is
    completely empty. On every subsequent restart the seed is skipped entirely
    so existing data is never wiped or duplicated.
    """
    try:
        count = await database.logs_col().count_documents({}, limit=1)
        if count > 0:
            logger.info("Database already has data — skipping seed.")
            return

        logger.info("Empty database detected — seeding 200 demo entries …")
        batch = generate_batch(200)
        seeded_logs = 0
        seeded_threats = 0
        for entry in batch:
            await _add_entry(entry)
            seeded_logs += 1
            if entry.get("flagged"):
                seeded_threats += 1

        logger.info(
            "Seed complete: %d logs, %d threats inserted.",
            seeded_logs, seeded_threats,
        )
    except Exception as exc:
        logger.error("Seed failed (non-fatal): %s", exc)


# ── Lifespan ───────────────────────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Connect to MongoDB, ensure indexes, seed if empty, then serve."""
    db_ok = await database.ping_database()
    if not db_ok:
        logger.warning(
            "MongoDB connection failed on startup — check MONGO_URI in .env. "
            "App will start in degraded mode."
        )
    else:
        await database.seed_users_if_empty()   # users collection (idempotent)
        await _seed_if_empty()                  # logs / threats demo data
    yield
    database.close_database()



# ── App ────────────────────────────────────────────────────────────────────────
app = FastAPI(title="IDXSOC API", version="2.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Settings — loaded from environment so no secrets are hardcoded ───────────
SETTINGS: dict = {
    "retentionDays": int(os.getenv("DATA_RETENTION_DAYS", "15")),
    "emailAlert":    os.getenv("ALERT_RECIPIENT", ""),
    "slackWebhook":  os.getenv("SLACK_WEBHOOK", ""),
}


# ══════════════════════════════════════════════════════════════════════════════
# AUTH
# ══════════════════════════════════════════════════════════════════════════════
# ─────────────────────────────────────────────────────────────────────────────
# JWT HELPERS
# ─────────────────────────────────────────────────────────────────────────────
def _create_token(user_id: str, username: str, role: str) -> str:
    expire = datetime.utcnow() + timedelta(hours=JWT_EXPIRE_H)
    return jwt.encode(
        {"sub": user_id, "username": username, "role": role, "exp": expire},
        JWT_SECRET, algorithm=JWT_ALGORITHM,
    )


async def get_current_user(request: Request) -> dict:
    """
    FastAPI dependency that reads and verifies the Bearer token.
    Returns the full user document (without password_hash).
    Raises HTTP 401 on missing / invalid / expired tokens.
    """
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid Authorization header")

    token = auth[7:].strip()
    if not token:
        raise HTTPException(status_code=401, detail="Token is empty")

    # Basic structural check: JWT should have 2 dots
    if token.count(".") != 2:
        # Log suspected corruption (e.g. string "undefined" or "null" from JS)
        if token in ("undefined", "null"):
            logger.warning("Frontend sent literal string '%s' as token", token)
        else:
            logger.warning("Malformed token received (dots=%d, length=%d)", token.count("."), len(token))
        raise HTTPException(status_code=401, detail="Token is malformed (invalid structure)")

    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id: str = payload.get("sub", "")
        if not user_id:
            raise HTTPException(401, "Token payload invalid: missing sub")
    except JWTError as exc:
        raise HTTPException(status_code=401, detail=f"Token error: {exc}")

    user = await database.find_user_by_id(user_id)
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    if user.get("status") == "inactive":
        raise HTTPException(status_code=403, detail="Account disabled")
    # Strip hash before returning to route handlers
    user.pop("password_hash", None)
    return user


async def require_admin(current_user: dict = Depends(get_current_user)) -> dict:
    """Dependency: identical to get_current_user but also checks role == admin."""
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin role required")
    return current_user


# ─────────────────────────────────────────────────────────────────────────────
# AUTH ENDPOINTS
# ─────────────────────────────────────────────────────────────────────────────
@app.post("/api/auth/login")
async def login(body: dict):
    """Verify credentials against MongoDB, issue JWT."""
    username     = (body.get("username") or "").strip()
    raw_password = body.get("password") or ""

    user = await database.find_user_by_username(username)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    if user.get("status") == "inactive":
        raise HTTPException(status_code=403, detail="Account disabled")

    stored_hash = user.get("password_hash", "")
    if not stored_hash or not bcrypt.checkpw(raw_password.encode(), stored_hash.encode()):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    # Update last_login (non-blocking, best-effort)
    try:
        await database.update_user_last_login(user["id"])
    except Exception:
        pass

    token = _create_token(user["id"], username, user.get("role", "analyst"))
    return {
        "success": True,
        "token":   token,
        "user": {
            "id":                  user["id"],
            "username":            username,
            "full_name":           user.get("full_name", ""),
            "role":                user.get("role", "analyst"),
            "must_change_password": user.get("must_change_password", False),
        },
    }


@app.get("/api/auth/me")
async def auth_me(current_user: dict = Depends(get_current_user)):
    """Return the current user's profile from the JWT."""
    return {
        "id":                  current_user["id"],
        "username":            current_user.get("username"),
        "full_name":           current_user.get("full_name", ""),
        "role":                current_user.get("role"),
        "must_change_password": current_user.get("must_change_password", False),
        "last_login":          current_user.get("last_login"),
    }


@app.post("/api/auth/change-password")
async def change_password(
    body: dict,
    current_user: dict = Depends(get_current_user),
):
    """
    Update the authenticated user's password.
    Body: { current_password, new_password }
    Clears must_change_password on success.
    """
    current_pw = body.get("current_password") or ""
    new_pw     = body.get("new_password") or ""

    if not new_pw or len(new_pw) < 8:
        raise HTTPException(400, "New password must be at least 8 characters")

    # Re-fetch from DB so we have the hash
    full_user = await database.find_user_by_username(current_user["username"])
    stored_hash = full_user.get("password_hash", "") if full_user else ""

    # must_change_password users may use a temp password (no current_pw check skipped)
    if not full_user.get("must_change_password"):
        if not current_pw:
            raise HTTPException(400, "current_password required")
        if not bcrypt.checkpw(current_pw.encode(), stored_hash.encode()):
            raise HTTPException(401, "Current password is incorrect")

    new_hash = bcrypt.hashpw(new_pw.encode(), bcrypt.gensalt(12)).decode()
    await database.update_user_password(current_user["id"], new_hash)
    return {"success": True, "message": "Password updated successfully"}


# ─────────────────────────────────────────────────────────────────────────────
# USER MANAGEMENT (Admin Panel) — all backed by MongoDB
# ─────────────────────────────────────────────────────────────────────────────
@app.get("/api/users")
async def get_users(current_user: dict = Depends(get_current_user)):
    """List all platform users (no password_hash returned)."""
    return await database.get_all_users()


@app.post("/api/users")
async def create_user(
    body: dict,
    _admin: dict = Depends(require_admin),
):
    """
    Create a new user with a generated temporary password.
    Returns the temp password ONCE in the response — never stored or logged.
    """
    username  = (body.get("username") or "").strip()
    full_name = (body.get("name") or body.get("full_name") or "").strip()
    role      = body.get("role", "analyst")

    if not username:
        raise HTTPException(400, "username required")
    if await database.find_user_by_username(username):
        raise HTTPException(400, "Username already exists")

    temp_pw = secrets.token_urlsafe(12)   # e.g. "xK8mNd2pQvLr"
    pw_hash = bcrypt.hashpw(temp_pw.encode(), bcrypt.gensalt(12)).decode()

    user_id = await database.create_user_in_db({
        "username":             username,
        "full_name":            full_name,
        "role":                 role,
        "status":               "active",
        "password_hash":        pw_hash,
        "must_change_password": True,
    })
    user = await database.find_user_by_id(user_id)
    return {
        "success":        True,
        "user":           user,
        "temp_password":  temp_pw,   # shown once to admin, never persisted
    }


@app.put("/api/users/{user_id}")
async def update_user(
    user_id: str,
    body: dict,
    _admin: dict = Depends(require_admin),
):
    """Update a user's full_name and/or role."""
    fields: dict = {}
    if "name" in body:      fields["full_name"] = body["name"]
    if "full_name" in body: fields["full_name"] = body["full_name"]
    if "role"     in body:  fields["role"]      = body["role"]
    if not fields:
        raise HTTPException(400, "Nothing to update")
    updated = await database.update_user_fields(user_id, fields)
    if not updated:
        raise HTTPException(404, "User not found")
    user = await database.find_user_by_id(user_id)
    return {"success": True, "user": user}


@app.put("/api/users/{user_id}/status")
async def toggle_user_status(
    user_id: str,
    _admin: dict = Depends(require_admin),
):
    """Toggle a user's status between active / inactive."""
    user = await database.find_user_by_id(user_id)
    if not user:
        raise HTTPException(404, "User not found")
    new_status = "inactive" if user.get("status") == "active" else "active"
    await database.update_user_fields(user_id, {"status": new_status})
    return {"success": True, "status": new_status}


@app.post("/api/admin/users/{user_id}/reset-password")
async def reset_user_password(
    user_id: str,
    _admin: dict = Depends(require_admin),
):
    """
    Generate a new temporary password for any user.
    Admin NEVER sees the old password — only the new one-time temp.
    User will be forced to change it on next login.
    """
    user = await database.find_user_by_id(user_id)
    if not user:
        raise HTTPException(404, "User not found")

    temp_pw = secrets.token_urlsafe(12)
    pw_hash = bcrypt.hashpw(temp_pw.encode(), bcrypt.gensalt(12)).decode()

    # Manually set must_change_password = True here (update_user_password clears it)
    from database import users_col
    from bson import ObjectId
    await users_col().update_one(
        {"_id": ObjectId(user_id)},
        {"$set": {"password_hash": pw_hash, "must_change_password": True}},
    )
    logger.info("Password reset for user_id=%s by admin", user_id)
    return {
        "success":       True,
        "username":      user.get("username"),
        "temp_password": temp_pw,   # returned once; store nowhere
    }


# ══════════════════════════════════════════════════════════════════════════════
# RULES & WHITELISTS (Admin Panel)
# ══════════════════════════════════════════════════════════════════════════════
@app.get("/api/rules")
async def get_rules():
    return RULES


@app.put("/api/rules/{rule_id}/toggle")
async def toggle_rule(rule_id: str):
    for rule in RULES:
        if rule["id"] == rule_id:
            rule["enabled"] = not rule.get("enabled", True)
            return {"success": True, "enabled": rule["enabled"]}
    raise HTTPException(404, "Rule not found")


@app.put("/api/rules/{rule_id}/severity")
async def update_rule_severity(rule_id: str, body: dict):
    severity = body.get("severity")
    if not severity:
        raise HTTPException(400, "Severity required")
    for rule in RULES:
        if rule["id"] == rule_id:
            rule["severity"] = severity
            return {"success": True, "severity": rule["severity"]}
    raise HTTPException(404, "Rule not found")


@app.put("/api/rules/{rule_id}/patterns")
async def update_rule_patterns(rule_id: str, body: dict):
    patterns = body.get("patterns")
    if not isinstance(patterns, list):
        raise HTTPException(400, "Patterns list required")
    for rule in RULES:
        if rule["id"] == rule_id:
            rule["patterns"] = patterns
            return {"success": True, "patterns": rule["patterns"]}
    raise HTTPException(404, "Rule not found")


@app.get("/api/whitelists")
async def get_whitelists():
    return WHITELISTS


@app.put("/api/whitelists")
async def update_whitelists(body: dict):
    if "ips"  in body: WHITELISTS["ips"]  = body["ips"]
    if "urls" in body: WHITELISTS["urls"] = body["urls"]
    return {"success": True, "whitelists": WHITELISTS}


# ══════════════════════════════════════════════════════════════════════════════
# SETTINGS
# ══════════════════════════════════════════════════════════════════════════════
@app.get("/api/settings")
async def get_settings():
    return SETTINGS


@app.put("/api/settings")
async def update_settings(body: dict):
    for key in ("retentionDays", "emailAlert", "slackWebhook"):
        if key in body:
            SETTINGS[key] = body[key]
    return {"success": True, "settings": SETTINGS}


# ══════════════════════════════════════════════════════════════════════════════
# ANALYTICS — /api/stats
# ══════════════════════════════════════════════════════════════════════════════

# Campus subnet definitions — map CIDR prefix → human label + colour hint
_CAMPUS_SUBNETS = [
    ("192.168.1.",  "Staff LAN",      "#4ade80"),
    ("192.168.0.",  "Student WiFi",   "#22d3ee"),
    ("192.168.2.",  "Admin Network",  "#a78bfa"),
    ("10.0.",       "Lab Network",    "#fb923c"),
    ("10.10.",      "IoT / CCTV",     "#f472b6"),
    ("172.16.",     "Server VLAN",    "#facc15"),
    ("172.17.",     "Container Net",  "#94a3b8"),
]

def _classify_subnet(ip: str) -> tuple[str, str]:
    """Return (label, color) for an IP address, falling back to 'External'."""
    for prefix, label, color in _CAMPUS_SUBNETS:
        if ip.startswith(prefix):
            return label, color
    return "External", "#ff4757"


@app.get("/api/stats")
async def get_stats():
    try:
        all_logs    = await database.get_recent_logs(limit=5000)
        all_threats = await database.get_all_threats(limit=5000)
    except Exception as exc:
        logger.error("/api/stats DB read: %s", exc)
        all_logs, all_threats = [], []

    total    = len(all_logs)
    flagged  = len(all_threats)
    resolved = sum(1 for t in all_threats if t.get("resolved"))
    pending  = max(0, flagged - resolved)

    sev_counts:    dict = defaultdict(int)
    cat_counts:    dict = defaultdict(int)
    ip_counts:     dict = defaultdict(int)
    ip_threats:    dict = defaultdict(int)   # threat count per IP
    ip_last_seen:  dict = {}

    # ── Subnet buckets: { label: {color, events, threats} } ──
    subnet_events:  dict = defaultdict(int)
    subnet_threats: dict = defaultdict(int)
    subnet_colors:  dict = {}

    # Count events per subnet from all logs
    for log in all_logs:
        ip = log.get("ip", "?")
        label, color = _classify_subnet(ip)
        subnet_events[label]  += 1
        subnet_colors[label]   = color

    for t in all_threats:
        sev_counts[t.get("severity", "UNKNOWN")] += 1
        cat_counts[t.get("category", "Other")]   += 1
        log_e = t.get("log_entry", t)
        ip    = log_e.get("ip", t.get("ip", "?"))
        ip_counts[ip]  += 1
        ip_threats[ip] += 1

        # Subnet threat count
        label, color = _classify_subnet(ip)
        subnet_threats[label] += 1
        subnet_colors[label]   = color

        # Track latest seen
        ts = t.get("created_at") or t.get("timestamp")
        if ts and (ip not in ip_last_seen or ts > ip_last_seen[ip]):
            ip_last_seen[ip] = ts

    top_ips = sorted(ip_counts.items(), key=lambda x: -x[1])[:10]
    top_ips = [
        {
            "ip":           ip,
            "count":        c,
            "threat_count": ip_threats.get(ip, 0),
            "last_seen":    ip_last_seen.get(ip),
            "subnet":       _classify_subnet(ip)[0],
            "geo":          _fake_geo_for(ip),
        }
        for ip, c in top_ips
    ]

    # Build subnet breakdown list sorted by threat count desc
    all_subnet_labels = set(subnet_events) | set(subnet_threats)
    subnet_breakdown = sorted([
        {
            "label":   label,
            "color":   subnet_colors.get(label, "#64748b"),
            "events":  subnet_events.get(label, 0),
            "threats": subnet_threats.get(label, 0),
        }
        for label in all_subnet_labels
    ], key=lambda x: -x["threats"])

    return {
        "total_events":          total,
        "total_alerts":          flagged,
        "resolved":              resolved,
        "pending_investigation": pending,
        "severity_breakdown":    dict(sev_counts),
        "category_breakdown":    dict(cat_counts),
        "top_attacking_ips":     top_ips,
        "subnet_breakdown":      subnet_breakdown,
        "hourly_trend":          _hourly_trend(all_logs),
        "live":                  True,
    }


# ══════════════════════════════════════════════════════════════════════════════
# LOGS — /api/logs
# Response shape kept identical to previous version for frontend compatibility.
# ══════════════════════════════════════════════════════════════════════════════
@app.get("/api/logs")
async def get_logs(
    page:         int           = 1,
    limit:        int           = 50,
    ip:           Optional[str] = None,
    severity:     Optional[str] = None,
    flagged_only: bool          = False,
    search:       Optional[str] = None,
):
    try:
        data = await database.get_recent_logs(
            limit=5000,
            only_threats=flagged_only,
        )
    except Exception as exc:
        logger.error("/api/logs DB read: %s", exc)
        raise HTTPException(503, "Database unavailable")

    if ip:
        data = [d for d in data if d.get("ip", "").startswith(ip)]
    if severity:
        data = [d for d in data
                if (d.get("threat") or {}).get("severity") == severity.upper()
                or d.get("severity") == severity.upper()]
    if search:
        s = search.lower()
        data = [d for d in data
                if s in (d.get("request", "") + " " + d.get("ip", "")).lower()]

    total = len(data)
    start = (page - 1) * limit
    return {
        "total": total,
        "page":  page,
        "limit": limit,
        "data":  data[start: start + limit],
    }


# ══════════════════════════════════════════════════════════════════════════════
# ALERTS / INVESTIGATION — /api/alerts
# Response shape kept identical; resolved state now read from MongoDB.
# ══════════════════════════════════════════════════════════════════════════════
@app.get("/api/alerts")
async def get_alerts(
    page:     int            = 1,
    limit:    int            = 30,
    severity: Optional[str] = None,
    resolved: Optional[bool] = None,
):
    try:
        data = await database.get_all_threats(
            resolved=resolved,
            severity=severity,
            limit=5000,
        )
    except Exception as exc:
        logger.error("/api/alerts DB read: %s", exc)
        raise HTTPException(503, "Database unavailable")

    # ── THREAT_FIELDS re-assembled into nested dict for ThreatCard ────────────
    # ThreatCard.jsx reads: alert.threat.severity / .icon / .threat_name /
    #   .evidence / .recommendation / .confidence / .escalated
    # Dashboard.jsx reads:  a.threat?.icon  a.threat?.threat_name  a.threat?.severity
    _THREAT_FIELDS = (
        "threat_name", "threat_id", "severity", "category",
        "confidence", "evidence", "recommendation", "icon",
        "matched_rule", "escalated",
    )

    out = []
    for t in data:
        # log_entry provides the raw HTTP fields the frontend meta row needs:
        # ip, method, request, status, bytes, source, user_agent, geo, timestamp
        log_e  = t.pop("log_entry", {})

        # Start from log_entry, then overlay scalar threat-doc fields
        record = {**log_e}
        for k, v in t.items():
            # Always take these fields from the threat document (not the log copy)
            if k in (
                "id", "resolved", "escalated", "status",
                "severity", "threat_name", "threat_id",
                "confidence", "evidence", "recommendation",
                "matched_rule", "icon", "category",
                "created_at", "resolved_at", "resolved_by",
            ) or k not in record:
                record[k] = v

        # ── `id` must be the MongoDB ObjectId string ──────────────────────────
        # ThreatCard calls POST /api/alerts/{alert.id}/resolve|escalate
        # mark_threat_resolved() handles ObjectId lookups — keep it consistent.
        record["id"] = t.get("id") or log_e.get("id", "")

        # ── Reconstruct nested `threat` dict ──────────────────────────────────
        if any(record.get(f) for f in _THREAT_FIELDS):
            record["threat"] = {f: record.get(f) for f in _THREAT_FIELDS}
            record["flagged"] = True
        else:
            # Fall back to whatever the log_entry stored
            if not record.get("threat"):
                record["threat"] = log_e.get("threat")
            record["flagged"] = record.get("flagged", False)

        out.append(record)

    total = len(out)
    start = (page - 1) * limit
    return {
        "total": total,
        "page":  page,
        "limit": limit,
        "data":  out[start: start + limit],
    }


@app.post("/api/alerts/{alert_id}/resolve")
async def resolve_alert(alert_id: str):
    """Mark a threat as resolved in MongoDB (persists across restarts)."""
    updated = await database.mark_threat_resolved(alert_id, resolved_by="analyst")
    if not updated:
        logger.warning("resolve_alert: no DB document matched id=%s", alert_id)
    return {"success": True, "id": alert_id}


@app.post("/api/alerts/{alert_id}/escalate")
async def escalate_alert(alert_id: str):
    """Escalate a threat to CRITICAL, update in DB, re-dispatch notifications."""
    try:
        from bson import ObjectId
        filters = [{"id": alert_id}, {"log_entry.id": alert_id}]
        try:
            filters.insert(0, {"_id": ObjectId(alert_id)})
        except Exception:
            pass

        doc = await database.threats_col().find_one({"$or": filters})
        if doc:
            await database.threats_col().update_one(
                {"_id": doc["_id"]},
                {"$set": {"severity": "CRITICAL", "escalated": True, "status": "escalated"}},
            )
            threat_payload = {**doc, "severity": "CRITICAL", "escalated": True}
            dispatch_alert(
                threat          = threat_payload,
                log_entry       = doc.get("log_entry", {}),
                email_recipient = SETTINGS.get("emailAlert", ""),
                slack_webhook   = SETTINGS.get("slackWebhook", ""),
            )
    except Exception as exc:
        logger.error("/escalate failed: %s", exc)
    return {"success": True, "id": alert_id}


@app.post("/api/test-alert")
async def test_alert():
    """Trigger a test alert to verify email/Slack configuration."""
    sample_threat = {
        "threat_id": "TEST-001", "threat_name": "Test Alert",
        "severity":  "LOW",      "category":    "Test",
        "confidence": 1.0,
        "evidence":  'Matched pattern in: "...test-alert-endpoint...',
        "recommendation": "This is a test. No action required.",
        "icon": "🧪", "matched_rule": "TEST-001",
    }
    sample_entry = {
        "ip": "127.0.0.1",
        "timestamp": datetime.utcnow().isoformat(),
        "method": "GET", "request": "/api/test-alert",
    }
    result = dispatch_alert(
        threat          = sample_threat,
        log_entry       = sample_entry,
        email_recipient = SETTINGS.get("emailAlert", ""),
        slack_webhook   = SETTINGS.get("slackWebhook", ""),
    )
    return {"success": True, "results": result}


# ══════════════════════════════════════════════════════════════════════════════
# GEO ATTACKS
# ══════════════════════════════════════════════════════════════════════════════
@app.get("/api/geo-attacks")
async def get_geo_attacks():
    try:
        threats = await database.get_all_threats(limit=2000)
    except Exception as exc:
        logger.error("/api/geo-attacks DB read: %s", exc)
        raise HTTPException(503, "Database unavailable")

    geo_agg: dict = defaultdict(lambda: {"count": 0, "lat": 0, "lon": 0, "country": "", "code": ""})
    for t in threats:
        log_e = t.get("log_entry", t)
        ip    = log_e.get("ip", t.get("ip", ""))
        geo   = log_e.get("geo") or _fake_geo_for(ip)
        key   = geo.get("country", "Unknown")
        geo_agg[key]["count"]   += 1
        geo_agg[key]["lat"]      = geo.get("lat", 0)
        geo_agg[key]["lon"]      = geo.get("lon", 0)
        geo_agg[key]["country"]  = key
        geo_agg[key]["code"]     = geo.get("code", "?")

    return list(geo_agg.values())


# ══════════════════════════════════════════════════════════════════════════════
# LOG FILE UPLOAD
# ══════════════════════════════════════════════════════════════════════════════
@app.post("/api/upload-log")
async def upload_log(file: UploadFile = File(...)):
    content = await file.read()
    try:
        text = content.decode("utf-8", errors="replace")
    except Exception:
        raise HTTPException(400, "Could not decode file")

    entries = parse_log_content(text, file.filename or "")
    added = threats_found = 0

    for entry in entries[:2000]:
        processed = await _add_entry(entry)
        added += 1
        if processed.get("flagged"):
            threats_found += 1

    return {
        "success":        True,
        "filename":       file.filename,
        "entries_parsed": added,
        "threats_found":  threats_found,
        "message":        f"Parsed {added} log entries. AI detected {threats_found} threats.",
    }


# ══════════════════════════════════════════════════════════════════════════════
# LIVE FEED (Server-Sent Events)
# ══════════════════════════════════════════════════════════════════════════════
@app.get("/api/live-feed")
async def live_feed():
    async def event_stream():
        while True:
            batch = generate_batch(random.randint(1, 3))
            for entry in batch:
                processed = await _add_entry(entry)
                yield f"data: {json.dumps(processed, default=str)}\n\n"
            await asyncio.sleep(1.0)

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


# ══════════════════════════════════════════════════════════════════════════════
# HEALTH
# ══════════════════════════════════════════════════════════════════════════════
@app.get("/api/health")
async def health():
    db_ok = await database.ping_database()
    return {
        "status":   "ok" if db_ok else "degraded",
        "database": "connected" if db_ok else "unreachable",
        "version":  "2.0.0",
        "project":  "IDXSOC",
    }


@app.get("/api/health/db")
async def health_db():
    """
    Lightweight DB connectivity check for monitoring / readiness probes.
    Returns { "ok": true } when Atlas is reachable, HTTP 503 otherwise.
    """
    try:
        await database._get_client().admin.command("ping")
        return {"ok": True}
    except Exception as exc:
        logger.error("/api/health/db ping failed: %s", exc)
        raise HTTPException(status_code=503, detail={"ok": False, "error": str(exc)})
