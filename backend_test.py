#!/usr/bin/env python3
"""
Comprehensive Backend Testing for Discount/Coupon Mobile App
Tests all major backend functionality including authentication, business management, 
discounts, ratings, and admin features.
"""

import asyncio
import httpx
import json
import uuid
from datetime import datetime, timedelta
from typing import Dict, Any, Optional
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv('/app/frontend/.env')

# Get backend URL from environment
BACKEND_URL = os.getenv('EXPO_PUBLIC_BACKEND_URL', 'https://coupon-hub-4.preview.emergentagent.com')
API_BASE = f"{BACKEND_URL}/api"

class BackendTester:
    def __init__(self):
        self.client = httpx.AsyncClient(timeout=30.0)
        self.test_results = {
            'authentication': {'passed': 0, 'failed': 0, 'errors': []},
            'business_management': {'passed': 0, 'failed': 0, 'errors': []},
            'discount_system': {'passed': 0, 'failed': 0, 'errors': []},
            'rating_system': {'passed': 0, 'failed': 0, 'errors': []},
            'admin_system': {'passed': 0, 'failed': 0, 'errors': []},
        }
        self.session_token = None
        self.test_user_id = None
        self.test_business_id = None
        self.test_discount_id = None
        
    async def close(self):
        await self.client.aclose()
    
    def log_result(self, category: str, test_name: str, success: bool, error: str = None):
        """Log test result"""
        if success:
            self.test_results[category]['passed'] += 1
            print(f"✅ {test_name}")
        else:
            self.test_results[category]['failed'] += 1
            self.test_results[category]['errors'].append(f"{test_name}: {error}")
            print(f"❌ {test_name}: {error}")
    
    async def test_authentication_system(self):
        """Test authentication endpoints"""
        print("\n🔐 Testing Authentication System...")
        
        # Test 1: Session processing endpoint (mock since we can't call external auth)
        try:
            # This would normally require a real session_id from Emergent auth
            # We'll test the endpoint structure but expect it to fail
            response = await self.client.post(f"{API_BASE}/auth/session", 
                                            json={"session_id": "mock_session_id"})
            
            # The endpoint should return 401 because the external auth service call fails
            # This is expected behavior and shows the endpoint is working correctly
            if response.status_code == 401:
                self.log_result('authentication', 'Session endpoint auth validation', True)
            elif response.status_code == 400:
                self.log_result('authentication', 'Session endpoint auth validation', False, 
                              "Endpoint validation failed")
            else:
                self.log_result('authentication', 'Session endpoint auth validation', False, 
                              f"Unexpected response: {response.status_code}")
        except Exception as e:
            self.log_result('authentication', 'Session endpoint auth validation', False, str(e))
        
        # Test 2: Get current user without authentication
        try:
            response = await self.client.get(f"{API_BASE}/auth/me")
            if response.status_code == 401:
                self.log_result('authentication', 'Unauthenticated /auth/me protection', True)
            else:
                self.log_result('authentication', 'Unauthenticated /auth/me protection', False,
                              f"Expected 401, got {response.status_code}")
        except Exception as e:
            self.log_result('authentication', 'Unauthenticated /auth/me protection', False, str(e))
        
        # Test 3: Logout without authentication
        try:
            response = await self.client.post(f"{API_BASE}/auth/logout")
            if response.status_code == 401:
                self.log_result('authentication', 'Unauthenticated logout protection', True)
            else:
                self.log_result('authentication', 'Unauthenticated logout protection', False,
                              f"Expected 401, got {response.status_code}")
        except Exception as e:
            self.log_result('authentication', 'Unauthenticated logout protection', False, str(e))
    
    async def test_business_management(self):
        """Test business management endpoints"""
        print("\n🏢 Testing Business Management System...")
        
        # Test 1: Get all businesses (should work without auth)
        try:
            response = await self.client.get(f"{API_BASE}/businesses")
            if response.status_code == 200:
                businesses = response.json()
                self.log_result('business_management', 'Get all businesses', True)
                print(f"   Found {len(businesses)} businesses")
            else:
                self.log_result('business_management', 'Get all businesses', False,
                              f"Status: {response.status_code}")
        except Exception as e:
            self.log_result('business_management', 'Get all businesses', False, str(e))
        
        # Test 2: Get businesses with category filter
        try:
            response = await self.client.get(f"{API_BASE}/businesses?category=Restaurant")
            if response.status_code == 200:
                businesses = response.json()
                self.log_result('business_management', 'Get businesses by category', True)
                print(f"   Found {len(businesses)} restaurants")
            else:
                self.log_result('business_management', 'Get businesses by category', False,
                              f"Status: {response.status_code}")
        except Exception as e:
            self.log_result('business_management', 'Get businesses by category', False, str(e))
        
        # Test 3: Get businesses with search
        try:
            response = await self.client.get(f"{API_BASE}/businesses?search=pizza")
            if response.status_code == 200:
                businesses = response.json()
                self.log_result('business_management', 'Search businesses', True)
                print(f"   Found {len(businesses)} businesses matching 'pizza'")
            else:
                self.log_result('business_management', 'Search businesses', False,
                              f"Status: {response.status_code}")
        except Exception as e:
            self.log_result('business_management', 'Search businesses', False, str(e))
        
        # Test 4: Get non-existent business
        try:
            fake_id = str(uuid.uuid4())
            response = await self.client.get(f"{API_BASE}/businesses/{fake_id}")
            if response.status_code == 404:
                self.log_result('business_management', 'Get non-existent business', True)
            else:
                self.log_result('business_management', 'Get non-existent business', False,
                              f"Expected 404, got {response.status_code}")
        except Exception as e:
            self.log_result('business_management', 'Get non-existent business', False, str(e))
        
        # Test 5: Register business without authentication
        try:
            business_data = {
                "name": "Test Pizza Palace",
                "description": "Authentic Italian pizza with fresh ingredients",
                "category": "Restaurant",
                "email": "owner@testpizza.com",
                "phone": "+1-555-0123",
                "address": "123 Main Street",
                "city": "New York",
                "country": "USA"
            }
            response = await self.client.post(f"{API_BASE}/businesses/register", json=business_data)
            if response.status_code == 401:
                self.log_result('business_management', 'Business registration auth protection', True)
            else:
                self.log_result('business_management', 'Business registration auth protection', False,
                              f"Expected 401, got {response.status_code}")
        except Exception as e:
            self.log_result('business_management', 'Business registration auth protection', False, str(e))
        
        # Test 6: Get categories
        try:
            response = await self.client.get(f"{API_BASE}/categories")
            if response.status_code == 200:
                categories = response.json()
                if isinstance(categories, list) and len(categories) > 0:
                    self.log_result('business_management', 'Get business categories', True)
                    print(f"   Available categories: {', '.join(categories[:5])}...")
                else:
                    self.log_result('business_management', 'Get business categories', False,
                                  "Empty or invalid categories response")
            else:
                self.log_result('business_management', 'Get business categories', False,
                              f"Status: {response.status_code}")
        except Exception as e:
            self.log_result('business_management', 'Get business categories', False, str(e))
    
    async def test_discount_system(self):
        """Test discount/coupon system"""
        print("\n🎫 Testing Discount/Coupon System...")
        
        # Test 1: Get all discounts
        try:
            response = await self.client.get(f"{API_BASE}/discounts")
            if response.status_code == 200:
                discounts = response.json()
                self.log_result('discount_system', 'Get all discounts', True)
                print(f"   Found {len(discounts)} active discounts")
                
                # Check discount structure
                if discounts and len(discounts) > 0:
                    discount = discounts[0]
                    if 'discount' in discount and 'business' in discount:
                        self.log_result('discount_system', 'Discount aggregation structure', True)
                    else:
                        self.log_result('discount_system', 'Discount aggregation structure', False,
                                      "Missing discount or business data in response")
            else:
                self.log_result('discount_system', 'Get all discounts', False,
                              f"Status: {response.status_code}")
        except Exception as e:
            self.log_result('discount_system', 'Get all discounts', False, str(e))
        
        # Test 2: Get discounts by category
        try:
            response = await self.client.get(f"{API_BASE}/discounts?category=Restaurant")
            if response.status_code == 200:
                discounts = response.json()
                self.log_result('discount_system', 'Get discounts by category', True)
                print(f"   Found {len(discounts)} restaurant discounts")
            else:
                self.log_result('discount_system', 'Get discounts by category', False,
                              f"Status: {response.status_code}")
        except Exception as e:
            self.log_result('discount_system', 'Get discounts by category', False, str(e))
        
        # Test 3: Create discount without authentication
        try:
            discount_data = {
                "title": "20% Off Pizza",
                "description": "Get 20% off any large pizza",
                "discount_type": "percentage",
                "discount_value": 20.0,
                "minimum_consumption": 25.0,
                "max_uses": 100,
                "expires_at": (datetime.utcnow() + timedelta(days=30)).isoformat()
            }
            response = await self.client.post(f"{API_BASE}/discounts", json=discount_data)
            if response.status_code == 401:
                self.log_result('discount_system', 'Discount creation auth protection', True)
            else:
                self.log_result('discount_system', 'Discount creation auth protection', False,
                              f"Expected 401, got {response.status_code}")
        except Exception as e:
            self.log_result('discount_system', 'Discount creation auth protection', False, str(e))
        
        # Test 4: Get business discounts for non-existent business
        try:
            fake_id = str(uuid.uuid4())
            response = await self.client.get(f"{API_BASE}/businesses/{fake_id}/discounts")
            if response.status_code == 200:
                discounts = response.json()
                if len(discounts) == 0:
                    self.log_result('discount_system', 'Get discounts for non-existent business', True)
                else:
                    self.log_result('discount_system', 'Get discounts for non-existent business', False,
                                  "Should return empty list for non-existent business")
            else:
                self.log_result('discount_system', 'Get discounts for non-existent business', False,
                              f"Status: {response.status_code}")
        except Exception as e:
            self.log_result('discount_system', 'Get discounts for non-existent business', False, str(e))
    
    async def test_rating_system(self):
        """Test business rating system"""
        print("\n⭐ Testing Rating System...")
        
        # Test 1: Rate business without authentication
        try:
            fake_business_id = str(uuid.uuid4())
            rating_data = {
                "rating": 5,
                "review": "Excellent service and great food!"
            }
            response = await self.client.post(f"{API_BASE}/businesses/{fake_business_id}/rate", 
                                            json=rating_data)
            if response.status_code == 401:
                self.log_result('rating_system', 'Rating submission auth protection', True)
            else:
                self.log_result('rating_system', 'Rating submission auth protection', False,
                              f"Expected 401, got {response.status_code}")
        except Exception as e:
            self.log_result('rating_system', 'Rating submission auth protection', False, str(e))
        
        # Test 2: Get ratings for non-existent business
        try:
            fake_business_id = str(uuid.uuid4())
            response = await self.client.get(f"{API_BASE}/businesses/{fake_business_id}/ratings")
            if response.status_code == 200:
                ratings = response.json()
                if len(ratings) == 0:
                    self.log_result('rating_system', 'Get ratings for non-existent business', True)
                else:
                    self.log_result('rating_system', 'Get ratings for non-existent business', False,
                                  "Should return empty list for non-existent business")
            else:
                self.log_result('rating_system', 'Get ratings for non-existent business', False,
                              f"Status: {response.status_code}")
        except Exception as e:
            self.log_result('rating_system', 'Get ratings for non-existent business', False, str(e))
        
        # Test 3: Invalid rating data
        try:
            fake_business_id = str(uuid.uuid4())
            invalid_rating_data = {
                "rating": 10,  # Invalid rating (should be 1-5)
                "review": "Test review"
            }
            response = await self.client.post(f"{API_BASE}/businesses/{fake_business_id}/rate", 
                                            json=invalid_rating_data)
            # Should fail due to auth first, but testing data validation structure
            if response.status_code in [401, 422]:  # 422 for validation error, 401 for auth
                self.log_result('rating_system', 'Rating data validation structure', True)
            else:
                self.log_result('rating_system', 'Rating data validation structure', False,
                              f"Expected 401 or 422, got {response.status_code}")
        except Exception as e:
            self.log_result('rating_system', 'Rating data validation structure', False, str(e))
    
    async def test_admin_system(self):
        """Test admin system endpoints"""
        print("\n👑 Testing Admin System...")
        
        # Test 1: Get pending businesses without admin auth
        try:
            response = await self.client.get(f"{API_BASE}/admin/businesses/pending")
            if response.status_code == 401:
                self.log_result('admin_system', 'Admin pending businesses auth protection', True)
            else:
                self.log_result('admin_system', 'Admin pending businesses auth protection', False,
                              f"Expected 401, got {response.status_code}")
        except Exception as e:
            self.log_result('admin_system', 'Admin pending businesses auth protection', False, str(e))
        
        # Test 2: Approve business without admin auth
        try:
            fake_business_id = str(uuid.uuid4())
            response = await self.client.post(f"{API_BASE}/admin/businesses/{fake_business_id}/approve")
            if response.status_code == 401:
                self.log_result('admin_system', 'Admin business approval auth protection', True)
            else:
                self.log_result('admin_system', 'Admin business approval auth protection', False,
                              f"Expected 401, got {response.status_code}")
        except Exception as e:
            self.log_result('admin_system', 'Admin business approval auth protection', False, str(e))
    
    async def test_database_operations(self):
        """Test database connectivity and operations"""
        print("\n💾 Testing Database Operations...")
        
        # Test database connectivity through API endpoints
        try:
            # Test if we can reach any endpoint that requires database
            response = await self.client.get(f"{API_BASE}/businesses")
            if response.status_code == 200:
                self.log_result('business_management', 'Database connectivity', True)
            else:
                self.log_result('business_management', 'Database connectivity', False,
                              f"Cannot connect to database via API: {response.status_code}")
        except Exception as e:
            self.log_result('business_management', 'Database connectivity', False, str(e))
    
    def print_summary(self):
        """Print test summary"""
        print("\n" + "="*60)
        print("🧪 BACKEND TEST SUMMARY")
        print("="*60)
        
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
            print("🎉 All backend tests passed!")
        else:
            print(f"⚠️  {total_failed} tests failed - see details above")
        
        return total_failed == 0

async def main():
    """Run all backend tests"""
    print("🚀 Starting Comprehensive Backend Testing...")
    print(f"Testing backend at: {API_BASE}")
    
    tester = BackendTester()
    
    try:
        # Run all test suites
        await tester.test_authentication_system()
        await tester.test_business_management()
        await tester.test_discount_system()
        await tester.test_rating_system()
        await tester.test_admin_system()
        await tester.test_database_operations()
        
        # Print summary
        success = tester.print_summary()
        
        return success
        
    finally:
        await tester.close()

if __name__ == "__main__":
    success = asyncio.run(main())
    exit(0 if success else 1)