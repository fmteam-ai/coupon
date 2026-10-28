# Shared fixtures: BASE_URL, Mongo access, seeded customer/admin users with sessions
import os
import uuid
from datetime import datetime, timedelta

import pytest
import requests
from pymongo import MongoClient

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", os.environ.get("EXPO_BACKEND_URL")).rstrip("/")
MONGO_URL = os.environ.get("MONGO_URL")
DB_NAME = os.environ.get("DB_NAME")


@pytest.fixture(scope="session")
def base_url():
    return BASE_URL


@pytest.fixture(scope="session")
def mongo_db():
    client = MongoClient(MONGO_URL)
    db = client[DB_NAME]
    yield db
    # Cleanup TEST_ data
    db.users.delete_many({"email": {"$regex": "^test_", "$options": "i"}})
    db.businesses.delete_many({"name": {"$regex": "^TEST_"}})
    client.close()


def _seed_user(db, user_type, expires_as_string=True):
    uid = f"test-{user_type}-{uuid.uuid4().hex[:8]}"
    email = f"test_{user_type}_{uuid.uuid4().hex[:6]}@example.com"
    token = f"test_session_{uuid.uuid4().hex}"
    db.users.insert_one({
        "id": uid, "email": email, "name": f"TEST {user_type}", "user_type": user_type,
        "created_at": datetime.utcnow(), "is_active": True, "is_email_verified": False,
        "is_phone_verified": False, "points": 0, "level": 1, "badges": [], "streak_days": 0,
        "total_savings": 0.0, "deals_used": 0, "reviews_written": 0, "preferences": {},
        "favorite_categories": [], "spending_patterns": {},
    })
    exp = datetime.utcnow() + timedelta(days=7)
    db.user_sessions.insert_one({
        "id": str(uuid.uuid4()), "user_id": uid, "session_token": token,
        "expires_at": exp.isoformat() if expires_as_string else exp,
        "created_at": datetime.utcnow(),
    })
    return {"id": uid, "email": email, "token": token}


@pytest.fixture(scope="session")
def customer(mongo_db):
    return _seed_user(mongo_db, "customer")


@pytest.fixture(scope="session")
def admin(mongo_db):
    return _seed_user(mongo_db, "admin")


@pytest.fixture(scope="session")
def owner(mongo_db):
    return _seed_user(mongo_db, "business")


@pytest.fixture(scope="session")
def datetime_session_user(mongo_db):
    # Session stored as real datetime - same shape /auth/session (Google OAuth) writes
    return _seed_user(mongo_db, "customer", expires_as_string=False)


def auth_headers(user):
    return {"Authorization": f"Bearer {user['token']}", "Content-Type": "application/json"}


@pytest.fixture
def api():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s
