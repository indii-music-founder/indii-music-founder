import asyncio
import sys
import os

# Ensure the project root is in the Python path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..')))

from python.tools.email_newsletter_generator import EmailNewsletterGenerator

async def main():
    tool = EmailNewsletterGenerator()
    res = await tool.execute("The Beatles", "Abbey Road", "Classic hits remastered.", auto_create_campaign=True)
    print("Test Output:", res.message)

if __name__ == "__main__":
    asyncio.run(main())
