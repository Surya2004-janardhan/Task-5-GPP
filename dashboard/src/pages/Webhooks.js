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

function Webhooks() {
  const [webhookUrl, setWebhookUrl] = useState("");
  const [webhookSecret, setWebhookSecret] = useState("");
  const [webhookLogs, setWebhookLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [profileRes, logsRes] = await Promise.all([
        api.get("/api/v1/merchants/profile"),
        api.get("/api/v1/webhooks?limit=50"),
      ]);

      setWebhookUrl(profileRes.data.webhook_url || "");
      setWebhookSecret(profileRes.data.webhook_secret || "");
      setWebhookLogs(logsRes.data.data || []);
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveWebhook = async (e) => {
    e.preventDefault();
    try {
      await api.put("/api/v1/merchants/webhook", { webhook_url: webhookUrl });
      setMessage({ type: "success", text: "Webhook URL saved successfully" });
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      setMessage({ type: "error", text: "Failed to save webhook URL" });
    }
  };

  const handleRegenerateSecret = async () => {
    try {
      const response = await api.post(
        "/api/v1/merchants/webhook/regenerate-secret"
      );
      setWebhookSecret(response.data.webhook_secret);
      setMessage({ type: "success", text: "Webhook secret regenerated" });
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      setMessage({ type: "error", text: "Failed to regenerate secret" });
    }
  };

  const handleTestWebhook = async () => {
    try {
      await api.post("/api/v1/merchants/webhook/test");
      setMessage({ type: "success", text: "Test webhook scheduled" });
      setTimeout(() => setMessage(null), 3000);
      setTimeout(fetchData, 2000);
    } catch (error) {
      setMessage({
        type: "error",
        text:
          error.response?.data?.error?.description ||
          "Failed to send test webhook",
      });
    }
  };

  const handleRetryWebhook = async (webhookId) => {
    try {
      await api.post(`/api/v1/webhooks/${webhookId}/retry`);
      setMessage({ type: "success", text: "Webhook retry scheduled" });
      setTimeout(() => setMessage(null), 3000);
      setTimeout(fetchData, 2000);
    } catch (error) {
      setMessage({ type: "error", text: "Failed to retry webhook" });
    }
  };

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  return (
    <div data-test-id="webhook-config">
      <div className="page-header">
        <h2>Webhook Configuration</h2>
      </div>

      {message && (
        <div
          className={
            message.type === "success" ? "success-message" : "error-message"
          }
        >
          {message.text}
        </div>
      )}

      <div className="card">
        <form data-test-id="webhook-config-form" onSubmit={handleSaveWebhook}>
          <div className="form-group">
            <label>Webhook URL</label>
            <input
              type="url"
              data-test-id="webhook-url-input"
              placeholder="https://yoursite.com/webhook"
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label>Webhook Secret</label>
            <div className="secret-display">
              <code data-test-id="webhook-secret">{webhookSecret}</code>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                data-test-id="regenerate-secret-button"
                onClick={handleRegenerateSecret}
              >
                Regenerate
              </button>
            </div>
          </div>

          <div style={{ display: "flex", gap: "10px" }}>
            <button
              type="submit"
              className="btn btn-primary"
              data-test-id="save-webhook-button"
            >
              Save Configuration
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              data-test-id="test-webhook-button"
              onClick={handleTestWebhook}
            >
              Send Test Webhook
            </button>
          </div>
        </form>
      </div>

      <div className="card">
        <h3>Webhook Logs</h3>
        {webhookLogs.length === 0 ? (
          <div className="empty-state">No webhook logs found</div>
        ) : (
          <table data-test-id="webhook-logs-table">
            <thead>
              <tr>
                <th>Event</th>
                <th>Status</th>
                <th>Attempts</th>
                <th>Last Attempt</th>
                <th>Response Code</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {webhookLogs.map((log) => (
                <tr
                  key={log.id}
                  data-test-id="webhook-log-item"
                  data-webhook-id={log.id}
                >
                  <td data-test-id="webhook-event">{log.event}</td>
                  <td>
                    <span
                      className={`status-badge ${log.status}`}
                      data-test-id="webhook-status"
                    >
                      {log.status}
                    </span>
                  </td>
                  <td data-test-id="webhook-attempts">{log.attempts}</td>
                  <td data-test-id="webhook-last-attempt">
                    {log.last_attempt_at
                      ? new Date(log.last_attempt_at).toLocaleString()
                      : "-"}
                  </td>
                  <td data-test-id="webhook-response-code">
                    {log.response_code || "-"}
                  </td>
                  <td>
                    <button
                      className="btn btn-sm btn-secondary"
                      data-test-id="retry-webhook-button"
                      data-webhook-id={log.id}
                      onClick={() => handleRetryWebhook(log.id)}
                    >
                      Retry
                    </button>
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

export default Webhooks;
