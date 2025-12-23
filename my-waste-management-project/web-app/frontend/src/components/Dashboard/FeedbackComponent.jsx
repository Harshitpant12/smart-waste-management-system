import React, { useEffect, useState, useCallback } from "react";
import axios from "axios";
import { io } from "socket.io-client";

const BACKEND = process.env.REACT_APP_BACKEND || "http://localhost:1337";

export default function FeedbackComponent() {
  const [feedback, setFeedback] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [toast, setToast] = useState(null);

  const fetchFeedback = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Try relative path (works with CRA dev proxy), fallback to BACKEND
      let res;
      try {
        res = await axios.get("/api/feedback");
      } catch (e) {
        res = await axios.get(`${BACKEND}/api/feedback`);
      }
      if (Array.isArray(res.data)) setFeedback(res.data);
      else setFeedback([]);
    } catch (err) {
      console.error("Error fetching feedback:", err);
      setError("Failed to load feedback");
      setFeedback([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    fetchFeedback();

    const socket = io(BACKEND, { transports: ["websocket", "polling"] });
    socket.on("connect", () => console.log("Feedback socket connected", socket.id));
    socket.on("feedback:created", (doc) => {
      if (!mounted) return;
      setFeedback((prev) => [doc, ...prev]);
      setToast("New feedback received");
      setTimeout(() => setToast(null), 3500);
    });

    socket.on("connect_error", (err) => console.warn("Feedback socket connect_error", err && err.message));
    socket.on('feedback:deleted', ({ id }) => {
      if (!mounted) return;
      setFeedback((prev) => (prev || []).filter((f) => f._id !== id));
    });

    return () => {
      mounted = false;
      try {
        socket.off("feedback:created");
        socket.off("feedback:deleted");
        socket.close();
      } catch (e) {}
    };
  }, [fetchFeedback]);

  const formatDateFromId = (id) => {
    try {
      // ObjectId first 8 chars are timestamp in hex
      const ts = parseInt(id.substring(0, 8), 16) * 1000;
      return new Date(ts).toLocaleString();
    } catch (e) {
      return "";
    }
  };

  return (
    <div style={styles.feedbackContainer}>
      <div style={styles.headerRow}>
        <h2 style={styles.header}>User Feedback</h2>
        <div>
          <button style={styles.refreshBtn} onClick={fetchFeedback}>
            Refresh
          </button>
        </div>
      </div>

      {toast && <div style={styles.toast}>{toast}</div>}

      {loading ? (
        <div style={styles.center}>Loading...</div>
      ) : error ? (
        <div style={{ ...styles.center, color: "red" }}>{error}</div>
      ) : feedback.length === 0 ? (
        <div style={styles.center}>No feedback available</div>
      ) : (
        <div>
          {feedback.map((item) => (
            <div key={item._id} style={styles.feedbackItem}>
              <div style={styles.metaRow}>
                <div>
                  <strong style={styles.name}>{item.name}</strong>
                  <span style={styles.title}> — {item.title}</span>
                </div>
                <div style={styles.metaRight}>
                  <span style={styles.time}>{formatDateFromId(item._id)}</span>
                  <button
                    style={styles.deleteBtn}
                    onClick={async () => {
                      // use explicit window.confirm to avoid eslint no-restricted-globals
                      const shouldDelete = window.confirm('Delete this feedback?');
                      if (!shouldDelete) return;
                      try {
                        // try relative delete first
                        try {
                          await axios.delete(`/api/feedback/${item._id}`);
                        } catch (e) {
                          await axios.delete(`${BACKEND}/api/feedback/${item._id}`);
                        }
                        // remove locally
                        setFeedback((prev) => prev.filter((f) => f._id !== item._id));
                      } catch (err) {
                        console.error('Failed to delete feedback', err);
                        alert('Failed to delete feedback');
                      }
                    }}
                    title="Delete"
                  >
                    Delete
                  </button>
                </div>
              </div>

              {item.photoUrl ? (
                <div style={{ marginBottom: '8px', display: 'flex', justifyContent: 'center' }}>
                  {(() => {
                    const src = (item.photoUrl && item.photoUrl.startsWith('http'))
                      ? item.photoUrl
                      : (item.photoUrl && item.photoUrl.startsWith('/uploads/'))
                        ? `${BACKEND}${item.photoUrl}`
                        : (item.photoUrl || '');
                    return (
                      <a href={src} target="_blank" rel="noreferrer">
                        <img src={src} alt="feedback" style={styles.thumbnail} />
                      </a>
                    );
                  })()}
                </div>
              ) : null}

              <p style={styles.feedbackText}>{item.feedback}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const styles = {
  feedbackContainer: {
    maxWidth: "700px",
    margin: "50px auto",
    padding: "20px",
    backgroundColor: "#f7f9fb",
    borderRadius: "8px",
    boxShadow: "0 4px 10px rgba(0,0,0,0.06)",
  },
  headerRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "10px",
  },
  header: {
    margin: 0,
    color: "#20476b",
  },
  refreshBtn: {
    background: "teal",
    color: "white",
    border: "none",
    padding: "8px 12px",
    borderRadius: "6px",
    cursor: "pointer",
  },
  toast: {
    background: "#e6ffed",
    color: "#065f46",
    padding: "8px 12px",
    borderRadius: "6px",
    marginBottom: "12px",
    textAlign: "center",
  },
  center: { textAlign: "center", padding: "20px", color: "#666" },
  feedbackItem: {
    backgroundColor: "#fff",
    border: "1px solid #e6eef5",
    padding: "14px",
    marginBottom: "12px",
    borderRadius: "6px",
  },
  metaRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "8px",
  },
  name: { color: "#1f4b6b" },
  title: { color: "#6b7280", marginLeft: "8px" },
  time: { color: "#9aa4ae", fontSize: "12px", marginRight: "8px" },
  feedbackText: { margin: 0, color: "#333" },
  thumbnail: { maxWidth: '300px', height: 'auto', borderRadius: '6px', display: 'block' },
  metaRight: { display: 'flex', alignItems: 'center', gap: '8px' },
  deleteBtn: { background: '#ff4d4f', color: '#fff', border: 'none', padding: '6px 8px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px' },
};
