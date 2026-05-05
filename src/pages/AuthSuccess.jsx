import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

const AuthSuccess = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const accessToken = searchParams.get("access_token");
    const refreshToken = searchParams.get("refresh_token");

    if (accessToken) localStorage.setItem("access_token", accessToken);
    if (refreshToken) localStorage.setItem("refresh_token", refreshToken);

    setTimeout(() => navigate("/dashboard"), 500);
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
