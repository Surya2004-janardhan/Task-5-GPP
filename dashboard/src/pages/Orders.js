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
    return <div className="loading">Loading...</div>;
  }

  return (
    <div data-test-id="orders-page">
      <div className="page-header">
        <h2>Orders</h2>
      </div>

      <div className="card">
        {orders.length === 0 ? (
          <div className="empty-state" data-test-id="empty-state">
            No orders found
          </div>
        ) : (
          <table data-test-id="orders-table">
            <thead>
              <tr>
                <th>Order ID</th>
                <th>Amount</th>
                <th>Currency</th>
                <th>Receipt</th>
                <th>Status</th>
                <th>Created At</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr
                  key={order.id}
                  data-test-id="order-row"
                  data-order-id={order.id}
                >
                  <td data-test-id="order-id">{order.id}</td>
                  <td data-test-id="order-amount">
                    ₹{(order.amount / 100).toFixed(2)}
                  </td>
                  <td data-test-id="order-currency">{order.currency}</td>
                  <td data-test-id="order-receipt">{order.receipt || "-"}</td>
                  <td>
                    <span
                      className={`status-badge ${order.status}`}
                      data-test-id="order-status"
                    >
                      {order.status}
                    </span>
                  </td>
                  <td data-test-id="order-created">
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
