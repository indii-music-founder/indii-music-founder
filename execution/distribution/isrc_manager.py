import json
import sys
import os
import datetime

class IdentityManager:
    def __init__(self, store_path):
        self.store_path = store_path
        self.data = self._load_data()

    def _load_data(self):
        defaults = {"isrc_count": 0, "upc_count": 0, "registry": {}}
        if os.path.exists(self.store_path):
            try:
                with open(self.store_path, 'r') as f:
                    data = json.load(f)
                    # Merge defaults to handle missing keys in existing files
                    for k, v in defaults.items():
                        if k not in data:
                            data[k] = v
                    return data
            except (json.JSONDecodeError, ValueError):
                return defaults
        return defaults

    def _save_data(self):
        with open(self.store_path, 'w') as f:
            json.dump(self.data, f, indent=2)

    def generate_isrc(self, country="US", registrant="XXX"):
        """
        Generates a new ISRC: CC-XXX-YY-NNNNN
        """
        year = datetime.datetime.now().strftime("%y")
        self.data["isrc_count"] += 1
        seq = str(self.data["isrc_count"]).zfill(5)
        isrc = f"{country}-{registrant}-{year}-{seq}"
        return isrc

    def generate_upc(self, prefix="1234567"):
        """
        Generates a mock 12-digit UPC.
        """
        self.data["upc_count"] += 1
        seq = str(self.data["upc_count"]).zfill(4)
        upc = f"{prefix}{seq}".zfill(12)
        return upc

    def register_release(self, release_id, metadata):
        isrcs = []
        for track in metadata.get("tracks", []):
            isrc = self.generate_isrc()
            track["isrc"] = isrc
            isrcs.append(isrc)
        
        upc = self.generate_upc()
        metadata["upc"] = upc
        
        self.data["registry"][release_id] = {
            "metadata": metadata,
            "created_at": datetime.datetime.now().isoformat(),
            "upc": upc,
            "isrcs": isrcs
        }
        self._save_data()
        return metadata

if __name__ == "__main__":
    store = "/Volumes/X SSD 2025/Users/narrowchannel/Desktop/indiiOS-Alpha-Electron/distribution-store.json"
    manager = IdentityManager(store)
    
    if len(sys.argv) < 2:
        print(json.dumps({"error": "No command provided (generate_isrc, generate_upc, register)"}))
        sys.exit(1)

    cmd = sys.argv[1]
    if cmd == "register":
        metadata = json.loads(sys.argv[2])
        rid = sys.argv[3] if len(sys.argv) > 3 else "REL-" + datetime.datetime.now().strftime("%Y%m%d%H%M%S")
        print(json.dumps(manager.register_release(rid, metadata), indent=2))
    elif cmd == "generate_isrc":
        print(manager.generate_isrc())
        manager._save_data()
    elif cmd == "generate_upc":
        print(manager.generate_upc())
        manager._save_data()
