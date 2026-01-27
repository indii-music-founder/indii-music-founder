from python.helpers.api import ApiHandler, Response
import os
import json
try:
    from PIL import Image
except ImportError:
    Image = None

try:
    import moviepy.video.io.VideoFileClip as vfc
    import moviepy.video.fx as vfx
    VideoFileClip = vfc.VideoFileClip
except ImportError:
    VideoFileClip = None

class IndiiSync(ApiHandler):
    """
    Indii Sync (Roadie) - Automated asset reformatting and distribution.
    """
    methods = ["POST"]

    @staticmethod
    def get_methods():
        return ["POST"]

    @staticmethod
    def requires_csrf():
        return False

    async def process(self, input_data, request):
        asset_path = input_data.get("asset_path")
        project_id = input_data.get("project_id", "default")
        target_platforms = input_data.get("platforms", ["tiktok", "instagram"])

        # Ensure we are looking in the container's workspace
        if asset_path and not asset_path.startswith("/"):
            asset_path = os.path.join("/a0", asset_path)

        if not asset_path or not os.path.exists(asset_path):
            return {"status": "error", "message": f"Asset not found: {asset_path}"}

        # Target directory: /a0/roadie_dist/<project_id>
        dist_dir = os.path.join("/a0", "roadie_dist", project_id)
        os.makedirs(dist_dir, exist_ok=True)

        results = []
        base, ext = os.path.splitext(asset_path)
        ext = ext.lower()
        
        for platform in target_platforms:
            output_name = f"{os.path.basename(base)}_{platform}{ext}"
            output_path = os.path.join(dist_dir, output_name)
            
            try:
                if ext in [".png", ".jpg", ".jpeg", ".webp"] and Image:
                    # Image Optimization
                    with Image.open(asset_path) as img:
                        # TikTok/Insta prefer 9:16 (1080x1920)
                        img.thumbnail((1080, 1920))
                        img.save(output_path)
                    results.append({"platform": platform, "status": "optimized", "url": f"img://{output_path}"})
                
                elif ext in [".mp4", ".mov", ".avi"] and VideoFileClip:
                    # Video Transcoding (Roadie Logic)
                    clip = VideoFileClip(asset_path)
                    # Resize to vertical (1080 width, maintaining aspect ratio, then crop or pad)
                    # Simple resize for now to fit within TikTok specs
                    final_clip = clip.resized(width=1080)
                    final_clip.write_videofile(output_path, codec="libx264", audio_codec="aac")
                    clip.close()
                    results.append({"platform": platform, "status": "transcoded", "path": output_path})
                
                else:
                    # Fallback copy or stub
                    import shutil
                    shutil.copy2(asset_path, output_path)
                    results.append({"platform": platform, "status": "copied", "path": output_path, "note": "Processing not supported for this format"})
            except Exception as e:
                results.append({"platform": platform, "status": "error", "error": str(e)})

        return {
            "status": "success",
            "project_id": project_id,
            "original": asset_path,
            "dist_dir": dist_dir,
            "derivatives": results
        }
