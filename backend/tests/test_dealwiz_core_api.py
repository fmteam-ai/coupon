# DealWiz backend regression: subscription plans, token refresh, business registration (location fields),
# email verification, push tokens, realtime metrics, admin endpoints, payment intent
import os
import sys
import uuid

import pytest
import requests

from conftest import BASE_URL, auth_headers

API = f"{BASE_URL}/api"


# ---------- Public endpoints ----------
class TestPublic:
    def test_categories(self, api):
        r = api.get(f"{API}/categories")
        assert r.status_code == 200, r.text
        assert isinstance(r.json(), (list, dict))

    def test_businesses_list(self, api):
        r = api.get(f"{API}/businesses")
        assert r.status_code == 200, r.text
        assert isinstance(r.json(), list)

    def test_discounts_list(self, api):
        r = api.get(f"{API}/discounts")
        assert r.status_code == 200, r.text
        assert isinstance(r.json(), list)


# ---------- Subscription plans (ObjectId serialization fix) ----------
class TestSubscriptionPlans:
    def test_init_plans_as_admin(self, api, admin):
        r = api.post(f"{API}/admin/subscription-plans/init", headers=auth_headers(admin))
        assert r.status_code == 200, r.text

    def test_get_plans_serializable(self, api):
        r = api.get(f"{API}/subscription-plans")
        assert r.status_code == 200, r.text
        plans = r.json()
        assert isinstance(plans, list) and len(plans) > 0
        assert "id" in plans[0] or "name" in plans[0]


# ---------- Session auth ----------
class TestSessionAuth:
    def test_me_no_auth(self, api):
        assert api.get(f"{API}/auth/me").status_code == 401

    def test_me_string_expiry_session(self, api, customer):
        r = api.get(f"{API}/auth/me", headers=auth_headers(customer))
        assert r.status_code == 200, r.text
        assert r.json()["email"] == customer["email"]

    def test_me_datetime_expiry_session(self, api, datetime_session_user):
        # /auth/session (Google OAuth) stores expires_at as datetime; get_current_user calls fromisoformat on it
        r = api.get(f"{API}/auth/me", headers=auth_headers(datetime_session_user))
        assert r.status_code == 200, f"{r.status_code} {r.text[:200]}"


# ---------- JWT token refresh ----------
class TestTokenRefresh:
    def test_refresh_invalid_token_returns_401(self, api):
        r = api.post(f"{API}/auth/token/refresh", json={"refresh_token": "invalid.token.value"})
        assert r.status_code == 401, f"{r.status_code} {r.text[:200]}"

    def test_refresh_missing_body_422(self, api):
        r = api.post(f"{API}/auth/token/refresh", json={})
        assert r.status_code == 422

    def test_refresh_valid_token(self, api, customer):
        sys.path.insert(0, "/app/backend")
        from auth_security import enhanced_auth_manager
        pair = enhanced_auth_manager.generate_token_pair(customer["id"], "customer")
        assert pair.get("refresh_token"), f"token pair generation failed: {pair}"
        r = api.post(f"{API}/auth/token/refresh", json={"refresh_token": pair["refresh_token"]})
        assert r.status_code == 200, f"{r.status_code} {r.text[:200]}"
        assert "access_token" in r.json()


# ---------- Business registration with enhanced location fields ----------
def _biz_payload(owner_email, password="TestPass123!"):
    suf = uuid.uuid4().hex[:6]
    return {
        "name": f"TEST_Biz_{suf}", "email": f"test_biz_{suf}@example.com", "phone": "+12125550100",
        "address": "123 Canal St", "city": "New York", "state": "New York", "zip_code": "10013",
        "postalCode": "10013", "country": "US", "category": "restaurant", "description": "Test business",
        "latitude": 40.7214, "longitude": -74.0071, "precise_latitude": 40.72141,
        "precise_longitude": -74.00712, "location_verified_by_map": True,
        "owner_name": "TEST Owner", "owner_email": owner_email, "password": password,
    }


class TestBusinessRegistration:
    def test_session_register_with_state_postal(self, api, customer, mongo_db):
        p = _biz_payload(customer["email"])
        r = api.post(f"{API}/businesses/register", json=p, headers=auth_headers(customer))
        assert r.status_code == 200, f"{r.status_code} {r.text[:300]}"
        b = mongo_db.businesses.find_one({"id": r.json()["business_id"]})
        assert b["state"] == "New York" and b["zip_code"] == "10013"

    def test_business_auth_register_login_flow(self, api, mongo_db):
        owner_email = f"test_newowner_{uuid.uuid4().hex[:6]}@example.com"
        p = _biz_payload(owner_email)
        r = api.post(f"{API}/business/auth/register", json=p)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["success"] and d["session_token"] and d["requires_admin_approval"]
        b = mongo_db.businesses.find_one({"id": d["business_id"]}, {"_id": 0})
        assert b["state"] == "New York" and b["zip_code"] == "10013"
        assert b["precise_latitude"] == 40.72141 and b["location_verified_by_map"] is True
        # duplicate
        assert api.post(f"{API}/business/auth/register", json=p).status_code == 400
        # login ok / bad
        ok = api.post(f"{API}/business/auth/login", json={"email": p["email"], "password": p["password"]})
        assert ok.status_code == 200 and ok.json()["business_id"] == d["business_id"]
        bad = api.post(f"{API}/business/auth/login", json={"email": p["email"], "password": "wrong"})
        assert bad.status_code == 401
        pytest.business_jwt = ok.json()["session_token"]

    def test_business_jwt_usable_on_business_endpoints(self, api):
        tok = getattr(pytest, "business_jwt", None)
        if not tok:
            pytest.skip("no business jwt")
        r = api.get(f"{API}/business/verification-status", headers={"Authorization": f"Bearer {tok}"})
        assert r.status_code == 200, f"JWT from /business/auth/login rejected: {r.status_code} {r.text[:150]}"

    def test_login_existing_user_without_password(self, api, mongo_db):
        # owner_email belongs to pre-existing user w/o password_hash (e.g. Google user)
        u = mongo_db.users.find_one({"email": {"$regex": "^test_customer"}})
        p = _biz_payload(u["email"])
        r = api.post(f"{API}/business/auth/register", json=p)
        assert r.status_code == 200, r.text
        lr = api.post(f"{API}/business/auth/login", json={"email": p["email"], "password": p["password"]})
        # iteration 2 fix: register now sets password_hash for passwordless users -> login succeeds
        assert lr.status_code == 200, f"{lr.status_code} {lr.text[:200]}"


# ---------- Email verification / push / realtime metrics (business owner session) ----------
class TestOwnerFlows:
    @pytest.fixture(scope="class")
    def owner_biz(self, owner):
        p = _biz_payload(owner["email"])
        r = requests.post(f"{API}/business/auth/register", json=p)
        assert r.status_code == 200, r.text
        return r.json()["business_id"]

    def test_resend_and_verify_email(self, api, owner, owner_biz, mongo_db):
        h = auth_headers(owner)
        r = api.post(f"{API}/business/resend-verification", headers=h)
        assert r.status_code == 200, r.text
        assert r.json()["success"] is True
        rec = mongo_db.business_email_verifications.find_one({"business_id": owner_biz, "verified": False})
        assert rec is not None
        bad = api.post(f"{API}/business/verify-email", json={"verification_code": "000000x"}, headers=h)
        assert bad.status_code == 400
        ok = api.post(f"{API}/business/verify-email", json={"verification_code": rec["verification_code"]}, headers=h)
        assert ok.status_code == 200, ok.text
        st = api.get(f"{API}/business/verification-status", headers=h)
        assert st.status_code == 200 and st.json()["email_verified"] is True
        again = api.post(f"{API}/business/resend-verification", headers=h)
        assert again.status_code == 400

    def test_push_token(self, api, owner, mongo_db):
        r = api.post(f"{API}/users/push-token", json={"pushToken": "ExponentPushToken[TEST123]"}, headers=auth_headers(owner))
        assert r.status_code == 200, r.text
        assert mongo_db.users.find_one({"id": owner["id"]})["pushToken"] == "ExponentPushToken[TEST123]"

    def test_push_token_unauth(self, api):
        assert api.post(f"{API}/users/push-token", json={"pushToken": "x"}).status_code == 401

    def test_realtime_metrics(self, api, owner, owner_biz):
        r = api.get(f"{API}/business/realtime-metrics", headers=auth_headers(owner))
        assert r.status_code == 200, f"{r.status_code} {r.text[:300]}"
        assert isinstance(r.json(), dict)

    def test_subscription_status(self, api, owner, owner_biz):
        r = api.get(f"{API}/business/subscription/status", headers=auth_headers(owner))
        assert r.status_code == 200, f"{r.status_code} {r.text[:300]}"


# ---------- Admin endpoints ----------
class TestAdmin:
    def test_approve_business(self, api, admin, mongo_db):
        p = _biz_payload(f"test_appr_{uuid.uuid4().hex[:6]}@example.com")
        bid = requests.post(f"{API}/business/auth/register", json=p).json()["business_id"]
        r = api.post(f"{API}/admin/approve-business", json={"business_id": bid, "action": "approve"}, headers=auth_headers(admin))
        assert r.status_code == 200, r.text
        assert mongo_db.businesses.find_one({"id": bid})["is_approved"] is True
        assert api.post(f"{API}/admin/approve-business", json={"business_id": bid, "action": "foo"}, headers=auth_headers(admin)).status_code == 400
        assert api.post(f"{API}/admin/approve-business", json={"business_id": "nope", "action": "approve"}, headers=auth_headers(admin)).status_code == 404

    def test_approve_business_non_admin(self, api, customer):
        r = api.post(f"{API}/admin/approve-business", json={"business_id": "x", "action": "approve"}, headers=auth_headers(customer))
        assert r.status_code == 403

    def test_platform_settings_get_put(self, api, admin):
        h = auth_headers(admin)
        g = api.get(f"{API}/admin/platform/settings", headers=h)
        assert g.status_code == 200, g.text
        orig = g.json().get("contact_email", "support@dealwiz.com")
        u = api.put(f"{API}/admin/platform/settings", json={"contact_email": "test_support@dealwiz.com"}, headers=h)
        assert u.status_code == 200, u.text
        assert api.get(f"{API}/admin/platform/settings", headers=h).json()["contact_email"] == "test_support@dealwiz.com"
        api.put(f"{API}/admin/platform/settings", json={"contact_email": orig}, headers=h)

    def test_admin_analytics(self, api, admin):
        r = api.get(f"{API}/admin/analytics", headers=auth_headers(admin))
        assert r.status_code == 200, f"{r.status_code} {r.text[:300]}"
        assert isinstance(r.json(), dict)

    def test_admin_businesses_list(self, api, admin):
        r = api.get(f"{API}/admin/businesses", headers=auth_headers(admin))
        assert r.status_code == 200, f"{r.status_code} {r.text[:300]}"

    def test_admin_suspend_unsuspend(self, api, admin):
        p = _biz_payload(f"test_susp_{uuid.uuid4().hex[:6]}@example.com")
        bid = requests.post(f"{API}/business/auth/register", json=p).json()["business_id"]
        h = auth_headers(admin)
        s = api.post(f"{API}/admin/business/suspend", json={"business_id": bid, "reason": "TEST policy"}, headers=h)
        assert s.status_code == 200, f"{s.status_code} {s.text[:300]}"
        login = api.post(f"{API}/business/auth/login", json={"email": p["email"], "password": p["password"]})
        assert login.status_code == 403
        u = api.post(f"{API}/admin/business/unsuspend", params={"business_id": bid}, headers=h)  # NOTE: query param, inconsistent with suspend (body)
        assert u.status_code == 200, f"{u.status_code} {u.text[:300]}"


# ---------- Payment ----------
class TestPayment:
    def test_create_payment_intent(self, api, customer, mongo_db):
        r = api.post(f"{API}/create-payment-intent", json={"amount": 999, "currency": "usd"}, headers=auth_headers(customer))
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["amount"] == 999 and d["client_secret"].startswith(d["id"])
        assert mongo_db.payment_intents.find_one({"id": d["id"]}) is not None

    def test_create_payment_intent_invalid_amount(self, api, customer):
        r = api.post(f"{API}/create-payment-intent", json={"amount": 0}, headers=auth_headers(customer))
        assert r.status_code == 400

    def test_create_payment_intent_unauth(self, api):
        assert api.post(f"{API}/create-payment-intent", json={"amount": 100}).status_code == 401
