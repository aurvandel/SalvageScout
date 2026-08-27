from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import ApifyAccount
from app.schemas.apify_account import ApifyAccountIn, ApifyAccountOut
from app.schemas.app_settings import mask_secret
from app.settings_service import get_apify_accounts

router = APIRouter()


def _account_out(account: ApifyAccount) -> ApifyAccountOut:
    return ApifyAccountOut(
        id=account.id,
        label=account.label,
        api_token_masked=mask_secret(account.api_token),
        priority=account.priority,
        is_active=account.is_active,
        last_used_at=account.last_used_at,
        last_error=account.last_error,
        last_error_at=account.last_error_at,
    )


@router.get("", response_model=list[ApifyAccountOut])
def list_apify_accounts(db: Session = Depends(get_db)):
    return [_account_out(a) for a in get_apify_accounts(db)]


@router.post("", response_model=ApifyAccountOut, status_code=201)
def create_apify_account(payload: ApifyAccountIn, db: Session = Depends(get_db)):
    if not payload.label:
        raise HTTPException(status_code=422, detail="label is required")
    if not payload.api_token:
        raise HTTPException(status_code=422, detail="api_token is required")

    account = ApifyAccount(
        label=payload.label,
        api_token=payload.api_token,
        priority=payload.priority,
        is_active=payload.is_active,
    )
    db.add(account)
    db.commit()
    db.refresh(account)
    return _account_out(account)


@router.patch("/{account_id}", response_model=ApifyAccountOut)
def update_apify_account(account_id: int, payload: ApifyAccountIn, db: Session = Depends(get_db)):
    account = db.get(ApifyAccount, account_id)
    if account is None:
        raise HTTPException(status_code=404, detail="Apify account not found")

    fields = payload.model_dump(exclude_unset=True)
    if "label" in fields:
        account.label = fields["label"]
    if fields.get("api_token"):
        account.api_token = fields["api_token"]
    if "priority" in fields:
        account.priority = fields["priority"]
    if "is_active" in fields:
        account.is_active = fields["is_active"]

    db.commit()
    db.refresh(account)
    return _account_out(account)


@router.delete("/{account_id}", status_code=204)
def delete_apify_account(account_id: int, db: Session = Depends(get_db)):
    account = db.get(ApifyAccount, account_id)
    if account is None:
        raise HTTPException(status_code=404, detail="Apify account not found")

    db.delete(account)
    db.commit()
