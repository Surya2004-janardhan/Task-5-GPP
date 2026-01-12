import React from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Link,
  useLocation,
} from "react-router-dom";
import Dashboard from "./pages/Dashboard.jsx";
import Orders from "./pages/Orders.jsx";
import Payments from "./pages/Payments.jsx";
import Refunds from "./pages/Refunds.jsx";
import Webhooks from "./pages/Webhooks.jsx";
import Docs from "./pages/Docs.jsx";

function Sidebar() {
  const location = useLocation();

  const isActive = (path) =>
    location.pathname === path
      ? "bg-white text-black"
      : "text-gray-400 hover:bg-gray-800 hover:text-white";

  return (
    <div
      className="w-64 bg-black text-white min-h-screen"
      data-test-id="sidebar"
    >
      <div className="p-6 border-b border-gray-800">
        <h1 className="text-xl font-bold">Payment Gateway</h1>
      </div>
      <nav className="mt-6">
        <ul className="space-y-1">
          <li>
            <Link
              to="/"
              className={`block px-6 py-3 transition-all ${isActive("/")}`}
              data-test-id="nav-dashboard"
            >
              Dashboard
            </Link>
          </li>
          <li>
            <Link
              to="/orders"
              className={`block px-6 py-3 transition-all ${isActive(
                "/orders"
              )}`}
              data-test-id="nav-orders"
            >
              Orders
            </Link>
          </li>
          <li>
            <Link
              to="/payments"
              className={`block px-6 py-3 transition-all ${isActive(
                "/payments"
              )}`}
              data-test-id="nav-payments"
            >
              Payments
            </Link>
          </li>
          <li>
            <Link
              to="/refunds"
              className={`block px-6 py-3 transition-all ${isActive(
                "/refunds"
              )}`}
              data-test-id="nav-refunds"
            >
              Refunds
            </Link>
          </li>
          <li>
            <Link
              to="/dashboard/webhooks"
              className={`block px-6 py-3 transition-all ${isActive(
                "/dashboard/webhooks"
              )}`}
              data-test-id="nav-webhooks"
            >
              Webhooks
            </Link>
          </li>
          <li>
            <Link
              to="/dashboard/docs"
              className={`block px-6 py-3 transition-all ${isActive(
                "/dashboard/docs"
              )}`}
              data-test-id="nav-docs"
            >
              API Docs
            </Link>
          </li>
        </ul>
      </nav>
    </div>
  );
}

function App() {
  return (
    <Router>
      <div className="flex min-h-screen bg-gray-100">
        <Sidebar />
        <main className="flex-1 p-8">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/orders" element={<Orders />} />
            <Route path="/payments" element={<Payments />} />
            <Route path="/refunds" element={<Refunds />} />
            <Route path="/dashboard/webhooks" element={<Webhooks />} />
            <Route path="/dashboard/docs" element={<Docs />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
