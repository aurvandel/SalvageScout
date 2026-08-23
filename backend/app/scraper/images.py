from pathlib import Path

import httpx

from app.config import settings


def download_images(fb_listing_id: str, photo_urls: list[str]) -> list[dict]:
    """Download listing photos to local disk immediately — FB CDN URLs are signed
    and expire, so the URL itself can't be stored for later fetching."""
    base_dir = Path(settings.image_storage_dir) / fb_listing_id
    base_dir.mkdir(parents=True, exist_ok=True)

    results = []
    with httpx.Client(timeout=30.0) as client:
        for position, url in enumerate(photo_urls):
            local_path = base_dir / f"{position}.jpg"
            try:
                response = client.get(url)
                response.raise_for_status()
            except httpx.HTTPError:
                continue  # one bad photo shouldn't abort ingesting the listing
            local_path.write_bytes(response.content)
            results.append({"local_path": str(local_path), "position": position})
    return results
