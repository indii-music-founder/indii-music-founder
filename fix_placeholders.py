import os
import json
import re

# Dictionary mapping old placeholder to (key, new_production_grade_text)
# We use a flat structure for keys like "publicist.hints.conversation_notes"
replacements = {
    "Add notes about your last conversation...": ("conversation_notes", "Document key takeaways or follow-ups from your last touchpoint..."),
    "e.g. The Midnight Echo": ("campaign_target", "e.g., The Midnight Echo (Target Artist or Project)"),
    "0.00": ("campaign_budget", "0.00 (Allocated Budget)"),
    "e.g. Neon Nights Album Launch": ("campaign_name", "Enter campaign name (e.g., Neon Nights Release)"),
    "e.g. Test Journalist": ("contact_name", "Enter full name (e.g., Jane Doe)"),
    "e.g. Pitchfork / Rolling Stone": ("contact_outlet", "Enter publication or outlet (e.g., Pitchfork)"),
    "e.g. Neon Nights": ("release_title", "Enter the official release title"),
    "e.g. Retro Wave": ("release_genre", "Primary genre (e.g., Retro Wave)"),
    "e.g. Synth-pop, 80s nostalgia, energetic": ("release_tags", "Comma-separated tags (e.g., Synth-pop, energetic)"),
    "Who is this song for?": ("target_audience", "Describe the target audience or demographic..."),
    "Search fans...": ("search_fans", "Search by fan name, email, or location..."),
    "e.g. Bohemian Rhapsody": ("track_title_example", "Enter track title (e.g., Bohemian Rhapsody)"),
    "e.g. Freddie Mercury": ("writer_name_example", "Enter legal writer name (e.g., Freddie Mercury)"),
    "USRC17607839": ("isrc_example", "Enter ISRC (e.g., USRC17607839)"),
    "Search by title, artist, or ISRC...": ("search_releases", "Search catalog by title, artist, or ISRC..."),
    "Enter track title": ("track_title", "Enter the exact track title for distribution"),
    "Enter artist name": ("artist_name", "Enter the primary artist's name"),
    "Your label or 'Self-Released'": ("label_name", "Enter your record label, or 'Self-Released'"),
    "PA-DPIDA-XXXXXXXXXX-X": ("pro_work_id", "Enter PRO Work ID (e.g., ASCAP/BMI Work ID)"),
    "US-XXX-25-XXXXX (Optional - will generate if empty)": ("isrc_optional", "Enter ISRC (Optional - will generate automatically if empty)"),
    "e.g. 120": ("bpm_example", "Enter BPM (e.g., 120)"),
    "e.g. C minor, 8A": ("key_example", "Enter musical key (e.g., C minor, 8A)"),
    "0.0 to 1.0 (e.g. 0.85)": ("confidence_score", "Enter confidence score (0.0 to 1.0)"),
    "e.g., Suno, Udio, AIVA, Amper": ("ai_tools_example", "List AI tools used (e.g., Suno, Udio, AIVA)"),
    "Describe any human creative input (lyrics, melody ideas, arrangement, mixing, etc.)": ("human_input_desc", "Describe human creative input (lyrics, arrangement, mixing, etc.)..."),
    "Your display name": ("display_name", "Enter your public display name"),
    "Tell us about yourself...": ("bio_desc", "Write a short bio detailing your artistic journey..."),
    "e.g. Technology": ("industry_example", "Enter industry or niche (e.g., Technology)"),
    "e.g. Acme Corp": ("company_example", "Enter company or brand name (e.g., Acme Corp)"),
    "What's on your mind?": ("social_post_desc", "Draft your post or update..."),
    "Search your products...": ("search_products", "Search merchandise or digital products..."),
    "What's happening in your studio?": ("studio_update", "Share a studio update, new mix, or creative milestone..."),
    "Phone Number": ("phone_number", "Enter contact phone number"),
    "Contact Name": ("contact_name_tour", "Enter primary contact name"),
    "Event Phase...": ("event_phase", "Describe the event phase (e.g., Load-in, Soundcheck)..."),
    "OPERATIVE": ("operative_name", "Enter operative or role name"),
    "IDENT_NAME": ("ident_name", "Enter identification name"),
    "+X XXX XXX XXXX": ("phone_international", "Enter phone number (e.g., +1 555 000 0000)"),
    "Current Location...": ("current_location", "Enter current or starting location..."),
    "Enter City, State (e.g. Austin, TX)": ("city_state_example", "Enter City, State (e.g., Austin, TX)"),
    "Add requirement...": ("add_requirement", "Add a new technical or hospitality requirement..."),
    "Tell your agent what you need...": ("agent_request", "Describe what you need your agent to coordinate..."),
    "The Fillmore": ("venue_example", "Enter venue name (e.g., The Fillmore)"),
    "Detroit, MI": ("city_example", "Enter city (e.g., Detroit, MI)"),
    "500": ("capacity_example", "Enter capacity (e.g., 500)"),
    "e.g. Mara Sol": ("artist_example", "Enter artist or band name (e.g., Mara Sol)"),
    "e.g. The Collapse Tour": ("tour_example", "Enter tour name (e.g., The Collapse Tour)"),
    "None": ("none", "None"),
    "Role": ("role", "Enter role (e.g., FOH Engineer)"),
    "Name": ("name", "Enter full name"),
    "+1 555 000 0000": ("phone_us", "Enter phone (e.g., +1 555 000 0000)"),
    "email@example.com": ("email_example", "Enter email address"),
    "Load-in time, parking, catering windows, special requests...": ("special_requests", "Specify load-in, parking, catering, or other requests..."),
    "e.g. South Korea, Brazil, Germany...": ("country_example", "Enter destination country (e.g., UK, Japan, Brazil)...")
}

with open('parsed_placeholders.json') as f:
    data = json.load(f)

# Update en-US.json
with open('packages/renderer/src/config/locales/en-US.json', 'r') as f:
    en_us = json.load(f)

for filepath, placeholders in data.items():
    # identify module
    match = re.match(r'packages/renderer/src/modules/([^/]+)/', filepath)
    if match:
        module_name = match.group(1)
        if module_name not in en_us:
            en_us[module_name] = {}
        if 'hints' not in en_us[module_name]:
            en_us[module_name]['hints'] = {}
        
        for line_num, placeholder in placeholders:
            if placeholder in replacements:
                key, text = replacements[placeholder]
                en_us[module_name]['hints'][key] = text
            else:
                print(f"Warning: '{placeholder}' not found in replacements")

with open('packages/renderer/src/config/locales/en-US.json', 'w') as f:
    json.dump(en_us, f, indent=2)

# File modifications
for filepath, placeholders in data.items():
    match = re.match(r'packages/renderer/src/modules/([^/]+)/', filepath)
    if not match: continue
    module_name = match.group(1)
    
    with open(filepath, 'r') as f:
        content = f.read()
    
    # Needs useTranslation
    if 'useTranslation' not in content:
        # Add import at the top
        content = "import { useTranslation } from 'react-i18next';\n" + content
    
    # We must insert const { t } = useTranslation(); inside the component.
    # A simple regex to find component declarations:
    # const ComponentName = (...) => {
    # export function ComponentName(...) {
    # Let's just do a naive injection after `=> {` or `) {` for the main component.
    # Actually, a safer way is to replace placeholder="text" with placeholder={t('module.hints.key')}
    # and let the developer/compiler complain if `t` is missing, OR we can inject `const { t } = useTranslation();`
    # right after the first `{` of the component body.
    
    # Let's find all component bodies. We can inject it in all functions that return JSX.
    # For now, let's just do the replace. We will manually fix `useTranslation` if tests fail, or try to inject it smartly.
    
    for line_num, placeholder in placeholders:
        if placeholder in replacements:
            key, text = replacements[placeholder]
            i18n_call = f"placeholder={{t('{module_name}.hints.{key}')}}"
            # Replace placeholder="text" with placeholder={t('...')}
            content = content.replace(f'placeholder="{placeholder}"', i18n_call)
    
    with open(filepath, 'w') as f:
        f.write(content)

