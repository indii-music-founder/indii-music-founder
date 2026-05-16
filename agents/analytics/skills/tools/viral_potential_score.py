import argparse
import random
import json

def calculate_viral_score(bpm, genre, mood):
    # Simulated viral scoring logic
    base_score = 50
    
    # BPM Influence (Fast tracks tend to go viral on TikTok)
    if bpm > 120:
        base_score += 15
    elif bpm < 90:
        base_score += 5
        
    # Genre Influence
    pop_genres = ["pop", "hip-hop", "phonk", "afrobeats"]
    if genre.lower() in pop_genres:
        base_score += 20
        
    # Random Variance (The "Luck" factor)
    variance = random.randint(-10, 15)
    final_score = min(100, max(0, base_score + variance))
    
    return {
        "viral_score": final_score,
        "platform_breakdown": {
            "tiktok": min(100, final_score + 10),
            "reels": min(100, final_score + 5),
            "shorts": final_score
        },
        "recommendation": "High" if final_score > 75 else "Medium" if final_score > 50 else "Low"
    }

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Calculate the viral potential score for a track.")
    parser.add_argument("--bpm", type=int, required=True)
    parser.add_argument("--genre", type=str, required=True)
    parser.add_argument("--mood", type=str, required=True)
    args = parser.parse_args()
    
    result = calculate_viral_score(args.bpm, args.genre, args.mood)
    print(json.dumps(result, indent=2))
