
from python.helpers.rate_limiter import RateLimiter
import asyncio
import json
from python.helpers.tool import Tool, Response
from python.config.ai_models import AIConfig

class ThirtyDayContentCalendar(Tool):
    """
    Social Media Manager Tool.
    Generates a daily posting schedule mixing behind-the-scenes, performance clips,
    and direct fan engagement.
    Optionally exports to Google Calendar for team visibility.
    """

    async def execute(self, artist_name: str, core_content_pillars: list, upcoming_release_date: str, **kwargs) -> Response:
        self.set_progress(f"Generating 30-Day Content Calendar for: {artist_name}")
        
        try:
            from google import genai
            from google.genai import types
            
            api_key = AIConfig.get_api_key()
            client = genai.Client(api_key=api_key, http_options={'api_version': AIConfig.DEFAULT_API_VERSION})
            model_id = AIConfig.TEXT_FAST
            
            pillars_str = ", ".join(core_content_pillars)
            
            prompt = f"""
            You are the indiiOS Social Media Manager.
            Generate a 30-day content calendar leading up to a specific release date.
            
            Artist Name: {artist_name}
            Core Content Pillars (e.g. fashion, guitar solos, humor): {pillars_str}
            Release Date: {upcoming_release_date}
            
            Rules:
            1. Create 30 days of posts (Day 1 to Day 30).
            2. Vary the platforms (TikTok, IG Reel, IG Story, YouTube Short).
            3. Follow a marketing funnel: Awareness -> Engagement -> Teasing -> Release -> Post-Release.
            4. Keep descriptions actionable and short.
            
            Return ONLY a JSON object:
            {{
              "campaign_name": "...",
              "calendar": [
                {{
                  "day": 1,
                  "platform": "TikTok",
                  "content_type": "Behind The Scenes",
                  "description": "...",
                  "audio_to_use": "Original/Trending",
                  "call_to_action": "..."
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
                    temperature=0.6
                )
            )
            
            calendar_data = json.loads(response.text)
            
            # --- ICS Export: Generate a standard .ics calendar file ---
            import os
            from datetime import datetime, timedelta
            
            workflow_status = "Calendar generated"
            ics_path = None
            
            export_ics = kwargs.get("export_ics", False)
            
            if export_ics:
                self.set_progress("Generating .ics calendar file...")
                
                try:
                    # Parse the release date to calculate calendar start
                    release_dt = datetime.strptime(upcoming_release_date, "%Y-%m-%d")
                    start_dt = release_dt - timedelta(days=30)
                except ValueError:
                    start_dt = datetime.now()
                
                ics_lines = [
                    "BEGIN:VCALENDAR",
                    "VERSION:2.0",
                    "PRODID:-//indiiOS//Content Calendar//EN",
                    f"X-WR-CALNAME:{artist_name} Content Calendar",
                ]
                
                for entry in calendar_data.get("calendar", []):
                    day_num = entry.get("day", 1)
                    event_date = start_dt + timedelta(days=day_num - 1)
                    date_str = event_date.strftime("%Y%m%d")
                    
                    platform = entry.get("platform", "Social")
                    content_type = entry.get("content_type", "Post")
                    description = entry.get("description", "")
                    cta = entry.get("call_to_action", "")
                    
                    ics_lines.extend([
                        "BEGIN:VEVENT",
                        f"DTSTART;VALUE=DATE:{date_str}",
                        f"SUMMARY:[{platform}] {content_type}",
                        f"DESCRIPTION:{description}\\n\\nCTA: {cta}",
                        f"CATEGORIES:{platform},{content_type}",
                        "END:VEVENT",
                    ])
                
                ics_lines.append("END:VCALENDAR")
                ics_content = "\r\n".join(ics_lines)
                
                export_dir = kwargs.get("export_path", "/tmp")
                safe_name = artist_name.replace(" ", "_").lower()
                ics_path = os.path.join(export_dir, f"{safe_name}_30day_calendar.ics")
                
                with open(ics_path, "w") as f:
                    f.write(ics_content)
                
                workflow_status = f"Calendar exported to {ics_path}"
            
            return Response(
                message=f"30-Day content calendar generated for '{artist_name}'. {workflow_status}",
                additional={
                    "calendar_data": calendar_data,
                    "ics_path": ics_path,
                    "workflow_status": workflow_status
                }
            )

        except Exception as e:
            import traceback
            return Response(message=f"30-Day Content Calendar Failed: {str(e)}\n{traceback.format_exc()}", break_loop=False)
