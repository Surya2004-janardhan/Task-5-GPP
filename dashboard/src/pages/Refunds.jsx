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
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  const getStatusStyle = (status) => {
    switch (status) {
      case "processed":
        return "bg-black text-white";
      case "pending":
        return "bg-gray-300 text-black";
      default:
        return "bg-gray-100 text-black";
    }
  };

  return (
    <div data-test-id="refunds-page">
      <h2 className="text-3xl font-bold text-black mb-8">Refunds</h2>

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        {refunds.length === 0 ? (
          <div
            className="text-center py-12 text-gray-500"
            data-test-id="empty-state"
          >
            No refunds found
          </div>
        ) : (
          <table className="w-full" data-test-id="refunds-table">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600">
                  Refund ID
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600">
                  Payment ID
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600">
                  Amount
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600">
                  Reason
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600">
                  Status
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600">
                  Created At
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600">
                  Processed At
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {refunds.map((refund) => (
                <tr
                  key={refund.id}
                  className="hover:bg-gray-50"
                  data-test-id="refund-row"
                  data-refund-id={refund.id}
                >
                  <td
                    className="px-6 py-4 text-sm font-mono"
                    data-test-id="refund-id"
                  >
                    {refund.id}
                  </td>
                  <td
                    className="px-6 py-4 text-sm font-mono"
                    data-test-id="refund-payment-id"
                  >
                    {refund.payment_id}
                  </td>
                  <td
                    className="px-6 py-4 text-sm"
                    data-test-id="refund-amount"
                  >
                    ₹{(refund.amount / 100).toFixed(2)}
                  </td>
                  <td
                    className="px-6 py-4 text-sm"
                    data-test-id="refund-reason"
                  >
                    {refund.reason || "-"}
                  </td>
                  <td className="px-6 py-4" data-test-id="refund-status">
                    <span
                      className={`inline-block px-3 py-1 text-xs font-medium rounded-full ${getStatusStyle(
                        refund.status
                      )}`}
                    >
                      {refund.status}
                    </span>
                  </td>
                  <td
                    className="px-6 py-4 text-sm text-gray-600"
                    data-test-id="refund-created"
                  >
                    {new Date(refund.created_at).toLocaleString()}
                  </td>
                  <td
                    className="px-6 py-4 text-sm text-gray-600"
                    data-test-id="refund-processed"
                  >
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
