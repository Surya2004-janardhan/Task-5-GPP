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
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  return (
    <div data-test-id="dashboard-page">
      <h2 className="text-3xl font-bold text-black mb-8">Dashboard</h2>

      <div
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8"
        data-test-id="stats-grid"
      >
        <div
          className="bg-white border border-gray-200 rounded-lg p-6"
          data-test-id="stat-orders"
        >
          <div className="text-sm text-gray-500 mb-1">Total Orders</div>
          <div className="text-3xl font-bold text-black">
            {stats.totalOrders}
          </div>
        </div>
        <div
          className="bg-white border border-gray-200 rounded-lg p-6"
          data-test-id="stat-payments"
        >
          <div className="text-sm text-gray-500 mb-1">Total Payments</div>
          <div className="text-3xl font-bold text-black">
            {stats.totalPayments}
          </div>
        </div>
        <div
          className="bg-white border border-gray-200 rounded-lg p-6"
          data-test-id="stat-successful"
        >
          <div className="text-sm text-gray-500 mb-1">Successful</div>
          <div className="text-3xl font-bold text-black">
            {stats.successfulPayments}
          </div>
        </div>
        <div
          className="bg-white border border-gray-200 rounded-lg p-6"
          data-test-id="stat-pending"
        >
          <div className="text-sm text-gray-500 mb-1">Pending</div>
          <div className="text-3xl font-bold text-gray-600">
            {stats.pendingPayments}
          </div>
        </div>
        <div
          className="bg-white border border-gray-200 rounded-lg p-6"
          data-test-id="stat-failed"
        >
          <div className="text-sm text-gray-500 mb-1">Failed</div>
          <div className="text-3xl font-bold text-black">
            {stats.failedPayments}
          </div>
        </div>
        <div
          className="bg-white border border-gray-200 rounded-lg p-6"
          data-test-id="stat-refunds"
        >
          <div className="text-sm text-gray-500 mb-1">Total Refunds</div>
          <div className="text-3xl font-bold text-black">
            {stats.totalRefunds}
          </div>
        </div>
      </div>

      {jobStatus && (
        <div
          className="bg-white border border-gray-200 rounded-lg p-6"
          data-test-id="job-status"
        >
          <h3 className="text-xl font-bold text-black mb-6">
            Job Queue Status
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div className="text-center">
              <div className="text-sm text-gray-500">Pending</div>
              <div className="text-2xl font-bold text-gray-600">
                {jobStatus.pending}
              </div>
            </div>
            <div className="text-center">
              <div className="text-sm text-gray-500">Processing</div>
              <div className="text-2xl font-bold text-black">
                {jobStatus.processing}
              </div>
            </div>
            <div className="text-center">
              <div className="text-sm text-gray-500">Completed</div>
              <div className="text-2xl font-bold text-black">
                {jobStatus.completed}
              </div>
            </div>
            <div className="text-center">
              <div className="text-sm text-gray-500">Failed</div>
              <div className="text-2xl font-bold text-black">
                {jobStatus.failed}
              </div>
            </div>
          </div>
          <p className="text-gray-600">
            Worker Status:{" "}
            <span className="font-semibold text-black">
              {jobStatus.worker_status}
            </span>
          </p>
        </div>
      )}
    </div>
  );
}

export default Dashboard;
