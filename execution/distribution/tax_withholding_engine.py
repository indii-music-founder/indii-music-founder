import json
import sys
import os
import re
import datetime

class TaxComplianceOfficer:
    def __init__(self, treaty_path, compliance_store):
        self.treaty_path = treaty_path
        self.compliance_store = compliance_store
        self.treaties = self._load_treaties()
        self.compliance = self._load_compliance()

    def _load_treaties(self):
        with open(self.treaty_path, 'r') as f:
            return json.load(f)["treaties"]

    def _load_compliance(self):
        if os.path.exists(self.compliance_store):
            with open(self.compliance_store, 'r') as f:
                return json.load(f)
        return {"users": {}}

    def _save_compliance(self):
        with open(self.compliance_store, 'w') as f:
            json.dump(self.compliance, f, indent=2)

    def route_form_type(self, is_us_person, is_entity):
        """
        Logic Gate: Determine which form the user needs.
        """
        if is_us_person:
            return "W-9"
        else:
            return "W-8BEN-E" if is_entity else "W-8BEN"

    def validate_tin(self, tin, country):
        """
        V3 Forensic TIN Validation.
        Verifies format based on country residence to prevent TIN Match Fail.
        """
        if not tin:
            return False, "Missing TIN"
            
        if country == "US":
            # SSN (999-99-9999) or EIN (99-9999999)
            if re.match(r'^\d{3}-\d{2}-\d{4}$', tin) or re.match(r'^\d{2}-\d{7}$', tin):
                return True, "Valid US TIN Format"
            return False, "TIN Match Fail: Invalid US SSN/EIN format"
            
        if country in ["UK", "DE", "FR", "CA", "JP"]:
            # Foreign TIN format (mock check for length and alphanumeric)
            if len(tin) >= 8 and tin.isalnum():
                return True, "Valid Foreign TIN Format"
            return False, "TIN Match Fail: Invalid Foreign FTIN format"
            
        return len(tin) >= 5, "Generic TIN validation applied"

    def check_compliance(self, user_id):
        user = self.compliance["users"].get(user_id)
        if not user:
            return "HELD", "Missing tax profile."
        
        if not user.get("certified"):
            return "HELD", "Missing perjury statement certification."
            
        if not user.get("tin_valid"):
            return "HELD", "TIN Match Fail: Tax ID verification failed."
            
        return "ACTIVE", "Tax documentation verified."

    def calculate_withholding(self, user_id, income_amount, income_type="royalties_copyright"):
        user = self.compliance["users"].get(user_id)
        
        # 1. Check Compliance (Lock Trigger)
        status, msg = self.check_compliance(user_id)
        
        # Default behavior: 30% if uncertified/invalid
        country = user.get("country", "DEFAULT") if user else "DEFAULT"
        treaty = self.treaties.get(country, self.treaties["DEFAULT"])
        
        if status == "HELD":
            return {
                "user_id": user_id,
                "status": "HELD",
                "withholding_rate": 30.0,
                "withheld_amount": income_amount * 0.30,
                "payable_amount": 0.0, # Payout Locked
                "reason": msg
            }

        rate = treaty["rates"].get(income_type, 30.0) / 100.0

        return {
            "user_id": user_id,
            "status": "ACTIVE",
            "country": country,
            "treaty_article": treaty.get("treaty_article"),
            "withholding_rate": rate * 100,
            "withheld_amount": income_amount * rate,
            "payable_amount": income_amount * (1 - rate)
        }

    def certify_user(self, user_id, data):
        """
        V3 Certification Wizard.
        Requires signature under penalties of perjury and valid TIN.
        """
        is_us = data.get("is_us_person", False)
        is_entity = data.get("is_entity", False)
        country = data.get("country", "DEFAULT")
        tin = data.get("tin", "")
        
        form = self.route_form_type(is_us, is_entity)
        tin_valid, tin_msg = self.validate_tin(tin, country)
        
        certified = data.get("signed_under_perjury", False) and tin_valid
        
        user_record = {
            "user_id": user_id,
            "form_type": form,
            "country": country,
            "tin": tin,
            "tin_valid": tin_valid,
            "tin_message": tin_msg,
            "certified": certified,
            "payout_status": "ACTIVE" if certified else "HELD",
            "cert_timestamp": datetime.datetime.now().isoformat() if certified else None
        }
        
        self.compliance["users"][user_id] = user_record
        self._save_compliance()
        return user_record

if __name__ == "__main__":
    treaty_file = "/Volumes/X SSD 2025/Users/narrowchannel/Desktop/indiiOS-Alpha-Electron/resources/finance/tax_treaties.json"
    store_file = "/Volumes/X SSD 2025/Users/narrowchannel/Desktop/indiiOS-Alpha-Electron/tax_compliance_store.json"
    
    officer = TaxComplianceOfficer(treaty_file, store_file)
    
    if len(sys.argv) < 2:
        print(json.dumps({"error": "No command provided"}))
        sys.exit(1)

    cmd = sys.argv[1]
    
    if cmd == "certify":
        # python3 ... certify "usr_123" '{"is_us_person": false, "country": "UK", "tin": "12345678", "signed_under_perjury": true}'
        user_id = sys.argv[2]
        data = json.loads(sys.argv[3])
        print(json.dumps(officer.certify_user(user_id, data), indent=2))
    elif cmd == "calculate":
        # python3 ... calculate "usr_123" 1000
        user_id = sys.argv[2]
        amount = float(sys.argv[3])
        print(json.dumps(officer.calculate_withholding(user_id, amount), indent=2))
