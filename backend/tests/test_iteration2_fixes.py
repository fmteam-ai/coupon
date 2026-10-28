# Iteration 2 regression: business register (state/zip/postalCode), business session_token auth,
# missing password_hash -> 401, /auth/* verification routes, /voice/* + /personalization/* routes
import uuid
from datetime import datetime, timedelta

import bcrypt
import pytest
import requests

from conftest import BASE_URL, auth_headers

API = f"{BASE_URL}/api"


def _uid():
    return uuid.uuid4().hex[:8]


def _auth_payload(owner_email, password="TestPass123!"):
    return {
        "name": f"TEST_Biz_{_uid()}", "email": f"test_bizmail_{_uid()}@example.com", "phone": "+12125550100",
        "address": "1 Test St", "city": "New York", "state": "New York", "zip_code": "10013",
        "country": "US", "category": "restaurant", "description": "TEST business",
        "latitude": 40.72, "longitude": -74.0, "owner_name": "TEST Owner",
        "owner_email": owner_email, "password": password,
    }


def _session_payload(**over):
    p = {
        "name": f"TEST_SessBiz_{_uid()}", "description": "TEST", "category": "restaurant",
        "email": f"test_sessbiz_{_uid()}@example.com", "phone": "+12125550101", "address": "2 Test St",
        "city": "New York", "country": "US", "latitude": 40.7, "longitude": -74.0,
        "precise_latitude": 40.70001, "precise_longitude": -74.00001, "location_verified_by_map": True,
    }
    p.update(over)
    return p


# ---------- CRITICAL: POST /api/businesses/register ----------
class TestBusinessesRegister:
    def test_postal_code_maps_to_zip(self, customer, mongo_db):
        p = _session_payload(state="NY", postalCode="10001")
        r = requests.post(f"{API}/businesses/register", json=p, headers=auth_headers(customer))
        assert r.status_code == 200, f"{r.status_code} {r.text[:300]}"
        b = mongo_db.businesses.find_one({"id": r.json()["business_id"]}, {"_id": 0})
        assert b["state"] == "NY" and b["zip_code"] == "10001"
        assert "postalCode" not in b
        assert b["precise_latitude"] == 40.70001 and b["location_verified_by_map"] is True
        assert b["is_approved"] is False

    def test_zip_code_and_state(self, customer, mongo_db):
        p = _session_payload(state="California", zip_code="94105")
        r = requests.post(f"{API}/businesses/register", json=p, headers=auth_headers(customer))
        assert r.status_code == 200, r.text[:300]
        b = mongo_db.businesses.find_one({"id": r.json()["business_id"]})
        assert b["state"] == "California" and b["zip_code"] == "94105"

    def test_minimal_without_state_zip(self, customer):
        r = requests.post(f"{API}/businesses/register", json=_session_payload(), headers=auth_headers(customer))
        assert r.status_code == 200, r.text[:300]

    def test_missing_required_field_422(self, customer):
        p = _session_payload()
        p.pop("name")
        r = requests.post(f"{API}/businesses/register", json=p, headers=auth_headers(customer))
        assert r.status_code == 422

    def test_unauth_401(self):
        r = requests.post(f"{API}/businesses/register", json=_session_payload(postalCode="10001"))
        assert r.status_code == 401


# ---------- CRITICAL: business auth returns session_token ----------
class TestBusinessSessionAuth:
    @pytest.fixture(scope="class")
    def reg(self):
        p = _auth_payload(f"test_bizowner_{_uid()}@example.com")
        r = requests.post(f"{API}/business/auth/register", json=p)
        assert r.status_code == 200, r.text
        return p, r.json()

    def test_register_returns_session_token(self, reg):
        _, d = reg
        assert d.get("session_token") and d.get("token_type") == "bearer"
        assert "access_token" not in d

    def test_register_token_works_on_auth_me(self, reg):
        p, d = reg
        r = requests.get(f"{API}/auth/me", headers={"Authorization": f"Bearer {d['session_token']}"})
        assert r.status_code == 200, r.text
        assert r.json()["email"] == p["owner_email"]

    def test_login_returns_session_token_and_persisted(self, reg, mongo_db):
        p, d = reg
        r = requests.post(f"{API}/business/auth/login", json={"email": p["email"], "password": p["password"]})
        assert r.status_code == 200, r.text
        tok = r.json()["session_token"]
        assert r.json()["business_id"] == d["business_id"]
        assert mongo_db.user_sessions.find_one({"session_token": tok}) is not None
        pytest.biz_login_token = tok

    def test_login_token_on_business_endpoints(self, reg):
        h = {"Authorization": f"Bearer {pytest.biz_login_token}"}
        for path in ["/business/verification-status", "/business/realtime-metrics", "/business/subscription/status"]:
            r = requests.get(f"{API}{path}", headers=h)
            assert r.status_code == 200, f"{path} -> {r.status_code} {r.text[:200]}"

    def test_login_token_on_require_business_auth_endpoint(self, reg):
        # /business/advanced-analytics uses require_business_auth (user_type in business/admin)
        h = {"Authorization": f"Bearer {pytest.biz_login_token}"}
        r = requests.get(f"{API}/business/advanced-analytics", headers=h)
        assert r.status_code != 403, f"business_owner rejected by require_business_auth: {r.text[:200]}"

    def test_login_wrong_password_401(self, reg):
        p, _ = reg
        r = requests.post(f"{API}/business/auth/login", json={"email": p["email"], "password": "nope"})
        assert r.status_code == 401

    def test_login_unknown_business_401(self):
        r = requests.post(f"{API}/business/auth/login", json={"email": "test_nobody@example.com", "password": "x"})
        assert r.status_code == 401


# ---------- CRITICAL: login with missing password_hash -> 401 ----------
class TestMissingPasswordHash:
    def test_login_owner_without_password_hash_401(self, mongo_db):
        uid = f"test-nopw-{_uid()}"
        email = f"test_nopw_{_uid()}@example.com"
        biz_email = f"test_nopwbiz_{_uid()}@example.com"
        mongo_db.users.insert_one({"id": uid, "email": email, "name": "TEST nopw", "user_type": "business",
                                   "created_at": datetime.utcnow()})
        mongo_db.businesses.insert_one({"id": f"test-biz-{_uid()}", "name": f"TEST_NoPw_{_uid()}", "email": biz_email,
                                        "owner_id": uid, "is_approved": True})
        r = requests.post(f"{API}/business/auth/login", json={"email": biz_email, "password": "whatever"})
        assert r.status_code == 401, f"{r.status_code} {r.text[:200]}"

    def test_register_existing_google_user_sets_password(self, mongo_db):
        # existing user w/o password_hash -> register sets hash -> login works
        email = f"test_google_{_uid()}@example.com"
        mongo_db.users.insert_one({"id": f"test-google-{_uid()}", "email": email, "name": "TEST google",
                                   "user_type": "customer", "created_at": datetime.utcnow()})
        p = _auth_payload(email, password="GooglePw123!")
        r = requests.post(f"{API}/business/auth/register", json=p)
        assert r.status_code == 200, r.text
        lr = requests.post(f"{API}/business/auth/login", json={"email": p["email"], "password": "GooglePw123!"})
        assert lr.status_code == 200, lr.text

    def test_register_existing_password_user_requires_password(self, mongo_db):
        # SECURITY: owner_email of an existing password user must not yield a session without password check
        email = f"test_victim_{_uid()}@example.com"
        uid = f"test-victim-{_uid()}"
        mongo_db.users.insert_one({"id": uid, "email": email, "name": "TEST victim", "user_type": "customer",
                                   "password_hash": bcrypt.hashpw(b"RealPw!1", bcrypt.gensalt()).decode(),
                                   "created_at": datetime.utcnow()})
        r = requests.post(f"{API}/business/auth/register", json=_auth_payload(email, password="AttackerPw!"))
        if r.status_code == 200:
            me = requests.get(f"{API}/auth/me", headers={"Authorization": f"Bearer {r.json()['session_token']}"})
            assert me.status_code != 200 or me.json().get("id") != uid, \
                "Account takeover: register with victim owner_email + wrong password returned victim session"


# ---------- HIGH: /api/auth/* verification routes ----------
class TestAuthVerificationRoutes:
    def test_send_email_verification_and_verify(self, customer, mongo_db):
        h = auth_headers(customer)
        r = requests.post(f"{API}/auth/send-email-verification", json={"email": customer["email"]}, headers=h)
        assert r.status_code == 200, r.text
        rec = mongo_db.email_verifications.find_one({"user_id": customer["id"]}, sort=[("created_at", -1)])
        assert rec is not None
        bad = requests.post(f"{API}/auth/verify-email", json={"verification_code": "000000x"}, headers=h)
        assert bad.status_code == 400
        ok = requests.post(f"{API}/auth/verify-email", json={"verification_code": rec["verification_code"]}, headers=h)
        assert ok.status_code == 200, ok.text

    def test_email_verified_reflected_in_auth_me(self, customer):
        me = requests.get(f"{API}/auth/me", headers=auth_headers(customer)).json()
        assert me.get("is_email_verified") is True, "verify-email sets 'email_verified' but User model uses 'is_email_verified'"

    def test_send_phone_verification_and_verify(self, customer, mongo_db):
        h = auth_headers(customer)
        r = requests.post(f"{API}/auth/send-phone-verification", json={"phone": "+12125550199"}, headers=h)
        assert r.status_code == 200, r.text
        rec = mongo_db.phone_verifications.find_one({"user_id": customer["id"]}, sort=[("created_at", -1)])
        ok = requests.post(f"{API}/auth/verify-phone", json={"verification_code": rec["verification_code"]}, headers=h)
        assert ok.status_code == 200, ok.text

    def test_frontend_contract_send_email_no_body(self, customer):
        # verification.tsx sends POST with no body
        r = requests.post(f"{API}/auth/send-email-verification", headers={"Authorization": f"Bearer {customer['token']}"})
        assert r.status_code == 200, f"frontend call (no body) -> {r.status_code} {r.text[:200]}"

    def test_frontend_contract_verify_email_code_key(self, customer):
        # verification.tsx sends {email, code}
        r = requests.post(f"{API}/auth/verify-email", json={"email": customer["email"], "code": "123456"},
                          headers=auth_headers(customer))
        assert r.status_code != 400 or "required" not in r.text, f"'code' key not accepted: {r.text[:200]}"

    def test_frontend_contract_send_phone_query(self, customer):
        # verification.tsx sends phone as query param with no body
        r = requests.post(f"{API}/auth/send-phone-verification?phone=%2B12125550199",
                          headers={"Authorization": f"Bearer {customer['token']}"})
        assert r.status_code == 200, f"frontend call (query phone) -> {r.status_code} {r.text[:200]}"

    def test_verification_unauth_401(self):
        for path in ["send-email-verification", "verify-email", "send-phone-verification", "verify-phone"]:
            r = requests.post(f"{API}/auth/{path}", json={})
            assert r.status_code == 401, f"{path} -> {r.status_code}"


# ---------- HIGH: /api/voice/* and /api/personalization/* ----------
class TestVoicePersonalization:
    def test_voice_suggestions(self, customer):
        r = requests.get(f"{API}/voice/suggestions", headers=auth_headers(customer), timeout=30)
        assert r.status_code == 200, r.text[:200]

    def test_voice_process(self, customer):
        r = requests.post(f"{API}/voice/process", json={"voice_text": "find pizza deals near me",
                          "location": {"latitude": 40.7, "longitude": -74.0}}, headers=auth_headers(customer), timeout=60)
        assert r.status_code == 200, r.text[:300]
        assert isinstance(r.json(), dict)

    def test_voice_process_empty_400(self, customer):
        r = requests.post(f"{API}/voice/process", json={"voice_text": ""}, headers=auth_headers(customer))
        assert r.status_code == 400

    def test_voice_feedback_persisted(self, customer, mongo_db):
        iid = f"test-int-{_uid()}"
        r = requests.post(f"{API}/voice/feedback", json={"interaction_id": iid, "rating": 5, "feedback": "TEST"},
                          headers=auth_headers(customer))
        assert r.status_code == 200, r.text[:200]
        assert mongo_db.voice_feedback.find_one({"interaction_id": iid}) is not None

    def test_personalization_track(self, customer):
        r = requests.post(f"{API}/personalization/track", json={"action": "view", "data": {"category": "restaurant"}},
                          headers=auth_headers(customer))
        assert r.status_code == 200, r.text[:200]

    @pytest.mark.parametrize("path", ["recommendations", "predictions", "insights"])
    def test_personalization_get(self, customer, path):
        r = requests.get(f"{API}/personalization/{path}", headers=auth_headers(customer), timeout=30)
        assert r.status_code == 200, f"{path} -> {r.status_code} {r.text[:200]}"
        assert r.json()["success"] is True

    def test_voice_unauth_401(self):
        assert requests.get(f"{API}/voice/suggestions").status_code == 401

    def test_old_double_api_prefix_gone(self, customer):
        r = requests.get(f"{API}/api/voice/suggestions", headers=auth_headers(customer))
        assert r.status_code == 404


# ---------- Core flow: create discount (approved biz + trial sub) -> redeem (datetime parsing regression) ----------
class TestDiscountFlow:
    def test_create_and_redeem_discount(self, mongo_db, customer):
        from conftest import _seed_user
        owner = _seed_user(mongo_db, "business")
        p = _session_payload(state="NY", zip_code="10001")
        r = requests.post(f"{API}/businesses/register", json=p, headers=auth_headers(owner))
        assert r.status_code == 200, r.text[:200]
        bid = r.json()["business_id"]
        mongo_db.businesses.update_one({"id": bid}, {"$set": {"is_approved": True}})
        # make sure this owner's trial subscription is active
        mongo_db.business_subscriptions.update_one({"business_id": bid}, {"$set": {
            "status": "trial", "trial_end": datetime.utcnow() + timedelta(days=30)}})
        mongo_db.businesses.update_many({"owner_id": owner["id"], "id": {"$ne": bid}}, {"$set": {"is_approved": False}})
        exp = (datetime.utcnow() + timedelta(days=5)).isoformat()
        d = requests.post(f"{API}/discounts", json={"title": "TEST 10% off", "description": "TEST", "discount_type": "percentage",
                          "discount_value": 10, "expires_at": exp}, headers=auth_headers(owner))
        assert d.status_code == 200, f"create discount -> {d.status_code} {d.text[:200]}"
        did, qr = d.json()["discount_id"], d.json()["qr_code"]
        red = requests.post(f"{API}/discounts/{did}/redeem", json={"qr_code": qr, "transaction_amount": 20},
                            headers=auth_headers(customer))
        assert red.status_code == 200, f"redeem -> {red.status_code} {red.text[:200]}"
        assert mongo_db.coupon_usage.find_one({"discount_id": did, "user_id": customer["id"]}) is not None
        again = requests.post(f"{API}/discounts/{did}/redeem", json={"qr_code": qr}, headers=auth_headers(customer))
        assert again.status_code == 400
        mongo_db.discounts.delete_one({"id": did})
