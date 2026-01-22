import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import axios from "axios";
import { API } from "../App";
import { Button } from "../components/ui/button";
import { Textarea } from "../components/ui/textarea";
import { Card, CardContent } from "../components/ui/card";
import { Progress } from "../components/ui/progress";
import {
  Upload,
  FileSpreadsheet,
  Zap,
  BarChart3,
  FileText,
  MessageSquare,
  X,
  ChevronRight,
  Sparkles,
  PieChart,
  TrendingUp,
  Table2,
} from "lucide-react";

export default function Landing({ session, loading, refreshSession }) {
  const navigate = useNavigate();
  const [files, setFiles] = useState([]);
  const [instructions, setInstructions] = useState("");
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  const handleDrag = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    const droppedFiles = Array.from(e.dataTransfer.files).filter(
      (file) =>
        file.name.endsWith(".csv") ||
        file.name.endsWith(".xlsx") ||
        file.name.endsWith(".xls")
    );
    if (droppedFiles.length > 0) {
      setFiles((prev) => [...prev, ...droppedFiles].slice(0, 3));
    } else {
      toast.error("Please upload CSV or Excel files only");
    }
  }, []);

  const handleFileSelect = (e) => {
    const selectedFiles = Array.from(e.target.files);
    setFiles((prev) => [...prev, ...selectedFiles].slice(0, 3));
  };

  const removeFile = (index) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleAnalyze = async () => {
    if (!session?.session_id) {
      toast.error("Session not initialized");
      return;
    }

    if (files.length === 0) {
      toast.error("Please upload at least one file");
      return;
    }

    const remainingUploads = session.max_files - (session.files_uploaded || 0);
    if (files.length > remainingUploads) {
      toast.error(
        `Free tier limit: You can only upload ${remainingUploads} more file(s)`
      );
      return;
    }

    try {
      setUploading(true);

      const formData = new FormData();
      formData.append("session_id", session.session_id);
      files.forEach((file) => formData.append("files", file));

      await axios.post(`${API}/upload`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      toast.success("Files uploaded successfully!");
      setUploading(false);
      setAnalyzing(true);

      const analysisResponse = await axios.post(`${API}/analyze`, {
        session_id: session.session_id,
        instructions: instructions || null,
      });

      await refreshSession();
      toast.success("Analysis complete!");

      navigate(`/dashboard?analysis=${analysisResponse.data.analysis_id}`);
    } catch (error) {
      console.error("Error:", error);
      toast.error(
        error.response?.data?.detail || "An error occurred. Please try again."
      );
    } finally {
      setUploading(false);
      setAnalyzing(false);
    }
  };

  const features = [
    {
      icon: BarChart3,
      title: "Tableau-like Dashboard",
      description: "Interactive visualizations with deep data insights",
    },
    {
      icon: TrendingUp,
      title: "Advanced Metrics",
      description: "Statistical analysis with clear interpretations",
    },
    {
      icon: PieChart,
      title: "Smart Visualizations",
      description: "Auto-generated charts that tell your data story",
    },
    {
      icon: Table2,
      title: "Data Tables",
      description: "Sortable, filterable views of your data",
    },
    {
      icon: FileText,
      title: "Executive Reports",
      description: "Stakeholder-ready reports with actionable insights",
    },
    {
      icon: MessageSquare,
      title: "Ask Questions",
      description: "Chat with your data for deeper understanding",
    },
  ];

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="spinner" />
      </div>
    );
  }

  return (
    <div className="min-h-screen hero-section">
      {/* Header */}
      <header className="px-6 md:px-12 lg:px-24 py-5 flex items-center justify-between border-b border-slate-100">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <span className="logo-text text-xl">rravin</span>
        </div>
        <div className="flex items-center gap-4">
          <div className="px-3 py-1.5 bg-slate-100 rounded-full">
            <span className="text-sm text-slate-600 font-medium">
              {session?.max_files - (session?.files_uploaded || 0)} uploads remaining
            </span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="px-6 md:px-12 lg:px-24 py-12 lg:py-16">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col lg:flex-row gap-12 lg:gap-16 items-start">
            {/* Left Column - Hero Text */}
            <div className="flex-1 pt-4 lg:pt-8">
              <p className="overline mb-4">AI-POWERED DATA ANALYST</p>
              <h1 className="font-heading text-4xl sm:text-5xl lg:text-[3.5rem] font-extrabold text-slate-900 leading-[1.1] mb-6">
                Transform Data Into
                <br />
                <span className="gradient-text">Executive Intelligence</span>
              </h1>
              <p className="text-lg text-slate-600 max-w-xl mb-10 leading-relaxed">
                Upload your data and get a complete Tableau-like dashboard with
                visualizations, metrics, insights, and executive reports — all in seconds.
              </p>

              {/* Feature Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {features.map((feature, index) => (
                  <div
                    key={index}
                    className="feature-card"
                    data-testid={`feature-${index}`}
                  >
                    <feature.icon className="w-5 h-5 text-blue-600 mb-2" />
                    <h3 className="font-semibold text-slate-900 text-sm mb-1">
                      {feature.title}
                    </h3>
                    <p className="text-xs text-slate-500 leading-relaxed">
                      {feature.description}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Right Column - Upload Card */}
            <div className="w-full lg:w-[440px] animate-fade-in">
              <div className="upload-card p-6">
                <h2 className="font-heading text-xl font-bold text-slate-900 mb-6">
                  Start Your Analysis
                </h2>

                {/* File Upload Zone */}
                <div
                  className={`file-drop-zone rounded-xl p-8 text-center mb-5 ${
                    dragActive ? "dragging" : ""
                  }`}
                  onDragEnter={handleDrag}
                  onDragLeave={handleDrag}
                  onDragOver={handleDrag}
                  onDrop={handleDrop}
                  data-testid="file-drop-zone"
                >
                  <input
                    type="file"
                    id="file-upload"
                    className="hidden"
                    multiple
                    accept=".csv,.xlsx,.xls"
                    onChange={handleFileSelect}
                    data-testid="file-input"
                  />
                  <label
                    htmlFor="file-upload"
                    className="cursor-pointer flex flex-col items-center"
                  >
                    <div className="w-14 h-14 rounded-full bg-blue-50 flex items-center justify-center mb-4">
                      <Upload className="w-6 h-6 text-blue-600" />
                    </div>
                    <p className="text-slate-800 font-medium mb-1">
                      Drop files here or click to upload
                    </p>
                    <p className="text-sm text-slate-500">
                      CSV or Excel files (max 3 for free tier)
                    </p>
                  </label>
                </div>

                {/* Selected Files */}
                {files.length > 0 && (
                  <div className="space-y-2 mb-5">
                    {files.map((file, index) => (
                      <div
                        key={index}
                        className="file-item"
                        data-testid={`selected-file-${index}`}
                      >
                        <div className="flex items-center gap-3">
                          <FileSpreadsheet className="w-5 h-5 text-blue-600" />
                          <span className="text-sm text-slate-700 truncate max-w-[200px] font-medium">
                            {file.name}
                          </span>
                        </div>
                        <button
                          onClick={() => removeFile(index)}
                          className="p-1.5 hover:bg-slate-200 rounded-md transition-colors"
                          data-testid={`remove-file-${index}`}
                        >
                          <X className="w-4 h-4 text-slate-500" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Instructions */}
                <div className="mb-5">
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Special Instructions (Optional)
                  </label>
                  <Textarea
                    placeholder="e.g., Focus on revenue trends, compare regional performance, identify outliers..."
                    value={instructions}
                    onChange={(e) => setInstructions(e.target.value)}
                    className="bg-slate-50 border-slate-200 text-slate-800 placeholder:text-slate-400 resize-none h-24 focus:border-blue-500 focus:ring-blue-500"
                    data-testid="instructions-input"
                  />
                </div>

                {/* Progress */}
                {(uploading || analyzing) && (
                  <div className="mb-5">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-slate-600">
                        {uploading ? "Uploading files..." : "Analyzing data..."}
                      </span>
                      <span className="text-sm text-blue-600 font-medium">
                        {uploading ? "50%" : "Processing"}
                      </span>
                    </div>
                    <Progress
                      value={uploading ? 50 : 75}
                      className="h-2"
                      data-testid="progress-bar"
                    />
                  </div>
                )}

                {/* Analyze Button */}
                <Button
                  onClick={handleAnalyze}
                  disabled={files.length === 0 || uploading || analyzing}
                  className="w-full h-12 btn-primary-glow text-white font-semibold text-base"
                  data-testid="analyze-button"
                >
                  {uploading ? (
                    <>
                      <div className="spinner mr-2" />
                      Uploading...
                    </>
                  ) : analyzing ? (
                    <>
                      <div className="spinner mr-2" />
                      Analyzing...
                    </>
                  ) : (
                    <>
                      Analyze Data
                      <ChevronRight className="w-5 h-5 ml-1" />
                    </>
                  )}
                </Button>

                {/* Existing Analyses */}
                {session?.analyses?.length > 0 && (
                  <div className="mt-5 pt-5 border-t border-slate-200">
                    <p className="text-sm text-slate-500 mb-3">
                      Previous Analyses
                    </p>
                    <Button
                      variant="outline"
                      onClick={() =>
                        navigate(
                          `/dashboard?analysis=${session.analyses[session.analyses.length - 1].analysis_id}`
                        )
                      }
                      className="w-full border-slate-200 text-slate-700 hover:bg-slate-50"
                      data-testid="view-previous-analysis"
                    >
                      View Latest Analysis
                      <ChevronRight className="w-4 h-4 ml-1" />
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
