/**
 * Payment Gateway SDK
 * Embeddable JavaScript SDK for accepting payments
 */
(function (window) {
  "use strict";

  // SDK styles
  var styles = `
    #payment-gateway-modal {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      z-index: 999999;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    
    #payment-gateway-modal .modal-overlay {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.6);
    }
    
    #payment-gateway-modal .modal-content {
      position: relative;
      width: 100%;
      max-width: 450px;
      max-height: 90vh;
      background: white;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
      z-index: 1;
    }
    
    #payment-gateway-modal .close-button {
      position: absolute;
      top: 10px;
      right: 10px;
      width: 32px;
      height: 32px;
      border: none;
      background: rgba(0, 0, 0, 0.1);
      border-radius: 50%;
      font-size: 20px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10;
      color: #333;
    }
    
    #payment-gateway-modal .close-button:hover {
      background: rgba(0, 0, 0, 0.2);
    }
    
    #payment-gateway-modal iframe {
      width: 100%;
      height: 600px;
      border: none;
    }
    
    @media (max-width: 480px) {
      #payment-gateway-modal .modal-content {
        max-width: 100%;
        height: 100%;
        max-height: 100%;
        border-radius: 0;
      }
      
      #payment-gateway-modal iframe {
        height: 100%;
      }
    }
  `;

  // PaymentGateway constructor
  function PaymentGateway(options) {
    if (!options) {
      throw new Error("PaymentGateway: options are required");
    }

    if (!options.key) {
      throw new Error("PaymentGateway: API key is required");
    }

    if (!options.orderId) {
      throw new Error("PaymentGateway: Order ID is required");
    }

    this.options = {
      key: options.key,
      orderId: options.orderId,
      onSuccess: options.onSuccess || function () {},
      onFailure: options.onFailure || function () {},
      onClose: options.onClose || function () {},
    };

    this.modal = null;
    this.iframe = null;
    this._messageHandler = null;
    this._injectStyles();
  }

  PaymentGateway.prototype._injectStyles = function () {
    if (document.getElementById("payment-gateway-styles")) {
      return;
    }
    var styleEl = document.createElement("style");
    styleEl.id = "payment-gateway-styles";
    styleEl.textContent = styles;
    document.head.appendChild(styleEl);
  };

  PaymentGateway.prototype._getCheckoutUrl = function () {
    // Determine the SDK host
    var scripts = document.getElementsByTagName("script");
    var sdkScript = null;
    for (var i = 0; i < scripts.length; i++) {
      if (scripts[i].src && scripts[i].src.indexOf("checkout.js") !== -1) {
        sdkScript = scripts[i];
        break;
      }
    }

    var baseUrl = "http://localhost:3001";
    if (sdkScript) {
      var url = new URL(sdkScript.src);
      baseUrl = url.origin;
    }

    return (
      baseUrl +
      "/checkout?order_id=" +
      encodeURIComponent(this.options.orderId) +
      "&key=" +
      encodeURIComponent(this.options.key) +
      "&embedded=true"
    );
  };

  PaymentGateway.prototype.open = function () {
    var self = this;

    // Create modal structure
    this.modal = document.createElement("div");
    this.modal.id = "payment-gateway-modal";
    this.modal.setAttribute("data-test-id", "payment-modal");

    var overlay = document.createElement("div");
    overlay.className = "modal-overlay";
    overlay.onclick = function () {
      self.close();
    };

    var content = document.createElement("div");
    content.className = "modal-content";

    var closeBtn = document.createElement("button");
    closeBtn.className = "close-button";
    closeBtn.setAttribute("data-test-id", "close-modal-button");
    closeBtn.innerHTML = "×";
    closeBtn.onclick = function (e) {
      e.stopPropagation();
      self.close();
    };

    this.iframe = document.createElement("iframe");
    this.iframe.setAttribute("data-test-id", "payment-iframe");
    this.iframe.src = this._getCheckoutUrl();
    this.iframe.allow = "payment";

    content.appendChild(closeBtn);
    content.appendChild(this.iframe);
    this.modal.appendChild(overlay);
    this.modal.appendChild(content);

    document.body.appendChild(this.modal);
    document.body.style.overflow = "hidden";

    // Set up message listener
    this._messageHandler = function (event) {
      var data = event.data;

      if (!data || !data.type) {
        return;
      }

      switch (data.type) {
        case "payment_success":
          self.options.onSuccess(data.data);
          self.close();
          break;
        case "payment_failed":
          self.options.onFailure(data.data);
          break;
        case "close_modal":
          self.close();
          break;
      }
    };

    window.addEventListener("message", this._messageHandler);
  };

  PaymentGateway.prototype.close = function () {
    if (this.modal) {
      document.body.removeChild(this.modal);
      this.modal = null;
      this.iframe = null;
      document.body.style.overflow = "";
    }

    if (this._messageHandler) {
      window.removeEventListener("message", this._messageHandler);
      this._messageHandler = null;
    }

    this.options.onClose();
  };

  // Expose globally
  window.PaymentGateway = PaymentGateway;
})(window);
