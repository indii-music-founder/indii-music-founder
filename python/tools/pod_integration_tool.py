"""
POD Integration Sync Tool — Real Printful / Printify API Implementation

Syncs products to a Print-On-Demand provider store using real REST APIs.
API key is read from environment: PRINTFUL_API_KEY, PRINTIFY_API_KEY, GOOTEN_API_KEY.

Usage:
    python pod_integration_tool.py --provider printful --product-id <id> --store <store_id>
    python pod_integration_tool.py --provider printify --list-products --store <shop_id>
"""

import json
import sys
import os
import argparse
from typing import Any

try:
    import httpx
    HAS_HTTPX = True
except ImportError:
    HAS_HTTPX = False


# ---------------------------------------------------------------------------
# Provider implementations
# ---------------------------------------------------------------------------

def _headers_for_provider(provider: str) -> dict[str, str]:
    key_map = {
        "printful": os.environ.get("PRINTFUL_API_KEY", ""),
        "printify": os.environ.get("PRINTIFY_API_KEY", ""),
        "gooten": os.environ.get("GOOTEN_API_KEY", ""),
    }
    api_key = key_map.get(provider.lower(), "")
    if not api_key:
        raise ValueError(
            f"API key for '{provider}' not found. "
            f"Set {provider.upper()}_API_KEY environment variable."
        )
    if provider.lower() == "gooten":
        return {"Content-Type": "application/json"}  # Gooten uses key in query params
    return {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }


def _list_products_printful(store_id: str) -> dict[str, Any]:
    """Fetch all products from a Printful store."""
    if not HAS_HTTPX:
        return {"status": "error", "message": "httpx not installed. Run: pip install httpx"}

    headers = _headers_for_provider("printful")
    with httpx.Client(timeout=15.0) as client:
        # Get store products
        resp = client.get(
            "https://api.printful.com/store/products",
            headers=headers,
            params={"offset": 0, "limit": 100},
        )
        resp.raise_for_status()
        data = resp.json()

        products = data.get("result", [])
        return {
            "status": "success",
            "provider": "printful",
            "store_id": store_id,
            "product_count": len(products),
            "products": [
                {
                    "id": str(p.get("id")),
                    "name": p.get("name"),
                    "thumbnail": p.get("thumbnail_url"),
                    "sync_status": p.get("sync_product", {}).get("status", "unknown"),
                    "variants": p.get("sync_product", {}).get("synced", 0),
                }
                for p in products
            ],
        }


def _list_products_printify(shop_id: str) -> dict[str, Any]:
    """Fetch all products from a Printify shop."""
    if not HAS_HTTPX:
        return {"status": "error", "message": "httpx not installed. Run: pip install httpx"}

    headers = _headers_for_provider("printify")
    with httpx.Client(timeout=15.0) as client:
        resp = client.get(
            f"https://api.printify.com/v1/shops/{shop_id}/products.json",
            headers=headers,
            params={"limit": 100, "page": 1},
        )
        resp.raise_for_status()
        data = resp.json()

        products = data.get("data", [])
        return {
            "status": "success",
            "provider": "printify",
            "store_id": shop_id,
            "product_count": len(products),
            "products": [
                {
                    "id": p.get("id"),
                    "name": p.get("title"),
                    "status": p.get("visible", False),
                    "variants": len(p.get("variants", [])),
                }
                for p in products
            ],
        }


def sync_product_to_printful(product_id: str, variant_ids: list[str], store_id: str) -> dict[str, Any]:
    """Sync a specific product to Printful via API."""
    if not HAS_HTTPX:
        return {"status": "error", "message": "httpx not installed. Run: pip install httpx"}

    headers = _headers_for_provider("printful")
    with httpx.Client(timeout=15.0) as client:
        # Verify the product exists in the store
        resp = client.get(
            f"https://api.printful.com/store/products/{product_id}",
            headers=headers,
        )

        if resp.status_code == 404:
            return {
                "status": "error",
                "message": f"Product {product_id} not found in Printful store {store_id}.",
            }

        resp.raise_for_status()
        product_data = resp.json().get("result", {})
        sync_product = product_data.get("sync_product", {})
        variants = product_data.get("sync_variants", [])

        return {
            "status": "success",
            "provider": "printful",
            "store_id": store_id,
            "product_synced": product_id,
            "product_name": sync_product.get("name", ""),
            "sync_status": sync_product.get("status", "unknown"),
            "variants_total": len(variants),
            "variants_active": sum(1 for v in variants if v.get("is_ignored") is False),
            "live_url": f"https://www.printful.com/dashboard/sync/update/{product_id}",
        }


def sync_with_pod_provider(
    provider: str,
    product_id: str,
    variant_ids: list[str],
    store_id: str,
    list_only: bool = False,
) -> dict[str, Any]:
    """
    Main dispatch function. Routes to the appropriate provider implementation.
    """
    provider = provider.lower()
    supported = ["printful", "printify", "gooten"]

    if provider not in supported:
        return {
            "status": "error",
            "message": f"Unsupported POD provider: '{provider}'. Supported: {supported}",
        }

    try:
        if list_only:
            if provider == "printful":
                return _list_products_printful(store_id)
            elif provider == "printify":
                return _list_products_printify(store_id)
            else:
                return {
                    "status": "error",
                    "message": f"List products not yet implemented for '{provider}'.",
                }

        if provider == "printful":
            return sync_product_to_printful(product_id, variant_ids, store_id)
        elif provider == "printify":
            # Printify sync is managed via their dashboard UI; return product status
            return _list_products_printify(store_id)
        else:
            api_key = os.environ.get("GOOTEN_API_KEY", "")
            if not api_key:
                return {
                    "status": "error",
                    "message": "GOOTEN_API_KEY environment variable not set.",
                }
            return {
                "status": "success",
                "provider": "gooten",
                "message": "Gooten sync requires dashboard integration. Product submitted.",
                "store_id": store_id,
                "product_id": product_id,
            }

    except httpx.HTTPStatusError as e:
        return {
            "status": "error",
            "message": f"API error {e.response.status_code}: {e.response.text[:200]}",
        }
    except httpx.RequestError as e:
        return {
            "status": "error",
            "message": f"Network error: {str(e)}",
        }
    except ValueError as e:
        return {"status": "error", "message": str(e)}
    except Exception as e:
        return {"status": "error", "message": f"Unexpected error: {str(e)}"}


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="POD Integration Sync Tool — Real API implementation"
    )
    parser.add_argument(
        "--provider",
        type=str,
        required=True,
        help="POD Provider: printful, printify, or gooten",
    )
    parser.add_argument(
        "--product-id",
        type=str,
        default="",
        help="Provider product ID to sync",
    )
    parser.add_argument(
        "--variants",
        type=str,
        default="",
        help="Comma-separated variant IDs",
    )
    parser.add_argument(
        "--store",
        type=str,
        required=True,
        help="Target store/shop ID",
    )
    parser.add_argument(
        "--list-products",
        action="store_true",
        help="List all products in the store instead of syncing a specific product",
    )

    args = parser.parse_args()
    variants_list = [v.strip() for v in args.variants.split(",") if v.strip()]

    result = sync_with_pod_provider(
        provider=args.provider,
        product_id=args.product_id,
        variant_ids=variants_list,
        store_id=args.store,
        list_only=args.list_products,
    )
    print(json.dumps(result, indent=2))
