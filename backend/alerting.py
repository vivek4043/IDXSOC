"""
IDXSOC — Alerting Module
Handles email and Slack notifications when threats are detected.

Configuration via environment variables (or a .env file):
    SMTP_HOST       — SMTP server hostname (default: smtp.gmail.com)
    SMTP_PORT       — SMTP server port     (default: 587)
    SMTP_USERNAME   — SMTP login username
    SMTP_PASSWORD   — SMTP login password
    ALERT_FROM      — Sender email address (falls back to SMTP_USERNAME)
    SLACK_WEBHOOK   — Slack Incoming Webhook URL
"""

import os
import logging
import smtplib
import json as _json
import requests
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Optional

try:
    import urllib.request
    import json as _json
except ImportError:
    pass

logger = logging.getLogger("idxsoc.alerting")

# ── Load config from environment (supports python-dotenv if available) ──────────
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass   # dotenv is optional; env vars can be set directly

SMTP_HOST     = os.getenv("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT     = int(os.getenv("SMTP_PORT", "587"))
SMTP_USERNAME = os.getenv("SMTP_USERNAME", "")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")
ALERT_FROM    = os.getenv("ALERT_FROM", SMTP_USERNAME)
SLACK_WEBHOOK = os.getenv("SLACK_WEBHOOK", "")

# Mailtrap Config
EMAIL_PROVIDER        = os.getenv("EMAIL_PROVIDER", "smtp").lower()
MAILTRAP_TOKEN       = os.getenv("MAILTRAP_TOKEN", "")
MAILTRAP_SENDER_EMAIL = os.getenv("MAILTRAP_SENDER_EMAIL", "alerts@idxsoc.local")
MAILTRAP_SENDER_NAME  = os.getenv("MAILTRAP_SENDER_NAME", "IDXSOC Alerts")


# ── Email ────────────────────────────────────────────────────────────────────────

def send_email_alert(recipient: str, subject: str, body: str) -> bool:
    """
    Send a plain-text email alert via SMTP.

    Configuration is drawn from environment variables:
        SMTP_HOST, SMTP_PORT, SMTP_USERNAME, SMTP_PASSWORD, ALERT_FROM

    Args:
        recipient: Destination email address.
        subject:   Email subject line.
        body:      Plain-text email body.

    Returns:
        True if the email was sent successfully, False otherwise.
    """
    if EMAIL_PROVIDER == "mailtrap":
        return send_mailtrap_api_alert(recipient, subject, body)

    if not SMTP_USERNAME or not SMTP_PASSWORD:
        logger.warning(
            "Email not sent: SMTP_USERNAME / SMTP_PASSWORD are not configured. "
            "Set them as environment variables."
        )
        return False

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"]    = ALERT_FROM or SMTP_USERNAME
    msg["To"]      = recipient

    # Plain-text part
    msg.attach(MIMEText(body, "plain"))

    # HTML part — wraps the plain text in a dark-themed table
    html_body = _build_html_email(subject, body)
    msg.attach(MIMEText(html_body, "html"))

    try:
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=15) as server:
            server.ehlo()
            server.starttls()
            server.ehlo()
            server.login(SMTP_USERNAME, SMTP_PASSWORD)
            server.sendmail(ALERT_FROM or SMTP_USERNAME, recipient, msg.as_string())
        logger.info("Email alert sent to %s — %s", recipient, subject)
        return True
    except smtplib.SMTPAuthenticationError:
        logger.error("Email failed: SMTP authentication error. Check SMTP_USERNAME/PASSWORD.")
    except smtplib.SMTPConnectError:
        logger.error("Email failed: Could not connect to %s:%s.", SMTP_HOST, SMTP_PORT)
    except Exception as exc:
        logger.error("Email failed: %s", exc)
    return False


def send_mailtrap_api_alert(recipient: str, subject: str, body: str) -> bool:
    """
    Send a threat alert email via Mailtrap API (Advanced Method).
    """
    if not MAILTRAP_TOKEN:
        logger.warning("Mailtrap API alert skipped: MAILTRAP_TOKEN is not configured.")
        return False

    api_url = "https://send.api.mailtrap.io/api/send"
    headers = {
        "Authorization": f"Bearer {MAILTRAP_TOKEN}",
        "Content-Type": "application/json"
    }
    
    # We use the same HTML builder to maintain UI consistency
    html_content = _build_html_email(subject, body)
    
    payload = {
        "from": {"email": MAILTRAP_SENDER_EMAIL, "name": MAILTRAP_SENDER_NAME},
        "to": [{"email": recipient}],
        "subject": subject,
        "text": body,
        "html": html_content,
        "category": "Threat Alert"
    }

    try:
        response = requests.post(api_url, headers=headers, json=payload, timeout=15)
        if response.status_code in (200, 202):
            logger.info("Mailtrap API alert sent to %s — %s", recipient, subject)
            return True
        else:
            logger.error("Mailtrap API failed: %s %s", response.status_code, response.text)
    except Exception as exc:
        logger.error("Mailtrap API request failed: %s", exc)
    
    return False


def _build_html_email(subject: str, body: str) -> str:
    """Wrap the plain-text body in a minimal HTML template for readability."""
    lines = body.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
    rows  = "".join(
        f'<tr><td style="padding:4px 0;line-height:1.6;">{line}</td></tr>'
        for line in lines.splitlines()
    )
    return f"""<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/></head>
<body style="margin:0;padding:0;background:#060a14;font-family:'Courier New',monospace;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#060a14;padding:28px;">
    <tr><td>
      <table width="620" align="center" cellpadding="0" cellspacing="0"
             style="background:#0d1220;border:1px solid rgba(74,222,128,0.22);
                    border-radius:8px;overflow:hidden;">
        <!-- Header -->
        <tr>
          <td style="padding:16px 24px;background:#050810;
                     border-bottom:1px solid rgba(74,222,128,0.15);">
            <span style="color:#4ade80;font-size:13px;font-weight:700;
                         letter-spacing:1px;">🛡️ IDXSOC — THREAT ALERT</span>
          </td>
        </tr>
        <!-- Subject -->
        <tr>
          <td style="padding:20px 24px 6px;
                     color:#ff4757;font-size:16px;font-weight:700;">
            {subject}
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="padding:12px 24px 24px;">
            <table width="100%" cellpadding="0" cellspacing="0"
                   style="color:#d4f5e2;font-size:12.5px;">
              {rows}
            </table>
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="padding:12px 24px;background:#050810;
                     border-top:1px solid rgba(74,222,128,0.1);
                     color:#3a5245;font-size:10px;">
            This is an automated alert from IDXSOC. Do not reply to this email.
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>"""


# ── Slack ──────────────────────────────────────────────────────────────────────

def send_slack_alert(webhook_url: str, subject: str, body: str) -> bool:
    """
    Post a threat notification to a Slack channel via an Incoming Webhook.

    Args:
        webhook_url: Slack Incoming Webhook URL.
        subject:     Short title / subject line (used as a bold heading).
        body:        Detail text for the Slack message.

    Returns:
        True if the message was posted successfully, False otherwise.
    """
    if not webhook_url:
        logger.warning("Slack alert skipped: SLACK_WEBHOOK is not configured.")
        return False

    payload = {
        "text": f"*{subject}*",
        "blocks": [
            {
                "type": "header",
                "text": {"type": "plain_text", "text": "🛡️ IDXSOC Threat Alert", "emoji": True},
            },
            {
                "type": "section",
                "text": {"type": "mrkdwn", "text": f"*{subject}*"},
            },
            {"type": "divider"},
            {
                "type": "section",
                "text": {"type": "mrkdwn", "text": f"```{body}```"},
            },
        ],
    }

    try:
        data    = _json.dumps(payload).encode("utf-8")
        req     = urllib.request.Request(
            webhook_url,
            data=data,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=10) as resp:
            if resp.status == 200:
                logger.info("Slack alert posted — %s", subject)
                return True
            logger.error("Slack returned HTTP %s", resp.status)
    except Exception as exc:
        logger.error("Slack alert failed: %s", exc)
    return False


# ── Shared content builder ──────────────────────────────────────────────────────

def build_alert_content(threat: dict, log_entry: dict) -> tuple[str, str]:
    """
    Build the dynamic subject line and email/Slack body from a threat dict
    and the original log entry dict.

    Subject format:
        [{Severity}] {Icon} {Threat Name} Detected from {Attacker IP}

    Returns:
        (subject, body) as a tuple of strings.
    """
    severity   = threat.get("severity",        "UNKNOWN")
    icon       = threat.get("icon",            "🚨")
    threat_name= threat.get("threat_name",     "Unknown Threat")
    confidence = threat.get("confidence",      0.0)
    evidence   = threat.get("evidence",        "N/A")
    rec        = threat.get("recommendation",  "No action recommended.")

    attacker_ip = log_entry.get("ip",        "unknown")
    timestamp   = log_entry.get("timestamp", "N/A")
    method      = log_entry.get("method",    "N/A")
    request     = log_entry.get("request",   "N/A")

    subject = f"[{severity}] {icon} {threat_name} Detected from {attacker_ip}"

    body = (
        f"{'='*60}\n"
        f"  IDXSOC — THREAT DETECTION ALERT\n"
        f"{'='*60}\n\n"
        f"  Threat Name   : {threat_name}\n"
        f"  Severity      : {severity}\n"
        f"  Confidence    : {confidence * 100:.1f}%\n"
        f"  Attacker IP   : {attacker_ip}\n"
        f"  Timestamp     : {timestamp}\n"
        f"  Method        : {method}\n"
        f"  Request       : {request}\n\n"
        f"  Evidence\n"
        f"  {'-'*56}\n"
        f"  {evidence}\n\n"
        f"  Recommended Action\n"
        f"  {'-'*56}\n"
        f"  {rec}\n\n"
        f"{'='*60}\n"
        f"  Automated alert from IDXSOC — Do not reply.\n"
        f"{'='*60}\n"
    )

    return subject, body


# ── Convenience dispatcher ──────────────────────────────────────────────────────

def dispatch_alert(
    threat: dict,
    log_entry: dict,
    email_recipient: Optional[str] = None,
    slack_webhook:   Optional[str] = None,
) -> dict:
    """
    Build dynamic alert content from a threat + log entry, then send via
    email and/or Slack as configured.

    Args:
        threat:          The threat dict (from ThreatAnalysis.to_dict()).
        log_entry:       The original parsed log entry dict.
        email_recipient: Override recipient; falls back to env ALERT_RECIPIENT.
        slack_webhook:   Override webhook; falls back to env SLACK_WEBHOOK.

    Returns:
        dict with keys ``email_sent`` and ``slack_sent``.
    """
    subject, body = build_alert_content(threat, log_entry)

    recipient  = email_recipient or os.getenv("ALERT_RECIPIENT", "")
    webhook    = slack_webhook   or SLACK_WEBHOOK

    email_ok = send_email_alert(recipient, subject, body) if recipient else False
    slack_ok = send_slack_alert(webhook,   subject, body) if webhook   else False

    return {"email_sent": email_ok, "slack_sent": slack_ok}
