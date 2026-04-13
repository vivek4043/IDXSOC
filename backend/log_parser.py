"""
IDXSOC — Log File Parser
Supports: Apache/Nginx Combined, Syslog, Suricata/Snort alerts, CSV/JSON
"""
import re
import json
import csv
import io
from datetime import datetime
from typing import Generator

# ── Apache / Nginx Combined Log Format:
# 1.2.3.4 - - [01/Jan/2025:12:00:00 +0000] "GET /path HTTP/1.1" 200 1024 "-" "Mozilla/5.0"
APACHE_PATTERN = re.compile(
    r'(?P<ip>[\d\.]+)\s+'
    r'\S+\s+\S+\s+'
    r'\[(?P<time>[^\]]+)\]\s+'
    r'"(?P<method>\w+)\s+(?P<request>[^\s]+)\s+HTTP/[^\s"]+"\s+'
    r'(?P<status>\d+)\s+'
    r'(?P<bytes>\d+|-)\s+'
    r'"(?P<referer>[^"]*)"\s+'
    r'"(?P<ua>[^"]*)"'
)

# ── Syslog pattern
SYSLOG_PATTERN = re.compile(
    r'(?P<month>\w+)\s+(?P<day>\d+)\s+(?P<time>[\d:]+)\s+(?P<host>\S+)\s+(?P<prog>[^:]+):\s+(?P<msg>.*)'
)

# ── Suricata EVE JSON (newline-delimited JSON)
# ── Format: {"timestamp":"...","event_type":"alert","src_ip":"...","dest_ip":"...","alert":{}}

APACHE_TIME_FMT = "%d/%b/%Y:%H:%M:%S %z"


def _parse_apache_time(ts_str: str) -> str:
    try:
        return datetime.strptime(ts_str, APACHE_TIME_FMT).isoformat()
    except Exception:
        return datetime.utcnow().isoformat()


def parse_log_content(content: str, filename: str = "") -> list[dict]:
    """Auto-detect format and parse, return list of normalized log dicts."""
    lines = content.strip().splitlines()
    if not lines:
        return []

    # Try JSON / NDJSON (Suricata EVE)
    try:
        first = json.loads(lines[0])
        if isinstance(first, dict):
            return _parse_suricata_ndjson(lines)
    except Exception:
        pass

    # Try CSV
    if filename.endswith(".csv") or "," in lines[0]:
        try:
            return _parse_csv(content)
        except Exception:
            pass

    # Try Apache / Nginx
    if APACHE_PATTERN.match(lines[0]):
        return _parse_apache(lines)

    # Try Syslog
    if SYSLOG_PATTERN.match(lines[0]):
        return _parse_syslog(lines)

    # Fallback: generic line parse
    return _parse_generic(lines)


def _parse_apache(lines: list[str]) -> list[dict]:
    results = []
    for i, line in enumerate(lines):
        m = APACHE_PATTERN.match(line.strip())
        if not m:
            continue
        results.append({
            "id": f"LOG-{i:06d}",
            "ip": m.group("ip"),
            "timestamp": _parse_apache_time(m.group("time")),
            "method": m.group("method"),
            "request": m.group("request"),
            "status": int(m.group("status")),
            "bytes": m.group("bytes"),
            "user_agent": m.group("ua"),
            "referer": m.group("referer"),
            "source": "web_server",
            "raw": line.strip(),
        })
    return results


def _parse_syslog(lines: list[str]) -> list[dict]:
    results = []
    for i, line in enumerate(lines):
        m = SYSLOG_PATTERN.match(line.strip())
        if not m:
            continue
        results.append({
            "id": f"SYS-{i:06d}",
            "ip": _extract_ip(m.group("msg")),
            "timestamp": datetime.utcnow().isoformat(),
            "method": "SYSLOG",
            "request": m.group("msg"),
            "status": 0,
            "bytes": "-",
            "user_agent": m.group("prog"),
            "referer": "-",
            "source": "syslog",
            "raw": line.strip(),
        })
    return results


def _parse_suricata_ndjson(lines: list[str]) -> list[dict]:
    results = []
    for i, line in enumerate(lines):
        try:
            obj = json.loads(line)
            if obj.get("event_type") not in ("alert", "http", "dns", "tls"):
                continue
            alert = obj.get("alert", {})
            http  = obj.get("http", {})
            results.append({
                "id": f"IDS-{i:06d}",
                "ip": obj.get("src_ip", "unknown"),
                "timestamp": obj.get("timestamp", datetime.utcnow().isoformat()),
                "method": http.get("http_method", "IDS"),
                "request": http.get("url", alert.get("signature", "")),
                "status": http.get("status", 0),
                "bytes": http.get("length", "-"),
                "user_agent": http.get("http_user_agent", alert.get("category", "")),
                "referer": "-",
                "source": "ids",
                "raw": line.strip(),
            })
        except Exception:
            continue
    return results


def _parse_csv(content: str) -> list[dict]:
    reader = csv.DictReader(io.StringIO(content))
    results = []
    for i, row in enumerate(reader):
        # Try to map common column names
        ip  = row.get("ip") or row.get("src_ip") or row.get("client_ip") or "unknown"
        req = row.get("request") or row.get("url") or row.get("path") or ""
        results.append({
            "id": f"CSV-{i:06d}",
            "ip": ip,
            "timestamp": row.get("timestamp") or row.get("time") or datetime.utcnow().isoformat(),
            "method": row.get("method", "GET"),
            "request": req,
            "status": int(row.get("status", 0) or 0),
            "bytes": str(row.get("bytes", "-")),
            "user_agent": row.get("user_agent") or row.get("ua") or "-",
            "referer": row.get("referer", "-"),
            "source": "csv",
            "raw": str(row),
        })
    return results


def _parse_generic(lines: list[str]) -> list[dict]:
    results = []
    for i, line in enumerate(lines):
        results.append({
            "id": f"GEN-{i:06d}",
            "ip": _extract_ip(line),
            "timestamp": datetime.utcnow().isoformat(),
            "method": "UNKNOWN",
            "request": line[:200],
            "status": 0,
            "bytes": "-",
            "user_agent": "-",
            "referer": "-",
            "source": "generic",
            "raw": line.strip(),
        })
    return results


def _extract_ip(text: str) -> str:
    m = re.search(r'\b(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\b', text)
    return m.group(1) if m else "unknown"
