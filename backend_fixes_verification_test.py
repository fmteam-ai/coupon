#!/usr/bin/env python3
"""
Backend Fixes Verification Test
Tests specifically the previously failing endpoints that were mentioned in the review request.
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
BACKEND_URL = os.getenv('EXPO_PUBLIC_BACKEND_URL', 'https://dealwiz-backend-fix--2denlr8a.preview.emergentagent.com')
API_BASE = f"{BACKEND_URL}/api"

class BackendFixesVerificationTester:
    def __init__(self):
        self.client = httpx.AsyncClient(timeout=30.0)
        self.test_results = {
            'subscription_plans': {'passed': 0, 'failed': 0, 'errors': []},
            'verification_endpoints': {'passed': 0, 'failed': 0, 'errors': []},
            'admin_platform_endpoints': {'passed': 0, 'failed': 0, 'errors': []},
            'payment_integration': {'passed': 0, 'failed': 0, 'errors': []},
            'business_approval': {'passed': 0, 'failed': 0, 'errors': []},
        }
        
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
    
    async def test_subscription_plans_endpoint(self):
        """Test subscription plans endpoint - was returning 500 due to ObjectId serialization"""
        print("\n💳 Testing Subscription Plans Endpoint...")
        
        try:
            response = await self.client.get(f"{API_BASE}/subscription-plans")
            if response.status_code == 200:
                try:
                    plans = response.json()
                    if isinstance(plans, list):
                        self.log_result('subscription_plans', 'Subscription plans endpoint returns 200 with valid JSON', True)
                        print(f"   Found {len(plans)} subscription plans")
                        
                        # Check for proper JSON serialization (no ObjectId errors)
                        for plan in plans:
                            if isinstance(plan, dict) and 'id' in plan and 'name' in plan:
                                continue
                            else:
                                self.log_result('subscription_plans', 'Subscription plans JSON structure validation', False,
                                              f"Invalid plan structure: {plan}")
                                return
                        
                        self.log_result('subscription_plans', 'Subscription plans JSON serialization (no ObjectId errors)', True)
                    else:
                        self.log_result('subscription_plans', 'Subscription plans endpoint returns 200 with valid JSON', False,
                                      f"Expected list, got {type(plans)}")
                except json.JSONDecodeError as e:
                    self.log_result('subscription_plans', 'Subscription plans endpoint returns 200 with valid JSON', False,
                                  f"JSON decode error: {e}")
            else:
                self.log_result('subscription_plans', 'Subscription plans endpoint returns 200 with valid JSON', False,
                              f"Expected 200, got {response.status_code}")
        except Exception as e:
            self.log_result('subscription_plans', 'Subscription plans endpoint returns 200 with valid JSON', False, str(e))
    
    async def test_verification_endpoints(self):
        """Test verification endpoints - should return 401 (properly protected) instead of 404"""
        print("\n📧 Testing Verification Endpoints...")
        
        # Test 1: POST /api/send-email-verification
        try:
            verification_data = {
                "email": "test@example.com"
            }
            response = await self.client.post(f"{API_BASE}/send-email-verification", json=verification_data)
            if response.status_code == 401:
                self.log_result('verification_endpoints', 'POST /api/send-email-verification returns 401 (properly protected)', True)
            elif response.status_code == 404:
                self.log_result('verification_endpoints', 'POST /api/send-email-verification returns 401 (properly protected)', False,
                              "Endpoint returns 404 - endpoint not implemented")
            else:
                self.log_result('verification_endpoints', 'POST /api/send-email-verification returns 401 (properly protected)', False,
                              f"Expected 401, got {response.status_code}")
        except Exception as e:
            self.log_result('verification_endpoints', 'POST /api/send-email-verification returns 401 (properly protected)', False, str(e))
        
        # Test 2: POST /api/verify-email
        try:
            verify_data = {
                "email": "test@example.com",
                "code": "123456"
            }
            response = await self.client.post(f"{API_BASE}/verify-email", json=verify_data)
            if response.status_code == 401:
                self.log_result('verification_endpoints', 'POST /api/verify-email returns 401 (properly protected)', True)
            elif response.status_code == 404:
                self.log_result('verification_endpoints', 'POST /api/verify-email returns 401 (properly protected)', False,
                              "Endpoint returns 404 - endpoint not implemented")
            else:
                self.log_result('verification_endpoints', 'POST /api/verify-email returns 401 (properly protected)', False,
                              f"Expected 401, got {response.status_code}")
        except Exception as e:
            self.log_result('verification_endpoints', 'POST /api/verify-email returns 401 (properly protected)', False, str(e))
        
        # Test 3: POST /api/send-phone-verification
        try:
            phone_data = {
                "phone": "+1234567890"
            }
            response = await self.client.post(f"{API_BASE}/send-phone-verification", json=phone_data)
            if response.status_code == 401:
                self.log_result('verification_endpoints', 'POST /api/send-phone-verification returns 401 (properly protected)', True)
            elif response.status_code == 404:
                self.log_result('verification_endpoints', 'POST /api/send-phone-verification returns 401 (properly protected)', False,
                              "Endpoint returns 404 - endpoint not implemented")
            else:
                self.log_result('verification_endpoints', 'POST /api/send-phone-verification returns 401 (properly protected)', False,
                              f"Expected 401, got {response.status_code}")
        except Exception as e:
            self.log_result('verification_endpoints', 'POST /api/send-phone-verification returns 401 (properly protected)', False, str(e))
        
        # Test 4: POST /api/verify-phone
        try:
            phone_verify_data = {
                "phone": "+1234567890",
                "code": "123456"
            }
            response = await self.client.post(f"{API_BASE}/verify-phone", json=phone_verify_data)
            if response.status_code == 401:
                self.log_result('verification_endpoints', 'POST /api/verify-phone returns 401 (properly protected)', True)
            elif response.status_code == 404:
                self.log_result('verification_endpoints', 'POST /api/verify-phone returns 401 (properly protected)', False,
                              "Endpoint returns 404 - endpoint not implemented")
            else:
                self.log_result('verification_endpoints', 'POST /api/verify-phone returns 401 (properly protected)', False,
                              f"Expected 401, got {response.status_code}")
        except Exception as e:
            self.log_result('verification_endpoints', 'POST /api/verify-phone returns 401 (properly protected)', False, str(e))
    
    async def test_admin_platform_endpoints(self):
        """Test admin platform endpoints - should return 401 (properly protected) instead of 404"""
        print("\n👑 Testing Admin Platform Endpoints...")
        
        # Test 1: GET /api/admin/platform/settings
        try:
            response = await self.client.get(f"{API_BASE}/admin/platform/settings")
            if response.status_code == 401:
                self.log_result('admin_platform_endpoints', 'GET /api/admin/platform/settings returns 401 (properly protected)', True)
            elif response.status_code == 404:
                self.log_result('admin_platform_endpoints', 'GET /api/admin/platform/settings returns 401 (properly protected)', False,
                              "Endpoint returns 404 - endpoint not implemented")
            else:
                self.log_result('admin_platform_endpoints', 'GET /api/admin/platform/settings returns 401 (properly protected)', False,
                              f"Expected 401, got {response.status_code}")
        except Exception as e:
            self.log_result('admin_platform_endpoints', 'GET /api/admin/platform/settings returns 401 (properly protected)', False, str(e))
        
        # Test 2: PUT /api/admin/platform/settings
        try:
            settings_data = {
                "trial_period_days": 90,
                "trial_enabled": True
            }
            response = await self.client.put(f"{API_BASE}/admin/platform/settings", json=settings_data)
            if response.status_code == 401:
                self.log_result('admin_platform_endpoints', 'PUT /api/admin/platform/settings returns 401 (properly protected)', True)
            elif response.status_code == 404:
                self.log_result('admin_platform_endpoints', 'PUT /api/admin/platform/settings returns 401 (properly protected)', False,
                              "Endpoint returns 404 - endpoint not implemented")
            else:
                self.log_result('admin_platform_endpoints', 'PUT /api/admin/platform/settings returns 401 (properly protected)', False,
                              f"Expected 401, got {response.status_code}")
        except Exception as e:
            self.log_result('admin_platform_endpoints', 'PUT /api/admin/platform/settings returns 401 (properly protected)', False, str(e))
        
        # Test 3: GET /api/admin/analytics
        try:
            response = await self.client.get(f"{API_BASE}/admin/analytics")
            if response.status_code == 401:
                self.log_result('admin_platform_endpoints', 'GET /api/admin/analytics returns 401 (properly protected)', True)
            elif response.status_code == 404:
                self.log_result('admin_platform_endpoints', 'GET /api/admin/analytics returns 401 (properly protected)', False,
                              "Endpoint returns 404 - endpoint not implemented")
            else:
                self.log_result('admin_platform_endpoints', 'GET /api/admin/analytics returns 401 (properly protected)', False,
                              f"Expected 401, got {response.status_code}")
        except Exception as e:
            self.log_result('admin_platform_endpoints', 'GET /api/admin/analytics returns 401 (properly protected)', False, str(e))
    
    async def test_payment_integration_endpoint(self):
        """Test payment integration endpoint - should return 401 (properly protected) instead of 404"""
        print("\n💰 Testing Payment Integration Endpoint...")
        
        try:
            payment_data = {
                "plan_id": "professional",
                "business_id": str(uuid.uuid4())
            }
            response = await self.client.post(f"{API_BASE}/create-payment-intent", json=payment_data)
            if response.status_code == 401:
                self.log_result('payment_integration', 'POST /api/create-payment-intent returns 401 (properly protected)', True)
            elif response.status_code == 404:
                self.log_result('payment_integration', 'POST /api/create-payment-intent returns 401 (properly protected)', False,
                              "Endpoint returns 404 - endpoint not implemented")
            else:
                self.log_result('payment_integration', 'POST /api/create-payment-intent returns 401 (properly protected)', False,
                              f"Expected 401, got {response.status_code}")
        except Exception as e:
            self.log_result('payment_integration', 'POST /api/create-payment-intent returns 401 (properly protected)', False, str(e))
    
    async def test_business_approval_endpoint(self):
        """Test business approval endpoint - should return 401 (properly protected) instead of 404"""
        print("\n🏢 Testing Business Approval Endpoint...")
        
        try:
            approval_data = {
                "business_id": str(uuid.uuid4()),
                "approved": True
            }
            response = await self.client.post(f"{API_BASE}/admin/approve-business", json=approval_data)
            if response.status_code == 401:
                self.log_result('business_approval', 'POST /api/admin/approve-business returns 401 (properly protected)', True)
            elif response.status_code == 404:
                self.log_result('business_approval', 'POST /api/admin/approve-business returns 401 (properly protected)', False,
                              "Endpoint returns 404 - endpoint not implemented")
            else:
                self.log_result('business_approval', 'POST /api/admin/approve-business returns 401 (properly protected)', False,
                              f"Expected 401, got {response.status_code}")
        except Exception as e:
            self.log_result('business_approval', 'POST /api/admin/approve-business returns 401 (properly protected)', False, str(e))
    
    async def run_all_tests(self):
        """Run all backend fixes verification tests"""
        print("🔍 BACKEND FIXES VERIFICATION TESTING")
        print("=" * 50)
        print(f"Testing backend at: {API_BASE}")
        print()
        
        # Run all test categories
        await self.test_subscription_plans_endpoint()
        await self.test_verification_endpoints()
        await self.test_admin_platform_endpoints()
        await self.test_payment_integration_endpoint()
        await self.test_business_approval_endpoint()
        
        # Print summary
        print("\n" + "=" * 50)
        print("📊 BACKEND FIXES VERIFICATION TEST SUMMARY")
        print("=" * 50)
        
        total_passed = 0
        total_failed = 0
        
        for category, results in self.test_results.items():
            passed = results['passed']
            failed = results['failed']
            total_passed += passed
            total_failed += failed
            
            status = "✅ PASSED" if failed == 0 else "❌ FAILED"
            print(f"{category.upper().replace('_', ' ')}: {status} ({passed} passed, {failed} failed)")
            
            if results['errors']:
                for error in results['errors']:
                    print(f"  - {error}")
        
        print(f"\nOVERALL: {total_passed} passed, {total_failed} failed")
        success_rate = (total_passed / (total_passed + total_failed)) * 100 if (total_passed + total_failed) > 0 else 0
        print(f"SUCCESS RATE: {success_rate:.1f}%")
        
        if total_failed == 0:
            print("\n🎉 ALL BACKEND FIXES VERIFIED SUCCESSFULLY!")
        else:
            print(f"\n⚠️  {total_failed} ISSUES STILL NEED TO BE ADDRESSED")

async def main():
    tester = BackendFixesVerificationTester()
    try:
        await tester.run_all_tests()
    finally:
        await tester.close()

if __name__ == "__main__":
    asyncio.run(main())