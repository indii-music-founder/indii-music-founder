import os
import sys
import tempfile
import unittest
from PIL import Image
import numpy as np

# Add project root to sys.path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from execution.print_prep.print_prep import (
    plan_print,
    cover_box,
    extend_bleed,
    create_guide_overlay,
    prepare_artwork,
    PRESETS,
)


class TestPrintPrepEngine(unittest.TestCase):
    def test_presets_exist(self):
        self.assertIn("vinyl_sleeve", PRESETS)
        self.assertIn("poster_18x24", PRESETS)
        self.assertIn("cover_art_distributor", PRESETS)

    def test_plan_vinyl_sleeve(self):
        plan = plan_print(2048, 2048, "vinyl_sleeve")
        self.assertEqual(plan["required"]["width"], 3788)
        self.assertEqual(plan["required"]["height"], 3788)
        self.assertEqual(plan["trimPx"]["width"], 3713)
        self.assertEqual(plan["trimPx"]["height"], 3713)
        self.assertEqual(plan["bleedPx"], 38)
        self.assertEqual(plan["safePx"], 38)
        self.assertEqual(plan["verdict"], "upscale")
        self.assertAlmostEqual(plan["requiredUpscaleFactor"], 3788 / 2048, places=2)

    def test_plan_distributor_cover(self):
        plan = plan_print(3000, 3000, "cover_art_distributor")
        self.assertEqual(plan["required"]["width"], 3000)
        self.assertEqual(plan["required"]["height"], 3000)
        self.assertEqual(plan["bleedPx"], 0)
        self.assertEqual(plan["verdict"], "sufficient")

    def test_cover_box_aspect_crop(self):
        # Create 1000x500 image
        img = Image.new("RGB", (1000, 500), color=(255, 0, 0))
        # Fit to 500x500 square with center focus
        fitted = cover_box(img, 500, 500, fx=0.5, fy=0.5)
        self.assertEqual(fitted.size, (500, 500))

    def test_extend_bleed_dimensions(self):
        # Create 100x100 image
        img = Image.new("RGB", (100, 100), color=(0, 255, 0))
        # Extend with 10px bleed on all 4 sides -> 120x120
        extended = extend_bleed(img, bleed_px=10)
        self.assertEqual(extended.size, (120, 120))

    def test_guide_overlay(self):
        img = Image.new("RGB", (200, 200), color=(50, 50, 50))
        guide = create_guide_overlay(img, bleed_px=10, safe_px=10)
        self.assertEqual(guide.size, (200, 200))

    def test_end_to_end_prepare_artwork(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            in_path = os.path.join(tmpdir, "in.png")
            out_path = os.path.join(tmpdir, "out.png")
            guide_path = os.path.join(tmpdir, "guide.png")

            # Create synthetic test input
            src = Image.new("RGB", (512, 512), color=(100, 150, 200))
            src.save(in_path)

            result = prepare_artwork(
                input_path=in_path,
                output_path=out_path,
                preset_id="cover_art_distributor",
                bleed_mode="fill",
                guide_path=guide_path,
            )

            self.assertTrue(os.path.exists(out_path))
            self.assertTrue(os.path.exists(guide_path))
            with Image.open(out_path) as out_img:
                dpi_info = out_img.info.get("dpi")
                self.assertIsNotNone(dpi_info)
                self.assertEqual((round(dpi_info[0]), round(dpi_info[1])), (300, 300))


if __name__ == "__main__":
    unittest.main()
