import os
import asyncio
import json
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any
from dotenv import load_dotenv
from emergentintegrations.llm.chat import LlmChat, UserMessage
from pymongo import MongoClient
import re

load_dotenv()

class VoiceAIAssistant:
    def __init__(self):
        self.api_key = os.getenv("EMERGENT_LLM_KEY")
        self.mongo_url = os.getenv("MONGO_URL")
        self.client = MongoClient(self.mongo_url)
        self.db = self.client.coupon_app
        
        # Initialize LLM Chat with system message for deal assistant
        self.system_message = """You are a smart discount and deal assistant for a mobile coupon app. Your primary job is to understand user requests about deals, discounts, and offers, then provide helpful responses.

Key capabilities:
1. Parse natural language queries about deals and discounts
2. Understand location-based requests ("near me", specific cities)
3. Handle price range queries ("under $10", "less than $20")
4. Recognize category requests ("pizza", "restaurants", "retail")
5. Process time-based queries ("expires today", "weekend deals")
6. Provide conversational, helpful responses

Always respond in JSON format with this structure:
{
    "intent": "search_deals|get_expiring|show_nearby|general_info|help",
    "parameters": {
        "category": "restaurant|retail|health|entertainment|services|any",
        "max_price": number or null,
        "location": "user_location|specific_place|null",
        "time_filter": "today|weekend|week|null",
        "keywords": ["array", "of", "relevant", "terms"]
    },
    "response": "Friendly response to user",
    "action": "search|notify|explain|help"
}

Examples:
- "Find pizza deals near me under $15" → search intent with category "restaurant", keywords ["pizza"], max_price 15
- "What deals expire today?" → get_expiring intent with time_filter "today"
- "Show me deals for date nights" → search intent with keywords ["date", "romantic", "dinner"]
"""

    async def process_voice_command(self, user_id: str, voice_text: str, location: Optional[Dict] = None) -> Dict[str, Any]:
        """Process voice command and return structured response"""
        try:
            # Create chat session
            chat = LlmChat(
                api_key=self.api_key,
                session_id=f"voice_{user_id}_{datetime.now().strftime('%Y%m%d')}",
                system_message=self.system_message
            ).with_model("openai", "gpt-4o-mini")
            
            # Add context about user location if available
            context = f"User voice command: '{voice_text}'"
            if location:
                context += f"\nUser location: lat {location.get('latitude')}, lng {location.get('longitude')}"
            
            # Process with AI
            user_message = UserMessage(text=context)
            ai_response = await chat.send_message(user_message)
            
            # Parse AI response
            try:
                parsed_response = json.loads(ai_response)
            except json.JSONDecodeError:
                # Fallback if AI doesn't return proper JSON
                parsed_response = {
                    "intent": "general_info",
                    "parameters": {},
                    "response": ai_response,
                    "action": "explain"
                }
            
            # Execute the parsed command
            result = await self._execute_command(user_id, parsed_response, location)
            
            # Store interaction for learning
            await self._store_interaction(user_id, voice_text, parsed_response, result)
            
            return result
            
        except Exception as e:
            return {
                "success": False,
                "error": str(e),
                "response": "Sorry, I couldn't process your request. Please try again.",
                "voice_response": "Sorry, I couldn't process your request. Please try again."
            }

    async def _execute_command(self, user_id: str, parsed_command: Dict, location: Optional[Dict] = None) -> Dict[str, Any]:
        """Execute the parsed command and return results"""
        intent = parsed_command.get("intent", "general_info")
        parameters = parsed_command.get("parameters", {})
        
        if intent == "search_deals":
            return await self._search_deals(parameters, location)
        elif intent == "get_expiring":
            return await self._get_expiring_deals(parameters, location)
        elif intent == "show_nearby":
            return await self._get_nearby_deals(location)
        else:
            return {
                "success": True,
                "intent": intent,
                "response": parsed_command.get("response", "I'm here to help you find great deals!"),
                "voice_response": parsed_command.get("response", "I'm here to help you find great deals!"),
                "data": []
            }

    async def _search_deals(self, parameters: Dict, location: Optional[Dict] = None) -> Dict[str, Any]:
        """Search for deals based on parameters"""
        try:
            # Build MongoDB query
            query = {"status": "active"}
            
            # Category filter
            if parameters.get("category") and parameters["category"] != "any":
                # Map general categories to specific ones
                category_map = {
                    "restaurant": ["Restaurant", "Food & Dining"],
                    "retail": ["Retail", "Shopping"],
                    "health": ["Health & Beauty", "Wellness"],
                    "entertainment": ["Entertainment", "Recreation"],
                    "services": ["Services", "Professional"]
                }
                categories = category_map.get(parameters["category"], [parameters["category"]])
                
                # Search in business categories
                business_query = {"category": {"$in": categories}}
                businesses = list(self.db.businesses.find(business_query, {"_id": 1}))
                business_ids = [str(b["_id"]) for b in businesses]
                query["business_id"] = {"$in": business_ids}
            
            # Keywords filter
            if parameters.get("keywords"):
                keyword_regex = "|".join(parameters["keywords"])
                query["$or"] = [
                    {"title": {"$regex": keyword_regex, "$options": "i"}},
                    {"description": {"$regex": keyword_regex, "$options": "i"}}
                ]
            
            # Price filter (assuming discount_value represents savings amount)
            if parameters.get("max_price"):
                query["discount_value"] = {"$lte": parameters["max_price"]}
            
            # Time filter
            if parameters.get("time_filter") == "today":
                tomorrow = datetime.now() + timedelta(days=1)
                query["expires_at"] = {"$gte": datetime.now(), "$lt": tomorrow}
            
            # Get deals
            deals = list(self.db.discounts.find(query).limit(10))
            
            # Enrich with business information
            enriched_deals = []
            for deal in deals:
                business = self.db.businesses.find_one({"id": deal["business_id"]})
                if business:
                    enriched_deals.append({
                        "id": deal["id"],
                        "title": deal["title"],
                        "description": deal["description"],
                        "discount_value": deal["discount_value"],
                        "discount_type": deal["discount_type"],
                        "expires_at": deal["expires_at"].isoformat() if deal.get("expires_at") else None,
                        "business": {
                            "name": business["name"],
                            "category": business["category"],
                            "address": business.get("address", ""),
                            "latitude": business.get("latitude"),
                            "longitude": business.get("longitude")
                        }
                    })
            
            # Generate response
            if enriched_deals:
                deal_count = len(enriched_deals)
                response = f"I found {deal_count} great deals for you! "
                if parameters.get("keywords"):
                    response += f"Here are the best {', '.join(parameters['keywords'])} deals available."
                else:
                    response += "Here are the best deals I found."
                
                voice_response = f"I found {deal_count} great deals for you. " + \
                               f"The top deal is {enriched_deals[0]['title']} at {enriched_deals[0]['business']['name']}."
            else:
                response = "I couldn't find any deals matching your criteria. Try adjusting your search or check back later!"
                voice_response = "I couldn't find any deals matching your criteria. Try adjusting your search or check back later!"
            
            return {
                "success": True,
                "intent": "search_deals",
                "response": response,
                "voice_response": voice_response,
                "data": enriched_deals,
                "count": len(enriched_deals)
            }
            
        except Exception as e:
            return {
                "success": False,
                "error": str(e),
                "response": "Sorry, I had trouble searching for deals. Please try again.",
                "voice_response": "Sorry, I had trouble searching for deals. Please try again."
            }

    async def _get_expiring_deals(self, parameters: Dict, location: Optional[Dict] = None) -> Dict[str, Any]:
        """Get deals expiring soon"""
        try:
            # Define time range based on filter
            now = datetime.now()
            if parameters.get("time_filter") == "today":
                end_time = now + timedelta(days=1)
                time_desc = "today"
            else:
                end_time = now + timedelta(days=3)  # Default to 3 days
                time_desc = "soon"
            
            query = {
                "status": "active",
                "expires_at": {"$gte": now, "$lte": end_time}
            }
            
            deals = list(self.db.discounts.find(query).sort("expires_at", 1).limit(10))
            
            # Enrich with business information
            enriched_deals = []
            for deal in deals:
                business = self.db.businesses.find_one({"id": deal["business_id"]})
                if business:
                    enriched_deals.append({
                        "id": deal["id"],
                        "title": deal["title"],
                        "description": deal["description"],
                        "discount_value": deal["discount_value"],
                        "discount_type": deal["discount_type"],
                        "expires_at": deal["expires_at"].isoformat(),
                        "business": {
                            "name": business["name"],
                            "category": business["category"]
                        }
                    })
            
            if enriched_deals:
                response = f"I found {len(enriched_deals)} deals expiring {time_desc}. Don't miss out!"
                voice_response = f"I found {len(enriched_deals)} deals expiring {time_desc}. " + \
                               f"The first one is {enriched_deals[0]['title']} at {enriched_deals[0]['business']['name']}."
            else:
                response = f"No deals are expiring {time_desc}. Check back later for new offers!"
                voice_response = f"No deals are expiring {time_desc}. Check back later for new offers!"
            
            return {
                "success": True,
                "intent": "get_expiring",
                "response": response,
                "voice_response": voice_response,
                "data": enriched_deals,
                "count": len(enriched_deals)
            }
            
        except Exception as e:
            return {
                "success": False,
                "error": str(e),
                "response": "Sorry, I had trouble finding expiring deals.",
                "voice_response": "Sorry, I had trouble finding expiring deals."
            }

    async def _get_nearby_deals(self, location: Optional[Dict] = None) -> Dict[str, Any]:
        """Get deals near user location"""
        if not location or not location.get("latitude") or not location.get("longitude"):
            return {
                "success": False,
                "response": "I need your location to find nearby deals. Please enable location services.",
                "voice_response": "I need your location to find nearby deals. Please enable location services."
            }
        
        try:
            # Find businesses within 10km radius (simplified distance calculation)
            lat = location["latitude"]
            lng = location["longitude"]
            
            # Simple bounding box (more sophisticated geo-queries would use MongoDB's geo features)
            lat_range = 0.09  # Roughly 10km
            lng_range = 0.09
            
            businesses = list(self.db.businesses.find({
                "latitude": {"$gte": lat - lat_range, "$lte": lat + lat_range},
                "longitude": {"$gte": lng - lng_range, "$lte": lng + lng_range}
            }))
            
            business_ids = [b["id"] for b in businesses]
            
            deals = list(self.db.discounts.find({
                "status": "active",
                "business_id": {"$in": business_ids}
            }).limit(15))
            
            # Enrich deals
            enriched_deals = []
            for deal in deals:
                business = next((b for b in businesses if b["id"] == deal["business_id"]), None)
                if business:
                    enriched_deals.append({
                        "id": deal["id"],
                        "title": deal["title"],
                        "description": deal["description"],
                        "discount_value": deal["discount_value"],
                        "discount_type": deal["discount_type"],
                        "expires_at": deal["expires_at"].isoformat() if deal.get("expires_at") else None,
                        "business": {
                            "name": business["name"],
                            "category": business["category"],
                            "address": business.get("address", ""),
                            "latitude": business.get("latitude"),
                            "longitude": business.get("longitude")
                        }
                    })
            
            if enriched_deals:
                response = f"I found {len(enriched_deals)} deals near you!"
                voice_response = f"I found {len(enriched_deals)} deals near you. " + \
                               f"The closest one is {enriched_deals[0]['title']} at {enriched_deals[0]['business']['name']}."
            else:
                response = "No deals found in your area. Try expanding your search radius!"
                voice_response = "No deals found in your area. Try expanding your search radius!"
            
            return {
                "success": True,
                "intent": "show_nearby",
                "response": response,
                "voice_response": voice_response,
                "data": enriched_deals,
                "count": len(enriched_deals)
            }
            
        except Exception as e:
            return {
                "success": False,
                "error": str(e),
                "response": "Sorry, I had trouble finding nearby deals.",
                "voice_response": "Sorry, I had trouble finding nearby deals."
            }

    async def _store_interaction(self, user_id: str, voice_text: str, parsed_command: Dict, result: Dict):
        """Store voice interaction for learning and analytics"""
        try:
            interaction = {
                "user_id": user_id,
                "voice_text": voice_text,
                "parsed_command": parsed_command,
                "result_success": result.get("success", False),
                "result_count": result.get("count", 0),
                "timestamp": datetime.now(),
                "session_id": f"voice_{user_id}_{datetime.now().strftime('%Y%m%d')}"
            }
            
            self.db.voice_interactions.insert_one(interaction)
        except Exception as e:
            print(f"Error storing interaction: {e}")

    async def get_personalized_suggestions(self, user_id: str) -> Dict[str, Any]:
        """Get personalized deal suggestions based on user behavior"""
        try:
            # Get user's recent interactions
            recent_interactions = list(
                self.db.voice_interactions.find(
                    {"user_id": user_id}
                ).sort("timestamp", -1).limit(10)
            )
            
            # Analyze patterns
            categories = []
            keywords = []
            price_ranges = []
            
            for interaction in recent_interactions:
                params = interaction.get("parsed_command", {}).get("parameters", {})
                if params.get("category"):
                    categories.append(params["category"])
                if params.get("keywords"):
                    keywords.extend(params["keywords"])
                if params.get("max_price"):
                    price_ranges.append(params["max_price"])
            
            # Generate suggestions based on patterns
            suggestions = []
            if categories:
                most_common_category = max(set(categories), key=categories.count)
                suggestions.append(f"Try searching for more {most_common_category} deals")
            
            if keywords:
                common_keywords = list(set(keywords))[:3]
                suggestions.append(f"You might like deals for: {', '.join(common_keywords)}")
            
            if not suggestions:
                suggestions = [
                    "Try asking 'What are today's best deals?'",
                    "Say 'Find restaurants near me'",
                    "Ask 'What deals expire today?'"
                ]
            
            return {
                "success": True,
                "suggestions": suggestions,
                "voice_response": f"Based on your preferences, {suggestions[0]}"
            }
            
        except Exception as e:
            return {
                "success": False,
                "error": str(e),
                "suggestions": ["Try asking me about deals!"],
                "voice_response": "Try asking me about deals!"
            }

# Global instance
voice_assistant = VoiceAIAssistant()