# Smoke sweep: hit all GET endpoints (authenticated as admin and business owner) and assert no 5xx
import pytest
import requests

from conftest import BASE_URL, auth_headers

API = f"{BASE_URL}/api"

GET_ENDPOINTS = [
    "/auth/me", "/ai/recommendations", "/rewards/profile", "/rewards/leaderboard", "/geofence/my-geofences",
    "/cashback/wallet", "/business/advanced-analytics", "/business/customer-insights", "/businesses",
    "/businesses/nonexistent-id", "/businesses/nonexistent-id/discounts", "/discounts",
    "/businesses/nonexistent-id/ratings", "/categories", "/subscription-plans", "/business/subscription/status",
    "/business/usage-analytics", "/business/verification-status", "/business/realtime-metrics",
    "/admin/businesses", "/social/friends", "/social/feed", "/social/deal-popularity/nonexistent",
    "/social/challenges", "/social/group-deals", "/voice/suggestions", "/personalization/recommendations",
    "/personalization/predictions", "/personalization/insights",
    "/pricing/demand-prediction/nonexistent", "/pricing/analytics/nonexistent", "/pricing/personalized",
    "/pricing/user-segment", "/pricing/market-analysis/restaurant", "/cv/receipt-history",
    "/cv/ar-businesses?latitude=40.7&longitude=-74.0", "/cv/visual-search-history", "/cv/ar-calibration",
    "/cv/analytics/receipt-insights", "/security/status", "/security/headers", "/security/rate-limit-status",
    "/auth/sessions", "/auth/permissions", "/auth/roles", "/mobile/device/status/nonexistent",
    "/mobile/security/policies", "/mobile/certificate/pins", "/mobile/security/threats",
    "/mobile/security/attestation/nonexistent", "/gdpr/consent", "/gdpr/requests", "/gdpr/audit-log",
    "/gdpr/retention-policies", "/admin/platform/settings", "/admin/analytics",
]


@pytest.mark.parametrize("path", GET_ENDPOINTS)
def test_get_no_5xx_admin(path, admin):
    r = requests.get(f"{API}{path}", headers=auth_headers(admin), timeout=30)
    assert r.status_code < 500, f"{path} -> {r.status_code} {r.text[:200]}"
