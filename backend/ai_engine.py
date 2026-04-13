"""
IDXSOC — AI Threat Detection Engine
Detects: SQLi, XSS, LFI/Path Traversal, Brute Force, Scanner, Command Injection, Admin Probing
"""
import re
from datetime import datetime
from dataclasses import dataclass, field
from typing import Optional
from collections import defaultdict

# ── Whitelists ─────────────────────────────────────────────────────────────────
WHITELISTS = {
    "ips": ["192.168.1.0/24", "10.0.0.1"],
    "urls": ["/ping", "/healthz"]
}

# ── Threat signatures ────────────────────────────────────────────────────────

RULES = [
    # ── CRITICAL ──────────────────────────────────────────────────────────────
    {
        "id": "SQLI-001",
        "name": "SQL Injection",
        "severity": "CRITICAL",
        "category": "Injection",
        "patterns": [
            r"(?i)(\bunion\b.*\bselect\b)",
            r"(?i)(select\s+.+\s+from\s+)",
            r"(?i)('?\s*(or|and)\s+'?1'?\s*=\s*'?1)",
            r"(?i)(--|#|;)\s*(drop|delete|truncate|insert|update)",
            r"(?i)(xp_cmdshell|exec\s*\(|execute\s*\()",
            r"(?i)(\bsleep\s*\(|\bwaitfor\s+delay)",
            r"(?i)(benchmark\s*\(|load_file\s*\(|into\s+outfile)",
            r"(?i)('?\s*;\s*(drop|delete|update|insert)\b)",
            r"(?i)(%27|')\s*(or|and)\s+('[^']*'|[0-9]+)\s*=\s*('[^']*'|[0-9]+)",
        ],
        "recommendation": "Block IP immediately. Alert DBA. Review database for unauthorized access.",
        "icon": "🩸",
    },
    {
        "id": "CMDI-001",
        "name": "Command Injection",
        "severity": "CRITICAL",
        "category": "Injection",
        "patterns": [
            r"(?i)(\|\s*(cat|ls|id|whoami|uname|wget|curl|bash|sh|python|perl|nc|ncat))",
            r"(?i)(;\s*(cat|ls|id|whoami|wget|curl|bash|sh|rm\s+-rf))",
            r"(`[^`]+`)",
            r"(?i)(\$\(.*\))",
            r"(?i)(&&\s*(wget|curl|bash|sh|python|perl|nc))",
        ],
        "recommendation": "Critical: Possible RCE attempt. Isolate the server, review shell commands executed.",
        "icon": "💀",
    },
    # ── HIGH ──────────────────────────────────────────────────────────────────
    {
        "id": "XSS-001",
        "name": "Cross-Site Scripting (XSS)",
        "severity": "HIGH",
        "category": "Injection",
        "patterns": [
            r"(?i)<script[\s>]",
            r"(?i)javascript\s*:",
            r"(?i)on(error|load|click|mouseover|focus|blur|change|submit)\s*=",
            r"(?i)<(img|iframe|object|embed|form)[^>]+(src|action|data)\s*=\s*['\"]?javascript",
            r"(?i)(alert|confirm|prompt)\s*\(",
            r"(?i)document\.(cookie|write|location)",
            r"(?i)eval\s*\(",
            r"(?i)%3Cscript",
        ],
        "recommendation": "Sanitize user inputs. Implement Content-Security-Policy headers. Review affected endpoints.",
        "icon": "⚡",
    },
    {
        "id": "LFI-001",
        "name": "Path Traversal / LFI",
        "severity": "HIGH",
        "category": "File Access",
        "patterns": [
            r"(\.\./){2,}",
            r"(?i)(%2e%2e%2f|%2e%2e/|\.\.%2f){2,}",
            r"(?i)(etc/passwd|etc/shadow|windows/system32|boot\.ini|win\.ini)",
            r"(?i)(proc/self/|/proc/[0-9]+/)",
            r"(?i)(php://filter|php://input|data://)",
            r"(?i)(\.\.\\){2,}",
        ],
        "recommendation": "Block path traversal patterns at WAF. Verify file access controls. Check for exposed sensitive files.",
        "icon": "📂",
    },
    {
        "id": "SCAN-001",
        "name": "Automated Scanner Detected",
        "severity": "HIGH",
        "category": "Reconnaissance",
        "patterns": [
            r"(?i)(sqlmap|nikto|nessus|masscan|nmap|dirbuster|gobuster|wfuzz|burpsuite|acunetix|zaproxy|w3af)",
            r"(?i)(python-requests|curl/[0-9]|wget/[0-9]|go-http-client|java/[0-9]\.[0-9])",
        ],
        "ua_only": True,
        "recommendation": "Ban scanner IP immediately. Run a full audit of logs around this timeline.",
        "icon": "🔍",
    },
    # ── MEDIUM ────────────────────────────────────────────────────────────────
    {
        "id": "ADMIN-001",
        "name": "Admin Panel Probe",
        "severity": "MEDIUM",
        "category": "Reconnaissance",
        "patterns": [
            r"(?i)/(wp-admin|wp-login|phpmyadmin|adminer|cpanel|webmin|plesk|admin/login|administrator)",
            r"(?i)/\.(env|git|htaccess|htpasswd|bash_history|ssh/|aws/credentials)",
            r"(?i)/(config|conf|backup|bak|old|dist)\.(php|sql|zip|tar|gz|bak)",
            r"(?i)/server-status",
        ],
        "recommendation": "Review access controls. Ensure admin panels are not publicly accessible.",
        "icon": "🔑",
    },
    {
        "id": "BRUTE-001",
        "name": "Brute Force / Credential Stuffing",
        "severity": "HIGH",
        "category": "Authentication",
        "rate_based": True,
        "recommendation": "Implement rate-limiting, CAPTCHA on login. Block offending IP. Reset compromised credentials.",
        "icon": "🔨",
    },
]

for r in RULES:
    r.setdefault("enabled", True)
    r.setdefault("hits", 0)

# ── Geolocation mock data (for demo) ─────────────────────────────────────────

FAKE_GEO = [
    {"country": "China", "city": "Beijing", "lat": 39.9042, "lon": 116.4074, "code": "CN"},
    {"country": "Russia", "city": "Moscow", "lat": 55.7558, "lon": 37.6173, "code": "RU"},
    {"country": "Brazil", "city": "São Paulo", "lat": -23.5505, "lon": -46.6333, "code": "BR"},
    {"country": "United States", "city": "Chicago", "lat": 41.8781, "lon": -87.6298, "code": "US"},
    {"country": "Germany", "city": "Berlin", "lat": 52.5200, "lon": 13.4050, "code": "DE"},
    {"country": "India", "city": "Mumbai", "lat": 19.0760, "lon": 72.8777, "code": "IN"},
    {"country": "Nigeria", "city": "Lagos", "lat": 6.5244, "lon": 3.3792, "code": "NG"},
    {"country": "Romania", "city": "Bucharest", "lat": 44.4268, "lon": 26.1025, "code": "RO"},
    {"country": "Iran", "city": "Tehran", "lat": 35.6892, "lon": 51.3890, "code": "IR"},
    {"country": "South Korea", "city": "Seoul", "lat": 37.5665, "lon": 126.9780, "code": "KR"},
]

# ── Rate tracker (brute-force detection) ─────────────────────────────────────
_login_tracker: dict = defaultdict(list)


@dataclass
class ThreatAnalysis:
    threat_id: str
    threat_name: str
    severity: str           # CRITICAL / HIGH / MEDIUM / LOW
    category: str
    confidence: float       # 0.0 – 1.0
    evidence: str
    recommendation: str
    icon: str
    matched_rule: str

    def to_dict(self):
        return self.__dict__


def analyze_log_entry(entry: dict) -> Optional[ThreatAnalysis]:
    """Run all rules against a single log entry. Return first (highest-severity) match."""
    url     = entry.get("request", "")
    ua      = entry.get("user_agent", "")
    ip      = entry.get("ip", "")
    method  = entry.get("method", "GET")
    status  = entry.get("status", 200)
    ts      = entry.get("timestamp", "")
    
    # ── Whitelist evaluation ──
    # Exact IP or CIDR-like starts-with
    for w_ip in WHITELISTS["ips"]:
        if ip == w_ip or (w_ip.endswith("/24") and ip.startswith(w_ip.replace("0/24", ""))):
            return None
    
    # Substring URL path
    for w_url in WHITELISTS["urls"]:
        if w_url and w_url in url:
            return None

    combined = f"{url} {ua}"

    best: Optional[ThreatAnalysis] = None
    sev_order = {"CRITICAL": 0, "HIGH": 1, "MEDIUM": 2, "LOW": 3}

    for rule in RULES:
        if not rule.get("enabled", True):
            continue

        # Rate-based brute-force check
        if rule.get("rate_based"):
            if method == "POST" and re.search(r"(?i)/login", url, re.IGNORECASE):
                now = datetime.utcnow().timestamp()
                _login_tracker[ip].append(now)
                _login_tracker[ip] = [t for t in _login_tracker[ip] if now - t < 60]
                if len(_login_tracker[ip]) >= 8:
                    ta = ThreatAnalysis(
                        threat_id=rule["id"],
                        threat_name=rule["name"],
                        severity=rule["severity"],
                        category=rule["category"],
                        confidence=min(0.95, len(_login_tracker[ip]) / 20),
                        evidence=f"{len(_login_tracker[ip])} login attempts from {ip} in 60s",
                        recommendation=rule["recommendation"],
                        icon=rule.get("icon", "🚨"),
                        matched_rule=rule["id"],
                    )
                    if best is None or sev_order[ta.severity] < sev_order[best.severity]:
                        best = ta
            continue

        # Pattern matching
        target = ua if rule.get("ua_only") else combined
        for pat in rule.get("patterns", []):
            m = re.search(pat, target)
            if m:
                evidence_snippet = target[max(0, m.start()-20):m.end()+20].strip()
                confidence = _calc_confidence(target, rule["patterns"])
                ta = ThreatAnalysis(
                    threat_id=rule["id"],
                    threat_name=rule["name"],
                    severity=rule["severity"],
                    category=rule["category"],
                    confidence=confidence,
                    evidence=f'Matched pattern in: "...{evidence_snippet}..."',
                    recommendation=rule["recommendation"],
                    icon=rule.get("icon", "🚨"),
                    matched_rule=rule["id"],
                )
                if best is None or sev_order[ta.severity] < sev_order[best.severity]:
                    best = ta
                break  # one match per rule is enough

    if best:
        for rule in RULES:
            if rule["id"] == best.matched_rule:
                rule["hits"] = rule.get("hits", 0) + 1
                break

    return best


def _calc_confidence(target: str, patterns: list) -> float:
    """More matching patterns → higher confidence."""
    hits = sum(1 for p in patterns if re.search(p, target))
    return round(min(0.99, 0.55 + hits * 0.15), 2)
