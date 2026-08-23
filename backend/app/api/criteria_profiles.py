from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import CriteriaProfile
from app.schemas.criteria_profile import CriteriaProfileIn, CriteriaProfileOut

router = APIRouter()


@router.get("", response_model=list[CriteriaProfileOut])
def list_criteria_profiles(db: Session = Depends(get_db)):
    return db.query(CriteriaProfile).order_by(CriteriaProfile.version.desc()).all()


@router.post("", response_model=CriteriaProfileOut, status_code=201)
def create_criteria_profile(payload: CriteriaProfileIn, db: Session = Depends(get_db)):
    """Always inserts a new row — prompts are never edited in place, so existing
    Scores stay interpretable against the exact prompt_text that produced them."""
    if payload.is_active:
        db.query(CriteriaProfile).update({"is_active": False})

    next_version = (db.query(func.max(CriteriaProfile.version)).scalar() or 0) + 1
    profile = CriteriaProfile(
        name=payload.name,
        prompt_text=payload.prompt_text,
        weights=payload.weights,
        is_active=payload.is_active,
        version=next_version,
    )
    db.add(profile)
    db.commit()
    db.refresh(profile)
    return profile


@router.post("/{profile_id}/activate", response_model=CriteriaProfileOut)
def activate_criteria_profile(profile_id: int, db: Session = Depends(get_db)):
    profile = db.get(CriteriaProfile, profile_id)
    if profile is None:
        raise HTTPException(status_code=404, detail="Criteria profile not found")

    db.query(CriteriaProfile).update({"is_active": False})
    profile.is_active = True
    db.commit()
    db.refresh(profile)
    return profile
