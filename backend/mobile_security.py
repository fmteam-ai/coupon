import os
import json
import hashlib
import base64
import secrets
import ssl
import socket
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any, Tuple
from enum import Enum
from dotenv import load_dotenv
from pymongo import MongoClient
import requests
from cryptography import x509
from cryptography.hazmat.backends import default_backend
import re

load_dotenv()

class DeviceRiskLevel(Enum):
    """Device risk assessment levels"""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"

class SecurityThreat(Enum):
    """Mobile security threats"""
    JAILBREAK = "jailbreak"
    ROOT = "root"
    EMULATOR = "emulator"
    DEBUGGER = "debugger"
    HOOKING = "hooking"
    TAMPERING = "tampering"
    MALWARE = "malware"
    UNTRUSTED_NETWORK = "untrusted_network"

class MobileSecurityManager:
    """Mobile security manager for app protection"""
    
    def __init__(self):
        self.mongo_url = os.getenv("MONGO_URL")
        self.client = MongoClient(self.mongo_url)
        self.db = self.client.coupon_app
        
        # Certificate pinning configuration
        self.api_domain = os.getenv("API_DOMAIN", "api.couponapp.com")
        self.pinned_certificates = self._load_certificate_pins()
        
        # Device security configuration
        self.max_device_risk_score = 70  # Out of 100
        self.security_check_interval = 300  # 5 minutes
        
        # Anti-tampering configuration
        self.app_signature = os.getenv("APP_SIGNATURE_HASH", "")
        self.integrity_checks = True
        
        # Initialize collections
        self._ensure_indexes()
    
    def _ensure_indexes(self):
        """Ensure database indexes for mobile security"""
        try:
            self.db.device_fingerprints.create_index("device_id", unique=True)
            self.db.security_violations.create_index("device_id")
            self.db.security_violations.create_index("timestamp")
            self.db.certificate_pins.create_index("domain")
            self.db.device_attestations.create_index("device_id")
            self.db.security_policies.create_index("policy_name", unique=True)
        except Exception as e:
            print(f"Mobile security index creation error: {e}")
    
    def _load_certificate_pins(self) -> Dict[str, List[str]]:
        """Load certificate pins for domains"""
        try:
            # In production, load from secure configuration
            return {
                self.api_domain: [
                    "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=",  # Replace with actual pin
                    "BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB="   # Backup pin
                ]
            }
        except Exception as e:
            print(f"Certificate pin loading error: {e}")
            return {}
    
    def generate_device_fingerprint(self, device_info: Dict[str, Any]) -> str:
        """Generate unique device fingerprint"""
        try:
            # Combine device characteristics
            fingerprint_data = {
                "model": device_info.get("model", ""),
                "brand": device_info.get("brand", ""),
                "os_version": device_info.get("os_version", ""),
                "screen_resolution": device_info.get("screen_resolution", ""),
                "timezone": device_info.get("timezone", ""),
                "language": device_info.get("language", ""),
                "carrier": device_info.get("carrier", ""),
                "unique_id": device_info.get("unique_id", "")
            }
            
            # Create hash
            fingerprint_string = json.dumps(fingerprint_data, sort_keys=True)
            fingerprint_hash = hashlib.sha256(fingerprint_string.encode()).hexdigest()
            
            return fingerprint_hash[:32]  # Truncate for usability
            
        except Exception as e:
            print(f"Device fingerprint generation error: {e}")
            return secrets.token_hex(16)
    
    def register_device(self, user_id: str, device_info: Dict[str, Any]) -> Dict[str, Any]:
        """Register and assess device security"""
        try:
            device_fingerprint = self.generate_device_fingerprint(device_info)
            
            # Perform security assessment
            risk_assessment = self.assess_device_risk(device_info)
            
            # Check for security violations
            security_status = self.check_device_security(device_info)
            
            device_record = {
                "device_id": device_fingerprint,
                "user_id": user_id,
                "device_info": device_info,
                "risk_assessment": risk_assessment,
                "security_status": security_status,
                "first_seen": datetime.utcnow(),
                "last_seen": datetime.utcnow(),
                "is_trusted": risk_assessment["risk_level"] in ["low", "medium"],
                "violation_count": 0,
                "attestation_status": "pending"
            }
            
            # Store device record
            self.db.device_fingerprints.update_one(
                {"device_id": device_fingerprint},
                {"$set": device_record},
                upsert=True
            )
            
            # Generate device certificate for secure communication
            device_cert = self.generate_device_certificate(device_fingerprint)
            
            return {
                "success": True,
                "device_id": device_fingerprint,
                "risk_level": risk_assessment["risk_level"],
                "is_trusted": device_record["is_trusted"],
                "security_status": security_status,
                "device_certificate": device_cert,
                "certificate_pins": self.get_certificate_pins(),
                "security_policies": self.get_security_policies()
            }
            
        except Exception as e:
            print(f"Device registration error: {e}")
            return {"success": False, "error": str(e)}
    
    def assess_device_risk(self, device_info: Dict[str, Any]) -> Dict[str, Any]:
        """Assess device security risk"""
        try:
            risk_score = 0
            risk_factors = []
            
            # Check for jailbreak/root indicators
            if self._check_jailbreak_root(device_info):
                risk_score += 40
                risk_factors.append("Device appears to be jailbroken/rooted")
            
            # Check for emulator
            if self._check_emulator(device_info):
                risk_score += 30
                risk_factors.append("Running on emulator")
            
            # Check for debugging
            if device_info.get("debug_enabled", False):
                risk_score += 20
                risk_factors.append("Debug mode enabled")
            
            # Check OS version
            if self._check_outdated_os(device_info):
                risk_score += 15
                risk_factors.append("Outdated operating system")
            
            # Check for suspicious apps
            suspicious_apps = self._check_suspicious_apps(device_info)
            if suspicious_apps:
                risk_score += len(suspicious_apps) * 5
                risk_factors.append(f"Suspicious apps detected: {len(suspicious_apps)}")
            
            # Check network security
            if self._check_untrusted_network(device_info):
                risk_score += 10
                risk_factors.append("Connected to untrusted network")
            
            # Determine risk level
            if risk_score >= 70:
                risk_level = DeviceRiskLevel.CRITICAL
            elif risk_score >= 50:
                risk_level = DeviceRiskLevel.HIGH
            elif risk_score >= 30:
                risk_level = DeviceRiskLevel.MEDIUM
            else:
                risk_level = DeviceRiskLevel.LOW
            
            return {
                "risk_score": risk_score,
                "risk_level": risk_level.value,
                "risk_factors": risk_factors,
                "assessment_timestamp": datetime.utcnow()
            }
            
        except Exception as e:
            print(f"Device risk assessment error: {e}")
            return {"risk_score": 0, "risk_level": "low", "risk_factors": []}
    
    def _check_jailbreak_root(self, device_info: Dict[str, Any]) -> bool:
        """Check for jailbreak/root indicators"""
        try:
            # iOS jailbreak indicators
            ios_jailbreak_paths = [
                "/Applications/Cydia.app",
                "/usr/sbin/sshd",
                "/etc/apt",
                "/private/var/lib/apt/",
                "/private/var/lib/cydia",
                "/private/var/mobile/Library/SBSettings/Themes",
                "/System/Library/LaunchDaemons/com.ikey.bbot.plist",
                "/usr/libexec/ssh-keysign",
                "/usr/sbin/sshd",
                "/usr/bin/sshd",
                "/bin/bash",
                "/etc/ssh/sshd_config"
            ]
            
            # Android root indicators
            android_root_paths = [
                "/system/app/Superuser.apk",
                "/sbin/su",
                "/system/bin/su",
                "/system/xbin/su",
                "/data/local/xbin/su",
                "/data/local/bin/su",
                "/system/sd/xbin/su",
                "/system/bin/failsafe/su",
                "/data/local/su",
                "/su/bin/su"
            ]
            
            # Check for suspicious paths
            device_paths = device_info.get("installed_paths", [])
            platform = device_info.get("platform", "").lower()
            
            if platform == "ios":
                return any(path in device_paths for path in ios_jailbreak_paths)
            elif platform == "android":
                return any(path in device_paths for path in android_root_paths)
            
            # Check for root/jailbreak apps
            installed_apps = device_info.get("installed_apps", [])
            suspicious_apps = [
                "cydia", "superuser", "kingroot", "framaroot", "towelroot",
                "substrato", "ifile", "mobileterminal", "sbsettings"
            ]
            
            return any(app.lower() in [ia.lower() for ia in installed_apps] for app in suspicious_apps)
            
        except Exception as e:
            print(f"Jailbreak/root check error: {e}")
            return False
    
    def _check_emulator(self, device_info: Dict[str, Any]) -> bool:
        """Check if running on emulator"""
        try:
            # Emulator indicators
            emulator_indicators = {
                "model": ["sdk", "emulator", "simulator", "android sdk built for x86"],
                "brand": ["generic", "unknown"],
                "manufacturer": ["genymotion", "generic", "unknown"],
                "hardware": ["goldfish", "ranchu", "vbox"],
                "product": ["sdk", "google_sdk", "sdk_phone", "sdk_x86"]
            }
            
            for key, indicators in emulator_indicators.items():
                device_value = device_info.get(key, "").lower()
                if any(indicator in device_value for indicator in indicators):
                    return True
            
            # Check for emulator-specific properties
            if device_info.get("is_emulator", False):
                return True
            
            return False
            
        except Exception as e:
            print(f"Emulator check error: {e}")
            return False
    
    def _check_outdated_os(self, device_info: Dict[str, Any]) -> bool:
        """Check for outdated operating system"""
        try:
            platform = device_info.get("platform", "").lower()
            os_version = device_info.get("os_version", "")
            
            if platform == "ios":
                # Check iOS version (consider versions older than iOS 14 as outdated)
                version_match = re.match(r'(\d+)', os_version)
                if version_match:
                    major_version = int(version_match.group(1))
                    return major_version < 14
            
            elif platform == "android":
                # Check Android API level (consider API < 26 as outdated)
                api_level = device_info.get("api_level", 0)
                return api_level < 26
            
            return False
            
        except Exception as e:
            print(f"OS version check error: {e}")
            return False
    
    def _check_suspicious_apps(self, device_info: Dict[str, Any]) -> List[str]:
        """Check for suspicious applications"""
        try:
            installed_apps = device_info.get("installed_apps", [])
            
            # List of suspicious app patterns
            suspicious_patterns = [
                "frida", "xposed", "lucky", "freedom", "game killer",
                "creehack", "leo playcard", "creeehack", "cheat engine",
                "substrate", "cycript", "ssl kill switch", "charles proxy"
            ]
            
            suspicious_found = []
            for app in installed_apps:
                app_lower = app.lower()
                for pattern in suspicious_patterns:
                    if pattern in app_lower:
                        suspicious_found.append(app)
                        break
            
            return suspicious_found
            
        except Exception as e:
            print(f"Suspicious apps check error: {e}")
            return []
    
    def _check_untrusted_network(self, device_info: Dict[str, Any]) -> bool:
        """Check for untrusted network connection"""
        try:
            network_info = device_info.get("network", {})
            
            # Check for public WiFi
            if network_info.get("connection_type") == "wifi":
                ssid = network_info.get("ssid", "").lower()
                # Common public WiFi patterns
                public_patterns = ["free", "public", "guest", "open", "hotel", "airport", "starbucks"]
                if any(pattern in ssid for pattern in public_patterns):
                    return True
            
            # Check for VPN (could be suspicious in some contexts)
            if network_info.get("vpn_active", False):
                return True
            
            # Check for proxy
            if network_info.get("proxy_active", False):
                return True
            
            return False
            
        except Exception as e:
            print(f"Network security check error: {e}")
            return False
    
    def check_device_security(self, device_info: Dict[str, Any]) -> Dict[str, Any]:
        """Comprehensive device security check"""
        try:
            security_checks = {
                "app_integrity": self._check_app_integrity(device_info),
                "certificate_validation": self._check_certificate_validation(device_info),
                "debugger_detection": self._check_debugger_attached(device_info),
                "hook_detection": self._check_runtime_hooks(device_info),
                "tamper_detection": self._check_app_tampering(device_info)
            }
            
            # Calculate overall security score
            passed_checks = sum(1 for check in security_checks.values() if check["status"] == "pass")
            total_checks = len(security_checks)
            security_score = (passed_checks / total_checks) * 100
            
            return {
                "security_score": security_score,
                "checks": security_checks,
                "overall_status": "secure" if security_score >= 80 else "at_risk",
                "timestamp": datetime.utcnow()
            }
            
        except Exception as e:
            print(f"Device security check error: {e}")
            return {"security_score": 0, "checks": {}, "overall_status": "unknown"}
    
    def _check_app_integrity(self, device_info: Dict[str, Any]) -> Dict[str, Any]:
        """Check application integrity"""
        try:
            app_signature = device_info.get("app_signature")
            
            if not app_signature or not self.app_signature:
                return {"status": "unknown", "message": "Signature not available"}
            
            if app_signature == self.app_signature:
                return {"status": "pass", "message": "App signature valid"}
            else:
                return {"status": "fail", "message": "App signature mismatch"}
                
        except Exception as e:
            return {"status": "error", "message": str(e)}
    
    def _check_certificate_validation(self, device_info: Dict[str, Any]) -> Dict[str, Any]:
        """Check certificate pinning status"""
        try:
            cert_validation = device_info.get("certificate_validation", {})
            
            if cert_validation.get("pinning_active", False):
                return {"status": "pass", "message": "Certificate pinning active"}
            else:
                return {"status": "fail", "message": "Certificate pinning not active"}
                
        except Exception as e:
            return {"status": "error", "message": str(e)}
    
    def _check_debugger_attached(self, device_info: Dict[str, Any]) -> Dict[str, Any]:
        """Check for attached debuggers"""
        try:
            debugger_attached = device_info.get("debugger_attached", False)
            
            if debugger_attached:
                return {"status": "fail", "message": "Debugger detected"}
            else:
                return {"status": "pass", "message": "No debugger detected"}
                
        except Exception as e:
            return {"status": "error", "message": str(e)}
    
    def _check_runtime_hooks(self, device_info: Dict[str, Any]) -> Dict[str, Any]:
        """Check for runtime manipulation/hooks"""
        try:
            hooks_detected = device_info.get("hooks_detected", False)
            
            if hooks_detected:
                return {"status": "fail", "message": "Runtime hooks detected"}
            else:
                return {"status": "pass", "message": "No runtime hooks detected"}
                
        except Exception as e:
            return {"status": "error", "message": str(e)}
    
    def _check_app_tampering(self, device_info: Dict[str, Any]) -> Dict[str, Any]:
        """Check for application tampering"""
        try:
            tamper_detected = device_info.get("tamper_detected", False)
            
            if tamper_detected:
                return {"status": "fail", "message": "App tampering detected"}
            else:
                return {"status": "pass", "message": "No tampering detected"}
                
        except Exception as e:
            return {"status": "error", "message": str(e)}
    
    def generate_device_certificate(self, device_id: str) -> str:
        """Generate device-specific certificate for secure communication"""
        try:
            # In production, generate proper X.509 certificates
            cert_data = {
                "device_id": device_id,
                "issued_at": datetime.utcnow().isoformat(),
                "expires_at": (datetime.utcnow() + timedelta(days=30)).isoformat(),
                "issuer": "CouponApp Mobile Security",
                "algorithm": "RS256"
            }
            
            # Create a simple token for now (replace with proper certificate in production)
            cert_string = json.dumps(cert_data, sort_keys=True)
            cert_hash = hashlib.sha256(cert_string.encode()).hexdigest()
            
            return base64.b64encode(f"{cert_string}.{cert_hash}".encode()).decode()
            
        except Exception as e:
            print(f"Device certificate generation error: {e}")
            return ""
    
    def get_certificate_pins(self) -> Dict[str, List[str]]:
        """Get certificate pins for the client"""
        return self.pinned_certificates
    
    def validate_certificate_pin(self, domain: str, presented_cert: str) -> bool:
        """Validate certificate pin"""
        try:
            domain_pins = self.pinned_certificates.get(domain, [])
            return presented_cert in domain_pins
        except Exception as e:
            print(f"Certificate pin validation error: {e}")
            return False
    
    def get_security_policies(self) -> Dict[str, Any]:
        """Get mobile security policies"""
        try:
            policies = self.db.security_policies.find_one({"policy_name": "mobile_security"})
            
            if not policies:
                # Default policies
                default_policies = {
                    "policy_name": "mobile_security",
                    "version": "1.0",
                    "policies": {
                        "require_device_lock": True,
                        "min_os_version": {"ios": "14.0", "android": "26"},
                        "allow_jailbroken_devices": False,
                        "allow_emulators": False,
                        "require_app_store_install": True,
                        "certificate_pinning_required": True,
                        "max_failed_attempts": 5,
                        "session_timeout_minutes": 30,
                        "require_biometric_auth": False
                    },
                    "created_at": datetime.utcnow(),
                    "updated_at": datetime.utcnow()
                }
                
                self.db.security_policies.insert_one(default_policies)
                return default_policies["policies"]
            
            return policies["policies"]
            
        except Exception as e:
            print(f"Get security policies error: {e}")
            return {}
    
    def log_security_violation(self, device_id: str, violation_type: SecurityThreat, 
                             details: Dict[str, Any] = None):
        """Log security violation"""
        try:
            violation_record = {
                "device_id": device_id,
                "violation_type": violation_type.value,
                "details": details or {},
                "timestamp": datetime.utcnow(),
                "severity": self._get_violation_severity(violation_type),
                "resolved": False
            }
            
            self.db.security_violations.insert_one(violation_record)
            
            # Update device violation count
            self.db.device_fingerprints.update_one(
                {"device_id": device_id},
                {"$inc": {"violation_count": 1}}
            )
            
        except Exception as e:
            print(f"Security violation logging error: {e}")
    
    def _get_violation_severity(self, violation_type: SecurityThreat) -> str:
        """Get severity level for violation type"""
        severity_map = {
            SecurityThreat.JAILBREAK: "high",
            SecurityThreat.ROOT: "high",
            SecurityThreat.EMULATOR: "medium",
            SecurityThreat.DEBUGGER: "high",
            SecurityThreat.HOOKING: "high",
            SecurityThreat.TAMPERING: "critical",
            SecurityThreat.MALWARE: "critical",
            SecurityThreat.UNTRUSTED_NETWORK: "low"
        }
        return severity_map.get(violation_type, "medium")
    
    def get_device_status(self, device_id: str) -> Dict[str, Any]:
        """Get comprehensive device security status"""
        try:
            device_record = self.db.device_fingerprints.find_one({"device_id": device_id})
            
            if not device_record:
                return {"error": "Device not found"}
            
            # Get recent violations
            violations = list(self.db.security_violations.find({
                "device_id": device_id
            }).sort("timestamp", -1).limit(10))
            
            return {
                "device_id": device_id,
                "risk_level": device_record["risk_assessment"]["risk_level"],
                "is_trusted": device_record["is_trusted"],
                "violation_count": device_record["violation_count"],
                "last_seen": device_record["last_seen"],
                "security_score": device_record["security_status"]["security_score"],
                "recent_violations": violations,
                "attestation_status": device_record["attestation_status"]
            }
            
        except Exception as e:
            print(f"Get device status error: {e}")
            return {"error": str(e)}
    
    def update_device_trust(self, device_id: str, trusted: bool, reason: str = ""):
        """Update device trust status"""
        try:
            self.db.device_fingerprints.update_one(
                {"device_id": device_id},
                {
                    "$set": {
                        "is_trusted": trusted,
                        "trust_updated_at": datetime.utcnow(),
                        "trust_reason": reason
                    }
                }
            )
            
        except Exception as e:
            print(f"Device trust update error: {e}")
    
    def cleanup_old_devices(self, days: int = 90):
        """Cleanup old unused devices"""
        try:
            cutoff_date = datetime.utcnow() - timedelta(days=days)
            
            # Remove devices not seen for specified days
            result = self.db.device_fingerprints.delete_many({
                "last_seen": {"$lt": cutoff_date}
            })
            
            print(f"Cleaned up {result.deleted_count} old devices")
            
        except Exception as e:
            print(f"Device cleanup error: {e}")

# Global instance
mobile_security_manager = MobileSecurityManager()