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

function Payments() {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPayments();
  }, []);

  const fetchPayments = async () => {
    try {
      const response = await api.get("/api/v1/payments?limit=50");
      setPayments(response.data.data || []);
    } catch (error) {
      console.error("Error fetching payments:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCapture = async (paymentId, amount) => {
    try {
      await api.post(`/api/v1/payments/${paymentId}/capture`, { amount });
      fetchPayments();
    } catch (error) {
      console.error("Error capturing payment:", error);
      alert(
        error.response?.data?.error?.description || "Failed to capture payment"
      );
    }
  };

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  return (
    <div data-test-id="payments-page">
      <div className="page-header">
        <h2>Payments</h2>
      </div>

      <div className="card">
        {payments.length === 0 ? (
          <div className="empty-state" data-test-id="empty-state">
            No payments found
          </div>
        ) : (
          <table data-test-id="payments-table">
            <thead>
              <tr>
                <th>Payment ID</th>
                <th>Order ID</th>
                <th>Amount</th>
                <th>Method</th>
                <th>Status</th>
                <th>Captured</th>
                <th>Created At</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((payment) => (
                <tr
                  key={payment.id}
                  data-test-id="payment-row"
                  data-payment-id={payment.id}
                >
                  <td data-test-id="payment-id">{payment.id}</td>
                  <td data-test-id="payment-order-id">{payment.order_id}</td>
                  <td data-test-id="payment-amount">
                    ₹{(payment.amount / 100).toFixed(2)}
                  </td>
                  <td data-test-id="payment-method">
                    {payment.method.toUpperCase()}
                  </td>
                  <td>
                    <span
                      className={`status-badge ${payment.status}`}
                      data-test-id="payment-status"
                    >
                      {payment.status}
                    </span>
                  </td>
                  <td data-test-id="payment-captured">
                    {payment.captured ? "Yes" : "No"}
                  </td>
                  <td data-test-id="payment-created">
                    {new Date(payment.created_at).toLocaleString()}
                  </td>
                  <td>
                    {payment.status === "success" && !payment.captured && (
                      <button
                        className="btn btn-sm btn-primary"
                        data-test-id="capture-button"
                        onClick={() =>
                          handleCapture(payment.id, payment.amount)
                        }
                      >
                        Capture
                      </button>
                    )}
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

export default Payments;
