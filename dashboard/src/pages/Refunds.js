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

function Refunds() {
  const [refunds, setRefunds] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRefunds();
  }, []);

  const fetchRefunds = async () => {
    try {
      const response = await api.get("/api/v1/refunds?limit=50");
      setRefunds(response.data.data || []);
    } catch (error) {
      console.error("Error fetching refunds:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  return (
    <div data-test-id="refunds-page">
      <div className="page-header">
        <h2>Refunds</h2>
      </div>

      <div className="card">
        {refunds.length === 0 ? (
          <div className="empty-state" data-test-id="empty-state">
            No refunds found
          </div>
        ) : (
          <table data-test-id="refunds-table">
            <thead>
              <tr>
                <th>Refund ID</th>
                <th>Payment ID</th>
                <th>Amount</th>
                <th>Reason</th>
                <th>Status</th>
                <th>Created At</th>
                <th>Processed At</th>
              </tr>
            </thead>
            <tbody>
              {refunds.map((refund) => (
                <tr
                  key={refund.id}
                  data-test-id="refund-row"
                  data-refund-id={refund.id}
                >
                  <td data-test-id="refund-id">{refund.id}</td>
                  <td data-test-id="refund-payment-id">{refund.payment_id}</td>
                  <td data-test-id="refund-amount">
                    ₹{(refund.amount / 100).toFixed(2)}
                  </td>
                  <td data-test-id="refund-reason">{refund.reason || "-"}</td>
                  <td>
                    <span
                      className={`status-badge ${refund.status}`}
                      data-test-id="refund-status"
                    >
                      {refund.status}
                    </span>
                  </td>
                  <td data-test-id="refund-created">
                    {new Date(refund.created_at).toLocaleString()}
                  </td>
                  <td data-test-id="refund-processed">
                    {refund.processed_at
                      ? new Date(refund.processed_at).toLocaleString()
                      : "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

export default Refunds;
