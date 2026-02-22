import asyncio
import os
import sys

# Add the project root to the python path so 'python.x' modules resolve
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))

from python.tools.brand_asset_generator import BrandAssetGenerator

async def main():
    generator = BrandAssetGenerator()
    resp = await generator.execute(action="generate_palette", description="A cyberpunk neon city")
    print(resp.message)
    print(resp.additional)

if __name__ == "__main__":
    asyncio.run(main())
