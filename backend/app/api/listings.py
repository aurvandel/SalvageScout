from datetime import datetime, timezone
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import Listing, Score
from app.schemas.listing import ListingOut, ListingPage

router = APIRouter()


@router.get("", response_model=ListingPage)
def list_listings(
    min_score: int | None = None,
    view: Literal["active", "hidden", "favorites"] = "active",
    search_filter_id: int | None = None,
    limit: int = 24,
    offset: int = 0,
    db: Session = Depends(get_db),
):
    best_score = db.query(Score.listing_id, func.max(Score.match_score).label("best_score")).group_by(
        Score.listing_id
    ).subquery()

    query = db.query(Listing).outerjoin(best_score, Listing.id == best_score.c.listing_id)
    query = query.filter(Listing.is_deleted.is_(False))

    if search_filter_id is not None:
        query = query.filter(Listing.search_filter_id == search_filter_id)

    if view == "hidden":
        query = query.filter(Listing.is_hidden.is_(True))
    elif view == "favorites":
        query = query.filter(Listing.is_hidden.is_(False), Listing.is_favorite.is_(True))
    else:
        query = query.filter(Listing.is_hidden.is_(False))

    if min_score is not None:
        query = query.filter(best_score.c.best_score >= min_score)

    query = query.order_by(best_score.c.best_score.desc().nullslast(), Listing.id.desc())

    # Fetch one extra row to tell whether there's a next page, without a separate COUNT(*).
    rows = query.offset(offset).limit(limit + 1).all()
    return ListingPage(items=rows[:limit], has_more=len(rows) > limit)


@router.get("/{listing_id}", response_model=ListingOut)
def get_listing(listing_id: int, db: Session = Depends(get_db)):
    listing = db.get(Listing, listing_id)
    if listing is None:
        raise HTTPException(status_code=404, detail="Listing not found")
    return listing


@router.patch("/{listing_id}/favorite", response_model=ListingOut)
def set_favorite(listing_id: int, favorite: bool, db: Session = Depends(get_db)):
    listing = db.get(Listing, listing_id)
    if listing is None:
        raise HTTPException(status_code=404, detail="Listing not found")
    listing.is_favorite = favorite
    db.commit()
    db.refresh(listing)
    return listing


@router.patch("/{listing_id}/hide", response_model=ListingOut)
def set_hidden(listing_id: int, hidden: bool, db: Session = Depends(get_db)):
    listing = db.get(Listing, listing_id)
    if listing is None:
        raise HTTPException(status_code=404, detail="Listing not found")
    listing.is_hidden = hidden
    db.commit()
    db.refresh(listing)
    return listing


@router.delete("/{listing_id}", response_model=ListingOut)
def delete_listing(listing_id: int, db: Session = Depends(get_db)):
    """Soft delete: flips is_deleted rather than removing the row, so the listing
    stays excluded from future results even after ingest_listings() re-upserts it
    on the next scrape of the same fb_listing_id."""
    listing = db.get(Listing, listing_id)
    if listing is None:
        raise HTTPException(status_code=404, detail="Listing not found")
    listing.is_deleted = True
    listing.deleted_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(listing)
    return listing


@router.patch("/{listing_id}/view", response_model=ListingOut)
def mark_listing_viewed(listing_id: int, db: Session = Depends(get_db)):
    listing = db.get(Listing, listing_id)
    if listing is None:
        raise HTTPException(status_code=404, detail="Listing not found")
    if listing.viewed_at is None:
        listing.viewed_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(listing)
    return listing
