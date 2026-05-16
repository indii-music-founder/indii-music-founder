import sys
import json

def format_post(content):
    return {
        "instagram": content[:2200],  # IG limit
        "twitter": content[:280],     # X limit
        "tiktok": content[:150],      # Short caption preference
        "hashtags": ["#indii", "#musicbusiness", "#independent"]
    }

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Usage: post_formatter.py <content>"}))
        sys.exit(1)
    
    content = sys.argv[1]
    print(json.dumps(format_post(content)))
