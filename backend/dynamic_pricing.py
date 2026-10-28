import os
import asyncio
import json
import math
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any, Tuple
from collections import defaultdict
from dotenv import load_dotenv
from emergentintegrations.llm.chat import LlmChat, UserMessage
from pymongo import MongoClient
import statistics
import random

load_dotenv()

class DynamicPricingEngine:
    def __init__(self):
        self.api_key = os.getenv("EMERGENT_LLM_KEY")
        self.mongo_url = os.getenv("MONGO_URL")
        self.client = MongoClient(self.mongo_url)
        self.db = self.client.coupon_app
        
        # Pricing algorithm weights
        self.pricing_factors = {
            'demand_surge': 0.25,      # High demand = higher prices
            'time_of_day': 0.20,       # Peak hours vs off-peak
            'day_of_week': 0.15,       # Weekend vs weekday
            'seasonal': 0.10,          # Seasonal trends
            'competition': 0.15,       # Competitive pricing
            'user_segment': 0.10,      # User price sensitivity
            'inventory': 0.05          # Stock/capacity levels
        }
        
        # User segments based on behavior
        self.user_segments = {
            'price_sensitive': {'discount_multiplier': 1.2, 'max_discount': 0.5},
            'premium': {'discount_multiplier': 0.8, 'max_discount': 0.3},
            'regular': {'discount_multiplier': 1.0, 'max_discount': 0.4},
            'new_customer': {'discount_multiplier': 1.3, 'max_discount': 0.6}
        }

    async def calculate_dynamic_price(
        self, 
        discount_id: str, 
        user_id: Optional[str] = None,
        context: Dict[str, Any] = None
    ) -> Dict[str, Any]:
        """Calculate dynamic pricing for a discount"""
        try:
            # Get discount and business data
            discount = self.db.discounts.find_one({'id': discount_id})
            if not discount:
                return {'error': 'Discount not found'}
            
            business = self.db.businesses.find_one({'id': discount['business_id']})
            if not business:
                return {'error': 'Business not found'}
            
            # Get base discount value
            base_discount = discount['discount_value']
            discount_type = discount['discount_type']
            
            # Calculate demand score
            demand_score = await self._calculate_demand_score(discount_id, business['id'])
            
            # Calculate time-based factors
            time_factors = self._calculate_time_factors()
            
            # Calculate competitive factors
            competitive_factor = await self._calculate_competitive_factor(
                business['category'], discount['discount_value']
            )
            
            # Calculate user segment factor
            user_factor = await self._calculate_user_segment_factor(user_id) if user_id else 1.0
            
            # Apply pricing algorithm
            price_multiplier = (
                1.0 + 
                (demand_score - 0.5) * self.pricing_factors['demand_surge'] +
                (time_factors['peak_factor'] - 0.5) * self.pricing_factors['time_of_day'] +
                (time_factors['weekend_factor'] - 0.5) * self.pricing_factors['day_of_week'] +
                (competitive_factor - 1.0) * self.pricing_factors['competition'] +
                (user_factor - 1.0) * self.pricing_factors['user_segment']
            )
            
            # Calculate new discount value
            if discount_type == 'percentage':
                new_discount = max(5, min(70, base_discount * price_multiplier))  # 5-70% range
            else:
                new_discount = max(1, base_discount * price_multiplier)  # Minimum $1
            
            # Calculate price change percentage
            price_change = ((new_discount - base_discount) / base_discount) * 100
            
            # Store pricing history
            await self._store_pricing_history(
                discount_id, base_discount, new_discount, price_multiplier, {
                    'demand_score': demand_score,
                    'time_factors': time_factors,
                    'competitive_factor': competitive_factor,
                    'user_factor': user_factor,
                    'user_id': user_id
                }
            )
            
            return {
                'success': True,
                'discount_id': discount_id,
                'original_value': base_discount,
                'dynamic_value': round(new_discount, 2),
                'discount_type': discount_type,
                'price_change_percent': round(price_change, 1),
                'factors': {
                    'demand_score': round(demand_score, 3),
                    'time_peak_factor': round(time_factors['peak_factor'], 3),
                    'weekend_factor': round(time_factors['weekend_factor'], 3),
                    'competitive_factor': round(competitive_factor, 3),
                    'user_segment_factor': round(user_factor, 3),
                    'final_multiplier': round(price_multiplier, 3)
                },
                'recommendation': self._get_pricing_recommendation(price_change, demand_score),
                'expires_at': discount['expires_at'].isoformat() if discount.get('expires_at') else None,
                'updated_at': datetime.now().isoformat()
            }
            
        except Exception as e:
            print(f"Error calculating dynamic price: {e}")
            return {'error': str(e)}

    async def _calculate_demand_score(self, discount_id: str, business_id: str) -> float:
        """Calculate demand score based on usage patterns"""
        try:
            now = datetime.now()
            week_ago = now - timedelta(days=7)
            
            # Get recent usage data
            recent_usage = list(self.db.coupon_usage.find({
                'discount_id': discount_id,
                'used_at': {'$gte': week_ago}
            }))
            
            # Get business average usage
            business_avg_usage = list(self.db.coupon_usage.find({
                'business_id': business_id,
                'used_at': {'$gte': week_ago}
            }))
            
            # Calculate demand score (0.0 to 1.0)
            recent_count = len(recent_usage)
            avg_count = len(business_avg_usage) / max(1, len(list(self.db.discounts.find({'business_id': business_id}))))
            
            # Normalize demand score
            if avg_count == 0:
                demand_score = 0.5  # Default middle score
            else:
                demand_score = min(1.0, recent_count / (avg_count * 2))
            
            # Add trending factor
            daily_usage = defaultdict(int)
            for usage in recent_usage:
                day = usage['used_at'].date()
                daily_usage[day] += 1
            
            if len(daily_usage) >= 3:
                usage_values = list(daily_usage.values())
                trend_factor = (usage_values[-1] - usage_values[0]) / max(1, usage_values[0])
                demand_score += trend_factor * 0.1  # Small trend boost
            
            return max(0.0, min(1.0, demand_score))
            
        except Exception as e:
            print(f"Error calculating demand score: {e}")
            return 0.5

    def _calculate_time_factors(self) -> Dict[str, float]:
        """Calculate time-based pricing factors"""
        now = datetime.now()
        hour = now.hour
        weekday = now.weekday()  # 0=Monday, 6=Sunday
        
        # Peak hours factor (0.0 to 1.0)
        if 11 <= hour <= 13:  # Lunch peak
            peak_factor = 1.0
        elif 17 <= hour <= 19:  # Dinner peak
            peak_factor = 1.0
        elif 8 <= hour <= 10:  # Morning
            peak_factor = 0.7
        elif 19 <= hour <= 21:  # Evening
            peak_factor = 0.8
        else:  # Off-peak
            peak_factor = 0.3
        
        # Weekend factor (0.0 to 1.0)
        if weekday >= 5:  # Weekend
            weekend_factor = 1.0
        elif weekday == 4:  # Friday
            weekend_factor = 0.8
        else:  # Weekdays
            weekend_factor = 0.4
        
        return {
            'peak_factor': peak_factor,
            'weekend_factor': weekend_factor,
            'hour': hour,
            'weekday': weekday
        }

    async def _calculate_competitive_factor(self, category: str, base_discount: float) -> float:
        """Calculate competitive pricing factor"""
        try:
            # Get similar discounts in the same category
            similar_discounts = list(self.db.discounts.find({
                'business_id': {'$ne': None},
                'status': 'active',
                'expires_at': {'$gt': datetime.now()}
            }))
            
            # Filter by category through business lookup
            category_discounts = []
            for discount in similar_discounts:
                business = self.db.businesses.find_one({'id': discount['business_id']})
                if business and business.get('category') == category:
                    category_discounts.append(discount['discount_value'])
            
            if not category_discounts:
                return 1.0
            
            # Calculate competitive position
            avg_discount = statistics.mean(category_discounts)
            median_discount = statistics.median(category_discounts)
            
            # If our discount is below average, increase it (factor > 1)
            # If our discount is above average, decrease it (factor < 1)
            if avg_discount == 0:
                return 1.0
            
            competitive_factor = avg_discount / max(1, base_discount)
            return max(0.5, min(1.5, competitive_factor))
            
        except Exception as e:
            print(f"Error calculating competitive factor: {e}")
            return 1.0

    async def _calculate_user_segment_factor(self, user_id: str) -> float:
        """Calculate user segment pricing factor"""
        try:
            # Get user behavior data
            user = self.db.users.find_one({'id': user_id})
            if not user:
                return 1.0
            
            # Get user profile from personalization engine
            user_profile = self.db.user_profiles.find_one({'user_id': user_id})
            
            # Calculate user segment
            segment = self._determine_user_segment(user, user_profile)
            
            return self.user_segments[segment]['discount_multiplier']
            
        except Exception as e:
            print(f"Error calculating user segment factor: {e}")
            return 1.0

    def _determine_user_segment(self, user: Dict, profile: Dict = None) -> str:
        """Determine user pricing segment"""
        # Default to regular
        if not user:
            return 'regular'
        
        # New customer (less than 30 days old)
        created_at = user.get('created_at')
        if created_at:
            if isinstance(created_at, str):
                created_at = datetime.fromisoformat(created_at)
            
            if (datetime.now() - created_at).days < 30:
                return 'new_customer'
        
        # Premium user (high activity, high savings)
        total_savings = user.get('total_savings', 0)
        deals_used = user.get('deals_used', 0)
        
        if total_savings > 500 and deals_used > 20:
            return 'premium'
        
        # Price sensitive (high deal usage, preference data)
        if profile:
            behavior_score = profile.get('behavior_score', 0)
            if behavior_score > 100 and deals_used > 10:
                # Check for price-sensitive keywords in search history
                keywords = profile.get('preferences', {}).get('keywords', {})
                price_keywords = ['cheap', 'discount', 'sale', 'deal', 'bargain', 'savings']
                
                price_search_score = sum(keywords.get(kw, 0) for kw in price_keywords)
                if price_search_score > 5:
                    return 'price_sensitive'
        
        return 'regular'

    async def _store_pricing_history(
        self, 
        discount_id: str, 
        original_price: float, 
        dynamic_price: float,
        multiplier: float,
        factors: Dict
    ):
        """Store pricing history for analytics"""
        try:
            pricing_record = {
                'discount_id': discount_id,
                'original_price': original_price,
                'dynamic_price': dynamic_price,
                'price_multiplier': multiplier,
                'factors': factors,
                'timestamp': datetime.now(),
                'hour': datetime.now().hour,
                'day_of_week': datetime.now().weekday(),
                'date': datetime.now().date().isoformat()
            }
            
            self.db.pricing_history.insert_one(pricing_record)
            
        except Exception as e:
            print(f"Error storing pricing history: {e}")

    def _get_pricing_recommendation(self, price_change: float, demand_score: float) -> str:
        """Get AI-powered pricing recommendation"""
        if price_change > 15:
            return "🔥 High demand detected! Premium pricing active."
        elif price_change > 5:
            return "📈 Increased demand. Optimized pricing for better revenue."
        elif price_change < -15:
            return "💰 Special discount! Low demand pricing to attract customers."
        elif price_change < -5:
            return "🎯 Competitive pricing active to boost engagement."
        else:
            return "⚖️ Balanced pricing based on current market conditions."

    async def get_demand_prediction(self, business_id: str, hours_ahead: int = 24) -> Dict[str, Any]:
        """Predict demand for the next N hours"""
        try:
            # Get historical data
            now = datetime.now()
            week_ago = now - timedelta(days=7)
            
            historical_usage = list(self.db.coupon_usage.find({
                'business_id': business_id,
                'used_at': {'$gte': week_ago}
            }))
            
            # Analyze patterns by hour
            hourly_patterns = defaultdict(list)
            for usage in historical_usage:
                hour = usage['used_at'].hour
                hourly_patterns[hour].append(1)
            
            # Calculate average usage per hour
            hourly_averages = {}
            for hour in range(24):
                usage_counts = hourly_patterns[hour]
                hourly_averages[hour] = sum(usage_counts) / max(1, len(usage_counts) / 7)  # Weekly average
            
            # Predict future demand
            predictions = []
            for i in range(hours_ahead):
                future_time = now + timedelta(hours=i)
                hour = future_time.hour
                weekday = future_time.weekday()
                
                # Base prediction from historical average
                base_demand = hourly_averages.get(hour, 0)
                
                # Weekend/weekday adjustment
                if weekday >= 5:  # Weekend
                    weekend_multiplier = 1.3
                else:
                    weekend_multiplier = 1.0
                
                predicted_demand = base_demand * weekend_multiplier
                
                # Classify demand level
                if predicted_demand >= hourly_averages.get(12, 1) * 1.5:  # Peak lunch comparison
                    demand_level = 'high'
                elif predicted_demand >= hourly_averages.get(12, 1) * 0.8:
                    demand_level = 'medium'
                else:
                    demand_level = 'low'
                
                predictions.append({
                    'timestamp': future_time.isoformat(),
                    'hour': hour,
                    'predicted_usage': round(predicted_demand, 1),
                    'demand_level': demand_level,
                    'confidence': min(0.9, len(historical_usage) / 50.0)  # More data = higher confidence
                })
            
            return {
                'success': True,
                'business_id': business_id,
                'predictions': predictions,
                'historical_average': round(sum(hourly_averages.values()) / 24, 1),
                'peak_hours': sorted(hourly_averages.items(), key=lambda x: x[1], reverse=True)[:3],
                'generated_at': now.isoformat()
            }
            
        except Exception as e:
            print(f"Error generating demand prediction: {e}")
            return {'error': str(e)}

    async def get_pricing_analytics(self, business_id: str, days: int = 7) -> Dict[str, Any]:
        """Get comprehensive pricing analytics for a business"""
        try:
            now = datetime.now()
            start_date = now - timedelta(days=days)
            
            # Get pricing history
            pricing_history = list(self.db.pricing_history.find({
                'timestamp': {'$gte': start_date}
            }))
            
            # Filter by business discounts
            business_discounts = list(self.db.discounts.find({'business_id': business_id}))
            discount_ids = [d['id'] for d in business_discounts]
            
            business_pricing = [p for p in pricing_history if p['discount_id'] in discount_ids]
            
            if not business_pricing:
                return {'error': 'No pricing data available'}
            
            # Calculate analytics
            avg_multiplier = statistics.mean([p['price_multiplier'] for p in business_pricing])
            
            # Revenue impact (estimated)
            revenue_impact = sum([
                (p['dynamic_price'] - p['original_price']) * 0.1  # Assume 10% conversion rate
                for p in business_pricing
            ])
            
            # Peak pricing times
            hourly_multipliers = defaultdict(list)
            for p in business_pricing:
                hourly_multipliers[p['hour']].append(p['price_multiplier'])
            
            peak_hours = {}
            for hour, multipliers in hourly_multipliers.items():
                peak_hours[hour] = statistics.mean(multipliers)
            
            # Demand trends
            daily_demand = defaultdict(float)
            for p in business_pricing:
                date = p['date']
                daily_demand[date] += p['factors'].get('demand_score', 0.5)
            
            return {
                'success': True,
                'business_id': business_id,
                'period': f'{days} days',
                'summary': {
                    'total_price_adjustments': len(business_pricing),
                    'average_price_multiplier': round(avg_multiplier, 3),
                    'estimated_revenue_impact': round(revenue_impact, 2),
                    'peak_pricing_frequency': len([p for p in business_pricing if p['price_multiplier'] > 1.1])
                },
                'peak_hours': dict(sorted(peak_hours.items(), key=lambda x: x[1], reverse=True)[:5]),
                'demand_trends': dict(sorted(daily_demand.items())),
                'recommendations': await self._generate_pricing_recommendations(business_pricing),
                'generated_at': now.isoformat()
            }
            
        except Exception as e:
            print(f"Error generating pricing analytics: {e}")
            return {'error': str(e)}

    async def _generate_pricing_recommendations(self, pricing_data: List[Dict]) -> List[str]:
        """Generate AI-powered pricing recommendations"""
        try:
            if not pricing_data:
                return ["Not enough data for recommendations"]
            
            recommendations = []
            
            # Analyze multiplier patterns
            avg_multiplier = statistics.mean([p['price_multiplier'] for p in pricing_data])
            
            if avg_multiplier > 1.1:
                recommendations.append("✨ Great! Your pricing is responding well to high demand periods.")
            elif avg_multiplier < 0.9:
                recommendations.append("💡 Consider reducing base prices during low-demand periods to attract more customers.")
            
            # Analyze peak hours
            hourly_data = defaultdict(list)
            for p in pricing_data:
                hourly_data[p['hour']].append(p['price_multiplier'])
            
            peak_hour = max(hourly_data.items(), key=lambda x: statistics.mean(x[1]))[0]
            recommendations.append(f"🕐 Peak pricing is most effective around {peak_hour}:00. Consider scheduling promotions during off-peak hours.")
            
            # Competitive analysis
            competitive_factors = [p['factors'].get('competitive_factor', 1.0) for p in pricing_data]
            avg_competitive = statistics.mean(competitive_factors)
            
            if avg_competitive > 1.2:
                recommendations.append("🏆 Your pricing is below market average. Consider increasing base discount values.")
            elif avg_competitive < 0.8:
                recommendations.append("⚠️ Your pricing is above market average. Monitor competitor prices closely.")
            
            return recommendations[:5]  # Limit to top 5 recommendations
            
        except Exception as e:
            print(f"Error generating recommendations: {e}")
            return ["Unable to generate recommendations at this time."]

    async def get_personalized_pricing(self, user_id: str, discount_ids: List[str]) -> List[Dict[str, Any]]:
        """Get personalized pricing for multiple discounts"""
        try:
            personalized_prices = []
            
            for discount_id in discount_ids:
                pricing_result = await self.calculate_dynamic_price(discount_id, user_id)
                if pricing_result.get('success'):
                    personalized_prices.append(pricing_result)
            
            return {
                'success': True,
                'user_id': user_id,
                'personalized_discounts': personalized_prices,
                'user_segment': await self._get_user_segment_info(user_id),
                'generated_at': datetime.now().isoformat()
            }
            
        except Exception as e:
            print(f"Error getting personalized pricing: {e}")
            return {'error': str(e)}

    async def _get_user_segment_info(self, user_id: str) -> Dict[str, Any]:
        """Get detailed user segment information"""
        try:
            user = self.db.users.find_one({'id': user_id})
            profile = self.db.user_profiles.find_one({'user_id': user_id})
            
            segment = self._determine_user_segment(user, profile)
            segment_info = self.user_segments[segment]
            
            return {
                'segment': segment,
                'discount_multiplier': segment_info['discount_multiplier'],
                'max_discount': segment_info['max_discount'],
                'description': self._get_segment_description(segment)
            }
            
        except Exception as e:
            print(f"Error getting user segment info: {e}")
            return {'segment': 'regular', 'error': str(e)}

    def _get_segment_description(self, segment: str) -> str:
        """Get human-readable segment description"""
        descriptions = {
            'price_sensitive': 'Price-conscious customer who actively seeks deals',
            'premium': 'High-value customer with strong spending patterns',
            'regular': 'Standard customer with balanced buying behavior',
            'new_customer': 'New customer eligible for welcome offers'
        }
        return descriptions.get(segment, 'Standard customer')

# Global instance
dynamic_pricing_engine = DynamicPricingEngine()