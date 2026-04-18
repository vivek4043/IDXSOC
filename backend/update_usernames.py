"""
One-time script to update existing user names to the new 'User Admin' / 'User Security Analyst' format.
Run with: python3 update_usernames.py
"""
import asyncio
import os
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

load_dotenv()

MONGO_URI = os.getenv("MONGO_URI")
MONGO_DB_NAME = os.getenv("MONGO_DB_NAME", "idxsoc")

async def update_users():
    if not MONGO_URI:
        print("MONGO_URI not found in .env")
        return

    client = AsyncIOMotorClient(MONGO_URI)
    db = client[MONGO_DB_NAME]
    users_col = db["users"]

    updates = [
        ("admin", "User Admin"),
        ("analyst", "User Security Analyst")
    ]

    for username, new_name in updates:
        res = await users_col.update_one(
            {"username": username},
            {"$set": {"full_name": new_name}}
        )
        if res.modified_count > 0:
            print(f"Updated {username} -> {new_name}")
        else:
            print(f"No changes needed for {username}")

    client.close()

if __name__ == "__main__":
    asyncio.run(update_users())
