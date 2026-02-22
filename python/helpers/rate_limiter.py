import time
from collections import defaultdict

class RateLimiter:
    """
    Task 6: Sovereign Engine Rate Limiting.
    Prevents account flagging by enforcing "Cooling Periods" per domain.
    """
    
    # Policies (Requests per Minute)
    POLICIES = {
        "ascap.com": 5,
        "bmi.com": 5,
        "spotify.com": 20,
        "indii_video_gen": 3,
        "indii_image_gen": 10,
        "gemini": 15,
        "default": 10
    }
    
    def __init__(self):
        self.history = defaultdict(list)
        
    def can_proceed(self, domain):
        policy_limit = self.POLICIES.get(domain, self.POLICIES["default"])
        window = 60 # seconds
        
        now = time.time()
        # Clean history
        self.history[domain] = [t for t in self.history[domain] if now - t < window]
        
        if len(self.history[domain]) < policy_limit:
            self.history[domain].append(now)
            return True
        else:
            return False
            
    def wait_time(self, domain):
        if self.can_proceed(domain):
            return 0
        
        # Calculate time until oldest request expires
        oldest = min(self.history[domain])
        return 60 - (time.time() - oldest)
