import { useState, useEffect } from "react";
import axios from "axios";

const API_URL = "https://backend-wizards-stage3.vercel.app";

export const useAuth = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUser = async () => {
      const token = localStorage.getItem("access_token");
      if (!token) {
        setLoading(false);
        return;
      }
      try {
        const res = await axios.get(`${API_URL}/api/v1/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setUser(res.data.user);
      } catch {
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    fetchUser();
  }, []);

  const logout = async () => {
    const refreshToken = localStorage.getItem("refresh_token");
    try {
      await axios.post(
        `${API_URL}/api/v1/auth/logout`,
        { refresh_token: refreshToken },
        { headers: { Authorization: `Bearer ${localStorage.getItem("access_token")}` } }
      );
    } catch {
      // ignore
    }
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    setUser(null);
    window.location.href = "/login";
  };

  return { user, loading, logout };
};
