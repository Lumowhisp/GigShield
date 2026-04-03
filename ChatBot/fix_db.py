import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import certifi
import os
from dotenv import load_dotenv

load_dotenv()
client = AsyncIOMotorClient(os.getenv("MONGO_URL"), tlsCAFile=certifi.where())
db = client[os.getenv("MONGO_DB_NAME", "gigshield_final")]
riders_col = db.riders

async def fix():
    # Find all riders with empty email or null email
    cursor = riders_col.find({"$or": [{"email": ""}, {"email": None}, {"email": {"$exists": False}}]})
    count = 0
    async for doc in cursor:
        rider_id = doc.get("rider_id", str(doc.get("_id")))
        fake_email = f"{rider_id.lower()}@legacy.gigshield.com"
        await riders_col.update_one({"_id": doc["_id"]}, {"$set": {"email": fake_email}})
        count += 1
    print(f"Fixed {count} legacy riders by assigning fake unique emails.")

asyncio.run(fix())
