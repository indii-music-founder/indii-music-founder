## 2024-05-22 - VideoTools Returns Original Prompt
**Learning:** The `generate_video` tool logic synthesizes a new prompt using `WhiskService` (e.g. adding style modifiers), but the return value to the Agent (`toolSuccess`) contains the *original* user prompt.
**Action:** Be aware that the Agent history might reflect the original intent rather than the exact prompt sent to the model. Tests must assert against input prompt for return values, but verify service calls with synthesized prompt.
