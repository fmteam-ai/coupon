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

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Stripe configuration
stripe.api_key = os.environ['STRIPE_SECRET_KEY']

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

security = HTTPBearer(auto_error=False)

# User Models
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

class EmailVerification(BaseModel):
    email: EmailStr
    code: str

class PhoneVerification(BaseModel):
    phone: str
    code: str

# Subscription Models
class SubscriptionPlan(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    description: str
    price: float  # Annual price in dollars
    stripe_price_id: str
    features: List[str]
    max_coupons: int = -1  # -1 for unlimited
    max_locations: int = 1
    analytics_included: bool = True
    created_at: datetime = Field(default_factory=datetime.utcnow)

class BusinessSubscription(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    business_id: str
    plan_id: str
    stripe_subscription_id: Optional[str] = None
    stripe_customer_id: Optional[str] = None
    status: str = "trial"  # trial, active, inactive, cancelled
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
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

# Business Models
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
    logo: Optional[str] = None  # base64 encoded image
    is_approved: bool = False
    is_active: bool = True
    created_at: datetime = Field(default_factory=datetime.utcnow)
    approved_at: Optional[datetime] = None
    rating: float = 0.0
    review_count: int = 0
    # Subscription fields
    subscription_id: Optional[str] = None
    stripe_customer_id: Optional[str] = None

class BusinessRegistration(BaseModel):
    name: str
    description: str
    category: str
    email: EmailStr
    phone: str
    address: str
    city: str
    country: str
    logo: Optional[str] = None

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
    max_uses_per_user: int = 1  # New: limit per user
    current_uses: int = 0
    expires_at: datetime
    is_active: bool = True
    created_at: datetime = Field(default_factory=datetime.utcnow)
    qr_code: Optional[str] = None
    terms_conditions: Optional[str] = None

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

# Coupon Usage Tracking
class CouponUsage(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    discount_id: str
    business_id: str
    user_id: str
    used_at: datetime = Field(default_factory=datetime.utcnow)
    qr_code: str
    verification_status: str = "pending"  # pending, verified, invalid

class CouponRedemption(BaseModel):
    qr_code: str
    user_location: Optional[Dict[str, float]] = None  # lat, lng

# Rating Models
class BusinessRating(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    business_id: str
    user_id: str
    rating: int  # 1-5
    review: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

class RatingCreate(BaseModel):
    rating: int
    review: Optional[str] = None

# Payment Models
class PaymentIntent(BaseModel):
    plan_id: str
    business_id: str

# Utility Functions
def generate_verification_code() -> str:
    """Generate 6-digit verification code"""
    return ''.join(random.choices(string.digits, k=6))

async def send_verification_email(email: str, code: str, name: str):
    """Send verification email (placeholder - implement with your email service)"""
    # In production, integrate with SendGrid, SES, etc.
    print(f"Verification email sent to {email}: Code {code} for {name}")
    return True

async def send_verification_sms(phone: str, code: str):
    """Send verification SMS (placeholder - implement with Twilio, etc.)"""
    # In production, integrate with Twilio, etc.
    print(f"Verification SMS sent to {phone}: Code {code}")
    return True

# Authentication Functions
async def get_current_user(request: Request, credentials: HTTPAuthorizationCredentials = Depends(security)) -> Optional[User]:
    """Get current user from session token in cookie or Authorization header"""
    session_token = None
    
    # Try to get token from cookie first
    session_token = request.cookies.get("session_token")
    
    # Fallback to Authorization header
    if not session_token and credentials:
        session_token = credentials.credentials
    
    if not session_token:
        return None
    
    # Find session in database
    session = await db.user_sessions.find_one({"session_token": session_token})
    if not session or datetime.fromisoformat(session["expires_at"]) < datetime.utcnow():
        return None
    
    # Get user
    user = await db.users.find_one({"id": session["user_id"]})
    if not user:
        return None
    
    return User(**user)

async def require_auth(user: User = Depends(get_current_user)) -> User:
    """Require authentication"""
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required")
    return user

async def require_business_auth(user: User = Depends(require_auth)) -> User:
    """Require business user authentication"""
    if user.user_type not in ["business", "admin"]:
        raise HTTPException(status_code=403, detail="Business access required")
    return user

async def require_admin_auth(user: User = Depends(require_auth)) -> User:
    """Require admin authentication"""
    if user.user_type != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return user

async def check_business_subscription(business_id: str) -> bool:
    """Check if business has active subscription or trial"""
    subscription = await db.business_subscriptions.find_one({"business_id": business_id})
    if not subscription:
        return False
    
    now = datetime.utcnow()
    
    # Check trial period
    if subscription["status"] == "trial":
        trial_end = datetime.fromisoformat(subscription["trial_end"])
        if now <= trial_end:
            return True
    
    # Check active subscription
    if subscription["status"] == "active":
        if subscription.get("current_period_end"):
            period_end = datetime.fromisoformat(subscription["current_period_end"])
            if now <= period_end:
                return True
    
    return False

# Auth Routes
@api_router.post("/auth/session")
async def process_session(request: Request, response: Response):
    """Process session from Emergent auth redirect"""
    data = await request.json()
    session_id = data.get("session_id")
    
    if not session_id:
        raise HTTPException(status_code=400, detail="Missing session_id")
    
    # Call Emergent auth API
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
    
    # Check if user exists
    existing_user = await db.users.find_one({"email": auth_data["email"]})
    
    if not existing_user:
        # Create new user
        user = User(
            email=auth_data["email"],
            name=auth_data["name"],
            picture=auth_data.get("picture"),
            user_type="customer",
            is_email_verified=True  # Email verified through OAuth
        )
        await db.users.insert_one(user.dict())
    else:
        user = User(**existing_user)
    
    # Create session
    session_token = str(uuid.uuid4())
    expires_at = datetime.utcnow() + timedelta(days=7)
    
    session = UserSession(
        user_id=user.id,
        session_token=session_token,
        expires_at=expires_at
    )
    
    await db.user_sessions.insert_one(session.dict())
    
    # Set cookie
    response.set_cookie(
        key="session_token",
        value=session_token,
        httponly=True,
        secure=True,
        samesite="none",
        max_age=7*24*60*60,  # 7 days
        path="/"
    )
    
    return {"success": True, "user": user.dict(), "session_token": session_token}

@api_router.post("/auth/logout")
async def logout(response: Response, user: User = Depends(require_auth)):
    """Logout user"""
    # Remove session from database
    await db.user_sessions.delete_many({"user_id": user.id})
    
    # Clear cookie
    response.delete_cookie("session_token", path="/")
    
    return {"success": True}

@api_router.get("/auth/me")
async def get_me(user: User = Depends(require_auth)):
    """Get current user info"""
    return user.dict()

# Verification Routes
@api_router.post("/auth/send-email-verification")
async def send_email_verification_code(user: User = Depends(require_auth)):
    """Send email verification code"""
    if user.is_email_verified:
        raise HTTPException(status_code=400, detail="Email already verified")
    
    code = generate_verification_code()
    
    # Update user with verification code
    await db.users.update_one(
        {"id": user.id},
        {"$set": {"email_verification_code": code}}
    )
    
    # Send email
    await send_verification_email(user.email, code, user.name)
    
    return {"success": True, "message": "Verification code sent"}

@api_router.post("/auth/verify-email")
async def verify_email(verification: EmailVerification, user: User = Depends(require_auth)):
    """Verify email with code"""
    if user.email != verification.email:
        raise HTTPException(status_code=400, detail="Email mismatch")
    
    user_data = await db.users.find_one({"id": user.id})
    if not user_data or user_data.get("email_verification_code") != verification.code:
        raise HTTPException(status_code=400, detail="Invalid verification code")
    
    # Update user as email verified
    await db.users.update_one(
        {"id": user.id},
        {"$set": {
            "is_email_verified": True,
            "email_verification_code": None
        }}
    )
    
    return {"success": True, "message": "Email verified successfully"}

@api_router.post("/auth/send-phone-verification")
async def send_phone_verification_code(phone: str, user: User = Depends(require_auth)):
    """Send phone verification code"""
    code = generate_verification_code()
    
    # Update user with verification code and phone
    await db.users.update_one(
        {"id": user.id},
        {"$set": {
            "phone": phone,
            "phone_verification_code": code
        }}
    )
    
    # Send SMS
    await send_verification_sms(phone, code)
    
    return {"success": True, "message": "Verification code sent"}

@api_router.post("/auth/verify-phone")
async def verify_phone(verification: PhoneVerification, user: User = Depends(require_auth)):
    """Verify phone with code"""
    user_data = await db.users.find_one({"id": user.id})
    if (not user_data or 
        user_data.get("phone") != verification.phone or
        user_data.get("phone_verification_code") != verification.code):
        raise HTTPException(status_code=400, detail="Invalid verification code")
    
    # Update user as phone verified
    await db.users.update_one(
        {"id": user.id},
        {"$set": {
            "is_phone_verified": True,
            "phone_verification_code": None
        }}
    )
    
    return {"success": True, "message": "Phone verified successfully"}

# Subscription Management Routes
@api_router.get("/subscription/plans")
async def get_subscription_plans():
    """Get available subscription plans"""
    # Create default plan if none exists
    existing_plan = await db.subscription_plans.find_one()
    if not existing_plan:
        default_plan = SubscriptionPlan(
            name="Business Pro",
            description="Full access to coupon management with unlimited coupons and analytics",
            price=99.99,
            stripe_price_id="price_business_pro_annual",
            features=[
                "Unlimited coupons",
                "Advanced analytics",
                "Customer insights",
                "Email support",
                "QR code generation",
                "Usage tracking"
            ],
            max_coupons=-1,
            max_locations=5
        )
        await db.subscription_plans.insert_one(default_plan.dict())
        return [default_plan.dict()]
    
    plans = await db.subscription_plans.find().to_list(10)
    return [SubscriptionPlan(**plan).dict() for plan in plans]

@api_router.post("/subscription/create-payment-intent")
async def create_payment_intent(payment_data: PaymentIntent, user: User = Depends(require_business_auth)):
    """Create Stripe payment intent for subscription"""
    # Get business
    business = await db.businesses.find_one({"owner_id": user.id})
    if not business:
        raise HTTPException(status_code=404, detail="Business not found")
    
    # Get plan
    plan = await db.subscription_plans.find_one({"id": payment_data.plan_id})
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")
    
    try:
        # Create or get Stripe customer
        stripe_customer_id = business.get("stripe_customer_id")
        if not stripe_customer_id:
            customer = stripe.Customer.create(
                email=business["email"],
                name=business["name"],
                metadata={"business_id": business["id"]}
            )
            stripe_customer_id = customer.id
            
            # Update business with customer ID
            await db.businesses.update_one(
                {"id": business["id"]},
                {"$set": {"stripe_customer_id": stripe_customer_id}}
            )
        
        # Create subscription
        subscription = stripe.Subscription.create(
            customer=stripe_customer_id,
            items=[{"price": plan["stripe_price_id"]}],
            trial_period_days=0,  # No additional trial, we handle trial logic
            metadata={
                "business_id": business["id"],
                "plan_id": plan["id"]
            }
        )
        
        # Save subscription to database
        business_subscription = BusinessSubscription(
            business_id=business["id"],
            plan_id=plan["id"],
            stripe_subscription_id=subscription.id,
            stripe_customer_id=stripe_customer_id,
            status="active",
            current_period_start=datetime.fromtimestamp(subscription.current_period_start),
            current_period_end=datetime.fromtimestamp(subscription.current_period_end)
        )
        
        await db.business_subscriptions.insert_one(business_subscription.dict())
        
        return {
            "success": True,
            "subscription_id": subscription.id,
            "client_secret": subscription.latest_invoice.payment_intent.client_secret if subscription.latest_invoice else None
        }
        
    except stripe.error.StripeError as e:
        raise HTTPException(status_code=400, detail=str(e))

@api_router.get("/subscription/status")
async def get_subscription_status(user: User = Depends(require_business_auth)):
    """Get business subscription status"""
    business = await db.businesses.find_one({"owner_id": user.id})
    if not business:
        raise HTTPException(status_code=404, detail="Business not found")
    
    subscription = await db.business_subscriptions.find_one({"business_id": business["id"]})
    if not subscription:
        return {"status": "no_subscription", "trial_available": True}
    
    # Check trial status
    now = datetime.utcnow()
    trial_end = datetime.fromisoformat(subscription["trial_end"])
    
    status_info = {
        "status": subscription["status"],
        "trial_end": subscription["trial_end"],
        "trial_active": now <= trial_end and subscription["status"] == "trial",
        "days_remaining": (trial_end - now).days if now <= trial_end else 0
    }
    
    if subscription.get("current_period_end"):
        status_info["current_period_end"] = subscription["current_period_end"]
    
    return status_info

# Business Routes
@api_router.get("/businesses")
async def get_businesses(category: Optional[str] = None, search: Optional[str] = None):
    """Get all approved businesses"""
    query = {"is_approved": True, "is_active": True}
    
    if category:
        query["category"] = category
    
    if search:
        query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"description": {"$regex": search, "$options": "i"}}
        ]
    
    businesses = await db.businesses.find(query).to_list(100)
    return [Business(**business) for business in businesses]

@api_router.get("/businesses/{business_id}")
async def get_business(business_id: str):
    """Get business by ID"""
    business = await db.businesses.find_one({"id": business_id, "is_approved": True})
    if not business:
        raise HTTPException(status_code=404, detail="Business not found")
    return Business(**business)

@api_router.post("/businesses/register")
async def register_business(business_data: BusinessRegistration, user: User = Depends(require_auth)):
    """Register a new business"""
    # Check if user already has a business
    existing_business = await db.businesses.find_one({"owner_id": user.id})
    if existing_business:
        raise HTTPException(status_code=400, detail="User already has a registered business")
    
    business = Business(
        **business_data.dict(),
        owner_id=user.id,
        is_approved=False
    )
    
    await db.businesses.insert_one(business.dict())
    
    # Create trial subscription
    settings = await db.platform_settings.find_one()
    trial_days = settings["trial_period_days"] if settings and settings.get("trial_enabled") else 365
    
    trial_subscription = BusinessSubscription(
        business_id=business.id,
        plan_id="trial",  # Special trial plan ID
        status="trial",
        trial_end=datetime.utcnow() + timedelta(days=trial_days)
    )
    
    await db.business_subscriptions.insert_one(trial_subscription.dict())
    
    return {"success": True, "business_id": business.id, "trial_days": trial_days}

@api_router.get("/businesses/{business_id}/discounts")
async def get_business_discounts(business_id: str):
    """Get active discounts for a business"""
    query = {
        "business_id": business_id,
        "is_active": True,
        "expires_at": {"$gt": datetime.utcnow().isoformat()}
    }
    
    discounts = await db.discounts.find(query).to_list(100)
    return [Discount(**discount) for discount in discounts]

# Enhanced Discount Routes
@api_router.post("/discounts")
async def create_discount(discount_data: DiscountCreate, user: User = Depends(require_business_auth)):
    """Create a new discount"""
    # Get user's business
    business = await db.businesses.find_one({"owner_id": user.id, "is_approved": True})
    if not business:
        raise HTTPException(status_code=404, detail="No approved business found")
    
    # Check subscription status
    has_active_subscription = await check_business_subscription(business["id"])
    if not has_active_subscription:
        raise HTTPException(status_code=403, detail="Active subscription required")
    
    # Generate QR code data
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
    """Redeem a coupon with usage tracking"""
    # Get discount
    discount = await db.discounts.find_one({"id": discount_id, "is_active": True})
    if not discount:
        raise HTTPException(status_code=404, detail="Discount not found or inactive")
    
    # Check if discount is expired
    if datetime.fromisoformat(discount["expires_at"]) < datetime.utcnow():
        raise HTTPException(status_code=400, detail="Discount has expired")
    
    # Verify QR code
    if discount["qr_code"] != redemption.qr_code:
        raise HTTPException(status_code=400, detail="Invalid QR code")
    
    # Check user usage limit
    user_usage_count = await db.coupon_usage.count_documents({
        "discount_id": discount_id,
        "user_id": user.id
    })
    
    if user_usage_count >= discount["max_uses_per_user"]:
        raise HTTPException(
            status_code=400, 
            detail=f"Maximum usage limit reached ({discount['max_uses_per_user']} per user)"
        )
    
    # Check total usage limit
    if discount.get("max_uses") and discount["current_uses"] >= discount["max_uses"]:
        raise HTTPException(status_code=400, detail="Discount usage limit reached")
    
    # Record usage
    usage = CouponUsage(
        discount_id=discount_id,
        business_id=discount["business_id"],
        user_id=user.id,
        qr_code=redemption.qr_code,
        verification_status="verified"
    )
    
    await db.coupon_usage.insert_one(usage.dict())
    
    # Update discount usage count
    await db.discounts.update_one(
        {"id": discount_id},
        {"$inc": {"current_uses": 1}}
    )
    
    return {
        "success": True,
        "message": "Coupon redeemed successfully",
        "discount_title": discount["title"],
        "discount_value": f"{discount['discount_value']}{'%' if discount['discount_type'] == 'percentage' else '$'}"
    }

@api_router.get("/discounts")
async def get_all_discounts(category: Optional[str] = None):
    """Get all active discounts"""
    # Get active discounts with business info
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
        result.append({
            "discount": discount_obj.dict(),
            "business": business_obj.dict() if business_obj else None
        })
    
    return result

# Business Analytics Routes
@api_router.get("/business/analytics")
async def get_business_analytics(user: User = Depends(require_business_auth)):
    """Get business analytics and usage statistics"""
    business = await db.businesses.find_one({"owner_id": user.id})
    if not business:
        raise HTTPException(status_code=404, detail="Business not found")
    
    # Get discount statistics
    total_discounts = await db.discounts.count_documents({"business_id": business["id"]})
    active_discounts = await db.discounts.count_documents({
        "business_id": business["id"],
        "is_active": True,
        "expires_at": {"$gt": datetime.utcnow().isoformat()}
    })
    
    # Get usage statistics
    total_redemptions = await db.coupon_usage.count_documents({"business_id": business["id"]})
    
    # Get recent redemptions
    recent_redemptions = await db.coupon_usage.aggregate([
        {"$match": {"business_id": business["id"]}},
        {"$sort": {"used_at": -1}},
        {"$limit": 10},
        {
            "$lookup": {
                "from": "users",
                "localField": "user_id",
                "foreignField": "id",
                "as": "user"
            }
        },
        {
            "$lookup": {
                "from": "discounts",
                "localField": "discount_id",
                "foreignField": "id",
                "as": "discount"
            }
        }
    ]).to_list(10)
    
    # Monthly redemption trends (last 6 months)
    six_months_ago = datetime.utcnow() - timedelta(days=180)
    monthly_stats = await db.coupon_usage.aggregate([
        {
            "$match": {
                "business_id": business["id"],
                "used_at": {"$gte": six_months_ago.isoformat()}
            }
        },
        {
            "$group": {
                "_id": {
                    "$dateToString": {
                        "format": "%Y-%m",
                        "date": {"$dateFromString": {"dateString": "$used_at"}}
                    }
                },
                "count": {"$sum": 1}
            }
        },
        {"$sort": {"_id": 1}}
    ]).to_list(6)
    
    return {
        "business_name": business["name"],
        "total_discounts": total_discounts,
        "active_discounts": active_discounts,
        "total_redemptions": total_redemptions,
        "recent_redemptions": [
            {
                "discount_title": r["discount"][0]["title"] if r["discount"] else "Unknown",
                "user_name": r["user"][0]["name"] if r["user"] else "Unknown",
                "used_at": r["used_at"],
                "verification_status": r["verification_status"]
            }
            for r in recent_redemptions
        ],
        "monthly_trends": [
            {"month": stat["_id"], "redemptions": stat["count"]}
            for stat in monthly_stats
        ]
    }

# Rating Routes
@api_router.post("/businesses/{business_id}/rate")
async def rate_business(business_id: str, rating_data: RatingCreate, user: User = Depends(require_auth)):
    """Rate a business"""
    # Check if business exists
    business = await db.businesses.find_one({"id": business_id, "is_approved": True})
    if not business:
        raise HTTPException(status_code=404, detail="Business not found")
    
    # Check if user already rated this business
    existing_rating = await db.business_ratings.find_one({
        "business_id": business_id,
        "user_id": user.id
    })
    
    if existing_rating:
        # Update existing rating
        await db.business_ratings.update_one(
            {"id": existing_rating["id"]},
            {"$set": {
                "rating": rating_data.rating,
                "review": rating_data.review,
                "created_at": datetime.utcnow().isoformat()
            }}
        )
    else:
        # Create new rating
        rating = BusinessRating(
            business_id=business_id,
            user_id=user.id,
            **rating_data.dict()
        )
        await db.business_ratings.insert_one(rating.dict())
    
    # Update business rating
    ratings = await db.business_ratings.find({"business_id": business_id}).to_list(1000)
    if ratings:
        avg_rating = sum(r["rating"] for r in ratings) / len(ratings)
        await db.businesses.update_one(
            {"id": business_id},
            {"$set": {"rating": avg_rating, "review_count": len(ratings)}}
        )
    
    return {"success": True}

@api_router.get("/businesses/{business_id}/ratings")
async def get_business_ratings(business_id: str):
    """Get ratings for a business"""
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

# Admin Routes
@api_router.get("/admin/businesses/pending")
async def get_pending_businesses(user: User = Depends(require_admin_auth)):
    """Get businesses pending approval"""
    businesses = await db.businesses.find({"is_approved": False}).to_list(100)
    return [Business(**business) for business in businesses]

@api_router.post("/admin/businesses/{business_id}/approve")
async def approve_business(business_id: str, user: User = Depends(require_admin_auth)):
    """Approve a business"""
    result = await db.businesses.update_one(
        {"id": business_id},
        {"$set": {"is_approved": True, "approved_at": datetime.utcnow().isoformat()}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Business not found")
    
    return {"success": True}

@api_router.get("/admin/platform/settings")
async def get_platform_settings(user: User = Depends(require_admin_auth)):
    """Get platform settings"""
    settings = await db.platform_settings.find_one()
    if not settings:
        # Create default settings
        default_settings = PlatformSettings()
        await db.platform_settings.insert_one(default_settings.dict())
        return default_settings.dict()
    
    return PlatformSettings(**settings).dict()

@api_router.put("/admin/platform/settings")
async def update_platform_settings(settings_data: dict, user: User = Depends(require_admin_auth)):
    """Update platform settings"""
    settings = await db.platform_settings.find_one()
    if settings:
        await db.platform_settings.update_one(
            {"id": settings["id"]},
            {"$set": {**settings_data, "updated_at": datetime.utcnow().isoformat()}}
        )
    else:
        new_settings = PlatformSettings(**settings_data)
        await db.platform_settings.insert_one(new_settings.dict())
    
    return {"success": True}

@api_router.get("/admin/analytics")
async def get_platform_analytics(user: User = Depends(require_admin_auth)):
    """Get platform-wide analytics"""
    total_businesses = await db.businesses.count_documents({})
    approved_businesses = await db.businesses.count_documents({"is_approved": True})
    total_users = await db.users.count_documents({"user_type": "customer"})
    total_discounts = await db.discounts.count_documents({})
    total_redemptions = await db.coupon_usage.count_documents({})
    
    # Subscription analytics
    trial_subscriptions = await db.business_subscriptions.count_documents({"status": "trial"})
    active_subscriptions = await db.business_subscriptions.count_documents({"status": "active"})
    
    return {
        "total_businesses": total_businesses,
        "approved_businesses": approved_businesses,
        "pending_businesses": total_businesses - approved_businesses,
        "total_users": total_users,
        "total_discounts": total_discounts,
        "total_redemptions": total_redemptions,
        "trial_subscriptions": trial_subscriptions,
        "active_subscriptions": active_subscriptions
    }

# Categories endpoint
@api_router.get("/categories")
async def get_categories():
    """Get business categories"""
    categories = [
        "Restaurant", "Retail", "Health & Beauty", "Services", 
        "Entertainment", "Travel", "Technology", "Fitness", 
        "Education", "Other"
    ]
    return categories

# Webhook endpoint for Stripe
@api_router.post("/webhooks/stripe")
async def stripe_webhook(request: Request):
    """Handle Stripe webhooks"""
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature")
    
    try:
        event = stripe.Webhook.construct_event(
            payload, sig_header, os.environ.get("STRIPE_WEBHOOK_SECRET", "")
        )
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid payload")
    except stripe.error.SignatureVerificationError:
        raise HTTPException(status_code=400, detail="Invalid signature")
    
    # Handle subscription events
    if event["type"] == "invoice.payment_succeeded":
        subscription_id = event["data"]["object"]["subscription"]
        
        # Update subscription status
        await db.business_subscriptions.update_one(
            {"stripe_subscription_id": subscription_id},
            {"$set": {"status": "active", "updated_at": datetime.utcnow().isoformat()}}
        )
    
    elif event["type"] == "invoice.payment_failed":
        subscription_id = event["data"]["object"]["subscription"]
        
        # Update subscription status
        await db.business_subscriptions.update_one(
            {"stripe_subscription_id": subscription_id},
            {"$set": {"status": "past_due", "updated_at": datetime.utcnow().isoformat()}}
        )
    
    return {"success": True}

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
    client.close()