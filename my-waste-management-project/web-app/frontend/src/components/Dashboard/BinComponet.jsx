import React, { useState, useEffect, useRef } from "react";
import { io } from "socket.io-client";
import "bootstrap/dist/css/bootstrap.min.css"; // Import Bootstrap CSS

const BACKEND = "http://localhost:1337";
const SOCKET = io(BACKEND, { transports: ["websocket", "polling"] });

const BinComponent = () => {
  const [binId, setBinId] = useState("");
  const [area, setArea] = useState("");
  const [height, setHeight] = useState("");
  const [bins, setBins] = useState([]);
  const mountedRef = useRef(true);

  const handleSubmit = async (event) => {
    event.preventDefault();

    const binData = {
      binId,
      area,
      height,
    };

    try {
      const response = await fetch(`${BACKEND}/api/bins`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(binData),
      });

      if (response.ok) {
        const newBin = await response.json();
        const normalized = {
          _id: newBin._id ?? newBin.id,
          id: newBin.binId ?? newBin.id ?? newBin._id,
          binId: newBin.binId ?? newBin.id ?? newBin._id,
          area: newBin.area ?? null,
          height: (newBin.height !== undefined && newBin.height !== null) ? Number(newBin.height) : null,
        };
        console.log('BinComponet created new DB bin:', newBin, 'normalized:', normalized);
        setBins((prev) => [...prev, normalized]);
      } else {
        console.error("Failed to create bin:", response.statusText);
      }
    } catch (error) {
      console.error("Error creating bin:", error);
    }
  };

  useEffect(() => {
    mountedRef.current = true;
    const fetchBins = async () => {
      try {
        const response = await fetch(`${BACKEND}/api/bins`);
        if (response.ok) {
          const binsData = await response.json();
          let meta = binsData.bin ?? [];
          // normalize DB meta objects to a simple predictable shape
          meta = meta.map((m) => ({
            _id: m._id ?? m.id,
            id: m.binId ?? m.id ?? m._id,
            binId: m.binId ?? m.id ?? m._id,
            area: m.area ?? null,
            height: (m.height !== undefined && m.height !== null) ? Number(m.height) : null,
          }));
          // also fetch iot sensor state and merge
          try {
            const resIoT = await fetch(`${BACKEND}/api/iot/bins`);
            if (resIoT.ok) {
              const iotBins = await resIoT.json();
              // Build map by id/binId
              const map = new Map();
              iotBins.forEach((b) => map.set((b.id ?? b.binId), b));
              meta = meta.map((m) => {
                const key = m.binId;
                const sensor = map.get(key);
                // if sensor provides percent use it; otherwise compute percent from distance
                let percent = sensor?.filled_level ?? sensor?.filledLevel ?? null;
                if ((percent === null || percent === undefined) && sensor?.distance !== undefined) {
                  const h = Number(m.height || sensor.height || 38);
                  const d = Number(sensor.distance);
                  if (!Number.isNaN(d) && h > 0) {
                    percent = Math.round(((h - d) / h) * 100);
                  }
                }
                return { ...m, filled_level: percent ?? null, temperature: sensor?.temperature ?? null };
              });
            }
          } catch (e) {
            // ignore iot fetch errors
          }

          if (mountedRef.current) setBins(meta);
        } else {
          console.error("Failed to fetch bins:", response.statusText);
        }
      } catch (error) {
        console.error("Error fetching bins:", error);
      }
    };

    fetchBins();

    SOCKET.on("connect", () => console.log('socket connected', SOCKET.id));
    SOCKET.on("mqttData", (data) => {
      console.log('BinComponet received mqttData:', data);
      if (!mountedRef.current) return;
      // update any matching bin by id/binId
      setBins((prev) => {
        const id = data.binId ?? data.id ?? null;
        if (!id) return prev;
        let found = false;
        const updated = prev.map((b) => {
          const idKey = b.binId;
          if (!idKey) return b;
          if (id === idKey) {
            found = true;
            // backend emits percent in filledLevel/filled_level; if raw distance comes use height to convert
            let percent = data.filled_level ?? data.filledLevel ?? null;
            if ((percent === null || percent === undefined) && data.distance !== undefined) {
              const h = Number(b.height || 38);
              const d = Number(data.distance);
              if (!Number.isNaN(d) && h > 0) percent = Math.round(((h - d) / h) * 100);
            }
            const upd = { ...b, filled_level: percent ?? b.filled_level, temperature: data.temperature ?? b.temperature };
            console.log('BinComponet applying update to', idKey, '->', upd);
            return upd;
          }
          return b;
        });
        if (!found) {
          // add a new row for this sensor
          const percent = data.filled_level ?? data.filledLevel ?? null;
          const added = {
            _id: data.id ?? id,
            id,
            binId: id,
            area: '-',
            height: null,
            filled_level: percent ?? null,
            temperature: data.temperature ?? null,
          };
          console.log('BinComponet adding new bin from mqttData:', added);
          return [...updated, added];
        }
        return updated;
      });
    });

    return () => {
      mountedRef.current = false;
      try {
        SOCKET.off("mqttData");
      } catch (e) {}
    };
  }, []);

  return (
    <div className="container">
      <h2>Create a New Bin</h2>
      <form onSubmit={handleSubmit}>
        <div className="mb-3">
          <label htmlFor="binId" className="form-label">
            Bin ID:
          </label>
          <input
            type="text"
            id="binId"
            className="form-control"
            value={binId}
            onChange={(e) => setBinId(e.target.value)}
            required
          />
        </div>
        <div className="mb-3">
          <label htmlFor="area" className="form-label">
            Area:
          </label>
          <input
            type="text"
            id="area"
            className="form-control"
            value={area}
            onChange={(e) => setArea(e.target.value)}
            required
          />
        </div>
        <div className="mb-3">
          <label htmlFor="height" className="form-label">
            Height:
          </label>
          <input
            type="number"
            id="height"
            className="form-control"
            value={height}
            onChange={(e) => setHeight(e.target.value)}
            required
          />
        </div>
        <button type="submit" className="btn btn-primary">
          Create Bin
        </button>
      </form>
      <br />
      <br />
      <h2>Bin Details</h2>
      <table className="table table-bordered table-striped table-info rounded">
        <thead>
            <tr>
              <th style={style.label}>Bin ID</th>
              <th style={style.label}>Area</th>
              <th style={style.label}>Height</th>
              <th style={style.label}>Filled (%)</th>
              <th style={style.label}>Temperature</th>
            </tr>
        </thead>
        <tbody>
          {bins.map((bin, idx) => (
            <tr key={bin._id ?? bin.id ?? idx}>
              <td>{bin.binId ?? bin.id ?? "-"}</td>
              <td>{bin.area ?? "-"}</td>
              <td>{bin.height ?? "-"}</td>
              <td>{([bin.filled_level, bin.filledLevel].find((v) => v !== undefined && v !== null) ?? "-") + (bin.filled_level !== undefined && bin.filled_level !== null ? ' %' : '')}</td>
              <td>{bin.temperature ?? "-"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const style = {
  label: {
    color: "#20476bff",
  },
};

export default BinComponent;
