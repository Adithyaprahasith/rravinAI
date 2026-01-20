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

    const remainingUploads =
      session.max_files - (session.files_uploaded || 0);
    if (files.length > remainingUploads) {
      toast.error(
        `Free tier limit: You can only upload ${remainingUploads} more file(s)`
      );
      return;
    }

    try {
      setUploading(true);

      // Upload files
      const formData = new FormData();
      formData.append("session_id", session.session_id);
      files.forEach((file) => formData.append("files", file));

      await axios.post(`${API}/upload`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      toast.success("Files uploaded successfully!");
      setUploading(false);
      setAnalyzing(true);

      // Analyze
      const analysisResponse = await axios.post(`${API}/analyze`, {
        session_id: session.session_id,
        instructions: instructions || null,
      });

      await refreshSession();
      toast.success("Analysis complete!");

      // Navigate to dashboard with analysis ID
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
      icon: Zap,
      title: "Instant Analysis",
      description: "Get comprehensive insights in seconds, not hours",
    },
    {
      icon: BarChart3,
      title: "Smart Visualizations",
      description: "Auto-generated charts that tell your data story",
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
      <div className="min-h-screen flex items-center justify-center">
        <div className="spinner" />
      </div>
    );
  }

  return (
    <div className="min-h-screen grid-pattern">
      {/* Hero Section */}
      <div className="hero-glow min-h-screen flex flex-col">
        {/* Header */}
        <header className="px-6 md:px-12 lg:px-24 py-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center glow-primary">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <span className="logo-text text-2xl text-white">rravin</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">
              Free tier: {session?.max_files - (session?.files_uploaded || 0)}{" "}
              uploads remaining
            </span>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 px-6 md:px-12 lg:px-24 py-12 flex flex-col lg:flex-row gap-12 items-start">
          {/* Left Column - Hero Text */}
          <div className="flex-1 pt-8 lg:pt-16 stagger-children">
            <p className="overline text-primary mb-4">AI DATA ANALYST</p>
            <h1 className="font-heading text-4xl sm:text-5xl lg:text-6xl font-black text-white leading-tight mb-6">
              Transform Data Into
              <br />
              <span className="gradient-text">Executive Intelligence</span>
            </h1>
            <p className="text-lg text-muted-foreground max-w-xl mb-8">
              Upload your data, and let rravin build dashboards, visualizations,
              and executive reports instantly. No complex queries needed.
            </p>

            {/* Feature Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-xl">
              {features.map((feature, index) => (
                <div
                  key={index}
                  className="flex items-start gap-3 p-4 rounded-lg bg-card/50 border border-border"
                  data-testid={`feature-${index}`}
                >
                  <feature.icon className="w-5 h-5 text-primary mt-0.5" />
                  <div>
                    <h3 className="font-medium text-white text-sm">
                      {feature.title}
                    </h3>
                    <p className="text-xs text-muted-foreground mt-1">
                      {feature.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right Column - Upload Card */}
          <div className="w-full lg:w-[480px] animate-fade-in">
            <Card className="glass border-border">
              <CardContent className="p-6">
                <h2 className="font-heading text-xl font-bold text-white mb-6">
                  Start Your Analysis
                </h2>

                {/* File Upload Zone */}
                <div
                  className={`file-drop-zone rounded-xl p-8 text-center mb-6 tracing-beam ${
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
                    <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                      <Upload className="w-8 h-8 text-primary" />
                    </div>
                    <p className="text-white font-medium mb-1">
                      Drop files here or click to upload
                    </p>
                    <p className="text-sm text-muted-foreground">
                      CSV or Excel files (max 3 for free tier)
                    </p>
                  </label>
                </div>

                {/* Selected Files */}
                {files.length > 0 && (
                  <div className="space-y-2 mb-6">
                    {files.map((file, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-3 rounded-lg bg-secondary/50 border border-border"
                        data-testid={`selected-file-${index}`}
                      >
                        <div className="flex items-center gap-3">
                          <FileSpreadsheet className="w-5 h-5 text-primary" />
                          <span className="text-sm text-white truncate max-w-[200px]">
                            {file.name}
                          </span>
                        </div>
                        <button
                          onClick={() => removeFile(index)}
                          className="p-1 hover:bg-white/10 rounded"
                          data-testid={`remove-file-${index}`}
                        >
                          <X className="w-4 h-4 text-muted-foreground" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Instructions */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-white mb-2">
                    Special Instructions (Optional)
                  </label>
                  <Textarea
                    placeholder="e.g., Focus on revenue trends, or just give me a quick summary..."
                    value={instructions}
                    onChange={(e) => setInstructions(e.target.value)}
                    className="bg-secondary border-border text-white placeholder:text-muted-foreground resize-none h-24"
                    data-testid="instructions-input"
                  />
                </div>

                {/* Progress */}
                {(uploading || analyzing) && (
                  <div className="mb-6">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-muted-foreground">
                        {uploading ? "Uploading files..." : "Analyzing data..."}
                      </span>
                      <span className="text-sm text-primary">
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
                  className="w-full h-12 bg-primary hover:bg-primary/90 text-white font-semibold glow-primary-hover"
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
                      <ChevronRight className="w-5 h-5 ml-2" />
                    </>
                  )}
                </Button>

                {/* Existing Analyses */}
                {session?.analyses?.length > 0 && (
                  <div className="mt-6 pt-6 border-t border-border">
                    <p className="text-sm text-muted-foreground mb-3">
                      Previous Analyses
                    </p>
                    <Button
                      variant="outline"
                      onClick={() =>
                        navigate(
                          `/dashboard?analysis=${session.analyses[session.analyses.length - 1].analysis_id}`
                        )
                      }
                      className="w-full border-border text-white hover:bg-white/5"
                      data-testid="view-previous-analysis"
                    >
                      View Latest Analysis
                      <ChevronRight className="w-4 h-4 ml-2" />
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </div>
  );
}
