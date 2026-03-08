import json
from python.helpers.tool import Tool, Response


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


class RecoupmentCalculator(Tool):
    """
    Finance & Royalties Manager Tool.
    Calculates how many streams are needed to recoup an advance under specific deal terms.
    """

    async def execute(
        self,
        advance_amount_usd,
        deal_type: str,
        artist_royalty_percentage,
        avg_per_stream_rate=0.0035,
    ) -> Response:
        self.set_progress(f"Calculating recoupment on ${advance_amount_usd} advance")

        try:
            # ------------------------------------------------------------------
            # Input validation — currency normalisation and range checks
            # ------------------------------------------------------------------
            try:
                advance_amount_usd = _normalize_currency(advance_amount_usd)
            except (ValueError, TypeError) as exc:
                return Response(
                    message=json.dumps({"status": "error", "message": f"Invalid advance_amount_usd: {exc}"}),
                    break_loop=False,
                )

            try:
                artist_royalty_percentage = _normalize_currency(artist_royalty_percentage)
            except (ValueError, TypeError) as exc:
                return Response(
                    message=json.dumps({"status": "error", "message": f"Invalid artist_royalty_percentage: {exc}"}),
                    break_loop=False,
                )

            try:
                avg_per_stream_rate = _normalize_currency(avg_per_stream_rate)
            except (ValueError, TypeError) as exc:
                return Response(
                    message=json.dumps({"status": "error", "message": f"Invalid avg_per_stream_rate: {exc}"}),
                    break_loop=False,
                )

            if advance_amount_usd < 0:
                return Response(
                    message=json.dumps({"status": "error", "message": "advance_amount_usd cannot be negative."}),
                    break_loop=False,
                )
            if artist_royalty_percentage < 0:
                return Response(
                    message=json.dumps({"status": "error", "message": "artist_royalty_percentage cannot be negative."}),
                    break_loop=False,
                )
            if artist_royalty_percentage > 100:
                return Response(
                    message=json.dumps(
                        {
                            "status": "error",
                            "message": f"artist_royalty_percentage ({artist_royalty_percentage}%) cannot exceed 100%.",
                        }
                    ),
                    break_loop=False,
                )
            if avg_per_stream_rate <= 0:
                return Response(
                    message=json.dumps({"status": "error", "message": "avg_per_stream_rate must be a positive number."}),
                    break_loop=False,
                )
            if not isinstance(deal_type, str) or not deal_type.strip():
                return Response(
                    message=json.dumps(
                        {
                            "status": "error",
                            "message": "deal_type must be a non-empty string (e.g. 'net profit' or 'royalty').",
                        }
                    ),
                    break_loop=False,
                )

            # ------------------------------------------------------------------
            # Deterministic calculation — no AI calls
            # ------------------------------------------------------------------
            # Simple math for "Net Profit" vs "Royalty" deals
            if deal_type.lower() == "net profit":
                # 50/50 net profit split — artist recoupment comes from their half
                artist_share_fraction = 0.50
                artist_takes_per_stream = avg_per_stream_rate * artist_share_fraction
                artist_streams_to_recoup = advance_amount_usd / artist_takes_per_stream
                streams_to_recoup = advance_amount_usd / avg_per_stream_rate
            else:
                # Traditional royalty deal (e.g. 18% royalty rate)
                artist_takes_per_stream = avg_per_stream_rate * (artist_royalty_percentage / 100)
                artist_streams_to_recoup = advance_amount_usd / artist_takes_per_stream
                streams_to_recoup = advance_amount_usd / avg_per_stream_rate

            return Response(
                message=(
                    f"Recoupment calculated. Requires {int(artist_streams_to_recoup):,} streams "
                    f"to clear ${advance_amount_usd} advance."
                ),
                additional={
                    "calculations": {
                        "advance_usd": advance_amount_usd,
                        "deal_type": deal_type,
                        "artist_royalty_percentage": artist_royalty_percentage,
                        "avg_per_stream_rate": avg_per_stream_rate,
                        "artist_takes_per_stream": round(artist_takes_per_stream, 6),
                        "streams_needed_to_recoup": int(artist_streams_to_recoup),
                        "gross_streams_needed": int(streams_to_recoup),
                    }
                },
            )

        except Exception as e:
            import traceback

            return Response(
                message=f"Recoupment Calculator Failed: {str(e)}\n{traceback.format_exc()}",
                break_loop=False,
            )
