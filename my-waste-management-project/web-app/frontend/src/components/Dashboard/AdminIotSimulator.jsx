import React, { useEffect, useState, useRef } from "react";
import { io } from "socket.io-client";
import axios from "axios";
import "bootstrap/dist/css/bootstrap.min.css";
import "./schedule.css";
const SOCKET = io("http://localhost:1337", { transports: ["websocket", "polling"] });

export default function AdminIotSimulator() {
  const [bins, setBins] = useState([]);
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState(null);
  const [message, setMessage] = useState("");
  const workingBaseRef = useRef(null);
  const mountedRef = useRef(true);
  const pollRef = useRef(null);

  // Candidate base endpoints (in order of preference)
  const baseCandidates = [
    "http://localhost:1337/api/iot", // local with /api prefix
    "http://localhost:1337/iot", // local without /api prefix
    "/api/iot", // common when frontend proxy is used
    "/iot", // alternative mount
  ];

  // low-level request that finds a working base if needed
  const tryRequest = async (method, path, data = null) => {
    // if we've already found a working base, try it first
    if (workingBaseRef.current) {
      try {
        const url = `${workingBaseRef.current}${path}`;
        return await axios({ method, url, data, timeout: 8000 });
      } catch (err) {
        // clear working base and fall through to try others
        workingBaseRef.current = null;
      }
    }

    // try each candidate until one succeeds
    for (let base of baseCandidates) {
      try {
        const url = `${base}${path}`;
        const res = await axios({ method, url, data, timeout: 8000 });
        workingBaseRef.current = base;
        return res;
      } catch (err) {
        // continue trying next base
      }
    }

    // if none succeeded, throw
    throw new Error("All endpoints failed");
  };

  // fetch bins (GET /bins)
  const fetchBinsOnce = async () => {
    if (!mountedRef.current) return;
    setLoading(true);
    setMessage("");
    try {
      const res = await tryRequest("get", "/bins");
      const data = res.data;
      if (Array.isArray(data) && data.length > 0) {
        if (mountedRef.current) setBins(data);
      } else {
        // backend returned empty array -> show fallback sample
        if (mountedRef.current)
          setBins([
            { id: "Bin_001", filled_level: 12, temperature: 25, latitude: 29.0, longitude: 80.0 },
            { id: "Bin_002", filled_level: 45, temperature: 27, latitude: 29.01, longitude: 80.01 },
          ]);
      }
      // success message only if previously had error
      if (mountedRef.current) setMessage("");
      return true;
    } catch (err) {
      if (mountedRef.current) {
        setBins([
          { id: "Bin_001", filled_level: 12, temperature: 25, latitude: 29.0, longitude: 80.0 },
          { id: "Bin_002", filled_level: 45, temperature: 27, latitude: 29.01, longitude: 80.01 },
        ]);
        setMessage("Unable to reach backend; using sample data. Check backend or CORS/proxy.");
      }
      return false;
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  };

  // start polling only after initial successful fetch to avoid rapid noise
  const startPolling = () => {
    // clear any existing
    if (pollRef.current) clearInterval(pollRef.current);
    // poll every 10 seconds (gentler)
    pollRef.current = setInterval(() => {
      fetchBinsOnce();
    }, 10000);
  };

  // initial mount
  useEffect(() => {
    mountedRef.current = true;

    // perform initial fetch; if successful, start polling immediately.
    (async () => {
      const ok = await fetchBinsOnce();
      if (ok) startPolling();
      else {
        // if initial fetch failed, still attempt to poll but with longer backoff
        pollRef.current = setInterval(() => {
          // try again to discover endpoint (every 20s when offline)
          fetchBinsOnce().then((v) => {
            if (v) {
              // if succeeded, switch to 10s polling
              if (pollRef.current) clearInterval(pollRef.current);
              startPolling();
            }
          });
        }, 20000);
      }
    })();

    return () => {
      mountedRef.current = false;
      if (pollRef.current) clearInterval(pollRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleChange = (id, field, value) => {
    setBins((prev) =>
      prev.map((b) =>
        b.id === id
          ? {
              ...b,
              [field]:
                field === "filled_level" || field === "temperature" || field === "latitude" || field === "longitude"
                  ? Number(value)
                  : value,
            }
          : b
      )
    );
  };

  // SAVE -> PUT /bins/:id
  const saveBin = async (id) => {
    const bin = bins.find((b) => b.id === id);
    if (!bin) return;
    setSavingId(id);
    setMessage("");
    try {
      const payload = {
        filled_level: Number(bin.filled_level),
        temperature: Number(bin.temperature),
        latitude: Number(bin.latitude),
        longitude: Number(bin.longitude),
      };
      // IMPORTANT: include /bins prefix
      const res = await tryRequest("put", `/bins/${encodeURIComponent(id)}`, payload);
      console.log('saveBin - response', res && res.data);
      if (mountedRef.current) setBins((prev) => prev.map((b) => (b.id === id ? res.data : b)));
      if (mountedRef.current) setMessage(`Saved ${id}`);
      // Fallback: notify server over socket to broadcast mqttData to clients (in case server didn't emit)
      try { SOCKET.emit('client:binUpdated', res.data); } catch (e) {}
      // if this was first successful backend call, ensure polling is running
      if (workingBaseRef.current && (!pollRef.current || pollRef.current._idleTimeout === undefined)) {
        startPolling();
      }
    } catch (err) {
      console.error('saveBin - error', err && err.response ? err.response.data : err);
      if (mountedRef.current) setMessage(`Failed to save ${id}.`);
    } finally {
      if (mountedRef.current) setSavingId(null);
    }
  };

  // Note: Simulate endpoint still exists on the backend but the UI button is removed.
  // If you want to call it programmatically, you can call `POST /api/iot/bins/:id/simulate`.

  return (
    <div className="container my-4">
      <h3 className="mb-3">IoT / Hardware Simulator</h3>

      {message && (
        <div className="alert alert-info py-2" role="alert">
          {message}
        </div>
      )}

      {loading ? (
        <div>Loading bins...</div>
      ) : (
        <div className="table-responsive">
          <table className="table table-sm table-bordered align-middle">
            <thead className="table-light">
              <tr>
                <th>Bin ID</th>
                <th style={{ minWidth: 120 }}>Filled Level (%)</th>
                <th>Temperature (°C)</th>
                <th>Latitude</th>
                <th>Longitude</th>
                <th style={{ minWidth: 220 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {bins.map((bin) => (
                <tr key={bin.id}>
                  <td style={{ verticalAlign: "middle" }}>{bin.id}</td>

                  <td>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      className="form-control form-control-sm"
                      value={bin.filled_level}
                      onChange={(e) => handleChange(bin.id, "filled_level", e.target.value)}
                    />
                  </td>

                  <td>
                    <input
                      type="number"
                      className="form-control form-control-sm"
                      value={bin.temperature}
                      onChange={(e) => handleChange(bin.id, "temperature", e.target.value)}
                    />
                  </td>

                  <td>
                    <input
                      type="number"
                      step="0.000001"
                      className="form-control form-control-sm"
                      value={bin.latitude}
                      onChange={(e) => handleChange(bin.id, "latitude", e.target.value)}
                    />
                  </td>

                  <td>
                    <input
                      type="number"
                      step="0.000001"
                      className="form-control form-control-sm"
                      value={bin.longitude}
                      onChange={(e) => handleChange(bin.id, "longitude", e.target.value)}
                    />
                  </td>

                  <td>
                    <div className="d-flex gap-2">
                      <button
                        className="btn btn-sm btn-primary"
                        onClick={() => saveBin(bin.id)}
                        disabled={savingId === bin.id}
                      >
                        {savingId === bin.id ? "Saving..." : "Save"}
                      </button>

                      {/* Simulate button removed by request: keep endpoint but hide UI */}

                      <button
                        className="btn btn-sm btn-outline-secondary"
                        onClick={() =>
                          setBins((prev) =>
                            prev.map((b) =>
                              b.id === bin.id ? { ...b, filled_level: Math.min(100, b.filled_level + 10) } : b
                            )
                          )
                        }
                        title="Quick +10% filled (local only)"
                      >
                        +10%
                      </button>

                      <button
                        className="btn btn-sm btn-outline-secondary"
                        onClick={() =>
                          setBins((prev) =>
                            prev.map((b) =>
                              b.id === bin.id ? { ...b, filled_level: Math.max(0, b.filled_level - 10) } : b
                            )
                          )
                        }
                        title="Quick -10% filled (local only)"
                      >
                        -10%
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {bins.length === 0 && (
                <tr>
                  <td colSpan="6" className="text-center py-4">
                    No bins available
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
