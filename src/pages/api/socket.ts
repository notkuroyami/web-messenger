import { NextApiRequest, NextApiResponse } from "next";
import { Server as NetServer } from "http";
import { Server as ServerIO } from "socket.io";
import { Socket as NetSocket } from "net";

interface NetServerWithIO extends NetServer {
  io?: ServerIO;
}
interface NetSocketWithServer extends NetSocket {
  server: NetServerWithIO;
}
export type NextApiResponseServerIO = NextApiResponse & {
  socket: NetSocketWithServer;
};

interface ISocketMessage {
  chatId: string;
  _id?: string;
  sender?: string;
  text?: string;
  type?: "message" | "update" | "delete";
  [key: string]: unknown;
}

export const config = { api: { bodyParser: false } };

const socketHandler = (
  req: NextApiRequest,
  res: NextApiResponseServerIO,
): void => {
  if (!res.socket.server.io) {
    console.log("Socket is initializing");
    const io = new ServerIO(res.socket.server, {
      path: "/api/socket",
      addTrailingSlash: false,
    });
    res.socket.server.io = io;

    io.on("connection", (socket) => {
      socket.on("join-chat", (chatId: string) => {
        // Выходим из всех предыдущих комнат чатов перед входом в новую
        const rooms = Array.from(socket.rooms);
        rooms.forEach((room) => {
          if (room !== socket.id) socket.leave(room);
        });
        socket.join(chatId);
      });

      socket.on("user-online", (username: string) => {
        socket.data.username = username;
        socket.broadcast.emit("update-status", { username, online: true });
      });

      socket.on(
        "typing",
        (data: { chatId: string; username: string; isTyping: boolean }) => {
          socket.to(data.chatId).emit("user-typing", {
            username: data.username,
            isTyping: data.isTyping,
          });
        },
      );

      socket.on("send-message", (data: ISocketMessage) => {
        if (data.chatId) {
          socket.to(data.chatId).emit("receive-message", data);
        }
      });

      socket.on("mark-as-read", (data: { chatId: string; reader: string }) => {
        // Отправляем собеседнику в ту же комнату, что его сообщения прочитаны
        socket
          .to(data.chatId)
          .emit("messages-read-update", { reader: data.reader });
      });

      socket.on("disconnect", () => {
        if (socket.data.username) {
          socket.broadcast.emit("update-status", {
            username: socket.data.username,
            online: false,
          });
        }
      });
    });
  }
  res.end();
};

export default socketHandler;
