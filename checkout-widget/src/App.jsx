import React, { useState, useEffect } from "react";
import axios from "axios";

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:8000";

function App() {
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState("upi");
  const [vpa, setVpa] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCvv, setCardCvv] = useState("");
  const [processing, setProcessing] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState(null);

  const urlParams = new URLSearchParams(window.location.search);
  const orderId = urlParams.get("order_id");
  const apiKey = urlParams.get("key") || "key_test_abc123";
  const embedded = urlParams.get("embedded") === "true";

  useEffect(() => {
    if (orderId) {
      fetchOrder();
    } else {
      setLoading(false);
      setError("No order ID provided");
    }
  }, [orderId]);

  const fetchOrder = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/v1/orders/${orderId}`, {
        headers: {
          "X-Api-Key": apiKey,
          "X-Api-Secret": "secret_test_xyz789",
        },
      });
      setOrder(response.data);
    } catch (err) {
      setError("Failed to fetch order details");
    } finally {
      setLoading(false);
    }
  };

  const handlePayment = async (e) => {
    e.preventDefault();
    setProcessing(true);

    try {
      const paymentData = {
        order_id: orderId,
        method: paymentMethod,
      };

      if (paymentMethod === "upi") {
        paymentData.vpa = vpa;
      } else {
        paymentData.card_number = cardNumber.replace(/\s/g, "");
        paymentData.card_expiry = cardExpiry;
        paymentData.card_cvv = cardCvv;
      }

      const response = await axios.post(`${API_URL}/api/v1/payments`, paymentData, {
        headers: {
          "X-Api-Key": apiKey,
          "X-Api-Secret": "secret_test_xyz789",
          "Content-Type": "application/json",
        },
      });

      setPaymentStatus({ success: true, paymentId: response.data.id });

      // Notify parent if embedded
      if (embedded && window.parent) {
        window.parent.postMessage({
          type: "payment_success",
          data: { paymentId: response.data.id },
        }, "*");
      }
    } catch (err) {
      setPaymentStatus({ success: false, error: err.response?.data?.error?.description || "Payment failed" });

      if (embedded && window.parent) {
        window.parent.postMessage({
          type: "payment_failed",
          data: { error: err.response?.data?.error?.description || "Payment failed" },
        }, "*");
      }
    } finally {
      setProcessing(false);
    }
  };

  const handleClose = () => {
    if (embedded && window.parent) {
      window.parent.postMessage({ type: "close_modal" }, "*");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="text-black text-xl mb-4">{error}</div>
          {embedded && (
            <button onClick={handleClose} className="px-6 py-3 bg-black text-white rounded-lg">
              Close
            </button>
          )}
        </div>
      </div>
    );
  }

  if (paymentStatus) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center">
          {paymentStatus.success ? (
            <>
              <div className="w-16 h-16 bg-black rounded-full flex items-center justify-center mx-auto mb-6">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-black mb-2">Payment Initiated</h2>
              <p className="text-gray-600 mb-4">Your payment is being processed.</p>
              <p className="text-sm text-gray-500 font-mono">{paymentStatus.paymentId}</p>
            </>
          ) : (
            <>
              <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-6">
                <svg className="w-8 h-8 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-black mb-2">Payment Failed</h2>
              <p className="text-gray-600">{paymentStatus.error}</p>
            </>
          )}
          {embedded && (
            <button onClick={handleClose} className="mt-6 px-6 py-3 bg-black text-white rounded-lg">
              Close
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-4" data-test-id="checkout-form">
      <div className="max-w-md w-full">
        <div className="border border-gray-200 rounded-lg p-6">
          {embedded && (
            <button
              onClick={handleClose}
              className="absolute top-4 right-4 text-gray-400 hover:text-black"
              data-test-id="close-checkout-button"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}

          <h1 className="text-2xl font-bold text-black mb-6">Complete Payment</h1>

          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Amount</span>
              <span className="text-2xl font-bold text-black">₹{(order.amount / 100).toFixed(2)}</span>
            </div>
            <div className="text-sm text-gray-500 mt-1">Order: {order.id}</div>
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-3">Payment Method</label>
            <div className="grid grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => setPaymentMethod("upi")}
                className={`p-4 border rounded-lg text-center transition ${
                  paymentMethod === "upi" ? "border-black bg-black text-white" : "border-gray-200 hover:border-gray-400"
                }`}
                data-test-id="upi-method-button"
              >
                UPI
              </button>
              <button
                type="button"
                onClick={() => setPaymentMethod("card")}
                className={`p-4 border rounded-lg text-center transition ${
                  paymentMethod === "card" ? "border-black bg-black text-white" : "border-gray-200 hover:border-gray-400"
                }`}
                data-test-id="card-method-button"
              >
                Card
              </button>
            </div>
          </div>

          <form onSubmit={handlePayment}>
            {paymentMethod === "upi" ? (
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">UPI ID</label>
                <input
                  type="text"
                  value={vpa}
                  onChange={(e) => setVpa(e.target.value)}
                  placeholder="yourname@upi"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-black"
                  required
                  data-test-id="vpa-input"
                />
              </div>
            ) : (
              <>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Card Number</label>
                  <input
                    type="text"
                    value={cardNumber}
                    onChange={(e) => setCardNumber(e.target.value)}
                    placeholder="1234 5678 9012 3456"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-black"
                    required
                    data-test-id="card-number-input"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Expiry</label>
                    <input
                      type="text"
                      value={cardExpiry}
                      onChange={(e) => setCardExpiry(e.target.value)}
                      placeholder="MM/YY"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-black"
                      required
                      data-test-id="card-expiry-input"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">CVV</label>
                    <input
                      type="text"
                      value={cardCvv}
                      onChange={(e) => setCardCvv(e.target.value)}
                      placeholder="123"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-black"
                      required
                      data-test-id="card-cvv-input"
                    />
                  </div>
                </div>
              </>
            )}

            <button
              type="submit"
              disabled={processing}
              className="w-full py-4 bg-black text-white rounded-lg font-medium hover:bg-gray-800 transition disabled:bg-gray-400"
              data-test-id="pay-button"
            >
              {processing ? "Processing..." : `Pay ₹${(order.amount / 100).toFixed(2)}`}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-gray-400 mt-4">
          Secured by Payment Gateway
        </p>
      </div>
    </div>
  );
}

export default App;
