import React from "react";
import "../components/Dashboard/Dashboard.css";
import Header from "../components/Dashboard/Header";
import Sidebar from "../components/Dashboard/Sidebar";
import AdminIotSimulator from "../components/Dashboard/AdminIotSimulator";

function Adminiot() {
    return (
        <div className="grid-container">
                <Header />
                <Sidebar />
                <main className="main-content" role="main" style={{ padding: 16 }}>
                    <AdminIotSimulator />
                </main>
            </div>
    );
}

export default Adminiot;