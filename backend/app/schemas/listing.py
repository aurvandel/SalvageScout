from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.schemas.score import ScoreOut


class ListingImageOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    local_path: str
    position: int


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
