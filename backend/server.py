from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, Response, BackgroundTasks
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timedelta
import httpx
import json
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import base64
import stripe
import random
import string
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import asyncio
import re
from emergentintegrations.llm.chat import LlmChat

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client_db = AsyncIOMotorClient(mongo_url)
db = client_db[os.environ['DB_NAME']]

# Stripe configuration
stripe.api_key = os.environ['STRIPE_SECRET_KEY']

# Emergent LLM client initialization (lazy loading)
llm_client = None

def get_llm_client():
    global llm_client
    if llm_client is None:
        llm_client = LlmChat(
            api_key="sk-emergent-72b22E50527Cf2425C",
            session_id="ai_recommendations",
            system_message="You are an AI shopping assistant that provides personalized deal recommendations based on user preferences and behavior."
        )
    return llm_client

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

security = HTTPBearer(auto_error=False)

# Enhanced User Models with Gamification
class User(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    email: EmailStr
    name: str
    picture: Optional[str] = None
    user_type: str = "customer"  # customer, business, admin
    phone: Optional[str] = None
    country: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    is_active: bool = True
    is_email_verified: bool = False
    is_phone_verified: bool = False
    email_verification_code: Optional[str] = None
    phone_verification_code: Optional[str] = None
    # Gamification fields
    points: int = 0
    level: int = 1
    badges: List[str] = []
    streak_days: int = 0
    last_activity: Optional[datetime] = None
    total_savings: float = 0.0
    deals_used: int = 0
    reviews_written: int = 0
    # AI Preferences
    preferences: Dict[str, Any] = {}
    favorite_categories: List[str] = []
    spending_patterns: Dict[str, Any] = {}

class UserSession(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    session_token: str
    expires_at: datetime
    created_at: datetime = Field(default_factory=datetime.utcnow)

class UserRegistration(BaseModel):
    name: str
    email: EmailStr
    phone: Optional[str] = None
    country: Optional[str] = None
    user_type: str = "customer"

class BusinessRegistration(BaseModel):
    name: str
    description: str
    category: str
    email: EmailStr
    phone: str
    address: str
    city: str
    country: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None

class EmailVerification(BaseModel):
    email: EmailStr
    code: str

class PhoneVerification(BaseModel):
    phone: str
    code: str

# Gamification Models
class UserReward(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    reward_type: str  # points, badge, cashback, level_up
    reward_value: int  # points amount or level
    reward_data: Dict[str, Any] = {}  # badge name, etc.
    earned_at: datetime = Field(default_factory=datetime.utcnow)
    source: str  # deal_usage, review, streak, referral
    source_id: Optional[str] = None

class Badge(BaseModel):
    id: str
    name: str
    description: str
    icon: str
    requirements: Dict[str, Any]
    points_reward: int = 0

class UserGeofence(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    business_id: str
    latitude: float
    longitude: float
    radius_meters: int = 100
    is_active: bool = True
    notifications_sent: int = 0
    last_triggered: Optional[datetime] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

# Cashback Models
class CashbackTransaction(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    business_id: str
    discount_id: str
    original_amount: float
    discount_amount: float
    cashback_percentage: float = 5.0  # 5% cashback default
    cashback_amount: float
    transaction_date: datetime = Field(default_factory=datetime.utcnow)
    status: str = "pending"  # pending, confirmed, paid_out
    payment_method: str = "wallet"  # wallet, bank, crypto

class UserWallet(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    balance: float = 0.0
    total_earned: float = 0.0
    total_withdrawn: float = 0.0
    currency: str = "USD"
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

# AI Recommendation Models
class AIRecommendation(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    discount_id: str
    business_id: str
    confidence_score: float  # 0.0 to 1.0
    reasoning: str
    recommendation_type: str  # personal, trending, location, weather
    created_at: datetime = Field(default_factory=datetime.utcnow)
    shown_at: Optional[datetime] = None
    clicked: bool = False
    used: bool = False

class UserPreference(BaseModel):
    user_id: str
    category_preferences: Dict[str, float] = {}  # category -> preference score
    price_sensitivity: float = 0.5  # 0.0 (price-insensitive) to 1.0 (very price sensitive)
    distance_preference: float = 0.3  # preferred distance in km
    time_preferences: Dict[str, float] = {}  # hour -> preference score
    dietary_restrictions: List[str] = []
    brand_preferences: List[str] = []
    updated_at: datetime = Field(default_factory=datetime.utcnow)

# Enhanced Business Models
class Business(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    description: str
    category: str
    owner_id: str
    email: EmailStr
    phone: str
    address: str
    city: str
    country: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    logo: Optional[str] = None
    is_approved: bool = False
    is_active: bool = True
    created_at: datetime = Field(default_factory=datetime.utcnow)
    approved_at: Optional[datetime] = None
    rating: float = 0.0
    review_count: int = 0
    subscription_id: Optional[str] = None
    stripe_customer_id: Optional[str] = None
    # Advanced Analytics
    total_revenue_generated: float = 0.0
    total_customers_acquired: int = 0
    avg_customer_spend: float = 0.0
    peak_hours: Dict[str, int] = {}
    popular_deals: List[str] = []
    customer_retention_rate: float = 0.0

class BusinessAnalytics(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    business_id: str
    date: datetime = Field(default_factory=datetime.utcnow)
    daily_visits: int = 0
    daily_redemptions: int = 0
    daily_revenue: float = 0.0
    new_customers: int = 0
    returning_customers: int = 0
    avg_transaction_value: float = 0.0
    popular_time_slots: Dict[str, int] = {}
    customer_demographics: Dict[str, Any] = {}
    conversion_rate: float = 0.0

# Enhanced Discount Models
class Discount(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    business_id: str
    title: str
    description: str
    discount_type: str  # percentage, fixed_amount
    discount_value: float
    minimum_consumption: Optional[float] = 0
    max_uses: Optional[int] = None
    max_uses_per_user: int = 1
    current_uses: int = 0
    expires_at: datetime
    is_active: bool = True
    created_at: datetime = Field(default_factory=datetime.utcnow)
    qr_code: Optional[str] = None
    terms_conditions: Optional[str] = None
    # AI & Analytics fields
    ai_recommended: bool = False
    trending_score: float = 0.0
    success_rate: float = 0.0
    target_demographics: List[str] = []
    cashback_eligible: bool = True
    geofence_enabled: bool = False

class DiscountCreate(BaseModel):
    title: str
    description: str
    discount_type: str
    discount_value: float
    minimum_consumption: Optional[float] = 0
    max_uses: Optional[int] = None
    max_uses_per_user: int = 1
    expires_at: datetime
    terms_conditions: Optional[str] = None
    cashback_eligible: bool = True
    geofence_enabled: bool = False

# Subscription Models (existing)
class SubscriptionPlan(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    description: str
    price: float
    stripe_price_id: str
    features: List[str]
    max_coupons: int = -1
    max_locations: int = 1
    analytics_included: bool = True
    ai_recommendations: bool = False
    geofencing: bool = False
    advanced_analytics: bool = False
    created_at: datetime = Field(default_factory=datetime.utcnow)

class BusinessSubscription(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    business_id: str
    plan_id: str
    stripe_subscription_id: Optional[str] = None
    stripe_customer_id: Optional[str] = None
    status: str = "trial"
    trial_start: datetime = Field(default_factory=datetime.utcnow)
    trial_end: datetime = Field(default_factory=lambda: datetime.utcnow() + timedelta(days=365))
    current_period_start: Optional[datetime] = None
    current_period_end: Optional[datetime] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class PlatformSettings(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    trial_period_days: int = 365
    trial_enabled: bool = True
    default_plan_price: float = 99.99
    cashback_rate: float = 5.0
    points_per_dollar: int = 10
    referral_bonus: int = 500
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

# Coupon Usage Tracking (Enhanced)
class CouponUsage(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    discount_id: str
    business_id: str
    user_id: str
    used_at: datetime = Field(default_factory=datetime.utcnow)
    qr_code: str
    verification_status: str = "pending"
    transaction_amount: Optional[float] = None
    cashback_earned: Optional[float] = None
    points_earned: int = 0
    user_location: Optional[Dict[str, float]] = None

class CouponRedemption(BaseModel):
    qr_code: str
    transaction_amount: Optional[float] = None
    user_location: Optional[Dict[str, float]] = None

# Rating Models (existing)
class BusinessRating(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    business_id: str
    user_id: str
    rating: int
    review: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

class RatingCreate(BaseModel):
    rating: int
    review: Optional[str] = None

# Payment Models (existing)
class PaymentIntent(BaseModel):
    plan_id: str
    business_id: str

# Utility Functions
def generate_verification_code() -> str:
    return ''.join(random.choices(string.digits, k=6))

async def send_verification_email(email: str, code: str, name: str):
    print(f"Verification email sent to {email}: Code {code} for {name}")
    return True

async def send_verification_sms(phone: str, code: str):
    print(f"Verification SMS sent to {phone}: Code {code}")
    return True

def calculate_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    import math
    lat1, lon1, lat2, lon2 = map(math.radians, [lat1, lon1, lat2, lon2])
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    a = math.sin(dlat/2)**2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon/2)**2
    c = 2 * math.asin(math.sqrt(a))
    r = 6371  # Radius of earth in kilometers
    return c * r

# Gamification Functions
async def calculate_user_level(points: int) -> int:
    """Calculate user level based on points"""
    if points < 100: return 1
    elif points < 500: return 2
    elif points < 1000: return 3
    elif points < 2500: return 4
    elif points < 5000: return 5
    else: return min(10, 5 + (points - 5000) // 2000)

async def award_points(user_id: str, points: int, source: str, source_id: Optional[str] = None):
    """Award points to user and update level"""
    user = await db.users.find_one({"id": user_id})
    if not user:
        return
    
    new_points = user.get("points", 0) + points
    new_level = await calculate_user_level(new_points)
    
    # Create reward record
    reward = UserReward(
        user_id=user_id,
        reward_type="points",
        reward_value=points,
        source=source,
        source_id=source_id
    )
    await db.user_rewards.insert_one(reward.dict())
    
    # Update user
    update_data = {"points": new_points}
    if new_level > user.get("level", 1):
        update_data["level"] = new_level
        # Award level up bonus
        level_bonus = UserReward(
            user_id=user_id,
            reward_type="level_up",
            reward_value=new_level,
            source="level_progression"
        )
        await db.user_rewards.insert_one(level_bonus.dict())
    
    await db.users.update_one({"id": user_id}, {"$set": update_data})

async def check_and_award_badges(user_id: str):
    """Check if user qualifies for new badges"""
    user = await db.users.find_one({"id": user_id})
    if not user:
        return
    
    current_badges = user.get("badges", [])
    new_badges = []
    
    # Define badge requirements
    badge_requirements = {
        "first_deal": {"deals_used": 1},
        "deal_hunter": {"deals_used": 10},
        "savings_master": {"total_savings": 100.0},
        "reviewer": {"reviews_written": 5},
        "local_explorer": {"unique_businesses": 5},
        "streak_keeper": {"streak_days": 7}
    }
    
    for badge_id, requirements in badge_requirements.items():
        if badge_id not in current_badges:
            qualifies = True
            for req_key, req_value in requirements.items():
                user_value = user.get(req_key, 0)
                if req_key == "unique_businesses":
                    # Count unique businesses from usage
                    unique_count = await db.coupon_usage.distinct("business_id", {"user_id": user_id})
                    user_value = len(unique_count) if unique_count else 0
                
                if user_value < req_value:
                    qualifies = False
                    break
            
            if qualifies:
                new_badges.append(badge_id)
                # Award badge reward
                badge_reward = UserReward(
                    user_id=user_id,
                    reward_type="badge",
                    reward_data={"badge_id": badge_id},
                    source="achievement"
                )
                await db.user_rewards.insert_one(badge_reward.dict())
    
    if new_badges:
        all_badges = current_badges + new_badges
        await db.users.update_one(
            {"id": user_id},
            {"$set": {"badges": all_badges}}
        )

async def update_user_activity(user_id: str):
    """Update user's last activity and streak"""
    user = await db.users.find_one({"id": user_id})
    if not user:
        return
    
    now = datetime.utcnow()
    last_activity = user.get("last_activity")
    streak_days = user.get("streak_days", 0)
    
    if last_activity:
        last_activity_date = datetime.fromisoformat(last_activity) if isinstance(last_activity, str) else last_activity
        days_diff = (now - last_activity_date).days
        
        if days_diff == 1:
            # Consecutive day
            streak_days += 1
            await award_points(user_id, 10, "daily_streak")
        elif days_diff > 1:
            # Streak broken
            streak_days = 1
    else:
        streak_days = 1
    
    await db.users.update_one(
        {"id": user_id},
        {"$set": {
            "last_activity": now.isoformat(),
            "streak_days": streak_days
        }}
    )

# AI Recommendation Functions
async def generate_ai_recommendations(user_id: str) -> List[Dict[str, Any]]:
    """Generate personalized deal recommendations using AI"""
    try:
        user = await db.users.find_one({"id": user_id})
        if not user:
            return []
        
        # Get user's usage history
        usage_history = await db.coupon_usage.find({"user_id": user_id}).to_list(50)
        
        # Get user preferences
        preferences = await db.user_preferences.find_one({"user_id": user_id})
        
        # Get available deals
        active_deals = await db.discounts.find({
            "is_active": True,
            "expires_at": {"$gt": datetime.utcnow().isoformat()}
        }).to_list(100)
        
        # Build context for AI
        user_context = {
            "user_level": user.get("level", 1),
            "favorite_categories": user.get("favorite_categories", []),
            "total_savings": user.get("total_savings", 0),
            "deals_used": user.get("deals_used", 0),
            "recent_categories": [usage.get("category", "Unknown") for usage in usage_history[-5:]],
            "spending_patterns": user.get("spending_patterns", {}),
            "location": user.get("country", "Unknown")
        }
        
        if preferences:
            user_context.update({
                "price_sensitivity": preferences.get("price_sensitivity", 0.5),
                "distance_preference": preferences.get("distance_preference", 0.3),
                "dietary_restrictions": preferences.get("dietary_restrictions", [])
            })
        
        # Prepare deals context
        deals_context = []
        for deal in active_deals[:20]:  # Limit for AI processing
            business = await db.businesses.find_one({"id": deal["business_id"]})
            if business:
                deals_context.append({
                    "deal_id": deal["id"],
                    "title": deal["title"],
                    "description": deal["description"],
                    "category": business["category"],
                    "discount_value": deal["discount_value"],
                    "discount_type": deal["discount_type"],
                    "business_name": business["name"],
                    "business_rating": business.get("rating", 0)
                })
        
        # Generate AI recommendations
        prompt = f"""
        As an AI shopping assistant, recommend the top 5 deals for this user based on their profile and preferences.
        
        User Profile:
        {json.dumps(user_context, indent=2)}
        
        Available Deals:
        {json.dumps(deals_context, indent=2)}
        
        Please respond with ONLY a JSON array of recommended deal IDs with confidence scores and reasoning, like this:
        [
          {{
            "deal_id": "deal123",
            "confidence_score": 0.95,
            "reasoning": "Perfect match for user's favorite restaurant category and high discount value"
          }}
        ]
        """
        
        # Call AI service
        from emergentintegrations.llm.chat import UserMessage
        user_message = UserMessage(text=prompt)
        response = llm_client.with_model("gpt-4o-mini").send_message(user_message)
        
        # Parse AI response
        ai_recommendations = json.loads(response)
        
        # Store recommendations in database
        recommendations = []
        for rec in ai_recommendations[:5]:
            recommendation = AIRecommendation(
                user_id=user_id,
                discount_id=rec["deal_id"],
                business_id=next((d["business_id"] for d in active_deals if d["id"] == rec["deal_id"]), ""),
                confidence_score=rec["confidence_score"],
                reasoning=rec["reasoning"],
                recommendation_type="personal"
            )
            await db.ai_recommendations.insert_one(recommendation.dict())
            recommendations.append(recommendation.dict())
        
        return recommendations
        
    except Exception as e:
        print(f"AI recommendation error: {e}")
        # Fallback to basic recommendations
        return await get_trending_deals(user_id)

async def get_trending_deals(user_id: str) -> List[Dict[str, Any]]:
    """Get trending deals as fallback"""
    trending = await db.discounts.find({
        "is_active": True,
        "expires_at": {"$gt": datetime.utcnow().isoformat()}
    }).sort("current_uses", -1).limit(5).to_list(5)
    
    recommendations = []
    for deal in trending:
        recommendation = AIRecommendation(
            user_id=user_id,
            discount_id=deal["id"],
            business_id=deal["business_id"],
            confidence_score=0.7,
            reasoning="Popular deal with high usage",
            recommendation_type="trending"
        )
        recommendations.append(recommendation.dict())
    
    return recommendations

# Cashback Functions
async def process_cashback(user_id: str, business_id: str, discount_id: str, transaction_amount: float):
    """Process cashback for a transaction"""
    settings = await db.platform_settings.find_one()
    cashback_rate = settings.get("cashback_rate", 5.0) if settings else 5.0
    
    cashback_amount = transaction_amount * (cashback_rate / 100)
    
    # Create cashback transaction
    transaction = CashbackTransaction(
        user_id=user_id,
        business_id=business_id,
        discount_id=discount_id,
        original_amount=transaction_amount,
        discount_amount=0,  # Calculate from discount
        cashback_amount=cashback_amount
    )
    await db.cashback_transactions.insert_one(transaction.dict())
    
    # Update user wallet
    wallet = await db.user_wallets.find_one({"user_id": user_id})
    if not wallet:
        wallet = UserWallet(user_id=user_id)
        await db.user_wallets.insert_one(wallet.dict())
    
    await db.user_wallets.update_one(
        {"user_id": user_id},
        {
            "$inc": {
                "balance": cashback_amount,
                "total_earned": cashback_amount
            },
            "$set": {"updated_at": datetime.utcnow().isoformat()}
        }
    )
    
    return cashback_amount

# Geofencing Functions
async def check_geofence_notifications(user_id: str, latitude: float, longitude: float):
    """Check if user is near any businesses and send notifications"""
    # Get user's geofences
    geofences = await db.user_geofences.find({"user_id": user_id, "is_active": True}).to_list(100)
    
    notifications = []
    for geofence in geofences:
        distance = calculate_distance(
            latitude, longitude,
            geofence["latitude"], geofence["longitude"]
        ) * 1000  # Convert to meters
        
        if distance <= geofence["radius_meters"]:
            # User is within geofence
            business = await db.businesses.find_one({"id": geofence["business_id"]})
            if business:
                # Get active deals for this business
                deals = await db.discounts.find({
                    "business_id": geofence["business_id"],
                    "is_active": True,
                    "geofence_enabled": True,
                    "expires_at": {"$gt": datetime.utcnow().isoformat()}
                }).to_list(5)
                
                if deals:
                    notifications.append({
                        "business": business,
                        "deals": deals,
                        "distance_meters": int(distance)
                    })
                    
                    # Update geofence trigger
                    await db.user_geofences.update_one(
                        {"id": geofence["id"]},
                        {
                            "$inc": {"notifications_sent": 1},
                            "$set": {"last_triggered": datetime.utcnow().isoformat()}
                        }
                    )
    
    return notifications

# Authentication Functions (existing but enhanced)
async def get_current_user(request: Request, credentials: HTTPAuthorizationCredentials = Depends(security)) -> Optional[User]:
    session_token = None
    session_token = request.cookies.get("session_token")
    if not session_token and credentials:
        session_token = credentials.credentials
    if not session_token:
        return None
    session = await db.user_sessions.find_one({"session_token": session_token})
    if not session or datetime.fromisoformat(session["expires_at"]) < datetime.utcnow():
        return None
    user = await db.users.find_one({"id": session["user_id"]})
    if not user:
        return None
    return User(**user)

async def require_auth(user: User = Depends(get_current_user)) -> User:
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required")
    # Update user activity for gamification
    await update_user_activity(user.id)
    return user

async def require_business_auth(user: User = Depends(require_auth)) -> User:
    if user.user_type not in ["business", "admin"]:
        raise HTTPException(status_code=403, detail="Business access required")
    return user

async def require_admin_auth(user: User = Depends(require_auth)) -> User:
    if user.user_type != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return user

async def check_business_subscription(business_id: str) -> bool:
    subscription = await db.business_subscriptions.find_one({"business_id": business_id})
    if not subscription:
        return False
    now = datetime.utcnow()
    if subscription["status"] == "trial":
        trial_end = datetime.fromisoformat(subscription["trial_end"])
        if now <= trial_end:
            return True
    if subscription["status"] == "active":
        if subscription.get("current_period_end"):
            period_end = datetime.fromisoformat(subscription["current_period_end"])
            if now <= period_end:
                return True
    return False

# Auth Routes (existing)
@api_router.post("/auth/session")
async def process_session(request: Request, response: Response):
    data = await request.json()
    session_id = data.get("session_id")
    if not session_id:
        raise HTTPException(status_code=400, detail="Missing session_id")
    async with httpx.AsyncClient() as client:
        try:
            auth_response = await client.get(
                "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
                headers={"X-Session-ID": session_id}
            )
            auth_response.raise_for_status()
            auth_data = auth_response.json()
        except Exception as e:
            raise HTTPException(status_code=401, detail="Invalid session")
    existing_user = await db.users.find_one({"email": auth_data["email"]})
    if not existing_user:
        user = User(
            email=auth_data["email"],
            name=auth_data["name"],
            picture=auth_data.get("picture"),
            user_type="customer",
            is_email_verified=True
        )
        await db.users.insert_one(user.dict())
        # Create user wallet
        wallet = UserWallet(user_id=user.id)
        await db.user_wallets.insert_one(wallet.dict())
        # Award welcome bonus
        await award_points(user.id, 100, "welcome_bonus")
    else:
        user = User(**existing_user)
    session_token = str(uuid.uuid4())
    expires_at = datetime.utcnow() + timedelta(days=7)
    session = UserSession(
        user_id=user.id,
        session_token=session_token,
        expires_at=expires_at
    )
    await db.user_sessions.insert_one(session.dict())
    response.set_cookie(
        key="session_token",
        value=session_token,
        httponly=True,
        secure=True,
        samesite="none",
        max_age=7*24*60*60,
        path="/"
    )
    return {"success": True, "user": user.dict(), "session_token": session_token}

@api_router.post("/auth/logout")
async def logout(response: Response, user: User = Depends(require_auth)):
    await db.user_sessions.delete_many({"user_id": user.id})
    response.delete_cookie("session_token", path="/")
    return {"success": True}

@api_router.get("/auth/me")
async def get_me(user: User = Depends(require_auth)):
    return user.dict()

# NEW FEATURE 1: AI Personal Deal Recommendations
@api_router.get("/ai/recommendations")
async def get_personal_recommendations(user: User = Depends(require_auth)):
    """Get AI-powered personal deal recommendations"""
    recommendations = await generate_ai_recommendations(user.id)
    
    # Get full deal and business info
    enriched_recommendations = []
    for rec in recommendations:
        discount = await db.discounts.find_one({"id": rec["discount_id"]})
        business = await db.businesses.find_one({"id": rec["business_id"]})
        
        if discount and business:
            enriched_recommendations.append({
                "recommendation": rec,
                "discount": discount,
                "business": business
            })
    
    return enriched_recommendations

@api_router.post("/ai/recommendation/{recommendation_id}/click")
async def track_recommendation_click(recommendation_id: str, user: User = Depends(require_auth)):
    """Track when user clicks on a recommendation"""
    await db.ai_recommendations.update_one(
        {"id": recommendation_id, "user_id": user.id},
        {"$set": {"clicked": True, "shown_at": datetime.utcnow().isoformat()}}
    )
    return {"success": True}

# NEW FEATURE 2: Gamified Rewards System
@api_router.get("/rewards/profile")
async def get_user_rewards_profile(user: User = Depends(require_auth)):
    """Get user's complete gamification profile"""
    # Get recent rewards
    recent_rewards = await db.user_rewards.find(
        {"user_id": user.id}
    ).sort("earned_at", -1).limit(10).to_list(10)
    
    # Get wallet info
    wallet = await db.user_wallets.find_one({"user_id": user.id})
    
    # Calculate next level requirements
    current_level = user.level
    next_level_points = (current_level + 1) * 200  # 200 points per level
    points_to_next = max(0, next_level_points - user.points)
    
    # Define available badges
    available_badges = [
        {"id": "first_deal", "name": "First Deal", "description": "Used your first coupon", "icon": "🎯"},
        {"id": "deal_hunter", "name": "Deal Hunter", "description": "Used 10 coupons", "icon": "🏹"},
        {"id": "savings_master", "name": "Savings Master", "description": "Saved $100 total", "icon": "💰"},
        {"id": "reviewer", "name": "Reviewer", "description": "Written 5 reviews", "icon": "⭐"},
        {"id": "local_explorer", "name": "Local Explorer", "description": "Visited 5 different businesses", "icon": "🗺️"},
        {"id": "streak_keeper", "name": "Streak Keeper", "description": "7-day activity streak", "icon": "🔥"}
    ]
    
    return {
        "user_profile": {
            "points": user.points,
            "level": user.level,
            "badges": user.badges,
            "streak_days": user.streak_days,
            "total_savings": user.total_savings,
            "deals_used": user.deals_used,
            "reviews_written": user.reviews_written
        },
        "progression": {
            "points_to_next_level": points_to_next,
            "next_level": current_level + 1,
            "progress_percentage": min(100, (user.points / next_level_points) * 100)
        },
        "wallet": {
            "balance": wallet["balance"] if wallet else 0.0,
            "total_earned": wallet["total_earned"] if wallet else 0.0
        },
        "recent_rewards": recent_rewards,
        "available_badges": available_badges
    }

@api_router.get("/rewards/leaderboard")
async def get_leaderboard():
    """Get top users leaderboard"""
    top_users = await db.users.find(
        {"user_type": "customer"}
    ).sort("points", -1).limit(10).to_list(10)
    
    leaderboard = []
    for i, user in enumerate(top_users):
        leaderboard.append({
            "rank": i + 1,
            "name": user["name"],
            "points": user.get("points", 0),
            "level": user.get("level", 1),
            "badges_count": len(user.get("badges", [])),
            "total_savings": user.get("total_savings", 0.0)
        })
    
    return leaderboard

# NEW FEATURE 3: Geofencing & Location Intelligence
@api_router.post("/geofence/setup")
async def setup_geofence(business_id: str, radius_meters: int = 100, user: User = Depends(require_auth)):
    """Setup geofence for a business"""
    business = await db.businesses.find_one({"id": business_id})
    if not business or not business.get("latitude") or not business.get("longitude"):
        raise HTTPException(status_code=404, detail="Business not found or no location data")
    
    # Check if geofence already exists
    existing = await db.user_geofences.find_one({"user_id": user.id, "business_id": business_id})
    if existing:
        raise HTTPException(status_code=400, detail="Geofence already exists for this business")
    
    geofence = UserGeofence(
        user_id=user.id,
        business_id=business_id,
        latitude=business["latitude"],
        longitude=business["longitude"],
        radius_meters=radius_meters
    )
    
    await db.user_geofences.insert_one(geofence.dict())
    return {"success": True, "geofence_id": geofence.id}

@api_router.post("/geofence/check")
async def check_geofences(latitude: float, longitude: float, user: User = Depends(require_auth)):
    """Check geofences and get nearby deal notifications"""
    notifications = await check_geofence_notifications(user.id, latitude, longitude)
    return {"notifications": notifications}

@api_router.get("/geofence/my-geofences")
async def get_user_geofences(user: User = Depends(require_auth)):
    """Get user's active geofences"""
    geofences = await db.user_geofences.find({"user_id": user.id, "is_active": True}).to_list(100)
    
    enriched_geofences = []
    for geofence in geofences:
        business = await db.businesses.find_one({"id": geofence["business_id"]})
        if business:
            enriched_geofences.append({
                "geofence": geofence,
                "business": business
            })
    
    return enriched_geofences

# NEW FEATURE 4: Integrated Cashback System
@api_router.get("/cashback/wallet")
async def get_user_wallet(user: User = Depends(require_auth)):
    """Get user's cashback wallet"""
    wallet = await db.user_wallets.find_one({"user_id": user.id})
    if not wallet:
        wallet = UserWallet(user_id=user.id)
        await db.user_wallets.insert_one(wallet.dict())
        wallet = wallet.dict()
    
    # Get recent transactions
    recent_transactions = await db.cashback_transactions.find(
        {"user_id": user.id}
    ).sort("transaction_date", -1).limit(20).to_list(20)
    
    return {
        "wallet": wallet,
        "recent_transactions": recent_transactions
    }

@api_router.post("/cashback/withdraw")
async def withdraw_cashback(amount: float, method: str = "bank", user: User = Depends(require_auth)):
    """Withdraw cashback to external account"""
    wallet = await db.user_wallets.find_one({"user_id": user.id})
    if not wallet or wallet["balance"] < amount:
        raise HTTPException(status_code=400, detail="Insufficient balance")
    
    if amount < 5.0:
        raise HTTPException(status_code=400, detail="Minimum withdrawal is $5.00")
    
    # Process withdrawal (integrate with payment processor)
    # For now, just update the wallet
    await db.user_wallets.update_one(
        {"user_id": user.id},
        {
            "$inc": {
                "balance": -amount,
                "total_withdrawn": amount
            },
            "$set": {"updated_at": datetime.utcnow().isoformat()}
        }
    )
    
    return {"success": True, "withdrawn_amount": amount, "method": method}

# NEW FEATURE 5: Smart Business Analytics Dashboard
@api_router.get("/business/advanced-analytics")
async def get_advanced_business_analytics(user: User = Depends(require_business_auth)):
    """Get comprehensive business analytics"""
    business = await db.businesses.find_one({"owner_id": user.id})
    if not business:
        raise HTTPException(status_code=404, detail="Business not found")
    
    business_id = business["id"]
    
    # Get time-based analytics
    thirty_days_ago = datetime.utcnow() - timedelta(days=30)
    seven_days_ago = datetime.utcnow() - timedelta(days=7)
    
    # Customer analytics
    total_customers = await db.coupon_usage.distinct("user_id", {"business_id": business_id})
    new_customers_30d = await db.coupon_usage.distinct("user_id", {
        "business_id": business_id,
        "used_at": {"$gte": thirty_days_ago.isoformat()}
    })
    new_customers_7d = await db.coupon_usage.distinct("user_id", {
        "business_id": business_id,
        "used_at": {"$gte": seven_days_ago.isoformat()}
    })
    
    # Revenue analytics
    total_usage = await db.coupon_usage.count_documents({"business_id": business_id})
    usage_30d = await db.coupon_usage.count_documents({
        "business_id": business_id,
        "used_at": {"$gte": thirty_days_ago.isoformat()}
    })
    usage_7d = await db.coupon_usage.count_documents({
        "business_id": business_id,
        "used_at": {"$gte": seven_days_ago.isoformat()}
    })
    
    # Get hourly usage patterns
    hourly_usage = await db.coupon_usage.aggregate([
        {"$match": {"business_id": business_id}},
        {
            "$group": {
                "_id": {"$hour": {"$dateFromString": {"dateString": "$used_at"}}},
                "count": {"$sum": 1}
            }
        },
        {"$sort": {"_id": 1}}
    ]).to_list(24)
    
    # Get popular discounts
    popular_discounts = await db.coupon_usage.aggregate([
        {"$match": {"business_id": business_id}},
        {
            "$group": {
                "_id": "$discount_id",
                "usage_count": {"$sum": 1},
                "unique_users": {"$addToSet": "$user_id"}
            }
        },
        {"$sort": {"usage_count": -1}},
        {"$limit": 5}
    ]).to_list(5)
    
    # Get customer demographics
    customer_demographics = await db.coupon_usage.aggregate([
        {"$match": {"business_id": business_id}},
        {
            "$lookup": {
                "from": "users",
                "localField": "user_id",
                "foreignField": "id",
                "as": "user"
            }
        },
        {"$unwind": "$user"},
        {
            "$group": {
                "_id": "$user.country",
                "count": {"$sum": 1}
            }
        },
        {"$sort": {"count": -1}}
    ]).to_list(10)
    
    # Calculate retention rate
    returning_customers = await db.coupon_usage.aggregate([
        {"$match": {"business_id": business_id}},
        {
            "$group": {
                "_id": "$user_id",
                "visit_count": {"$sum": 1}
            }
        },
        {"$match": {"visit_count": {"$gt": 1}}}
    ]).to_list(1000)
    
    retention_rate = len(returning_customers) / len(total_customers) * 100 if total_customers else 0
    
    # AI-powered insights
    insights = []
    if usage_7d > usage_30d / 4:
        insights.append("📈 Your weekly performance is above average!")
    if len(new_customers_7d) > len(new_customers_30d) / 4:
        insights.append("👥 You're attracting new customers at a great rate!")
    
    # Get peak hours
    peak_hours = sorted(hourly_usage, key=lambda x: x["count"], reverse=True)[:3]
    if peak_hours:
        peak_times = [f"{h['_id']}:00" for h in peak_hours]
        insights.append(f"⏰ Your peak hours are: {', '.join(peak_times)}")
    
    return {
        "overview": {
            "total_customers": len(total_customers),
            "new_customers_30d": len(new_customers_30d),
            "new_customers_7d": len(new_customers_7d),
            "total_redemptions": total_usage,
            "redemptions_30d": usage_30d,
            "redemptions_7d": usage_7d,
            "retention_rate": round(retention_rate, 1)
        },
        "hourly_patterns": hourly_usage,
        "popular_discounts": popular_discounts,
        "customer_demographics": customer_demographics,
        "ai_insights": insights,
        "performance_trends": {
            "weekly_growth": ((usage_7d * 4) / max(usage_30d, 1) - 1) * 100,
            "customer_growth": ((len(new_customers_7d) * 4) / max(len(new_customers_30d), 1) - 1) * 100
        }
    }

@api_router.get("/business/customer-insights")
async def get_customer_insights(user: User = Depends(require_business_auth)):
    """Get detailed customer behavior insights"""
    business = await db.businesses.find_one({"owner_id": user.id})
    if not business:
        raise HTTPException(status_code=404, detail="Business not found")
    
    # Customer lifetime value analysis
    customer_values = await db.coupon_usage.aggregate([
        {"$match": {"business_id": business["id"]}},
        {
            "$group": {
                "_id": "$user_id",
                "visits": {"$sum": 1},
                "total_spent": {"$sum": {"$ifNull": ["$transaction_amount", 0]}},
                "first_visit": {"$min": "$used_at"},
                "last_visit": {"$max": "$used_at"}
            }
        }
    ]).to_list(1000)
    
    # Segment customers
    high_value = [c for c in customer_values if c["visits"] >= 5]
    regular = [c for c in customer_values if 2 <= c["visits"] < 5]
    one_time = [c for c in customer_values if c["visits"] == 1]
    
    return {
        "customer_segments": {
            "high_value": len(high_value),
            "regular": len(regular),
            "one_time": len(one_time)
        },
        "avg_customer_visits": sum(c["visits"] for c in customer_values) / len(customer_values) if customer_values else 0,
        "avg_customer_value": sum(c["total_spent"] for c in customer_values) / len(customer_values) if customer_values else 0,
        "top_customers": sorted(customer_values, key=lambda x: x["visits"], reverse=True)[:10]
    }

# Enhanced Discount Routes
@api_router.post("/discounts")
async def create_discount(discount_data: DiscountCreate, user: User = Depends(require_business_auth)):
    business = await db.businesses.find_one({"owner_id": user.id, "is_approved": True})
    if not business:
        raise HTTPException(status_code=404, detail="No approved business found")
    has_active_subscription = await check_business_subscription(business["id"])
    if not has_active_subscription:
        raise HTTPException(status_code=403, detail="Active subscription required")
    qr_data = f"discount_{str(uuid.uuid4())}"
    discount = Discount(
        **discount_data.dict(),
        business_id=business["id"],
        qr_code=qr_data
    )
    await db.discounts.insert_one(discount.dict())
    return {"success": True, "discount_id": discount.id, "qr_code": qr_data}

@api_router.post("/discounts/{discount_id}/redeem")
async def redeem_coupon(discount_id: str, redemption: CouponRedemption, user: User = Depends(require_auth)):
    discount = await db.discounts.find_one({"id": discount_id, "is_active": True})
    if not discount:
        raise HTTPException(status_code=404, detail="Discount not found or inactive")
    if datetime.fromisoformat(discount["expires_at"]) < datetime.utcnow():
        raise HTTPException(status_code=400, detail="Discount has expired")
    if discount["qr_code"] != redemption.qr_code:
        raise HTTPException(status_code=400, detail="Invalid QR code")
    user_usage_count = await db.coupon_usage.count_documents({
        "discount_id": discount_id,
        "user_id": user.id
    })
    if user_usage_count >= discount["max_uses_per_user"]:
        raise HTTPException(
            status_code=400, 
            detail=f"Maximum usage limit reached ({discount['max_uses_per_user']} per user)"
        )
    if discount.get("max_uses") and discount["current_uses"] >= discount["max_uses"]:
        raise HTTPException(status_code=400, detail="Discount usage limit reached")
    
    # Enhanced usage tracking with gamification
    points_earned = 50  # Base points for using a deal
    transaction_amount = redemption.transaction_amount or 0
    
    usage = CouponUsage(
        discount_id=discount_id,
        business_id=discount["business_id"],
        user_id=user.id,
        qr_code=redemption.qr_code,
        verification_status="verified",
        transaction_amount=transaction_amount,
        points_earned=points_earned,
        user_location=redemption.user_location
    )
    await db.coupon_usage.insert_one(usage.dict())
    
    # Update discount usage count
    await db.discounts.update_one(
        {"id": discount_id},
        {"$inc": {"current_uses": 1}}
    )
    
    # Process rewards and cashback
    await award_points(user.id, points_earned, "deal_usage", discount_id)
    
    # Process cashback if eligible
    cashback_amount = 0
    if discount.get("cashback_eligible", True) and transaction_amount > 0:
        cashback_amount = await process_cashback(
            user.id, discount["business_id"], discount_id, transaction_amount
        )
        usage.cashback_earned = cashback_amount
    
    # Update user stats
    await db.users.update_one(
        {"id": user.id},
        {
            "$inc": {
                "deals_used": 1,
                "total_savings": discount["discount_value"] if discount["discount_type"] == "fixed_amount" else transaction_amount * (discount["discount_value"] / 100)
            }
        }
    )
    
    # Check for new badges
    await check_and_award_badges(user.id)
    
    return {
        "success": True,
        "message": "Coupon redeemed successfully",
        "discount_title": discount["title"],
        "discount_value": f"{discount['discount_value']}{'%' if discount['discount_type'] == 'percentage' else '$'}",
        "points_earned": points_earned,
        "cashback_earned": cashback_amount
    }

# Existing routes with minimal changes...
@api_router.get("/businesses")
async def get_businesses(
    category: Optional[str] = None, 
    search: Optional[str] = None,
    latitude: Optional[float] = None,
    longitude: Optional[float] = None,
    radius_km: Optional[float] = None
):
    query = {"is_approved": True, "is_active": True}
    if category:
        query["category"] = category
    if search:
        query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"description": {"$regex": search, "$options": "i"}}
        ]
    businesses = await db.businesses.find(query).to_list(100)
    if latitude is not None and longitude is not None and radius_km is not None:
        filtered_businesses = []
        for business in businesses:
            if business.get("latitude") and business.get("longitude"):
                distance = calculate_distance(
                    latitude, longitude,
                    business["latitude"], business["longitude"]
                )
                if distance <= radius_km:
                    business["distance_km"] = round(distance, 2)
                    filtered_businesses.append(business)
        businesses = filtered_businesses
    return [Business(**business) for business in businesses]

@api_router.get("/businesses/{business_id}")
async def get_business(business_id: str):
    business = await db.businesses.find_one({"id": business_id, "is_approved": True})
    if not business:
        raise HTTPException(status_code=404, detail="Business not found")
    return Business(**business)

@api_router.post("/businesses/register")
async def register_business(business_data: BusinessRegistration, user: User = Depends(require_auth)):
    existing_business = await db.businesses.find_one({"owner_id": user.id})
    if existing_business:
        raise HTTPException(status_code=400, detail="User already has a registered business")
    business = Business(
        **business_data.dict(),
        owner_id=user.id,
        is_approved=False
    )
    await db.businesses.insert_one(business.dict())
    settings = await db.platform_settings.find_one()
    trial_days = settings["trial_period_days"] if settings and settings.get("trial_enabled") else 365
    trial_subscription = BusinessSubscription(
        business_id=business.id,
        plan_id="trial",
        status="trial",
        trial_end=datetime.utcnow() + timedelta(days=trial_days)
    )
    await db.business_subscriptions.insert_one(trial_subscription.dict())
    return {"success": True, "business_id": business.id, "trial_days": trial_days}

@api_router.get("/businesses/{business_id}/discounts")
async def get_business_discounts(business_id: str):
    query = {
        "business_id": business_id,
        "is_active": True,
        "expires_at": {"$gt": datetime.utcnow().isoformat()}
    }
    discounts = await db.discounts.find(query).to_list(100)
    return [Discount(**discount) for discount in discounts]

@api_router.get("/discounts")
async def get_all_discounts(
    category: Optional[str] = None,
    latitude: Optional[float] = None,
    longitude: Optional[float] = None,
    radius_km: Optional[float] = None
):
    pipeline = [
        {
            "$match": {
                "is_active": True,
                "expires_at": {"$gt": datetime.utcnow().isoformat()}
            }
        },
        {
            "$lookup": {
                "from": "businesses",
                "localField": "business_id",
                "foreignField": "id",
                "as": "business"
            }
        },
        {
            "$match": {
                "business.is_approved": True,
                "business.is_active": True
            }
        }
    ]
    if category:
        pipeline[2]["$match"]["business.category"] = category
    discounts = await db.discounts.aggregate(pipeline).to_list(100)
    result = []
    for discount in discounts:
        discount_obj = Discount(**{k: v for k, v in discount.items() if k != "business"})
        business_obj = Business(**discount["business"][0]) if discount["business"] else None
        if (latitude is not None and longitude is not None and radius_km is not None and 
            business_obj and business_obj.latitude and business_obj.longitude):
            distance = calculate_distance(
                latitude, longitude,
                business_obj.latitude, business_obj.longitude
            )
            if distance <= radius_km:
                business_dict = business_obj.dict()
                business_dict["distance_km"] = round(distance, 2)
                result.append({
                    "discount": discount_obj.dict(),
                    "business": business_dict
                })
        elif latitude is None:
            result.append({
                "discount": discount_obj.dict(),
                "business": business_obj.dict() if business_obj else None
            })
    if latitude is not None and longitude is not None:
        result.sort(key=lambda x: x["business"].get("distance_km", float('inf')))
    return result

# Continue with other existing routes...
@api_router.post("/businesses/{business_id}/rate")
async def rate_business(business_id: str, rating_data: RatingCreate, user: User = Depends(require_auth)):
    business = await db.businesses.find_one({"id": business_id, "is_approved": True})
    if not business:
        raise HTTPException(status_code=404, detail="Business not found")
    existing_rating = await db.business_ratings.find_one({
        "business_id": business_id,
        "user_id": user.id
    })
    if existing_rating:
        await db.business_ratings.update_one(
            {"id": existing_rating["id"]},
            {"$set": {
                "rating": rating_data.rating,
                "review": rating_data.review,
                "created_at": datetime.utcnow().isoformat()
            }}
        )
    else:
        rating = BusinessRating(
            business_id=business_id,
            user_id=user.id,
            **rating_data.dict()
        )
        await db.business_ratings.insert_one(rating.dict())
        # Award points for writing review
        await award_points(user.id, 25, "review", rating.id)
        await db.users.update_one(
            {"id": user.id},
            {"$inc": {"reviews_written": 1}}
        )
    ratings = await db.business_ratings.find({"business_id": business_id}).to_list(1000)
    if ratings:
        avg_rating = sum(r["rating"] for r in ratings) / len(ratings)
        await db.businesses.update_one(
            {"id": business_id},
            {"$set": {"rating": avg_rating, "review_count": len(ratings)}}
        )
    await check_and_award_badges(user.id)
    return {"success": True}

@api_router.get("/businesses/{business_id}/ratings")
async def get_business_ratings(business_id: str):
    pipeline = [
        {"$match": {"business_id": business_id}},
        {
            "$lookup": {
                "from": "users",
                "localField": "user_id",
                "foreignField": "id",
                "as": "user"
            }
        },
        {"$sort": {"created_at": -1}}
    ]
    ratings = await db.business_ratings.aggregate(pipeline).to_list(100)
    result = []
    for rating in ratings:
        rating_obj = BusinessRating(**{k: v for k, v in rating.items() if k != "user"})
        user_info = rating["user"][0] if rating["user"] else None
        result.append({
            "rating": rating_obj.dict(),
            "user_name": user_info["name"] if user_info else "Anonymous"
        })
    return result

# Other existing routes remain the same...
@api_router.get("/categories")
async def get_categories():
    categories = [
        "Restaurant", "Retail", "Health & Beauty", "Services", 
        "Entertainment", "Travel", "Technology", "Fitness", 
        "Education", "Other"
    ]
    return categories

# ============================================================================
# BUSINESS SUBSCRIPTION MONETIZATION SYSTEM
# ============================================================================

class SubscriptionPlanCreate(BaseModel):
    name: str
    description: str
    price: float
    features: List[str]
    max_coupons: int = -1  # -1 for unlimited
    max_locations: int = 1
    analytics_included: bool = True
    ai_recommendations: bool = False
    geofencing: bool = False
    advanced_analytics: bool = False

class SubscriptionUpgrade(BaseModel):
    plan_id: str

# Initialize default subscription plans
@api_router.post("/admin/subscription-plans/init")
async def initialize_subscription_plans(user: User = Depends(require_admin_auth)):
    """Initialize default subscription plans - Admin only"""
    
    # Check if plans already exist
    existing_plans = await db.subscription_plans.find_one()
    if existing_plans:
        return {"message": "Subscription plans already initialized"}
    
    # Create Stripe products and prices
    try:
        # FREE PLAN (for trial and free tier)
        free_plan = SubscriptionPlan(
            id="free",
            name="Free Plan",
            description="Basic business listing with limited features",
            price=0.0,
            stripe_price_id="free",
            features=[
                "Basic business listing",
                "Up to 3 active discounts",
                "Basic analytics (views, clicks)",
                "Standard search placement"
            ],
            max_coupons=3,
            max_locations=1,
            analytics_included=True,
            ai_recommendations=False,
            geofencing=False,
            advanced_analytics=False
        )
        
        # PROFESSIONAL PLAN ($79/month)
        stripe_professional_product = stripe.Product.create(
            name="CouponApp Professional Plan",
            description="Professional business features with advanced analytics"
        )
        
        stripe_professional_price = stripe.Price.create(
            product=stripe_professional_product.id,
            unit_amount=7900,  # $79.00
            currency='usd',
            recurring={'interval': 'month'},
            nickname="Professional Monthly"
        )
        
        professional_plan = SubscriptionPlan(
            id="professional",
            name="Professional Plan",
            description="Advanced features for growing businesses",
            price=79.0,
            stripe_price_id=stripe_professional_price.id,
            features=[
                "Unlimited discounts and campaigns",
                "Advanced analytics dashboard",
                "Priority placement in search results",
                "Geofencing notifications to nearby users",
                "Customer insights and behavior data",
                "Promotional email to user base",
                "AI-powered deal optimization",
                "Priority customer support"
            ],
            max_coupons=-1,  # Unlimited
            max_locations=5,
            analytics_included=True,
            ai_recommendations=True,
            geofencing=True,
            advanced_analytics=True
        )
        
        # ENTERPRISE PLAN ($199/month)
        stripe_enterprise_product = stripe.Product.create(
            name="CouponApp Enterprise Plan",
            description="Enterprise features with API access and white-label options"
        )
        
        stripe_enterprise_price = stripe.Price.create(
            product=stripe_enterprise_product.id,
            unit_amount=19900,  # $199.00
            currency='usd',
            recurring={'interval': 'month'},
            nickname="Enterprise Monthly"
        )
        
        enterprise_plan = SubscriptionPlan(
            id="enterprise",
            name="Enterprise Plan",
            description="Full-featured enterprise solution",
            price=199.0,
            stripe_price_id=stripe_enterprise_price.id,
            features=[
                "All Professional features",
                "Unlimited locations",
                "API access for integration",
                "White-label business app",
                "Dedicated account management",
                "Custom analytics reporting",
                "Advanced AI recommendation priority",
                "24/7 premium support",
                "Custom integrations"
            ],
            max_coupons=-1,  # Unlimited
            max_locations=-1,  # Unlimited
            analytics_included=True,
            ai_recommendations=True,
            geofencing=True,
            advanced_analytics=True
        )
        
        # Insert plans into database
        await db.subscription_plans.insert_many([
            free_plan.dict(),
            professional_plan.dict(),
            enterprise_plan.dict()
        ])
        
        return {
            "success": True,
            "message": "Subscription plans initialized successfully",
            "plans": [
                {"name": "Free Plan", "price": "$0/month"},
                {"name": "Professional Plan", "price": "$79/month", "stripe_price_id": stripe_professional_price.id},
                {"name": "Enterprise Plan", "price": "$199/month", "stripe_price_id": stripe_enterprise_price.id}
            ]
        }
        
    except stripe.error.StripeError as e:
        raise HTTPException(status_code=400, detail=f"Stripe error: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to initialize plans: {str(e)}")

@api_router.get("/subscription-plans")
async def get_subscription_plans():
    """Get all available subscription plans"""
    plans = await db.subscription_plans.find().to_list(100)
    return plans

@api_router.get("/business/subscription/status")
async def get_business_subscription_status(user: User = Depends(require_auth)):
    """Get current business subscription status"""
    
    # Get user's business
    business = await db.businesses.find_one({"owner_id": user.id})
    if not business:
        raise HTTPException(status_code=404, detail="No business found for this user")
    
    # Get subscription status
    subscription = await db.business_subscriptions.find_one({"business_id": business["id"]})
    if not subscription:
        raise HTTPException(status_code=404, detail="No subscription found")
    
    # Get current plan details
    plan = await db.subscription_plans.find_one({"id": subscription.get("plan_id", "free")})
    
    # Calculate trial/subscription info
    now = datetime.utcnow()
    status_info = {
        "subscription_id": subscription["id"],
        "business_id": business["id"],
        "business_name": business["name"],
        "plan": plan,
        "status": subscription["status"],
        "stripe_subscription_id": subscription.get("stripe_subscription_id"),
        "stripe_customer_id": subscription.get("stripe_customer_id")
    }
    
    if subscription["status"] == "trial":
        trial_end = datetime.fromisoformat(subscription["trial_end"])
        days_remaining = max(0, (trial_end - now).days)
        status_info.update({
            "trial_active": True,
            "trial_end": subscription["trial_end"],
            "days_remaining": days_remaining,
            "trial_expired": days_remaining <= 0
        })
    elif subscription["status"] == "active":
        if subscription.get("current_period_end"):
            period_end = datetime.fromisoformat(subscription["current_period_end"])
            days_until_renewal = max(0, (period_end - now).days)
            status_info.update({
                "trial_active": False,
                "current_period_end": subscription["current_period_end"],
                "days_until_renewal": days_until_renewal
            })
    
    return status_info

@api_router.post("/business/subscription/upgrade")
async def upgrade_business_subscription(upgrade_data: SubscriptionUpgrade, user: User = Depends(require_auth)):
    """Upgrade business subscription to paid plan"""
    
    # Get user's business
    business = await db.businesses.find_one({"owner_id": user.id})
    if not business:
        raise HTTPException(status_code=404, detail="No business found for this user")
    
    # Get current subscription
    current_subscription = await db.business_subscriptions.find_one({"business_id": business["id"]})
    if not current_subscription:
        raise HTTPException(status_code=404, detail="No subscription found")
    
    # Get target plan details
    target_plan = await db.subscription_plans.find_one({"id": upgrade_data.plan_id})
    if not target_plan:
        raise HTTPException(status_code=404, detail="Subscription plan not found")
    
    if target_plan["price"] == 0:
        raise HTTPException(status_code=400, detail="Cannot upgrade to free plan")
    
    try:
        # Create or get Stripe customer
        stripe_customer_id = current_subscription.get("stripe_customer_id")
        
        if not stripe_customer_id:
            # Create new Stripe customer
            stripe_customer = stripe.Customer.create(
                email=user.email,
                name=user.name,
                metadata={
                    "business_id": business["id"],
                    "business_name": business["name"],
                    "user_id": user.id
                }
            )
            stripe_customer_id = stripe_customer.id
        
        # Create Stripe subscription
        stripe_subscription = stripe.Subscription.create(
            customer=stripe_customer_id,
            items=[{
                'price': target_plan["stripe_price_id"],
            }],
            metadata={
                "business_id": business["id"],
                "plan_id": upgrade_data.plan_id,
                "user_id": user.id
            }
        )
        
        # Update subscription in database
        now = datetime.utcnow()
        await db.business_subscriptions.update_one(
            {"business_id": business["id"]},
            {"$set": {
                "plan_id": upgrade_data.plan_id,
                "status": "active",
                "stripe_subscription_id": stripe_subscription.id,
                "stripe_customer_id": stripe_customer_id,
                "current_period_start": now.isoformat(),
                "current_period_end": datetime.fromtimestamp(stripe_subscription.current_period_end).isoformat(),
                "updated_at": now.isoformat()
            }}
        )
        
        return {
            "success": True,
            "message": f"Successfully upgraded to {target_plan['name']}",
            "subscription_id": stripe_subscription.id,
            "plan": target_plan,
            "current_period_end": datetime.fromtimestamp(stripe_subscription.current_period_end).isoformat()
        }
        
    except stripe.error.StripeError as e:
        raise HTTPException(status_code=400, detail=f"Payment processing error: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Upgrade failed: {str(e)}")

@api_router.post("/business/subscription/cancel")
async def cancel_business_subscription(user: User = Depends(require_auth)):
    """Cancel business subscription (downgrade to free at end of current period)"""
    
    # Get user's business
    business = await db.businesses.find_one({"owner_id": user.id})
    if not business:
        raise HTTPException(status_code=404, detail="No business found for this user")
    
    # Get current subscription
    subscription = await db.business_subscriptions.find_one({"business_id": business["id"]})
    if not subscription or subscription["status"] != "active":
        raise HTTPException(status_code=400, detail="No active subscription to cancel")
    
    try:
        # Cancel Stripe subscription at period end
        if subscription.get("stripe_subscription_id"):
            stripe.Subscription.modify(
                subscription["stripe_subscription_id"],
                cancel_at_period_end=True
            )
        
        # Update subscription status
        await db.business_subscriptions.update_one(
            {"business_id": business["id"]},
            {"$set": {
                "status": "cancelled",
                "updated_at": datetime.utcnow().isoformat()
            }}
        )
        
        return {
            "success": True,
            "message": "Subscription cancelled. You'll continue to have access until the end of your current billing period.",
            "access_until": subscription.get("current_period_end")
        }
        
    except stripe.error.StripeError as e:
        raise HTTPException(status_code=400, detail=f"Cancellation error: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Cancellation failed: {str(e)}")

@api_router.get("/business/usage-analytics")
async def get_business_usage_analytics(user: User = Depends(require_auth)):
    """Get business usage analytics to show ROI"""
    
    # Get user's business
    business = await db.businesses.find_one({"owner_id": user.id})
    if not business:
        raise HTTPException(status_code=404, detail="No business found for this user")
    
    # Get subscription status
    subscription = await db.business_subscriptions.find_one({"business_id": business["id"]})
    current_plan = await db.subscription_plans.find_one({"id": subscription.get("plan_id", "free")}) if subscription else None
    
    # Calculate analytics for the last 30 days
    thirty_days_ago = datetime.utcnow() - timedelta(days=30)
    
    # Get discount performance
    discounts = await db.discounts.find({"business_id": business["id"]}).to_list(1000)
    active_discounts = [d for d in discounts if d.get("is_active", True)]
    
    # Get recent redemptions (you may need to implement redemption tracking)
    # For now, using ratings as a proxy for customer engagement
    recent_ratings = await db.business_ratings.find({
        "business_id": business["id"],
        "created_at": {"$gte": thirty_days_ago.isoformat()}
    }).to_list(1000)
    
    # Calculate estimated ROI
    monthly_cost = current_plan["price"] if current_plan else 0
    estimated_customer_value = len(recent_ratings) * 25  # Estimate $25 average customer value
    estimated_roi = ((estimated_customer_value - monthly_cost) / max(monthly_cost, 1)) * 100 if monthly_cost > 0 else 0
    
    return {
        "business_name": business["name"],
        "current_plan": current_plan,
        "monthly_cost": monthly_cost,
        "analytics_period": "Last 30 days",
        "metrics": {
            "total_discounts": len(discounts),
            "active_discounts": len(active_discounts),
            "recent_customer_engagement": len(recent_ratings),
            "estimated_customer_value": estimated_customer_value,
            "estimated_roi": estimated_roi,
            "business_rating": business.get("rating", 0),
            "total_reviews": business.get("review_count", 0)
        },
        "recommendations": [
            "Create more time-limited offers to increase urgency" if len(active_discounts) < 5 else None,
            "Encourage customer reviews to improve rating" if business.get("rating", 0) < 4.0 else None,
            "Consider upgrading to Professional plan for AI-powered recommendations" if not current_plan or current_plan["id"] == "free" else None
        ]
    }

@api_router.post("/webhooks/stripe")
async def stripe_webhook(request: Request):
    """Handle Stripe webhooks for subscription events"""
    
    payload = await request.body()
    sig_header = request.headers.get('stripe-signature')
    
    try:
        event = stripe.Webhook.construct_event(
            payload, sig_header, os.environ.get('STRIPE_WEBHOOK_SECRET')
        )
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid payload")
    except stripe.error.SignatureVerificationError:
        raise HTTPException(status_code=400, detail="Invalid signature")
    
    # Handle the event
    if event['type'] == 'subscription.created':
        subscription = event['data']['object']
        # Subscription already handled in upgrade endpoint
        print(f"Subscription created: {subscription['id']}")
        
    elif event['type'] == 'subscription.updated':
        subscription = event['data']['object']
        # Update subscription status in database
        await db.business_subscriptions.update_one(
            {"stripe_subscription_id": subscription['id']},
            {"$set": {
                "status": subscription['status'],
                "current_period_end": datetime.fromtimestamp(subscription['current_period_end']).isoformat(),
                "updated_at": datetime.utcnow().isoformat()
            }}
        )
        
    elif event['type'] == 'subscription.deleted':
        subscription = event['data']['object']
        # Downgrade to free plan
        business_subscription = await db.business_subscriptions.find_one(
            {"stripe_subscription_id": subscription['id']}
        )
        if business_subscription:
            await db.business_subscriptions.update_one(
                {"stripe_subscription_id": subscription['id']},
                {"$set": {
                    "plan_id": "free",
                    "status": "active",  # Active on free plan
                    "stripe_subscription_id": None,
                    "current_period_start": None,
                    "current_period_end": None,
                    "updated_at": datetime.utcnow().isoformat()
                }}
            )
    
    elif event['type'] == 'invoice.payment_succeeded':
        invoice = event['data']['object']
        print(f"Payment succeeded for subscription: {invoice['subscription']}")
        
    elif event['type'] == 'invoice.payment_failed':
        invoice = event['data']['object']
        print(f"Payment failed for subscription: {invoice['subscription']}")
        # You might want to send an email notification here
    
    return {"received": True}

# Enhanced business creation with automatic subscription setup
async def create_business_with_subscription(business: Business, trial_days: int = 365):
    """Enhanced business creation with automatic subscription setup"""
    
    # Insert business
    await db.businesses.insert_one(business.dict())
    
    # Create trial subscription
    trial_subscription = BusinessSubscription(
        business_id=business.id,
        plan_id="free",  # Start with free plan during trial
        status="trial",
        trial_end=datetime.utcnow() + timedelta(days=trial_days)
    )
    await db.business_subscriptions.insert_one(trial_subscription.dict())
    
    return {
        "business_id": business.id,
        "trial_days": trial_days,
        "subscription_id": trial_subscription.id
    }

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client_db.close()