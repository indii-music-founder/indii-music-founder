import datetime
import json
import logging
import os
import re
import sys
from typing import Any, Dict, Tuple

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("tax_engine")


class TaxComplianceOfficer:
    """Manages tax compliance, treaty application, and withholding calculations.

    This engine handles IRS form routing (W-9, W-8BEN, W-8BEN-E),
    TIN validation, and treaty rate application based on a local treaty database.
    """

    def __init__(self, treaty_path: str, compliance_store: str):
        """Initializes the TaxComplianceOfficer.

        Args:
            treaty_path: Path to the JSON file containing tax treaty data.
            compliance_store: Path to the JSON file where user compliance data is persisted.
        """
        self.treaty_path = treaty_path
        self.compliance_store = compliance_store
        self.treaties = self._load_treaties()
        self.compliance_data = self._load_compliance()

    def _load_treaties(self) -> Dict[str, Any]:
        """Loads treaty data from the specified path."""
        try:
            if not os.path.exists(self.treaty_path):
                logger.warning(
                    f"Treaty file not found at {
                        self.treaty_path}. Loading defaults.")
                return {
                    "DEFAULT": {
                        "rates": {
                            "royalties_copyright": 30.0},
                        "treaty_article": "None"}}
            with open(self.treaty_path, 'r') as f:
                data = json.load(f)
                return data.get("treaties", {})
        except Exception as e:
            logger.error(f"Failed to load treaty file: {e}")
            return {
                "DEFAULT": {
                    "rates": {
                        "royalties_copyright": 30.0},
                    "treaty_article": "None"}}

    def _load_compliance(self) -> Dict[str, Any]:
        """Loads user compliance data from the specified store."""
        try:
            if os.path.exists(self.compliance_store):
                with open(self.compliance_store, 'r') as f:
                    return json.load(f)
        except Exception as e:
            logger.error(f"Failed to load compliance store: {e}")
        return {"users": {}}

    def _save_compliance(self) -> None:
        """Persists compliance data to the store."""
        try:
            with open(self.compliance_store, 'w') as f:
                json.dump(self.compliance_data, f, indent=2)
        except Exception as e:
            logger.error(f"Failed to save compliance data: {e}")

    def route_form_type(self, is_us_person: bool, is_entity: bool) -> str:
        """Determines the appropriate tax form type (W-9, W-8BEN, W-8BEN-E)."""
        if is_us_person:
            return "W-9"
        return "W-8BEN-E" if is_entity else "W-8BEN"

    def validate_tin(self, tin: str, country: str) -> Tuple[bool, str]:
        """Validates Tax Identification Number formats based on country.

        Args:
            tin: The Tax ID string.
            country: Two-letter ISO country code.

        Returns:
            A tuple of (is_valid, message).
        """
        if not tin or not tin.strip():
            return False, "TIN Match Fail: TIN is missing or empty."

        tin = tin.strip()

        if country == "US":
            # SSN (999-99-9999) or EIN (99-9999999)
            if re.match(
                    r'^\d{3}-\d{2}-\d{4}$',
                    tin) or re.match(
                    r'^\d{2}-\d{7}$',
                    tin):
                return True, "Valid US TIN Format verified."
            return False, "TIN Match Fail: Invalid US SSN/EIN format (Use XXX-XX-XXXX or XX-XXXXXXX)."

        # Common foreign TIN formats (simplified)
        if country in ["UK", "DE", "FR", "CA", "JP", "AU"]:
            if len(tin) >= 8 and re.match(r'^[A-Z0-9]+$', tin):
                return True, f"Valid {country} TIN Format verified."
            return False, f"TIN Match Fail: Invalid {country} FTIN format specifications."

        # Generic fallback
        if len(tin) >= 5:
            return True, "Generic foreign TIN validation applied."
        return False, "TIN Match Fail: TIN too short for standard international verification."

    def check_payout_eligibility(self, user_id: str) -> Tuple[str, str]:
        """Checks if a user is compliant and eligible for payouts.

        Returns:
            A tuple of (status, reason). Status is either 'ACTIVE' or 'HELD'.
        """
        user = self.compliance_data["users"].get(user_id)
        if not user:
            return "HELD", "Action Required: No tax profile found for this beneficiary."

        if not user.get("certified"):
            return "HELD", (
                "Action Required: Missing certification under "
                "penalties of perjury."
            )

        if not user.get("tin_valid"):
            msg = user.get('tin_message', 'Invalid Tax ID.')
            return "HELD", f"Action Required: {msg}"

        return "ACTIVE", "Tax documentation successfully verified."

    def calculate_withholding(
        self,
        user_id: str,
        income_amount: float,
        income_type: str = "royalties_copyright"
    ) -> Dict[str, Any]:
        """Calculates effective withholding and net payable amounts.

        Args:
            user_id: The ID of the user.
            income_amount: The gross income before withholding.
            income_type: Category of income (impacts treaty rates).

        Returns:
            A report detailing the withholding calculation and payout status.
        """
        user = self.compliance_data["users"].get(user_id)
        status, msg = self.check_payout_eligibility(user_id)

        # Default behavior: 30% withholding if uncertified or invalid
        country = user.get("country", "DEFAULT") if user else "DEFAULT"
        treaty = self.treaties.get(country, self.treaties.get("DEFAULT", {}))

        if status == "HELD":
            withheld_amt = income_amount * 0.30
            return {
                "user_id": user_id,
                "status": "HELD",
                "withholding_rate": 30.0,
                "withheld_amount": float(withheld_amt),
                "payable_amount": 0.0,
                "reason": (
                    f"Payout Locked: {msg} (Fallback to 30% US Withholding)"
                )
            }

        effective_rate_percent = treaty.get("rates", {}).get(income_type, 30.0)
        rate_multiplier = effective_rate_percent / 100.0

        return {
            "user_id": user_id,
            "status": "ACTIVE",
            "country": country,
            "treaty_article": treaty.get("treaty_article", "N/A"),
            "withholding_rate": float(effective_rate_percent),
            "withheld_amount": float(income_amount * rate_multiplier),
            "payable_amount": float(income_amount * (1 - rate_multiplier))
        }

    def certify_user(self,
                     user_id: str,
                     certification_data: Dict[str,
                                              Any]) -> Dict[str,
                                                            Any]:
        """Processes a new tax certification for a user.

        Args:
            user_id: The ID of the user.
            certification_data: Dictionary containing is_us_person, is_entity, country, tin,
                                and signed_under_perjury flag.

        Returns:
            The updated user compliance record.
        """
        is_us = certification_data.get("is_us_person", False)
        is_entity = certification_data.get("is_entity", False)
        country = certification_data.get("country", "DEFAULT").upper()
        tin = certification_data.get("tin", "")
        signed = certification_data.get("signed_under_perjury", False)

        form = self.route_form_type(is_us, is_entity)
        tin_valid, tin_msg = self.validate_tin(tin, country)

        # User is only fully certified if TIN is valid AND perjury signed
        certified = signed and tin_valid

        user_record = {
            "user_id": user_id,
            "form_type": form,
            "country": country,
            "tin_masked": f"...{tin[-4:]}" if len(tin) > 4 else "***",
            "tin": tin,  # Stored securely in this mock store
            "tin_valid": tin_valid,
            "tin_message": tin_msg,
            "certified": certified,
            "payout_status": "ACTIVE" if certified else "HELD",
            "cert_timestamp": datetime.datetime.now().isoformat() if certified else None
        }

        self.compliance_data["users"][user_id] = user_record
        self._save_compliance()
        logger.info(
            f"Certified user {user_id}: Status={
                user_record['payout_status']}")

        return user_record


if __name__ == "__main__":
    # Base paths
    BASE_DIR = os.path.dirname(
        os.path.dirname(
            os.path.dirname(
                os.path.abspath(__file__))))
    TREATY_FILE = os.path.join(BASE_DIR, "resources/finance/tax_treaties.json")
    STORE_FILE = os.path.join(BASE_DIR, "tax_compliance_store.json")

    officer = TaxComplianceOfficer(TREATY_FILE, STORE_FILE)

    if len(sys.argv) < 2:
        print(json.dumps(
            {"error": "Usage: tax_engine.py [certify|calculate] ..."}))
        sys.exit(1)

    command = sys.argv[1].lower()

    try:
        if command == "certify":
            # Usage: python3 tax_engine.py certify "usr_123" '{"is_us_person":
            # false, ...}'
            uid = sys.argv[2]
            payload = json.loads(sys.argv[3])
            result = officer.certify_user(uid, payload)
            print(json.dumps(result, indent=2))

        elif command == "calculate":
            # Usage: python3 tax_engine.py calculate "usr_123" 1500.50
            uid = sys.argv[2]
            amt = float(sys.argv[3])
            result = officer.calculate_withholding(uid, amt)
            print(json.dumps(result, indent=2))
        else:
            print(json.dumps({"error": f"Unknown command: {command}"}))
            sys.exit(1)

    except Exception as e:
        logger.exception("Tax Engine Execution Error")
        print(json.dumps({"error": str(e)}))
        sys.exit(1)
