import sqlite3
import os
import time

class DistributionStateMachine:
    """
    Task 5: Distribution State Machine.
    Persistent ledger for tracking release lifecycles across DSPs.
    Statuses: DRAFT -> VALIDATED -> UPLOADING -> SENT -> LIVE -> TAKEDOWN
    """
    
    DB_PATH = os.path.join(os.getcwd(), "distribution.db")
    
    def __init__(self):
        self._init_db()
        
    def _init_db(self):
        conn = sqlite3.connect(self.DB_PATH)
        c = conn.cursor()
        c.execute('''CREATE TABLE IF NOT EXISTS releases
                     (upc TEXT PRIMARY KEY, title TEXT, artist TEXT, status TEXT, last_updated REAL)''')
        c.execute('''CREATE TABLE IF NOT EXISTS dsp_status
                     (upc TEXT, dsp_name TEXT, status TEXT, timestamp REAL, 
                      FOREIGN KEY(upc) REFERENCES releases(upc))''')
        conn.commit()
        conn.close()

    def create_release(self, upc, title, artist):
        conn = sqlite3.connect(self.DB_PATH)
        c = conn.cursor()
        try:
            c.execute("INSERT INTO releases VALUES (?, ?, ?, ?, ?)", 
                      (upc, title, artist, "DRAFT", time.time()))
            conn.commit()
            return True
        except sqlite3.IntegrityError:
            return False
        finally:
            conn.close()

    def update_status(self, upc, new_status, dsp=None):
        conn = sqlite3.connect(self.DB_PATH)
        c = conn.cursor()
        
        if dsp:
            c.execute("INSERT OR REPLACE INTO dsp_status VALUES (?, ?, ?, ?)",
                      (upc, dsp, new_status, time.time()))
        else:
            c.execute("UPDATE releases SET status = ?, last_updated = ? WHERE upc = ?",
                      (new_status, time.time(), upc))
            
        conn.commit()
        conn.close()

    def get_status(self, upc):
        conn = sqlite3.connect(self.DB_PATH)
        c = conn.cursor()
        c.execute("SELECT * FROM releases WHERE upc = ?", (upc,))
        release = c.fetchone()
        
        c.execute("SELECT * FROM dsp_status WHERE upc = ?", (upc,))
        dsps = c.fetchall()
        
        conn.close()
        
        if not release:
            return None
            
        return {
            "upc": release[0],
            "title": release[1],
            "global_status": release[3],
            "dsp_breakdown": {row[1]: row[2] for row in dsps}
        }
