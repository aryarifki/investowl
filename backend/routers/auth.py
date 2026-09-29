import json
import os
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
import models
import schemas

# KITA GANTI PREFIX MENJADI /users AGAR TIDAK DIBJAK CLOUDFLARE
router = APIRouter(prefix="/users", tags=["users"])

@router.post("/sync", response_model=schemas.UserRead)
def sync_user(user_req: schemas.UserSyncRequest, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == user_req.email).first()
    
    if not user:
        # Pengecekan admin: jika ADMIN_EMAILS disetel di .env, gunakan whitelist presisi.
        # Fallback kompatibilitas otomatis jika env belum disetel agar tidak lock out.
        admin_whitelist = {
            e.strip().lower() 
            for e in os.getenv("ADMIN_EMAILS", "").split(",") 
            if e.strip()
        }
        
        email_clean = user_req.email.strip().lower()
        if admin_whitelist:
            is_owner = email_clean in admin_whitelist
        else:
            is_owner = "adryan" in email_clean or "arya" in email_clean
        
        user = models.User(
            email=user_req.email,
            name=user_req.name,
            image=user_req.image,
            provider=user_req.provider,
            role="admin" if is_owner else "user",
            is_approved=True  # Auto-approved so users can seamlessly save and sync data
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        
    return user

@router.get("/", response_model=list[schemas.UserRead])
def get_users(db: Session = Depends(get_db)):
    return db.query(models.User).order_by(models.User.created_at.desc()).all()

@router.patch("/{user_id}/approve", response_model=schemas.UserRead)
def approve_user(user_id: int, approval: schemas.UserApprovalRequest, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User tidak ditemukan")
        
    user.is_approved = approval.is_approved
    db.commit()
    db.refresh(user)
    return user

@router.get("/{email}/watchlist")
def get_user_watchlist(email: str, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == email).first()
    if not user or not user.watchlist:
        return {"watchlist": []}
    try:
        data = json.loads(user.watchlist)
        return {"watchlist": data if isinstance(data, list) else []}
    except Exception:
        return {"watchlist": []}

@router.put("/{email}/watchlist")
def update_user_watchlist(email: str, payload: schemas.UserWatchlistUpdate, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == email).first()
    if not user:
        raise HTTPException(status_code=404, detail="User tidak ditemukan")
    user.watchlist = json.dumps(payload.watchlist)
    db.commit()
    return {"status": "ok", "watchlist": payload.watchlist}
