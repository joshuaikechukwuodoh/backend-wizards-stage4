import { Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import AuthSuccess from "./pages/AuthSuccess";
import { useAuth } from "./hooks/useAuth";

function App() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh", background: "#0f0f0f", color: "white" }}>
        Loading...
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/" element={user ? <Navigate to="/dashboard" /> : <Navigate to="/login" />} />
      <Route path="/login" element={!user ? <Login /> : <Navigate to="/dashboard" />} />
      <Route path="/auth/success" element={<AuthSuccess />} />
      <Route path="/dashboard" element={user ? <Dashboard /> : <Navigate to="/login" />} />
    </Routes>
  );
}

export default App;