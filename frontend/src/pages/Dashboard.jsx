import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import axios from "axios";
import { API } from "../App";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { ScrollArea } from "../components/ui/scroll-area";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ComposedChart,
  ScatterChart,
  Scatter,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
} from "recharts";
import {
  Sparkles,
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
  Lightbulb,
  FileText,
  Send,
  ArrowLeft,
  Download,
  RefreshCw,
  MessageSquare,
  BarChart3,
  PieChart as PieChartIcon,
  Activity,
  Target,
  Layers,
  Info,
  CheckCircle2,
  AlertCircle,
  ArrowUpRight,
  ArrowDownRight,
  LayoutDashboard,
  Table2,
  LineChart as LineChartIcon,
} from "lucide-react";

// Light mode chart colors
const CHART_COLORS = [
  "#2563eb", // Blue
  "#16a34a", // Green
  "#7c3aed", // Purple
  "#ea580c", // Orange
  "#db2777", // Pink
  "#0891b2", // Cyan
  "#ca8a04", // Yellow
  "#dc2626", // Red
];

const CHART_COLORS_LIGHT = [
  "#93c5fd", // Light Blue
  "#86efac", // Light Green
  "#c4b5fd", // Light Purple
  "#fed7aa", // Light Orange
  "#fbcfe8", // Light Pink
  "#a5f3fc", // Light Cyan
  "#fef08a", // Light Yellow
  "#fecaca", // Light Red
];

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="custom-tooltip">
        <p className="text-sm font-semibold text-slate-800 mb-2">{label}</p>
        {payload.map((entry, index) => (
          <div key={index} className="flex items-center gap-2 text-sm">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-slate-600">{entry.name}:</span>
            <span className="font-medium text-slate-800">
              {typeof entry.value === "number"
                ? entry.value.toLocaleString()
                : entry.value}
            </span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

// Enhanced Metric Card with interpretation
const MetricCard = ({ metric, index }) => {
  const colorClasses = [
    "stat-card-blue",
    "stat-card-green",
    "stat-card-purple",
    "stat-card-orange",
    "stat-card-pink",
    "stat-card-cyan",
  ];

  const getTrendIcon = (trend) => {
    switch (trend?.toLowerCase()) {
      case "up":
        return <ArrowUpRight className="w-4 h-4 text-green-600" />;
      case "down":
        return <ArrowDownRight className="w-4 h-4 text-red-600" />;
      default:
        return <Minus className="w-4 h-4 text-slate-400" />;
    }
  };

  const getTrendBadge = (change, trend) => {
    if (!change) return null;
    const isPositive = change.includes("+") || trend === "up";
    const isNegative = change.includes("-") || trend === "down";
    return (
      <span
        className={`stat-badge ${isPositive ? "positive" : isNegative ? "negative" : "neutral"}`}
      >
        {getTrendIcon(trend)}
        {change}
      </span>
    );
  };

  return (
    <div
      className={`metric-card p-5 ${colorClasses[index % colorClasses.length]}`}
      data-testid={`metric-card-${index}`}
    >
      <div className="flex items-start justify-between mb-2">
        <span className="text-sm font-medium text-slate-500">{metric.name}</span>
        {getTrendBadge(metric.change, metric.trend)}
      </div>
      <div className="kpi-value text-2xl text-slate-900 mb-1">{metric.value}</div>
      {metric.interpretation && (
        <p className="interpretation">{metric.interpretation}</p>
      )}
      {!metric.interpretation && metric.description && (
        <p className="interpretation">{metric.description}</p>
      )}
    </div>
  );
};

// Chart Card Component
const ChartCard = ({ visualization, index }) => {
  const renderChart = () => {
    const data = visualization.data || [];
    const xKey = visualization.xKey || "name";
    const yKey = visualization.yKey || "value";
    const color = CHART_COLORS[index % CHART_COLORS.length];

    switch (visualization.type?.toLowerCase()) {
      case "bar":
        return (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
              <XAxis dataKey={xKey} stroke="#64748b" tick={{ fontSize: 11 }} axisLine={{ stroke: "#e2e8f0" }} />
              <YAxis stroke="#64748b" tick={{ fontSize: 11 }} axisLine={{ stroke: "#e2e8f0" }} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey={yKey} fill={color} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        );
      case "line":
        return (
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
              <XAxis dataKey={xKey} stroke="#64748b" tick={{ fontSize: 11 }} axisLine={{ stroke: "#e2e8f0" }} />
              <YAxis stroke="#64748b" tick={{ fontSize: 11 }} axisLine={{ stroke: "#e2e8f0" }} />
              <Tooltip content={<CustomTooltip />} />
              <Line
                type="monotone"
                dataKey={yKey}
                stroke={color}
                strokeWidth={2.5}
                dot={{ fill: color, r: 4, strokeWidth: 2, stroke: "#fff" }}
                activeDot={{ r: 6, strokeWidth: 2, stroke: "#fff" }}
              />
            </LineChart>
          </ResponsiveContainer>
        );
      case "area":
        return (
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id={`gradient-${index}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={color} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={color} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
              <XAxis dataKey={xKey} stroke="#64748b" tick={{ fontSize: 11 }} axisLine={{ stroke: "#e2e8f0" }} />
              <YAxis stroke="#64748b" tick={{ fontSize: 11 }} axisLine={{ stroke: "#e2e8f0" }} />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey={yKey}
                stroke={color}
                strokeWidth={2}
                fill={`url(#gradient-${index})`}
              />
            </AreaChart>
          </ResponsiveContainer>
        );
      case "pie":
        return (
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie
                data={data}
                dataKey={yKey}
                nameKey={xKey}
                cx="50%"
                cy="50%"
                outerRadius={100}
                innerRadius={50}
                paddingAngle={2}
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                labelLine={{ stroke: "#94a3b8", strokeWidth: 1 }}
              >
                {data.map((_, i) => (
                  <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        );
      case "composed":
        return (
          <ResponsiveContainer width="100%" height={280}>
            <ComposedChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
              <XAxis dataKey={xKey} stroke="#64748b" tick={{ fontSize: 11 }} />
              <YAxis stroke="#64748b" tick={{ fontSize: 11 }} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey={yKey} fill={CHART_COLORS[0]} radius={[4, 4, 0, 0]} />
              <Line type="monotone" dataKey={yKey} stroke={CHART_COLORS[1]} strokeWidth={2} />
            </ComposedChart>
          </ResponsiveContainer>
        );
      default:
        return (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
              <XAxis dataKey={xKey} stroke="#64748b" tick={{ fontSize: 11 }} />
              <YAxis stroke="#64748b" tick={{ fontSize: 11 }} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey={yKey} fill={color} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        );
    }
  };

  return (
    <div className="chart-container" data-testid={`chart-card-${index}`}>
      <div className="chart-header">
        <div>
          <h3 className="font-semibold text-slate-800 text-sm flex items-center gap-2">
            {visualization.type === "pie" ? (
              <PieChartIcon className="w-4 h-4 text-blue-600" />
            ) : visualization.type === "line" ? (
              <LineChartIcon className="w-4 h-4 text-blue-600" />
            ) : (
              <BarChart3 className="w-4 h-4 text-blue-600" />
            )}
            {visualization.title}
          </h3>
          {visualization.description && (
            <p className="text-xs text-slate-500 mt-1">{visualization.description}</p>
          )}
        </div>
      </div>
      {renderChart()}
    </div>
  );
};

// Insight Panel Component
const InsightPanel = ({ type, title, children }) => {
  const icons = {
    info: <Info className="w-5 h-5 text-blue-600" />,
    success: <CheckCircle2 className="w-5 h-5 text-green-600" />,
    warning: <AlertCircle className="w-5 h-5 text-amber-600" />,
    danger: <AlertTriangle className="w-5 h-5 text-red-600" />,
  };

  return (
    <div className={`insight-panel ${type}`}>
      <div className="flex items-start gap-3">
        {icons[type] || icons.info}
        <div className="flex-1">
          <h4 className="font-semibold text-slate-800 text-sm mb-1">{title}</h4>
          <div className="text-sm text-slate-600">{children}</div>
        </div>
      </div>
    </div>
  );
};

export default function Dashboard({ session, loading, refreshSession }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [analysis, setAnalysis] = useState(null);
  const [loadingAnalysis, setLoadingAnalysis] = useState(true);
  const [chatMessage, setChatMessage] = useState("");
  const [chatHistory, setChatHistory] = useState([]);
  const [sendingMessage, setSendingMessage] = useState(false);
  const chatEndRef = useRef(null);

  const analysisId = searchParams.get("analysis");

  useEffect(() => {
    const fetchAnalysis = async () => {
      if (!analysisId) {
        navigate("/");
        return;
      }

      try {
        const response = await axios.get(`${API}/analyses/${analysisId}`);
        setAnalysis(response.data);

        if (session?.session_id) {
          const historyResponse = await axios.get(
            `${API}/chat/${session.session_id}/history`
          );
          setChatHistory(historyResponse.data.history || []);
        }
      } catch (error) {
        console.error("Error fetching analysis:", error);
        toast.error("Failed to load analysis");
        navigate("/");
      } finally {
        setLoadingAnalysis(false);
      }
    };

    if (!loading) {
      fetchAnalysis();
    }
  }, [analysisId, session?.session_id, loading, navigate]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatHistory]);

  const handleSendMessage = async () => {
    if (!chatMessage.trim() || !session?.session_id) return;

    const userMessage = chatMessage.trim();
    setChatMessage("");
    setSendingMessage(true);

    setChatHistory((prev) => [
      ...prev,
      { user_message: userMessage, ai_response: null, pending: true },
    ]);

    try {
      const response = await axios.post(`${API}/chat`, {
        session_id: session.session_id,
        message: userMessage,
      });

      setChatHistory((prev) =>
        prev.map((msg, i) =>
          i === prev.length - 1
            ? { ...msg, ai_response: response.data.response, pending: false }
            : msg
        )
      );
    } catch (error) {
      console.error("Chat error:", error);
      toast.error("Failed to send message");
      setChatHistory((prev) => prev.slice(0, -1));
    } finally {
      setSendingMessage(false);
    }
  };

  const handleDownloadReport = () => {
    if (!analysis?.executive_report) return;

    const content = `# Executive Report - rravin Analysis

## Executive Summary
${analysis.summary}

## Key Performance Indicators
${analysis.key_metrics?.map((m) => `### ${m.name}
- **Value:** ${m.value}
- **Change:** ${m.change || "N/A"}
- **Trend:** ${m.trend || "N/A"}
- **Interpretation:** ${m.interpretation || m.description || "N/A"}
`).join("\n") || "N/A"}

## Issues & Anomalies Identified
${analysis.problems?.map((p, i) => `${i + 1}. ${p}`).join("\n") || "None identified"}

## Strategic Recommendations
${analysis.recommendations?.map((r, i) => `${i + 1}. ${r}`).join("\n") || "N/A"}

## Detailed Executive Report
${analysis.executive_report}

---
**Generated by rravin AI Data Analyst**
${new Date().toLocaleString()}
`;

    const blob = new Blob([content], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `rravin-executive-report-${analysisId}.md`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Report downloaded!");
  };

  if (loading || loadingAnalysis) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="spinner mx-auto mb-4" />
          <p className="text-slate-500">Loading analysis...</p>
        </div>
      </div>
    );
  }

  if (!analysis) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <p className="text-slate-500 mb-4">No analysis found</p>
          <Button onClick={() => navigate("/")} data-testid="go-home-btn">
            Go Home
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="sticky top-0 z-50 header-light">
        <div className="px-6 md:px-8 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/")}
              className="text-slate-600 hover:text-slate-900 hover:bg-slate-100"
              data-testid="back-button"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              <span className="logo-text text-lg">rravin</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownloadReport}
              className="border-slate-200 text-slate-700 hover:bg-slate-50"
              data-testid="download-report-btn"
            >
              <Download className="w-4 h-4 mr-2" />
              Export Report
            </Button>
            <Button
              size="sm"
              onClick={() => navigate("/")}
              className="bg-blue-600 hover:bg-blue-700 text-white"
              data-testid="new-analysis-btn"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              New Analysis
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="px-6 md:px-8 py-6">
        <Tabs defaultValue="dashboard" className="space-y-6">
          <TabsList className="bg-white border border-slate-200 p-1 rounded-lg">
            <TabsTrigger value="dashboard" className="tab-item" data-testid="tab-dashboard">
              <LayoutDashboard className="w-4 h-4 mr-2" />
              Dashboard
            </TabsTrigger>
            <TabsTrigger value="metrics" className="tab-item" data-testid="tab-metrics">
              <Activity className="w-4 h-4 mr-2" />
              Metrics
            </TabsTrigger>
            <TabsTrigger value="visualizations" className="tab-item" data-testid="tab-visualizations">
              <BarChart3 className="w-4 h-4 mr-2" />
              Charts
            </TabsTrigger>
            <TabsTrigger value="insights" className="tab-item" data-testid="tab-insights">
              <Lightbulb className="w-4 h-4 mr-2" />
              Insights
            </TabsTrigger>
            <TabsTrigger value="report" className="tab-item" data-testid="tab-report">
              <FileText className="w-4 h-4 mr-2" />
              Report
            </TabsTrigger>
            <TabsTrigger value="chat" className="tab-item" data-testid="tab-chat">
              <MessageSquare className="w-4 h-4 mr-2" />
              Ask AI
            </TabsTrigger>
          </TabsList>

          {/* Dashboard Tab - Tableau-like Overview */}
          <TabsContent value="dashboard" className="space-y-6 animate-fade-in">
            {/* Summary Card */}
            <div className="card-elevated p-6">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                  <FileText className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <h2 className="font-heading text-lg font-bold text-slate-900 mb-2">
                    Executive Summary
                  </h2>
                  <p className="text-slate-600 leading-relaxed whitespace-pre-line">
                    {analysis.summary}
                  </p>
                </div>
              </div>
            </div>

            {/* Key Metrics Row */}
            <div>
              <h3 className="font-heading font-bold text-slate-900 mb-4 flex items-center gap-2">
                <Target className="w-5 h-5 text-blue-600" />
                Key Performance Indicators
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 stagger-children">
                {analysis.key_metrics?.slice(0, 8).map((metric, index) => (
                  <MetricCard key={index} metric={metric} index={index} />
                ))}
              </div>
            </div>

            {/* Charts Grid - Tableau Style */}
            <div>
              <h3 className="font-heading font-bold text-slate-900 mb-4 flex items-center gap-2">
                <Layers className="w-5 h-5 text-blue-600" />
                Data Visualizations
              </h3>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {analysis.visualizations?.slice(0, 4).map((viz, index) => (
                  <ChartCard key={index} visualization={viz} index={index} />
                ))}
              </div>
            </div>

            {/* Quick Insights Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Problems */}
              <div className="card-elevated p-5">
                <h3 className="font-heading font-semibold text-slate-900 mb-4 flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-amber-500" />
                  Issues Identified
                </h3>
                <ul className="space-y-3">
                  {analysis.problems?.slice(0, 4).map((problem, index) => (
                    <li
                      key={index}
                      className="flex items-start gap-3 text-sm"
                      data-testid={`problem-${index}`}
                    >
                      <span className="w-6 h-6 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0 text-xs font-bold text-amber-700">
                        {index + 1}
                      </span>
                      <span className="text-slate-600">{problem}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Recommendations */}
              <div className="card-elevated p-5">
                <h3 className="font-heading font-semibold text-slate-900 mb-4 flex items-center gap-2">
                  <Lightbulb className="w-5 h-5 text-green-500" />
                  Recommendations
                </h3>
                <ul className="space-y-3">
                  {analysis.recommendations?.slice(0, 4).map((rec, index) => (
                    <li
                      key={index}
                      className="flex items-start gap-3 text-sm"
                      data-testid={`recommendation-${index}`}
                    >
                      <span className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0 text-xs font-bold text-green-700">
                        {index + 1}
                      </span>
                      <span className="text-slate-600">{rec}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </TabsContent>

          {/* Metrics Tab - All Metrics with Interpretations */}
          <TabsContent value="metrics" className="animate-fade-in">
            <div className="card-elevated p-6 mb-6">
              <h2 className="font-heading text-lg font-bold text-slate-900 mb-2">
                Comprehensive Metrics Analysis
              </h2>
              <p className="text-slate-500 text-sm">
                All key metrics from your data with statistical interpretations and business context.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 stagger-children">
              {analysis.key_metrics?.map((metric, index) => (
                <MetricCard key={index} metric={metric} index={index} />
              ))}
            </div>

            {/* Statistical Summary */}
            {analysis.statistical_summary && (
              <div className="card-elevated p-6 mt-6">
                <h3 className="font-heading font-semibold text-slate-900 mb-4">
                  Statistical Summary
                </h3>
                <div className="stats-grid">
                  {Object.entries(analysis.statistical_summary).map(([key, value], i) => (
                    <div key={i} className="mini-stat">
                      <div className="mini-stat-value">{value}</div>
                      <div className="mini-stat-label">{key.replace(/_/g, " ")}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </TabsContent>

          {/* Visualizations Tab - All Charts */}
          <TabsContent value="visualizations" className="animate-fade-in">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 stagger-children">
              {analysis.visualizations?.length > 0 ? (
                analysis.visualizations.map((viz, index) => (
                  <ChartCard key={index} visualization={viz} index={index} />
                ))
              ) : (
                <div className="card-elevated col-span-2 p-12 text-center">
                  <BarChart3 className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                  <p className="text-slate-500">No visualizations available</p>
                </div>
              )}
            </div>
          </TabsContent>

          {/* Insights Tab - Problems & Recommendations */}
          <TabsContent value="insights" className="space-y-6 animate-fade-in">
            {/* Key Findings */}
            <div className="card-elevated p-6">
              <h2 className="font-heading text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                <Target className="w-5 h-5 text-blue-600" />
                Key Findings
              </h2>
              <p className="text-slate-600 leading-relaxed">{analysis.summary}</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Issues */}
              <div className="card-elevated p-6">
                <h3 className="font-heading font-semibold text-slate-900 mb-4 flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-amber-500" />
                  Issues & Anomalies ({analysis.problems?.length || 0})
                </h3>
                <div className="space-y-4">
                  {analysis.problems?.length > 0 ? (
                    analysis.problems.map((problem, index) => (
                      <InsightPanel key={index} type="warning" title={`Issue ${index + 1}`}>
                        {problem}
                      </InsightPanel>
                    ))
                  ) : (
                    <p className="text-slate-500 text-sm">No significant issues found</p>
                  )}
                </div>
              </div>

              {/* Recommendations */}
              <div className="card-elevated p-6">
                <h3 className="font-heading font-semibold text-slate-900 mb-4 flex items-center gap-2">
                  <Lightbulb className="w-5 h-5 text-green-500" />
                  Recommendations ({analysis.recommendations?.length || 0})
                </h3>
                <div className="space-y-4">
                  {analysis.recommendations?.length > 0 ? (
                    analysis.recommendations.map((rec, index) => (
                      <InsightPanel key={index} type="success" title={`Action ${index + 1}`}>
                        {rec}
                      </InsightPanel>
                    ))
                  ) : (
                    <p className="text-slate-500 text-sm">No recommendations available</p>
                  )}
                </div>
              </div>
            </div>
          </TabsContent>

          {/* Executive Report Tab */}
          <TabsContent value="report" className="animate-fade-in">
            <div className="card-elevated p-8 max-w-4xl mx-auto">
              <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-200">
                <div>
                  <h2 className="font-heading text-xl font-bold text-slate-900">
                    Executive Report
                  </h2>
                  <p className="text-sm text-slate-500 mt-1">
                    Generated on {new Date().toLocaleDateString()}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDownloadReport}
                  className="border-slate-200"
                  data-testid="download-report-inline"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Download
                </Button>
              </div>

              <div className="report-content">
                <div className="report-section">
                  <h3>Executive Summary</h3>
                  <p className="whitespace-pre-line">{analysis.summary}</p>
                </div>

                <div className="report-section">
                  <h3>Key Metrics</h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-4">
                    {analysis.key_metrics?.slice(0, 6).map((m, i) => (
                      <div key={i} className="p-4 bg-slate-50 rounded-lg">
                        <div className="text-sm text-slate-500">{m.name}</div>
                        <div className="text-xl font-bold text-slate-900">{m.value}</div>
                        {m.change && (
                          <div className={`text-sm ${m.change.includes('+') ? 'text-green-600' : 'text-red-600'}`}>
                            {m.change}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="report-section">
                  <h3>Detailed Analysis</h3>
                  <p className="whitespace-pre-line">{analysis.executive_report}</p>
                </div>

                <div className="report-section">
                  <h3>Issues Identified</h3>
                  <ul className="list-disc list-inside space-y-2 mt-2">
                    {analysis.problems?.map((p, i) => (
                      <li key={i} className="text-slate-600">{p}</li>
                    ))}
                  </ul>
                </div>

                <div className="report-section">
                  <h3>Recommendations</h3>
                  <ul className="list-decimal list-inside space-y-2 mt-2">
                    {analysis.recommendations?.map((r, i) => (
                      <li key={i} className="text-slate-600">{r}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* Chat Tab */}
          <TabsContent value="chat" className="animate-fade-in">
            <div className="card-elevated h-[600px] flex flex-col max-w-4xl mx-auto">
              <div className="p-4 border-b border-slate-200">
                <h2 className="font-heading font-semibold text-slate-900 flex items-center gap-2">
                  <MessageSquare className="w-5 h-5 text-blue-600" />
                  Ask Questions About Your Data
                </h2>
                <p className="text-sm text-slate-500 mt-1">
                  Get deeper insights by chatting with rravin AI
                </p>
              </div>

              <ScrollArea className="flex-1 p-4">
                <div className="space-y-4">
                  {chatHistory.length === 0 ? (
                    <div className="text-center py-12">
                      <MessageSquare className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                      <p className="text-slate-500 mb-4">
                        Ask any question about your data and analysis
                      </p>
                      <div className="flex flex-wrap gap-2 justify-center">
                        {[
                          "What are the main trends?",
                          "Which areas need attention?",
                          "How can I improve performance?",
                        ].map((suggestion, i) => (
                          <Button
                            key={i}
                            variant="outline"
                            size="sm"
                            className="border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                            onClick={() => setChatMessage(suggestion)}
                            data-testid={`chat-suggestion-${i}`}
                          >
                            {suggestion}
                          </Button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    chatHistory.map((chat, index) => (
                      <div key={index} className="space-y-3">
                        <div className="flex justify-end">
                          <div className="chat-message-user" data-testid={`user-message-${index}`}>
                            <p className="text-slate-800 text-sm">{chat.user_message}</p>
                          </div>
                        </div>
                        {chat.ai_response && (
                          <div className="flex justify-start">
                            <div className="chat-message-ai" data-testid={`ai-response-${index}`}>
                              <div className="flex items-center gap-2 mb-2">
                                <Sparkles className="w-4 h-4 text-blue-600" />
                                <span className="text-xs text-blue-600 font-medium">rravin</span>
                              </div>
                              <p className="text-slate-600 text-sm whitespace-pre-line">
                                {chat.ai_response}
                              </p>
                            </div>
                          </div>
                        )}
                        {chat.pending && !chat.ai_response && (
                          <div className="flex justify-start">
                            <div className="chat-message-ai">
                              <div className="flex items-center gap-2">
                                <div className="spinner" />
                                <span className="text-xs text-slate-500">Thinking...</span>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                  <div ref={chatEndRef} />
                </div>
              </ScrollArea>

              <div className="border-t border-slate-200 p-4">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSendMessage();
                  }}
                  className="flex gap-3"
                >
                  <Input
                    value={chatMessage}
                    onChange={(e) => setChatMessage(e.target.value)}
                    placeholder="Ask a question about your data..."
                    className="flex-1 border-slate-200 focus:border-blue-500"
                    disabled={sendingMessage}
                    data-testid="chat-input"
                  />
                  <Button
                    type="submit"
                    disabled={!chatMessage.trim() || sendingMessage}
                    className="bg-blue-600 hover:bg-blue-700"
                    data-testid="chat-send-btn"
                  >
                    <Send className="w-4 h-4" />
                  </Button>
                </form>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
