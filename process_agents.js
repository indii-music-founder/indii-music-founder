const fs = require('fs');
const path = require('path');

const folders = ['brand', 'creative', 'distribution', 'legal', 'licensing', 'marketing', 'music', 'publicist', 'publishing', 'road', 'social', 'video'];
const basePath = '/Volumes/X SSD 2025/Users/narrowchannel/Desktop/indii-music-founder/agents';
let gapIssues = '';

for (const folder of folders) {
  const promptPath = path.join(basePath, folder, 'prompt.md');
  if (fs.existsSync(promptPath)) {
    let content = fs.readFileSync(promptPath, 'utf8');
    
    // Add Phase B additions if not present
    if (!content.includes('## FAILURE BEHAVIOR')) {
      content += `

## DELEGATION PROTOCOL
- You are a SPOKE agent.
- You NEVER route directly to other spoke agents. If you need cross-domain work, ask the indii Conductor to handle it.
- NEVER impersonate the Conductor or any other agent.

## FAILURE BEHAVIOR
- If a tool fails, timeouts, or returns an error, DO NOT hallucinate a success response.
- Acknowledge the failure to the user transparently.
- Attempt a single logical retry if the error is transient. Otherwise, ask the user how to proceed.

## NO-MOCK-DATA COVENANT
You are bound by a strict NO-MOCK-DATA covenant. Never fabricate, invent, or simulate data. If you lack information, return an honest empty state or tell the user. Never present heuristics as measured facts.

## STRUCTURED OUTPUT
When responding, format your output professionally using markdown. Do not include raw JSON blocks in the chat.
`;
      fs.writeFileSync(promptPath, content, 'utf8');
    }

    // Phase C Skills Gap Analysis
    let skills = [];
    switch(folder) {
        case 'brand': skills = ['analyze_brand_sentiment', 'generate_brand_kit']; break;
        case 'creative': skills = ['generate_moodboard', 'analyze_visual_trends']; break;
        case 'distribution': skills = ['check_dsp_delivery_status', 'validate_metadata_readiness']; break;
        case 'legal': skills = ['draft_split_sheet', 'summarize_contract_terms']; break;
        case 'licensing': skills = ['search_sync_opportunities', 'calculate_sync_fee_estimate']; break;
        case 'marketing': skills = ['generate_ad_copy', 'analyze_campaign_roi']; break;
        case 'music': skills = ['analyze_audio_stem', 'detect_bpm_and_key']; break;
        case 'publicist': skills = ['draft_press_release', 'find_media_contacts']; break;
        case 'publishing': skills = ['search_pro_database', 'register_work_with_pro']; break;
        case 'road': skills = ['draft_tour_itinerary', 'estimate_tour_budget']; break;
        case 'social': skills = ['generate_content_calendar', 'analyze_engagement_rate']; break;
        case 'video': skills = ['generate_storyboard', 'draft_video_budget']; break;
    }

    gapIssues += `\n### ISSUE-GAP-${folder.toUpperCase()}: Phase C Skills Gap Analysis for ${folder}\n- **Status:** OPEN\n- **Severity:** 🟢 LOW\n- **Module:** agents/${folder}\n- **Summary:** As part of the Phase C agent elevation, the following skills were identified as highly valuable for the ${folder} agent but are currently missing: ${skills.join(', ')}.\n- **Fix Direction:** Implement these tools natively in ${folder.charAt(0).toUpperCase() + folder.slice(1)}Agent.ts or as Layer 3 execution scripts.\n`;
  }
}

// Append gap issues to OPEN_ISSUES.md
const ledgerPath = '/Volumes/X SSD 2025/Users/narrowchannel/Desktop/indii-music-founder/.agent/test_ledger/OPEN_ISSUES_V2.md';
if (fs.existsSync(ledgerPath)) {
    fs.appendFileSync(ledgerPath, '\n---' + gapIssues);
}

console.log('Processed all 12 agent folders successfully.');
