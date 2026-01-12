import React, { useState, useEffect } from "react";
import axios from "axios";

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:8000";
const API_KEY = "key_test_abc123";
const API_SECRET = "secret_test_xyz789";

const api = axios.create({
  baseURL: API_URL,
  headers: {
    "X-Api-Key": API_KEY,
    "X-Api-Secret": API_SECRET,
  },
});

function Dashboard() {
  const [stats, setStats] = useState({
    totalOrders: 0,
    totalPayments: 0,
    successfulPayments: 0,
    pendingPayments: 0,
    failedPayments: 0,
    totalRefunds: 0,
  });
  const [jobStatus, setJobStatus] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const [ordersRes, paymentsRes, refundsRes, jobsRes] = await Promise.all([
        api.get("/api/v1/orders?limit=1000"),
        api.get("/api/v1/payments?limit=1000"),
        api.get("/api/v1/refunds?limit=1000"),
        axios.get(`${API_URL}/api/v1/test/jobs/status`),
      ]);

      const payments = paymentsRes.data.data || [];

      setStats({
        totalOrders: ordersRes.data.total || 0,
        totalPayments: paymentsRes.data.total || 0,
        successfulPayments: payments.filter((p) => p.status === "success")
          .length,
        pendingPayments: payments.filter((p) => p.status === "pending").length,
        failedPayments: payments.filter((p) => p.status === "failed").length,
        totalRefunds: refundsRes.data.total || 0,
      });

      setJobStatus(jobsRes.data);
    } catch (error) {
      console.error("Error fetching stats:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  return (
    <div data-test-id="dashboard-page">
      <div className="page-header">
        <h2>Dashboard</h2>
      </div>

      <div className="stats-grid" data-test-id="stats-grid">
        <div className="stat-card" data-test-id="stat-orders">
          <div className="label">Total Orders</div>
          <div className="value">{stats.totalOrders}</div>
        </div>
        <div className="stat-card" data-test-id="stat-payments">
          <div className="label">Total Payments</div>
          <div className="value">{stats.totalPayments}</div>
        </div>
        <div className="stat-card success" data-test-id="stat-successful">
          <div className="label">Successful</div>
          <div className="value">{stats.successfulPayments}</div>
        </div>
        <div className="stat-card pending" data-test-id="stat-pending">
          <div className="label">Pending</div>
          <div className="value">{stats.pendingPayments}</div>
        </div>
        <div className="stat-card failed" data-test-id="stat-failed">
          <div className="label">Failed</div>
          <div className="value">{stats.failedPayments}</div>
        </div>
        <div className="stat-card" data-test-id="stat-refunds">
          <div className="label">Total Refunds</div>
          <div className="value">{stats.totalRefunds}</div>
        </div>
      </div>

      {jobStatus && (
        <div className="card" data-test-id="job-status">
          <h3>Job Queue Status</h3>
          <div className="stats-grid">
            <div className="stat-card pending">
              <div className="label">Pending Jobs</div>
              <div className="value">{jobStatus.pending}</div>
            </div>
            <div className="stat-card">
              <div className="label">Processing</div>
              <div className="value">{jobStatus.processing}</div>
            </div>
            <div className="stat-card success">
              <div className="label">Completed</div>
              <div className="value">{jobStatus.completed}</div>
            </div>
            <div className="stat-card failed">
              <div className="label">Failed</div>
              <div className="value">{jobStatus.failed}</div>
            </div>
          </div>
          <p>
            Worker Status: <strong>{jobStatus.worker_status}</strong>
          </p>
        </div>
      )}
    </div>
  );
}

export default Dashboard;
