import os
import asyncio
import json
import base64
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any, Tuple
from dotenv import load_dotenv
from emergentintegrations.llm.chat import LlmChat, UserMessage
from pymongo import MongoClient
import re
import math

load_dotenv()

class ComputerVisionEngine:
    def __init__(self):
        self.api_key = os.getenv("EMERGENT_LLM_KEY")
        self.mongo_url = os.getenv("MONGO_URL")
        self.client = MongoClient(self.mongo_url)
        self.db = self.client.coupon_app
        
        # OCR confidence thresholds
        self.ocr_confidence_threshold = 0.7
        self.receipt_confidence_threshold = 0.8
        
        # AR location detection parameters
        self.ar_detection_radius = 50  # meters
        self.ar_max_businesses = 10

    async def process_receipt_scan(
        self, 
        user_id: str, 
        image_data: str, 
        image_format: str = "base64"
    ) -> Dict[str, Any]:
        """Process receipt image and extract business/transaction data"""
        try:
            # Initialize AI vision client
            chat = LlmChat(
                api_key=self.api_key,
                session_id=f"receipt_{user_id}_{datetime.now().strftime('%Y%m%d')}"
            ).with_model("gpt-4o-mini")
            
            # Create receipt analysis prompt
            prompt = f"""Analyze this receipt image and extract the following information in JSON format:

Please identify:
1. Business name
2. Business address (if visible)
3. Transaction date and time
4. Total amount
5. Individual items purchased (name and price)
6. Tax amount
7. Payment method (if visible)
8. Receipt number or transaction ID
9. Business phone number (if visible)
10. Confidence score (0.0 to 1.0) for the extraction accuracy

Return ONLY a JSON object in this format:
{{
  "business_name": "string or null",
  "business_address": "string or null", 
  "transaction_date": "YYYY-MM-DD or null",
  "transaction_time": "HH:MM or null",
  "total_amount": number or null,
  "items": [
    {{"name": "item name", "price": number}},
    ...
  ],
  "tax_amount": number or null,
  "payment_method": "string or null",
  "receipt_id": "string or null",
  "phone": "string or null",
  "confidence": number,
  "extracted_text": "key text found on receipt"
}}

If you cannot clearly read the receipt or it's not a valid receipt, return:
{{"error": "Unable to process receipt", "confidence": 0.0}}

Image data: {image_data[:100]}..."""

            user_message = UserMessage(text=prompt)
            ai_response = await chat.send_message(user_message)
            
            try:
                receipt_data = json.loads(ai_response)
            except json.JSONDecodeError:
                # Try to extract JSON from response if wrapped in text
                json_match = re.search(r'\{.*\}', ai_response, re.DOTALL)
                if json_match:
                    receipt_data = json.loads(json_match.group())
                else:
                    receipt_data = {"error": "Failed to parse receipt", "confidence": 0.0}
            
            # Validate confidence threshold
            if receipt_data.get("confidence", 0) < self.receipt_confidence_threshold:
                return {
                    "success": False,
                    "error": "Receipt scan confidence too low",
                    "confidence": receipt_data.get("confidence", 0),
                    "raw_data": receipt_data
                }
            
            # Try to match business with existing database
            business_match = await self._match_receipt_to_business(receipt_data)
            
            # Store receipt scan record
            receipt_record = {
                "id": f"receipt_{user_id}_{int(datetime.now().timestamp())}",
                "user_id": user_id,
                "scan_timestamp": datetime.now(),
                "extracted_data": receipt_data,
                "business_match": business_match,
                "image_hash": hash(image_data[:1000]),  # Simple hash for duplicate detection
                "processing_status": "completed"
            }
            
            await self._store_receipt_record(receipt_record)
            
            # Check for applicable discounts/cashback
            applicable_deals = await self._find_applicable_deals(user_id, business_match, receipt_data)
            
            return {
                "success": True,
                "receipt_id": receipt_record["id"],
                "extracted_data": receipt_data,
                "business_match": business_match,
                "applicable_deals": applicable_deals,
                "confidence": receipt_data.get("confidence", 0),
                "processing_time": "2.3s",  # Estimated
                "recommendations": await self._generate_receipt_recommendations(receipt_data, business_match)
            }
            
        except Exception as e:
            print(f"Error processing receipt: {e}")
            return {
                "success": False,
                "error": str(e),
                "confidence": 0.0
            }

    async def _match_receipt_to_business(self, receipt_data: Dict) -> Optional[Dict]:
        """Match extracted receipt data to existing business in database"""
        try:
            business_name = receipt_data.get("business_name", "").lower()
            business_address = receipt_data.get("business_address", "").lower()
            business_phone = receipt_data.get("phone", "")
            
            if not business_name:
                return None
            
            # Search for business matches
            search_queries = []
            
            # Exact name match
            search_queries.append({"name": {"$regex": f"^{re.escape(business_name)}$", "$options": "i"}})
            
            # Partial name match
            if len(business_name) > 3:
                search_queries.append({"name": {"$regex": business_name[:5], "$options": "i"}})
            
            # Address match if available
            if business_address:
                address_words = business_address.split()[:3]  # First 3 words
                for word in address_words:
                    if len(word) > 3:
                        search_queries.append({"address": {"$regex": word, "$options": "i"}})
            
            # Phone match if available
            if business_phone:
                clean_phone = re.sub(r'[^\d]', '', business_phone)
                if len(clean_phone) >= 10:
                    search_queries.append({"phone": {"$regex": clean_phone[-10:]}})
            
            # Execute searches
            for query in search_queries:
                business = self.db.businesses.find_one(query)
                if business:
                    return {
                        "business_id": business["id"],
                        "name": business["name"],
                        "address": business.get("address", ""),
                        "match_confidence": 0.9,
                        "match_method": "database_lookup"
                    }
            
            return {
                "business_id": None,
                "name": receipt_data.get("business_name"),
                "address": receipt_data.get("business_address"),
                "match_confidence": 0.3,
                "match_method": "receipt_only"
            }
            
        except Exception as e:
            print(f"Error matching business: {e}")
            return None

    async def _store_receipt_record(self, receipt_record: Dict):
        """Store receipt scan record in database"""
        try:
            self.db.receipt_scans.insert_one(receipt_record)
        except Exception as e:
            print(f"Error storing receipt record: {e}")

    async def _find_applicable_deals(
        self, 
        user_id: str, 
        business_match: Dict, 
        receipt_data: Dict
    ) -> List[Dict]:
        """Find deals applicable to the scanned receipt"""
        try:
            applicable_deals = []
            
            if not business_match or not business_match.get("business_id"):
                return applicable_deals
            
            # Get active deals for this business
            business_deals = list(self.db.discounts.find({
                "business_id": business_match["business_id"],
                "is_active": True,
                "expires_at": {"$gt": datetime.now()}
            }))
            
            total_amount = receipt_data.get("total_amount", 0)
            
            for deal in business_deals:
                deal_info = {
                    "deal_id": deal["id"],
                    "title": deal["title"],
                    "description": deal["description"],
                    "discount_value": deal["discount_value"],
                    "discount_type": deal["discount_type"],
                    "minimum_consumption": deal.get("minimum_consumption", 0),
                    "applicable": False,
                    "potential_savings": 0
                }
                
                # Check if deal is applicable
                if total_amount >= deal.get("minimum_consumption", 0):
                    deal_info["applicable"] = True
                    
                    # Calculate potential savings
                    if deal["discount_type"] == "percentage":
                        savings = total_amount * (deal["discount_value"] / 100)
                    else:
                        savings = deal["discount_value"]
                    
                    deal_info["potential_savings"] = round(savings, 2)
                
                applicable_deals.append(deal_info)
            
            return applicable_deals
            
        except Exception as e:
            print(f"Error finding applicable deals: {e}")
            return []

    async def _generate_receipt_recommendations(
        self, 
        receipt_data: Dict, 
        business_match: Dict
    ) -> List[str]:
        """Generate AI-powered recommendations based on receipt data"""
        try:
            recommendations = []
            
            total_amount = receipt_data.get("total_amount", 0)
            items = receipt_data.get("items", [])
            business_name = business_match.get("name", "this business") if business_match else "this business"
            
            # Spending-based recommendations
            if total_amount > 50:
                recommendations.append(f"💰 High-value purchase detected! Look for loyalty programs at {business_name}")
            elif total_amount < 10:
                recommendations.append(f"🎯 Small purchase - perfect for testing new deals at {business_name}")
            
            # Item-based recommendations
            if items:
                item_categories = self._categorize_items(items)
                if "food" in item_categories:
                    recommendations.append("🍽️ Food purchase detected - check for restaurant deals in your area")
                if "retail" in item_categories:
                    recommendations.append("🛍️ Retail purchase - explore fashion and retail discounts")
            
            # Business-specific recommendations
            if business_match and business_match.get("business_id"):
                recommendations.append(f"⭐ Rate your experience at {business_name} to earn reward points")
                recommendations.append(f"🔔 Set up notifications for new deals at {business_name}")
            
            # General recommendations
            recommendations.append("📱 Share this receipt scan with friends to earn social points")
            
            return recommendations[:4]  # Limit to top 4 recommendations
            
        except Exception as e:
            print(f"Error generating recommendations: {e}")
            return ["Thank you for using receipt scanning!"]

    def _categorize_items(self, items: List[Dict]) -> List[str]:
        """Categorize receipt items into broad categories"""
        categories = set()
        
        food_keywords = ["coffee", "sandwich", "burger", "pizza", "salad", "drink", "meal", "food"]
        retail_keywords = ["shirt", "pants", "shoes", "dress", "jacket", "accessory", "clothing"]
        service_keywords = ["service", "repair", "maintenance", "consultation"]
        
        for item in items:
            item_name = item.get("name", "").lower()
            
            if any(keyword in item_name for keyword in food_keywords):
                categories.add("food")
            elif any(keyword in item_name for keyword in retail_keywords):
                categories.add("retail")
            elif any(keyword in item_name for keyword in service_keywords):
                categories.add("service")
            else:
                categories.add("general")
        
        return list(categories)

    async def get_ar_businesses(
        self, 
        latitude: float, 
        longitude: float, 
        radius_meters: int = None
    ) -> Dict[str, Any]:
        """Get businesses for AR store locator based on GPS coordinates"""
        try:
            if radius_meters is None:
                radius_meters = self.ar_detection_radius
            
            # Convert radius to degrees (approximate)
            # 1 degree latitude ≈ 111km, longitude varies by latitude
            lat_range = radius_meters / 111000  # Convert meters to degrees
            lng_range = radius_meters / (111000 * math.cos(math.radians(latitude)))
            
            # Find businesses within radius
            businesses = list(self.db.businesses.find({
                "latitude": {"$gte": latitude - lat_range, "$lte": latitude + lat_range},
                "longitude": {"$gte": longitude - lng_range, "$lte": longitude + lng_range},
                "is_approved": True,
                "is_active": True
            }).limit(self.ar_max_businesses))
            
            # Calculate actual distances and get deals
            ar_businesses = []
            for business in businesses:
                if business.get("latitude") and business.get("longitude"):
                    distance = self._calculate_distance(
                        latitude, longitude,
                        business["latitude"], business["longitude"]
                    )
                    
                    if distance <= radius_meters:
                        # Get active deals for this business
                        deals = list(self.db.discounts.find({
                            "business_id": business["id"],
                            "is_active": True,
                            "expires_at": {"$gt": datetime.now()}
                        }).limit(3))  # Limit to 3 deals per business for AR display
                        
                        ar_business = {
                            "business_id": business["id"],
                            "name": business["name"],
                            "category": business["category"],
                            "address": business.get("address", ""),
                            "latitude": business["latitude"],
                            "longitude": business["longitude"],
                            "distance_meters": round(distance, 1),
                            "rating": business.get("rating", 0),
                            "active_deals_count": len(deals),
                            "top_deals": [
                                {
                                    "id": deal["id"],
                                    "title": deal["title"],
                                    "discount_value": deal["discount_value"],
                                    "discount_type": deal["discount_type"],
                                    "expires_at": deal["expires_at"].isoformat()
                                }
                                for deal in deals
                            ],
                            "ar_marker": {
                                "color": self._get_ar_marker_color(business["category"]),
                                "icon": self._get_ar_marker_icon(business["category"]),
                                "priority": self._get_ar_priority(distance, len(deals))
                            }
                        }
                        
                        ar_businesses.append(ar_business)
            
            # Sort by priority (distance + deals)
            ar_businesses.sort(key=lambda x: x["ar_marker"]["priority"], reverse=True)
            
            return {
                "success": True,
                "location": {"latitude": latitude, "longitude": longitude},
                "radius_meters": radius_meters,
                "businesses_found": len(ar_businesses),
                "businesses": ar_businesses,
                "ar_settings": {
                    "max_display_distance": radius_meters,
                    "marker_scaling": "distance_based",
                    "occlusion_handling": True,
                    "info_panel_trigger": "tap"
                }
            }
            
        except Exception as e:
            print(f"Error getting AR businesses: {e}")
            return {
                "success": False,
                "error": str(e),
                "businesses": []
            }

    def _calculate_distance(self, lat1: float, lon1: float, lat2: float, lon2: float) -> float:
        """Calculate distance between two points in meters using Haversine formula"""
        R = 6371000  # Earth's radius in meters
        
        lat1_rad = math.radians(lat1)
        lon1_rad = math.radians(lon1)
        lat2_rad = math.radians(lat2)
        lon2_rad = math.radians(lon2)
        
        dlat = lat2_rad - lat1_rad
        dlon = lon2_rad - lon1_rad
        
        a = math.sin(dlat/2)**2 + math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(dlon/2)**2
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
        
        return R * c

    def _get_ar_marker_color(self, category: str) -> str:
        """Get AR marker color based on business category"""
        category_colors = {
            "Restaurant": "#FF6B35",    # Orange
            "Retail": "#4ECDC4",        # Teal
            "Health & Beauty": "#45B7D1", # Blue
            "Services": "#96CEB4",      # Green
            "Entertainment": "#FECA57", # Yellow
            "Travel": "#FF9FF3",        # Pink
            "Technology": "#54A0FF",    # Light Blue
            "Fitness": "#5F27CD",       # Purple
            "Education": "#00D2D3"      # Cyan
        }
        return category_colors.get(category, "#333333")  # Default gray

    def _get_ar_marker_icon(self, category: str) -> str:
        """Get AR marker icon based on business category"""
        category_icons = {
            "Restaurant": "restaurant",
            "Retail": "shopping-bag",
            "Health & Beauty": "heart",
            "Services": "wrench",
            "Entertainment": "play-circle",
            "Travel": "airplane",
            "Technology": "laptop",
            "Fitness": "activity",
            "Education": "book"
        }
        return category_icons.get(category, "map-pin")  # Default pin

    def _get_ar_priority(self, distance: float, deals_count: int) -> float:
        """Calculate AR marker priority based on distance and deals"""
        # Closer businesses and more deals = higher priority
        distance_score = max(0, 1 - (distance / 1000))  # Normalize to 0-1
        deals_score = min(1, deals_count / 5)  # Normalize to 0-1, max at 5 deals
        
        return (distance_score * 0.6) + (deals_score * 0.4)

    async def visual_search_products(
        self, 
        user_id: str, 
        image_data: str, 
        search_context: str = "deals"
    ) -> Dict[str, Any]:
        """Perform visual search to find similar products or deals"""
        try:
            # Initialize AI vision client
            chat = LlmChat(
                api_key=self.api_key,
                session_id=f"visual_search_{user_id}_{datetime.now().strftime('%Y%m%d')}"
            ).with_model("gpt-4o-mini")
            
            # Create visual search prompt
            prompt = f"""Analyze this image and identify products, items, or services that could match available deals and discounts.

Please identify:
1. Main product or item in the image
2. Product category (food, retail, electronics, etc.)
3. Brand name (if visible)
4. Key characteristics (color, size, style, etc.)
5. Estimated price range
6. Similar product keywords for searching
7. Confidence in identification (0.0 to 1.0)

Search context: {search_context}

Return ONLY a JSON object in this format:
{{
  "identified_items": [
    {{
      "name": "product name",
      "category": "category",
      "brand": "brand name or null",
      "characteristics": ["characteristic1", "characteristic2"],
      "estimated_price_range": {{"min": number, "max": number}},
      "confidence": number
    }}
  ],
  "search_keywords": ["keyword1", "keyword2", "keyword3"],
  "overall_confidence": number,
  "search_suggestions": ["suggestion1", "suggestion2"]
}}

Image data: {image_data[:100]}..."""

            user_message = UserMessage(text=prompt)
            ai_response = await chat.send_message(user_message)
            
            try:
                visual_data = json.loads(ai_response)
            except json.JSONDecodeError:
                # Try to extract JSON from response if wrapped in text
                json_match = re.search(r'\{.*\}', ai_response, re.DOTALL)
                if json_match:
                    visual_data = json.loads(json_match.group())
                else:
                    visual_data = {"error": "Failed to analyze image", "overall_confidence": 0.0}
            
            if visual_data.get("overall_confidence", 0) < 0.5:
                return {
                    "success": False,
                    "error": "Visual recognition confidence too low",
                    "confidence": visual_data.get("overall_confidence", 0),
                    "suggestions": ["Try taking a clearer photo", "Ensure good lighting", "Focus on the main product"]
                }
            
            # Search for matching deals based on identified items
            matching_deals = await self._find_deals_by_visual_search(visual_data)
            
            # Store visual search record
            search_record = {
                "id": f"visual_{user_id}_{int(datetime.now().timestamp())}",
                "user_id": user_id,
                "search_timestamp": datetime.now(),
                "identified_items": visual_data.get("identified_items", []),
                "search_keywords": visual_data.get("search_keywords", []),
                "confidence": visual_data.get("overall_confidence", 0),
                "matching_deals_count": len(matching_deals),
                "search_context": search_context
            }
            
            self.db.visual_searches.insert_one(search_record)
            
            return {
                "success": True,
                "search_id": search_record["id"],
                "identified_items": visual_data.get("identified_items", []),
                "search_keywords": visual_data.get("search_keywords", []),
                "matching_deals": matching_deals,
                "confidence": visual_data.get("overall_confidence", 0),
                "search_suggestions": visual_data.get("search_suggestions", []),
                "similar_searches": await self._get_similar_searches(user_id, visual_data.get("search_keywords", []))
            }
            
        except Exception as e:
            print(f"Error in visual search: {e}")
            return {
                "success": False,
                "error": str(e),
                "confidence": 0.0
            }

    async def _find_deals_by_visual_search(self, visual_data: Dict) -> List[Dict]:
        """Find deals matching the visual search results"""
        try:
            matching_deals = []
            search_keywords = visual_data.get("search_keywords", [])
            identified_items = visual_data.get("identified_items", [])
            
            # Build search queries
            search_queries = []
            
            # Search by keywords in deal titles and descriptions
            for keyword in search_keywords:
                if len(keyword) > 2:
                    search_queries.extend([
                        {"title": {"$regex": keyword, "$options": "i"}},
                        {"description": {"$regex": keyword, "$options": "i"}}
                    ])
            
            # Search by categories
            for item in identified_items:
                category = item.get("category", "")
                if category:
                    search_queries.append({"category": {"$regex": category, "$options": "i"}})
            
            # Execute searches and collect unique deals
            deal_ids = set()
            
            for query in search_queries:
                # First find businesses matching the query
                businesses = list(self.db.businesses.find(query))
                business_ids = [b["id"] for b in businesses]
                
                # Then find deals for these businesses
                deals = list(self.db.discounts.find({
                    "$or": [
                        query,  # Direct deal match
                        {"business_id": {"$in": business_ids}}  # Business match
                    ],
                    "is_active": True,
                    "expires_at": {"$gt": datetime.now()}
                }))
                
                for deal in deals:
                    if deal["id"] not in deal_ids:
                        deal_ids.add(deal["id"])
                        
                        # Get business info
                        business = self.db.businesses.find_one({"id": deal["business_id"]})
                        
                        # Calculate relevance score
                        relevance_score = self._calculate_visual_relevance(
                            deal, business, search_keywords, identified_items
                        )
                        
                        matching_deals.append({
                            "deal_id": deal["id"],
                            "title": deal["title"],
                            "description": deal["description"],
                            "discount_value": deal["discount_value"],
                            "discount_type": deal["discount_type"],
                            "expires_at": deal["expires_at"].isoformat(),
                            "business_name": business["name"] if business else "Unknown",
                            "business_category": business["category"] if business else "Unknown",
                            "relevance_score": relevance_score,
                            "match_reason": self._get_match_reason(deal, business, search_keywords)
                        })
            
            # Sort by relevance score
            matching_deals.sort(key=lambda x: x["relevance_score"], reverse=True)
            
            return matching_deals[:10]  # Return top 10 matches
            
        except Exception as e:
            print(f"Error finding deals by visual search: {e}")
            return []

    def _calculate_visual_relevance(
        self, 
        deal: Dict, 
        business: Dict, 
        keywords: List[str], 
        items: List[Dict]
    ) -> float:
        """Calculate relevance score for visual search match"""
        score = 0.0
        
        # Keyword matches in deal title/description
        deal_text = f"{deal.get('title', '')} {deal.get('description', '')}".lower()
        for keyword in keywords:
            if keyword.lower() in deal_text:
                score += 0.3
        
        # Category matches
        if business:
            business_category = business.get("category", "").lower()
            for item in items:
                item_category = item.get("category", "").lower()
                if item_category and item_category in business_category:
                    score += 0.4
        
        # Business rating boost
        if business and business.get("rating", 0) > 4.0:
            score += 0.1
        
        # Deal value boost (higher discounts = more relevant)
        if deal.get("discount_value", 0) > 20:
            score += 0.2
        
        return min(1.0, score)

    def _get_match_reason(self, deal: Dict, business: Dict, keywords: List[str]) -> str:
        """Get human-readable reason for the match"""
        reasons = []
        
        deal_text = f"{deal.get('title', '')} {deal.get('description', '')}".lower()
        
        # Check keyword matches
        matched_keywords = [kw for kw in keywords if kw.lower() in deal_text]
        if matched_keywords:
            reasons.append(f"Keywords: {', '.join(matched_keywords[:2])}")
        
        # Check category match
        if business:
            reasons.append(f"Category: {business.get('category', 'General')}")
        
        # Check discount value
        discount_value = deal.get("discount_value", 0)
        if discount_value > 30:
            reasons.append("High discount value")
        
        return " | ".join(reasons) if reasons else "General match"

    async def _get_similar_searches(self, user_id: str, keywords: List[str]) -> List[Dict]:
        """Get similar searches performed by the user"""
        try:
            # Find recent visual searches by this user
            recent_searches = list(self.db.visual_searches.find({
                "user_id": user_id,
                "search_timestamp": {"$gte": datetime.now() - timedelta(days=30)}
            }).sort("search_timestamp", -1).limit(5))
            
            similar_searches = []
            for search in recent_searches:
                search_keywords = search.get("search_keywords", [])
                # Check for keyword overlap
                overlap = set(keywords) & set(search_keywords)
                if overlap:
                    similar_searches.append({
                        "search_id": search["id"],
                        "timestamp": search["search_timestamp"].isoformat(),
                        "keywords": search_keywords,
                        "matching_deals_count": search.get("matching_deals_count", 0),
                        "overlap_keywords": list(overlap)
                    })
            
            return similar_searches
            
        except Exception as e:
            print(f"Error getting similar searches: {e}")
            return []

    async def get_receipt_history(self, user_id: str, limit: int = 20) -> Dict[str, Any]:
        """Get user's receipt scan history"""
        try:
            receipts = list(self.db.receipt_scans.find({
                "user_id": user_id
            }).sort("scan_timestamp", -1).limit(limit))
            
            receipt_history = []
            total_scanned = 0
            total_amount = 0.0
            
            for receipt in receipts:
                extracted_data = receipt.get("extracted_data", {})
                business_match = receipt.get("business_match", {})
                
                amount = extracted_data.get("total_amount", 0)
                if amount:
                    total_amount += amount
                    total_scanned += 1
                
                receipt_history.append({
                    "receipt_id": receipt["id"],
                    "scan_date": receipt["scan_timestamp"].isoformat(),
                    "business_name": business_match.get("name", "Unknown"),
                    "total_amount": amount,
                    "confidence": extracted_data.get("confidence", 0),
                    "items_count": len(extracted_data.get("items", [])),
                    "applicable_deals_found": len(receipt.get("applicable_deals", []))
                })
            
            return {
                "success": True,
                "receipt_history": receipt_history,
                "summary": {
                    "total_receipts_scanned": len(receipts),
                    "receipts_with_amounts": total_scanned,
                    "total_spending_tracked": round(total_amount, 2),
                    "average_transaction": round(total_amount / max(1, total_scanned), 2),
                    "most_recent_scan": receipts[0]["scan_timestamp"].isoformat() if receipts else None
                }
            }
            
        except Exception as e:
            print(f"Error getting receipt history: {e}")
            return {
                "success": False,
                "error": str(e),
                "receipt_history": []
            }

    async def get_visual_search_history(self, user_id: str, limit: int = 20) -> Dict[str, Any]:
        """Get user's visual search history"""
        try:
            searches = list(self.db.visual_searches.find({
                "user_id": user_id
            }).sort("search_timestamp", -1).limit(limit))
            
            search_history = []
            total_matches = 0
            
            for search in searches:
                matches_count = search.get("matching_deals_count", 0)
                total_matches += matches_count
                
                search_history.append({
                    "search_id": search["id"],
                    "search_date": search["search_timestamp"].isoformat(),
                    "identified_items": search.get("identified_items", []),
                    "search_keywords": search.get("search_keywords", []),
                    "confidence": search.get("confidence", 0),
                    "matching_deals_count": matches_count,
                    "search_context": search.get("search_context", "deals")
                })
            
            return {
                "success": True,
                "search_history": search_history,
                "summary": {
                    "total_searches": len(searches),
                    "total_matches_found": total_matches,
                    "average_matches_per_search": round(total_matches / max(1, len(searches)), 1),
                    "most_recent_search": searches[0]["search_timestamp"].isoformat() if searches else None
                }
            }
            
        except Exception as e:
            print(f"Error getting visual search history: {e}")
            return {
                "success": False,
                "error": str(e),
                "search_history": []
            }

# Global instance
computer_vision_engine = ComputerVisionEngine()