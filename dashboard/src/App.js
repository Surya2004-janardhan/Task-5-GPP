import React from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Link,
  useLocation,
} from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import Orders from "./pages/Orders";
import Payments from "./pages/Payments";
import Refunds from "./pages/Refunds";
import Webhooks from "./pages/Webhooks";
import Docs from "./pages/Docs";

function Sidebar() {
  const location = useLocation();

  const isActive = (path) => (location.pathname === path ? "active" : "");

  return (
    <div className="sidebar" data-test-id="sidebar">
      <div className="sidebar-header">
        <h1>Payment Gateway</h1>
      </div>
      <nav>
        <ul className="sidebar-nav">
          <li>
            <Link to="/" className={isActive("/")} data-test-id="nav-dashboard">
              Dashboard
            </Link>
          </li>
          <li>
            <Link
              to="/orders"
              className={isActive("/orders")}
              data-test-id="nav-orders"
            >
              Orders
            </Link>
          </li>
          <li>
            <Link
              to="/payments"
              className={isActive("/payments")}
              data-test-id="nav-payments"
            >
              Payments
            </Link>
          </li>
          <li>
            <Link
              to="/refunds"
              className={isActive("/refunds")}
              data-test-id="nav-refunds"
            >
              Refunds
            </Link>
          </li>
          <li>
            <Link
              to="/dashboard/webhooks"
              className={isActive("/dashboard/webhooks")}
              data-test-id="nav-webhooks"
            >
              Webhooks
            </Link>
          </li>
          <li>
            <Link
              to="/dashboard/docs"
              className={isActive("/dashboard/docs")}
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
      <div className="dashboard-container">
        <Sidebar />
        <main className="main-content">
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
