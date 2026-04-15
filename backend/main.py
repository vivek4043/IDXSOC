"""
IDXSOC — FastAPI Backend
"""
import asyncio
import json
import logging
import random
from collections import defaultdict
from datetime import datetime, timedelta
from typing import Optional

from fastapi import FastAPI, File, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

from ai_engine import analyze_log_entry, FAKE_GEO, RULES, WHITELISTS
from alerting import dispatch_alert, build_alert_content, send_email_alert, send_slack_alert
from log_parser import parse_log_content
from simulator import generate_batch, generate_normal_entry

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s — %(message)s",
)
logger = logging.getLogger("idxsoc.main")

# ── App ────────────────────────────────────────────────────────────────────────
app = FastAPI(title="IDXSOC API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── In-memory data store ───────────────────────────────────────────────────────
_logs: list[dict] = []          # all log entries
_alerts: list[dict] = []        # AI-flagged entries
_resolved_ids: set[str] = set() # resolved by security team
MAX_STORE = 5000

# ── Seed initial data ──────────────────────────────────────────────────────────
def _seed():
    """Pre-populate with 200 historical entries so dashboard isn't empty on load."""
    batch = generate_batch(200)
    for entry in batch:
        analysis = analyze_log_entry(entry)
        if analysis:
            entry["threat"] = analysis.to_dict()
            entry["flagged"] = True
            _alerts.append(entry)
        else:
            entry["flagged"] = False
        _logs.append(entry)

_seed()


def _add_entry(entry: dict):
    """Add entry to store, run AI, dispatch alerts, keep within MAX_STORE."""
    analysis = analyze_log_entry(entry)
    if analysis:
        threat_dict = analysis.to_dict()
        entry["threat"] = threat_dict
        entry["flagged"] = True
        _alerts.append(entry)
        # keep alerts list bounded
        if len(_alerts) > MAX_STORE:
            _alerts.pop(0)

        # ── Dispatch email + Slack alert ─────────────────────────────────────
        result = dispatch_alert(
            threat      = threat_dict,
            log_entry   = entry,
            email_recipient = SETTINGS.get("emailAlert", ""),
            slack_webhook   = SETTINGS.get("slackWebhook", ""),
        )
        if result["email_sent"] or result["slack_sent"]:
            logger.info(
                "Alert dispatched for %s from %s — email=%s slack=%s",
                threat_dict.get("threat_name"),
                entry.get("ip"),
                result["email_sent"],
                result["slack_sent"],
            )
    else:
        entry["flagged"] = False
        entry["threat"] = None
    _logs.append(entry)
    if len(_logs) > MAX_STORE:
        _logs.pop(0)
    return entry


# ── Auth ───────────────────────────────────────────────────────────────────────
USERS = {
    "admin": {
        "username": "admin",
        "password": "idxsoc@123",
        "role": "admin",
        "name": "Admin User",
        "status": "active",
        "lastLogin": "2026-04-13T02:05:00Z",
        "loginCount": 142
    },
    "analyst": {
        "username": "analyst",
        "password": "analyst@456",
        "role": "analyst",
        "name": "Security Analyst",
        "status": "active",
        "lastLogin": "2026-04-13T01:47:00Z",
        "loginCount": 87
    },
    "j.chen": {
        "username": "j.chen",
        "password": "changeme",
        "role": "analyst",
        "name": "Jamie Chen",
        "status": "active",
        "lastLogin": "2026-04-12T22:11:00Z",
        "loginCount": 34
    },
    "m.rivera": {
        "username": "m.rivera",
        "password": "changeme",
        "role": "analyst",
        "name": "Marcus Rivera",
        "status": "inactive",
        "lastLogin": "2026-04-10T09:30:00Z",
        "loginCount": 19
    },
    "s.patel": {
        "username": "s.patel",
        "password": "changeme",
        "role": "analyst",
        "name": "Sanya Patel",
        "status": "active",
        "lastLogin": "2026-04-12T18:55:00Z",
        "loginCount": 56
    },
}

@app.post("/api/auth/login")
async def login(body: dict):
    user = USERS.get(body.get("username", ""))
    if not user or user["password"] != body.get("password", ""):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    if user.get("status") == "inactive":
        raise HTTPException(status_code=403, detail="Account disabled")

    return {
        "success": True,
        "token": "idxsoc-demo-token",
        "user": {
            "username": body["username"],
            "role": user["role"],
            "name": user["name"],
        }
    }


# ── Users API (Admin Panel) ────────────────────────────────────────────────────
@app.get("/api/users")
async def get_users():
    return [
        {
            "id": k,
            "username": v.get("username"),
            "name": v.get("name"),
            "role": v.get("role"),
            "status": v.get("status"),
            "lastLogin": v.get("lastLogin"),
            "loginCount": v.get("loginCount", 0)
        }
        for i, (k, v) in enumerate(USERS.items())
    ]

@app.post("/api/users")
async def create_user(body: dict):
    if not body.get("username"):
        raise HTTPException(status_code=400, detail="Username required")
    username = body["username"]
    if username in USERS:
        raise HTTPException(status_code=400, detail="User already exists")
    
    new_user = {
        "username": username,
        "password": "changeme123",
        "role": body.get("role", "analyst"),
        "name": body.get("name", ""),
        "status": "active",
        "lastLogin": None,
        "loginCount": 0
    }
    USERS[username] = new_user
    new_user_safe = dict(new_user)
    new_user_safe.pop("password")
    new_user_safe["id"] = username
    return {"success": True, "user": new_user_safe}

@app.put("/api/users/{username}")
async def update_user(username: str, body: dict):
    if username not in USERS:
        raise HTTPException(status_code=404, detail="User not found")
    
    user = USERS[username]
    if "name" in body:
        user["name"] = body["name"]
    if "role" in body:
        user["role"] = body["role"]
        
    user_safe = dict(user)
    user_safe.pop("password")
    user_safe["id"] = username
    return {"success": True, "user": user_safe}

@app.put("/api/users/{username}/status")
async def toggle_user_status(username: str):
    if username not in USERS:
        raise HTTPException(status_code=404, detail="User not found")
    
    user = USERS[username]
    user["status"] = "inactive" if user["status"] == "active" else "active"
    return {"success": True, "status": user["status"]}

# ── Rules API (Admin Panel) ────────────────────────────────────────────────────
@app.get("/api/rules")
async def get_rules():
    return RULES

@app.put("/api/rules/{rule_id}/toggle")
async def toggle_rule(rule_id: str):
    for rule in RULES:
        if rule["id"] == rule_id:
            rule["enabled"] = not rule.get("enabled", True)
            return {"success": True, "enabled": rule["enabled"]}
    raise HTTPException(status_code=404, detail="Rule not found")

@app.put("/api/rules/{rule_id}/severity")
async def update_rule_severity(rule_id: str, body: dict):
    severity = body.get("severity")
    if not severity:
        raise HTTPException(status_code=400, detail="Severity required")
    
    for rule in RULES:
        if rule["id"] == rule_id:
            rule["severity"] = severity
            return {"success": True, "severity": rule["severity"]}
    raise HTTPException(status_code=404, detail="Rule not found")

@app.put("/api/rules/{rule_id}/patterns")
async def update_rule_patterns(rule_id: str, body: dict):
    patterns = body.get("patterns")
    if patterns is None or not isinstance(patterns, list):
        raise HTTPException(status_code=400, detail="Patterns list required")
    
    for rule in RULES:
        if rule["id"] == rule_id:
            rule["patterns"] = patterns
            return {"success": True, "patterns": rule["patterns"]}
    raise HTTPException(status_code=404, detail="Rule not found")
# ── Whitelists API ─────────────────────────────────────────────────────────────
@app.get("/api/whitelists")
async def get_whitelists():
    return WHITELISTS

@app.put("/api/whitelists")
async def update_whitelists(body: dict):
    if "ips" in body:
        WHITELISTS["ips"] = body["ips"]
    if "urls" in body:
        WHITELISTS["urls"] = body["urls"]
    return {"success": True, "whitelists": WHITELISTS}

# ── System Settings API ────────────────────────────────────────────────────────
SETTINGS = {
    "retentionDays": 90,
    "emailAlert": "secops@idxsoc.local",
    "slackWebhook": "https://hooks.slack.com/services/T000/B000/XXXX"
}

@app.get("/api/settings")
async def get_settings():
    return SETTINGS

@app.put("/api/settings")
async def update_settings(body: dict):
    if "retentionDays" in body:
        SETTINGS["retentionDays"] = body["retentionDays"]
    if "emailAlert" in body:
        SETTINGS["emailAlert"] = body["emailAlert"]
    if "slackWebhook" in body:
        SETTINGS["slackWebhook"] = body["slackWebhook"]
    return {"success": True, "settings": SETTINGS}


# ── Stats ──────────────────────────────────────────────────────────────────────
@app.get("/api/stats")
async def get_stats():
    total = len(_logs)
    flagged = len(_alerts)
    resolved = len(_resolved_ids)
    pending  = flagged - resolved

    # Severity breakdown
    sev_counts = defaultdict(int)
    cat_counts  = defaultdict(int)
    ip_counts   = defaultdict(int)
    for a in _alerts:
        t = a.get("threat", {}) or {}
        sev_counts[t.get("severity", "UNKNOWN")] += 1
        cat_counts[t.get("category", "Other")] += 1
        ip_counts[a.get("ip", "?")] += 1

    top_ips = sorted(ip_counts.items(), key=lambda x: -x[1])[:10]
    top_ips = [{"ip": ip, "count": c, "geo": _fake_geo_for(ip)} for ip, c in top_ips]

    # Hourly trend (last 24h buckets)
    hourly = _hourly_trend()

    return {
        "total_events": total,
        "total_alerts": flagged,
        "resolved": resolved,
        "pending_investigation": pending,
        "severity_breakdown": dict(sev_counts),
        "category_breakdown": dict(cat_counts),
        "top_attacking_ips": top_ips,
        "hourly_trend": hourly,
        "live": True,
    }


def _fake_geo_for(ip: str) -> dict:
    # Use consistent (deterministic) geo based on IP hash
    if ip.startswith("192.168."):
        return {"country": "India (Campus)", "code": "IN"}
    return FAKE_GEO[hash(ip) % len(FAKE_GEO)]


def _hourly_trend():
    now = datetime.utcnow()
    buckets = {}
    for h in range(23, -1, -1):
        label = (now - timedelta(hours=h)).strftime("%H:00")
        buckets[label] = {"normal": 0, "alerts": 0}
    for entry in _logs:
        try:
            ts = datetime.fromisoformat(entry["timestamp"])
            diff = (now - ts).total_seconds() / 3600
            if diff <= 24:
                label = ts.strftime("%H:00")
                if label in buckets:
                    if entry.get("flagged"):
                        buckets[label]["alerts"] += 1
                    else:
                        buckets[label]["normal"] += 1
        except Exception:
            pass
    return [{"hour": k, **v} for k, v in buckets.items()]


# ── Logs ───────────────────────────────────────────────────────────────────────
@app.get("/api/logs")
async def get_logs(
    page: int = 1,
    limit: int = 50,
    ip: Optional[str] = None,
    severity: Optional[str] = None,
    flagged_only: bool = False,
    search: Optional[str] = None,
):
    data = _logs[:]
    data.reverse()  # newest first

    if flagged_only:
        data = [d for d in data if d.get("flagged")]
    if ip:
        data = [d for d in data if d.get("ip", "").startswith(ip)]
    if severity:
        data = [d for d in data if (d.get("threat") or {}).get("severity") == severity.upper()]
    if search:
        s = search.lower()
        data = [d for d in data if s in (d.get("request", "") + d.get("ip", "")).lower()]

    total = len(data)
    start = (page - 1) * limit
    return {
        "total": total,
        "page": page,
        "limit": limit,
        "data": data[start: start + limit],
    }


# ── Alerts / Investigation ─────────────────────────────────────────────────────
@app.get("/api/alerts")
async def get_alerts(
    page: int = 1,
    limit: int = 30,
    severity: Optional[str] = None,
    resolved: Optional[bool] = None,
):
    data = _alerts[:]
    data.reverse()

    if severity:
        data = [d for d in data if (d.get("threat") or {}).get("severity") == severity.upper()]
    if resolved is not None:
        if resolved:
            data = [d for d in data if d["id"] in _resolved_ids]
        else:
            data = [d for d in data if d["id"] not in _resolved_ids]

    # Mark resolved state
    for d in data:
        d["resolved"] = d["id"] in _resolved_ids

    total = len(data)
    start = (page - 1) * limit
    return {"total": total, "page": page, "limit": limit, "data": data[start: start + limit]}


@app.post("/api/alerts/{alert_id}/resolve")
async def resolve_alert(alert_id: str):
    _resolved_ids.add(alert_id)
    return {"success": True, "id": alert_id}


@app.post("/api/alerts/{alert_id}/escalate")
async def escalate_alert(alert_id: str):
    """Escalate an alert to CRITICAL and re-dispatch notifications."""
    for a in _alerts:
        if a["id"] == alert_id:
            if a.get("threat"):
                a["threat"]["severity"] = "CRITICAL"
                a["threat"]["escalated"] = True
                # Re-dispatch with CRITICAL severity
                dispatch_alert(
                    threat          = a["threat"],
                    log_entry       = a,
                    email_recipient = SETTINGS.get("emailAlert", ""),
                    slack_webhook   = SETTINGS.get("slackWebhook", ""),
                )
    return {"success": True, "id": alert_id}


@app.post("/api/test-alert")
async def test_alert():
    """
    Manually trigger a test alert to verify email and Slack configuration.
    Returns the send results so you can confirm credentials are correct.
    """
    sample_threat = {
        "threat_id":      "TEST-001",
        "threat_name":    "Test Alert",
        "severity":       "LOW",
        "category":       "Test",
        "confidence":     1.0,
        "evidence":       'Matched pattern in: "...test-alert-endpoint...',
        "recommendation": "This is a test. No action required.",
        "icon":           "🧪",
        "matched_rule":   "TEST-001",
    }
    sample_entry = {
        "ip":        "127.0.0.1",
        "timestamp": datetime.utcnow().isoformat(),
        "method":    "GET",
        "request":   "/api/test-alert",
    }
    result = dispatch_alert(
        threat          = sample_threat,
        log_entry       = sample_entry,
        email_recipient = SETTINGS.get("emailAlert", ""),
        slack_webhook   = SETTINGS.get("slackWebhook", ""),
    )
    return {"success": True, "results": result}


# ── Geo attack data ────────────────────────────────────────────────────────────
@app.get("/api/geo-attacks")
async def get_geo_attacks():
    geo_agg = defaultdict(lambda: {"count": 0, "lat": 0, "lon": 0, "country": "", "code": ""})
    for a in _alerts:
        geo = a.get("geo") or _fake_geo_for(a.get("ip", ""))
        key = geo.get("country", "Unknown")
        geo_agg[key]["count"] += 1
        geo_agg[key]["lat"]    = geo.get("lat", 0)
        geo_agg[key]["lon"]    = geo.get("lon", 0)
        geo_agg[key]["country"] = key
        geo_agg[key]["code"]   = geo.get("code", "?")
    return list(geo_agg.values())


# ── Upload Log File ────────────────────────────────────────────────────────────
@app.post("/api/upload-log")
async def upload_log(file: UploadFile = File(...)):
    content = await file.read()
    try:
        text = content.decode("utf-8", errors="replace")
    except Exception:
        raise HTTPException(400, "Could not decode file")

    entries = parse_log_content(text, file.filename or "")
    added = 0
    threats_found = 0
    for entry in entries[:2000]:  # cap at 2000 per upload
        processed = _add_entry(entry)
        added += 1
        if processed.get("flagged"):
            threats_found += 1

    return {
        "success": True,
        "filename": file.filename,
        "entries_parsed": added,
        "threats_found": threats_found,
        "message": f"Parsed {added} log entries. AI detected {threats_found} threats.",
    }


# ── Live Feed (SSE) ────────────────────────────────────────────────────────────
@app.get("/api/live-feed")
async def live_feed():
    async def event_stream():
        while True:
            # Generate 1-3 entries every second
            batch = generate_batch(random.randint(1, 3))
            for entry in batch:
                processed = _add_entry(entry)
                yield f"data: {json.dumps(processed)}\n\n"
            await asyncio.sleep(1.0)

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


# ── Health ─────────────────────────────────────────────────────────────────────
@app.get("/api/health")
async def health():
    return {"status": "ok", "version": "1.0.0", "project": "IDXSOC"}
