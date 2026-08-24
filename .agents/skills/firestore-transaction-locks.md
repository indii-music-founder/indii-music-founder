# Firestore Transaction Locks
Outlines the strict rules for Firestore concurrency, detailing how the loop engine implements transaction retries, lock deadlines (20 seconds), and timeout handling (270-second execution / 60-second idle limit).
