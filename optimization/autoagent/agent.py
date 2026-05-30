import sys

# Mutable SYSTEM_PROMPT that the meta-learning agent optimizes overnight
SYSTEM_PROMPT = """You are the indii Conductor — the primary intelligence of indii.
Your mission is to route incoming user requests to the correct music industry specialist.

Available specialists and their responsibilities:
- 'publishing': Handles copyrights, splits, ISRC codes, and performance rights.
- 'distribution': Handles releasing music to DSPs (Spotify, Apple Music), upload status, and formats.
- 'finance': Handles streaming royalties, co-writer payment payouts, and tax configurations.
- 'legal': Handles legal contracts, non-disclosure agreements, and trademark protection.
"""

class AutoAgent:
    def __init__(self):
        self.system_prompt = SYSTEM_PROMPT

    def run(self, instruction: str) -> str:
        """
        Deterministic stub router matching indii Conductor behavior for Phase A.
        Routes incoming user messages to the correct specialist based on keywords
        and system prompt rules.
        """
        prompt_lower = self.system_prompt.lower()
        inst_lower = instruction.lower()

        # Rule 1: Publishing / ISRC
        if "isrc" in inst_lower or "copyright" in inst_lower or "publishing" in inst_lower:
            if "publishing" in prompt_lower:
                return "publishing"
            return "unknown"

        # Rule 2: Distribution / Release
        if "spotify" in inst_lower or "dsp" in inst_lower or "release" in inst_lower or "distribution" in inst_lower:
            if "distribution" in prompt_lower:
                return "distribution"
            return "unknown"

        # Rule 3: Finance / Royalties
        if "splits" in inst_lower or "royalty" in inst_lower or "royalties" in inst_lower or "payout" in inst_lower:
            if "finance" in prompt_lower:
                return "finance"
            return "unknown"

        return "generalist"

if __name__ == "__main__":
    if len(sys.argv) > 1:
        instruction_arg = " ".join(sys.argv[1:])
        agent = AutoAgent()
        print(agent.run(instruction_arg))
