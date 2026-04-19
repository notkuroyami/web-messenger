import { NextApiRequest, NextApiResponse } from "next";
import { Server as ServerIO } from "socket.io";
import { Server as NetServer } from "http";
import { Socket as NetSocket } from "net";

export const config = { api: { bodyParser: false } };

interface NetServerWithIO extends NetServer {
  io?: ServerIO;
}
interface NetSocketWithServer extends NetSocket {
  server: NetServerWithIO;
}
type NextApiResponseServerIO = NextApiResponse & {
  socket: NetSocketWithServer;
};

const socketHandler = (req: NextApiRequest, res: NextApiResponseServerIO) => {
  if (!res.socket.server.io) {
    const io = new ServerIO(res.socket.server, {
      path: "/api/socket",
      addTrailingSlash: false,
      cors: { origin: "*" },
    });
    res.socket.server.io = io;

    io.on("connection", (socket) => {
      // Вход в комнату (чат или группа)
      socket.on("join-chat", (chatId) => {
        socket.join(chatId);
        console.log(`User joined room: ${chatId}`);
      });

      // Отправка сообщения всем в комнате
      socket.on("send-message", (data) => {
        if (data.chatId) {
          // Используем io.to, чтобы сообщение получили ВСЕ, включая отправителя
          io.to(data.chatId).emit("receive-message", data);
        }
      });

      // Статус прочтения
      socket.on("mark-as-read", ({ chatId, reader }) => {
        // Рассылаем всем в этой комнате, что сообщения прочитаны пользователем reader
        socket.to(chatId).emit("messages-read-update", { chatId, reader });
      });

      // Печатает...
      socket.on("typing", (data) => {
        if (data.chatId) {
          socket.to(data.chatId).emit("user-typing", data);
        }
      });

      socket.on("disconnect", () => {
        console.log("User disconnected");
      });
    });
  }
  res.end();
};

export default socketHandler;
