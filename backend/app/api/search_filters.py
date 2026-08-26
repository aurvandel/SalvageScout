from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import CriteriaProfile, SearchFilter
from app.schemas.search_filter import SearchFilterIn, SearchFilterOut

router = APIRouter()


def _check_criteria_profile_exists(db: Session, criteria_profile_id: int | None) -> None:
    if criteria_profile_id is not None and db.get(CriteriaProfile, criteria_profile_id) is None:
        raise HTTPException(status_code=404, detail="Criteria profile not found")


@router.get("", response_model=list[SearchFilterOut])
def list_search_filters(db: Session = Depends(get_db)):
    return db.query(SearchFilter).all()


@router.post("", response_model=SearchFilterOut, status_code=201)
def create_search_filter(payload: SearchFilterIn, db: Session = Depends(get_db)):
    _check_criteria_profile_exists(db, payload.criteria_profile_id)
    search_filter = SearchFilter(**payload.model_dump())
    db.add(search_filter)
    db.commit()
    db.refresh(search_filter)
    return search_filter


@router.patch("/{search_filter_id}", response_model=SearchFilterOut)
def update_search_filter(search_filter_id: int, payload: SearchFilterIn, db: Session = Depends(get_db)):
    search_filter = db.get(SearchFilter, search_filter_id)
    if search_filter is None:
        raise HTTPException(status_code=404, detail="Search filter not found")
    _check_criteria_profile_exists(db, payload.criteria_profile_id)

    for key, value in payload.model_dump().items():
        setattr(search_filter, key, value)
    db.commit()
    db.refresh(search_filter)
    return search_filter


@router.delete("/{search_filter_id}", status_code=204)
def delete_search_filter(search_filter_id: int, db: Session = Depends(get_db)):
    search_filter = db.get(SearchFilter, search_filter_id)
    if search_filter is None:
        raise HTTPException(status_code=404, detail="Search filter not found")

    db.delete(search_filter)
    db.commit()
