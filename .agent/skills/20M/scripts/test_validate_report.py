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
analysis includes an IP answer matrix and the IP asset register, and states that customer-controlled uploads are not owned platform IP.
Licensed and vendor-dependent services remain subject to chain-of-title and
assignment evidence. Source: https://example.test/evidence
"""

ROOM_REPORT = BASE_REPORT + """
What intellectual property do you own? What belongs to the artist or customer
and what do they control? What is licensed or vendor-dependent? What evidence
is available for review today? What would prevent transfer in diligence? Why
does that intellectual property matter to value?
"""

IP_REGISTER = """
# Intellectual Property & Asset Register

| Asset ID | Rights posture | Review state |
|---|---|---|
| IP-PLATFORM-001 | owned | verified |

## Founder actions
"""

LIVE_ANSWER_CARD = """
## What intellectual property do you own?
**Short answer:** platform software and know-how, subject to evidence.
**Deep answer:** customer music remains customer-controlled.
## What can I review today, and what still blocks transfer?
**Short answer:** review the evidence ledger.
**Deep answer:** chain of title remains a diligence gate.
## How does that IP support value?
**Short answer:** risk-adjusted replacement value.
**Deep answer:** it does not establish a transaction price.
"""

INVESTOR_QA = """
## IP questions
What do you own today? What belongs to the artist/customer and what do they
control? What is licensed or vendor-dependent? What evidence can an investor
review today? What would prevent transfer in diligence? Why does this support a
cautious value range?
"""


class ValidateReportTest(unittest.TestCase):
    def test_base_report_requires_ip_boundaries(self):
        validate(BASE_REPORT, MODEL)

    def test_room_requires_all_ip_questions(self):
        validate(
            ROOM_REPORT,
            MODEL,
            room=True,
            ip_register=IP_REGISTER,
            live_answer_card=LIVE_ANSWER_CARD,
            investor_qa=INVESTOR_QA,
        )

    def test_room_requires_the_complete_investor_ip_pack(self):
        with self.assertRaisesRegex(ValueError, "IP register path"):
            validate(ROOM_REPORT, MODEL, room=True)
        with self.assertRaisesRegex(ValueError, "live-answer card"):
            validate(ROOM_REPORT, MODEL, room=True, ip_register=IP_REGISTER)
        with self.assertRaisesRegex(ValueError, "Q&A index"):
            validate(ROOM_REPORT, MODEL, room=True, ip_register=IP_REGISTER, live_answer_card=LIVE_ANSWER_CARD)

    def test_missing_customer_boundary_is_reported(self):
        report = BASE_REPORT.replace("customer-controlled uploads are not owned platform IP", "uploads exist")
        self.assertTrue(any("customer" in pattern for pattern in missing_concepts(report)))

    def test_room_missing_transfer_question_is_reported(self):
        report = ROOM_REPORT.replace("What would prevent transfer in diligence?", "")
        self.assertTrue(any("transfer" in pattern for pattern in missing_concepts(report, room=True)))

    def test_room_requires_why_ip_supports_value(self):
        report = ROOM_REPORT.replace("Why\ndoes that intellectual property matter to value?", "")
        self.assertTrue(any("value" in pattern for pattern in missing_concepts(report, room=True)))

    def test_room_requires_the_memo_to_name_the_ip_register(self):
        report = ROOM_REPORT.replace("IP asset register", "diligence record")
        self.assertTrue(any("asset.{0,40}register" in pattern for pattern in missing_concepts(report, room=True)))

    def test_room_rejects_an_unstructured_ip_register(self):
        with self.assertRaisesRegex(ValueError, "IP register"):
            validate(
                ROOM_REPORT,
                MODEL,
                room=True,
                ip_register="IP assets exist",
                live_answer_card=LIVE_ANSWER_CARD,
                investor_qa=INVESTOR_QA,
            )

    def test_room_accepts_the_authoritative_ip_register_shape(self):
        validate(
            ROOM_REPORT,
            MODEL,
            room=True,
            ip_register=IP_REGISTER,
            live_answer_card=LIVE_ANSWER_CARD,
            investor_qa=INVESTOR_QA,
        )

    def test_room_rejects_a_live_card_without_ip_value_answer(self):
        with self.assertRaisesRegex(ValueError, "live-answer card"):
            validate(
                ROOM_REPORT,
                MODEL,
                room=True,
                ip_register=IP_REGISTER,
                live_answer_card=LIVE_ANSWER_CARD.replace("## How does that IP support value?", ""),
                investor_qa=INVESTOR_QA,
            )


if __name__ == "__main__":
    unittest.main()
