// File: src/components/ScheduleComponent.jsx
import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import "bootstrap/dist/css/bootstrap.min.css";
import "./schedule.css";
import { io } from "socket.io-client";

const BACKEND = "http://localhost:1337";
const SOCKET = io(BACKEND, { transports: ["websocket", "polling"] });

function normalizeMqtt(data) {
  if (!data) return null;
  const filled = data.filledLevel ?? data.filled_level ?? data.filled_level_percent ?? null;
  return {
    ...data,
    filledLevel: typeof filled === "string" ? Number(filled) : filled,
    filled_level: typeof filled === "string" ? Number(filled) : filled,
  };
}

function ScheduleComponent() {
  const [location, setLocation] = useState("Pithoragarh");
  const [workingHours, setWorkingHours] = useState({ start: 8, end: 17 });
  const [collectors, setCollectors] = useState([]);
  const [selectedCollector, setSelectedCollector] = useState("");
  const [responseMessage, setResponseMessage] = useState("");
  const [schedule, setSchedule] = useState(null);
  const [mqttData, setMqttData] = useState(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    fetchCollectors();
    fetchSchedule();
    fetchInitialMqtt();

    SOCKET.on("mqttData", (data) => {
      const normalized = normalizeMqtt(data);
      if (mountedRef.current) setMqttData(normalized);
    });

    const poll = setInterval(() => {
      // fallback polling in case socket misses something
      fetchMqtt();
    }, 10000);

    return () => {
      mountedRef.current = false;
      clearInterval(poll);
      try {
        SOCKET.off("mqttData");
      } catch (e) {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchCollectors = async () => {
    try {
      const response = await fetch(`${BACKEND}/api/collector-details`);
      if (!response.ok) throw new Error("Failed to fetch collectors");
      const CollectorData = await response.json();
      if (mountedRef.current) setCollectors(CollectorData.collectors ?? []);
    } catch (error) {
      console.error("Error fetching collectors:", error);
    }
  };

  const fetchSchedule = async () => {
    try {
      const response = await axios.get(`${BACKEND}/api/scheduleCollection`);
      if (mountedRef.current) setSchedule(response.data ?? []);
    } catch (error) {
      console.error("Error fetching schedule:", error);
    }
  };

  const fetchInitialMqtt = async () => {
    try {
      const res = await fetch(`${BACKEND}/api/iot/subscribe`);
      if (!res.ok) throw new Error("no mqtt");
      const data = await res.json();
      const normalized = normalizeMqtt(data);
      if (mountedRef.current) setMqttData(normalized);
    } catch (err) {
      // ignore, socket or polling will update when available
    }
  };

    const fetchMqtt = async () => {
      try {
        const response = await fetch(`${BACKEND}/api/iot/subscribe`);
        if (!response.ok) return null;
        const data = await response.json();
        const normalized = normalizeMqtt(data);
        if (mountedRef.current) setMqttData(normalized);
        return normalized;
      } catch (err) {
        return null;
      }
    };

  const checkAnyBinAboveThreshold = async (threshold = 30) => {
    try {
      // try to get all bins and check any value > threshold
      const res = await fetch(`${BACKEND}/api/iot/bins`);
      if (!res.ok) return false;
      const data = await res.json();
      if (!Array.isArray(data)) return false;
      return data.some((b) => (b.filled_level ?? b.filledLevel ?? 0) > threshold);
    } catch (err) {
      return false;
    }
  };

  const handleScheduleTrip = async () => {
    setResponseMessage("");
    try {
      // prefer latest mqttData (single latest bin), but also check all bins as fallback
      const latest = mqttData ?? (await fetchMqtt());
      const filledSingle = latest?.filledLevel ?? latest?.filled_level ?? 0;

      let allow = false;
      if (filledSingle > 30) allow = true;
      else {
        const any = await checkAnyBinAboveThreshold(30);
        if (any) allow = true;
      }

      if (!allow) {
        setResponseMessage("Cannot schedule trip: Bins are not filled (threshold 30%).");
        return;
      }

      const response = await axios.post(`${BACKEND}/api/scheduleCollection`, {
        location,
        workingHours,
        collectorID: selectedCollector,
      });
      setResponseMessage(response.data?.message ?? "Scheduled successfully");
      await fetchSchedule();
    } catch (error) {
      console.error("Error scheduling collection trip:", error);
      setResponseMessage("Error scheduling collection trip.");
    }
  };

  return (
    <div>
      <div className="container">
        <br />
        <br />
        <label className="label">
          Location:
          <input
            type="text"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            className="input"
          />
        </label>
        <br />
        <label className="label">
          Working Hours:
          <input
            type="number"
            max={23}
            min={0}
            value={workingHours.start}
            onChange={(e) =>
              setWorkingHours({
                ...workingHours,
                start: parseInt(e.target.value || 0, 10),
              })
            }
            className="input"
          />
          -
          <input
            type="number"
            max={23}
            min={0}
            value={workingHours.end}
            onChange={(e) =>
              setWorkingHours({
                ...workingHours,
                end: parseInt(e.target.value || 0, 10),
              })
            }
            className="input"
          />
        </label>
        <br />
        <label className="label">
          Select Collector:
          <select
            value={selectedCollector}
            onChange={(e) => setSelectedCollector(e.target.value)}
            className="input"
          >
            <option value="" disabled>
              -- Select Collector --
            </option>
            {collectors.map((collector) => (
              <option key={collector._id} value={collector._id}>
                {collector.name}
              </option>
            ))}
          </select>
        </label>
        <br />
        <button onClick={handleScheduleTrip} className="btn btn-primary">
          Generate Schedule
        </button>
        <p className="response">{responseMessage}</p>
      </div>

      {schedule && (
        <div className="schedule-table">
          <h2 className="title">Scheduled Table</h2>
          <table className="table table-bordered table-striped">
            <thead className="thead-dark">
              <tr>
                <th>Date</th>
                <th>Collector ID</th>
              </tr>
            </thead>
            <tbody>
              {schedule.map((entry) => (
                <tr key={entry._id}>
                  <td>{entry.date}</td>
                  <td>{entry.collectorID}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default ScheduleComponent;
