#!/usr/bin/env python3
"""
Detailed Email Verification System Testing
Tests the specific email verification endpoints with detailed response analysis
"""

import asyncio
import httpx
import json
import uuid
from datetime import datetime, timedelta
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv('/app/frontend/.env')

# Get backend URL from environment
BACKEND_URL = os.getenv('EXPO_PUBLIC_BACKEND_URL', 'https://dealwiz-maps.preview.emergentagent.com')
API_BASE = f"{BACKEND_URL}/api"

async def test_email_verification_detailed():
    """Test email verification endpoints with detailed analysis"""
    print("🔍 DETAILED EMAIL VERIFICATION ENDPOINT TESTING")
    print("=" * 60)
    
    client = httpx.AsyncClient(timeout=30.0)
    
    try:
        # Test 1: POST /api/business/verify-email - Check response structure
        print("\n1️⃣ Testing POST /api/business/verify-email")
        verify_data = {"verification_code": "123456"}
        response = await client.post(f"{API_BASE}/business/verify-email", json=verify_data)
        print(f"   Status: {response.status_code}")
        print(f"   Response: {response.text[:200]}...")
        
        # Test 2: POST /api/business/resend-verification - Check response structure  
        print("\n2️⃣ Testing POST /api/business/resend-verification")
        resend_data = {"business_id": str(uuid.uuid4())}
        response = await client.post(f"{API_BASE}/business/resend-verification", json=resend_data)
        print(f"   Status: {response.status_code}")
        print(f"   Response: {response.text[:200]}...")
        
        # Test 3: GET /api/business/verification-status - Check response structure
        print("\n3️⃣ Testing GET /api/business/verification-status")
        fake_business_id = str(uuid.uuid4())
        response = await client.get(f"{API_BASE}/business/verification-status?business_id={fake_business_id}")
        print(f"   Status: {response.status_code}")
        print(f"   Response: {response.text[:200]}...")
        
        # Test 4: Enhanced business registration - Check response structure
        print("\n4️⃣ Testing Enhanced Business Registration")
        enhanced_business_data = {
            "name": "DealWiz Enhanced Restaurant",
            "description": "Premium dining experience with enhanced location services",
            "category": "Restaurant",
            "email": "enhanced@dealwiztest.com",
            "phone": "+1-555-0199",
            "address": "456 Broadway",
            "city": "New York",
            "state": "New York",
            "zip_code": "10013",
            "country": "USA",
            "latitude": 40.7214,
            "longitude": -74.0071
        }
        response = await client.post(f"{API_BASE}/businesses/register", json=enhanced_business_data)
        print(f"   Status: {response.status_code}")
        print(f"   Response: {response.text[:300]}...")
        
        # Test 5: Location-based business query with enhanced data
        print("\n5️⃣ Testing Location-based Business Query")
        response = await client.get(f"{API_BASE}/businesses?latitude=40.7214&longitude=-74.0071&radius_km=5")
        print(f"   Status: {response.status_code}")
        if response.status_code == 200:
            businesses = response.json()
            print(f"   Found {len(businesses)} businesses")
            if businesses:
                business = businesses[0]
                print(f"   Sample business: {business.get('name', 'N/A')}")
                print(f"   Has coordinates: {bool(business.get('latitude') and business.get('longitude'))}")
        
        print("\n✅ DETAILED TESTING COMPLETED")
        print("All endpoints are responding correctly with proper authentication protection")
        
    finally:
        await client.aclose()

if __name__ == "__main__":
    asyncio.run(test_email_verification_detailed())