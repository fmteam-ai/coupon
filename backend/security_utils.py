import os
import time
import json
import hashlib
import base64
import re
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any
from collections import defaultdict, deque
from fastapi import Request, HTTPException, status
from dotenv import load_dotenv

load_dotenv()

class RateLimiter:
    """Simple in-memory rate limiter"""
    
    def __init__(self):
        self.requests = defaultdict(deque)
        self.blocked_ips = set()
        self.rate_limits = {
            "default": {"requests": 100, "window": 60},  # 100 requests per minute
            "auth": {"requests": 10, "window": 60},      # 10 auth attempts per minute
            "upload": {"requests": 20, "window": 60},    # 20 uploads per minute
            "search": {"requests": 50, "window": 60},    # 50 searches per minute
            "pricing": {"requests": 200, "window": 60},  # 200 pricing requests per minute
        }
    
    def get_client_ip(self, request: Request) -> str:
        """Extract client IP considering proxies"""
        # Check X-Forwarded-For header first
        forwarded_for = request.headers.get("X-Forwarded-For")
        if forwarded_for:
            return forwarded_for.split(",")[0].strip()
        
        # Check X-Real-IP header
        real_ip = request.headers.get("X-Real-IP")
        if real_ip:
            return real_ip.strip()
        
        # Fall back to client IP
        return request.client.host if request.client else "unknown"
    
    def check_rate_limit(self, request: Request) -> bool:
        """Check if request should be rate limited"""
        client_ip = self.get_client_ip(request)
        path = request.url.path
        
        # Skip rate limiting for some paths
        if path in ["/", "/health", "/docs", "/openapi.json"]:
            return False
        
        # Determine category
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
        rate_key = f"{client_ip}:{category}"
        current_time = time.time()
        window_start = current_time - rate_config["window"]
        
        # Clean old entries
        while (self.requests[rate_key] and 
               self.requests[rate_key][0] < window_start):
            self.requests[rate_key].popleft()
        
        # Check if limit exceeded
        if len(self.requests[rate_key]) >= rate_config["requests"]:
            # Add to blocked IPs temporarily
            self.blocked_ips.add(client_ip)
            return True
        
        # Add current request
        self.requests[rate_key].append(current_time)
        
        return False
    
    def is_blocked(self, request: Request) -> bool:
        """Check if IP is blocked"""
        client_ip = self.get_client_ip(request)
        return client_ip in self.blocked_ips


class SecurityValidator:
    """Input validation and security checks"""
    
    def __init__(self):
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
    
    def validate_email(self, email: str) -> bool:
        """Validate email format"""
        pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
        return re.match(pattern, email) is not None
    
    def validate_phone(self, phone: str) -> bool:
        """Validate phone number format"""
        clean_phone = re.sub(r'[^\d+]', '', phone)
        pattern = r'^\+?[1-9]\d{9,14}$'
        return re.match(pattern, clean_phone) is not None
    
    def validate_coordinates(self, lat: float, lng: float) -> bool:
        """Validate GPS coordinates"""
        return (-90 <= lat <= 90) and (-180 <= lng <= 180)
    
    def sanitize_string(self, input_str: str, max_length: int = 1000) -> str:
        """Sanitize string input"""
        if not input_str:
            return ""
        
        # Remove null bytes and control characters
        sanitized = ''.join(char for char in input_str if ord(char) >= 32 or char in ['\n', '\r', '\t'])
        
        # Limit length
        return sanitized[:max_length]
    
    def check_suspicious_content(self, content: str) -> bool:
        """Check content for suspicious patterns"""
        if not content:
            return False
        
        for pattern in self.suspicious_patterns:
            if pattern.search(content):
                return True
        
        return False
    
    def validate_image_data(self, image_data: str, max_size_mb: int = 10) -> bool:
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
    
    def validate_request_size(self, request: Request) -> bool:
        """Check if request size is within limits"""
        content_length = request.headers.get("content-length")
        if content_length:
            try:
                size = int(content_length)
                # Different limits for different endpoints
                if "/cv/" in request.url.path:  # Computer vision endpoints
                    max_size = 10 * 1024 * 1024  # 10MB for images
                else:
                    max_size = 1 * 1024 * 1024   # 1MB for regular requests
                
                return size <= max_size
            except ValueError:
                return True
        
        return True


class SecurityHeaders:
    """Add security headers to responses"""
    
    @staticmethod
    def get_security_headers() -> Dict[str, str]:
        """Get standard security headers"""
        return {
            "X-Content-Type-Options": "nosniff",
            "X-Frame-Options": "DENY",
            "X-XSS-Protection": "1; mode=block",
            "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
            "Content-Security-Policy": "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'",
            "Referrer-Policy": "strict-origin-when-cross-origin",
            "Permissions-Policy": "geolocation=(), microphone=(), camera=()"
        }


class SecurityLogger:
    """Security event logging"""
    
    @staticmethod
    def log_security_event(event_type: str, request: Request, details: Dict[str, Any] = None):
        """Log security events"""
        log_entry = {
            "timestamp": datetime.now().isoformat(),
            "event_type": event_type,
            "ip": request.client.host if request.client else "unknown",
            "method": request.method,
            "path": str(request.url.path),
            "user_agent": request.headers.get("user-agent", "unknown"),
            "details": details or {}
        }
        
        # In production, this should go to a proper logging system
        print(f"SECURITY EVENT: {json.dumps(log_entry, indent=2)}")
    
    @staticmethod
    def log_suspicious_activity(request: Request, reason: str):
        """Log suspicious activity"""
        SecurityLogger.log_security_event("suspicious_activity", request, {"reason": reason})
    
    @staticmethod
    def log_rate_limit_exceeded(request: Request):
        """Log rate limit violations"""
        SecurityLogger.log_security_event("rate_limit_exceeded", request)
    
    @staticmethod
    def log_blocked_request(request: Request, reason: str):
        """Log blocked requests"""
        SecurityLogger.log_security_event("blocked_request", request, {"reason": reason})


# Create global instances
rate_limiter = RateLimiter()
security_validator = SecurityValidator()
security_headers = SecurityHeaders()
security_logger = SecurityLogger()

# Decorator for applying security checks
def apply_security_checks(func):
    """Decorator to apply security checks to endpoints"""
    from functools import wraps
    
    @wraps(func)
    async def wrapper(*args, **kwargs):
        # Extract request from args/kwargs
        request = None
        for arg in args:
            if isinstance(arg, Request):
                request = arg
                break
        
        if not request:
            # Look in kwargs
            request = kwargs.get('request')
        
        if request:
            # 1. Check if IP is blocked
            if rate_limiter.is_blocked(request):
                security_logger.log_blocked_request(request, "IP blocked")
                raise HTTPException(
                    status_code=429,
                    detail="IP temporarily blocked due to suspicious activity"
                )
            
            # 2. Check rate limits
            if rate_limiter.check_rate_limit(request):
                security_logger.log_rate_limit_exceeded(request)
                raise HTTPException(
                    status_code=429,
                    detail="Rate limit exceeded. Please try again later."
                )
            
            # 3. Check request size
            if not security_validator.validate_request_size(request):
                security_logger.log_blocked_request(request, "Request too large")
                raise HTTPException(
                    status_code=413,
                    detail="Request payload too large"
                )
            
            # 4. Check for suspicious patterns in URL
            if security_validator.check_suspicious_content(str(request.url)):
                security_logger.log_suspicious_activity(request, "Suspicious URL pattern")
                raise HTTPException(
                    status_code=400,
                    detail="Invalid request format"
                )
        
        # Call the original function
        return await func(*args, **kwargs)
    
    return wrapper

# Input validation helpers
def validate_business_input(data: Dict[str, Any]) -> List[str]:
    """Validate business registration data"""
    errors = []
    
    required_fields = ['name', 'email', 'category', 'address']
    for field in required_fields:
        if not data.get(field):
            errors.append(f"{field} is required")
    
    if data.get('email') and not security_validator.validate_email(data['email']):
        errors.append("Invalid email format")
    
    if data.get('phone') and not security_validator.validate_phone(data['phone']):
        errors.append("Invalid phone number format")
    
    if data.get('latitude') is not None and data.get('longitude') is not None:
        if not security_validator.validate_coordinates(data['latitude'], data['longitude']):
            errors.append("Invalid GPS coordinates")
    
    return errors

def validate_image_input(image_data: str, max_size_mb: int = 10) -> bool:
    """Validate image data input"""
    return security_validator.validate_image_data(image_data, max_size_mb)

def sanitize_text_input(text: str, max_length: int = 1000) -> str:
    """Sanitize text input"""
    return security_validator.sanitize_string(text, max_length)