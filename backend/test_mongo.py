#!/usr/bin/env python3
"""
IDXSOC — MongoDB Connection Test
=================================
Run from the backend directory:

    python test_mongo.py

What this does:
  1. Loads .env (MONGO_URI, MONGO_DB_NAME)
  2. Connects to MongoDB Atlas
  3. Inserts one document into the `healthcheck` collection
  4. Reads it back and verifies the payload
  5. Deletes the test document (clean up)
  6. Prints a clearly formatted pass / fail report

Exit codes:
  0 — all checks passed
  1 — one or more checks failed
"""

import asyncio
import os
import sys
from datetime import datetime, timezone

# ── Load .env before importing motor ──────────────────────────────────────────
from dotenv import load_dotenv

load_dotenv()

MONGO_URI     = os.getenv("MONGO_URI", "")
MONGO_DB_NAME = os.getenv("MONGO_DB_NAME", "idxsoc")

# ── Colour helpers (no external deps) ─────────────────────────────────────────
GREEN  = "\033[92m"
RED    = "\033[91m"
YELLOW = "\033[93m"
CYAN   = "\033[96m"
BOLD   = "\033[1m"
RESET  = "\033[0m"

OK   = f"{GREEN}✓ PASS{RESET}"
FAIL = f"{RED}✗ FAIL{RESET}"

def _step(n: int, label: str) -> None:
    print(f"\n{CYAN}{BOLD}[{n}]{RESET} {label}")

def _ok(msg: str)   -> None: print(f"    {OK}   {msg}")
def _fail(msg: str) -> None: print(f"    {FAIL}  {msg}")
def _info(msg: str) -> None: print(f"         {YELLOW}{msg}{RESET}")


# ── Main async test routine ────────────────────────────────────────────────────
async def run_test() -> bool:
    from motor.motor_asyncio import AsyncIOMotorClient
    from bson import ObjectId

    passed = True

    # ── Step 1: env vars present ───────────────────────────────────────────────
    _step(1, "Check environment variables")
    if MONGO_URI:
        masked = MONGO_URI[:30] + "…" if len(MONGO_URI) > 30 else MONGO_URI
        _ok(f"MONGO_URI      = {masked}")
    else:
        _fail("MONGO_URI is empty — add it to backend/.env")
        passed = False

    _ok(f"MONGO_DB_NAME  = {MONGO_DB_NAME}")

    if not MONGO_URI:
        print(f"\n{RED}Aborting: cannot connect without MONGO_URI.{RESET}")
        return False

    # ── Step 2: create client + ping ───────────────────────────────────────────
    _step(2, "Connect to MongoDB Atlas (ping)")
    client = AsyncIOMotorClient(
        MONGO_URI,
        serverSelectionTimeoutMS=8_000,
        connectTimeoutMS=10_000,
    )
    try:
        await client.admin.command("ping")
        _ok("Atlas ping successful")
    except Exception as exc:
        _fail(f"Ping failed: {exc}")
        _info("Check MONGO_URI, network access, and Atlas IP whitelist.")
        client.close()
        return False

    db  = client[MONGO_DB_NAME]
    col = db["healthcheck"]

    # ── Step 3: insert test document ──────────────────────────────────────────
    _step(3, "Insert test document into `healthcheck` collection")
    doc = {
        "test":       True,
        "source":     "test_mongo.py",
        "db_name":    MONGO_DB_NAME,
        "created_at": datetime.now(tz=timezone.utc),
        "message":    "IDXSOC MongoDB connectivity test — safe to delete",
    }
    try:
        result = await col.insert_one(doc)
        inserted_id: ObjectId = result.inserted_id
        _ok(f"Inserted document  _id = {inserted_id}")
    except Exception as exc:
        _fail(f"Insert failed: {exc}")
        client.close()
        return False

    # ── Step 4: read it back ──────────────────────────────────────────────────
    _step(4, "Read document back and verify payload")
    try:
        fetched = await col.find_one({"_id": inserted_id})
        if fetched is None:
            _fail("Document not found after insert")
            passed = False
        else:
            assert fetched["test"]    is True,            "test field wrong"
            assert fetched["source"]  == "test_mongo.py", "source field wrong"
            assert fetched["db_name"] == MONGO_DB_NAME,   "db_name field wrong"
            _ok(f"Document verified   source='{fetched['source']}'"
                f"  db='{fetched['db_name']}'")
    except AssertionError as ae:
        _fail(f"Payload mismatch: {ae}")
        passed = False
    except Exception as exc:
        _fail(f"Read failed: {exc}")
        passed = False

    # ── Step 5: clean up ──────────────────────────────────────────────────────
    _step(5, "Clean up — delete test document")
    try:
        del_result = await col.delete_one({"_id": inserted_id})
        if del_result.deleted_count == 1:
            _ok("Test document deleted")
        else:
            _info("Document already gone (not a failure)")
    except Exception as exc:
        _info(f"Cleanup warning (non-fatal): {exc}")

    # ── Close connection ───────────────────────────────────────────────────────
    client.close()
    return passed


# ── Entry point ────────────────────────────────────────────────────────────────
def main() -> None:
    print(f"\n{BOLD}{CYAN}{'─' * 52}{RESET}")
    print(f"{BOLD}{CYAN}  IDXSOC · MongoDB Connection Test{RESET}")
    print(f"{BOLD}{CYAN}{'─' * 52}{RESET}")

    ok = asyncio.run(run_test())

    print(f"\n{BOLD}{'─' * 52}{RESET}")
    if ok:
        print(f"{BOLD}{GREEN}  ✓  All checks passed — MongoDB is reachable!{RESET}")
    else:
        print(f"{BOLD}{RED}  ✗  One or more checks failed — see details above.{RESET}")
    print(f"{BOLD}{'─' * 52}{RESET}\n")

    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
