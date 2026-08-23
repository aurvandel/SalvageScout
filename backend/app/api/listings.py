from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import Listing, Score
from app.schemas.listing import ListingOut

router = APIRouter()


@router.get("", response_model=list[ListingOut])
def list_listings(min_score: int | None = None, db: Session = Depends(get_db)):
    best_score = db.query(Score.listing_id, func.max(Score.match_score).label("best_score")).group_by(
        Score.listing_id
    ).subquery()

    query = db.query(Listing).outerjoin(best_score, Listing.id == best_score.c.listing_id)
    if min_score is not None:
        query = query.filter(best_score.c.best_score >= min_score)

    return query.order_by(best_score.c.best_score.desc().nullslast(), Listing.last_seen_at.desc()).all()


@router.get("/{listing_id}", response_model=ListingOut)
def get_listing(listing_id: int, db: Session = Depends(get_db)):
    listing = db.get(Listing, listing_id)
    if listing is None:
        raise HTTPException(status_code=404, detail="Listing not found")
    return listing
