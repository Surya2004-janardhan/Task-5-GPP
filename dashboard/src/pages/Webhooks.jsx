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
    <div data-test-id="webhook-config">
      <h2 className="text-3xl font-bold text-black mb-8">
        Webhook Configuration
      </h2>

      {message && (
        <div
          className={`p-4 rounded-lg mb-6 ${
            message.type === "success"
              ? "bg-gray-100 text-black"
              : "bg-gray-800 text-white"
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-lg p-6 mb-8">
        <form data-test-id="webhook-config-form" onSubmit={handleSaveWebhook}>
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Webhook URL
            </label>
            <input
              type="url"
              data-test-id="webhook-url-input"
              placeholder="https://yoursite.com/webhook"
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-black"
            />
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Webhook Secret
            </label>
            <div className="flex items-center gap-4">
              <code
                className="flex-1 bg-gray-100 px-4 py-3 rounded-lg font-mono text-sm"
                data-test-id="webhook-secret"
              >
                {webhookSecret}
              </code>
              <button
                type="button"
                className="px-4 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
                data-test-id="regenerate-secret-button"
                onClick={handleRegenerateSecret}
              >
                Regenerate
              </button>
            </div>
          </div>

          <div className="flex gap-4">
            <button
              type="submit"
              className="px-6 py-3 bg-black text-white rounded-lg hover:bg-gray-800 transition"
              data-test-id="save-webhook-button"
            >
              Save Configuration
            </button>
            <button
              type="button"
              className="px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
              data-test-id="test-webhook-button"
              onClick={handleTestWebhook}
            >
              Send Test Webhook
            </button>
          </div>
        </form>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-xl font-bold text-black">Webhook Logs</h3>
        </div>
        {webhookLogs.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            No webhook logs found
          </div>
        ) : (
          <table className="w-full" data-test-id="webhook-logs-table">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600">
                  Event
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600">
                  Status
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600">
                  Attempts
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600">
                  Last Attempt
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600">
                  Response Code
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {webhookLogs.map((log) => (
                <tr
                  key={log.id}
                  className="hover:bg-gray-50"
                  data-test-id="webhook-log-item"
                  data-webhook-id={log.id}
                >
                  <td
                    className="px-6 py-4 text-sm font-mono"
                    data-test-id="webhook-event"
                  >
                    {log.event}
                  </td>
                  <td className="px-6 py-4" data-test-id="webhook-status">
                    <span
                      className={`inline-block px-3 py-1 text-xs font-medium rounded-full ${getStatusStyle(
                        log.status
                      )}`}
                    >
                      {log.status}
                    </span>
                  </td>
                  <td
                    className="px-6 py-4 text-sm"
                    data-test-id="webhook-attempts"
                  >
                    {log.attempts}
                  </td>
                  <td
                    className="px-6 py-4 text-sm text-gray-600"
                    data-test-id="webhook-last-attempt"
                  >
                    {log.last_attempt_at
                      ? new Date(log.last_attempt_at).toLocaleString()
                      : "-"}
                  </td>
                  <td
                    className="px-6 py-4 text-sm"
                    data-test-id="webhook-response-code"
                  >
                    {log.response_code || "-"}
                  </td>
                  <td className="px-6 py-4">
                    <button
                      className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50 transition text-sm"
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
