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

function Orders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    try {
      const response = await api.get("/api/v1/orders?limit=50");
      setOrders(response.data.data || []);
    } catch (error) {
      console.error("Error fetching orders:", error);
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
    <div data-test-id="orders-page">
      <h2 className="text-3xl font-bold text-black mb-8">Orders</h2>

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        {orders.length === 0 ? (
          <div className="text-center py-12 text-gray-500" data-test-id="empty-state">
            No orders found
          </div>
        ) : (
          <table className="w-full" data-test-id="orders-table">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600">Order ID</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600">Amount</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600">Currency</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600">Receipt</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600">Status</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600">Created At</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {orders.map((order) => (
                <tr key={order.id} className="hover:bg-gray-50" data-test-id="order-row" data-order-id={order.id}>
                  <td className="px-6 py-4 text-sm font-mono" data-test-id="order-id">{order.id}</td>
                  <td className="px-6 py-4 text-sm" data-test-id="order-amount">₹{(order.amount / 100).toFixed(2)}</td>
                  <td className="px-6 py-4 text-sm" data-test-id="order-currency">{order.currency}</td>
                  <td className="px-6 py-4 text-sm" data-test-id="order-receipt">{order.receipt || "-"}</td>
                  <td className="px-6 py-4" data-test-id="order-status">
                    <span className={`inline-block px-3 py-1 text-xs font-medium rounded-full ${
                      order.status === "created" ? "bg-gray-100 text-black" : "bg-black text-white"
                    }`}>
                      {order.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600" data-test-id="order-created">
                    {new Date(order.created_at).toLocaleString()}
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

export default Orders;
