import os
import sys
from execution.distribution.tax_withholding_engine import TaxComplianceOfficer

# Dynamic path resolution to project root
BASE_DIR = os.path.dirname(
    os.path.dirname(
        os.path.dirname(
            os.path.abspath(__file__))))
sys.path.append(BASE_DIR)


def test_v3_compliance():
    """Runs a series of tests against the TaxWithholdingEngine to verify compliance logic."""

    TREATY_FILE = os.path.join(BASE_DIR, "resources/finance/tax_treaties.json")
    STORE_FILE = os.path.join(BASE_DIR, "tax_compliance_store_test.json")

    # Clean up test store if exists
    if os.path.exists(STORE_FILE):
        os.remove(STORE_FILE)

    engine = TaxComplianceOfficer(TREATY_FILE, STORE_FILE)

    passed = 0
    total = 0

    def assert_test(name, condition, msg):
        nonlocal passed, total
        total += 1
        if condition:
            passed += 1
            print(f"✅ PASS: {name} - {msg}")
        else:
            print(f"❌ FAIL: {name} - {msg}")

    print("\n" + "=" * 80)
    print(" V3 TAX COMPLIANCE INTEGRATION TEST ")
    print("=" * 80)

    # 1. Test US TIN Format Validation
    valid_us, msg_us = engine.validate_tin("12-3456789", "US")
    assert_test("US EIN Validation", valid_us, msg_us)

    invalid_us, msg_us_inv = engine.validate_tin("12345", "US")
    assert_test("Invalid US TIN", not invalid_us, msg_us_inv)

    # 2. Test "TIN Match Fail" Payout Lock
    user_data = {
        "is_us_person": True,
        "country": "US",
        "tin": "INVALID_TIN",
        "signed_under_perjury": True
    }
    cert = engine.certify_user("user_fraud_123", user_data)
    assert_test(
        "Fraud Certification Lock",
        cert['payout_status'] == "HELD",
        f"Status: {cert['payout_status']}"
    )

    payout = engine.calculate_withholding("user_fraud_123", 1000.0)
    assert_test(
        "Payout Lock Verification",
        payout['status'] == "HELD" and payout['payable_amount'] == 0,
        f"Payable: {payout['payable_amount']}"
    )

    # 3. Test Missing Perjury Statement Lock
    user_data_2 = {
        "is_us_person": False,
        "country": "UK",
        "tin": "ABC12345678",
        "signed_under_perjury": False
    }
    cert_2 = engine.certify_user("user_unsigned_456", user_data_2)
    assert_test(
        "Unsigned Perjury Lock",
        cert_2['payout_status'] == "HELD",
        f"Certified: {cert_2['certified']}"
    )

    payout_2 = engine.calculate_withholding("user_unsigned_456", 1000.0)
    assert_test(
        "Unsigned Payout Reason",
        "Missing certification" in payout_2['reason'],
        payout_2['reason'])

    # 4. Test Success (UK Individual with Treaty)
    user_data_3 = {
        "is_us_person": False,
        "country": "UK",
        "tin": "GBA123456789",
        "signed_under_perjury": True
    }
    engine.certify_user("user_legal_789", user_data_3)
    payout_3 = engine.calculate_withholding("user_legal_789", 1000.0)
    assert_test(
        "UK Treaty Application",
        payout_3['status'] == "ACTIVE" and payout_3['withholding_rate'] == 0,
        f"Rate: {payout_3['withholding_rate']}%"
    )

    print("\n" + "=" * 80)
    print(f"TEST SUMMARY: {passed}/{total} Passed")
    print("=" * 80 + "\n")

    # Cleanup
    if os.path.exists(STORE_FILE):
        os.remove(STORE_FILE)


if __name__ == "__main__":
    test_v3_compliance()
