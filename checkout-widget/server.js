const express = require("express");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3001;

// Enable CORS for SDK
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept"
  );
  next();
});

// Serve the SDK JavaScript file
app.get("/checkout.js", (req, res) => {
  res.setHeader("Content-Type", "application/javascript");
  res.sendFile(path.join(__dirname, "dist", "checkout.js"));
});

// Serve static files from build directory
app.use(express.static(path.join(__dirname, "build")));

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "healthy" });
});

// Serve React app for all other routes
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "build", "index.html"));
});

app.listen(PORT, () => {
  console.log(`Checkout widget server running on port ${PORT}`);
});
