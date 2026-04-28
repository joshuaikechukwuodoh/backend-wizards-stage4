import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

const AuthSuccess = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const role = searchParams.get("role");
    // Small delay so cookies are set before we navigate
    setTimeout(() => {
      navigate("/dashboard");
    }, 1000);
  }, []);

  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      height: "100vh",
      background: "#0f0f0f",
      color: "white",
      fontFamily: "sans-serif",
    }}>
      <div style={{
        background: "#1a1a1a",
        padding: "48px",
        borderRadius: "16px",
        border: "1px solid #333",
        textAlign: "center",
      }}>
        <div style={{ fontSize: "48px", marginBottom: "16px" }}>✅</div>
        <h2 style={{ marginBottom: "8px" }}>Login Successful!</h2>
        <p style={{ color: "#888" }}>Redirecting to your dashboard...</p>
      </div>
    </div>
  );
};

export default AuthSuccess;