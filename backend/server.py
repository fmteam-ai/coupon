from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, Response
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

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

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

# Discount/Coupon Models
class Discount(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    business_id: str
    title: str
    description: str
    discount_type: str  # percentage, fixed_amount
    discount_value: float
    minimum_consumption: Optional[float] = 0
    max_uses: Optional[int] = None
    current_uses: int = 0
    expires_at: datetime
    is_active: bool = True
    created_at: datetime = Field(default_factory=datetime.utcnow)
    qr_code: Optional[str] = None

class DiscountCreate(BaseModel):
    title: str
    description: str
    discount_type: str
    discount_value: float
    minimum_consumption: Optional[float] = 0
    max_uses: Optional[int] = None
    expires_at: datetime

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
            user_type="customer"
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
    business = Business(
        **business_data.dict(),
        owner_id=user.id,
        is_approved=False
    )
    
    await db.businesses.insert_one(business.dict())
    return {"success": True, "business_id": business.id}

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

# Discount Routes
@api_router.post("/discounts")
async def create_discount(discount_data: DiscountCreate, user: User = Depends(require_business_auth)):
    """Create a new discount"""
    # Get user's business
    business = await db.businesses.find_one({"owner_id": user.id, "is_approved": True})
    if not business:
        raise HTTPException(status_code=404, detail="No approved business found")
    
    # Generate QR code data
    qr_data = f"discount_{str(uuid.uuid4())}"
    
    discount = Discount(
        **discount_data.dict(),
        business_id=business["id"],
        qr_code=qr_data
    )
    
    await db.discounts.insert_one(discount.dict())
    return {"success": True, "discount_id": discount.id, "qr_code": qr_data}

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