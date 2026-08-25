from datetime import datetime
from pathlib import PurePath

from pydantic import BaseModel, ConfigDict, computed_field

from app.schemas.score import ScoreOut


class ListingImageOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    local_path: str
    position: int

    @computed_field
    @property
    def image_url(self) -> str:
        # local_path is always written as "<image_storage_dir>/<fb_listing_id>/<file>"
        # (see app/scraper/images.py) — use the last two segments rather than
        # stripping settings.image_storage_dir, since that setting can drift between
        # when a row was written and when it's read without invalidating the path shape.
        parts = PurePath(self.local_path).parts[-2:]
        return f"/media/{'/'.join(parts)}"


class ListingOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    fb_listing_id: str
    url: str
    title: str
    description: str | None
    price_amount: float | None
    currency: str | None
    strikethrough_price_amount: float | None
    condition: str | None
    is_live: bool
    is_pending: bool
    is_sold: bool
    is_favorite: bool
    is_hidden: bool
    is_deleted: bool
    deleted_at: datetime | None
    viewed_at: datetime | None
    location_text: str | None
    year: int | None
    make: str | None
    model: str | None
    mileage: int | None
    posted_at: datetime | None
    first_seen_at: datetime
    last_seen_at: datetime
    images: list[ListingImageOut] = []
    scores: list[ScoreOut] = []


class ListingPage(BaseModel):
    items: list[ListingOut]
    has_more: bool
