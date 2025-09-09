import os
import time
import json
import hashlib
import hmac
import base64
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any, Callable
from collections import defaultdict, deque
from functools import wraps
from fastapi import Request, Response, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.middleware.base import BaseHTTPMiddleware
from starlette.middleware.base import RequestResponseEndpoint
from starlette.responses import JSONResponse
import re
from dotenv import load_dotenv

load_dotenv()

class SecurityMiddleware(BaseHTTPMiddleware):
    """Comprehensive API Security Middleware"""
    
    def __init__(self, app, config: Dict[str, Any] = None):
        super().__init__(app)
        self.config = config or {}
        
        # Rate limiting storage (in-memory for now, should use Redis in production)
        self.rate_limit_storage = defaultdict(lambda: deque())
        self.blocked_ips = set()
        self.suspicious_patterns = []
        
        # Security headers
        self.security_headers = {
            "X-Content-Type-Options": "nosniff",
            "X-Frame-Options": "DENY",
            "X-XSS-Protection": "1; mode=block",
            "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
            "Content-Security-Policy": "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'",
            "Referrer-Policy": "strict-origin-when-cross-origin",
            "Permissions-Policy": "geolocation=(), microphone=(), camera=()"
        }
        
        # Rate limiting configuration
        self.rate_limits = {
            "default": {"requests": 100, "window": 60},  # 100 requests per minute
            "auth": {"requests": 10, "window": 60},      # 10 auth attempts per minute
            "upload": {"requests": 20, "window": 60},    # 20 uploads per minute
            "search": {"requests": 50, "window": 60},    # 50 searches per minute
            "pricing": {"requests": 200, "window": 60},  # 200 pricing requests per minute
        }
        
        # Suspicious pattern detection
        self.init_suspicious_patterns()
        
    def init_suspicious_patterns(self):
        """Initialize patterns for detecting suspicious requests"""
        self.suspicious_patterns = [
            # SQL Injection patterns
            re.compile(r"(\bunion\b|\bselect\b|\binsert\b|\bdelete\b|\bdrop\b|\bupdate\b)", re.IGNORECASE),
            # XSS patterns
            re.compile(r"(<script|javascript:|on\w+\s*=)", re.IGNORECASE),
            # Path traversal
            re.compile(r"(\.\./|\.\.\\|%2e%2e%2f|%2e%2e%5c)", re.IGNORECASE),
            # Command injection
            re.compile(r"(\b(exec|system|eval|subprocess)\b|\||&&|;)", re.IGNORECASE),
            # NoSQL injection patterns
            re.compile(r"(\$where|\$ne|\$gt|\$lt|\$regex|\$or|\$and)", re.IGNORECASE),
        ]

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        """Main security middleware dispatcher"""
        start_time = time.time()
        client_ip = self.get_client_ip(request)
        
        try:
            # 1. Check if IP is blocked
            if await self.is_ip_blocked(client_ip):
                return JSONResponse(
                    status_code=429,
                    content={"error": "IP temporarily blocked due to suspicious activity"}
                )
            
            # 2. Rate limiting check
            rate_limit_result = await self.check_rate_limit(request, client_ip)
            if rate_limit_result:
                return rate_limit_result
            
            # 3. Input validation and suspicious pattern detection
            security_check = await self.security_validation(request)
            if security_check:
                await self.log_suspicious_activity(client_ip, request, "Pattern detection")
                return security_check
            
            # 4. Request size validation
            if await self.check_request_size(request):
                return JSONResponse(
                    status_code=413,
                    content={"error": "Request payload too large"}
                )
            
            # 5. Process the request
            response = await call_next(request)
            
            # 6. Add security headers
            self.add_security_headers(response)
            
            # 7. Log request for monitoring
            await self.log_request(request, response, client_ip, time.time() - start_time)
            
            return response
            
        except Exception as e:
            print(f"Security middleware error: {e}")
            return JSONResponse(
                status_code=500,
                content={"error": "Internal security error"}
            )

    def get_client_ip(self, request: Request) -> str:
        """Extract real client IP considering proxies"""
        # Check X-Forwarded-For header first (for load balancers/proxies)
        forwarded_for = request.headers.get("X-Forwarded-For")
        if forwarded_for:
            # Take the first IP if multiple are present
            return forwarded_for.split(",")[0].strip()
        
        # Check X-Real-IP header
        real_ip = request.headers.get("X-Real-IP")
        if real_ip:
            return real_ip.strip()
        
        # Fall back to client IP
        return request.client.host if request.client else "unknown"

    async def is_ip_blocked(self, ip: str) -> bool:
        """Check if IP is temporarily blocked"""
        return ip in self.blocked_ips

    async def check_rate_limit(self, request: Request, client_ip: str) -> Optional[JSONResponse]:
        """Check rate limiting based on endpoint and IP"""
        path = request.url.path
        method = request.method
        
        # Determine rate limit category
        category = "default"
        if "/auth/" in path or "/login" in path or "/register" in path:
            category = "auth"
        elif "/upload" in path or "/cv/" in path:
            category = "upload"
        elif "/search" in path or "/visual-search" in path:
            category = "search"
        elif "/pricing/" in path:
            category = "pricing"
        
        rate_config = self.rate_limits.get(category, self.rate_limits["default"])
        
        # Create rate limit key
        rate_key = f"{client_ip}:{category}"
        current_time = time.time()
        window_start = current_time - rate_config["window"]
        
        # Clean old entries
        while (self.rate_limit_storage[rate_key] and 
               self.rate_limit_storage[rate_key][0] < window_start):
            self.rate_limit_storage[rate_key].popleft()
        
        # Check if limit exceeded
        if len(self.rate_limit_storage[rate_key]) >= rate_config["requests"]:
            # Block IP temporarily if too many violations
            await self.handle_rate_limit_violation(client_ip)
            
            return JSONResponse(
                status_code=429,
                content={
                    "error": "Rate limit exceeded",
                    "limit": rate_config["requests"],
                    "window": rate_config["window"],
                    "retry_after": int(rate_config["window"])
                },
                headers={"Retry-After": str(rate_config["window"])}
            )
        
        # Add current request to rate limit storage
        self.rate_limit_storage[rate_key].append(current_time)
        
        return None

    async def handle_rate_limit_violation(self, ip: str):
        """Handle rate limit violations - block IP temporarily"""
        violation_key = f"violations:{ip}"
        current_violations = len(self.rate_limit_storage.get(violation_key, []))
        
        if current_violations > 5:  # Block after 5 violations
            self.blocked_ips.add(ip)
            # In production, this should be stored in Redis with TTL
            print(f"IP {ip} temporarily blocked due to repeated rate limit violations")

    async def security_validation(self, request: Request) -> Optional[JSONResponse]:
        """Validate request for suspicious patterns and malicious content"""
        try:
            # Check URL path
            path = str(request.url.path)
            if await self.check_suspicious_patterns(path):
                return JSONResponse(
                    status_code=400,
                    content={"error": "Invalid request format"}
                )
            
            # Check query parameters
            query_params = str(request.url.query)
            if query_params and await self.check_suspicious_patterns(query_params):
                return JSONResponse(
                    status_code=400,
                    content={"error": "Invalid query parameters"}
                )
            
            # Check headers for suspicious content
            for header_name, header_value in request.headers.items():
                if await self.check_suspicious_patterns(header_value):
                    return JSONResponse(
                        status_code=400,
                        content={"error": "Invalid request headers"}
                    )
            
            return None
            
        except Exception as e:
            print(f"Security validation error: {e}")
            return None

    async def check_suspicious_patterns(self, content: str) -> bool:
        """Check content against suspicious patterns"""
        if not content:
            return False
        
        for pattern in self.suspicious_patterns:
            if pattern.search(content):
                return True
        
        return False

    async def check_request_size(self, request: Request) -> bool:
        """Check if request size exceeds limits"""
        content_length = request.headers.get("content-length")
        if content_length:
            try:
                size = int(content_length)
                # Different limits for different endpoints
                if "/cv/" in request.url.path:  # Computer vision endpoints
                    max_size = 10 * 1024 * 1024  # 10MB for images
                else:
                    max_size = 1 * 1024 * 1024   # 1MB for regular requests
                
                return size > max_size
            except ValueError:
                return False
        
        return False

    def add_security_headers(self, response: Response):
        """Add security headers to response"""
        for header, value in self.security_headers.items():
            response.headers[header] = value
        
        # Add CORS headers (can be customized)
        response.headers["Access-Control-Allow-Origin"] = "*"  # Should be more restrictive in production
        response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS"
        response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization, X-Requested-With"
        response.headers["Access-Control-Max-Age"] = "86400"

    async def log_suspicious_activity(self, ip: str, request: Request, reason: str):
        """Log suspicious activity for monitoring"""
        log_entry = {
            "timestamp": datetime.now().isoformat(),
            "ip": ip,
            "method": request.method,
            "path": str(request.url.path),
            "query": str(request.url.query),
            "headers": dict(request.headers),
            "reason": reason,
            "user_agent": request.headers.get("user-agent", "unknown")
        }
        
        # In production, this should go to a proper logging system
        print(f"SECURITY ALERT: {json.dumps(log_entry, indent=2)}")

    async def log_request(self, request: Request, response: Response, ip: str, duration: float):
        """Log requests for monitoring and analytics"""
        # Only log in debug mode or for errors
        if response.status_code >= 400 or os.getenv("DEBUG", "false").lower() == "true":
            log_entry = {
                "timestamp": datetime.now().isoformat(),
                "ip": ip,
                "method": request.method,
                "path": str(request.url.path),
                "status_code": response.status_code,
                "duration_ms": round(duration * 1000, 2),
                "user_agent": request.headers.get("user-agent", "unknown")
            }
            print(f"REQUEST LOG: {json.dumps(log_entry)}")


class InputValidator:
    """Input validation utilities for API endpoints"""
    
    @staticmethod
    def validate_email(email: str) -> bool:
        """Validate email format"""
        pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
        return re.match(pattern, email) is not None
    
    @staticmethod
    def validate_phone(phone: str) -> bool:
        """Validate phone number format"""
        clean_phone = re.sub(r'[^\d+]', '', phone)
        pattern = r'^\+?[1-9]\d{9,14}$'
        return re.match(pattern, clean_phone) is not None
    
    @staticmethod
    def validate_coordinates(lat: float, lng: float) -> bool:
        """Validate GPS coordinates"""
        return (-90 <= lat <= 90) and (-180 <= lng <= 180)
    
    @staticmethod
    def sanitize_string(input_str: str, max_length: int = 1000) -> str:
        """Sanitize string input"""
        if not input_str:
            return ""
        
        # Remove null bytes and control characters
        sanitized = ''.join(char for char in input_str if ord(char) >= 32 or char in ['\n', '\r', '\t'])
        
        # Limit length
        return sanitized[:max_length]
    
    @staticmethod
    def validate_image_data(image_data: str, max_size_mb: int = 10) -> bool:
        """Validate base64 image data"""
        try:
            decoded = base64.b64decode(image_data, validate=True)
            
            # Check size
            size_mb = len(decoded) / (1024 * 1024)
            if size_mb > max_size_mb:
                return False
            
            # Basic image format check
            if decoded.startswith((b'\x89PNG', b'\xff\xd8\xff', b'GIF8', b'RIFF')):
                return True
            
            return False
            
        except Exception:
            return False
    
    @staticmethod
    def validate_business_data(data: Dict[str, Any]) -> List[str]:
        """Validate business registration data"""
        errors = []
        
        required_fields = ['name', 'email', 'category', 'address']
        for field in required_fields:
            if not data.get(field):
                errors.append(f"{field} is required")
        
        if data.get('email') and not InputValidator.validate_email(data['email']):
            errors.append("Invalid email format")
        
        if data.get('phone') and not InputValidator.validate_phone(data['phone']):
            errors.append("Invalid phone number format")
        
        if data.get('latitude') is not None and data.get('longitude') is not None:
            if not InputValidator.validate_coordinates(data['latitude'], data['longitude']):
                errors.append("Invalid GPS coordinates")
        
        return errors


class APIKeyManager:
    """Manage API keys and rotation"""
    
    def __init__(self):
        self.api_keys = {}
        self.key_usage = defaultdict(int)
        self.key_creation_time = {}
        
    def generate_api_key(self, user_id: str, key_type: str = "standard") -> str:
        """Generate a new API key for a user"""
        import secrets
        
        key = f"{key_type}_{secrets.token_urlsafe(32)}"
        
        self.api_keys[key] = {
            "user_id": user_id,
            "type": key_type,
            "created_at": datetime.now(),
            "last_used": None,
            "usage_count": 0,
            "active": True
        }
        
        return key
    
    def validate_api_key(self, api_key: str) -> Optional[Dict[str, Any]]:
        """Validate API key and return user info"""
        key_info = self.api_keys.get(api_key)
        
        if not key_info or not key_info["active"]:
            return None
        
        key_info["last_used"] = datetime.now()
        key_info["usage_count"] += 1
        
        return key_info
    
    def rotate_api_key(self, old_key: str) -> Optional[str]:
        """Rotate an API key"""
        old_key_info = self.api_keys.get(old_key)
        if not old_key_info:
            return None
        
        new_key = self.generate_api_key(
            old_key_info["user_id"], 
            old_key_info["type"]
        )
        
        old_key_info["active"] = False
        old_key_info["rotated_at"] = datetime.now()
        
        return new_key
    
    def revoke_api_key(self, api_key: str) -> bool:
        """Revoke an API key"""
        key_info = self.api_keys.get(api_key)
        if key_info:
            key_info["active"] = False
            key_info["revoked_at"] = datetime.now()
            return True
        return False


# Global instances
security_middleware = None
input_validator = InputValidator()
api_key_manager = APIKeyManager()

def init_security_middleware(app, config: Dict[str, Any] = None):
    """Initialize security middleware"""
    global security_middleware
    security_middleware = SecurityMiddleware(app, config)
    return security_middleware