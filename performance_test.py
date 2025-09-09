#!/usr/bin/env python3
"""
Performance and Stability Testing for SDK 54 Compatibility
Tests API response times, concurrent requests, and error handling
"""

import asyncio
import httpx
import time
import statistics
from typing import List, Dict
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv('/app/frontend/.env')

# Get backend URL from environment
BACKEND_URL = os.getenv('EXPO_PUBLIC_BACKEND_URL', 'https://couponmobile.preview.emergentagent.com')
API_BASE = f"{BACKEND_URL}/api"

class PerformanceTester:
    def __init__(self):
        self.results = {}
        
    async def test_api_response_times(self):
        """Test API response times under normal load"""
        print("\n⚡ Testing API Response Times...")
        
        endpoints = [
            "/businesses",
            "/discounts", 
            "/categories",
            "/rewards/leaderboard"
        ]
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            for endpoint in endpoints:
                response_times = []
                
                # Test each endpoint 10 times
                for i in range(10):
                    start_time = time.time()
                    try:
                        response = await client.get(f"{API_BASE}{endpoint}")
                        end_time = time.time()
                        response_time = (end_time - start_time) * 1000  # Convert to ms
                        response_times.append(response_time)
                        
                        if response.status_code not in [200, 401]:
                            print(f"   ⚠️  {endpoint}: Unexpected status {response.status_code}")
                    except Exception as e:
                        print(f"   ❌ {endpoint}: Error - {str(e)}")
                        continue
                
                if response_times:
                    avg_time = statistics.mean(response_times)
                    min_time = min(response_times)
                    max_time = max(response_times)
                    
                    print(f"   ✅ {endpoint}: Avg {avg_time:.1f}ms, Min {min_time:.1f}ms, Max {max_time:.1f}ms")
                    
                    # Check if response times are acceptable (< 2000ms average)
                    if avg_time < 2000:
                        print(f"      ✓ Response time acceptable")
                    else:
                        print(f"      ⚠️  Response time high: {avg_time:.1f}ms")
                    
                    self.results[endpoint] = {
                        'avg_time': avg_time,
                        'min_time': min_time,
                        'max_time': max_time,
                        'acceptable': avg_time < 2000
                    }

    async def test_concurrent_requests(self):
        """Test concurrent request handling"""
        print("\n🔄 Testing Concurrent Request Handling...")
        
        async def make_request(client, endpoint):
            start_time = time.time()
            try:
                response = await client.get(f"{API_BASE}{endpoint}")
                end_time = time.time()
                return {
                    'status': response.status_code,
                    'time': (end_time - start_time) * 1000,
                    'success': response.status_code in [200, 401]
                }
            except Exception as e:
                end_time = time.time()
                return {
                    'status': 'error',
                    'time': (end_time - start_time) * 1000,
                    'success': False,
                    'error': str(e)
                }
        
        # Test with 20 concurrent requests
        async with httpx.AsyncClient(timeout=30.0) as client:
            tasks = []
            for i in range(20):
                endpoint = ["/businesses", "/discounts", "/categories"][i % 3]
                tasks.append(make_request(client, endpoint))
            
            start_time = time.time()
            results = await asyncio.gather(*tasks)
            end_time = time.time()
            
            total_time = (end_time - start_time) * 1000
            successful_requests = sum(1 for r in results if r['success'])
            failed_requests = len(results) - successful_requests
            
            avg_response_time = statistics.mean([r['time'] for r in results if r['success']])
            
            print(f"   ✅ Concurrent Requests: {successful_requests}/{len(results)} successful")
            print(f"   ✅ Total Time: {total_time:.1f}ms")
            print(f"   ✅ Average Response Time: {avg_response_time:.1f}ms")
            
            if failed_requests == 0:
                print(f"   ✓ All concurrent requests handled successfully")
            else:
                print(f"   ⚠️  {failed_requests} requests failed")
            
            self.results['concurrent'] = {
                'total_requests': len(results),
                'successful': successful_requests,
                'failed': failed_requests,
                'total_time': total_time,
                'avg_response_time': avg_response_time
            }

    async def test_error_handling(self):
        """Test error handling and recovery mechanisms"""
        print("\n🛡️ Testing Error Handling...")
        
        test_cases = [
            {
                'name': 'Invalid endpoint',
                'url': f"{API_BASE}/invalid-endpoint",
                'expected_status': 404
            },
            {
                'name': 'Invalid business ID',
                'url': f"{API_BASE}/businesses/invalid-id",
                'expected_status': 404
            },
            {
                'name': 'Invalid discount ID',
                'url': f"{API_BASE}/businesses/invalid-id/discounts",
                'expected_status': 200  # Should return empty list
            },
            {
                'name': 'Malformed request',
                'url': f"{API_BASE}/businesses",
                'method': 'POST',
                'data': {'invalid': 'data'},
                'expected_status': 401  # Auth required first
            }
        ]
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            for test_case in test_cases:
                try:
                    if test_case.get('method') == 'POST':
                        response = await client.post(test_case['url'], json=test_case.get('data', {}))
                    else:
                        response = await client.get(test_case['url'])
                    
                    if response.status_code == test_case['expected_status']:
                        print(f"   ✅ {test_case['name']}: Correct error handling ({response.status_code})")
                    else:
                        print(f"   ⚠️  {test_case['name']}: Expected {test_case['expected_status']}, got {response.status_code}")
                        
                except Exception as e:
                    print(f"   ❌ {test_case['name']}: Exception - {str(e)}")

    async def test_database_query_performance(self):
        """Test database query optimization through API endpoints"""
        print("\n💾 Testing Database Query Performance...")
        
        # Test endpoints that involve database queries
        query_tests = [
            {
                'name': 'Business listing with filters',
                'url': f"{API_BASE}/businesses?category=Restaurant&search=pizza"
            },
            {
                'name': 'Discount aggregation',
                'url': f"{API_BASE}/discounts"
            },
            {
                'name': 'Location-based queries',
                'url': f"{API_BASE}/businesses?latitude=40.7128&longitude=-74.006&radius_km=10"
            }
        ]
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            for test in query_tests:
                response_times = []
                
                # Test each query 5 times
                for i in range(5):
                    start_time = time.time()
                    try:
                        response = await client.get(test['url'])
                        end_time = time.time()
                        
                        if response.status_code == 200:
                            response_time = (end_time - start_time) * 1000
                            response_times.append(response_time)
                        else:
                            print(f"   ⚠️  {test['name']}: Status {response.status_code}")
                            
                    except Exception as e:
                        print(f"   ❌ {test['name']}: Error - {str(e)}")
                        continue
                
                if response_times:
                    avg_time = statistics.mean(response_times)
                    print(f"   ✅ {test['name']}: {avg_time:.1f}ms average")
                    
                    # Database queries should be fast (< 1000ms)
                    if avg_time < 1000:
                        print(f"      ✓ Database query performance good")
                    else:
                        print(f"      ⚠️  Database query performance slow: {avg_time:.1f}ms")

    def print_summary(self):
        """Print performance test summary"""
        print("\n" + "="*60)
        print("⚡ PERFORMANCE TEST SUMMARY")
        print("="*60)
        
        # API Response Times Summary
        if any('time' in str(v) for v in self.results.values()):
            print("\n📊 API Response Times:")
            for endpoint, data in self.results.items():
                if isinstance(data, dict) and 'avg_time' in data:
                    status = "✅ GOOD" if data['acceptable'] else "⚠️  SLOW"
                    print(f"  {endpoint}: {data['avg_time']:.1f}ms {status}")
        
        # Concurrent Requests Summary
        if 'concurrent' in self.results:
            concurrent = self.results['concurrent']
            success_rate = (concurrent['successful'] / concurrent['total_requests']) * 100
            print(f"\n🔄 Concurrent Requests:")
            print(f"  Success Rate: {success_rate:.1f}% ({concurrent['successful']}/{concurrent['total_requests']})")
            print(f"  Average Response Time: {concurrent['avg_response_time']:.1f}ms")
        
        print("\n✅ Performance testing completed")

async def main():
    """Run performance tests"""
    print("🚀 Starting Performance and Stability Testing...")
    print(f"Testing backend at: {API_BASE}")
    print("\n🎯 FOCUS: SDK 54 Performance Verification")
    
    tester = PerformanceTester()
    
    await tester.test_api_response_times()
    await tester.test_concurrent_requests()
    await tester.test_error_handling()
    await tester.test_database_query_performance()
    
    tester.print_summary()
    
    return True

if __name__ == "__main__":
    success = asyncio.run(main())
    exit(0 if success else 1)