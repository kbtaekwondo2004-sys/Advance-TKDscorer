const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);

app.get("/healthz", (req, res) => {
  res.status(200).json({
    status: "ok",
    service: "Advance TKDScorer Server"
  });
});

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 10000;

app.get("/", (req, res) => {
  res.json({
    name: "Advance TKDScorer Server",
    status: "online",
    version: "1.0.0"
  });
});

io.on("connection", (socket) => {
  console.log("Judge connected:", socket.id);

  socket.on("join", (data) => {
    console.log("JOIN:", data);

    if (data && data.code) {
      socket.join(data.code);

      socket.emit("joined", {
        success: true,
        code: data.code,
        role: data.role || "judge"
      });
    }
  });

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

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Advance TKDScorer server running on port ${PORT}`);
});
