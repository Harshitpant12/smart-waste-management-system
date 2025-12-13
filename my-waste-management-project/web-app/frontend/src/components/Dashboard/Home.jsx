// import React, { useEffect, useState } from "react";
// import "bootstrap/dist/css/bootstrap.min.css";
// import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
// import { faTrash, faUsers } from "@fortawesome/free-solid-svg-icons";
// import io from "socket.io-client";

// const socket = io("http://localhost:1337");
// const height = 38;

// function Home() {
//   const [mqttData, setMqttData] = useState(null);
//   const [totalUsers, setTotalUsers] = useState(null);
//   const [totalBins, setTotalBins] = useState(null);
//   const [totalCollectors, setTotalCollectors] = useState(null);

//   useEffect(() => {
//     socket.on("mqttData", (data) => {
//       console.log("Received MQTT data:", data);
//       setMqttData(data);
//     });

//     fetch("http://localhost:1337/api/user-details")
//       .then((response) => response.json())
//       .then((data) => {
//         setTotalUsers(data.totalUsers);
//       })
//       .catch((error) => console.error("Error fetching data:", error));

//     fetch("http://localhost:1337/api/bins")
//       .then((response) => response.json())
//       .then((data) => {
//         setTotalBins(data.totalBins);
//       })
//       .catch((error) => console.error("Error fetching data:", error));

//     fetch("http://localhost:1337/api/collector-details")
//       .then((response) => response.json())
//       .then((data) => {
//         setTotalCollectors(data.totalCollectors);
//       })
//       .catch((error) => console.error("Error fetching data:", error));

//     return () => {
//       socket.disconnect();
//     };
//   }, []);

//   useEffect(() => {
//     fetchMqttData();
//   }, []);

//   const fetchMqttData = async () => {
//     try {
//       const response = await fetch("http://localhost:1337/iot/subscribe");
//       if (!response.ok) {
//         throw new Error("Failed to fetch MQTT data");
//       }
//       const data = await response.json();
//       setMqttData(data);
//     } catch (error) {
//       console.error("Error fetching MQTT data:", error);
//     }
//   };
//   return (
//     <div className="container-fluid">
//       <h3 style={style.header}>Overview</h3>
//       <div className="row">
//         {" "}
//         <br />
//         <br />
//         <div className="row justify-content-center">
//           <div className="col-md-4 box" style={style.box}>
//             <FontAwesomeIcon icon={faUsers} /> Users: {totalUsers}
//           </div>
//           <div className="col-md-4 box" style={style.box}>
//             <FontAwesomeIcon icon={faTrash} /> Bins: {totalBins}
//           </div>
//           <div className="col-md-4 box" style={style.box}>
//             <FontAwesomeIcon icon={faUsers} /> Collectors: {totalCollectors}
//           </div>
//         </div>
//       </div>

//       <div className="row">
//         <div className="col-md-12">
//           {" "}
//           <br />
//           <br />
//           <h2 style={style.header}>Bin Status</h2>
//           <table
//             className="table table-striped table-bordered table-hover"
//             style={style.table}
//           >
//             <thead>
//               <tr>
//                 <th>BinID</th>
//                 <th>Filled_Level</th>
//                 <th>Temperature</th>
//                 <th>Latitude</th>
//                 <th>Longitude</th>
//               </tr>
//             </thead>
//             <tbody>
//               {mqttData ? (
//                 <tr>
//                   <td>{mqttData.binId}</td>
//                   <td>
//                     {((mqttData.filledLevel / height) * 100).toFixed(2)} %
//                   </td>
//                   <td>{mqttData.temperature}</td>
//                   <td>{mqttData.latitude}</td>
//                   <td>{mqttData.longitude}</td>
//                 </tr>
//               ) : (
//                 <tr>
//                   <td colSpan="5">No data available</td>
//                 </tr>
//               )}
//             </tbody>
//           </table>
//         </div>
//       </div>
//     </div>
//   );
// }

// const style = {
//   box: {
//     width: "300px",
//     height: "100px",
//     backgroundColor: "green",
//     padding: "10px",
//     display: "flex",
//     flexDirection: "column",
//     justifyContent: "center",
//     alignItems: "center",
//     color: "white",
//     borderRadius: "5px",
//     margin: "10px",
//     fontSize: "20px",
//   },
//   table: {
//     tableLayout: "fixed",
//   },
//   header: {
//     textAlign: "center",
//     color: "darkgreen",
//     fontSize: "24px",
//     fontWeight: "bold",
//     padding: "10px",
//   },
//   row: {
//     backgroundColor: "#f2f2f2",
//     textAlign: "center",
//   },
// };

// export default Home;

import React, { useEffect, useState } from "react";
import "bootstrap/dist/css/bootstrap.min.css";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTrash, faUsers } from "@fortawesome/free-solid-svg-icons";
import io from "socket.io-client";
const BACKEND = "http://localhost:1337";
const socket = io(BACKEND, { transports: ["websocket", "polling"] });
const height = 38;

function Home() {
  const [mqttData, setMqttData] = useState(null);
  const [iotBins, setIotBins] = useState([]);
  const [totalUsers, setTotalUsers] = useState(null);
  const [totalBins, setTotalBins] = useState(null);
  const [totalCollectors, setTotalCollectors] = useState(null);

  const normalizeMqtt = (data, binHeight = 38) => {
    if (!data) return null;
    // if payload includes distance (raw) use it to calculate percent
    const rawDistance = data.distance ?? data.filledLevel ?? null;
    const percentFromSnake = data.filled_level ?? data.filled_level_percent ?? null;
    let percent = null;
    if (percentFromSnake !== null && percentFromSnake !== undefined) {
      percent = Number(percentFromSnake);
    } else if (rawDistance !== null && rawDistance !== undefined) {
      const d = Number(rawDistance);
      if (!Number.isNaN(d)) {
        percent = Math.round(((binHeight - d) / binHeight) * 100);
      }
    }
    // clamp
    if (percent !== null) percent = Math.max(0, Math.min(100, percent));
    return {
      binId: data.binId ?? data.id ?? data.bin_id ?? null,
      filledLevel: percent,
      temperature: data.temperature ?? null,
      latitude: data.latitude ?? null,
      longitude: data.longitude ?? null,
      rawDistance: rawDistance ?? null,
    };
  };

  useEffect(() => {
    socket.on("connect", () => console.log('socket connected', socket.id));
    socket.on("mqttData", (data) => {
      console.log("Received MQTT data (raw):", data);
      const normalized = normalizeMqtt(data);
      console.log("Received MQTT data (normalized):", normalized);
      setMqttData(normalized);
      setIotBins((prev) => {
        const id = normalized?.binId ?? null;
        if (!id) return prev;
        const existing = prev.findIndex((b) => (b.binId ?? b.id) === id);
        if (existing === -1) {
          return [...prev, { binId: id, filledLevel: normalized.filledLevel, temperature: normalized.temperature, latitude: normalized.latitude, longitude: normalized.longitude }];
        }
        const updated = [...prev];
        updated[existing] = { ...updated[existing], filledLevel: normalized.filledLevel, temperature: normalized.temperature, latitude: normalized.latitude, longitude: normalized.longitude };
        return updated;
      });
    });

    fetch(`${BACKEND}/api/user-details`)
      .then((response) => response.json())
      .then((data) => {
        setTotalUsers(data.totalUsers);
      })
      .catch((error) => console.error("Error fetching data:", error));

    fetch(`${BACKEND}/api/bins`)
      .then((response) => response.json())
      .then((data) => {
        setTotalBins(data.totalBins);
      })
      .catch((error) => console.error("Error fetching data:", error));

    fetch(`${BACKEND}/api/collector-details`)
      .then((response) => response.json())
      .then((data) => {
        setTotalCollectors(data.totalCollectors);
      })
      .catch((error) => console.error("Error fetching data:", error));

    return () => {
        try { socket.disconnect(); } catch (e) {}
    };
  }, []);

  useEffect(() => {
    fetchMqttData();
    // also fetch list of iot bins for the table
    fetch(`${BACKEND}/api/iot/bins`)
      .then((r) => r.json())
      .then((list) => {
        const norm = (list || []).map((b) => normalizeMqtt(b));
        setIotBins(norm.filter(Boolean));
      })
      .catch((e) => console.error('Failed to load iot bins:', e));
  }, []);

  const fetchMqttData = async () => {
    try {
      // Use the API mount for iot routes
      const response = await fetch(`${BACKEND}/api/iot/subscribe`);
      if (!response.ok) {
        throw new Error("Failed to fetch MQTT data");
      }
      const data = await response.json();
      setMqttData(normalizeMqtt(data));
    } catch (error) {
      console.error("Error fetching MQTT data:", error);
    }
  };
  return (
    <div className="container-fluid">
      <h3 style={style.header}>Overview</h3>
      <div className="row">
        {" "}
        <br />
        <br />
        <div className="row justify-content-center">
          <div className="col-md-4 box" style={style.box}>
            <FontAwesomeIcon icon={faUsers} /> Users: {totalUsers}
          </div>
          <div className="col-md-4 box" style={style.box}>
            <FontAwesomeIcon icon={faTrash} /> Bins: {totalBins}
          </div>
          <div className="col-md-4 box" style={style.box}>
            <FontAwesomeIcon icon={faUsers} /> Collectors: {totalCollectors}
          </div>
        </div>
      </div>

      <div className="row">
        <div className="col-md-12">
          {" "}
          <br />
          <br />
          <h2 style={style.header}>Bin Status</h2>
          <table
            className="table table-striped table-bordered table-info table-hover"
            style={style.table}
          >
            <thead>
              <tr>
                <th style={style.label}>BinID</th>
                <th style={style.label}>Filled_Level</th>
                <th style={style.label}>Temperature</th>
                <th style={style.label}>Latitude</th>
                <th style={style.label}>Longitude</th>
              </tr>
            </thead>
            <tbody>
              {(iotBins && iotBins.length) ? (
                iotBins.map((row, i) => (
                  <tr key={row.binId ?? i}>
                    <td>{row.binId}</td>
                    <td>{row.filledLevel ?? '-'} %</td>
                    <td>{row.temperature ?? '-'}</td>
                    <td>{row.latitude ?? '-'}</td>
                    <td>{row.longitude ?? '-'}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="5">No data available</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

const style = {
  box: {
    width: "300px",
    height: "100px",
    backgroundColor: "teal",
    padding: "10px",
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",
    color: "white",
    borderRadius: "5px",
    margin: "10px",
    fontSize: "20px",
  },
  table: {
    tableLayout: "fixed",
  },
  header: {
    textAlign: "center",
    color: "teal",
    fontSize: "24px",
    fontWeight: "bold",
    padding: "10px",
  },
  row: {
    backgroundColor: "#f2f2f2",
    textAlign: "center",
  },
  label: {
    color: "#20476bff",
  }
};

export default Home;
