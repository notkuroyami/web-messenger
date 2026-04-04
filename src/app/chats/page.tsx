"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import io, { Socket } from "socket.io-client";

interface User {
  _id: string;
  username: string;
}

interface IMessage {
  _id: string;
  sender: string;
  text: string;
  timestamp: string;
  seen?: boolean;
  isEdited: boolean;
  isDeleted: boolean;
  chatId?: string;
  type?: "message" | "update" | "delete";
}

let socket: Socket | null = null;

export default function ChatsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [messages, setMessages] = useState<IMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [recentChats, setRecentChats] = useState<string[]>([]);
  const [editingMessage, setEditingMessage] = useState<IMessage | null>(null);

  const [isPeerTyping, setIsPeerTyping] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());

  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const messageEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null); // Реф для контейнера сообщений
  const selectedUserRef = useRef<User | null>(null);

  const currentUser = session?.user?.name || "";
  const getRoomId = (u1: string, u2: string) => [u1, u2].sort().join("-");

  const markAllAsRead = useCallback(async (senderName: string) => {
    if (!senderName || !currentUser || !document.hasFocus()) return;

    try {
      const res = await fetch("/api/messages/read", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sender: senderName,
          receiver: currentUser,
        }),
      });

      if (res.ok) {
        setMessages((prev) =>
          prev.map((m) => (m.sender === senderName ? { ...m, seen: true } : m))
        );

        if (socket) {
          const roomId = getRoomId(currentUser, senderName);
          socket.emit("mark-as-read", {
            chatId: roomId,
            reader: currentUser,
          });
        }
      }
    } catch (err) {
      console.error("Error marking messages as read:", err);
    }
  }, [currentUser]);

  useEffect(() => {
    selectedUserRef.current = selectedUser;
  }, [selectedUser]);

  // 1. Socket.io
  useEffect(() => {
    if (!currentUser) return;

    const socketInitializer = async () => {
      await fetch("/api/socket");

      if (!socket) {
        socket = io({ path: "/api/socket" });

        socket.on("connect", () => {
          socket?.emit("user-online", currentUser);
        });

        socket.on("receive-message", async (data: IMessage) => {
          const currentRoomId = selectedUserRef.current
            ? getRoomId(currentUser, selectedUserRef.current.username)
            : null;

          if (data.chatId === currentRoomId) {
            if (data.type === "delete") {
              setMessages((prev) => prev.filter((m) => m._id !== data._id));
            } else if (data.type === "update") {
              setMessages((prev) =>
                prev.map((m) =>
                  m._id === data._id ? { ...m, text: data.text, isEdited: true } : m
                )
              );
            } else {
              setMessages((prev) => [...prev, data]);
              if (document.hasFocus()) {
                markAllAsRead(data.sender);
              }
            }
          }
        });

        socket.on("messages-read-update", (data: { reader: string }) => {
          if (selectedUserRef.current?.username === data.reader) {
            setMessages((prev) =>
              prev.map((m) => (m.sender !== data.reader ? { ...m, seen: true } : m))
            );
          }
        });

        socket.on("user-typing", (data: { username: string; isTyping: boolean }) => {
          if (selectedUserRef.current?.username === data.username) {
            setIsPeerTyping(data.isTyping);
          }
        });

        socket.on("update-status", (data: { username: string; online: boolean }) => {
          setOnlineUsers((prev) => {
            const next = new Set(prev);
            data.online ? next.add(data.username) : next.delete(data.username);
            return next;
          });
        });
      }
    };

    socketInitializer();

    return () => {
      socket?.off("receive-message");
      socket?.off("messages-read-update");
      socket?.off("user-typing");
      socket?.off("update-status");
    };
  }, [currentUser, markAllAsRead]);

  // Focus
  useEffect(() => {
    const handleFocus = () => {
      if (selectedUser) markAllAsRead(selectedUser.username);
    };
    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [selectedUser, markAllAsRead]);

  // 2. Join
  useEffect(() => {
    if (socket && selectedUser && currentUser) {
      const roomId = getRoomId(currentUser, selectedUser.username);
      socket.emit("join-chat", roomId);
      setIsPeerTyping(false);
    }
  }, [selectedUser, currentUser]);

  // 3. Auth
  useEffect(() => {
    if (status === "unauthenticated") router.replace("/login");
  }, [status, router]);

  // 4. Search
  useEffect(() => {
    const delay = setTimeout(async () => {
      if (searchQuery && currentUser) {
        const res = await fetch(`/api/users/search?q=${searchQuery}`);
        if (res.ok) {
          const data = await res.json();
          setSearchResults(data.filter((u: User) => u.username !== currentUser));
        }
      } else {
        setSearchResults([]);
      }
    }, 300);
    return () => clearTimeout(delay);
  }, [searchQuery, currentUser]);

  // 5. Load Messages
  useEffect(() => {
    let isMounted = true;
    if (selectedUser && currentUser) {
      const fetchMsgs = async () => {
        try {
          const res = await fetch(
            `/api/messages?user1=${currentUser}&user2=${selectedUser.username}`
          );
          if (res.ok && isMounted) {
            const data: IMessage[] = await res.json();
            setMessages(data);
            markAllAsRead(selectedUser.username);
          }
        } catch (err) {
          console.error("Error fetching messages:", err);
        }
      };
      fetchMsgs();
    }
    return () => { isMounted = false; };
  }, [selectedUser, currentUser, markAllAsRead]);

  // 6. Recent
  useEffect(() => {
    if (currentUser) {
      const fetchRecent = async () => {
        const res = await fetch(`/api/chats/recent?user=${currentUser}`);
        if (res.ok) {
          const data = await res.json();
          setRecentChats(data);
        }
      };
      fetchRecent();
    }
  }, [currentUser, messages]);

  // Умный автоскролл
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    // Проверка: находится ли юзер внизу (с допуском 100px)
    const isAtBottom = container.scrollHeight - container.scrollTop <= container.clientHeight + 100;
    
    const lastMessage = messages[messages.length - 1];
    const iAmSender = lastMessage?.sender === currentUser;

    // Скроллим только если отправил я ИЛИ если юзер уже был внизу
    if (iAmSender || isAtBottom) {
      messageEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, currentUser]);

  const handleTyping = () => {
    if (!socket || !selectedUser) return;
    const roomId = getRoomId(currentUser, selectedUser.username);
    socket.emit("typing", { chatId: roomId, username: currentUser, isTyping: true });

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      socket?.emit("typing", { chatId: roomId, username: currentUser, isTyping: false });
    }, 2000);
  };

  const handleAction = async () => {
    if (!newMessage.trim() || !selectedUser || !currentUser || !socket) return;
    const roomId = getRoomId(currentUser, selectedUser.username);

    if (editingMessage) {
      const res = await fetch(`/api/messages?id=${editingMessage._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: newMessage }),
      });
      if (res.ok) {
        const updated = { ...editingMessage, text: newMessage, isEdited: true, type: "update", chatId: roomId } as IMessage;
        setMessages((prev) => prev.map((m) => (m._id === editingMessage._id ? updated : m)));
        socket?.emit("send-message", updated);
        setEditingMessage(null);
        setNewMessage("");
      }
    } else {
      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sender: currentUser, receiver: selectedUser.username, text: newMessage }),
      });
      if (res.ok) {
        const saved = await res.json();
        const socketMsg = { ...saved, chatId: roomId, type: "message" };
        setMessages((prev) => [...prev, saved]);
        socket?.emit("send-message", socketMsg);
        setNewMessage("");
        socket?.emit("typing", { chatId: roomId, username: currentUser, isTyping: false });
      }
    }
  };

  const deleteMessage = async (messageId: string) => {
    if (!confirm("Удалить сообщение?") || !selectedUser || !socket) return;
    const roomId = getRoomId(currentUser, selectedUser.username);
    const res = await fetch(`/api/messages?id=${messageId}`, { method: "DELETE" });
    if (res.ok) {
      setMessages((prev) => prev.filter((m) => m._id !== messageId));
      socket?.emit("send-message", { _id: messageId, chatId: roomId, type: "delete" });
    }
  };

  if (status === "loading") return <div className="h-screen bg-black text-white flex items-center justify-center">Загрузка...</div>;
  if (!session) return null;

  return (
    <div className="flex h-screen bg-black text-white font-sans">
      <aside className="w-80 bg-[#121212] m-2 rounded-2xl border border-gray-800 flex flex-col">
        <div className="p-4 border-b border-gray-800">
          <p className="text-xs text-gray-500 uppercase font-bold text-[10px]">Logged in as</p>
          <p className="text-blue-400 font-medium">{currentUser}</p>
        </div>
        <input
          className="m-4 p-3 bg-[#1e1e1e] rounded-xl outline-none border border-transparent focus:border-blue-600 transition text-sm"
          placeholder="Search users..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        <div className="flex-1 overflow-y-auto px-2">
          {searchQuery.trim() === "" ? (
            <>
              <p className="px-3 py-2 text-[10px] text-gray-500 uppercase tracking-widest font-bold">Recent Chats</p>
              {recentChats.map((username) => (
                <div
                  key={username}
                  onClick={() => setSelectedUser({ _id: username, username })}
                  className={`p-3 mb-1 rounded-xl cursor-pointer hover:bg-[#1e1e1e] transition ${selectedUser?.username === username ? "bg-[#1e1e1e] border border-gray-700" : "border border-transparent"}`}
                >
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-900 flex items-center justify-center text-[10px]">{username[0].toUpperCase()}</div>
                      {onlineUsers.has(username) && <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 border-2 border-[#121212] rounded-full"></div>}
                    </div>
                    <span className="text-sm">{username}</span>
                  </div>
                </div>
              ))}
            </>
          ) : (
            searchResults.map((user) => (
              <div key={user._id} onClick={() => { setSelectedUser(user); setSearchQuery(""); }} className="p-3 mb-1 rounded-xl cursor-pointer hover:bg-[#1e1e1e] transition border border-transparent">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center text-[10px]">?</div>
                  <span className="text-sm">{user.username}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </aside>

      <main className="flex-1 flex flex-col m-2 ml-0 bg-[#0a0a0a] rounded-2xl border border-gray-800 overflow-hidden">
        {selectedUser ? (
          <>
            <div className="p-4 border-b border-gray-800 bg-[#121212] flex justify-between items-center">
              <div className="flex items-center gap-2">
                <span className="font-bold text-lg">{selectedUser.username}</span>
                {onlineUsers.has(selectedUser.username) && <span className="text-[15px] text-green-500 uppercase font-bold tracking-tighter">●</span>}
                {isPeerTyping && (
                <div className="flex justify-start">
                  <div className="bg-[#1e1e1e] px-4 py-2 rounded-2xl text-[11px] text-blue-400 animate-pulse">typing...</div>
                </div>
              )}
              </div>
            </div>
            {/* Добавлен ref=scrollContainerRef */}
            <div ref={scrollContainerRef} className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.map((msg) => (
                <div key={msg._id} className={`flex ${msg.sender === currentUser ? "justify-end" : "justify-start"}`}>
                  <div className={`group relative p-3 rounded-2xl max-w-[70%] shadow-sm transition-all ${msg.sender === currentUser ? "bg-blue-600 text-white" : "bg-[#1e1e1e] text-gray-200"}`}>
                    <p className={`text-sm ${msg.isDeleted ? "italic opacity-50" : ""}`}>{msg.text}</p>
                    <div className="flex items-center justify-end gap-1 mt-1 opacity-60 text-[9px]">
                      {msg.isEdited && !msg.isDeleted && <span className="italic mr-1">edited</span>}
                      {msg.sender === currentUser && <span>{msg.seen ? "✓✓" : "✓"}</span>}
                    </div>
                    {msg.sender === currentUser && !msg.isDeleted && (
                      <div className="absolute -left-14 top-1/2 -translate-y-1/2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-[#121212] p-1 rounded-lg border border-gray-800 z-10">
                        <button onClick={() => { setEditingMessage(msg); setNewMessage(msg.text); }} className="hover:text-blue-400 p-1 text-xs">✏️</button>
                        <button onClick={() => deleteMessage(msg._id)} className="hover:text-red-500 p-1 text-xs">🗑️</button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              <div ref={messageEndRef} />
            </div>
            <div className="p-4 bg-[#121212] flex flex-col gap-2 border-t border-gray-800">
              {editingMessage && (
                <div className="flex justify-between items-center text-[10px] text-blue-400 px-2 font-bold uppercase tracking-widest">
                  <span>Editing Message</span>
                  <button onClick={() => { setEditingMessage(null); setNewMessage(""); }} className="text-red-500 hover:underline">Cancel</button>
                </div>
              )}
              <div className="flex gap-2">
                <input
                  className="flex-1 bg-[#1e1e1e] p-3 rounded-xl outline-none border border-transparent focus:border-gray-700 transition text-sm"
                  value={newMessage}
                  onChange={(e) => { setNewMessage(e.target.value); handleTyping(); }}
                  onKeyDown={(e) => e.key === "Enter" && handleAction()}
                  placeholder="Write a message..."
                />
                <button onClick={handleAction} className={`${editingMessage ? "bg-green-600 hover:bg-green-500" : "bg-blue-600 hover:bg-blue-500"} px-6 rounded-xl transition-all font-bold text-xs uppercase tracking-widest active:scale-95`}>
                  {editingMessage ? "Save" : "Send"}
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-600">
            <div className="w-16 h-16 bg-[#121212] rounded-full mb-4 flex items-center justify-center text-2xl">💬</div>
            <p className="text-sm">Select a user to start chatting</p>
          </div>
        )}
      </main>
    </div>
  );
}