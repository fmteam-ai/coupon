import os
import json
import hashlib
import base64
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any, Union
from enum import Enum
from dotenv import load_dotenv
from pymongo import MongoClient
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
import secrets

load_dotenv()

class DataClassification(Enum):
    """Data classification levels"""
    PUBLIC = "public"
    INTERNAL = "internal"
    CONFIDENTIAL = "confidential"
    RESTRICTED = "restricted"

class ConsentType(Enum):
    """GDPR consent types"""
    MARKETING = "marketing"
    ANALYTICS = "analytics"
    PERSONALIZATION = "personalization"
    LOCATION_TRACKING = "location_tracking"
    BEHAVIORAL_ANALYSIS = "behavioral_analysis"

class DataProtectionManager:
    """Data protection, encryption, and GDPR compliance manager"""
    
    def __init__(self):
        self.mongo_url = os.getenv("MONGO_URL")
        self.client = MongoClient(self.mongo_url)
        self.db = self.client.coupon_app
        
        # Encryption configuration
        self.master_key = os.getenv("MASTER_ENCRYPTION_KEY", "your-master-key-change-in-production").encode()
        self.salt = os.getenv("ENCRYPTION_SALT", "your-salt-change-in-production").encode()
        
        # Initialize encryption
        self.cipher_suite = self._generate_cipher_suite()
        
        # PII fields that need encryption
        self.pii_fields = {
            'email', 'phone', 'full_name', 'address', 'payment_info',
            'bank_details', 'social_security', 'passport', 'license'
        }
        
        # Fields that need anonymization for analytics
        self.anonymize_fields = {
            'ip_address', 'device_id', 'session_id', 'user_agent'
        }
        
        # Initialize collections and indexes
        self._ensure_indexes()
    
    def _generate_cipher_suite(self) -> Fernet:
        """Generate cipher suite for encryption/decryption"""
        try:
            kdf = PBKDF2HMAC(
                algorithm=hashes.SHA256(),
                length=32,
                salt=self.salt,
                iterations=100000,
            )
            key = base64.urlsafe_b64encode(kdf.derive(self.master_key))
            return Fernet(key)
        except Exception as e:
            print(f"Cipher suite generation error: {e}")
            # Fallback to simple key (not recommended for production)
            key = base64.urlsafe_b64encode(self.master_key[:32].ljust(32, b'0'))
            return Fernet(key)
    
    def _ensure_indexes(self):
        """Ensure database indexes for data protection"""
        try:
            self.db.consent_records.create_index("user_id")
            self.db.consent_records.create_index("consent_type")
            self.db.data_requests.create_index("user_id")
            self.db.data_requests.create_index("request_type")
            self.db.audit_logs.create_index("user_id")
            self.db.audit_logs.create_index("timestamp")
            self.db.encrypted_data.create_index("data_id", unique=True)
        except Exception as e:
            print(f"Index creation error: {e}")
    
    def encrypt_field(self, value: str) -> str:
        """Encrypt a single field value"""
        try:
            if not value:
                return value
            
            encrypted_bytes = self.cipher_suite.encrypt(value.encode())
            return base64.b64encode(encrypted_bytes).decode()
        except Exception as e:
            print(f"Field encryption error: {e}")
            return value
    
    def decrypt_field(self, encrypted_value: str) -> str:
        """Decrypt a single field value"""
        try:
            if not encrypted_value:
                return encrypted_value
            
            encrypted_bytes = base64.b64decode(encrypted_value.encode())
            decrypted_bytes = self.cipher_suite.decrypt(encrypted_bytes)
            return decrypted_bytes.decode()
        except Exception as e:
            print(f"Field decryption error: {e}")
            return encrypted_value
    
    def encrypt_pii_data(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Encrypt PII fields in data dictionary"""
        try:
            encrypted_data = data.copy()
            
            for field in self.pii_fields:
                if field in encrypted_data and encrypted_data[field]:
                    encrypted_data[field] = self.encrypt_field(str(encrypted_data[field]))
                    encrypted_data[f"{field}_encrypted"] = True
            
            return encrypted_data
        except Exception as e:
            print(f"PII encryption error: {e}")
            return data
    
    def decrypt_pii_data(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Decrypt PII fields in data dictionary"""
        try:
            decrypted_data = data.copy()
            
            for field in self.pii_fields:
                if field in decrypted_data and decrypted_data.get(f"{field}_encrypted"):
                    decrypted_data[field] = self.decrypt_field(decrypted_data[field])
                    del decrypted_data[f"{field}_encrypted"]
            
            return decrypted_data
        except Exception as e:
            print(f"PII decryption error: {e}")
            return data
    
    def anonymize_data(self, data: Dict[str, Any], user_id: str = None) -> Dict[str, Any]:
        """Anonymize data for analytics purposes"""
        try:
            anonymized_data = data.copy()
            
            # Replace identifiable fields with hashed versions
            for field in self.anonymize_fields:
                if field in anonymized_data:
                    original_value = str(anonymized_data[field])
                    hash_input = f"{original_value}_{user_id}_{self.salt.decode()}"
                    hashed_value = hashlib.sha256(hash_input.encode()).hexdigest()[:16]
                    anonymized_data[field] = f"anon_{hashed_value}"
            
            # Remove direct identifiers
            identifiers_to_remove = ['user_id', 'email', 'phone', 'full_name']
            for identifier in identifiers_to_remove:
                if identifier in anonymized_data:
                    del anonymized_data[identifier]
            
            # Add anonymization metadata
            anonymized_data['_anonymized'] = True
            anonymized_data['_anonymized_at'] = datetime.utcnow().isoformat()
            
            return anonymized_data
        except Exception as e:
            print(f"Data anonymization error: {e}")
            return data
    
    def store_encrypted_data(self, data_id: str, data: Dict[str, Any], classification: DataClassification) -> bool:
        """Store encrypted data with classification"""
        try:
            encrypted_data = self.encrypt_pii_data(data)
            
            storage_record = {
                "data_id": data_id,
                "encrypted_data": encrypted_data,
                "classification": classification.value,
                "created_at": datetime.utcnow(),
                "last_accessed": datetime.utcnow(),
                "access_count": 0
            }
            
            self.db.encrypted_data.insert_one(storage_record)
            return True
        except Exception as e:
            print(f"Encrypted data storage error: {e}")
            return False
    
    def retrieve_encrypted_data(self, data_id: str, user_id: str = None) -> Optional[Dict[str, Any]]:
        """Retrieve and decrypt data"""
        try:
            record = self.db.encrypted_data.find_one({"data_id": data_id})
            if not record:
                return None
            
            # Update access tracking
            self.db.encrypted_data.update_one(
                {"data_id": data_id},
                {
                    "$set": {"last_accessed": datetime.utcnow()},
                    "$inc": {"access_count": 1}
                }
            )
            
            # Log data access
            if user_id:
                self._log_data_access(user_id, data_id, "retrieve")
            
            # Decrypt and return data
            decrypted_data = self.decrypt_pii_data(record["encrypted_data"])
            return decrypted_data
        except Exception as e:
            print(f"Encrypted data retrieval error: {e}")
            return None
    
    def record_consent(self, user_id: str, consent_type: ConsentType, granted: bool, 
                      ip_address: str = None, user_agent: str = None) -> bool:
        """Record user consent for GDPR compliance"""
        try:
            consent_record = {
                "user_id": user_id,
                "consent_type": consent_type.value,
                "granted": granted,
                "timestamp": datetime.utcnow(),
                "ip_address": ip_address,
                "user_agent": user_agent,
                "version": "1.0",  # Consent version for tracking changes
                "expires_at": datetime.utcnow() + timedelta(days=365) if granted else None
            }
            
            # Update existing consent or create new
            self.db.consent_records.update_one(
                {"user_id": user_id, "consent_type": consent_type.value},
                {"$set": consent_record},
                upsert=True
            )
            
            # Log consent change
            self._log_audit_event(user_id, "consent_change", {
                "consent_type": consent_type.value,
                "granted": granted,
                "ip_address": ip_address
            })
            
            return True
        except Exception as e:
            print(f"Consent recording error: {e}")
            return False
    
    def get_user_consent(self, user_id: str) -> Dict[str, Any]:
        """Get all consent records for a user"""
        try:
            consents = list(self.db.consent_records.find({"user_id": user_id}))
            
            consent_status = {}
            for consent in consents:
                consent_type = consent["consent_type"]
                consent_status[consent_type] = {
                    "granted": consent["granted"],
                    "timestamp": consent["timestamp"],
                    "expires_at": consent.get("expires_at"),
                    "version": consent.get("version", "1.0")
                }
            
            return {
                "user_id": user_id,
                "consents": consent_status,
                "last_updated": max([c["timestamp"] for c in consents]) if consents else None
            }
        except Exception as e:
            print(f"Get consent error: {e}")
            return {"user_id": user_id, "consents": {}}
    
    def check_consent(self, user_id: str, consent_type: ConsentType) -> bool:
        """Check if user has granted specific consent"""
        try:
            consent = self.db.consent_records.find_one({
                "user_id": user_id,
                "consent_type": consent_type.value,
                "granted": True
            })
            
            if not consent:
                return False
            
            # Check if consent has expired
            if consent.get("expires_at") and consent["expires_at"] < datetime.utcnow():
                return False
            
            return True
        except Exception as e:
            print(f"Consent check error: {e}")
            return False
    
    def create_data_export(self, user_id: str) -> Dict[str, Any]:
        """Create data export for GDPR data portability"""
        try:
            export_data = {
                "user_id": user_id,
                "export_timestamp": datetime.utcnow(),
                "data": {}
            }
            
            # Export user profile data
            user_data = self.db.users.find_one({"id": user_id})
            if user_data:
                # Decrypt PII data for export
                user_data = self.decrypt_pii_data(user_data)
                export_data["data"]["profile"] = user_data
            
            # Export business data (if applicable)
            business_data = list(self.db.businesses.find({"owner_id": user_id}))
            if business_data:
                export_data["data"]["businesses"] = [self.decrypt_pii_data(b) for b in business_data]
            
            # Export coupon usage history
            usage_data = list(self.db.coupon_usage.find({"user_id": user_id}))
            export_data["data"]["coupon_usage"] = usage_data
            
            # Export ratings and reviews
            ratings_data = list(self.db.ratings.find({"user_id": user_id}))
            export_data["data"]["ratings"] = ratings_data
            
            # Export consent records
            consent_data = self.get_user_consent(user_id)
            export_data["data"]["consents"] = consent_data
            
            # Export social data
            social_data = list(self.db.social_activities.find({"user_id": user_id}))
            export_data["data"]["social_activities"] = social_data
            
            # Log data export
            self._log_audit_event(user_id, "data_export", {"export_size": len(json.dumps(export_data))})
            
            return export_data
        except Exception as e:
            print(f"Data export error: {e}")
            return {"error": str(e)}
    
    def delete_user_data(self, user_id: str, reason: str = "user_request") -> Dict[str, Any]:
        """Delete user data for GDPR right to erasure"""
        try:
            deletion_log = {
                "user_id": user_id,
                "deletion_timestamp": datetime.utcnow(),
                "reason": reason,
                "deleted_collections": [],
                "anonymized_collections": []
            }
            
            # Collections to completely delete
            delete_collections = [
                "users", "user_profiles", "user_sessions", "consent_records",
                "mfa_secrets", "refresh_tokens", "password_reset_tokens"
            ]
            
            # Collections to anonymize (keep for business purposes)
            anonymize_collections = [
                "coupon_usage", "ratings", "social_activities", "receipt_scans",
                "visual_searches", "ar_interactions"
            ]
            
            # Delete personal data
            for collection in delete_collections:
                result = self.db[collection].delete_many({"user_id": user_id})
                if result.deleted_count > 0:
                    deletion_log["deleted_collections"].append({
                        "collection": collection,
                        "deleted_count": result.deleted_count
                    })
            
            # Anonymize transactional data
            for collection in anonymize_collections:
                # Replace user_id with anonymized version
                anon_user_id = self._generate_anonymous_id(user_id)
                result = self.db[collection].update_many(
                    {"user_id": user_id},
                    {
                        "$set": {
                            "user_id": anon_user_id,
                            "_anonymized": True,
                            "_anonymized_at": datetime.utcnow()
                        }
                    }
                )
                if result.modified_count > 0:
                    deletion_log["anonymized_collections"].append({
                        "collection": collection,
                        "anonymized_count": result.modified_count
                    })
            
            # Handle business ownership transfer
            businesses = list(self.db.businesses.find({"owner_id": user_id}))
            if businesses:
                # Mark businesses as having deleted owner
                self.db.businesses.update_many(
                    {"owner_id": user_id},
                    {
                        "$set": {
                            "owner_id": "deleted_user",
                            "owner_deleted_at": datetime.utcnow()
                        }
                    }
                )
                deletion_log["business_transfer"] = len(businesses)
            
            # Log deletion
            self._log_audit_event(user_id, "data_deletion", deletion_log)
            
            return {
                "success": True,
                "deletion_log": deletion_log,
                "message": "User data deleted and anonymized successfully"
            }
        except Exception as e:
            print(f"Data deletion error: {e}")
            return {"success": False, "error": str(e)}
    
    def _generate_anonymous_id(self, user_id: str) -> str:
        """Generate anonymous ID for deleted users"""
        hash_input = f"anon_{user_id}_{self.salt.decode()}"
        return f"anon_{hashlib.sha256(hash_input.encode()).hexdigest()[:16]}"
    
    def create_data_request(self, user_id: str, request_type: str, details: str = None) -> str:
        """Create data request (export, deletion, rectification)"""
        try:
            request_id = secrets.token_urlsafe(16)
            
            request_record = {
                "request_id": request_id,
                "user_id": user_id,
                "request_type": request_type,
                "details": details,
                "status": "pending",
                "created_at": datetime.utcnow(),
                "processed_at": None,
                "result": None
            }
            
            self.db.data_requests.insert_one(request_record)
            
            # Log request creation
            self._log_audit_event(user_id, "data_request_created", {
                "request_id": request_id,
                "request_type": request_type
            })
            
            return request_id
        except Exception as e:
            print(f"Data request creation error: {e}")
            return ""
    
    def process_data_request(self, request_id: str) -> Dict[str, Any]:
        """Process data request"""
        try:
            request = self.db.data_requests.find_one({"request_id": request_id})
            if not request:
                return {"error": "Request not found"}
            
            user_id = request["user_id"]
            request_type = request["request_type"]
            
            result = {}
            
            if request_type == "export":
                result = self.create_data_export(user_id)
            elif request_type == "deletion":
                result = self.delete_user_data(user_id)
            elif request_type == "rectification":
                result = {"message": "Rectification request received. Manual review required."}
            else:
                result = {"error": "Unknown request type"}
            
            # Update request status
            self.db.data_requests.update_one(
                {"request_id": request_id},
                {
                    "$set": {
                        "status": "completed" if "error" not in result else "failed",
                        "processed_at": datetime.utcnow(),
                        "result": result
                    }
                }
            )
            
            return result
        except Exception as e:
            print(f"Data request processing error: {e}")
            return {"error": str(e)}
    
    def get_data_requests(self, user_id: str) -> List[Dict[str, Any]]:
        """Get data requests for user"""
        try:
            requests = list(self.db.data_requests.find({"user_id": user_id}))
            
            # Format requests for response
            formatted_requests = []
            for req in requests:
                formatted_requests.append({
                    "request_id": req["request_id"],
                    "request_type": req["request_type"],
                    "status": req["status"],
                    "created_at": req["created_at"],
                    "processed_at": req.get("processed_at"),
                    "details": req.get("details")
                })
            
            return formatted_requests
        except Exception as e:
            print(f"Get data requests error: {e}")
            return []
    
    def _log_data_access(self, user_id: str, data_id: str, action: str):
        """Log data access for audit purposes"""
        try:
            self.db.data_access_logs.insert_one({
                "user_id": user_id,
                "data_id": data_id,
                "action": action,
                "timestamp": datetime.utcnow(),
                "ip_address": None,  # Should be passed from request context
                "user_agent": None   # Should be passed from request context
            })
        except Exception as e:
            print(f"Data access logging error: {e}")
    
    def _log_audit_event(self, user_id: str, event_type: str, details: Dict[str, Any]):
        """Log audit event"""
        try:
            self.db.audit_logs.insert_one({
                "user_id": user_id,
                "event_type": event_type,
                "details": details,
                "timestamp": datetime.utcnow()
            })
        except Exception as e:
            print(f"Audit logging error: {e}")
    
    def get_audit_log(self, user_id: str, limit: int = 100) -> List[Dict[str, Any]]:
        """Get audit log for user"""
        try:
            logs = list(self.db.audit_logs.find(
                {"user_id": user_id}
            ).sort("timestamp", -1).limit(limit))
            
            return logs
        except Exception as e:
            print(f"Get audit log error: {e}")
            return []
    
    def get_data_retention_info(self) -> Dict[str, Any]:
        """Get data retention policies"""
        return {
            "retention_policies": {
                "user_data": "Account deletion + 30 days",
                "transaction_data": "7 years (anonymized after 2 years)",
                "audit_logs": "7 years",
                "consent_records": "3 years after withdrawal",
                "marketing_data": "Until consent withdrawal",
                "analytics_data": "2 years (anonymized)"
            },
            "anonymization_schedule": {
                "user_behavior": "After 2 years of inactivity",
                "transaction_history": "After 2 years",
                "location_data": "After 1 year",
                "device_data": "After 6 months"
            },
            "deletion_schedule": {
                "expired_sessions": "Daily",
                "expired_tokens": "Daily", 
                "old_audit_logs": "After 7 years",
                "withdrawn_consents": "After 3 years"
            }
        }
    
    def cleanup_expired_data(self):
        """Cleanup expired data based on retention policies"""
        try:
            now = datetime.utcnow()
            
            # Delete expired consent records (withdrawn consents older than 3 years)
            three_years_ago = now - timedelta(days=3*365)
            self.db.consent_records.delete_many({
                "granted": False,
                "timestamp": {"$lt": three_years_ago}
            })
            
            # Anonymize old transaction data (older than 2 years)
            two_years_ago = now - timedelta(days=2*365)
            
            # Anonymize old coupon usage
            old_usage = self.db.coupon_usage.find({
                "used_at": {"$lt": two_years_ago},
                "_anonymized": {"$ne": True}
            })
            
            for usage in old_usage:
                anonymized = self.anonymize_data(usage, usage.get("user_id"))
                self.db.coupon_usage.replace_one({"_id": usage["_id"]}, anonymized)
            
            print("Data cleanup completed")
        except Exception as e:
            print(f"Data cleanup error: {e}")

# Global instance
data_protection_manager = DataProtectionManager()