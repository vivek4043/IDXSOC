"""
IDXSOC — MongoDB Database Layer
================================
Async connection to MongoDB Atlas using Motor (async pymongo driver).

Environment variables (loaded from .env):
    MONGO_URI              — Full MongoDB Atlas SRV connection string
    MONGO_DB_NAME          — Target database name          (default: idxsoc)
    DATA_RETENTION_DAYS    — Log / threat TTL in days      (default: 15)

Collections:
    logs      — Every processed HTTP / syslog entry
    threats   — AI-flagged threat documents (with embedded log_entry)
    users     — Application user accounts (optional)
    audit     — Admin action trail (optional)

Indexes created automatically on startup (idempotent):
    logs.created_at    — TTL index, expires after DATA_RETENTION_DAYS days
    threats.created_at — TTL index, same retention window
    threats.resolved   — Regular index for fast open-threat queries
"""

from __future__ import annotations

import logging
import os
from datetime import datetime, timezone
from typing import Any, Optional

from bson import ObjectId
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorCollection
from pymongo import ASCENDING, DESCENDING

# ── Load environment ───────────────────────────────────────────────────────────
load_dotenv()

logger = logging.getLogger("idxsoc.database")

# ── Configuration ──────────────────────────────────────────────────────────────
MONGO_URI: str            = os.getenv("MONGO_URI", "")
MONGO_DB_NAME: str        = os.getenv("MONGO_DB_NAME", "idxsoc")
DATA_RETENTION_DAYS: int  = int(os.getenv("DATA_RETENTION_DAYS", "15"))

# Derived: TTL in seconds
_TTL_SECONDS: int = DATA_RETENTION_DAYS * 24 * 60 * 60   # days → seconds


# ── JSON Serialisation Helper ─────────────────────────────────────────────────
def _serialise(doc: dict) -> dict:
    """
    Return a frontend-safe copy of a MongoDB document:
      - ObjectId  → string  (moved from '_id' to 'id')
      - datetime  → ISO-8601 string (UTC, with Z suffix)
      - Nested dicts / lists are processed recursively.

    Original document is NOT mutated.
    """
    def _convert(value: Any) -> Any:
        if isinstance(value, ObjectId):
            return str(value)
        if isinstance(value, datetime):
            # Ensure UTC then emit ISO-8601 with 'Z' so JS Date() parses it
            if value.tzinfo is None:
                value = value.replace(tzinfo=timezone.utc)
            return value.isoformat().replace("+00:00", "Z")
        if isinstance(value, dict):
            return {k: _convert(v) for k, v in value.items()}
        if isinstance(value, list):
            return [_convert(i) for i in value]
        return value

    out = _convert(doc)
    # Promote '_id' → 'id' so the frontend never has to handle underscore keys
    if "_id" in out:
        out["id"] = out.pop("_id")
    return out


# ── Singleton Motor Client ────────────────────────────────────────────────────
_client: Optional[AsyncIOMotorClient] = None


def _get_client() -> AsyncIOMotorClient:
    """Lazily construct and return the shared Motor client."""
    global _client
    if _client is None:
        if not MONGO_URI:
            raise RuntimeError(
                "MONGO_URI is not set. "
                "Add it to your .env file and restart the server.\n"
                "Example: MONGO_URI=mongodb+srv://<user>:<pass>@cluster0.xxx.mongodb.net/"
            )
        _client = AsyncIOMotorClient(
            MONGO_URI,
            serverSelectionTimeoutMS=5_000,
            connectTimeoutMS=10_000,
            socketTimeoutMS=30_000,
        )
        logger.info("MongoDB client initialised (db=%s)", MONGO_DB_NAME)
    return _client


def _db():
    """Return the Motor database handle."""
    return _get_client()[MONGO_DB_NAME]


# ── Collection Accessors ──────────────────────────────────────────────────────
def logs_col() -> AsyncIOMotorCollection:
    """Collection: logs — all processed HTTP / syslog entries."""
    return _db()["logs"]


def threats_col() -> AsyncIOMotorCollection:
    """Collection: threats — AI-flagged threat documents."""
    return _db()["threats"]


def users_col() -> AsyncIOMotorCollection:
    """Collection: users — application user accounts (optional)."""
    return _db()["users"]


def audit_col() -> AsyncIOMotorCollection:
    """Collection: audit — admin action trail (optional)."""
    return _db()["audit"]


# ── Lifecycle ─────────────────────────────────────────────────────────────────
async def ping_database() -> bool:
    """
    Verify Atlas connectivity and set up indexes.
    Call from the FastAPI lifespan startup hook.
    Returns True on success, False on failure (app continues in degraded mode).
    """
    try:
        await _get_client().admin.command("ping")
        logger.info("MongoDB Atlas ping OK  (db=%s, retention=%d days)",
                    MONGO_DB_NAME, DATA_RETENTION_DAYS)
        await ensure_indexes()
        return True
    except Exception as exc:
        logger.error("MongoDB connection failed: %s", exc)
        return False


def close_database() -> None:
    """Release the Motor connection pool. Call from FastAPI lifespan shutdown."""
    global _client
    if _client is not None:
        _client.close()
        _client = None
        logger.info("MongoDB client closed.")


# ── Index Management ──────────────────────────────────────────────────────────
async def ensure_indexes() -> None:
    """
    Idempotently create all required indexes.

    MongoDB skips creation silently when an identical index already exists,
    so this is safe to call on every startup.

    Indexes:
        logs.created_at             TTL — auto-delete after DATA_RETENTION_DAYS
        threats.created_at          TTL — same retention window
        threats.resolved            Regular — fast open-threat queries
        threats.severity            Regular — severity filter
    """
    try:
        # ── logs TTL ────────────────────────────────────────────────────────────
        await logs_col().create_index(
            [("created_at", ASCENDING)],
            expireAfterSeconds=_TTL_SECONDS,
            name=f"logs_ttl_{DATA_RETENTION_DAYS}d",
            background=True,
        )
        logger.info(
            "Index OK: logs.created_at  TTL=%ds (%dd)",
            _TTL_SECONDS, DATA_RETENTION_DAYS,
        )

        # ── threats TTL ─────────────────────────────────────────────────────────
        await threats_col().create_index(
            [("created_at", ASCENDING)],
            expireAfterSeconds=_TTL_SECONDS,
            name=f"threats_ttl_{DATA_RETENTION_DAYS}d",
            background=True,
        )
        logger.info(
            "Index OK: threats.created_at  TTL=%ds (%dd)",
            _TTL_SECONDS, DATA_RETENTION_DAYS,
        )

        # ── threats query indexes ───────────────────────────────────────────────
        await threats_col().create_index(
            [("resolved", ASCENDING)],
            name="threats_resolved",
            background=True,
        )
        await threats_col().create_index(
            [("severity", ASCENDING)],
            name="threats_severity",
            background=True,
        )
        logger.info("Index OK: threats.resolved, threats.severity")

    except Exception as exc:
        logger.error("ensure_indexes failed: %s", exc)


# ── Log Operations ─────────────────────────────────────────────────────────────
async def insert_log(doc: dict) -> str:
    """
    Insert a processed log entry into *logs*.

    ``created_at`` (datetime) is added automatically — it drives the TTL index
    and is always a true ``datetime`` object (not an ISO string).

    Args:
        doc: Normalised log dict from the IDXSOC pipeline.

    Returns:
        String representation of the inserted ``_id``.
    """
    document = {
        **doc,
        "created_at": datetime.utcnow(),
    }
    result = await logs_col().insert_one(document)
    logger.debug("insert_log  _id=%s  ip=%s", result.inserted_id, doc.get("ip"))
    return str(result.inserted_id)


# Keep backwards-compatible alias used by main.py
store_log = insert_log


async def get_recent_logs(
    limit: int = 200,
    only_threats: bool = False,
) -> list[dict]:
    """
    Return the most recent log documents, newest first.

    Args:
        limit:        Maximum documents to return (default 200).
        only_threats: When True, return only flagged entries.

    Returns:
        List of serialised log dicts (ObjectId → str, datetime → ISO string).
    """
    query: dict = {}
    if only_threats:
        query["flagged"] = True

    cursor = (
        logs_col()
        .find(query)
        .sort("created_at", DESCENDING)
        .limit(limit)
    )

    return [_serialise(doc) async for doc in cursor]


# ── Threat Operations ──────────────────────────────────────────────────────────
async def insert_threat(doc: dict) -> str:
    """
    Insert a threat document into *threats*.

    Adds ``created_at``, ``resolved`` (False), and ``resolved_by`` (None)
    if they are not already present.

    Args:
        doc: Threat dict (ThreatAnalysis.to_dict() merged with the log entry).

    Returns:
        String representation of the inserted ``_id``.
    """
    document = {
        "resolved":    False,
        "resolved_by": None,
        "escalated":   False,
        **doc,
        "created_at":  datetime.utcnow(),
    }
    result = await threats_col().insert_one(document)
    logger.debug(
        "insert_threat  _id=%s  rule=%s  severity=%s",
        result.inserted_id,
        doc.get("matched_rule"),
        doc.get("severity"),
    )
    return str(result.inserted_id)


# Keep backwards-compatible alias used by main.py
store_threat = insert_threat


async def get_open_threats(
    limit: int = 200,
    severity: Optional[str] = None,
) -> list[dict]:
    """
    Return unresolved threat documents, newest first.

    Args:
        limit:    Maximum documents to return (default 200).
        severity: Optional severity filter ("CRITICAL", "HIGH", …).

    Returns:
        List of serialised threat dicts.
    """
    query: dict = {"resolved": False}
    if severity:
        query["severity"] = severity.upper()

    cursor = (
        threats_col()
        .find(query)
        .sort("created_at", DESCENDING)
        .limit(limit)
    )

    return [_serialise(doc) async for doc in cursor]


async def get_all_threats(
    resolved: Optional[bool] = None,
    severity: Optional[str] = None,
    limit: int = 500,
) -> list[dict]:
    """
    Return threat documents with optional filters, newest first.

    Args:
        resolved: Filter by resolved state (None = all).
        severity: Filter by severity string (None = all).
        limit:    Max documents to return.

    Returns:
        List of serialised threat dicts.
    """
    query: dict = {}
    if resolved is not None:
        query["resolved"] = resolved
    if severity:
        query["severity"] = severity.upper()

    cursor = (
        threats_col()
        .find(query)
        .sort("created_at", DESCENDING)
        .limit(limit)
    )

    return [_serialise(doc) async for doc in cursor]


async def mark_threat_resolved(
    threat_id: str,
    resolved_by: str = "system",
) -> bool:
    """
    Mark a threat document as resolved in MongoDB.

    Stores who resolved it and the exact UTC timestamp.

    Args:
        threat_id:   The string form of the threat's ``_id`` *or* its ``id``
                     field (the original log entry ID like "SIM-010042").
        resolved_by: Username / system identifier of the resolver.

    Returns:
        True if a document was actually updated, False otherwise.
    """
    now = datetime.utcnow()

    # Try both the Mongo ObjectId and the application-level id field
    filters: list[dict] = [{"id": threat_id}, {"log_entry.id": threat_id}]
    try:
        filters.insert(0, {"_id": ObjectId(threat_id)})
    except Exception:
        pass  # threat_id is not a valid ObjectId — skip that filter arm

    result = await threats_col().update_one(
        {"$or": filters},
        {
            "$set": {
                "resolved":        True,
                "resolved_by":     resolved_by,
                "resolved_at":     now,
            }
        },
    )

    updated = result.modified_count > 0
    if updated:
        logger.info(
            "Threat %s marked resolved by '%s' at %s",
            threat_id, resolved_by, now.isoformat(),
        )
    else:
        logger.warning("mark_threat_resolved: no document matched id=%s", threat_id)

    return updated


# ══════════════════════════════════════════════════════════════════════════════
# USER COLLECTION OPERATIONS
# ══════════════════════════════════════════════════════════════════════════════

async def ensure_user_indexes() -> None:
    """Create unique index on users.username (idempotent)."""
    try:
        await users_col().create_index(
            [("username", ASCENDING)],
            unique=True,
            name="users_username_unique",
            background=True,
        )
        logger.info("Index OK: users.username (unique)")
    except Exception as exc:
        logger.error("ensure_user_indexes failed: %s", exc)


async def find_user_by_username(username: str) -> Optional[dict]:
    """Return a serialised user document (incl. password_hash) or None."""
    doc = await users_col().find_one({"username": username})
    return _serialise(doc) if doc else None


async def find_user_by_id(user_id: str) -> Optional[dict]:
    """Return a serialised user document by ObjectId string or None."""
    try:
        doc = await users_col().find_one({"_id": ObjectId(user_id)})
        return _serialise(doc) if doc else None
    except Exception:
        return None


async def get_all_users() -> list[dict]:
    """Return all users sorted by username, password_hash excluded."""
    cursor = users_col().find({}, {"password_hash": 0}).sort("username", ASCENDING)
    return [_serialise(doc) async for doc in cursor]


async def create_user_in_db(doc: dict) -> str:
    """
    Insert a new user. ``doc`` must include ``password_hash`` (bcrypt).
    Adds ``created_at`` automatically. Returns the inserted ``_id`` string.
    """
    document = {
        "must_change_password": True,
        "last_login":           None,
        **doc,
        "created_at": datetime.utcnow(),
    }
    result = await users_col().insert_one(document)
    logger.info("create_user  username=%s  role=%s", doc.get("username"), doc.get("role"))
    return str(result.inserted_id)


async def update_user_fields(user_id: str, fields: dict) -> bool:
    """Update arbitrary fields. Never touches password_hash via this function."""
    fields.pop("password_hash", None)
    fields.pop("_id", None)
    result = await users_col().update_one(
        {"_id": ObjectId(user_id)},
        {"$set": fields},
    )
    return result.modified_count > 0


async def update_user_password(user_id: str, new_hash: str) -> bool:
    """Replace password hash and clear must_change_password flag."""
    result = await users_col().update_one(
        {"_id": ObjectId(user_id)},
        {"$set": {
            "password_hash":        new_hash,
            "must_change_password": False,
        }},
    )
    return result.modified_count > 0


async def update_user_last_login(user_id: str) -> None:
    """Stamp last_login = utcnow on the user document."""
    await users_col().update_one(
        {"_id": ObjectId(user_id)},
        {"$set": {"last_login": datetime.utcnow()}},
    )


async def seed_users_if_empty() -> None:
    """
    Seed admin + demo analysts into the users collection ONLY when it is empty.
    Called from the FastAPI lifespan hook after ping_database(). No-op if data exists.
    """
    import bcrypt as _bcrypt

    count = await users_col().count_documents({}, limit=1)
    if count > 0:
        logger.info("Users collection already populated — skipping user seed.")
        return

    admin_username = os.getenv("SEED_ADMIN_USERNAME", os.getenv("SEED_ADMIN_USER", "admin"))
    admin_password = os.getenv("SEED_ADMIN_PASSWORD", "changeme-set-in-env")

    if admin_password == "changeme-set-in-env":
        logger.warning(
            "SEED_ADMIN_PASSWORD is not set in .env — set it before first run."
        )

    def _hash(pw: str) -> str:
        return _bcrypt.hashpw(pw.encode(), _bcrypt.gensalt(12)).decode()

    now = datetime.utcnow()
    users = [
        {
            "username": admin_username, "full_name": "User Admin",
            "role": "admin", "status": "active",
            "password_hash": _hash(admin_password),
            "must_change_password": False, "created_at": now, "last_login": None,
        },
        {
            "username": "analyst", "full_name": "User Security Analyst",
            "role": "analyst", "status": "active",
            "password_hash": _hash("changeme"),
            "must_change_password": True, "created_at": now, "last_login": None,
        },
        {
            "username": "j.chen", "full_name": "Jamie Chen",
            "role": "analyst", "status": "active",
            "password_hash": _hash("changeme"),
            "must_change_password": True, "created_at": now, "last_login": None,
        },
        {
            "username": "m.rivera", "full_name": "Marcus Rivera",
            "role": "analyst", "status": "inactive",
            "password_hash": _hash("changeme"),
            "must_change_password": True, "created_at": now, "last_login": None,
        },
        {
            "username": "s.patel", "full_name": "Sanya Patel",
            "role": "analyst", "status": "active",
            "password_hash": _hash("changeme"),
            "must_change_password": True, "created_at": now, "last_login": None,
        },
    ]

    await ensure_user_indexes()
    await users_col().insert_many(users)
    logger.info("User seed complete: %d users (admin=%s).", len(users), admin_username)
