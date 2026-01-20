import { useEffect, useState, useCallback } from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route, useNavigate } from "react-router-dom";
import axios from "axios";
import { Toaster, toast } from "sonner";

// Components
import Landing from "./pages/Landing";
import Dashboard from "./pages/Dashboard";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

// Session context
export const useSession = () => {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  const initSession = useCallback(async () => {
    try {
      const storedSessionId = localStorage.getItem("rravin_session_id");
      const response = await axios.post(`${API}/sessions`, {
        session_id: storedSessionId || null,
      });
      setSession(response.data);
      localStorage.setItem("rravin_session_id", response.data.session_id);
    } catch (error) {
      console.error("Session error:", error);
      toast.error("Failed to initialize session");
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshSession = useCallback(async () => {
    if (!session?.session_id) return;
    try {
      const response = await axios.get(`${API}/sessions/${session.session_id}`);
      setSession(response.data);
    } catch (error) {
      console.error("Refresh error:", error);
    }
  }, [session?.session_id]);

  const resetSession = useCallback(async () => {
    if (session?.session_id) {
      try {
        await axios.delete(`${API}/sessions/${session.session_id}`);
      } catch (error) {
        console.error("Delete error:", error);
      }
    }
    localStorage.removeItem("rravin_session_id");
    setSession(null);
    await initSession();
  }, [session?.session_id, initSession]);

  useEffect(() => {
    initSession();
  }, [initSession]);

  return { session, loading, refreshSession, resetSession, setSession };
};

function App() {
  return (
    <div className="min-h-screen bg-background">
      <div className="noise-overlay" />
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: "#0A0A0A",
            border: "1px solid rgba(255,255,255,0.1)",
            color: "#fff",
          },
        }}
      />
    </div>
  );
}

function AppRoutes() {
  const sessionData = useSession();

  return (
    <Routes>
      <Route path="/" element={<Landing {...sessionData} />} />
      <Route path="/dashboard" element={<Dashboard {...sessionData} />} />
    </Routes>
  );
}

export default App;
