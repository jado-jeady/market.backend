import { Server } from "socket.io";

let io;

export const initSocket = (httpServer) => {
  io = new Server(httpServer, {
    cors: {
      origin: [
        "http://localhost:3000",
        "https://marketfrontend.vercel.app",
        "https://market-frontend-olive.vercel.app",
        "http://192.168.1.48:3000",
        "http://192.168.1.48:8888",
        "https://bitter-breeze-52de.rwandamasteryhub2024.workers.dev/",
      ],
      methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    },
  });

  io.on("connection", (socket) => {
    console.log("Client connected:", socket.id);

    // 🔑 Handle role joining
    socket.on("joinRole", (role) => {
      socket.join(role);
      console.log(`Socket ${socket.id} joined role room: ${role}`);
    });

    socket.on("disconnect", () => {
      console.log("Client disconnected:", socket.id);
    });
  });

  return io;
};

export const getIO = () => {
  if (!io) throw new Error("Socket.io not initialized");
  return io;
};
