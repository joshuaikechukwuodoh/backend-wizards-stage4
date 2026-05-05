import { useState, useEffect } from "react";
import axios from "axios";
import { useAuth } from "../hooks/useAuth";

const API_URL = "https://backend-wizards-stage3.vercel.app";

const Dashboard = () => {
  const { user, logout } = useAuth();
  const [profiles, setProfiles] = useState([]);
  const [pagination, setPagination] = useState({});
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState({ gender: "", country_id: "", age_group: "" });
  const [page, setPage] = useState(1);
  const [error, setError] = useState("");

  const authHeaders = () => {
    const token = localStorage.getItem("access_token");
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  const fetchProfiles = async (pageNum = 1) => {
    setLoading(true);
    setError("");
    try {
      let res;
      if (search.trim()) {
        res = await axios.get(`${API_URL}/api/v1/profiles/search`, {
          params: { q: search, page: pageNum, limit: 10 },
          headers: authHeaders(),
        });
      } else {
        res = await axios.get(`${API_URL}/api/v1/profiles`, {
          params: { ...filters, page: pageNum, limit: 10 },
          headers: authHeaders(),
        });
      }
      setProfiles(res.data.data);
      setPagination(res.data.metadata || {});
      setPage(pageNum);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to fetch profiles");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfiles(1);
  }, []);

  const handleExport = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/v1/profiles/export`, {
        params: filters,
        headers: authHeaders(),
        responseType: "blob",
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", "profiles_export.csv");
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch {
      alert("Export failed. Please try again.");
    }
  };

  const styles = {
    container: { minHeight: "100vh", background: "#0f0f0f", color: "white", fontFamily: "sans-serif" },
    header: { background: "#1a1a1a", borderBottom: "1px solid #333", padding: "16px 32px", display: "flex", justifyContent: "space-between", alignItems: "center" },
    main: { padding: "32px" },
    card: { background: "#1a1a1a", border: "1px solid #333", borderRadius: "12px", padding: "24px", marginBottom: "24px" },
    input: { background: "#0f0f0f", border: "1px solid #444", color: "white", padding: "10px 14px", borderRadius: "8px", fontSize: "14px", outline: "none" },
    button: { padding: "10px 20px", borderRadius: "8px", border: "none", cursor: "pointer", fontSize: "14px", fontWeight: "600" },
    table: { width: "100%", borderCollapse: "collapse" },
    th: { textAlign: "left", padding: "12px", borderBottom: "1px solid #333", color: "#888", fontSize: "12px", textTransform: "uppercase" },
    td: { padding: "12px", borderBottom: "1px solid #222", fontSize: "14px" },
  };

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div>
          <h1 style={{ margin: 0, fontSize: "20px" }}>Insighta Labs+</h1>
          <p style={{ margin: 0, color: "#888", fontSize: "13px" }}>Profile Intelligence System</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <span style={{ color: "#888", fontSize: "14px" }}>
            👤 {user?.username}
            <span style={{
              marginLeft: "8px", background: user?.role === "admin" ? "#1a3a1a" : "#1a1a3a",
              color: user?.role === "admin" ? "#4caf50" : "#64b5f6",
              padding: "2px 8px", borderRadius: "4px", fontSize: "11px"
            }}>
              {user?.role}
            </span>
          </span>
          <button onClick={logout} style={{ ...styles.button, background: "#333", color: "white" }}>
            Logout
          </button>
        </div>
      </div>

      <div style={styles.main}>
        {/* Search & Filter Card */}
        <div style={styles.card}>
          <h3 style={{ margin: "0 0 16px 0" }}>Search Profiles</h3>
          <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
            <input
              style={{ ...styles.input, flex: 1, minWidth: "200px" }}
              placeholder='Natural language: "young females in Nigeria"'
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && fetchProfiles(1)}
            />
            <select
              style={{ ...styles.input }}
              value={filters.gender}
              onChange={(e) => setFilters({ ...filters, gender: e.target.value })}
            >
              <option value="">All Genders</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
            </select>
            <select
              style={{ ...styles.input }}
              value={filters.age_group}
              onChange={(e) => setFilters({ ...filters, age_group: e.target.value })}
            >
              <option value="">All Ages</option>
              <option value="child">Child</option>
              <option value="teenager">Teenager</option>
              <option value="adult">Adult</option>
              <option value="senior">Senior</option>
            </select>
            <input
              style={{ ...styles.input, width: "100px" }}
              placeholder="Country e.g NG"
              value={filters.country_id}
              onChange={(e) => setFilters({ ...filters, country_id: e.target.value })}
            />
            <button
              onClick={() => fetchProfiles(1)}
              style={{ ...styles.button, background: "#238636", color: "white" }}
            >
              Search
            </button>
            <button
              onClick={handleExport}
              style={{ ...styles.button, background: "#1a3a5c", color: "white" }}
            >
              Export CSV
            </button>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div style={{ background: "#3a1a1a", border: "1px solid #f44336", borderRadius: "8px", padding: "12px 16px", marginBottom: "16px", color: "#f44336" }}>
            ❌ {error}
          </div>
        )}

        {/* Profiles Table */}
        <div style={styles.card}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
            <h3 style={{ margin: 0 }}>
              Profiles {pagination.total_count ? `(${pagination.total_count} total)` : ""}
            </h3>
            {loading && <span style={{ color: "#888" }}>Loading...</span>}
          </div>

          <div style={{ overflowX: "auto" }}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Name</th>
                  <th style={styles.th}>Gender</th>
                  <th style={styles.th}>Age</th>
                  <th style={styles.th}>Age Group</th>
                  <th style={styles.th}>Country</th>
                </tr>
              </thead>
              <tbody>
                {profiles.map((p) => (
                  <tr key={p.id} style={{ transition: "background 0.2s" }}
                    onMouseEnter={(e) => e.currentTarget.style.background = "#222"}
                    onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                  >
                    <td style={styles.td}>{p.name}</td>
                    <td style={styles.td}>
                      <span style={{ color: p.gender === "female" ? "#f48fb1" : "#64b5f6" }}>
                        {p.gender}
                      </span>
                    </td>
                    <td style={styles.td}>{p.age}</td>
                    <td style={styles.td}>{p.age_group}</td>
                    <td style={styles.td}>{p.country_name} ({p.country_id})</td>
                  </tr>
                ))}
                {profiles.length === 0 && !loading && (
                  <tr>
                    <td colSpan="5" style={{ ...styles.td, textAlign: "center", color: "#888" }}>
                      No profiles found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {pagination.total_pages > 1 && (
            <div style={{ display: "flex", justifyContent: "center", gap: "8px", marginTop: "24px" }}>
              <button
                onClick={() => fetchProfiles(page - 1)}
                disabled={page <= 1}
                style={{ ...styles.button, background: page > 1 ? "#333" : "#222", color: page > 1 ? "white" : "#555" }}
              >
                ← Prev
              </button>
              <span style={{ padding: "10px 16px", color: "#888" }}>
                Page {pagination.page} of {pagination.total_pages}
              </span>
              <button
                onClick={() => fetchProfiles(page + 1)}
                disabled={!pagination.has_more}
                style={{ ...styles.button, background: pagination.has_more ? "#333" : "#222", color: pagination.has_more ? "white" : "#555" }}
              >
                Next →
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;