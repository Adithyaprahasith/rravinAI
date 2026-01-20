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
  Home,
} from "lucide-react";

const CHART_COLORS = [
  "#007AFF",
  "#5856D6",
  "#AF52DE",
  "#FF2D55",
  "#FF9500",
  "#FFCC00",
  "#34C759",
  "#00C7BE",
];

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="custom-tooltip">
        <p className="text-sm font-medium text-white mb-1">{label}</p>
        {payload.map((entry, index) => (
          <p key={index} className="text-xs" style={{ color: entry.color }}>
            {entry.name}: {typeof entry.value === 'number' ? entry.value.toLocaleString() : entry.value}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

const MetricCard = ({ metric, index }) => {
  const getTrendIcon = (trend) => {
    switch (trend?.toLowerCase()) {
      case "up":
        return <TrendingUp className="w-4 h-4 text-green-500" />;
      case "down":
        return <TrendingDown className="w-4 h-4 text-red-500" />;
      default:
        return <Minus className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const getChangeColor = (change) => {
    if (!change) return "text-muted-foreground";
    if (change.includes("+")) return "text-green-500";
    if (change.includes("-")) return "text-red-500";
    return "text-muted-foreground";
  };

  return (
    <Card
      className="metric-card glass border-border"
      data-testid={`metric-card-${index}`}
    >
      <CardContent className="p-5">
        <div className="flex items-start justify-between mb-3">
          <span className="text-sm text-muted-foreground">{metric.name}</span>
          {getTrendIcon(metric.trend)}
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold text-white font-mono">
            {metric.value}
          </span>
          {metric.change && (
            <span className={`text-sm ${getChangeColor(metric.change)}`}>
              {metric.change}
            </span>
          )}
        </div>
        {metric.description && (
          <p className="text-xs text-muted-foreground mt-2">
            {metric.description}
          </p>
        )}
      </CardContent>
    </Card>
  );
};

const ChartCard = ({ visualization, index }) => {
  const renderChart = () => {
    const data = visualization.data || [];
    const xKey = visualization.xKey || "name";
    const yKey = visualization.yKey || "value";

    switch (visualization.type?.toLowerCase()) {
      case "bar":
        return (
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#262626" />
              <XAxis dataKey={xKey} stroke="#A3A3A3" tick={{ fontSize: 12 }} />
              <YAxis stroke="#A3A3A3" tick={{ fontSize: 12 }} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey={yKey} fill={CHART_COLORS[index % CHART_COLORS.length]} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        );
      case "line":
        return (
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#262626" />
              <XAxis dataKey={xKey} stroke="#A3A3A3" tick={{ fontSize: 12 }} />
              <YAxis stroke="#A3A3A3" tick={{ fontSize: 12 }} />
              <Tooltip content={<CustomTooltip />} />
              <Line
                type="monotone"
                dataKey={yKey}
                stroke={CHART_COLORS[index % CHART_COLORS.length]}
                strokeWidth={2}
                dot={{ fill: CHART_COLORS[index % CHART_COLORS.length], r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        );
      case "area":
        return (
          <ResponsiveContainer width="100%" height={250}>
            <AreaChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#262626" />
              <XAxis dataKey={xKey} stroke="#A3A3A3" tick={{ fontSize: 12 }} />
              <YAxis stroke="#A3A3A3" tick={{ fontSize: 12 }} />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey={yKey}
                stroke={CHART_COLORS[index % CHART_COLORS.length]}
                fill={`${CHART_COLORS[index % CHART_COLORS.length]}33`}
              />
            </AreaChart>
          </ResponsiveContainer>
        );
      case "pie":
        return (
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={data}
                dataKey={yKey}
                nameKey={xKey}
                cx="50%"
                cy="50%"
                outerRadius={80}
                label={(entry) => entry[xKey]}
              >
                {data.map((_, i) => (
                  <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        );
      default:
        return (
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#262626" />
              <XAxis dataKey={xKey} stroke="#A3A3A3" tick={{ fontSize: 12 }} />
              <YAxis stroke="#A3A3A3" tick={{ fontSize: 12 }} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey={yKey} fill={CHART_COLORS[0]} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        );
    }
  };

  return (
    <Card className="glass border-border" data-testid={`chart-card-${index}`}>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-medium text-white flex items-center gap-2">
          {visualization.type === "pie" ? (
            <PieChartIcon className="w-4 h-4 text-primary" />
          ) : (
            <BarChart3 className="w-4 h-4 text-primary" />
          )}
          {visualization.title}
        </CardTitle>
        {visualization.description && (
          <p className="text-xs text-muted-foreground">
            {visualization.description}
          </p>
        )}
      </CardHeader>
      <CardContent>{renderChart()}</CardContent>
    </Card>
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

        // Fetch chat history
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

    // Optimistically add user message
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

## Summary
${analysis.summary}

## Key Metrics
${analysis.key_metrics?.map((m) => `- ${m.name}: ${m.value} (${m.change || "N/A"})`).join("\n") || "N/A"}

## Problems Identified
${analysis.problems?.map((p) => `- ${p}`).join("\n") || "None identified"}

## Recommendations
${analysis.recommendations?.map((r) => `- ${r}`).join("\n") || "N/A"}

## Full Executive Report
${analysis.executive_report}

---
Generated by rravin AI Data Analyst
${new Date().toLocaleString()}
`;

    const blob = new Blob([content], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `rravin-report-${analysisId}.md`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Report downloaded!");
  };

  if (loading || loadingAnalysis) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="spinner mx-auto mb-4" />
          <p className="text-muted-foreground">Loading analysis...</p>
        </div>
      </div>
    );
  }

  if (!analysis) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">No analysis found</p>
          <Button onClick={() => navigate("/")} data-testid="go-home-btn">
            Go Home
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 glass border-b border-border">
        <div className="px-6 md:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/")}
              data-testid="back-button"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              <span className="logo-text text-xl text-white">rravin</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownloadReport}
              className="border-border text-white hover:bg-white/5"
              data-testid="download-report-btn"
            >
              <Download className="w-4 h-4 mr-2" />
              Download Report
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate("/")}
              className="border-border text-white hover:bg-white/5"
              data-testid="new-analysis-btn"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              New Analysis
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="px-6 md:px-8 py-8">
        <Tabs defaultValue="overview" className="space-y-8">
          <TabsList className="glass border border-border">
            <TabsTrigger value="overview" data-testid="tab-overview">
              Overview
            </TabsTrigger>
            <TabsTrigger value="visualizations" data-testid="tab-visualizations">
              Visualizations
            </TabsTrigger>
            <TabsTrigger value="report" data-testid="tab-report">
              Executive Report
            </TabsTrigger>
            <TabsTrigger value="chat" data-testid="tab-chat">
              Ask Questions
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-8 animate-fade-in">
            {/* Summary */}
            <Card className="glass border-border">
              <CardHeader>
                <CardTitle className="text-lg font-heading text-white flex items-center gap-2">
                  <FileText className="w-5 h-5 text-primary" />
                  Quick Summary
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground leading-relaxed whitespace-pre-line">
                  {analysis.summary}
                </p>
              </CardContent>
            </Card>

            {/* Key Metrics */}
            <div>
              <h2 className="text-lg font-heading font-bold text-white mb-4">
                Key Metrics
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 stagger-children">
                {analysis.key_metrics?.map((metric, index) => (
                  <MetricCard key={index} metric={metric} index={index} />
                ))}
              </div>
            </div>

            {/* Problems & Recommendations */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Problems */}
              <Card className="glass border-border">
                <CardHeader>
                  <CardTitle className="text-lg font-heading text-white flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-orange-500" />
                    Issues Identified
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-3">
                    {analysis.problems?.length > 0 ? (
                      analysis.problems.map((problem, index) => (
                        <li
                          key={index}
                          className="flex items-start gap-3 text-muted-foreground"
                          data-testid={`problem-${index}`}
                        >
                          <span className="w-6 h-6 rounded-full bg-orange-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                            <span className="text-xs text-orange-500 font-bold">
                              {index + 1}
                            </span>
                          </span>
                          <span>{problem}</span>
                        </li>
                      ))
                    ) : (
                      <li className="text-muted-foreground">
                        No significant issues found
                      </li>
                    )}
                  </ul>
                </CardContent>
              </Card>

              {/* Recommendations */}
              <Card className="glass border-border">
                <CardHeader>
                  <CardTitle className="text-lg font-heading text-white flex items-center gap-2">
                    <Lightbulb className="w-5 h-5 text-yellow-500" />
                    Recommendations
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-3">
                    {analysis.recommendations?.length > 0 ? (
                      analysis.recommendations.map((rec, index) => (
                        <li
                          key={index}
                          className="flex items-start gap-3 text-muted-foreground"
                          data-testid={`recommendation-${index}`}
                        >
                          <span className="w-6 h-6 rounded-full bg-yellow-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                            <span className="text-xs text-yellow-500 font-bold">
                              {index + 1}
                            </span>
                          </span>
                          <span>{rec}</span>
                        </li>
                      ))
                    ) : (
                      <li className="text-muted-foreground">
                        No recommendations available
                      </li>
                    )}
                  </ul>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Visualizations Tab */}
          <TabsContent value="visualizations" className="animate-fade-in">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 stagger-children">
              {analysis.visualizations?.length > 0 ? (
                analysis.visualizations.map((viz, index) => (
                  <ChartCard key={index} visualization={viz} index={index} />
                ))
              ) : (
                <Card className="glass border-border col-span-2">
                  <CardContent className="py-12 text-center">
                    <BarChart3 className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">
                      No visualizations available for this analysis
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          {/* Executive Report Tab */}
          <TabsContent value="report" className="animate-fade-in">
            <Card className="glass border-border">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg font-heading text-white flex items-center gap-2">
                    <FileText className="w-5 h-5 text-primary" />
                    Executive Report
                  </CardTitle>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleDownloadReport}
                    className="border-border text-white hover:bg-white/5"
                    data-testid="download-report-inline"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Download
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="prose prose-invert max-w-none">
                  <div className="whitespace-pre-line text-muted-foreground leading-relaxed">
                    {analysis.executive_report}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Chat Tab */}
          <TabsContent value="chat" className="animate-fade-in">
            <Card className="glass border-border h-[600px] flex flex-col">
              <CardHeader className="border-b border-border">
                <CardTitle className="text-lg font-heading text-white flex items-center gap-2">
                  <MessageSquare className="w-5 h-5 text-primary" />
                  Ask Questions About Your Data
                </CardTitle>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col p-0">
                <ScrollArea className="flex-1 p-4">
                  <div className="space-y-4">
                    {chatHistory.length === 0 ? (
                      <div className="text-center py-12">
                        <MessageSquare className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                        <p className="text-muted-foreground">
                          Ask any question about your data and analysis
                        </p>
                        <div className="mt-4 flex flex-wrap gap-2 justify-center">
                          {[
                            "What are the main trends?",
                            "How can I improve performance?",
                            "What should I focus on?",
                          ].map((suggestion, i) => (
                            <Button
                              key={i}
                              variant="outline"
                              size="sm"
                              className="border-border text-muted-foreground hover:text-white hover:bg-white/5"
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
                          {/* User message */}
                          <div className="flex justify-end">
                            <div
                              className="max-w-[80%] bg-primary/20 border border-primary/30 rounded-xl px-4 py-3"
                              data-testid={`user-message-${index}`}
                            >
                              <p className="text-white text-sm">
                                {chat.user_message}
                              </p>
                            </div>
                          </div>
                          {/* AI response */}
                          {chat.ai_response && (
                            <div className="flex justify-start">
                              <div
                                className="max-w-[80%] bg-card border border-border rounded-xl px-4 py-3"
                                data-testid={`ai-response-${index}`}
                              >
                                <div className="flex items-center gap-2 mb-2">
                                  <Sparkles className="w-4 h-4 text-primary" />
                                  <span className="text-xs text-primary font-medium">
                                    rravin
                                  </span>
                                </div>
                                <p className="text-muted-foreground text-sm whitespace-pre-line">
                                  {chat.ai_response}
                                </p>
                              </div>
                            </div>
                          )}
                          {chat.pending && !chat.ai_response && (
                            <div className="flex justify-start">
                              <div className="bg-card border border-border rounded-xl px-4 py-3">
                                <div className="flex items-center gap-2">
                                  <div className="spinner" />
                                  <span className="text-xs text-muted-foreground">
                                    Thinking...
                                  </span>
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

                {/* Chat Input */}
                <div className="border-t border-border p-4">
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
                      className="flex-1 bg-secondary border-border text-white placeholder:text-muted-foreground"
                      disabled={sendingMessage}
                      data-testid="chat-input"
                    />
                    <Button
                      type="submit"
                      disabled={!chatMessage.trim() || sendingMessage}
                      className="bg-primary hover:bg-primary/90"
                      data-testid="chat-send-btn"
                    >
                      <Send className="w-4 h-4" />
                    </Button>
                  </form>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
