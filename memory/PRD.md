# rravin - AI Data Analysis Agent

## Original Problem Statement
Build rravin - an AI agent which analyzes datasets, builds visualizations, reports, recommends actions and generates executive reports from the data. Save time from building dashboards, reports, and writing complex queries with a single prompt.

## User Personas
- **Business Professionals**: Need quick insights from data without SQL knowledge
- **Data Analysts**: Want to accelerate initial data exploration
- **Executives**: Need stakeholder-ready reports from raw data

## Core Requirements (Static)
- File upload (CSV/Excel) with 3-file free tier limit
- AI-powered data analysis using LLM
- Quick summary generation
- Key metrics calculation
- Auto-generated visualizations
- Problem identification
- Actionable recommendations
- Executive report generation
- Chat interface for follow-up questions

## What's Been Implemented (January 2026)

### Backend (FastAPI + MongoDB)
- Session management with free tier tracking
- File upload endpoint (CSV/Excel support via pandas/openpyxl)
- AI analysis using Gemini via emergentintegrations
- Chat functionality with context awareness
- MongoDB storage for sessions, analyses, and chat history

### Frontend (React + Tailwind + Recharts)
- Landing page with file upload zone (drag & drop)
- Special instructions input
- Dashboard with 4 tabs:
  - Overview: Summary, key metrics, problems, recommendations
  - Visualizations: Bar, line, pie, area charts (Recharts)
  - Executive Report: Downloadable markdown report
  - Ask Questions: Chat interface with AI

### Design System
- Dark theme with Electric Blue (#007AFF) accent
- Manrope (headings) + IBM Plex Sans (body) fonts
- Glass morphism cards with backdrop blur
- Noise overlay texture
- Tracing beam animation on upload zone

## Prioritized Backlog

### P0 (Critical)
- ✅ File upload and parsing
- ✅ AI analysis with LLM
- ✅ Dashboard visualization
- ✅ Executive reports

### P1 (High Priority)
- User authentication for persistent sessions
- Export to PDF/PowerPoint
- Multiple file format support (JSON, Parquet)
- Analysis history view

### P2 (Medium Priority)
- Custom chart builder
- Data transformation tools
- Scheduled reports
- Team collaboration features

## Next Tasks
1. Add PDF export for executive reports
2. Implement user authentication (Google OAuth)
3. Add more visualization types (scatter, heatmap)
4. Enable real-time collaboration
5. Add premium tier with unlimited uploads
