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
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  const getStatusStyle = (status) => {
    switch (status) {
      case "success":
        return "bg-black text-white";
      case "pending":
        return "bg-gray-300 text-black";
      case "failed":
        return "bg-gray-600 text-white";
      default:
        return "bg-gray-100 text-black";
    }
  };

  return (
    <div data-test-id="payments-page">
      <h2 className="text-3xl font-bold text-black mb-8">Payments</h2>

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        {payments.length === 0 ? (
          <div
            className="text-center py-12 text-gray-500"
            data-test-id="empty-state"
          >
            No payments found
          </div>
        ) : (
          <table className="w-full" data-test-id="payments-table">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600">
                  Payment ID
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600">
                  Order ID
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600">
                  Amount
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600">
                  Method
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600">
                  Status
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600">
                  Captured
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600">
                  Created At
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {payments.map((payment) => (
                <tr
                  key={payment.id}
                  className="hover:bg-gray-50"
                  data-test-id="payment-row"
                  data-payment-id={payment.id}
                >
                  <td
                    className="px-6 py-4 text-sm font-mono"
                    data-test-id="payment-id"
                  >
                    {payment.id}
                  </td>
                  <td
                    className="px-6 py-4 text-sm font-mono"
                    data-test-id="payment-order-id"
                  >
                    {payment.order_id}
                  </td>
                  <td
                    className="px-6 py-4 text-sm"
                    data-test-id="payment-amount"
                  >
                    ₹{(payment.amount / 100).toFixed(2)}
                  </td>
                  <td
                    className="px-6 py-4 text-sm uppercase"
                    data-test-id="payment-method"
                  >
                    {payment.method}
                  </td>
                  <td className="px-6 py-4" data-test-id="payment-status">
                    <span
                      className={`inline-block px-3 py-1 text-xs font-medium rounded-full ${getStatusStyle(
                        payment.status
                      )}`}
                    >
                      {payment.status}
                    </span>
                  </td>
                  <td
                    className="px-6 py-4 text-sm"
                    data-test-id="payment-captured"
                  >
                    {payment.captured ? "Yes" : "No"}
                  </td>
                  <td
                    className="px-6 py-4 text-sm text-gray-600"
                    data-test-id="payment-created"
                  >
                    {new Date(payment.created_at).toLocaleString()}
                  </td>
                  <td className="px-6 py-4">
                    {payment.status === "success" && !payment.captured && (
                      <button
                        className="px-4 py-2 bg-black text-white text-sm rounded hover:bg-gray-800 transition"
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
