import unittest
from execution.finance.waterfall_payout import calculate_waterfall


class TestWaterfallPayout(unittest.TestCase):
    def test_clean_split_no_recoupment(self):
        result = calculate_waterfall(
            gross_amount=1000.0,
            party_splits={"artist": 0.5, "producer": 0.5},
            recoupment_remaining=0.0,
            platform_fee_percent=0.15
        )
        self.assertEqual(result["gross"], 1000.0)
        self.assertEqual(result["platform_fee"]["amount"], 150.0)
        self.assertEqual(result["revenue_after_fee"], 850.0)
        self.assertEqual(result["recoupment"]["applied"], 0.0)
        self.assertEqual(result["recoupment"]["remaining_balance"], 0.0)
        self.assertAlmostEqual(result["distributions"]["artist"]["amount"], 425.0)
        self.assertAlmostEqual(result["distributions"]["producer"]["amount"], 425.0)
        self.assertEqual(result["summary_status"], "PROCESSED")

    def test_full_recoupment_absorption(self):
        result = calculate_waterfall(
            gross_amount=1000.0,
            party_splits={"artist": 0.7, "label": 0.3},
            recoupment_remaining=1000.0,
            platform_fee_percent=0.15
        )
        # 1000 - 150 = 850
        # 850 applied to recoupment, balance remains 0
        self.assertEqual(result["recoupment"]["applied"], 850.0)
        self.assertEqual(result["recoupment"]["remaining_balance"], 150.0)
        self.assertEqual(result["distributions"]["artist"]["amount"], 0.0)
        self.assertEqual(result["distributions"]["label"]["amount"], 0.0)

    def test_partial_recoupment_with_splits(self):
        result = calculate_waterfall(
            gross_amount=2000.0,
            party_splits={"artist": 0.6, "producer": 0.4},
            recoupment_remaining=500.0,
            platform_fee_percent=0.10
        )
        # gross: 2000, fee: 200 -> 1800
        # recoupment: 500 applied, 0 remaining -> balance 1300
        # artist: 1300 * 0.6 = 780
        # producer: 1300 * 0.4 = 520
        self.assertEqual(result["revenue_after_fee"], 1800.0)
        self.assertEqual(result["recoupment"]["applied"], 500.0)
        self.assertEqual(result["recoupment"]["remaining_balance"], 0.0)
        self.assertAlmostEqual(result["distributions"]["artist"]["amount"], 780.0)
        self.assertAlmostEqual(result["distributions"]["producer"]["amount"], 520.0)


if __name__ == "__main__":
    unittest.main()
