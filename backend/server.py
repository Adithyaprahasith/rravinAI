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
def clean_dataframe(df: pd.DataFrame, filename: str) -> tuple[pd.DataFrame, Dict[str, Any]]:
    """Clean dataframe by removing errors, nulls, duplicates, etc."""
    cleaning_report = {
        "filename": filename,
        "original_rows": len(df),
        "original_columns": len(df.columns),
        "issues_found": [],
        "actions_taken": []
    }
    
    # 1. Remove completely empty rows
    empty_rows = df.isna().all(axis=1).sum()
    if empty_rows > 0:
        df = df.dropna(how='all')
        cleaning_report["issues_found"].append(f"{empty_rows} completely empty rows")
        cleaning_report["actions_taken"].append(f"Removed {empty_rows} empty rows")
    
    # 2. Remove completely empty columns
    empty_cols = df.isna().all(axis=0).sum()
    if empty_cols > 0:
        empty_col_names = df.columns[df.isna().all()].tolist()
        df = df.dropna(axis=1, how='all')
        cleaning_report["issues_found"].append(f"{empty_cols} empty columns: {empty_col_names}")
        cleaning_report["actions_taken"].append(f"Removed {empty_cols} empty columns")
    
    # 3. Handle null values - fill or remove based on column type
    null_counts = df.isnull().sum()
    cols_with_nulls = null_counts[null_counts > 0]
    
    if len(cols_with_nulls) > 0:
        for col in cols_with_nulls.index:
            null_count = cols_with_nulls[col]
            null_pct = (null_count / len(df)) * 100
            
            if null_pct > 50:
                # If more than 50% null, drop the column
                df = df.drop(columns=[col])
                cleaning_report["issues_found"].append(f"Column '{col}' had {null_pct:.1f}% null values")
                cleaning_report["actions_taken"].append(f"Removed column '{col}' (>{50}% nulls)")
            elif pd.api.types.is_numeric_dtype(df[col]):
                # For numeric columns, fill with median
                median_val = df[col].median()
                df[col] = df[col].fillna(median_val)
                cleaning_report["issues_found"].append(f"Column '{col}' had {null_count} null values")
                cleaning_report["actions_taken"].append(f"Filled '{col}' nulls with median ({median_val:.2f})")
            else:
                # For non-numeric, fill with mode or 'Unknown'
                mode_val = df[col].mode()
                fill_val = mode_val[0] if len(mode_val) > 0 else 'Unknown'
                df[col] = df[col].fillna(fill_val)
                cleaning_report["issues_found"].append(f"Column '{col}' had {null_count} null values")
                cleaning_report["actions_taken"].append(f"Filled '{col}' nulls with '{fill_val}'")
    
    # 4. Remove duplicate rows
    duplicates = df.duplicated().sum()
    if duplicates > 0:
        df = df.drop_duplicates()
        cleaning_report["issues_found"].append(f"{duplicates} duplicate rows")
        cleaning_report["actions_taken"].append(f"Removed {duplicates} duplicate rows")
    
    # 5. Strip whitespace from string columns
    string_cols = df.select_dtypes(include=['object']).columns
    for col in string_cols:
        df[col] = df[col].astype(str).str.strip()
        # Replace empty strings with NaN then forward fill or drop
        df[col] = df[col].replace(['', 'nan', 'None', 'NaN', 'null'], pd.NA)
    
    # 6. Remove rows with remaining nulls (if any)
    remaining_nulls = df.isnull().sum().sum()
    if remaining_nulls > 0:
        rows_before = len(df)
        df = df.dropna()
        rows_removed = rows_before - len(df)
        if rows_removed > 0:
            cleaning_report["issues_found"].append(f"{rows_removed} rows with remaining nulls")
            cleaning_report["actions_taken"].append(f"Removed {rows_removed} rows with remaining nulls")
    
    # 7. Standardize column names (remove special chars, lowercase)
    original_cols = df.columns.tolist()
    df.columns = df.columns.str.strip().str.replace(r'[^\w\s]', '', regex=True).str.replace(' ', '_')
    
    cleaning_report["final_rows"] = len(df)
    cleaning_report["final_columns"] = len(df.columns)
    cleaning_report["rows_removed"] = cleaning_report["original_rows"] - cleaning_report["final_rows"]
    cleaning_report["data_quality_score"] = round((cleaning_report["final_rows"] / max(cleaning_report["original_rows"], 1)) * 100, 1)
    
    if not cleaning_report["issues_found"]:
        cleaning_report["issues_found"].append("No data quality issues found")
        cleaning_report["actions_taken"].append("Data was already clean")
    
    return df, cleaning_report


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


def generate_chart_image(viz_data: Dict, index: int) -> io.BytesIO:
    """Generate a chart image from visualization data"""
    plt.figure(figsize=(8, 5))
    
    chart_type = viz_data.get("type", "bar").lower()
    data = viz_data.get("data", [])
    title = viz_data.get("title", f"Chart {index + 1}")
    x_key = viz_data.get("xKey", "name")
    y_key = viz_data.get("yKey", "value")
    
    if not data:
        plt.text(0.5, 0.5, "No data available", ha='center', va='center', fontsize=14)
        plt.axis('off')
    else:
        labels = [str(d.get(x_key, "")) for d in data]
        values = [float(d.get(y_key, 0)) for d in data]
        
        colors_list = ['#2563eb', '#16a34a', '#7c3aed', '#ea580c', '#db2777', '#0891b2', '#ca8a04', '#dc2626']
        
        if chart_type == "pie":
            plt.pie(values, labels=labels, autopct='%1.1f%%', colors=colors_list[:len(values)])
        elif chart_type == "line":
            plt.plot(labels, values, marker='o', linewidth=2, markersize=8, color='#2563eb')
            plt.fill_between(range(len(labels)), values, alpha=0.2, color='#2563eb')
            plt.xticks(rotation=45, ha='right')
            plt.grid(axis='y', alpha=0.3)
        elif chart_type == "area":
            plt.fill_between(range(len(labels)), values, alpha=0.4, color='#2563eb')
            plt.plot(range(len(labels)), values, linewidth=2, color='#2563eb')
            plt.xticks(range(len(labels)), labels, rotation=45, ha='right')
            plt.grid(axis='y', alpha=0.3)
        else:  # bar chart (default)
            plt.bar(labels, values, color=colors_list[:len(values)])
            plt.xticks(rotation=45, ha='right')
            plt.grid(axis='y', alpha=0.3)
    
    plt.title(title, fontsize=14, fontweight='bold', pad=15)
    plt.tight_layout()
    
    img_buffer = io.BytesIO()
    plt.savefig(img_buffer, format='png', dpi=150, bbox_inches='tight', facecolor='white')
    plt.close()
    img_buffer.seek(0)
    
    return img_buffer


@api_router.get("/analyses/{analysis_id}/pdf")
async def generate_pdf_report(analysis_id: str):
    """Generate a PDF report with summary, metrics, charts, and recommendations"""
    analysis = await db.analyses.find_one({"analysis_id": analysis_id}, {"_id": 0})
    if not analysis:
        raise HTTPException(status_code=404, detail="Analysis not found")
    
    # Create PDF buffer
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=50,
        leftMargin=50,
        topMargin=50,
        bottomMargin=50
    )
    
    # Styles
    styles = getSampleStyleSheet()
    
    title_style = ParagraphStyle(
        'CustomTitle',
        parent=styles['Heading1'],
        fontSize=24,
        spaceAfter=30,
        textColor=colors.HexColor('#0f172a'),
        alignment=TA_CENTER
    )
    
    heading_style = ParagraphStyle(
        'CustomHeading',
        parent=styles['Heading2'],
        fontSize=16,
        spaceBefore=20,
        spaceAfter=10,
        textColor=colors.HexColor('#1e40af'),
        borderPadding=5
    )
    
    body_style = ParagraphStyle(
        'CustomBody',
        parent=styles['Normal'],
        fontSize=10,
        spaceAfter=10,
        alignment=TA_JUSTIFY,
        leading=14
    )
    
    # Build content
    content = []
    
    # Title
    content.append(Paragraph("rravin Analysis Report", title_style))
    content.append(Paragraph(f"Generated on {datetime.now().strftime('%B %d, %Y at %H:%M')}", 
                             ParagraphStyle('Date', parent=styles['Normal'], fontSize=10, alignment=TA_CENTER, textColor=colors.grey)))
    content.append(Spacer(1, 30))
    
    # Executive Summary
    content.append(Paragraph("Executive Summary", heading_style))
    summary_text = analysis.get("summary", "No summary available.")
    for para in summary_text.split('\n\n'):
        if para.strip():
            content.append(Paragraph(para.strip(), body_style))
    content.append(Spacer(1, 20))
    
    # Key Metrics
    content.append(Paragraph("Key Performance Indicators", heading_style))
    metrics = analysis.get("key_metrics", [])
    
    if metrics:
        # Create metrics table
        metric_data = []
        for i in range(0, len(metrics), 2):
            row = []
            for j in range(2):
                if i + j < len(metrics):
                    m = metrics[i + j]
                    cell_content = f"<b>{m.get('name', 'N/A')}</b><br/><font size='14'>{m.get('value', 'N/A')}</font>"
                    if m.get('change'):
                        change_color = '#16a34a' if '+' in str(m.get('change', '')) else '#dc2626'
                        cell_content += f"<br/><font color='{change_color}'>{m.get('change')}</font>"
                    if m.get('interpretation'):
                        cell_content += f"<br/><font size='8' color='#64748b'>{m.get('interpretation', '')[:100]}...</font>"
                    row.append(Paragraph(cell_content, body_style))
                else:
                    row.append("")
            metric_data.append(row)
        
        if metric_data:
            metrics_table = Table(metric_data, colWidths=[250, 250])
            metrics_table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#f8fafc')),
                ('BOX', (0, 0), (-1, -1), 1, colors.HexColor('#e2e8f0')),
                ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#e2e8f0')),
                ('PADDING', (0, 0), (-1, -1), 12),
                ('VALIGN', (0, 0), (-1, -1), 'TOP'),
            ]))
            content.append(metrics_table)
    
    content.append(Spacer(1, 20))
    
    # Visualizations
    content.append(Paragraph("Data Visualizations", heading_style))
    visualizations = analysis.get("visualizations", [])
    
    for i, viz in enumerate(visualizations[:6]):  # Limit to 6 charts
        try:
            img_buffer = generate_chart_image(viz, i)
            img = Image(img_buffer, width=450, height=280)
            content.append(img)
            
            if viz.get("description"):
                content.append(Paragraph(f"<i>{viz.get('description')}</i>", 
                    ParagraphStyle('ChartDesc', parent=body_style, fontSize=9, textColor=colors.grey, alignment=TA_CENTER)))
            content.append(Spacer(1, 15))
        except Exception as e:
            logger.error(f"Error generating chart {i}: {e}")
            content.append(Paragraph(f"Chart: {viz.get('title', 'Untitled')} (Error generating image)", body_style))
    
    # Page break before detailed sections
    content.append(PageBreak())
    
    # Issues Identified
    content.append(Paragraph("Issues & Anomalies Identified", heading_style))
    problems = analysis.get("problems", [])
    if problems:
        for i, problem in enumerate(problems, 1):
            content.append(Paragraph(f"<b>{i}.</b> {problem}", body_style))
    else:
        content.append(Paragraph("No significant issues identified.", body_style))
    content.append(Spacer(1, 20))
    
    # Recommendations
    content.append(Paragraph("Strategic Recommendations", heading_style))
    recommendations = analysis.get("recommendations", [])
    if recommendations:
        for i, rec in enumerate(recommendations, 1):
            content.append(Paragraph(f"<b>{i}.</b> {rec}", body_style))
    else:
        content.append(Paragraph("No recommendations available.", body_style))
    content.append(Spacer(1, 20))
    
    # Full Executive Report
    content.append(Paragraph("Detailed Executive Report", heading_style))
    exec_report = analysis.get("executive_report", "No detailed report available.")
    for para in exec_report.split('\n\n'):
        if para.strip():
            content.append(Paragraph(para.strip(), body_style))
    
    # Footer
    content.append(Spacer(1, 40))
    content.append(Paragraph("─" * 80, ParagraphStyle('Line', parent=styles['Normal'], textColor=colors.lightgrey)))
    content.append(Paragraph("Generated by rravin AI Data Analyst", 
        ParagraphStyle('Footer', parent=styles['Normal'], fontSize=9, textColor=colors.grey, alignment=TA_CENTER)))
    
    # Build PDF
    doc.build(content)
    buffer.seek(0)
    
    return StreamingResponse(
        buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=rravin-report-{analysis_id}.pdf"}
    )

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
