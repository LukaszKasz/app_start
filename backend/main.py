from datetime import datetime, timedelta, timezone
from secrets import token_urlsafe

from fastapi import Depends, FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, ConfigDict, EmailStr, Field
from sqlalchemy import inspect, text
from sqlalchemy.orm import Session

from auth import (
    ACCESS_TOKEN_EXPIRE_MINUTES,
    create_access_token,
    get_current_admin_user,
    get_current_user,
    get_password_hash,
    verify_password,
)
from database import Base, engine, get_db
from models import User

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="App Start Auth API",
    description="Authentication API - POC with admin invites and password setup",
    version="1.2.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001", "http://localhost:13001", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class LoginRequest(BaseModel):
    username: str
    password: str


class Token(BaseModel):
    access_token: str
    token_type: str


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    username: str
    email: str
    first_name: str
    last_name: str
    role: str


class UserCreateRequest(BaseModel):
    email: EmailStr
    first_name: str = Field(min_length=1)
    last_name: str = Field(min_length=1)


class UserInviteResponse(BaseModel):
    user: UserResponse
    login_link: str


class InviteTokenRequest(BaseModel):
    token: str


class SetPasswordRequest(BaseModel):
    token: str
    password: str = Field(min_length=6)


class InviteTokenStatus(BaseModel):
    email: EmailStr
    first_name: str
    last_name: str


def ensure_user_columns() -> None:
    inspector = inspect(engine)
    existing_columns = {column["name"] for column in inspector.get_columns("users")} if inspector.has_table("users") else set()

    column_statements = {
        "first_name": "ALTER TABLE users ADD COLUMN first_name VARCHAR(100)",
        "last_name": "ALTER TABLE users ADD COLUMN last_name VARCHAR(100)",
        "role": "ALTER TABLE users ADD COLUMN role VARCHAR(20)",
        "login_token": "ALTER TABLE users ADD COLUMN login_token VARCHAR(255)",
        "login_token_expires_at": "ALTER TABLE users ADD COLUMN login_token_expires_at TIMESTAMP WITH TIME ZONE",
    }

    with engine.begin() as connection:
        for column_name, statement in column_statements.items():
            if column_name not in existing_columns:
                connection.execute(text(statement))

        connection.execute(
            text(
                """
                UPDATE users
                SET first_name = COALESCE(first_name, username),
                    last_name = COALESCE(last_name, ''),
                    role = COALESCE(role, CASE WHEN username = 'admin' THEN 'admin' ELSE 'user' END)
                """
            )
        )

        connection.execute(text("ALTER TABLE users ALTER COLUMN first_name SET NOT NULL"))
        connection.execute(text("ALTER TABLE users ALTER COLUMN last_name SET NOT NULL"))
        connection.execute(text("ALTER TABLE users ALTER COLUMN role SET NOT NULL"))
        connection.execute(text("ALTER TABLE users ALTER COLUMN role SET DEFAULT 'user'"))


def ensure_admin_user() -> None:
    with Session(engine) as db:
        admin_user = db.query(User).filter(User.username == "admin").first()
        if admin_user:
            if not admin_user.email:
                admin_user.email = "admin@example.com"
            admin_user.first_name = "Admin"
            admin_user.last_name = "POC"
            admin_user.role = "admin"
            admin_user.hashed_password = get_password_hash("admin")
            admin_user.login_token = None
            admin_user.login_token_expires_at = None
        else:
            admin_user = User(
                username="admin",
                email="admin@example.com",
                first_name="Admin",
                last_name="POC",
                role="admin",
                hashed_password=get_password_hash("admin"),
            )
            db.add(admin_user)

        db.commit()


ensure_user_columns()
ensure_admin_user()


def create_user_access_token(user: User) -> str:
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    return create_access_token(data={"sub": user.username}, expires_delta=access_token_expires)


def create_invite_link(user: User, db: Session) -> str:
    invite_token = token_urlsafe(32)
    user.login_token = invite_token
    user.login_token_expires_at = datetime.now(timezone.utc) + timedelta(hours=24)
    db.add(user)
    db.commit()
    db.refresh(user)
    return f"http://localhost:13001/activate-account?token={invite_token}"


def get_user_by_valid_invite_token(token: str, db: Session) -> User:
    user = db.query(User).filter(User.login_token == token).first()
    if not user or not user.login_token_expires_at:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid setup link")

    expires_at = user.login_token_expires_at
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)

    if expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Setup link has expired")

    return user


@app.get("/")
def read_root():
    return {"message": "App Start Auth API is running", "version": "1.2.0", "docs": "/docs"}


@app.post("/login", response_model=Token)
def login(login_data: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == login_data.username).first()

    if not user or not verify_password(login_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return {"access_token": create_user_access_token(user), "token_type": "bearer"}


@app.post("/invite-link/validate", response_model=InviteTokenStatus)
def validate_invite_link(payload: InviteTokenRequest, db: Session = Depends(get_db)):
    user = get_user_by_valid_invite_token(payload.token, db)
    return {"email": user.email, "first_name": user.first_name, "last_name": user.last_name}


@app.post("/set-password")
def set_password(payload: SetPasswordRequest, db: Session = Depends(get_db)):
    user = get_user_by_valid_invite_token(payload.token, db)
    user.hashed_password = get_password_hash(payload.password)
    user.login_token = None
    user.login_token_expires_at = None
    db.add(user)
    db.commit()
    return {"message": "Password set successfully"}


@app.get("/me", response_model=UserResponse)
def read_users_me(current_user: User = Depends(get_current_user)):
    return current_user


@app.get("/users", response_model=list[UserResponse])
def list_users(_: User = Depends(get_current_admin_user), db: Session = Depends(get_db)):
    return db.query(User).order_by(User.id.asc()).all()


@app.post("/users", response_model=UserInviteResponse, status_code=status.HTTP_201_CREATED)
def create_user(
    payload: UserCreateRequest,
    _: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    normalized_email = payload.email.lower()
    existing_email = db.query(User).filter(User.email == normalized_email).first()
    if existing_email:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already registered")

    user = User(
        username=normalized_email,
        email=normalized_email,
        first_name=payload.first_name.strip(),
        last_name=payload.last_name.strip(),
        role="user",
        hashed_password=get_password_hash(token_urlsafe(24)),
    )

    db.add(user)
    db.commit()
    db.refresh(user)

    login_link = create_invite_link(user, db)
    return {"user": user, "login_link": login_link}


@app.post("/users/{user_id}/login-link", response_model=UserInviteResponse)
def regenerate_login_link(
    user_id: int,
    _: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    login_link = create_invite_link(user, db)
    return {"user": user, "login_link": login_link}


@app.get("/health")
def health_check():
    return {"status": "healthy"}
