
from python.helpers.rate_limiter import RateLimiter
import asyncio
import json
from python.helpers.tool import Tool, Response
from python.config.ai_models import AIConfig

class CampaignGenerator(Tool):
    """
    Marketing Executive Tool.
    Generates a 4-week rollout schedule with specific content buckets for a release.
    Exports the campaign as an ICS calendar file for team scheduling.
    """

    async def execute(self, artist_name: str, release_title: str, release_date: str, mood_genre: str = "", **kwargs) -> Response:
        self.set_progress(f"Generating Marketing Campaign for: {release_title}")
        
        try:
            from google import genai
            from google.genai import types
            
            api_key = AIConfig.get_api_key()
            client = genai.Client(api_key=api_key, http_options={'api_version': AIConfig.DEFAULT_API_VERSION})
            model_id = AIConfig.TEXT_FAST
            
            prompt = f"""
            You are the indiiOS Marketing Executive. 
            Create a 4-week pre-save and rollout marketing campaign for the upcoming release.
            
            Details:
            Artist: {artist_name}
            Title: {release_title}
            Drop Date: {release_date}
            Vibe/Genre: {mood_genre}
            
            Required JSON structure:
            {{
              "campaign_name": "String",
              "target_audience": ["Demo 1", "Demo 2"],
              "timeline": [
                {{
                   "week": "-4",
                   "focus": "Tease the audio",
                   "action_items": ["Post cryptic IG Story", "Setup Pre-save link"]
                }},
                {{
                   "week": "-3",
                   "focus": "Build anticipation",
                   "action_items": ["Release snippet", "Launch countdown"]
                }},
                {{
                   "week": "-2",
                   "focus": "Pre-save push",
                   "action_items": ["Email newsletter", "Ad campaign start"]
                }},
                {{
                   "week": "-1",
                   "focus": "Final hype",
                   "action_items": ["Behind the scenes", "Listening party announcement"]
                }},
                {{
                   "week": "0 (Release Week)",
                   "focus": "Launch",
                   "action_items": ["Release day posts", "Playlist pitching"]
                }}
              ]
            }}
            """
            
            _rl = RateLimiter()
            wait_time = _rl.wait_time("gemini")
            if wait_time > 0:
                self.set_progress(f"Rate limiting: waiting {wait_time:.1f}s")
                await asyncio.sleep(wait_time)

            response = client.models.generate_content(
                model=model_id,
                contents=[prompt],
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    temperature=0.7
                )
            )
            
            campaign = json.loads(response.text)
            
            # --- ICS Export: Generate a campaign calendar file ---
            import os
            from datetime import datetime, timedelta
            
            workflow_status = "Campaign generated"
            ics_path = None
            
            export_ics = kwargs.get("export_ics", False)
            
            if export_ics:
                self.set_progress("Generating campaign calendar .ics file...")
                
                try:
                    release_dt = datetime.strptime(release_date, "%Y-%m-%d")
                except ValueError:
                    release_dt = datetime.now() + timedelta(days=28)
                
                ics_lines = [
                    "BEGIN:VCALENDAR",
                    "VERSION:2.0",
                    "PRODID:-//indiiOS//Campaign Calendar//EN",
                    f"X-WR-CALNAME:{release_title} Campaign",
                ]
                
                for phase in campaign.get("timeline", []):
                    week_str = str(phase.get("week", "0"))
                    focus = phase.get("focus", "")
                    
                    # Parse week offset
                    try:
                        week_num = int(week_str.replace("(Release Week)", "").strip())
                    except ValueError:
                        week_num = 0
                    
                    phase_start = release_dt + timedelta(weeks=week_num)
                    date_str = phase_start.strftime("%Y%m%d")
                    
                    actions = phase.get("action_items", [])
                    actions_text = "\\n".join([f"• {a}" for a in actions])
                    
                    ics_lines.extend([
                        "BEGIN:VEVENT",
                        f"DTSTART;VALUE=DATE:{date_str}",
                        f"DURATION:P7D",
                        f"SUMMARY:Week {week_str}: {focus}",
                        f"DESCRIPTION:{actions_text}",
                        f"CATEGORIES:Campaign,{release_title}",
                        "END:VEVENT",
                    ])
                
                ics_lines.append("END:VCALENDAR")
                ics_content = "\r\n".join(ics_lines)
                
                export_dir = kwargs.get("export_path", "/tmp")
                safe_title = release_title.replace(" ", "_").lower()
                ics_path = os.path.join(export_dir, f"{safe_title}_campaign.ics")
                
                with open(ics_path, "w") as f:
                    f.write(ics_content)
                
                workflow_status = f"Campaign calendar exported to {ics_path}"
            
            return Response(
                message=f"Marketing rollout for '{release_title}' generated. {workflow_status}",
                additional={
                    "campaign": campaign,
                    "ics_path": ics_path,
                    "workflow_status": workflow_status
                }
            )

        except Exception as e:
            import traceback
            return Response(message=f"Campaign Generator Failed: {str(e)}\n{traceback.format_exc()}", break_loop=False)
