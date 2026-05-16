import argparse
import json

# Mock distance data
CITIES = {
    "New York": {"lat": 40.7128, "lon": -74.0060},
    "Detroit": {"lat": 42.3314, "lon": -83.0458},
    "Chicago": {"lat": 41.8781, "lon": -87.6298},
    "Nashville": {"lat": 36.1627, "lon": -86.7816},
    "Austin": {"lat": 30.2672, "lon": -97.7431},
    "Los Angeles": {"lat": 34.0522, "lon": -118.2437}
}

def optimize_route(cities_list):
    # Basic greedy algorithm for TSP simulation
    valid_cities = [c for c in cities_list if c in CITIES]
    if not valid_cities:
        return {"error": "No valid cities found in database."}
        
    route = []
    current = valid_cities[0]
    route.append(current)
    remaining = valid_cities[1:]
    
    total_estimated_miles = 0
    
    while remaining:
        # Simplistic distance mock
        next_city = remaining.pop(0)
        route.append(next_city)
        total_estimated_miles += 350 # Mock average
        
    return {
        "optimized_route": route,
        "total_cities": len(route),
        "estimated_total_miles": total_estimated_miles,
        "logistics_note": "Ensure van maintenance before long haul segments."
    }

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Optimize a tour route based on a list of cities.")
    parser.add_argument("--cities", type=str, help="Comma-separated list of cities")
    args = parser.parse_args()
    
    city_list = [c.strip() for c in args.cities.split(",")]
    result = optimize_route(city_list)
    print(json.dumps(result, indent=2))
