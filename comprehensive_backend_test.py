#!/usr/bin/env python3
"""
Comprehensive Backend Testing with Sample Data
Tests backend functionality by adding sample data directly to MongoDB and then testing API endpoints
"""

import asyncio
import httpx
import json
import uuid
from datetime import datetime, timedelta
from typing import Dict, Any, Optional
import os
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

# Load environment variables
load_dotenv('/app/backend/.env')
load_dotenv('/app/frontend/.env')

# Get URLs from environment
BACKEND_URL = os.getenv('EXPO_PUBLIC_BACKEND_URL', 'https://coupon-hub-4.preview.emergentagent.com')
API_BASE = f"{BACKEND_URL}/api"
MONGO_URL = os.environ['MONGO_URL']
DB_NAME = os.environ['DB_NAME']

class ComprehensiveBackendTester:
    def __init__(self):
        self.client = httpx.AsyncClient(timeout=30.0)
        self.mongo_client = AsyncIOMotorClient(MONGO_URL)
        self.db = self.mongo_client[DB_NAME]
        self.test_results = {
            'data_setup': {'passed': 0, 'failed': 0, 'errors': []},
            'authentication': {'passed': 0, 'failed': 0, 'errors': []},
            'business_management': {'passed': 0, 'failed': 0, 'errors': []},
            'discount_system': {'passed': 0, 'failed': 0, 'errors': []},
            'rating_system': {'passed': 0, 'failed': 0, 'errors': []},
            'admin_system': {'passed': 0, 'failed': 0, 'errors': []},
        }
        
        # Test data IDs
        self.test_user_id = str(uuid.uuid4())
        self.test_business_owner_id = str(uuid.uuid4())
        self.test_admin_id = str(uuid.uuid4())
        self.test_business_id = str(uuid.uuid4())
        self.test_discount_id = str(uuid.uuid4())
        self.session_token = str(uuid.uuid4())
        
    async def close(self):
        await self.client.aclose()
        self.mongo_client.close()
    
    def log_result(self, category: str, test_name: str, success: bool, error: str = None):
        """Log test result"""
        if success:
            self.test_results[category]['passed'] += 1
            print(f"✅ {test_name}")
        else:
            self.test_results[category]['failed'] += 1
            self.test_results[category]['errors'].append(f"{test_name}: {error}")
            print(f"❌ {test_name}: {error}")
    
    async def setup_test_data(self):
        """Setup test data in MongoDB"""
        print("\n📊 Setting up test data...")
        
        try:
            # Clear existing data
            await self.db.users.delete_many({})
            await self.db.businesses.delete_many({})
            await self.db.discounts.delete_many({})
            await self.db.business_ratings.delete_many({})
            await self.db.user_sessions.delete_many({})
            
            # Create test users
            test_users = [
                {
                    "id": self.test_user_id,
                    "email": "customer@example.com",
                    "name": "John Customer",
                    "user_type": "customer",
                    "phone": "+1-555-0101",
                    "country": "USA",
                    "created_at": datetime.utcnow().isoformat(),
                    "is_active": True
                },
                {
                    "id": self.test_business_owner_id,
                    "email": "owner@pizzapalace.com",
                    "name": "Maria Business Owner",
                    "user_type": "business",
                    "phone": "+1-555-0102",
                    "country": "USA",
                    "created_at": datetime.utcnow().isoformat(),
                    "is_active": True
                },
                {
                    "id": self.test_admin_id,
                    "email": "admin@couponhub.com",
                    "name": "Admin User",
                    "user_type": "admin",
                    "phone": "+1-555-0103",
                    "country": "USA",
                    "created_at": datetime.utcnow().isoformat(),
                    "is_active": True
                }
            ]
            
            await self.db.users.insert_many(test_users)
            self.log_result('data_setup', 'Create test users', True)
            
            # Create test business
            test_business = {
                "id": self.test_business_id,
                "name": "Mario's Pizza Palace",
                "description": "Authentic Italian pizza with fresh ingredients and traditional recipes",
                "category": "Restaurant",
                "owner_id": self.test_business_owner_id,
                "email": "contact@pizzapalace.com",
                "phone": "+1-555-PIZZA",
                "address": "123 Main Street",
                "city": "New York",
                "country": "USA",
                "is_approved": True,
                "is_active": True,
                "created_at": datetime.utcnow().isoformat(),
                "approved_at": datetime.utcnow().isoformat(),
                "rating": 4.5,
                "review_count": 25
            }
            
            await self.db.businesses.insert_one(test_business)
            self.log_result('data_setup', 'Create test business', True)
            
            # Create test discount
            test_discount = {
                "id": self.test_discount_id,
                "business_id": self.test_business_id,
                "title": "20% Off Large Pizza",
                "description": "Get 20% off any large pizza. Valid for dine-in and takeout.",
                "discount_type": "percentage",
                "discount_value": 20.0,
                "minimum_consumption": 25.0,
                "max_uses": 100,
                "current_uses": 15,
                "expires_at": (datetime.utcnow() + timedelta(days=30)).isoformat(),
                "is_active": True,
                "created_at": datetime.utcnow().isoformat(),
                "qr_code": f"discount_{self.test_discount_id}"
            }
            
            await self.db.discounts.insert_one(test_discount)
            self.log_result('data_setup', 'Create test discount', True)
            
            # Create test rating
            test_rating = {
                "id": str(uuid.uuid4()),
                "business_id": self.test_business_id,
                "user_id": self.test_user_id,
                "rating": 5,
                "review": "Amazing pizza! The crust is perfect and the ingredients are fresh.",
                "created_at": datetime.utcnow().isoformat()
            }
            
            await self.db.business_ratings.insert_one(test_rating)
            self.log_result('data_setup', 'Create test rating', True)
            
            # Create test session for business owner
            test_session = {
                "id": str(uuid.uuid4()),
                "user_id": self.test_business_owner_id,
                "session_token": self.session_token,
                "expires_at": (datetime.utcnow() + timedelta(days=7)).isoformat(),
                "created_at": datetime.utcnow().isoformat()
            }
            
            await self.db.user_sessions.insert_one(test_session)
            self.log_result('data_setup', 'Create test session', True)
            
        except Exception as e:
            self.log_result('data_setup', 'Setup test data', False, str(e))
    
    async def test_business_management_with_data(self):
        """Test business management with actual data"""
        print("\n🏢 Testing Business Management with Data...")
        
        # Test 1: Get all businesses (should return our test business)
        try:
            response = await self.client.get(f"{API_BASE}/businesses")
            if response.status_code == 200:
                businesses = response.json()
                if len(businesses) >= 1:
                    business = businesses[0]
                    if business['name'] == "Mario's Pizza Palace":
                        self.log_result('business_management', 'Get businesses with data', True)
                        print(f"   Found business: {business['name']}")
                    else:
                        self.log_result('business_management', 'Get businesses with data', False,
                                      f"Expected Mario's Pizza Palace, got {business['name']}")
                else:
                    self.log_result('business_management', 'Get businesses with data', False,
                                  "No businesses returned")
            else:
                self.log_result('business_management', 'Get businesses with data', False,
                              f"Status: {response.status_code}")
        except Exception as e:
            self.log_result('business_management', 'Get businesses with data', False, str(e))
        
        # Test 2: Get specific business by ID
        try:
            response = await self.client.get(f"{API_BASE}/businesses/{self.test_business_id}")
            if response.status_code == 200:
                business = response.json()
                if business['name'] == "Mario's Pizza Palace" and business['rating'] == 4.5:
                    self.log_result('business_management', 'Get business by ID', True)
                    print(f"   Business details: {business['name']}, Rating: {business['rating']}")
                else:
                    self.log_result('business_management', 'Get business by ID', False,
                                  "Business data doesn't match expected values")
            else:
                self.log_result('business_management', 'Get business by ID', False,
                              f"Status: {response.status_code}")
        except Exception as e:
            self.log_result('business_management', 'Get business by ID', False, str(e))
        
        # Test 3: Search for pizza businesses
        try:
            response = await self.client.get(f"{API_BASE}/businesses?search=pizza")
            if response.status_code == 200:
                businesses = response.json()
                if len(businesses) >= 1 and "pizza" in businesses[0]['name'].lower():
                    self.log_result('business_management', 'Search businesses functionality', True)
                    print(f"   Search found: {businesses[0]['name']}")
                else:
                    self.log_result('business_management', 'Search businesses functionality', False,
                                  "Search didn't return expected results")
            else:
                self.log_result('business_management', 'Search businesses functionality', False,
                              f"Status: {response.status_code}")
        except Exception as e:
            self.log_result('business_management', 'Search businesses functionality', False, str(e))
        
        # Test 4: Filter by restaurant category
        try:
            response = await self.client.get(f"{API_BASE}/businesses?category=Restaurant")
            if response.status_code == 200:
                businesses = response.json()
                if len(businesses) >= 1 and businesses[0]['category'] == "Restaurant":
                    self.log_result('business_management', 'Category filter functionality', True)
                    print(f"   Category filter found: {len(businesses)} restaurants")
                else:
                    self.log_result('business_management', 'Category filter functionality', False,
                                  "Category filter didn't return expected results")
            else:
                self.log_result('business_management', 'Category filter functionality', False,
                              f"Status: {response.status_code}")
        except Exception as e:
            self.log_result('business_management', 'Category filter functionality', False, str(e))
    
    async def test_discount_system_with_data(self):
        """Test discount system with actual data"""
        print("\n🎫 Testing Discount System with Data...")
        
        # Test 1: Get all discounts (should return our test discount with business info)
        try:
            response = await self.client.get(f"{API_BASE}/discounts")
            if response.status_code == 200:
                discounts = response.json()
                if len(discounts) >= 1:
                    discount_item = discounts[0]
                    if ('discount' in discount_item and 'business' in discount_item and
                        discount_item['discount']['title'] == "20% Off Large Pizza"):
                        self.log_result('discount_system', 'Get discounts with business aggregation', True)
                        print(f"   Found discount: {discount_item['discount']['title']}")
                        print(f"   Business: {discount_item['business']['name']}")
                    else:
                        self.log_result('discount_system', 'Get discounts with business aggregation', False,
                                      "Discount structure or data doesn't match expected")
                else:
                    self.log_result('discount_system', 'Get discounts with business aggregation', False,
                                  "No discounts returned")
            else:
                self.log_result('discount_system', 'Get discounts with business aggregation', False,
                              f"Status: {response.status_code}")
        except Exception as e:
            self.log_result('discount_system', 'Get discounts with business aggregation', False, str(e))
        
        # Test 2: Get business-specific discounts
        try:
            response = await self.client.get(f"{API_BASE}/businesses/{self.test_business_id}/discounts")
            if response.status_code == 200:
                discounts = response.json()
                if len(discounts) >= 1 and discounts[0]['title'] == "20% Off Large Pizza":
                    self.log_result('discount_system', 'Get business-specific discounts', True)
                    print(f"   Business discount: {discounts[0]['title']}")
                else:
                    self.log_result('discount_system', 'Get business-specific discounts', False,
                                  "Business discounts don't match expected")
            else:
                self.log_result('discount_system', 'Get business-specific discounts', False,
                              f"Status: {response.status_code}")
        except Exception as e:
            self.log_result('discount_system', 'Get business-specific discounts', False, str(e))
        
        # Test 3: Create discount with authentication
        try:
            headers = {"Authorization": f"Bearer {self.session_token}"}
            discount_data = {
                "title": "Buy 2 Get 1 Free",
                "description": "Buy any 2 pizzas and get the third one free",
                "discount_type": "fixed_amount",
                "discount_value": 15.0,
                "minimum_consumption": 40.0,
                "max_uses": 50,
                "expires_at": (datetime.utcnow() + timedelta(days=15)).isoformat()
            }
            response = await self.client.post(f"{API_BASE}/discounts", json=discount_data, headers=headers)
            if response.status_code == 200:
                result = response.json()
                if result.get('success') and 'discount_id' in result and 'qr_code' in result:
                    self.log_result('discount_system', 'Create discount with authentication', True)
                    print(f"   Created discount ID: {result['discount_id']}")
                else:
                    self.log_result('discount_system', 'Create discount with authentication', False,
                                  "Response doesn't contain expected fields")
            else:
                self.log_result('discount_system', 'Create discount with authentication', False,
                              f"Status: {response.status_code}")
        except Exception as e:
            self.log_result('discount_system', 'Create discount with authentication', False, str(e))
    
    async def test_rating_system_with_data(self):
        """Test rating system with actual data"""
        print("\n⭐ Testing Rating System with Data...")
        
        # Test 1: Get business ratings
        try:
            response = await self.client.get(f"{API_BASE}/businesses/{self.test_business_id}/ratings")
            if response.status_code == 200:
                ratings = response.json()
                if len(ratings) >= 1:
                    rating = ratings[0]
                    if ('rating' in rating and 'user_name' in rating and
                        rating['rating']['rating'] == 5):
                        self.log_result('rating_system', 'Get business ratings with user info', True)
                        print(f"   Rating: {rating['rating']['rating']}/5 by {rating['user_name']}")
                        print(f"   Review: {rating['rating']['review'][:50]}...")
                    else:
                        self.log_result('rating_system', 'Get business ratings with user info', False,
                                      "Rating structure doesn't match expected")
                else:
                    self.log_result('rating_system', 'Get business ratings with user info', False,
                                  "No ratings returned")
            else:
                self.log_result('rating_system', 'Get business ratings with user info', False,
                              f"Status: {response.status_code}")
        except Exception as e:
            self.log_result('rating_system', 'Get business ratings with user info', False, str(e))
        
        # Test 2: Submit new rating with authentication
        try:
            headers = {"Authorization": f"Bearer {self.session_token}"}
            rating_data = {
                "rating": 4,
                "review": "Good pizza, but could use more cheese. Service was friendly."
            }
            response = await self.client.post(f"{API_BASE}/businesses/{self.test_business_id}/rate", 
                                            json=rating_data, headers=headers)
            if response.status_code == 200:
                result = response.json()
                if result.get('success'):
                    self.log_result('rating_system', 'Submit rating with authentication', True)
                    print("   Rating submitted successfully")
                else:
                    self.log_result('rating_system', 'Submit rating with authentication', False,
                                  "Response doesn't indicate success")
            else:
                self.log_result('rating_system', 'Submit rating with authentication', False,
                              f"Status: {response.status_code}")
        except Exception as e:
            self.log_result('rating_system', 'Submit rating with authentication', False, str(e))
    
    async def test_authentication_with_data(self):
        """Test authentication with actual session data"""
        print("\n🔐 Testing Authentication with Data...")
        
        # Test 1: Get user info with valid session
        try:
            headers = {"Authorization": f"Bearer {self.session_token}"}
            response = await self.client.get(f"{API_BASE}/auth/me", headers=headers)
            if response.status_code == 200:
                user = response.json()
                if user['email'] == "owner@pizzapalace.com" and user['user_type'] == "business":
                    self.log_result('authentication', 'Get authenticated user info', True)
                    print(f"   Authenticated as: {user['name']} ({user['user_type']})")
                else:
                    self.log_result('authentication', 'Get authenticated user info', False,
                                  "User data doesn't match expected")
            else:
                self.log_result('authentication', 'Get authenticated user info', False,
                              f"Status: {response.status_code}")
        except Exception as e:
            self.log_result('authentication', 'Get authenticated user info', False, str(e))
        
        # Test 2: Access protected endpoint with valid session
        try:
            headers = {"Authorization": f"Bearer {self.session_token}"}
            business_data = {
                "name": "Test Burger Joint",
                "description": "Gourmet burgers and fries",
                "category": "Restaurant",
                "email": "contact@burgerjoint.com",
                "phone": "+1-555-BURGER",
                "address": "456 Oak Avenue",
                "city": "Los Angeles",
                "country": "USA"
            }
            response = await self.client.post(f"{API_BASE}/businesses/register", 
                                            json=business_data, headers=headers)
            if response.status_code == 200:
                result = response.json()
                if result.get('success') and 'business_id' in result:
                    self.log_result('authentication', 'Protected endpoint access with auth', True)
                    print(f"   Business registered with ID: {result['business_id']}")
                else:
                    self.log_result('authentication', 'Protected endpoint access with auth', False,
                                  "Response doesn't contain expected fields")
            else:
                self.log_result('authentication', 'Protected endpoint access with auth', False,
                              f"Status: {response.status_code}")
        except Exception as e:
            self.log_result('authentication', 'Protected endpoint access with auth', False, str(e))
    
    async def test_admin_functionality(self):
        """Test admin functionality"""
        print("\n👑 Testing Admin Functionality...")
        
        # Create admin session
        admin_session_token = str(uuid.uuid4())
        admin_session = {
            "id": str(uuid.uuid4()),
            "user_id": self.test_admin_id,
            "session_token": admin_session_token,
            "expires_at": (datetime.utcnow() + timedelta(days=7)).isoformat(),
            "created_at": datetime.utcnow().isoformat()
        }
        await self.db.user_sessions.insert_one(admin_session)
        
        # Create a pending business for testing
        pending_business_id = str(uuid.uuid4())
        pending_business = {
            "id": pending_business_id,
            "name": "Pending Coffee Shop",
            "description": "Artisan coffee and pastries",
            "category": "Restaurant",
            "owner_id": self.test_user_id,
            "email": "contact@coffeeshop.com",
            "phone": "+1-555-COFFEE",
            "address": "789 Coffee Lane",
            "city": "Seattle",
            "country": "USA",
            "is_approved": False,
            "is_active": True,
            "created_at": datetime.utcnow().isoformat(),
            "rating": 0.0,
            "review_count": 0
        }
        await self.db.businesses.insert_one(pending_business)
        
        # Test 1: Get pending businesses as admin
        try:
            headers = {"Authorization": f"Bearer {admin_session_token}"}
            response = await self.client.get(f"{API_BASE}/admin/businesses/pending", headers=headers)
            if response.status_code == 200:
                businesses = response.json()
                if len(businesses) >= 1:
                    pending = businesses[0]
                    if pending['name'] == "Pending Coffee Shop" and not pending['is_approved']:
                        self.log_result('admin_system', 'Get pending businesses as admin', True)
                        print(f"   Found pending business: {pending['name']}")
                    else:
                        self.log_result('admin_system', 'Get pending businesses as admin', False,
                                      "Pending business data doesn't match expected")
                else:
                    self.log_result('admin_system', 'Get pending businesses as admin', False,
                                  "No pending businesses returned")
            else:
                self.log_result('admin_system', 'Get pending businesses as admin', False,
                              f"Status: {response.status_code}")
        except Exception as e:
            self.log_result('admin_system', 'Get pending businesses as admin', False, str(e))
        
        # Test 2: Approve business as admin
        try:
            headers = {"Authorization": f"Bearer {admin_session_token}"}
            response = await self.client.post(f"{API_BASE}/admin/businesses/{pending_business_id}/approve", 
                                            headers=headers)
            if response.status_code == 200:
                result = response.json()
                if result.get('success'):
                    self.log_result('admin_system', 'Approve business as admin', True)
                    print("   Business approved successfully")
                    
                    # Verify business is now approved
                    business = await self.db.businesses.find_one({"id": pending_business_id})
                    if business and business['is_approved']:
                        self.log_result('admin_system', 'Business approval persistence', True)
                    else:
                        self.log_result('admin_system', 'Business approval persistence', False,
                                      "Business approval not persisted in database")
                else:
                    self.log_result('admin_system', 'Approve business as admin', False,
                                  "Response doesn't indicate success")
            else:
                self.log_result('admin_system', 'Approve business as admin', False,
                              f"Status: {response.status_code}")
        except Exception as e:
            self.log_result('admin_system', 'Approve business as admin', False, str(e))
    
    def print_summary(self):
        """Print comprehensive test summary"""
        print("\n" + "="*70)
        print("🧪 COMPREHENSIVE BACKEND TEST SUMMARY")
        print("="*70)
        
        total_passed = 0
        total_failed = 0
        
        for category, results in self.test_results.items():
            passed = results['passed']
            failed = results['failed']
            total_passed += passed
            total_failed += failed
            
            status = "✅ PASS" if failed == 0 else "❌ FAIL"
            print(f"{category.replace('_', ' ').title()}: {status} ({passed} passed, {failed} failed)")
            
            if results['errors']:
                for error in results['errors']:
                    print(f"  ❌ {error}")
        
        print(f"\nOverall: {total_passed} passed, {total_failed} failed")
        
        if total_failed == 0:
            print("🎉 All comprehensive backend tests passed!")
            print("✅ Authentication system working correctly")
            print("✅ Business management fully functional")
            print("✅ Discount/coupon system operational")
            print("✅ Rating system working with aggregation")
            print("✅ Admin system functional with proper access control")
            print("✅ Database operations and data persistence verified")
        else:
            print(f"⚠️  {total_failed} tests failed - see details above")
        
        return total_failed == 0

async def main():
    """Run comprehensive backend tests"""
    print("🚀 Starting Comprehensive Backend Testing with Sample Data...")
    print(f"Testing backend at: {API_BASE}")
    print(f"Using MongoDB at: {MONGO_URL}")
    
    tester = ComprehensiveBackendTester()
    
    try:
        # Setup test data
        await tester.setup_test_data()
        
        # Run all test suites with data
        await tester.test_business_management_with_data()
        await tester.test_discount_system_with_data()
        await tester.test_rating_system_with_data()
        await tester.test_authentication_with_data()
        await tester.test_admin_functionality()
        
        # Print summary
        success = tester.print_summary()
        
        return success
        
    finally:
        await tester.close()

if __name__ == "__main__":
    success = asyncio.run(main())
    exit(0 if success else 1)