import { useState, useEffect } from "react";
import axios from "axios";

const API_URL = "http://localhost:3000";

export const useAuth = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const res = await axios.get(`${API_URL}/api/v1/auth/me`, {
          withCredentials: true,
        });
        setUser(res.data.data);
      } catch {
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    fetchUser();
  }, []);

  const logout = async () => {
    try {
      await axios.post(
        `${API_URL}/api/v1/auth/logout`,
        {},
        { withCredentials: true }
      );
    } catch {
      // ignore
    }
    setUser(null);
    window.location.href = "/login";
  };

  return { user, loading, logout };
};