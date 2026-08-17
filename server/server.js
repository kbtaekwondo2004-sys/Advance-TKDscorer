const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Health check
app.get("/healthz", (req, res) => {
  res.status(200).json({
    status: "ok",
    service: "Advance TKDScorer Server"
  });
});

// Basic test
app.get("/", (req, res) => {
  res.status(200).send("Advance TKDScorer Server is running");
});

// Socket connection
io.on("connection", (socket) => {
  console.log("Judge connected:", socket.id);

  socket.on("score", (data) => {
    console.log("SCORE:", data);

    if (data && data.code) {
      socket.to(data.code).emit("score", data);
    }
  });

  socket.on("gameroom", (data) => {
    console.log("GAMEROOM:", data);

    if (data && data.code) {
      socket.to(data.code).emit("gameroom", data);
    }
  });

  socket.on("disconnect", () => {
    console.log("Judge disconnected:", socket.id);
  });
});

const PORT = process.env.PORT || 10000;

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Advance TKDScorer server running on port ${PORT}`);
});
