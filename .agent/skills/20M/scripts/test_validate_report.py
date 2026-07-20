#!/usr/bin/env python3
"""Regression coverage for the 20M report/IP disclosure gate."""

import unittest

from validate_report import missing_concepts, validate


MODEL = {
    "founder_scenarios": [
        {"label": "Founder", "units": [{"count": 1, "price": 2500}], "gross_one_time_cash": 2500, "arr": 0}
    ]
}

BASE_REPORT = """
Current valuation and remediated acquisition plan. Founder cash is not ARR.
This planning valuation is not an appraisal. Intellectual property/IP asset
analysis includes an IP answer matrix and states that customer-controlled uploads are not owned platform IP.
Licensed and vendor-dependent services remain subject to chain-of-title and
assignment evidence. Source: https://example.test/evidence
"""

ROOM_REPORT = BASE_REPORT + """
What intellectual property do you own? What belongs to the artist or customer
and what do they control? What is licensed or vendor-dependent? What evidence
is available for review today? What would prevent transfer in diligence?
"""


class ValidateReportTest(unittest.TestCase):
    def test_base_report_requires_ip_boundaries(self):
        validate(BASE_REPORT, MODEL)

    def test_room_requires_all_ip_questions(self):
        validate(ROOM_REPORT, MODEL, room=True)

    def test_missing_customer_boundary_is_reported(self):
        report = BASE_REPORT.replace("customer-controlled uploads are not owned platform IP", "uploads exist")
        self.assertTrue(any("customer" in pattern for pattern in missing_concepts(report)))

    def test_room_missing_transfer_question_is_reported(self):
        report = ROOM_REPORT.replace("What would prevent transfer in diligence?", "")
        self.assertTrue(any("transfer" in pattern for pattern in missing_concepts(report, room=True)))


if __name__ == "__main__":
    unittest.main()
