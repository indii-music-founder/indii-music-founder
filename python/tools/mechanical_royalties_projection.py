import json
from python.helpers.tool import Tool, Response
from python.config.ai_models import AIConfig

class MechanicalRoyaltiesProjection(Tool):
    """
    Finance Manager Tool.
    Projects quarterly MLC or mechanical royalty payments based on estimated stream counts.
    """

    async def execute(self, estimated_spotify_streams: int, estimated_apple_streams: int, ownership_percentage: float = 100.0) -> Response:
        self.set_progress(f"Projecting mechanical royalties for {estimated_spotify_streams + estimated_apple_streams} streams")
        
        try:
            # Deterministic math for mechanicals
            # Current mechanical streaming rate (approximate, blended US rate ~ $0.0009 per stream for publishing)
            blended_mechanical_rate = 0.0009
            
            total_streams = estimated_spotify_streams + estimated_apple_streams
            total_mechanical_pool = total_streams * blended_mechanical_rate
            
            artist_share = total_mechanical_pool * (ownership_percentage / 100)
            
            return Response(
                message=f"Projected mechanicals: ${artist_share:,.2f} based on {total_streams:,} total streams.",
                additional={
                    "projection_data": {
                        "total_streams": total_streams,
                        "blended_rate_used": blended_mechanical_rate,
                        "ownership_share": ownership_percentage,
                        "gross_mechanicals_usd": round(total_mechanical_pool, 2),
                        "artist_net_mechanicals_usd": round(artist_share, 2),
                        "note": "This is an estimate of publishing mechanical royalties paid via The MLC or mechanical collection societies, separate from sound recording (master) royalties."
                    }
                }
            )

        except Exception as e:
            import traceback
            return Response(message=f"Mechanical Royalties Projection Failed: {str(e)}\n{traceback.format_exc()}", break_loop=False)
