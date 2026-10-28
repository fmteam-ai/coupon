import os
import asyncio
import json
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any, Tuple
from collections import defaultdict, Counter
from dotenv import load_dotenv
from emergentintegrations.llm.chat import LlmChat, UserMessage
from pymongo import MongoClient
import math

load_dotenv()

class HyperPersonalizationEngine:
    def __init__(self):
        self.api_key = os.getenv("EMERGENT_LLM_KEY")
        self.mongo_url = os.getenv("MONGO_URL")
        self.client = MongoClient(self.mongo_url)
        self.db = self.client.coupon_app
        
        # User behavior tracking weights
        self.behavior_weights = {
            'view': 1.0,
            'share': 3.0,
            'redeem': 5.0,
            'rate': 2.0,
            'search': 1.5,
            'voice_query': 2.0
        }

    async def track_user_behavior(self, user_id: str, action: str, data: Dict[str, Any]):
        """Track user behavior for personalization learning"""
        try:
            behavior_entry = {
                'user_id': user_id,
                'action': action,
                'data': data,
                'timestamp': datetime.now(),
                'weight': self.behavior_weights.get(action, 1.0)
            }
            
            # Store in behavior tracking collection
            self.db.user_behavior.insert_one(behavior_entry)
            
            # Update user profile immediately
            await self._update_user_profile(user_id, action, data)
            
        except Exception as e:
            print(f"Error tracking behavior: {e}")

    async def _update_user_profile(self, user_id: str, action: str, data: Dict[str, Any]):
        """Update user profile based on behavior"""
        try:
            # Get or create user profile
            profile = self.db.user_profiles.find_one({'user_id': user_id}) or {
                'user_id': user_id,
                'preferences': {
                    'categories': {},
                    'price_range': {'min': 0, 'max': 1000},
                    'keywords': {},
                    'locations': {},
                    'time_patterns': {},
                    'businesses': {}
                },
                'behavior_score': 0,
                'last_updated': datetime.now()
            }
            
            preferences = profile['preferences']
            
            # Update based on action type
            if action in ['view', 'redeem', 'rate'] and 'business_id' in data:
                # Get business details
                business = self.db.businesses.find_one({'id': data['business_id']})
                if business:
                    # Update category preferences
                    category = business.get('category', 'Unknown')
                    preferences['categories'][category] = preferences['categories'].get(category, 0) + self.behavior_weights[action]
                    
                    # Update business preferences
                    preferences['businesses'][data['business_id']] = preferences['businesses'].get(data['business_id'], 0) + self.behavior_weights[action]
                    
                    # Update location preferences if available
                    if business.get('latitude') and business.get('longitude'):
                        location_key = f"{business['latitude']:.2f},{business['longitude']:.2f}"
                        preferences['locations'][location_key] = preferences['locations'].get(location_key, 0) + self.behavior_weights[action]
            
            if action == 'search' and 'query' in data:
                # Extract keywords from search
                query = data['query'].lower()
                keywords = query.split()
                for keyword in keywords:
                    if len(keyword) > 2:  # Ignore short words
                        preferences['keywords'][keyword] = preferences['keywords'].get(keyword, 0) + self.behavior_weights[action]
            
            if action == 'voice_query' and 'categories' in data:
                # Update from voice query categories
                for category in data['categories']:
                    preferences['categories'][category] = preferences['categories'].get(category, 0) + self.behavior_weights[action]
            
            # Update time patterns
            current_hour = datetime.now().hour
            time_slot = self._get_time_slot(current_hour)
            preferences['time_patterns'][time_slot] = preferences['time_patterns'].get(time_slot, 0) + 1
            
            # Update behavior score
            profile['behavior_score'] = profile.get('behavior_score', 0) + self.behavior_weights[action]
            profile['last_updated'] = datetime.now()
            profile['preferences'] = preferences
            
            # Upsert profile
            self.db.user_profiles.replace_one(
                {'user_id': user_id},
                profile,
                upsert=True
            )
            
        except Exception as e:
            print(f"Error updating user profile: {e}")

    def _get_time_slot(self, hour: int) -> str:
        """Convert hour to time slot"""
        if 5 <= hour < 11:
            return 'morning'
        elif 11 <= hour < 14:
            return 'lunch'
        elif 14 <= hour < 17:
            return 'afternoon'
        elif 17 <= hour < 21:
            return 'evening'
        else:
            return 'night'

    async def get_personalized_recommendations(
        self, 
        user_id: str, 
        context: Dict[str, Any] = None,
        limit: int = 10
    ) -> List[Dict[str, Any]]:
        """Get personalized deal recommendations for user"""
        try:
            # Get user profile
            profile = self.db.user_profiles.find_one({'user_id': user_id})
            if not profile:
                # Return popular deals for new users
                return await self._get_popular_deals(limit)
            
            preferences = profile['preferences']
            
            # Build scoring pipeline
            recommendations = []
            
            # Get all active deals
            deals = list(self.db.discounts.find({'status': 'active'}))
            
            for deal in deals:
                score = await self._calculate_deal_score(deal, preferences, context)
                if score > 0:
                    recommendations.append({
                        'deal': deal,
                        'score': score,
                        'reasons': await self._get_recommendation_reasons(deal, preferences)
                    })
            
            # Sort by score and return top recommendations
            recommendations.sort(key=lambda x: x['score'], reverse=True)
            
            # Enrich with business data
            enriched_recommendations = []
            for rec in recommendations[:limit]:
                business = self.db.businesses.find_one({'id': rec['deal']['business_id']})
                if business:
                    enriched_recommendations.append({
                        'id': rec['deal']['id'],
                        'title': rec['deal']['title'],
                        'description': rec['deal']['description'],
                        'discount_value': rec['deal']['discount_value'],
                        'discount_type': rec['deal']['discount_type'],
                        'expires_at': rec['deal']['expires_at'].isoformat() if rec['deal'].get('expires_at') else None,
                        'business': {
                            'id': business['id'],
                            'name': business['name'],
                            'category': business['category'],
                            'address': business.get('address', ''),
                            'latitude': business.get('latitude'),
                            'longitude': business.get('longitude')
                        },
                        'personalization_score': rec['score'],
                        'reasons': rec['reasons']
                    })
            
            return enriched_recommendations
            
        except Exception as e:
            print(f"Error getting personalized recommendations: {e}")
            return await self._get_popular_deals(limit)

    async def _calculate_deal_score(
        self, 
        deal: Dict, 
        preferences: Dict, 
        context: Dict = None
    ) -> float:
        """Calculate personalization score for a deal"""
        try:
            score = 0.0
            
            # Get business details
            business = self.db.businesses.find_one({'id': deal['business_id']})
            if not business:
                return 0.0
            
            # Category preference score (40% weight)
            category = business.get('category', 'Unknown')
            category_score = preferences.get('categories', {}).get(category, 0)
            score += category_score * 0.4
            
            # Business preference score (30% weight)
            business_score = preferences.get('businesses', {}).get(deal['business_id'], 0)
            score += business_score * 0.3
            
            # Keyword matching score (20% weight)
            keyword_score = 0
            deal_text = f"{deal.get('title', '')} {deal.get('description', '')}".lower()
            for keyword, weight in preferences.get('keywords', {}).items():
                if keyword in deal_text:
                    keyword_score += weight
            score += keyword_score * 0.2
            
            # Time-based score (10% weight)
            current_time_slot = self._get_time_slot(datetime.now().hour)
            time_score = preferences.get('time_patterns', {}).get(current_time_slot, 0)
            score += time_score * 0.1
            
            # Context-based adjustments
            if context:
                # Location proximity
                if context.get('latitude') and context.get('longitude') and business.get('latitude') and business.get('longitude'):
                    distance = self._calculate_distance(
                        context['latitude'], context['longitude'],
                        business['latitude'], business['longitude']
                    )
                    # Boost score for nearby deals
                    if distance < 5:  # Within 5km
                        score *= 1.5
                    elif distance < 10:  # Within 10km
                        score *= 1.2
                
                # Weather-based (if provided)
                if context.get('weather'):
                    weather = context['weather'].lower()
                    if 'rain' in weather and category.lower() in ['restaurant', 'entertainment']:
                        score *= 1.3  # Indoor activities during rain
                    elif 'sunny' in weather and category.lower() in ['recreation', 'outdoor']:
                        score *= 1.3  # Outdoor activities during sunny weather
            
            # Recency boost for new deals
            if deal.get('created_at'):
                days_old = (datetime.now() - deal['created_at']).days
                if days_old < 3:
                    score *= 1.2  # Boost new deals
            
            # Expiry urgency
            if deal.get('expires_at'):
                days_until_expiry = (deal['expires_at'] - datetime.now()).days
                if 0 < days_until_expiry <= 2:
                    score *= 1.4  # Boost expiring deals
            
            return max(0, score)
            
        except Exception as e:
            print(f"Error calculating deal score: {e}")
            return 0.0

    def _calculate_distance(self, lat1: float, lon1: float, lat2: float, lon2: float) -> float:
        """Calculate distance between two points in kilometers"""
        # Haversine formula
        R = 6371  # Earth's radius in kilometers
        
        lat1_rad = math.radians(lat1)
        lon1_rad = math.radians(lon1)
        lat2_rad = math.radians(lat2)
        lon2_rad = math.radians(lon2)
        
        dlat = lat2_rad - lat1_rad
        dlon = lon2_rad - lon1_rad
        
        a = math.sin(dlat/2)**2 + math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(dlon/2)**2
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
        
        return R * c

    async def _get_recommendation_reasons(self, deal: Dict, preferences: Dict) -> List[str]:
        """Generate human-readable reasons for recommendation"""
        reasons = []
        
        try:
            business = self.db.businesses.find_one({'id': deal['business_id']})
            if not business:
                return reasons
            
            category = business.get('category', 'Unknown')
            
            # Category-based reasons
            if preferences.get('categories', {}).get(category, 0) > 5:
                reasons.append(f"You frequently visit {category.lower()} businesses")
            
            # Business-based reasons
            if preferences.get('businesses', {}).get(deal['business_id'], 0) > 3:
                reasons.append(f"You've shown interest in {business['name']}")
            
            # Keyword-based reasons
            deal_text = f"{deal.get('title', '')} {deal.get('description', '')}".lower()
            matched_keywords = []
            for keyword, weight in preferences.get('keywords', {}).items():
                if keyword in deal_text and weight > 2:
                    matched_keywords.append(keyword)
            
            if matched_keywords:
                reasons.append(f"Matches your interests: {', '.join(matched_keywords[:3])}")
            
            # Time-based reasons
            current_time_slot = self._get_time_slot(datetime.now().hour)
            if preferences.get('time_patterns', {}).get(current_time_slot, 0) > 3:
                reasons.append(f"Perfect for your {current_time_slot} activities")
            
            # Default reason if no specific reasons
            if not reasons:
                reasons.append("Recommended based on your activity")
            
            return reasons[:3]  # Limit to top 3 reasons
            
        except Exception as e:
            print(f"Error getting recommendation reasons: {e}")
            return ["Recommended for you"]

    async def _get_popular_deals(self, limit: int = 10) -> List[Dict[str, Any]]:
        """Get popular deals for new users"""
        try:
            # Get deals with highest redemption/view counts
            popular_deals = list(
                self.db.discounts.find({'status': 'active'})
                .sort([('usage_count', -1), ('created_at', -1)])
                .limit(limit)
            )
            
            enriched_deals = []
            for deal in popular_deals:
                business = self.db.businesses.find_one({'id': deal['business_id']})
                if business:
                    enriched_deals.append({
                        'id': deal['id'],
                        'title': deal['title'],
                        'description': deal['description'],
                        'discount_value': deal['discount_value'],
                        'discount_type': deal['discount_type'],
                        'expires_at': deal['expires_at'].isoformat() if deal.get('expires_at') else None,
                        'business': {
                            'id': business['id'],
                            'name': business['name'],
                            'category': business['category'],
                            'address': business.get('address', ''),
                            'latitude': business.get('latitude'),
                            'longitude': business.get('longitude')
                        },
                        'personalization_score': 1.0,
                        'reasons': ['Popular choice', 'Trending deal']
                    })
            
            return enriched_deals
            
        except Exception as e:
            print(f"Error getting popular deals: {e}")
            return []

    async def get_predictive_recommendations(
        self, 
        user_id: str, 
        prediction_context: str = "next_hour"
    ) -> List[Dict[str, Any]]:
        """Generate predictive recommendations based on user patterns"""
        try:
            # Get user behavior patterns
            profile = self.db.user_profiles.find_one({'user_id': user_id})
            if not profile:
                return []
            
            # Use AI to predict user needs
            chat = LlmChat(
                api_key=self.api_key,
                session_id=f"predict_{user_id}_{datetime.now().strftime('%Y%m%d')}"
            ).with_model("openai", "gpt-4o-mini")
            
            # Create prediction prompt
            preferences_summary = self._summarize_user_preferences(profile['preferences'])
            current_time = datetime.now()
            
            prompt = f"""Based on this user's behavior patterns, predict what deals they might need in the {prediction_context}:

User Preferences:
{preferences_summary}

Current Context:
- Time: {current_time.strftime('%A, %I:%M %p')}
- Date: {current_time.strftime('%B %d, %Y')}

Predict the types of deals, categories, or specific needs this user might have soon. Consider:
- Daily routines and patterns
- Time of day preferences
- Category preferences
- Seasonal patterns

Return predictions in JSON format:
{{
  "predictions": [
    {{"category": "restaurant", "reason": "lunch time approaching", "urgency": "high"}},
    {{"category": "coffee", "reason": "afternoon coffee routine", "urgency": "medium"}}
  ]
}}"""

            user_message = UserMessage(text=prompt)
            ai_response = await chat.send_message(user_message)
            
            try:
                predictions = json.loads(ai_response)
                return await self._find_deals_for_predictions(predictions.get('predictions', []))
            except json.JSONDecodeError:
                # Fallback to pattern-based predictions
                return await self._pattern_based_predictions(user_id, profile)
                
        except Exception as e:
            print(f"Error getting predictive recommendations: {e}")
            return []

    def _summarize_user_preferences(self, preferences: Dict) -> str:
        """Create a summary of user preferences for AI processing"""
        summary = []
        
        # Top categories
        categories = preferences.get('categories', {})
        if categories:
            top_categories = sorted(categories.items(), key=lambda x: x[1], reverse=True)[:3]
            summary.append(f"Preferred categories: {', '.join([cat for cat, _ in top_categories])}")
        
        # Top keywords
        keywords = preferences.get('keywords', {})
        if keywords:
            top_keywords = sorted(keywords.items(), key=lambda x: x[1], reverse=True)[:5]
            summary.append(f"Interest keywords: {', '.join([kw for kw, _ in top_keywords])}")
        
        # Time patterns
        time_patterns = preferences.get('time_patterns', {})
        if time_patterns:
            active_times = sorted(time_patterns.items(), key=lambda x: x[1], reverse=True)[:2]
            summary.append(f"Most active times: {', '.join([time for time, _ in active_times])}")
        
        return '\n'.join(summary) if summary else "Limited preference data available"

    async def _find_deals_for_predictions(self, predictions: List[Dict]) -> List[Dict[str, Any]]:
        """Find actual deals matching AI predictions"""
        predicted_deals = []
        
        for prediction in predictions[:3]:  # Limit to top 3 predictions
            category = prediction.get('category', '')
            
            # Find deals in predicted category
            category_deals = list(
                self.db.discounts.find({
                    'status': 'active',
                    '$or': [
                        {'title': {'$regex': category, '$options': 'i'}},
                        {'description': {'$regex': category, '$options': 'i'}}
                    ]
                }).limit(2)
            )
            
            for deal in category_deals:
                business = self.db.businesses.find_one({'id': deal['business_id']})
                if business:
                    predicted_deals.append({
                        'id': deal['id'],
                        'title': deal['title'],
                        'description': deal['description'],
                        'discount_value': deal['discount_value'],
                        'discount_type': deal['discount_type'],
                        'expires_at': deal['expires_at'].isoformat() if deal.get('expires_at') else None,
                        'business': {
                            'id': business['id'],
                            'name': business['name'],
                            'category': business['category']
                        },
                        'prediction_reason': prediction.get('reason', 'Predicted based on your patterns'),
                        'urgency': prediction.get('urgency', 'medium')
                    })
        
        return predicted_deals

    async def _pattern_based_predictions(self, user_id: str, profile: Dict) -> List[Dict[str, Any]]:
        """Fallback pattern-based predictions"""
        try:
            current_hour = datetime.now().hour
            current_time_slot = self._get_time_slot(current_hour)
            
            # Simple pattern-based prediction
            predicted_categories = []
            
            if current_time_slot == 'morning':
                predicted_categories = ['coffee', 'breakfast', 'bakery']
            elif current_time_slot == 'lunch':
                predicted_categories = ['restaurant', 'fast food', 'lunch']
            elif current_time_slot == 'afternoon':
                predicted_categories = ['coffee', 'snacks', 'retail']
            elif current_time_slot == 'evening':
                predicted_categories = ['restaurant', 'entertainment', 'dinner']
            
            # Find deals for predicted categories
            deals = []
            for category in predicted_categories:
                category_deals = list(
                    self.db.discounts.find({
                        'status': 'active',
                        '$or': [
                            {'title': {'$regex': category, '$options': 'i'}},
                            {'description': {'$regex': category, '$options': 'i'}}
                        ]
                    }).limit(1)
                )
                deals.extend(category_deals)
            
            # Enrich and return
            enriched_deals = []
            for deal in deals:
                business = self.db.businesses.find_one({'id': deal['business_id']})
                if business:
                    enriched_deals.append({
                        'id': deal['id'],
                        'title': deal['title'],
                        'description': deal['description'],
                        'discount_value': deal['discount_value'],
                        'discount_type': deal['discount_type'],
                        'expires_at': deal['expires_at'].isoformat() if deal.get('expires_at') else None,
                        'business': {
                            'id': business['id'],
                            'name': business['name'],
                            'category': business['category']
                        },
                        'prediction_reason': f'Predicted for {current_time_slot} activities',
                        'urgency': 'medium'
                    })
            
            return enriched_deals
            
        except Exception as e:
            print(f"Error in pattern-based predictions: {e}")
            return []

# Global instance
personalization_engine = HyperPersonalizationEngine()