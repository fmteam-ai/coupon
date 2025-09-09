import os
import jwt
import time
import json
import hashlib
import secrets
import base64
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any, Tuple
from enum import Enum
from dotenv import load_dotenv
from pymongo import MongoClient
import pyotp
import qrcode
from io import BytesIO
import bcrypt

load_dotenv()

class UserRole(Enum):
    """User role definitions"""
    CUSTOMER = "customer"
    BUSINESS_OWNER = "business_owner"
    BUSINESS_ADMIN = "business_admin"
    SYSTEM_ADMIN = "system_admin"
    MODERATOR = "moderator"

class Permission(Enum):
    """Permission definitions"""
    # Customer permissions
    VIEW_DEALS = "view_deals"
    USE_COUPONS = "use_coupons"
    RATE_BUSINESS = "rate_business"
    SHARE_CONTENT = "share_content"
    
    # Business permissions
    CREATE_BUSINESS = "create_business"
    MANAGE_BUSINESS = "manage_business"
    CREATE_DEALS = "create_deals"
    MANAGE_DEALS = "manage_deals"
    VIEW_ANALYTICS = "view_analytics"
    MANAGE_STAFF = "manage_staff"
    
    # Admin permissions
    MODERATE_CONTENT = "moderate_content"
    MANAGE_USERS = "manage_users"
    SYSTEM_CONFIG = "system_config"
    VIEW_ALL_DATA = "view_all_data"

class EnhancedAuthManager:
    """Enhanced authentication and authorization management"""
    
    def __init__(self):
        self.mongo_url = os.getenv("MONGO_URL")
        self.client = MongoClient(self.mongo_url)
        self.db = self.client.coupon_app
        
        # JWT configuration
        self.jwt_secret = os.getenv("JWT_SECRET", "your-secret-key-change-in-production")
        self.access_token_expire = 15  # 15 minutes
        self.refresh_token_expire = 7 * 24 * 60  # 7 days in minutes
        
        # MFA configuration
        self.mfa_issuer = "CouponApp"
        
        # Role-permission mapping
        self.role_permissions = {
            UserRole.CUSTOMER: [
                Permission.VIEW_DEALS, Permission.USE_COUPONS, 
                Permission.RATE_BUSINESS, Permission.SHARE_CONTENT
            ],
            UserRole.BUSINESS_OWNER: [
                Permission.VIEW_DEALS, Permission.USE_COUPONS, Permission.RATE_BUSINESS,
                Permission.SHARE_CONTENT, Permission.CREATE_BUSINESS, Permission.MANAGE_BUSINESS,
                Permission.CREATE_DEALS, Permission.MANAGE_DEALS, Permission.VIEW_ANALYTICS
            ],
            UserRole.BUSINESS_ADMIN: [
                Permission.VIEW_DEALS, Permission.MANAGE_BUSINESS, Permission.CREATE_DEALS,
                Permission.MANAGE_DEALS, Permission.VIEW_ANALYTICS, Permission.MANAGE_STAFF
            ],
            UserRole.MODERATOR: [
                Permission.VIEW_DEALS, Permission.MODERATE_CONTENT, Permission.MANAGE_USERS
            ],
            UserRole.SYSTEM_ADMIN: list(Permission)  # All permissions
        }
        
        # Initialize collections
        self._ensure_indexes()
    
    def _ensure_indexes(self):
        """Ensure database indexes for performance"""
        try:
            self.db.refresh_tokens.create_index("token", unique=True)
            self.db.refresh_tokens.create_index("expires_at")
            self.db.mfa_secrets.create_index("user_id", unique=True)
            self.db.user_sessions.create_index("user_id")
            self.db.user_sessions.create_index("expires_at")
            self.db.password_reset_tokens.create_index("token", unique=True)
            self.db.password_reset_tokens.create_index("expires_at")
        except Exception as e:
            print(f"Index creation error: {e}")
    
    def generate_token_pair(self, user_id: str, role: str, permissions: List[str] = None) -> Dict[str, str]:
        """Generate access and refresh token pair"""
        try:
            now = datetime.utcnow()
            
            # Access token payload
            access_payload = {
                "user_id": user_id,
                "role": role,
                "permissions": permissions or [],
                "type": "access",
                "iat": now,
                "exp": now + timedelta(minutes=self.access_token_expire),
                "jti": secrets.token_urlsafe(16)  # JWT ID for revocation
            }
            
            # Refresh token payload
            refresh_payload = {
                "user_id": user_id,
                "type": "refresh",
                "iat": now,
                "exp": now + timedelta(minutes=self.refresh_token_expire),
                "jti": secrets.token_urlsafe(16)
            }
            
            # Generate tokens
            access_token = jwt.encode(access_payload, self.jwt_secret, algorithm="HS256")
            refresh_token = jwt.encode(refresh_payload, self.jwt_secret, algorithm="HS256")
            
            # Store refresh token in database
            self.db.refresh_tokens.insert_one({
                "token": refresh_token,
                "user_id": user_id,
                "jti": refresh_payload["jti"],
                "created_at": now,
                "expires_at": refresh_payload["exp"],
                "is_active": True
            })
            
            return {
                "access_token": access_token,
                "refresh_token": refresh_token,
                "token_type": "Bearer",
                "expires_in": self.access_token_expire * 60  # seconds
            }
            
        except Exception as e:
            print(f"Token generation error: {e}")
            return {}
    
    def verify_token(self, token: str, token_type: str = "access") -> Optional[Dict[str, Any]]:
        """Verify and decode JWT token"""
        try:
            payload = jwt.decode(token, self.jwt_secret, algorithms=["HS256"])
            
            # Check token type
            if payload.get("type") != token_type:
                return None
            
            # Check if token is blacklisted (for access tokens)
            if token_type == "access":
                if self.is_token_blacklisted(payload.get("jti")):
                    return None
            
            # Check if refresh token is active
            if token_type == "refresh":
                refresh_record = self.db.refresh_tokens.find_one({
                    "jti": payload.get("jti"),
                    "is_active": True
                })
                if not refresh_record:
                    return None
            
            return payload
            
        except jwt.ExpiredSignatureError:
            return None
        except jwt.InvalidTokenError:
            return None
        except Exception as e:
            print(f"Token verification error: {e}")
            return None
    
    def refresh_access_token(self, refresh_token: str) -> Optional[Dict[str, str]]:
        """Generate new access token using refresh token"""
        try:
            # Verify refresh token
            payload = self.verify_token(refresh_token, "refresh")
            if not payload:
                return None
            
            user_id = payload["user_id"]
            
            # Get user role and permissions
            user = self.db.users.find_one({"id": user_id})
            if not user:
                return None
            
            role = user.get("role", UserRole.CUSTOMER.value)
            permissions = self.get_user_permissions(role)
            
            # Generate new access token only
            now = datetime.utcnow()
            access_payload = {
                "user_id": user_id,
                "role": role,
                "permissions": [p.value for p in permissions],
                "type": "access",
                "iat": now,
                "exp": now + timedelta(minutes=self.access_token_expire),
                "jti": secrets.token_urlsafe(16)
            }
            
            access_token = jwt.encode(access_payload, self.jwt_secret, algorithm="HS256")
            
            return {
                "access_token": access_token,
                "token_type": "Bearer",
                "expires_in": self.access_token_expire * 60
            }
            
        except Exception as e:
            print(f"Token refresh error: {e}")
            return None
    
    def revoke_refresh_token(self, refresh_token: str) -> bool:
        """Revoke a refresh token"""
        try:
            payload = jwt.decode(refresh_token, self.jwt_secret, algorithms=["HS256"])
            if payload.get("type") != "refresh":
                return False
            
            # Mark refresh token as inactive
            result = self.db.refresh_tokens.update_one(
                {"jti": payload["jti"]},
                {
                    "$set": {
                        "is_active": False,
                        "revoked_at": datetime.utcnow()
                    }
                }
            )
            
            return result.modified_count > 0
            
        except Exception as e:
            print(f"Token revocation error: {e}")
            return False
    
    def blacklist_token(self, jti: str, expires_at: datetime) -> bool:
        """Add token to blacklist"""
        try:
            self.db.token_blacklist.insert_one({
                "jti": jti,
                "blacklisted_at": datetime.utcnow(),
                "expires_at": expires_at
            })
            return True
        except Exception as e:
            print(f"Token blacklist error: {e}")
            return False
    
    def is_token_blacklisted(self, jti: str) -> bool:
        """Check if token is blacklisted"""
        try:
            return self.db.token_blacklist.find_one({"jti": jti}) is not None
        except Exception as e:
            print(f"Blacklist check error: {e}")
            return False
    
    def setup_mfa(self, user_id: str) -> Dict[str, Any]:
        """Setup Multi-Factor Authentication for user"""
        try:
            # Generate secret
            secret = pyotp.random_base32()
            
            # Create TOTP instance
            totp = pyotp.TOTP(secret)
            
            # Generate provisioning URI
            user = self.db.users.find_one({"id": user_id})
            if not user:
                return {"error": "User not found"}
            
            email = user.get("email", "user@example.com")
            provisioning_uri = totp.provisioning_uri(
                name=email,
                issuer_name=self.mfa_issuer
            )
            
            # Generate QR code
            qr = qrcode.QRCode(version=1, box_size=10, border=5)
            qr.add_data(provisioning_uri)
            qr.make(fit=True)
            
            qr_image = qr.make_image(fill_color="black", back_color="white")
            qr_buffer = BytesIO()
            qr_image.save(qr_buffer, format='PNG')
            qr_base64 = base64.b64encode(qr_buffer.getvalue()).decode()
            
            # Store secret (temporarily, until verified)
            self.db.mfa_secrets.update_one(
                {"user_id": user_id},
                {
                    "$set": {
                        "secret": secret,
                        "is_verified": False,
                        "created_at": datetime.utcnow()
                    }
                },
                upsert=True
            )
            
            return {
                "success": True,
                "secret": secret,
                "qr_code": f"data:image/png;base64,{qr_base64}",
                "provisioning_uri": provisioning_uri
            }
            
        except Exception as e:
            print(f"MFA setup error: {e}")
            return {"error": str(e)}
    
    def verify_mfa_setup(self, user_id: str, token: str) -> bool:
        """Verify MFA setup with TOTP token"""
        try:
            # Get user's secret
            mfa_record = self.db.mfa_secrets.find_one({"user_id": user_id})
            if not mfa_record:
                return False
            
            secret = mfa_record["secret"]
            totp = pyotp.TOTP(secret)
            
            # Verify token
            if totp.verify(token, valid_window=2):  # Allow 2 time windows for clock drift
                # Mark as verified
                self.db.mfa_secrets.update_one(
                    {"user_id": user_id},
                    {
                        "$set": {
                            "is_verified": True,
                            "verified_at": datetime.utcnow()
                        }
                    }
                )
                
                # Update user record
                self.db.users.update_one(
                    {"id": user_id},
                    {"$set": {"mfa_enabled": True}}
                )
                
                return True
            
            return False
            
        except Exception as e:
            print(f"MFA verification error: {e}")
            return False
    
    def verify_mfa_token(self, user_id: str, token: str) -> bool:
        """Verify MFA token for login"""
        try:
            mfa_record = self.db.mfa_secrets.find_one({
                "user_id": user_id,
                "is_verified": True
            })
            
            if not mfa_record:
                return False
            
            secret = mfa_record["secret"]
            totp = pyotp.TOTP(secret)
            
            return totp.verify(token, valid_window=2)
            
        except Exception as e:
            print(f"MFA token verification error: {e}")
            return False
    
    def disable_mfa(self, user_id: str) -> bool:
        """Disable MFA for user"""
        try:
            # Remove MFA secret
            self.db.mfa_secrets.delete_one({"user_id": user_id})
            
            # Update user record
            result = self.db.users.update_one(
                {"id": user_id},
                {"$set": {"mfa_enabled": False}}
            )
            
            return result.modified_count > 0
            
        except Exception as e:
            print(f"MFA disable error: {e}")
            return False
    
    def get_user_permissions(self, role: str) -> List[Permission]:
        """Get permissions for a user role"""
        try:
            user_role = UserRole(role)
            return self.role_permissions.get(user_role, [])
        except ValueError:
            return []
    
    def check_permission(self, user_permissions: List[str], required_permission: Permission) -> bool:
        """Check if user has required permission"""
        return required_permission.value in user_permissions
    
    def assign_role(self, user_id: str, role: UserRole, assigned_by: str) -> bool:
        """Assign role to user"""
        try:
            # Log role assignment
            self.db.role_assignments.insert_one({
                "user_id": user_id,
                "role": role.value,
                "assigned_by": assigned_by,
                "assigned_at": datetime.utcnow(),
                "is_active": True
            })
            
            # Update user record
            result = self.db.users.update_one(
                {"id": user_id},
                {
                    "$set": {
                        "role": role.value,
                        "role_updated_at": datetime.utcnow()
                    }
                }
            )
            
            return result.modified_count > 0
            
        except Exception as e:
            print(f"Role assignment error: {e}")
            return False
    
    def create_user_session(self, user_id: str, device_info: Dict[str, Any] = None) -> str:
        """Create user session for tracking"""
        try:
            session_id = secrets.token_urlsafe(32)
            
            session_data = {
                "session_id": session_id,
                "user_id": user_id,
                "created_at": datetime.utcnow(),
                "expires_at": datetime.utcnow() + timedelta(days=30),
                "device_info": device_info or {},
                "is_active": True
            }
            
            self.db.user_sessions.insert_one(session_data)
            
            return session_id
            
        except Exception as e:
            print(f"Session creation error: {e}")
            return ""
    
    def get_active_sessions(self, user_id: str) -> List[Dict[str, Any]]:
        """Get active sessions for user"""
        try:
            sessions = list(self.db.user_sessions.find({
                "user_id": user_id,
                "is_active": True,
                "expires_at": {"$gt": datetime.utcnow()}
            }))
            
            return sessions
            
        except Exception as e:
            print(f"Get sessions error: {e}")
            return []
    
    def revoke_session(self, session_id: str, user_id: str) -> bool:
        """Revoke user session"""
        try:
            result = self.db.user_sessions.update_one(
                {"session_id": session_id, "user_id": user_id},
                {
                    "$set": {
                        "is_active": False,
                        "revoked_at": datetime.utcnow()
                    }
                }
            )
            
            return result.modified_count > 0
            
        except Exception as e:
            print(f"Session revocation error: {e}")
            return False
    
    def generate_password_reset_token(self, email: str) -> Optional[str]:
        """Generate password reset token"""
        try:
            user = self.db.users.find_one({"email": email})
            if not user:
                return None
            
            token = secrets.token_urlsafe(32)
            expires_at = datetime.utcnow() + timedelta(hours=1)  # 1 hour expiry
            
            self.db.password_reset_tokens.insert_one({
                "token": token,
                "user_id": user["id"],
                "email": email,
                "created_at": datetime.utcnow(),
                "expires_at": expires_at,
                "used": False
            })
            
            return token
            
        except Exception as e:
            print(f"Password reset token error: {e}")
            return None
    
    def verify_password_reset_token(self, token: str) -> Optional[Dict[str, Any]]:
        """Verify password reset token"""
        try:
            token_record = self.db.password_reset_tokens.find_one({
                "token": token,
                "used": False,
                "expires_at": {"$gt": datetime.utcnow()}
            })
            
            return token_record
            
        except Exception as e:
            print(f"Password reset verification error: {e}")
            return None
    
    def use_password_reset_token(self, token: str) -> bool:
        """Mark password reset token as used"""
        try:
            result = self.db.password_reset_tokens.update_one(
                {"token": token},
                {
                    "$set": {
                        "used": True,
                        "used_at": datetime.utcnow()
                    }
                }
            )
            
            return result.modified_count > 0
            
        except Exception as e:
            print(f"Password reset token use error: {e}")
            return False
    
    def hash_password(self, password: str) -> str:
        """Hash password using bcrypt"""
        salt = bcrypt.gensalt()
        return bcrypt.hashpw(password.encode('utf-8'), salt).decode('utf-8')
    
    def verify_password(self, password: str, hashed: str) -> bool:
        """Verify password against hash"""
        return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))
    
    def cleanup_expired_tokens(self):
        """Cleanup expired tokens and sessions"""
        try:
            now = datetime.utcnow()
            
            # Remove expired refresh tokens
            self.db.refresh_tokens.delete_many({"expires_at": {"$lt": now}})
            
            # Remove expired blacklisted tokens
            self.db.token_blacklist.delete_many({"expires_at": {"$lt": now}})
            
            # Remove expired sessions
            self.db.user_sessions.delete_many({"expires_at": {"$lt": now}})
            
            # Remove expired password reset tokens
            self.db.password_reset_tokens.delete_many({"expires_at": {"$lt": now}})
            
            print("Token cleanup completed")
            
        except Exception as e:
            print(f"Token cleanup error: {e}")

# Permission decorators
def require_permission(permission: Permission):
    """Decorator to check user permissions"""
    def decorator(func):
        from functools import wraps
        
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # This will be integrated with FastAPI dependency injection
            # For now, it's a placeholder for the pattern
            return await func(*args, **kwargs)
        
        return wrapper
    return decorator

def require_role(role: UserRole):
    """Decorator to check user role"""
    def decorator(func):
        from functools import wraps
        
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # This will be integrated with FastAPI dependency injection
            return await func(*args, **kwargs)
        
        return wrapper
    return decorator

# Global instance
enhanced_auth_manager = EnhancedAuthManager()