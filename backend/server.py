from fastapi import FastAPI, APIRouter, UploadFile, File, HTTPException, Form
from fastapi.responses import JSONResponse, StreamingResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone
import pandas as pd
import json
import aiofiles
import io
from emergentintegrations.llm.chat import LlmChat, UserMessage, FileContentWithMimeType

# PDF Generation imports
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter, A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image, PageBreak
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_JUSTIFY
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Upload directory
UPLOAD_DIR = ROOT_DIR / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Models
class SessionCreate(BaseModel):
    session_id: Optional[str] = None

class SessionResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    session_id: str
    files_uploaded: int
    created_at: str
    analyses: List[Dict[str, Any]] = []

class ChatMessage(BaseModel):
    session_id: str
    message: str

class AnalyzeRequest(BaseModel):
    session_id: str
    instructions: Optional[str] = None

class AnalysisResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    analysis_id: str
    session_id: str
    summary: str
    key_metrics: List[Dict[str, Any]]
    visualizations: List[Dict[str, Any]]
    problems: List[str]
    recommendations: List[str]
    executive_report: str
    created_at: str

# Helper functions
def get_file_preview(df: pd.DataFrame, max_rows: int = 50) -> str:
    """Get a preview of the dataframe as string for LLM analysis"""
    preview = df.head(max_rows).to_csv(index=False)
    stats = df.describe(include='all').to_string()
    info = f"Columns: {list(df.columns)}\nShape: {df.shape}\nData Types:\n{df.dtypes.to_string()}"
    return f"{info}\n\nStatistics:\n{stats}\n\nData Preview:\n{preview}"

async def analyze_with_llm(file_paths: List[str], instructions: Optional[str] = None) -> Dict:
    """Analyze files using Gemini LLM with file attachments"""
    api_key = os.environ.get('EMERGENT_LLM_KEY')
    if not api_key:
        raise HTTPException(status_code=500, detail="LLM API key not configured")
    
    # Read and combine all data
    all_data = []
    for fp in file_paths:
        try:
            if fp.endswith('.csv'):
                df = pd.read_csv(fp)
            elif fp.endswith(('.xlsx', '.xls')):
                df = pd.read_excel(fp)
            else:
                continue
            all_data.append({
                'filename': Path(fp).name,
                'preview': get_file_preview(df),
                'columns': list(df.columns),
                'shape': df.shape,
                'df': df
            })
        except Exception as e:
            logger.error(f"Error reading file {fp}: {e}")
            continue
    
    if not all_data:
        raise HTTPException(status_code=400, detail="No valid data files found")
    
    # Prepare data context
    data_context = "\n\n".join([
        f"=== FILE: {d['filename']} ===\n{d['preview']}" for d in all_data
    ])
    
    # Build analysis prompt
    base_instructions = instructions or "Perform a comprehensive data analysis"
    
    analysis_prompt = f"""You are rravin, an expert AI data analyst and business intelligence consultant. Analyze the following dataset(s) and provide a comprehensive Tableau-style dashboard report.

{base_instructions}

DATA:
{data_context}

Respond with a JSON object containing these exact keys:
{{
    "summary": "A clear 3-4 paragraph executive summary covering: 1) What the data represents, 2) Key findings and patterns, 3) Business implications, 4) Overall data quality assessment",
    "key_metrics": [
        {{
            "name": "Metric Name",
            "value": "Formatted Value (e.g., $1.2M, 85%, 1,234)",
            "change": "+/-X% or +/-Value",
            "trend": "up/down/stable",
            "interpretation": "What this metric means in business context and why it matters. Include comparison to benchmarks if applicable.",
            "category": "financial/operational/performance/quality"
        }}
    ],
    "visualizations": [
        {{
            "type": "bar/line/pie/area/composed",
            "title": "Descriptive Chart Title",
            "data": [{{"name": "Label", "value": 100}}],
            "xKey": "name",
            "yKey": "value",
            "description": "Insight this chart reveals about the data"
        }}
    ],
    "problems": ["Specific issue with data-driven evidence and potential impact"],
    "recommendations": ["Prioritized actionable recommendation with expected outcome"],
    "executive_report": "A detailed 5-7 paragraph executive report covering: Introduction, Data Overview, Key Findings, Trend Analysis, Risk Assessment, Strategic Recommendations, and Conclusion. Write in a professional tone suitable for C-level executives.",
    "statistical_summary": {{
        "total_records": "N",
        "date_range": "Start - End or N/A",
        "data_completeness": "X%",
        "key_correlations": "Brief description"
    }}
}}

CRITICAL REQUIREMENTS:
1. Generate 8-12 comprehensive metrics covering different aspects:
   - Financial metrics (revenue, costs, margins, growth rates)
   - Operational metrics (volumes, counts, averages)
   - Performance metrics (conversion rates, efficiency ratios)
   - Quality metrics (error rates, completion rates)
   - Statistical metrics (mean, median, std deviation for key columns)
   
2. Each metric MUST include an "interpretation" field explaining:
   - What the number means in plain English
   - Whether it's good/bad/neutral
   - What actions it might suggest
   
3. Generate 5-6 diverse visualizations:
   - At least one bar chart for comparisons
   - At least one line chart for trends
   - At least one pie chart for distributions
   - At least one area chart for cumulative data
   - Include actual data points derived from the dataset
   
4. Problems should be specific with evidence (e.g., "Revenue dropped 15% in Q3" not just "Revenue issues")
   
5. Recommendations should be actionable with expected outcomes (e.g., "Implement automated follow-ups to increase conversion by estimated 10-15%")

6. All numeric values in visualizations must be realistic based on the actual data provided."""

    try:
        chat = LlmChat(
            api_key=api_key,
            session_id=f"analysis-{uuid.uuid4()}",
            system_message="You are rravin, an expert AI data analyst. Always respond with valid JSON only, no markdown formatting."
        ).with_model("gemini", "gemini-2.5-flash")
        
        response = await chat.send_message(UserMessage(text=analysis_prompt))
        
        # Parse JSON response
        response_text = response.strip()
        if response_text.startswith('```'):
            response_text = response_text.split('```')[1]
            if response_text.startswith('json'):
                response_text = response_text[4:]
        response_text = response_text.strip()
        
        result = json.loads(response_text)
        return result
        
    except json.JSONDecodeError as e:
        logger.error(f"JSON parse error: {e}, response: {response[:500]}")
        # Return a fallback structure
        return {
            "summary": "Analysis completed but response parsing failed. Please try again.",
            "key_metrics": [],
            "visualizations": [],
            "problems": ["Unable to parse analysis results"],
            "recommendations": ["Please retry the analysis"],
            "executive_report": "Analysis pending - please retry."
        }
    except Exception as e:
        logger.error(f"LLM analysis error: {e}")
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")

async def chat_with_llm(session_id: str, message: str, context: str) -> str:
    """Chat with LLM about the analyzed data"""
    api_key = os.environ.get('EMERGENT_LLM_KEY')
    if not api_key:
        raise HTTPException(status_code=500, detail="LLM API key not configured")
    
    try:
        chat = LlmChat(
            api_key=api_key,
            session_id=f"chat-{session_id}",
            system_message=f"""You are rravin, an expert AI data analyst assistant. You have analyzed the user's data and are here to answer follow-up questions.

Previous Analysis Context:
{context}

Be helpful, specific, and provide data-driven answers. If the user asks for something not possible with the available data, explain why and suggest alternatives."""
        ).with_model("gemini", "gemini-2.5-flash")
        
        response = await chat.send_message(UserMessage(text=message))
        return response
        
    except Exception as e:
        logger.error(f"Chat error: {e}")
        raise HTTPException(status_code=500, detail=f"Chat failed: {str(e)}")

# Routes
@api_router.get("/")
async def root():
    return {"message": "rravin API - AI Data Analysis Agent"}

@api_router.post("/sessions", response_model=SessionResponse)
async def create_or_get_session(session_data: SessionCreate):
    """Create a new session or get existing one"""
    session_id = session_data.session_id or str(uuid.uuid4())
    
    existing = await db.sessions.find_one({"session_id": session_id}, {"_id": 0})
    if existing:
        return SessionResponse(**existing)
    
    new_session = {
        "session_id": session_id,
        "files_uploaded": 0,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "files": [],
        "analyses": [],
        "chat_history": []
    }
    await db.sessions.insert_one(new_session)
    return SessionResponse(**{k: v for k, v in new_session.items() if k != '_id'})

@api_router.get("/sessions/{session_id}", response_model=SessionResponse)
async def get_session(session_id: str):
    """Get session details"""
    session = await db.sessions.find_one({"session_id": session_id}, {"_id": 0})
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return SessionResponse(**session)

@api_router.post("/upload")
async def upload_files(
    session_id: str = Form(...),
    files: List[UploadFile] = File(...)
):
    """Upload data files (CSV or Excel) - No limit on number of files"""
    session = await db.sessions.find_one({"session_id": session_id})
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    current_count = session.get("files_uploaded", 0)
    
    uploaded_files = []
    for file in files:
        # Validate file type
        if not file.filename.endswith(('.csv', '.xlsx', '.xls')):
            raise HTTPException(
                status_code=400, 
                detail=f"Invalid file type: {file.filename}. Only CSV and Excel files are supported."
            )
        
        # Save file
        file_id = str(uuid.uuid4())
        file_ext = Path(file.filename).suffix
        file_path = UPLOAD_DIR / f"{file_id}{file_ext}"
        
        async with aiofiles.open(file_path, 'wb') as f:
            content = await file.read()
            await f.write(content)
        
        # Get file info
        try:
            if file_ext == '.csv':
                df = pd.read_csv(file_path)
            else:
                df = pd.read_excel(file_path)
            
            file_info = {
                "file_id": file_id,
                "original_name": file.filename,
                "path": str(file_path),
                "rows": len(df),
                "columns": len(df.columns),
                "column_names": list(df.columns),
                "uploaded_at": datetime.now(timezone.utc).isoformat()
            }
            uploaded_files.append(file_info)
        except Exception as e:
            # Clean up on error
            file_path.unlink(missing_ok=True)
            raise HTTPException(status_code=400, detail=f"Error reading file {file.filename}: {str(e)}")
    
    # Update session
    await db.sessions.update_one(
        {"session_id": session_id},
        {
            "$push": {"files": {"$each": uploaded_files}},
            "$inc": {"files_uploaded": len(uploaded_files)}
        }
    )
    
    return {
        "message": f"Successfully uploaded {len(uploaded_files)} file(s)",
        "files": uploaded_files,
        "total_files": current_count + len(uploaded_files)
    }

@api_router.post("/analyze", response_model=AnalysisResponse)
async def analyze_data(request: AnalyzeRequest):
    """Analyze uploaded data files"""
    session = await db.sessions.find_one({"session_id": request.session_id})
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    files = session.get("files", [])
    if not files:
        raise HTTPException(status_code=400, detail="No files uploaded. Please upload data files first.")
    
    # Get file paths
    file_paths = [f["path"] for f in files if Path(f["path"]).exists()]
    if not file_paths:
        raise HTTPException(status_code=400, detail="No valid files found")
    
    # Run analysis
    analysis_result = await analyze_with_llm(file_paths, request.instructions)
    
    # Create analysis record
    analysis_id = str(uuid.uuid4())
    analysis_doc = {
        "analysis_id": analysis_id,
        "session_id": request.session_id,
        "instructions": request.instructions,
        "created_at": datetime.now(timezone.utc).isoformat(),
        **analysis_result
    }
    
    # Store in database
    await db.analyses.insert_one(analysis_doc)
    await db.sessions.update_one(
        {"session_id": request.session_id},
        {"$push": {"analyses": {"analysis_id": analysis_id, "created_at": analysis_doc["created_at"]}}}
    )
    
    return AnalysisResponse(**{k: v for k, v in analysis_doc.items() if k != '_id'})

@api_router.get("/analyses/{analysis_id}")
async def get_analysis(analysis_id: str):
    """Get a specific analysis result"""
    analysis = await db.analyses.find_one({"analysis_id": analysis_id}, {"_id": 0})
    if not analysis:
        raise HTTPException(status_code=404, detail="Analysis not found")
    return analysis

@api_router.post("/chat")
async def chat_about_data(request: ChatMessage):
    """Chat with the AI about your data"""
    session = await db.sessions.find_one({"session_id": request.session_id})
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    # Get latest analysis for context
    analyses = session.get("analyses", [])
    context = ""
    if analyses:
        latest_analysis_id = analyses[-1]["analysis_id"]
        analysis = await db.analyses.find_one({"analysis_id": latest_analysis_id}, {"_id": 0})
        if analysis:
            context = f"""
Summary: {analysis.get('summary', '')}
Key Metrics: {json.dumps(analysis.get('key_metrics', []))}
Problems: {analysis.get('problems', [])}
Recommendations: {analysis.get('recommendations', [])}
"""
    
    # Get response from LLM
    response = await chat_with_llm(request.session_id, request.message, context)
    
    # Store chat in history
    chat_entry = {
        "user_message": request.message,
        "ai_response": response,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
    await db.sessions.update_one(
        {"session_id": request.session_id},
        {"$push": {"chat_history": chat_entry}}
    )
    
    return {"response": response, "timestamp": chat_entry["timestamp"]}

@api_router.get("/chat/{session_id}/history")
async def get_chat_history(session_id: str):
    """Get chat history for a session"""
    session = await db.sessions.find_one({"session_id": session_id}, {"_id": 0})
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return {"history": session.get("chat_history", [])}

@api_router.delete("/sessions/{session_id}")
async def delete_session(session_id: str):
    """Delete a session and its files"""
    session = await db.sessions.find_one({"session_id": session_id})
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    # Delete files
    for f in session.get("files", []):
        Path(f["path"]).unlink(missing_ok=True)
    
    # Delete from database
    await db.sessions.delete_one({"session_id": session_id})
    await db.analyses.delete_many({"session_id": session_id})
    
    return {"message": "Session deleted successfully"}

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
