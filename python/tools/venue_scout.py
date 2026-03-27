import json
import argparse
import os
from typing import Dict, Any, List

def scout_venues(target_city: str, expected_capacity: int, genre: str) -> Dict[str, Any]:
    """
    Road Agent venue scouting tool.
    Queries Google Places API (Text Search) for music venues in the target city,
    then enriches results with capacity estimates based on venue type.
    Falls back to a genre-aware synthetic list if the API key is not configured.
    """
    try:
        from dotenv import load_dotenv
        load_dotenv()
        
        google_maps_key = os.getenv("VITE_GOOGLE_MAPS_API_KEY") or os.getenv("GOOGLE_MAPS_API_KEY")
        
        venues = []
        source = "mock"
        
        if google_maps_key:
            import requests
            
            # Google Places Text Search for music venues
            query = f"live music venue {genre} in {target_city}"
            url = "https://maps.googleapis.com/maps/api/place/textsearch/json"
            params = {
                "query": query,
                "type": "night_club|bar|establishment",
                "key": google_maps_key
            }
            
            try:
                res = requests.get(url, params=params, timeout=10)
                if res.ok:
                    places = res.json().get("results", [])[:5]
                    source = "google_places"
                    
                    for place in places:
                        rating = place.get("rating", 0)
                        price_level = place.get("price_level", 2)
                        
                        # Estimate capacity from price level and rating
                        est_capacity = 300 + (price_level * 200) + (int(rating) * 100)
                        
                        # Estimate guarantee from capacity
                        if est_capacity < 500:
                            guarantee = f"${est_capacity * 2}"
                        elif est_capacity < 2000:
                            guarantee = f"${est_capacity * 3}"
                        else:
                            guarantee = f"${est_capacity * 5}"
                        
                        venues.append({
                            "name": place.get("name", "Unknown Venue"),
                            "address": place.get("formatted_address", ""),
                            "capacity": est_capacity,
                            "rating": rating,
                            "price_level": price_level,
                            "vibe": _classify_vibe(rating, price_level),
                            "avg_guarantee": guarantee,
                            "google_place_id": place.get("place_id", ""),
                            "open_now": place.get("opening_hours", {}).get("open_now", None)
                        })
            except Exception:
                # Fall through to mock data
                pass
        
        # Fallback: Generate synthetic venues if API didn't return results
        if not venues:
            source = "synthetic"
            if expected_capacity < 500:
                venues = [
                    {"name": f"The Local Dive {target_city}", "capacity": 250, "vibe": "Intimate", "avg_guarantee": "$500"},
                    {"name": f"{target_city} Underground", "capacity": 400, "vibe": "Gritty", "avg_guarantee": "$800"}
                ]
            elif expected_capacity < 2000:
                venues = [
                    {"name": f"The {target_city} Theater", "capacity": 1200, "vibe": "Historic", "avg_guarantee": "$2500"},
                    {"name": f"Club {genre.capitalize()}", "capacity": 1800, "vibe": "Modern", "avg_guarantee": "$4000"}
                ]
            else:
                venues = [
                    {"name": f"{target_city} Arena", "capacity": 5000, "vibe": "Massive", "avg_guarantee": "$15000"}
                ]
            
        result = {
            "status": "success",
            "source": source,
            "target_city": target_city,
            "expected_draw": expected_capacity,
            "genre_fit": genre,
            "recommended_venues": venues,
            "market_saturation_index": "Medium",
            "routing_viability": "High"
        }
        return result
    except Exception as e:
        return {"status": "error", "message": str(e)}


def _classify_vibe(rating: float, price_level: int) -> str:
    """Classify venue vibe from Google Places metadata."""
    if price_level >= 3 and rating >= 4.0:
        return "Premium"
    elif price_level >= 2 and rating >= 4.0:
        return "Modern"
    elif rating >= 4.5:
        return "Historic / Legendary"
    elif price_level <= 1:
        return "Intimate / Dive"
    else:
        return "Standard"


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Venue Scouting Tool")
    parser.add_argument("--city", type=str, required=True, help="Target city for the show")
    parser.add_argument("--capacity", type=int, required=True, help="Expected audience draw")
    parser.add_argument("--genre", type=str, required=True, help="Artist primary genre")
    
    args = parser.parse_args()
    
    result = scout_venues(args.city, args.capacity, args.genre)
    print(json.dumps(result, indent=2))
