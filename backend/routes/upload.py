from fastapi import APIRouter, File, UploadFile, HTTPException
import os
import uuid
import shutil
from typing import List

router = APIRouter(tags=["Uploads"])

UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

@router.post("/upload")
async def upload_files(files: List[UploadFile] = File(...)):
    """
    Upload one or more files and return their accessible URLs.
    """
    uploaded_urls = []
    
    for file in files:
        # Validate extension
        ext = file.filename.split('.')[-1].lower()
        if ext not in ['jpg', 'jpeg', 'png', 'webp', 'gif']:
            raise HTTPException(status_code=400, detail=f"Unsupported file type: {ext}")
            
        # Generate unique filename
        filename = f"{uuid.uuid4().hex}.{ext}"
        filepath = os.path.join(UPLOAD_DIR, filename)
        
        # Save file
        with open(filepath, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
            
        # Add to returning list
        # Assuming server serves the uploads directory at /uploads
        uploaded_urls.append(f"/uploads/{filename}")
        
    return {"urls": uploaded_urls}
