import sys
import os

# Add the project root to sys.path
sys.path.append('/Volumes/X SSD 2025/Users/narrowchannel/Desktop/indiiOS-Alpha-Electron/')

from execution.distribution.tax_withholding_engine import TaxComplianceOfficer

def test_v3_compliance():
    treaty_file = "/Volumes/X SSD 2025/Users/narrowchannel/Desktop/indiiOS-Alpha-Electron/resources/finance/tax_treaties.json"
    store_file = "/Volumes/X SSD 2025/Users/narrowchannel/Desktop/indiiOS-Alpha-Electron/tax_compliance_store.json"
    engine = TaxComplianceOfficer(treaty_file, store_file)
    
    # 1. Test US TIN Format Validation
    print("--- Testing US TIN Format ---")
    valid_us, msg_us = engine.validate_tin("12-3456789", "US")
    print(f"US EIN (Valid): {valid_us} - {msg_us}")
    
    invalid_us, msg_us_inv = engine.validate_tin("12345", "US")
    print(f"US EIN (Invalid): {invalid_us} - {msg_us_inv}")

    # 2. Test "TIN Match Fail" Payout Lock
    print("\n--- Testing TIN Match Fail Payout Lock ---")
    user_data = {
        "is_us_person": True,
        "country": "US",
        "tin": "INVALID_TIN", # Trigger fail
        "signed_under_perjury": True
    }
    cert = engine.certify_user("user_fraud_123", user_data)
    print(f"Certification Result: {cert['payout_status']} - {cert['tin_message']}")
    
    payout = engine.calculate_withholding("user_fraud_123", 1000.0)
    print(f"Payout Calculation for Invalid TIN: Status={payout['status']}, Withheld={payout['withheld_amount']}, Payable={payout['payable_amount']}")

    # 3. Test Missing Perjury Statement Lock
    print("\n--- Testing Missing Perjury Statement ---")
    user_data_2 = {
        "is_us_person": False,
        "country": "UK",
        "tin": "ABC12345678", # Valid format
        "signed_under_perjury": False # MISSING SIGNATURE
    }
    cert_2 = engine.certify_user("user_unsigned_456", user_data_2)
    print(f"Certification Result: {cert_2['payout_status']} - Certified: {cert_2['certified']}")
    
    payout_2 = engine.calculate_withholding("user_unsigned_456", 1000.0)
    print(f"Payout Calculation for Unsigned: Status={payout_2['status']}, Reason={payout_2['reason']}")

    # 4. Test Success (UK Individual with Treaty)
    print("\n--- Testing Success (UK Treaty) ---")
    user_data_3 = {
        "is_us_person": False,
        "country": "UK",
        "tin": "GBA123456789",
        "signed_under_perjury": True
    }
    engine.certify_user("user_legal_789", user_data_3)
    payout_3 = engine.calculate_withholding("user_legal_789", 1000.0)
    print(f"Success Payout (UK 0%): Status={payout_3['status']}, Rate={payout_3['withholding_rate']}%, Payable={payout_3['payable_amount']}")

if __name__ == "__main__":
    test_v3_compliance()
