import requests
import json
import asyncio
import os
from motor.motor_asyncio import AsyncIOMotorClient
import certifi
from dotenv import load_dotenv

load_dotenv()
client = AsyncIOMotorClient(os.getenv("MONGO_URL"), tlsCAFile=certifi.where())
db = client[os.getenv("MONGO_DB_NAME", "gigshield_final")]
riders_col = db.riders

API_URL = "http://127.0.0.1:8000"

def test_api_and_db():
    print("--- 1. Testing Registration Endpoint ---")
    reg_data = {
        "name": "Integration Test Rider",
        "phone": "+910000000000",
        "email": "integration.test@example.com",
        "age": 22,
        "city": "Testville",
        "avg_daily_income": 400.0,
        "password": "testpassword123"
    }
    
    res = requests.post(f"{API_URL}/auth/register", json=reg_data)
    print(f"Register Status Code: {res.status_code}")
    if res.status_code == 200:
        print("Registration Response:", res.json().get("message", "").split('\n')[0])
    elif res.status_code == 409:
        print("Test rider already exists (409). Continuing to login test.")
    else:
        print("Error:", res.text)
        
    print("\n--- 2. Testing Login Endpoint ---")
    login_data = {
        "email": "integration.test@example.com",
        "password": "testpassword123"
    }
    res = requests.post(f"{API_URL}/auth/login", json=login_data)
    print(f"Login Status Code: {res.status_code}")
    if res.status_code == 200:
        print("Login Success! Token received.")
    else:
        print("Login Failed:", res.text)

async def check_db():
    print("\n--- 3. Verifying Database Raw State ---")
    rider = await riders_col.find_one({"email": "integration.test@example.com"})
    if rider:
        print("✅ Document found in MongoDB!")
        print(" - UID:", rider.get("rider_id"))
        print(" - Name:", rider.get("name"))
        print(" - Email:", rider.get("email"))
        print(" - Balance:", rider.get("balance"))
        print(" - Schema Keys Check:", "Yes" if "has_active_policy" in rider and "ban_history" in rider else "No")
    else:
        print("❌ Document NOT found in DB!")

if __name__ == "__main__":
    try:
        test_api_and_db()
        asyncio.run(check_db())
    except Exception as e:
        print(f"Test script failed: {e}")
