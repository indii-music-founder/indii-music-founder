import json
from python.helpers.tool import Tool, Response
from python.config.ai_models import AIConfig


def _normalize_currency(value) -> float:
    """
    Accept a float/int or a string like "$1,234.56" and return a float.

    Raises ValueError if the value cannot be converted.
    """
    if isinstance(value, (int, float)):
        return float(value)
    if isinstance(value, str):
        cleaned = value.replace("$", "").replace(",", "").strip()
        return float(cleaned)
    raise ValueError(f"Cannot convert {type(value).__name__!r} to a currency amount")


def _normalize_stream_count(value) -> int:
    """
    Accept an int, float, or numeric string and return a non-negative int.

    Raises ValueError if the value cannot be converted or is negative.
    """
    if isinstance(value, str):
        value = value.replace(",", "").strip()
    count = int(float(value))
    return count


class MechanicalRoyaltiesProjection(Tool):
    """
    Finance Manager Tool.
    Projects quarterly MLC or mechanical royalty payments based on estimated stream counts.
    """

    async def execute(self, estimated_spotify_streams, estimated_apple_streams, ownership_percentage=100.0) -> Response:
        self.set_progress(f"Projecting mechanical royalties")

        try:
            # ------------------------------------------------------------------
            # Input validation — normalisation and range checks
            # ------------------------------------------------------------------
            try:
                estimated_spotify_streams = _normalize_stream_count(estimated_spotify_streams)
            except (ValueError, TypeError) as exc:
                return Response(
                    message=json.dumps({"status": "error", "message": f"Invalid estimated_spotify_streams: {exc}"}),
                    break_loop=False,
                )

            try:
                estimated_apple_streams = _normalize_stream_count(estimated_apple_streams)
            except (ValueError, TypeError) as exc:
                return Response(
                    message=json.dumps({"status": "error", "message": f"Invalid estimated_apple_streams: {exc}"}),
                    break_loop=False,
                )

            try:
                ownership_percentage = _normalize_currency(ownership_percentage)
            except (ValueError, TypeError) as exc:
                return Response(
                    message=json.dumps({"status": "error", "message": f"Invalid ownership_percentage: {exc}"}),
                    break_loop=False,
                )

            if estimated_spotify_streams < 0:
                return Response(
                    message=json.dumps({"status": "error", "message": "estimated_spotify_streams cannot be negative."}),
                    break_loop=False,
                )
            if estimated_apple_streams < 0:
                return Response(
                    message=json.dumps({"status": "error", "message": "estimated_apple_streams cannot be negative."}),
                    break_loop=False,
                )
            if ownership_percentage < 0:
                return Response(
                    message=json.dumps({"status": "error", "message": "ownership_percentage cannot be negative."}),
                    break_loop=False,
                )
            if ownership_percentage > 100:
                return Response(
                    message=json.dumps({"status": "error", "message": f"ownership_percentage ({ownership_percentage}%) cannot exceed 100%."}),
                    break_loop=False,
                )

            self.set_progress(f"Projecting mechanical royalties for {estimated_spotify_streams + estimated_apple_streams:,} streams")

            # ------------------------------------------------------------------
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
