from fastapi import FastAPI, APIRouter, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional
import uuid
from datetime import datetime, timedelta
import jwt
import bcrypt
from bson import ObjectId
import base64

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ.get('DB_NAME', 'test_database')]

# JWT Configuration
JWT_SECRET = os.environ.get('JWT_SECRET', 'brush-vault-secret-key')
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_HOURS = 720  # 30 days

# Create the main app
app = FastAPI(title="Brush Vault - Paint Tracking API")

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Security
security = HTTPBearer()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# ============== Models ==============

class UserCreate(BaseModel):
    email: EmailStr
    password: str
    display_name: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    id: str
    email: str
    display_name: str
    created_at: datetime

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse

# Paint Models
class PaintBase(BaseModel):
    brand: str
    name: str
    paint_type: str  # base, layer, shade, wash, contrast, dry, technical, air, speedpaint
    hex_color: str
    category: Optional[str] = None  # e.g., "Red", "Blue", "Metallic"
    is_custom: bool = False

class PaintCreate(PaintBase):
    pass

class PaintResponse(PaintBase):
    id: str

# User Paint Collection
class UserPaintCreate(BaseModel):
    paint_id: str
    status: str = "owned"  # owned, wishlist
    quantity: int = 1
    notes: Optional[str] = None

class UserPaintUpdate(BaseModel):
    status: Optional[str] = None
    quantity: Optional[int] = None
    notes: Optional[str] = None

class UserPaintResponse(BaseModel):
    id: str
    user_id: str
    paint_id: str
    paint: Optional[PaintResponse] = None
    status: str
    quantity: int
    notes: Optional[str] = None
    created_at: datetime
    updated_at: datetime

# Project Models
class ProjectCreate(BaseModel):
    name: str
    description: Optional[str] = None
    image_base64: Optional[str] = None

class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    image_base64: Optional[str] = None
    status: Optional[str] = None

class ProjectPaintAdd(BaseModel):
    paint_id: str
    is_required: bool = True
    notes: Optional[str] = None

class ProjectResponse(BaseModel):
    id: str
    user_id: str
    name: str
    description: Optional[str] = None
    image_base64: Optional[str] = None
    status: str  # active, completed, archived
    paints: List[dict] = []
    created_at: datetime
    updated_at: datetime

# Paint Recognition
class PaintRecognitionRequest(BaseModel):
    image_base64: str

class ManualPaintAdd(BaseModel):
    brand: str
    name: str
    paint_type: str
    hex_color: str
    category: Optional[str] = None
    image_base64: Optional[str] = None

# ============== Auth Functions ==============

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode(), hashed.encode())

def create_access_token(user_id: str) -> str:
    expire = datetime.utcnow() + timedelta(hours=JWT_EXPIRATION_HOURS)
    payload = {"sub": user_id, "exp": expire}
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token")
        
        user = await db.users.find_one({"_id": ObjectId(user_id)})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

# ============== Auth Endpoints ==============

@api_router.post("/auth/register", response_model=TokenResponse)
async def register(user_data: UserCreate):
    # Check if user exists
    existing = await db.users.find_one({"email": user_data.email.lower()})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Create user
    user_doc = {
        "email": user_data.email.lower(),
        "password_hash": hash_password(user_data.password),
        "display_name": user_data.display_name,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    }
    result = await db.users.insert_one(user_doc)
    user_id = str(result.inserted_id)
    
    token = create_access_token(user_id)
    return TokenResponse(
        access_token=token,
        user=UserResponse(
            id=user_id,
            email=user_doc["email"],
            display_name=user_doc["display_name"],
            created_at=user_doc["created_at"]
        )
    )

@api_router.post("/auth/login", response_model=TokenResponse)
async def login(user_data: UserLogin):
    user = await db.users.find_one({"email": user_data.email.lower()})
    if not user or not verify_password(user_data.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    user_id = str(user["_id"])
    token = create_access_token(user_id)
    return TokenResponse(
        access_token=token,
        user=UserResponse(
            id=user_id,
            email=user["email"],
            display_name=user["display_name"],
            created_at=user["created_at"]
        )
    )

@api_router.get("/auth/me", response_model=UserResponse)
async def get_me(current_user: dict = Depends(get_current_user)):
    return UserResponse(
        id=str(current_user["_id"]),
        email=current_user["email"],
        display_name=current_user["display_name"],
        created_at=current_user["created_at"]
    )

# ============== Paint Database Endpoints ==============

@api_router.get("/paints", response_model=List[PaintResponse])
async def get_paints(
    brand: Optional[str] = None,
    paint_type: Optional[str] = None,
    category: Optional[str] = None,
    search: Optional[str] = None
):
    query = {}
    if brand:
        query["brand"] = {"$regex": brand, "$options": "i"}
    if paint_type:
        query["paint_type"] = paint_type
    if category:
        query["category"] = {"$regex": category, "$options": "i"}
    if search:
        query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"brand": {"$regex": search, "$options": "i"}}
        ]
    
    paints = await db.paints.find(query).to_list(1000)
    return [PaintResponse(id=str(p["_id"]), **{k: v for k, v in p.items() if k != "_id"}) for p in paints]

@api_router.get("/paints/brands")
async def get_brands():
    brands = await db.paints.distinct("brand")
    return {"brands": brands}

@api_router.get("/paints/types")
async def get_paint_types():
    types = await db.paints.distinct("paint_type")
    return {"types": types}

@api_router.get("/paints/{paint_id}", response_model=PaintResponse)
async def get_paint(paint_id: str):
    paint = await db.paints.find_one({"_id": ObjectId(paint_id)})
    if not paint:
        raise HTTPException(status_code=404, detail="Paint not found")
    return PaintResponse(id=str(paint["_id"]), **{k: v for k, v in paint.items() if k != "_id"})

@api_router.post("/paints/custom", response_model=PaintResponse)
async def create_custom_paint(
    paint_data: ManualPaintAdd,
    current_user: dict = Depends(get_current_user)
):
    paint_doc = {
        "brand": paint_data.brand,
        "name": paint_data.name,
        "paint_type": paint_data.paint_type,
        "hex_color": paint_data.hex_color,
        "category": paint_data.category,
        "is_custom": True,
        "created_by": str(current_user["_id"]),
        "image_base64": paint_data.image_base64
    }
    result = await db.paints.insert_one(paint_doc)
    return PaintResponse(id=str(result.inserted_id), **{k: v for k, v in paint_doc.items() if k not in ["_id", "created_by", "image_base64"]})

# ============== User Paint Collection Endpoints ==============

@api_router.get("/collection", response_model=List[UserPaintResponse])
async def get_user_collection(
    status: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    user_id = str(current_user["_id"])
    query = {"user_id": user_id}
    if status:
        query["status"] = status
    
    user_paints = await db.user_paints.find(query).to_list(1000)
    
    # Enrich with paint details
    result = []
    for up in user_paints:
        paint = await db.paints.find_one({"_id": ObjectId(up["paint_id"])})
        paint_response = None
        if paint:
            paint_response = PaintResponse(id=str(paint["_id"]), **{k: v for k, v in paint.items() if k != "_id"})
        
        result.append(UserPaintResponse(
            id=str(up["_id"]),
            user_id=up["user_id"],
            paint_id=up["paint_id"],
            paint=paint_response,
            status=up["status"],
            quantity=up["quantity"],
            notes=up.get("notes"),
            created_at=up["created_at"],
            updated_at=up["updated_at"]
        ))
    return result

@api_router.post("/collection", response_model=UserPaintResponse)
async def add_to_collection(
    paint_data: UserPaintCreate,
    current_user: dict = Depends(get_current_user)
):
    user_id = str(current_user["_id"])
    
    # Check if paint exists
    paint = await db.paints.find_one({"_id": ObjectId(paint_data.paint_id)})
    if not paint:
        raise HTTPException(status_code=404, detail="Paint not found")
    
    # Check if already in collection
    existing = await db.user_paints.find_one({
        "user_id": user_id,
        "paint_id": paint_data.paint_id
    })
    if existing:
        raise HTTPException(status_code=400, detail="Paint already in collection")
    
    now = datetime.utcnow()
    user_paint_doc = {
        "user_id": user_id,
        "paint_id": paint_data.paint_id,
        "status": paint_data.status,
        "quantity": paint_data.quantity,
        "notes": paint_data.notes,
        "created_at": now,
        "updated_at": now
    }
    result = await db.user_paints.insert_one(user_paint_doc)
    
    paint_response = PaintResponse(id=str(paint["_id"]), **{k: v for k, v in paint.items() if k != "_id"})
    
    return UserPaintResponse(
        id=str(result.inserted_id),
        user_id=user_id,
        paint_id=paint_data.paint_id,
        paint=paint_response,
        status=paint_data.status,
        quantity=paint_data.quantity,
        notes=paint_data.notes,
        created_at=now,
        updated_at=now
    )

@api_router.patch("/collection/{item_id}", response_model=UserPaintResponse)
async def update_collection_item(
    item_id: str,
    update_data: UserPaintUpdate,
    current_user: dict = Depends(get_current_user)
):
    user_id = str(current_user["_id"])
    
    item = await db.user_paints.find_one({
        "_id": ObjectId(item_id),
        "user_id": user_id
    })
    if not item:
        raise HTTPException(status_code=404, detail="Item not found in collection")
    
    updates = {"updated_at": datetime.utcnow()}
    if update_data.status is not None:
        updates["status"] = update_data.status
    if update_data.quantity is not None:
        updates["quantity"] = update_data.quantity
    if update_data.notes is not None:
        updates["notes"] = update_data.notes
    
    await db.user_paints.update_one({"_id": ObjectId(item_id)}, {"$set": updates})
    
    updated_item = await db.user_paints.find_one({"_id": ObjectId(item_id)})
    paint = await db.paints.find_one({"_id": ObjectId(updated_item["paint_id"])})
    paint_response = PaintResponse(id=str(paint["_id"]), **{k: v for k, v in paint.items() if k != "_id"}) if paint else None
    
    return UserPaintResponse(
        id=str(updated_item["_id"]),
        user_id=updated_item["user_id"],
        paint_id=updated_item["paint_id"],
        paint=paint_response,
        status=updated_item["status"],
        quantity=updated_item["quantity"],
        notes=updated_item.get("notes"),
        created_at=updated_item["created_at"],
        updated_at=updated_item["updated_at"]
    )

@api_router.delete("/collection/{item_id}")
async def remove_from_collection(
    item_id: str,
    current_user: dict = Depends(get_current_user)
):
    user_id = str(current_user["_id"])
    result = await db.user_paints.delete_one({
        "_id": ObjectId(item_id),
        "user_id": user_id
    })
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Item not found")
    return {"message": "Removed from collection"}

# ============== Project Endpoints ==============

@api_router.get("/projects", response_model=List[ProjectResponse])
async def get_projects(
    status: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    user_id = str(current_user["_id"])
    query = {"user_id": user_id}
    if status:
        query["status"] = status
    
    projects = await db.projects.find(query).sort("updated_at", -1).to_list(100)
    return [ProjectResponse(
        id=str(p["_id"]),
        user_id=p["user_id"],
        name=p["name"],
        description=p.get("description"),
        image_base64=p.get("image_base64"),
        status=p["status"],
        paints=p.get("paints", []),
        created_at=p["created_at"],
        updated_at=p["updated_at"]
    ) for p in projects]

@api_router.post("/projects", response_model=ProjectResponse)
async def create_project(
    project_data: ProjectCreate,
    current_user: dict = Depends(get_current_user)
):
    user_id = str(current_user["_id"])
    now = datetime.utcnow()
    
    project_doc = {
        "user_id": user_id,
        "name": project_data.name,
        "description": project_data.description,
        "image_base64": project_data.image_base64,
        "status": "active",
        "paints": [],
        "created_at": now,
        "updated_at": now
    }
    result = await db.projects.insert_one(project_doc)
    
    return ProjectResponse(
        id=str(result.inserted_id),
        user_id=user_id,
        name=project_data.name,
        description=project_data.description,
        image_base64=project_data.image_base64,
        status="active",
        paints=[],
        created_at=now,
        updated_at=now
    )

@api_router.get("/projects/{project_id}", response_model=ProjectResponse)
async def get_project(
    project_id: str,
    current_user: dict = Depends(get_current_user)
):
    user_id = str(current_user["_id"])
    project = await db.projects.find_one({
        "_id": ObjectId(project_id),
        "user_id": user_id
    })
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    return ProjectResponse(
        id=str(project["_id"]),
        user_id=project["user_id"],
        name=project["name"],
        description=project.get("description"),
        image_base64=project.get("image_base64"),
        status=project["status"],
        paints=project.get("paints", []),
        created_at=project["created_at"],
        updated_at=project["updated_at"]
    )

@api_router.patch("/projects/{project_id}", response_model=ProjectResponse)
async def update_project(
    project_id: str,
    update_data: ProjectUpdate,
    current_user: dict = Depends(get_current_user)
):
    user_id = str(current_user["_id"])
    
    project = await db.projects.find_one({
        "_id": ObjectId(project_id),
        "user_id": user_id
    })
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    updates = {"updated_at": datetime.utcnow()}
    if update_data.name is not None:
        updates["name"] = update_data.name
    if update_data.description is not None:
        updates["description"] = update_data.description
    if update_data.image_base64 is not None:
        updates["image_base64"] = update_data.image_base64
    if update_data.status is not None:
        updates["status"] = update_data.status
    
    await db.projects.update_one({"_id": ObjectId(project_id)}, {"$set": updates})
    
    updated = await db.projects.find_one({"_id": ObjectId(project_id)})
    return ProjectResponse(
        id=str(updated["_id"]),
        user_id=updated["user_id"],
        name=updated["name"],
        description=updated.get("description"),
        image_base64=updated.get("image_base64"),
        status=updated["status"],
        paints=updated.get("paints", []),
        created_at=updated["created_at"],
        updated_at=updated["updated_at"]
    )

@api_router.delete("/projects/{project_id}")
async def delete_project(
    project_id: str,
    current_user: dict = Depends(get_current_user)
):
    user_id = str(current_user["_id"])
    result = await db.projects.delete_one({
        "_id": ObjectId(project_id),
        "user_id": user_id
    })
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Project not found")
    return {"message": "Project deleted"}

@api_router.post("/projects/{project_id}/paints")
async def add_paint_to_project(
    project_id: str,
    paint_data: ProjectPaintAdd,
    current_user: dict = Depends(get_current_user)
):
    user_id = str(current_user["_id"])
    
    project = await db.projects.find_one({
        "_id": ObjectId(project_id),
        "user_id": user_id
    })
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Check if paint exists
    paint = await db.paints.find_one({"_id": ObjectId(paint_data.paint_id)})
    if not paint:
        raise HTTPException(status_code=404, detail="Paint not found")
    
    # Check if already added
    existing_paints = project.get("paints", [])
    if any(p["paint_id"] == paint_data.paint_id for p in existing_paints):
        raise HTTPException(status_code=400, detail="Paint already in project")
    
    # Check if user owns this paint
    user_paint = await db.user_paints.find_one({
        "user_id": user_id,
        "paint_id": paint_data.paint_id,
        "status": "owned"
    })
    
    paint_entry = {
        "paint_id": paint_data.paint_id,
        "is_required": paint_data.is_required,
        "is_owned": user_paint is not None,
        "notes": paint_data.notes
    }
    
    await db.projects.update_one(
        {"_id": ObjectId(project_id)},
        {
            "$push": {"paints": paint_entry},
            "$set": {"updated_at": datetime.utcnow()}
        }
    )
    
    return {"message": "Paint added to project", "paint_entry": paint_entry}

@api_router.delete("/projects/{project_id}/paints/{paint_id}")
async def remove_paint_from_project(
    project_id: str,
    paint_id: str,
    current_user: dict = Depends(get_current_user)
):
    user_id = str(current_user["_id"])
    
    result = await db.projects.update_one(
        {"_id": ObjectId(project_id), "user_id": user_id},
        {
            "$pull": {"paints": {"paint_id": paint_id}},
            "$set": {"updated_at": datetime.utcnow()}
        }
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Paint not found in project")
    return {"message": "Paint removed from project"}

@api_router.get("/projects/{project_id}/missing-paints")
async def get_missing_paints(
    project_id: str,
    current_user: dict = Depends(get_current_user)
):
    user_id = str(current_user["_id"])
    
    project = await db.projects.find_one({
        "_id": ObjectId(project_id),
        "user_id": user_id
    })
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    missing_paints = []
    for paint_entry in project.get("paints", []):
        if paint_entry.get("is_required", True) and not paint_entry.get("is_owned", False):
            paint = await db.paints.find_one({"_id": ObjectId(paint_entry["paint_id"])})
            if paint:
                missing_paints.append({
                    "paint": PaintResponse(id=str(paint["_id"]), **{k: v for k, v in paint.items() if k != "_id"}),
                    "notes": paint_entry.get("notes")
                })
    
    return {"missing_paints": missing_paints, "count": len(missing_paints)}

# ============== Paint Recognition Endpoint ==============

@api_router.post("/recognize-paint")
async def recognize_paint(
    request: PaintRecognitionRequest,
    current_user: dict = Depends(get_current_user)
):
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage, ImageContent
        
        api_key = os.environ.get("EMERGENT_LLM_KEY")
        if not api_key:
            raise HTTPException(status_code=500, detail="AI service not configured")
        
        # Create chat instance for paint recognition
        chat = LlmChat(
            api_key=api_key,
            session_id=f"paint-recognition-{str(current_user['_id'])}-{datetime.utcnow().timestamp()}",
            system_message="""You are a paint identification expert specializing in miniature painting paints. 
            Analyze the image and identify the paint brand, name, type, and approximate hex color.
            
            Common brands include: Citadel (Games Workshop), Vallejo, Army Painter, Scale75, Reaper, P3, Tamiya.
            Paint types include: base, layer, shade/wash, contrast, dry, technical, air, metallic, speedpaint.
            
            Respond in JSON format only:
            {
                "brand": "Brand name",
                "name": "Paint name",
                "paint_type": "type",
                "hex_color": "#XXXXXX",
                "category": "color category",
                "confidence": 0.0-1.0
            }
            
            If you cannot identify the paint clearly, provide your best guess with a low confidence score."""
        ).with_model("openai", "gpt-4o")
        
        # Create image content
        image_content = ImageContent(image_base64=request.image_base64)
        
        # Create user message with image
        user_message = UserMessage(
            text="Please identify this miniature paint. Look at the label, bottle shape, and any visible text to determine the brand and color name.",
            image_contents=[image_content]
        )
        
        # Get response
        response = await chat.send_message(user_message)
        
        # Parse JSON response
        import json
        import re
        
        # Try to extract JSON from response
        json_match = re.search(r'\{[^{}]*\}', response, re.DOTALL)
        if json_match:
            paint_info = json.loads(json_match.group())
            
            # Search for matching paint in database
            matching_paints = await db.paints.find({
                "$or": [
                    {"name": {"$regex": paint_info.get("name", ""), "$options": "i"}},
                    {"brand": {"$regex": paint_info.get("brand", ""), "$options": "i"}}
                ]
            }).to_list(5)
            
            matches = [PaintResponse(id=str(p["_id"]), **{k: v for k, v in p.items() if k != "_id"}) for p in matching_paints]
            
            return {
                "recognized": paint_info,
                "matches": matches,
                "raw_response": response
            }
        else:
            return {
                "recognized": None,
                "matches": [],
                "raw_response": response,
                "error": "Could not parse paint information"
            }
            
    except Exception as e:
        logger.error(f"Paint recognition error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Recognition failed: {str(e)}")

# ============== Seed Paint Database ==============

@api_router.post("/seed-paints")
async def seed_paints():
    """Seed the database with popular miniature paints"""
    
    # Check if already seeded
    count = await db.paints.count_documents({})
    if count > 0:
        return {"message": f"Database already has {count} paints", "seeded": False}
    
    paints_to_seed = [
        # Citadel Base Paints
        {"brand": "Citadel", "name": "Abaddon Black", "paint_type": "base", "hex_color": "#231F20", "category": "Black", "is_custom": False},
        {"brand": "Citadel", "name": "Averland Sunset", "paint_type": "base", "hex_color": "#FDB825", "category": "Yellow", "is_custom": False},
        {"brand": "Citadel", "name": "Balthasar Gold", "paint_type": "base", "hex_color": "#A47552", "category": "Metallic", "is_custom": False},
        {"brand": "Citadel", "name": "Bugman's Glow", "paint_type": "base", "hex_color": "#834F44", "category": "Flesh", "is_custom": False},
        {"brand": "Citadel", "name": "Caledor Sky", "paint_type": "base", "hex_color": "#366699", "category": "Blue", "is_custom": False},
        {"brand": "Citadel", "name": "Caliban Green", "paint_type": "base", "hex_color": "#00401A", "category": "Green", "is_custom": False},
        {"brand": "Citadel", "name": "Castellan Green", "paint_type": "base", "hex_color": "#264715", "category": "Green", "is_custom": False},
        {"brand": "Citadel", "name": "Celestra Grey", "paint_type": "base", "hex_color": "#90A8A8", "category": "Grey", "is_custom": False},
        {"brand": "Citadel", "name": "Corax White", "paint_type": "base", "hex_color": "#FFFFFF", "category": "White", "is_custom": False},
        {"brand": "Citadel", "name": "Death Guard Green", "paint_type": "base", "hex_color": "#677B4D", "category": "Green", "is_custom": False},
        {"brand": "Citadel", "name": "Dryad Bark", "paint_type": "base", "hex_color": "#33312D", "category": "Brown", "is_custom": False},
        {"brand": "Citadel", "name": "Kantor Blue", "paint_type": "base", "hex_color": "#02134E", "category": "Blue", "is_custom": False},
        {"brand": "Citadel", "name": "Khorne Red", "paint_type": "base", "hex_color": "#6A0001", "category": "Red", "is_custom": False},
        {"brand": "Citadel", "name": "Leadbelcher", "paint_type": "base", "hex_color": "#888D8F", "category": "Metallic", "is_custom": False},
        {"brand": "Citadel", "name": "Macragge Blue", "paint_type": "base", "hex_color": "#0D407F", "category": "Blue", "is_custom": False},
        {"brand": "Citadel", "name": "Mechanicus Standard Grey", "paint_type": "base", "hex_color": "#3D4B4D", "category": "Grey", "is_custom": False},
        {"brand": "Citadel", "name": "Mephiston Red", "paint_type": "base", "hex_color": "#9A1115", "category": "Red", "is_custom": False},
        {"brand": "Citadel", "name": "Mournfang Brown", "paint_type": "base", "hex_color": "#490F06", "category": "Brown", "is_custom": False},
        {"brand": "Citadel", "name": "Naggaroth Night", "paint_type": "base", "hex_color": "#3D3354", "category": "Purple", "is_custom": False},
        {"brand": "Citadel", "name": "Rakarth Flesh", "paint_type": "base", "hex_color": "#A29E91", "category": "Flesh", "is_custom": False},
        {"brand": "Citadel", "name": "Retributor Armour", "paint_type": "base", "hex_color": "#B5803B", "category": "Metallic", "is_custom": False},
        {"brand": "Citadel", "name": "Screamer Pink", "paint_type": "base", "hex_color": "#7C1645", "category": "Pink", "is_custom": False},
        {"brand": "Citadel", "name": "Thousand Sons Blue", "paint_type": "base", "hex_color": "#00506F", "category": "Blue", "is_custom": False},
        {"brand": "Citadel", "name": "Wraithbone", "paint_type": "base", "hex_color": "#DBD1B2", "category": "Bone", "is_custom": False},
        {"brand": "Citadel", "name": "XV-88", "paint_type": "base", "hex_color": "#6C4811", "category": "Brown", "is_custom": False},
        {"brand": "Citadel", "name": "Zandri Dust", "paint_type": "base", "hex_color": "#9E915C", "category": "Brown", "is_custom": False},
        
        # Citadel Layer Paints
        {"brand": "Citadel", "name": "Administratum Grey", "paint_type": "layer", "hex_color": "#949B95", "category": "Grey", "is_custom": False},
        {"brand": "Citadel", "name": "Alaitoc Blue", "paint_type": "layer", "hex_color": "#295788", "category": "Blue", "is_custom": False},
        {"brand": "Citadel", "name": "Auric Armour Gold", "paint_type": "layer", "hex_color": "#C6A246", "category": "Metallic", "is_custom": False},
        {"brand": "Citadel", "name": "Cadian Fleshtone", "paint_type": "layer", "hex_color": "#C77958", "category": "Flesh", "is_custom": False},
        {"brand": "Citadel", "name": "Calgar Blue", "paint_type": "layer", "hex_color": "#4272B8", "category": "Blue", "is_custom": False},
        {"brand": "Citadel", "name": "Evil Sunz Scarlet", "paint_type": "layer", "hex_color": "#C01411", "category": "Red", "is_custom": False},
        {"brand": "Citadel", "name": "Fenrisian Grey", "paint_type": "layer", "hex_color": "#6D94B3", "category": "Blue", "is_custom": False},
        {"brand": "Citadel", "name": "Fire Dragon Bright", "paint_type": "layer", "hex_color": "#F4874E", "category": "Orange", "is_custom": False},
        {"brand": "Citadel", "name": "Flash Gitz Yellow", "paint_type": "layer", "hex_color": "#FFF300", "category": "Yellow", "is_custom": False},
        {"brand": "Citadel", "name": "Kislev Flesh", "paint_type": "layer", "hex_color": "#D1A570", "category": "Flesh", "is_custom": False},
        {"brand": "Citadel", "name": "Liberator Gold", "paint_type": "layer", "hex_color": "#D3A936", "category": "Metallic", "is_custom": False},
        {"brand": "Citadel", "name": "Lothern Blue", "paint_type": "layer", "hex_color": "#34A2CF", "category": "Blue", "is_custom": False},
        {"brand": "Citadel", "name": "Pallid Wych Flesh", "paint_type": "layer", "hex_color": "#CECCBB", "category": "Flesh", "is_custom": False},
        {"brand": "Citadel", "name": "Runefang Steel", "paint_type": "layer", "hex_color": "#C3CACE", "category": "Metallic", "is_custom": False},
        {"brand": "Citadel", "name": "Screaming Skull", "paint_type": "layer", "hex_color": "#B9C099", "category": "Bone", "is_custom": False},
        {"brand": "Citadel", "name": "Stormhost Silver", "paint_type": "layer", "hex_color": "#CECECE", "category": "Metallic", "is_custom": False},
        {"brand": "Citadel", "name": "Ushabti Bone", "paint_type": "layer", "hex_color": "#ABA173", "category": "Bone", "is_custom": False},
        {"brand": "Citadel", "name": "Warpstone Glow", "paint_type": "layer", "hex_color": "#1E7331", "category": "Green", "is_custom": False},
        {"brand": "Citadel", "name": "White Scar", "paint_type": "layer", "hex_color": "#FFFFFF", "category": "White", "is_custom": False},
        {"brand": "Citadel", "name": "Wild Rider Red", "paint_type": "layer", "hex_color": "#EA3335", "category": "Red", "is_custom": False},
        {"brand": "Citadel", "name": "Yriel Yellow", "paint_type": "layer", "hex_color": "#FFD900", "category": "Yellow", "is_custom": False},
        
        # Citadel Shade Paints
        {"brand": "Citadel", "name": "Agrax Earthshade", "paint_type": "shade", "hex_color": "#5A3D28", "category": "Brown", "is_custom": False},
        {"brand": "Citadel", "name": "Biel-Tan Green", "paint_type": "shade", "hex_color": "#1A2E13", "category": "Green", "is_custom": False},
        {"brand": "Citadel", "name": "Carroburg Crimson", "paint_type": "shade", "hex_color": "#510E15", "category": "Red", "is_custom": False},
        {"brand": "Citadel", "name": "Drakenhof Nightshade", "paint_type": "shade", "hex_color": "#12243E", "category": "Blue", "is_custom": False},
        {"brand": "Citadel", "name": "Druchii Violet", "paint_type": "shade", "hex_color": "#2C1A35", "category": "Purple", "is_custom": False},
        {"brand": "Citadel", "name": "Fuegan Orange", "paint_type": "shade", "hex_color": "#984614", "category": "Orange", "is_custom": False},
        {"brand": "Citadel", "name": "Nuln Oil", "paint_type": "shade", "hex_color": "#14100E", "category": "Black", "is_custom": False},
        {"brand": "Citadel", "name": "Reikland Fleshshade", "paint_type": "shade", "hex_color": "#5A2E28", "category": "Flesh", "is_custom": False},
        {"brand": "Citadel", "name": "Seraphim Sepia", "paint_type": "shade", "hex_color": "#C28B5A", "category": "Brown", "is_custom": False},
        
        # Citadel Contrast Paints
        {"brand": "Citadel", "name": "Apothecary White", "paint_type": "contrast", "hex_color": "#E5E5E5", "category": "White", "is_custom": False},
        {"brand": "Citadel", "name": "Black Templar", "paint_type": "contrast", "hex_color": "#1A1A1A", "category": "Black", "is_custom": False},
        {"brand": "Citadel", "name": "Blood Angels Red", "paint_type": "contrast", "hex_color": "#C01411", "category": "Red", "is_custom": False},
        {"brand": "Citadel", "name": "Cygor Brown", "paint_type": "contrast", "hex_color": "#5A3D28", "category": "Brown", "is_custom": False},
        {"brand": "Citadel", "name": "Dark Angels Green", "paint_type": "contrast", "hex_color": "#00401A", "category": "Green", "is_custom": False},
        {"brand": "Citadel", "name": "Flesh Tearers Red", "paint_type": "contrast", "hex_color": "#9A1115", "category": "Red", "is_custom": False},
        {"brand": "Citadel", "name": "Gryph-Charger Grey", "paint_type": "contrast", "hex_color": "#6D94B3", "category": "Grey", "is_custom": False},
        {"brand": "Citadel", "name": "Guilliman Flesh", "paint_type": "contrast", "hex_color": "#D1A570", "category": "Flesh", "is_custom": False},
        {"brand": "Citadel", "name": "Iyanden Yellow", "paint_type": "contrast", "hex_color": "#FDB825", "category": "Yellow", "is_custom": False},
        {"brand": "Citadel", "name": "Leviadon Blue", "paint_type": "contrast", "hex_color": "#0D407F", "category": "Blue", "is_custom": False},
        {"brand": "Citadel", "name": "Nazdreg Yellow", "paint_type": "contrast", "hex_color": "#FFD900", "category": "Yellow", "is_custom": False},
        {"brand": "Citadel", "name": "Plaguebearer Flesh", "paint_type": "contrast", "hex_color": "#677B4D", "category": "Green", "is_custom": False},
        {"brand": "Citadel", "name": "Shyish Purple", "paint_type": "contrast", "hex_color": "#3D3354", "category": "Purple", "is_custom": False},
        {"brand": "Citadel", "name": "Skeleton Horde", "paint_type": "contrast", "hex_color": "#DBD1B2", "category": "Bone", "is_custom": False},
        {"brand": "Citadel", "name": "Snakebite Leather", "paint_type": "contrast", "hex_color": "#6C4811", "category": "Brown", "is_custom": False},
        {"brand": "Citadel", "name": "Talassar Blue", "paint_type": "contrast", "hex_color": "#34A2CF", "category": "Blue", "is_custom": False},
        {"brand": "Citadel", "name": "Ultramarines Blue", "paint_type": "contrast", "hex_color": "#295788", "category": "Blue", "is_custom": False},
        {"brand": "Citadel", "name": "Volupus Pink", "paint_type": "contrast", "hex_color": "#7C1645", "category": "Pink", "is_custom": False},
        {"brand": "Citadel", "name": "Warp Lightning", "paint_type": "contrast", "hex_color": "#1E7331", "category": "Green", "is_custom": False},
        {"brand": "Citadel", "name": "Wyldwood", "paint_type": "contrast", "hex_color": "#33312D", "category": "Brown", "is_custom": False},
        
        # Vallejo Model Color
        {"brand": "Vallejo", "name": "White", "paint_type": "base", "hex_color": "#FFFFFF", "category": "White", "is_custom": False},
        {"brand": "Vallejo", "name": "Black", "paint_type": "base", "hex_color": "#000000", "category": "Black", "is_custom": False},
        {"brand": "Vallejo", "name": "German Grey", "paint_type": "base", "hex_color": "#3D3C3B", "category": "Grey", "is_custom": False},
        {"brand": "Vallejo", "name": "Dark Prussian Blue", "paint_type": "base", "hex_color": "#1E2F3C", "category": "Blue", "is_custom": False},
        {"brand": "Vallejo", "name": "Flat Red", "paint_type": "base", "hex_color": "#7D110C", "category": "Red", "is_custom": False},
        {"brand": "Vallejo", "name": "Flat Green", "paint_type": "base", "hex_color": "#2C4F31", "category": "Green", "is_custom": False},
        {"brand": "Vallejo", "name": "Dark Yellow", "paint_type": "base", "hex_color": "#A98823", "category": "Yellow", "is_custom": False},
        {"brand": "Vallejo", "name": "Flat Brown", "paint_type": "base", "hex_color": "#583F31", "category": "Brown", "is_custom": False},
        {"brand": "Vallejo", "name": "Flat Flesh", "paint_type": "base", "hex_color": "#E8B796", "category": "Flesh", "is_custom": False},
        {"brand": "Vallejo", "name": "Burnt Umber", "paint_type": "base", "hex_color": "#4C2F1C", "category": "Brown", "is_custom": False},
        {"brand": "Vallejo", "name": "Cavalry Brown", "paint_type": "base", "hex_color": "#5E3A21", "category": "Brown", "is_custom": False},
        {"brand": "Vallejo", "name": "Gold", "paint_type": "metallic", "hex_color": "#B5803B", "category": "Metallic", "is_custom": False},
        {"brand": "Vallejo", "name": "Silver", "paint_type": "metallic", "hex_color": "#C3CACE", "category": "Metallic", "is_custom": False},
        {"brand": "Vallejo", "name": "Gunmetal", "paint_type": "metallic", "hex_color": "#4A4D4E", "category": "Metallic", "is_custom": False},
        {"brand": "Vallejo", "name": "Bronze", "paint_type": "metallic", "hex_color": "#8C6239", "category": "Metallic", "is_custom": False},
        {"brand": "Vallejo", "name": "Copper", "paint_type": "metallic", "hex_color": "#A66A3D", "category": "Metallic", "is_custom": False},
        
        # Vallejo Game Color
        {"brand": "Vallejo Game Color", "name": "Dead White", "paint_type": "base", "hex_color": "#FFFFFF", "category": "White", "is_custom": False},
        {"brand": "Vallejo Game Color", "name": "Black", "paint_type": "base", "hex_color": "#000000", "category": "Black", "is_custom": False},
        {"brand": "Vallejo Game Color", "name": "Bloody Red", "paint_type": "base", "hex_color": "#B21718", "category": "Red", "is_custom": False},
        {"brand": "Vallejo Game Color", "name": "Goblin Green", "paint_type": "base", "hex_color": "#3F6E25", "category": "Green", "is_custom": False},
        {"brand": "Vallejo Game Color", "name": "Magic Blue", "paint_type": "base", "hex_color": "#1A4B7C", "category": "Blue", "is_custom": False},
        {"brand": "Vallejo Game Color", "name": "Plague Brown", "paint_type": "base", "hex_color": "#8B7D3A", "category": "Brown", "is_custom": False},
        {"brand": "Vallejo Game Color", "name": "Elf Skintone", "paint_type": "base", "hex_color": "#E9C5A4", "category": "Flesh", "is_custom": False},
        {"brand": "Vallejo Game Color", "name": "Warlord Purple", "paint_type": "base", "hex_color": "#4C2958", "category": "Purple", "is_custom": False},
        {"brand": "Vallejo Game Color", "name": "Hot Orange", "paint_type": "base", "hex_color": "#E55137", "category": "Orange", "is_custom": False},
        {"brand": "Vallejo Game Color", "name": "Sunblast Yellow", "paint_type": "base", "hex_color": "#F9E600", "category": "Yellow", "is_custom": False},
        
        # Army Painter Warpaints
        {"brand": "Army Painter", "name": "Matt White", "paint_type": "base", "hex_color": "#FFFFFF", "category": "White", "is_custom": False},
        {"brand": "Army Painter", "name": "Matt Black", "paint_type": "base", "hex_color": "#000000", "category": "Black", "is_custom": False},
        {"brand": "Army Painter", "name": "Pure Red", "paint_type": "base", "hex_color": "#BE0F00", "category": "Red", "is_custom": False},
        {"brand": "Army Painter", "name": "Greenskin", "paint_type": "base", "hex_color": "#5B8035", "category": "Green", "is_custom": False},
        {"brand": "Army Painter", "name": "Crystal Blue", "paint_type": "base", "hex_color": "#2F6B9A", "category": "Blue", "is_custom": False},
        {"brand": "Army Painter", "name": "Leather Brown", "paint_type": "base", "hex_color": "#5E3A21", "category": "Brown", "is_custom": False},
        {"brand": "Army Painter", "name": "Skeleton Bone", "paint_type": "base", "hex_color": "#D4C4A8", "category": "Bone", "is_custom": False},
        {"brand": "Army Painter", "name": "Barbarian Flesh", "paint_type": "base", "hex_color": "#CB9A71", "category": "Flesh", "is_custom": False},
        {"brand": "Army Painter", "name": "Alien Purple", "paint_type": "base", "hex_color": "#5C2D79", "category": "Purple", "is_custom": False},
        {"brand": "Army Painter", "name": "Daemonic Yellow", "paint_type": "base", "hex_color": "#FFDA00", "category": "Yellow", "is_custom": False},
        {"brand": "Army Painter", "name": "Lava Orange", "paint_type": "base", "hex_color": "#E55137", "category": "Orange", "is_custom": False},
        {"brand": "Army Painter", "name": "Gun Metal", "paint_type": "metallic", "hex_color": "#4A4D4E", "category": "Metallic", "is_custom": False},
        {"brand": "Army Painter", "name": "Shining Silver", "paint_type": "metallic", "hex_color": "#C3CACE", "category": "Metallic", "is_custom": False},
        {"brand": "Army Painter", "name": "Greedy Gold", "paint_type": "metallic", "hex_color": "#B5803B", "category": "Metallic", "is_custom": False},
        {"brand": "Army Painter", "name": "Weapon Bronze", "paint_type": "metallic", "hex_color": "#8C6239", "category": "Metallic", "is_custom": False},
        
        # Army Painter Speedpaints
        {"brand": "Army Painter", "name": "Speedpaint Grim Black", "paint_type": "speedpaint", "hex_color": "#1A1A1A", "category": "Black", "is_custom": False},
        {"brand": "Army Painter", "name": "Speedpaint Absolution Green", "paint_type": "speedpaint", "hex_color": "#00401A", "category": "Green", "is_custom": False},
        {"brand": "Army Painter", "name": "Speedpaint Blood Red", "paint_type": "speedpaint", "hex_color": "#9A1115", "category": "Red", "is_custom": False},
        {"brand": "Army Painter", "name": "Speedpaint Highlord Blue", "paint_type": "speedpaint", "hex_color": "#0D407F", "category": "Blue", "is_custom": False},
        {"brand": "Army Painter", "name": "Speedpaint Zealot Yellow", "paint_type": "speedpaint", "hex_color": "#FDB825", "category": "Yellow", "is_custom": False},
        {"brand": "Army Painter", "name": "Speedpaint Pallid Bone", "paint_type": "speedpaint", "hex_color": "#DBD1B2", "category": "Bone", "is_custom": False},
        {"brand": "Army Painter", "name": "Speedpaint Crusader Skin", "paint_type": "speedpaint", "hex_color": "#D1A570", "category": "Flesh", "is_custom": False},
        {"brand": "Army Painter", "name": "Speedpaint Runic Purple", "paint_type": "speedpaint", "hex_color": "#3D3354", "category": "Purple", "is_custom": False},
        {"brand": "Army Painter", "name": "Speedpaint Orc Skin", "paint_type": "speedpaint", "hex_color": "#677B4D", "category": "Green", "is_custom": False},
        {"brand": "Army Painter", "name": "Speedpaint Hive Dweller", "paint_type": "speedpaint", "hex_color": "#5A3D28", "category": "Brown", "is_custom": False},
        
        # Scale75 Fantasy & Games
        {"brand": "Scale75", "name": "White", "paint_type": "base", "hex_color": "#FFFFFF", "category": "White", "is_custom": False},
        {"brand": "Scale75", "name": "Black", "paint_type": "base", "hex_color": "#000000", "category": "Black", "is_custom": False},
        {"brand": "Scale75", "name": "Antares Red", "paint_type": "base", "hex_color": "#891C11", "category": "Red", "is_custom": False},
        {"brand": "Scale75", "name": "Innsmouth Blue", "paint_type": "base", "hex_color": "#1B4F72", "category": "Blue", "is_custom": False},
        {"brand": "Scale75", "name": "Sherwood Green", "paint_type": "base", "hex_color": "#2D5016", "category": "Green", "is_custom": False},
        {"brand": "Scale75", "name": "Mojave Yellow", "paint_type": "base", "hex_color": "#D4A017", "category": "Yellow", "is_custom": False},
        {"brand": "Scale75", "name": "Irati Green", "paint_type": "base", "hex_color": "#4A7023", "category": "Green", "is_custom": False},
        {"brand": "Scale75", "name": "Elven Gold", "paint_type": "metallic", "hex_color": "#C9A227", "category": "Metallic", "is_custom": False},
        {"brand": "Scale75", "name": "Thrash Metal", "paint_type": "metallic", "hex_color": "#7B7D7D", "category": "Metallic", "is_custom": False},
        {"brand": "Scale75", "name": "Decayed Metal", "paint_type": "metallic", "hex_color": "#5D6D7E", "category": "Metallic", "is_custom": False},
    ]
    
    await db.paints.insert_many(paints_to_seed)
    return {"message": f"Seeded {len(paints_to_seed)} paints", "seeded": True}

# ============== Stats Endpoint ==============

@api_router.get("/stats")
async def get_user_stats(current_user: dict = Depends(get_current_user)):
    user_id = str(current_user["_id"])
    
    owned_count = await db.user_paints.count_documents({"user_id": user_id, "status": "owned"})
    wishlist_count = await db.user_paints.count_documents({"user_id": user_id, "status": "wishlist"})
    projects_count = await db.projects.count_documents({"user_id": user_id, "status": "active"})
    
    return {
        "owned_paints": owned_count,
        "wishlist_paints": wishlist_count,
        "active_projects": projects_count
    }

# ============== Health Check ==============

@api_router.get("/")
async def root():
    return {"message": "Brush Vault API - Paint Tracking for Miniature Painters"}

@api_router.get("/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.utcnow()}

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
