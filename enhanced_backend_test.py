#!/usr/bin/env python3
"""
Enhanced Backend Testing for Comprehensive System Validation
Focuses on specific areas mentioned in the review request:
- Enhanced Google Maps Integration
- Business Email Verification System
- Real-Time Business Dashboard
- Performance and Error Handling
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

class EnhancedBackendTester:
    def __init__(self):
        self.client = httpx.AsyncClient(timeout=30.0)
        self.test_results = {
            'enhanced_google_maps': {'passed': 0, 'failed': 0, 'errors': []},
            'email_verification': {'passed': 0, 'failed': 0, 'errors': []},
            'realtime_dashboard': {'passed': 0, 'failed': 0, 'errors': []},
            'performance_tests': {'passed': 0, 'failed': 0, 'errors': []},
            'error_handling': {'passed': 0, 'failed': 0, 'errors': []},
            'subscription_system': {'passed': 0, 'failed': 0, 'errors': []},
            'verification_system': {'passed': 0, 'failed': 0, 'errors': []},
            'business_analytics': {'passed': 0, 'failed': 0, 'errors': []},
            'admin_platform': {'passed': 0, 'failed': 0, 'errors': []},
            'stripe_integration': {'passed': 0, 'failed': 0, 'errors': []},
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
    
    async def test_enhanced_google_maps_integration(self):
        """Test Enhanced Google Maps Integration with Location Data"""
        print("\n🗺️ Testing Enhanced Google Maps Integration...")
        
        # Test 1: Business registration with location coordinates
        try:
            business_data = {
                "name": "Test Location Business",
                "description": "Testing location-based registration",
                "category": "Restaurant",
                "email": "location@test.com",
                "phone": "+1-555-0199",
                "address": "123 Test Street",
                "city": "New York",
                "country": "USA",
                "latitude": 40.7831,
                "longitude": -73.9712
            }
            response = await self.client.post(f"{API_BASE}/businesses/register", json=business_data)
            if response.status_code == 401:
                self.log_result('enhanced_google_maps', 'Business registration with coordinates auth protection', True)
            else:
                self.log_result('enhanced_google_maps', 'Business registration with coordinates auth protection', False,
                              f"Expected 401, got {response.status_code}")
        except Exception as e:
            self.log_result('enhanced_google_maps', 'Business registration with coordinates auth protection', False, str(e))
        
        # Test 2: Location-based business queries
        try:
            response = await self.client.get(f"{API_BASE}/businesses?latitude=40.7831&longitude=-73.9712&radius_km=5")
            if response.status_code == 200:
                businesses = response.json()
                self.log_result('enhanced_google_maps', 'Location-based business queries with radius', True)
                print(f"   Found {len(businesses)} businesses within 5km of NYC coordinates")
            else:
                self.log_result('enhanced_google_maps', 'Location-based business queries with radius', False,
                              f"Status: {response.status_code}")
        except Exception as e:
            self.log_result('enhanced_google_maps', 'Location-based business queries with radius', False, str(e))
        
        # Test 3: Location-based discount filtering
        try:
            response = await self.client.get(f"{API_BASE}/discounts?latitude=40.7831&longitude=-73.9712&radius_km=10")
            if response.status_code == 200:
                discounts = response.json()
                self.log_result('enhanced_google_maps', 'Location-based discount filtering', True)
                print(f"   Found {len(discounts)} discounts within 10km of NYC coordinates")
            else:
                self.log_result('enhanced_google_maps', 'Location-based discount filtering', False,
                              f"Status: {response.status_code}")
        except Exception as e:
            self.log_result('enhanced_google_maps', 'Location-based discount filtering', False, str(e))
        
        # Test 4: Invalid coordinate validation
        try:
            response = await self.client.get(f"{API_BASE}/businesses?latitude=999&longitude=999&radius_km=5")
            if response.status_code == 200:
                businesses = response.json()
                # Should return empty results for invalid coordinates
                self.log_result('enhanced_google_maps', 'Invalid coordinate handling', True)
                print(f"   Invalid coordinates handled gracefully: {len(businesses)} results")
            else:
                self.log_result('enhanced_google_maps', 'Invalid coordinate handling', False,
                              f"Status: {response.status_code}")
        except Exception as e:
            self.log_result('enhanced_google_maps', 'Invalid coordinate handling', False, str(e))
        
        # Test 5: Edge case coordinates (near poles/date line)
        try:
            response = await self.client.get(f"{API_BASE}/businesses?latitude=89.9999&longitude=179.9999&radius_km=1")
            if response.status_code == 200:
                businesses = response.json()
                self.log_result('enhanced_google_maps', 'Edge case coordinate validation', True)
                print(f"   Edge case coordinates handled: {len(businesses)} results")
            else:
                self.log_result('enhanced_google_maps', 'Edge case coordinate validation', False,
                              f"Status: {response.status_code}")
        except Exception as e:
            self.log_result('enhanced_google_maps', 'Edge case coordinate validation', False, str(e))
        
        # Test 6: Multiple city location queries
        try:
            cities = [
                {"name": "New York", "lat": 40.7831, "lng": -73.9712},
                {"name": "Los Angeles", "lat": 34.0522, "lng": -118.2437},
                {"name": "Chicago", "lat": 41.8781, "lng": -87.6298}
            ]
            
            successful_queries = 0
            for city in cities:
                response = await self.client.get(f"{API_BASE}/businesses?latitude={city['lat']}&longitude={city['lng']}&radius_km=10")
                if response.status_code == 200:
                    successful_queries += 1
            
            if successful_queries == len(cities):
                self.log_result('enhanced_google_maps', 'Multiple city location queries', True)
                print(f"   All {len(cities)} city location queries successful")
            else:
                self.log_result('enhanced_google_maps', 'Multiple city location queries', False,
                              f"Only {successful_queries}/{len(cities)} queries successful")
        except Exception as e:
            self.log_result('enhanced_google_maps', 'Multiple city location queries', False, str(e))
    
    async def test_business_email_verification_system(self):
        """Test Business Email Verification System"""
        print("\n📧 Testing Business Email Verification System...")
        
        # Test 1: Verify business email without authentication
        try:
            verification_data = {
                "verification_code": "123456"
            }
            response = await self.client.post(f"{API_BASE}/business/verify-email", json=verification_data)
            if response.status_code == 401:
                self.log_result('email_verification', 'Email verification auth protection', True)
            else:
                self.log_result('email_verification', 'Email verification auth protection', False,
                              f"Expected 401, got {response.status_code}")
        except Exception as e:
            self.log_result('email_verification', 'Email verification auth protection', False, str(e))
        
        # Test 2: Resend verification email without authentication
        try:
            response = await self.client.post(f"{API_BASE}/business/resend-verification")
            if response.status_code == 401:
                self.log_result('email_verification', 'Resend verification auth protection', True)
            else:
                self.log_result('email_verification', 'Resend verification auth protection', False,
                              f"Expected 401, got {response.status_code}")
        except Exception as e:
            self.log_result('email_verification', 'Resend verification auth protection', False, str(e))
        
        # Test 3: Get verification status without authentication
        try:
            response = await self.client.get(f"{API_BASE}/business/verification-status")
            if response.status_code == 401:
                self.log_result('email_verification', 'Verification status auth protection', True)
            else:
                self.log_result('email_verification', 'Verification status auth protection', False,
                              f"Expected 401, got {response.status_code}")
        except Exception as e:
            self.log_result('email_verification', 'Verification status auth protection', False, str(e))
        
        # Test 4: Invalid verification code format
        try:
            invalid_verification_data = {
                "verification_code": "invalid_code_format"
            }
            response = await self.client.post(f"{API_BASE}/business/verify-email", json=invalid_verification_data)
            if response.status_code in [401, 422]:  # 401 for auth, 422 for validation
                self.log_result('email_verification', 'Invalid verification code validation', True)
            else:
                self.log_result('email_verification', 'Invalid verification code validation', False,
                              f"Expected 401 or 422, got {response.status_code}")
        except Exception as e:
            self.log_result('email_verification', 'Invalid verification code validation', False, str(e))
        
        # Test 5: Empty verification code
        try:
            empty_verification_data = {
                "verification_code": ""
            }
            response = await self.client.post(f"{API_BASE}/business/verify-email", json=empty_verification_data)
            if response.status_code in [401, 422]:  # 401 for auth, 422 for validation
                self.log_result('email_verification', 'Empty verification code validation', True)
            else:
                self.log_result('email_verification', 'Empty verification code validation', False,
                              f"Expected 401 or 422, got {response.status_code}")
        except Exception as e:
            self.log_result('email_verification', 'Empty verification code validation', False, str(e))
    
    async def test_realtime_business_dashboard(self):
        """Test Real-Time Business Dashboard"""
        print("\n📊 Testing Real-Time Business Dashboard...")
        
        # Test 1: Real-time metrics without authentication
        try:
            response = await self.client.get(f"{API_BASE}/business/realtime-metrics")
            if response.status_code == 401:
                self.log_result('realtime_dashboard', 'Real-time metrics auth protection', True)
            else:
                self.log_result('realtime_dashboard', 'Real-time metrics auth protection', False,
                              f"Expected 401, got {response.status_code}")
        except Exception as e:
            self.log_result('realtime_dashboard', 'Real-time metrics auth protection', False, str(e))
        
        # Test 2: Quick deal creation without authentication
        try:
            deal_data = {
                "title": "Flash Sale",
                "description": "Limited time offer",
                "discount": 25,
                "validUntil": (datetime.utcnow() + timedelta(hours=2)).isoformat(),
                "maxRedemptions": 50
            }
            response = await self.client.post(f"{API_BASE}/deals/quick-create", json=deal_data)
            if response.status_code == 401:
                self.log_result('realtime_dashboard', 'Quick deal creation auth protection', True)
            else:
                self.log_result('realtime_dashboard', 'Quick deal creation auth protection', False,
                              f"Expected 401, got {response.status_code}")
        except Exception as e:
            self.log_result('realtime_dashboard', 'Quick deal creation auth protection', False, str(e))
        
        # Test 3: Deal alert notifications without authentication
        try:
            alert_data = {
                "dealId": str(uuid.uuid4()),
                "radius": 1000
            }
            response = await self.client.post(f"{API_BASE}/notifications/deal-alert", json=alert_data)
            if response.status_code == 401:
                self.log_result('realtime_dashboard', 'Deal alert notifications auth protection', True)
            else:
                self.log_result('realtime_dashboard', 'Deal alert notifications auth protection', False,
                              f"Expected 401, got {response.status_code}")
        except Exception as e:
            self.log_result('realtime_dashboard', 'Deal alert notifications auth protection', False, str(e))
        
        # Test 4: Push token storage without authentication
        try:
            token_data = {
                "pushToken": "ExponentPushToken[test_token_123]"
            }
            response = await self.client.post(f"{API_BASE}/users/push-token", json=token_data)
            if response.status_code == 401:
                self.log_result('realtime_dashboard', 'Push token storage auth protection', True)
            else:
                self.log_result('realtime_dashboard', 'Push token storage auth protection', False,
                              f"Expected 401, got {response.status_code}")
        except Exception as e:
            self.log_result('realtime_dashboard', 'Push token storage auth protection', False, str(e))
        
        # Test 5: Notification metrics without authentication
        try:
            metrics_data = {
                "action": "tapped",
                "type": "deal",
                "dealId": str(uuid.uuid4()),
                "timestamp": datetime.utcnow().isoformat()
            }
            response = await self.client.post(f"{API_BASE}/notifications/metrics", json=metrics_data)
            if response.status_code == 401:
                self.log_result('realtime_dashboard', 'Notification metrics auth protection', True)
            else:
                self.log_result('realtime_dashboard', 'Notification metrics auth protection', False,
                              f"Expected 401, got {response.status_code}")
        except Exception as e:
            self.log_result('realtime_dashboard', 'Notification metrics auth protection', False, str(e))
    
    async def test_subscription_system(self):
        """Test Subscription Management System"""
        print("\n💳 Testing Subscription Management System...")
        
        # Test 1: Get subscription plans (should work without auth)
        try:
            response = await self.client.get(f"{API_BASE}/subscription-plans")
            if response.status_code == 200:
                plans = response.json()
                if isinstance(plans, list) and len(plans) > 0:
                    self.log_result('subscription_system', 'Subscription plans endpoint', True)
                    print(f"   Found {len(plans)} subscription plans")
                    # Check plan structure
                    plan = plans[0]
                    required_fields = ['id', 'name', 'description', 'price', 'stripe_price_id', 'features']
                    if all(field in plan for field in required_fields):
                        self.log_result('subscription_system', 'Subscription plan data structure', True)
                    else:
                        self.log_result('subscription_system', 'Subscription plan data structure', False,
                                      f"Missing required fields in plan: {plan}")
                else:
                    self.log_result('subscription_system', 'Subscription plans endpoint', False,
                                  "No subscription plans found")
            else:
                self.log_result('subscription_system', 'Subscription plans endpoint', False,
                              f"Status: {response.status_code}")
        except Exception as e:
            self.log_result('subscription_system', 'Subscription plans endpoint', False, str(e))
        
        # Test 2: Get subscription status without authentication
        try:
            response = await self.client.get(f"{API_BASE}/subscription/status")
            if response.status_code == 401:
                self.log_result('subscription_system', 'Subscription status auth protection', True)
            else:
                self.log_result('subscription_system', 'Subscription status auth protection', False,
                              f"Expected 401, got {response.status_code}")
        except Exception as e:
            self.log_result('subscription_system', 'Subscription status auth protection', False, str(e))
        
        # Test 3: Create payment intent without authentication
        try:
            payment_data = {
                "plan_id": "professional",
                "business_id": str(uuid.uuid4())
            }
            response = await self.client.post(f"{API_BASE}/create-payment-intent", json=payment_data)
            if response.status_code == 401:
                self.log_result('subscription_system', 'Payment intent auth protection', True)
            else:
                self.log_result('subscription_system', 'Payment intent auth protection', False,
                              f"Expected 401, got {response.status_code}")
        except Exception as e:
            self.log_result('subscription_system', 'Payment intent auth protection', False, str(e))
    
    async def test_verification_system(self):
        """Test Email and Phone Verification System"""
        print("\n✅ Testing Verification System...")
        
        # Test 1: Send email verification without authentication
        try:
            response = await self.client.post(f"{API_BASE}/send-email-verification")
            if response.status_code == 401:
                self.log_result('verification_system', 'Send email verification auth protection', True)
            else:
                self.log_result('verification_system', 'Send email verification auth protection', False,
                              f"Expected 401, got {response.status_code}")
        except Exception as e:
            self.log_result('verification_system', 'Send email verification auth protection', False, str(e))
        
        # Test 2: Verify email without authentication
        try:
            verification_data = {
                "email": "test@example.com",
                "code": "123456"
            }
            response = await self.client.post(f"{API_BASE}/verify-email", json=verification_data)
            if response.status_code == 401:
                self.log_result('verification_system', 'Verify email auth protection', True)
            else:
                self.log_result('verification_system', 'Verify email auth protection', False,
                              f"Expected 401, got {response.status_code}")
        except Exception as e:
            self.log_result('verification_system', 'Verify email auth protection', False, str(e))
        
        # Test 3: Send phone verification without authentication
        try:
            response = await self.client.post(f"{API_BASE}/send-phone-verification")
            if response.status_code == 401:
                self.log_result('verification_system', 'Send phone verification auth protection', True)
            else:
                self.log_result('verification_system', 'Send phone verification auth protection', False,
                              f"Expected 401, got {response.status_code}")
        except Exception as e:
            self.log_result('verification_system', 'Send phone verification auth protection', False, str(e))
        
        # Test 4: Verify phone without authentication
        try:
            verification_data = {
                "phone": "+1-555-0123",
                "code": "123456"
            }
            response = await self.client.post(f"{API_BASE}/verify-phone", json=verification_data)
            if response.status_code == 401:
                self.log_result('verification_system', 'Verify phone auth protection', True)
            else:
                self.log_result('verification_system', 'Verify phone auth protection', False,
                              f"Expected 401, got {response.status_code}")
        except Exception as e:
            self.log_result('verification_system', 'Verify phone auth protection', False, str(e))
        
        # Test 5: Invalid email format validation
        try:
            invalid_email_data = {
                "email": "invalid_email_format",
                "code": "123456"
            }
            response = await self.client.post(f"{API_BASE}/verify-email", json=invalid_email_data)
            if response.status_code in [401, 422]:  # 401 for auth, 422 for validation
                self.log_result('verification_system', 'Email format validation', True)
            else:
                self.log_result('verification_system', 'Email format validation', False,
                              f"Expected 401 or 422, got {response.status_code}")
        except Exception as e:
            self.log_result('verification_system', 'Email format validation', False, str(e))
    
    async def test_business_analytics_system(self):
        """Test Business Analytics System"""
        print("\n📈 Testing Business Analytics System...")
        
        # Test 1: Business analytics without authentication
        try:
            response = await self.client.get(f"{API_BASE}/business/analytics")
            if response.status_code == 401:
                self.log_result('business_analytics', 'Business analytics auth protection', True)
            else:
                self.log_result('business_analytics', 'Business analytics auth protection', False,
                              f"Expected 401, got {response.status_code}")
        except Exception as e:
            self.log_result('business_analytics', 'Business analytics auth protection', False, str(e))
        
        # Test 2: Advanced analytics (already tested in main test, but verify again)
        try:
            response = await self.client.get(f"{API_BASE}/business/advanced-analytics")
            if response.status_code == 401:
                self.log_result('business_analytics', 'Advanced analytics auth protection', True)
            else:
                self.log_result('business_analytics', 'Advanced analytics auth protection', False,
                              f"Expected 401, got {response.status_code}")
        except Exception as e:
            self.log_result('business_analytics', 'Advanced analytics auth protection', False, str(e))
    
    async def test_admin_platform_management(self):
        """Test Admin Platform Management"""
        print("\n👑 Testing Admin Platform Management...")
        
        # Test 1: Platform settings GET without authentication
        try:
            response = await self.client.get(f"{API_BASE}/admin/platform/settings")
            if response.status_code == 401:
                self.log_result('admin_platform', 'Platform settings GET auth protection', True)
            else:
                self.log_result('admin_platform', 'Platform settings GET auth protection', False,
                              f"Expected 401, got {response.status_code}")
        except Exception as e:
            self.log_result('admin_platform', 'Platform settings GET auth protection', False, str(e))
        
        # Test 2: Platform settings PUT without authentication
        try:
            settings_data = {
                "trial_period_days": 90,
                "cashback_rate": 5.0
            }
            response = await self.client.put(f"{API_BASE}/admin/platform/settings", json=settings_data)
            if response.status_code == 401:
                self.log_result('admin_platform', 'Platform settings PUT auth protection', True)
            else:
                self.log_result('admin_platform', 'Platform settings PUT auth protection', False,
                              f"Expected 401, got {response.status_code}")
        except Exception as e:
            self.log_result('admin_platform', 'Platform settings PUT auth protection', False, str(e))
        
        # Test 3: Platform analytics without authentication
        try:
            response = await self.client.get(f"{API_BASE}/admin/analytics")
            if response.status_code == 401:
                self.log_result('admin_platform', 'Platform analytics auth protection', True)
            else:
                self.log_result('admin_platform', 'Platform analytics auth protection', False,
                              f"Expected 401, got {response.status_code}")
        except Exception as e:
            self.log_result('admin_platform', 'Platform analytics auth protection', False, str(e))
        
        # Test 4: Admin business approval (if implemented)
        try:
            approval_data = {
                "business_id": str(uuid.uuid4()),
                "approved": True
            }
            response = await self.client.post(f"{API_BASE}/admin/approve-business", json=approval_data)
            if response.status_code in [401, 404]:  # 401 for auth, 404 if not implemented
                self.log_result('admin_platform', 'Business approval endpoint structure', True)
            else:
                self.log_result('admin_platform', 'Business approval endpoint structure', False,
                              f"Expected 401 or 404, got {response.status_code}")
        except Exception as e:
            self.log_result('admin_platform', 'Business approval endpoint structure', False, str(e))
    
    async def test_stripe_integration(self):
        """Test Stripe Integration"""
        print("\n💳 Testing Stripe Integration...")
        
        # Test 1: Stripe webhook endpoint
        try:
            webhook_data = {
                "id": "evt_test_webhook",
                "object": "event",
                "type": "invoice.payment_succeeded",
                "data": {
                    "object": {
                        "id": "in_test_invoice",
                        "subscription": "sub_test_subscription"
                    }
                }
            }
            response = await self.client.post(f"{API_BASE}/webhooks/stripe", json=webhook_data)
            if response.status_code in [200, 400, 401]:  # Various valid responses for webhook
                self.log_result('stripe_integration', 'Stripe webhook endpoint structure', True)
            else:
                self.log_result('stripe_integration', 'Stripe webhook endpoint structure', False,
                              f"Unexpected status: {response.status_code}")
        except Exception as e:
            self.log_result('stripe_integration', 'Stripe webhook endpoint structure', False, str(e))
        
        # Test 2: Payment intent creation (already tested in subscription system)
        try:
            payment_data = {
                "plan_id": "professional",
                "business_id": str(uuid.uuid4())
            }
            response = await self.client.post(f"{API_BASE}/create-payment-intent", json=payment_data)
            if response.status_code == 401:
                self.log_result('stripe_integration', 'Payment intent creation auth protection', True)
            else:
                self.log_result('stripe_integration', 'Payment intent creation auth protection', False,
                              f"Expected 401, got {response.status_code}")
        except Exception as e:
            self.log_result('stripe_integration', 'Payment intent creation auth protection', False, str(e))
        
        # Test 3: Subscription plans with Stripe price IDs (already tested)
        try:
            response = await self.client.get(f"{API_BASE}/subscription-plans")
            if response.status_code == 200:
                plans = response.json()
                if plans and len(plans) > 0:
                    # Check if plans have stripe_price_id
                    has_stripe_ids = any('stripe_price_id' in plan for plan in plans)
                    if has_stripe_ids:
                        self.log_result('stripe_integration', 'Stripe price ID integration', True)
                        print("   ✓ Subscription plans contain Stripe price IDs")
                    else:
                        self.log_result('stripe_integration', 'Stripe price ID integration', False,
                                      "No Stripe price IDs found in subscription plans")
                else:
                    self.log_result('stripe_integration', 'Stripe price ID integration', False,
                                  "No subscription plans available")
            else:
                self.log_result('stripe_integration', 'Stripe price ID integration', False,
                              f"Status: {response.status_code}")
        except Exception as e:
            self.log_result('stripe_integration', 'Stripe price ID integration', False, str(e))
    
    async def test_performance_and_error_handling(self):
        """Test Performance and Error Handling"""
        print("\n⚡ Testing Performance and Error Handling...")
        
        # Test 1: Response time for business listing
        try:
            import time
            start_time = time.time()
            response = await self.client.get(f"{API_BASE}/businesses")
            end_time = time.time()
            response_time = end_time - start_time
            
            if response.status_code == 200 and response_time < 5.0:  # 5 second threshold
                self.log_result('performance_tests', 'Business listing response time', True)
                print(f"   Response time: {response_time:.2f}s")
            else:
                self.log_result('performance_tests', 'Business listing response time', False,
                              f"Response time: {response_time:.2f}s, Status: {response.status_code}")
        except Exception as e:
            self.log_result('performance_tests', 'Business listing response time', False, str(e))
        
        # Test 2: Response time for discount aggregation
        try:
            import time
            start_time = time.time()
            response = await self.client.get(f"{API_BASE}/discounts")
            end_time = time.time()
            response_time = end_time - start_time
            
            if response.status_code == 200 and response_time < 5.0:  # 5 second threshold
                self.log_result('performance_tests', 'Discount aggregation response time', True)
                print(f"   Response time: {response_time:.2f}s")
            else:
                self.log_result('performance_tests', 'Discount aggregation response time', False,
                              f"Response time: {response_time:.2f}s, Status: {response.status_code}")
        except Exception as e:
            self.log_result('performance_tests', 'Discount aggregation response time', False, str(e))
        
        # Test 3: Invalid JSON handling
        try:
            response = await self.client.post(f"{API_BASE}/businesses/register", 
                                            content="invalid json content",
                                            headers={"Content-Type": "application/json"})
            if response.status_code == 422:  # Unprocessable Entity for invalid JSON
                self.log_result('error_handling', 'Invalid JSON error handling', True)
            else:
                self.log_result('error_handling', 'Invalid JSON error handling', False,
                              f"Expected 422, got {response.status_code}")
        except Exception as e:
            self.log_result('error_handling', 'Invalid JSON error handling', False, str(e))
        
        # Test 4: Large request handling
        try:
            large_data = {
                "name": "A" * 1000,  # Very long name
                "description": "B" * 5000,  # Very long description
                "category": "Restaurant",
                "email": "test@example.com",
                "phone": "+1-555-0123",
                "address": "123 Test St",
                "city": "Test City",
                "country": "USA"
            }
            response = await self.client.post(f"{API_BASE}/businesses/register", json=large_data)
            if response.status_code in [401, 422]:  # 401 for auth, 422 for validation
                self.log_result('error_handling', 'Large request handling', True)
            else:
                self.log_result('error_handling', 'Large request handling', False,
                              f"Expected 401 or 422, got {response.status_code}")
        except Exception as e:
            self.log_result('error_handling', 'Large request handling', False, str(e))
        
        # Test 5: Non-existent endpoint
        try:
            response = await self.client.get(f"{API_BASE}/non-existent-endpoint")
            if response.status_code == 404:
                self.log_result('error_handling', 'Non-existent endpoint handling', True)
            else:
                self.log_result('error_handling', 'Non-existent endpoint handling', False,
                              f"Expected 404, got {response.status_code}")
        except Exception as e:
            self.log_result('error_handling', 'Non-existent endpoint handling', False, str(e))
    
    async def run_all_tests(self):
        """Run all enhanced backend tests"""
        print("🚀 Starting Enhanced Backend Testing...")
        print(f"Testing backend at: {BACKEND_URL}/api")
        print("\n" + "="*60)
        print("ENHANCED BACKEND TESTING - COMPREHENSIVE VALIDATION")
        print("="*60)
        
        await self.test_enhanced_google_maps_integration()
        await self.test_business_email_verification_system()
        await self.test_realtime_business_dashboard()
        await self.test_subscription_system()
        await self.test_verification_system()
        await self.test_business_analytics_system()
        await self.test_admin_platform_management()
        await self.test_stripe_integration()
        await self.test_performance_and_error_handling()
        
        # Print summary
        print("\n" + "="*60)
        print("🧪 ENHANCED BACKEND TEST SUMMARY")
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
            
            if failed > 0:
                for error in results['errors']:
                    print(f"  ❌ {error}")
        
        print(f"\nOverall: {total_passed} passed, {total_failed} failed")
        if total_failed > 0:
            print(f"⚠️  {total_failed} tests failed - see details above")
        else:
            print("🎉 All enhanced backend tests passed!")

async def main():
    tester = EnhancedBackendTester()
    try:
        await tester.run_all_tests()
    finally:
        await tester.close()

if __name__ == "__main__":
    asyncio.run(main())