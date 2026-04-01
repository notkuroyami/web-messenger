"use client";

import React, { useState, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

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
}

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

  const messageEndRef = useRef<HTMLDivElement>(null);
  const currentUser = session?.user?.name || "";

  // Перенаправление если не авторизован
  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/login");
    }
  }, [status, router]);

  // Поиск пользователей
  useEffect(() => {
    const delay = setTimeout(async () => {
      if (searchQuery && currentUser) {
        const res = await fetch(`/api/users/search?q=${searchQuery}`);
        if (res.ok) {
          const data = await res.json();
          setSearchResults(
            data.filter((u: User) => u.username !== currentUser),
          );
        }
      } else {
        setSearchResults([]);
      }
    }, 300);
    return () => clearTimeout(delay);
  }, [searchQuery, currentUser]);

  // Загрузка сообщений и статус "прочитано"
  useEffect(() => {
    let isMounted = true;

    if (selectedUser && currentUser) {
      const fetchMsgs = async () => {
        try {
          const res = await fetch(
            `/api/messages?user1=${currentUser}&user2=${selectedUser.username}`,
          );

          if (res.ok && isMounted) {
            const data: IMessage[] = await res.json();
            setMessages(data);

            if (data.length > 0) {
              const lastMsg = data[data.length - 1];
              if (lastMsg.sender !== currentUser && !lastMsg.seen) {
                const resRead = await fetch("/api/messages/read", {
                  method: "PUT",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    sender: selectedUser.username,
                    receiver: currentUser,
                  }),
                });

                if (resRead.ok && isMounted) {
                  setMessages((prev) =>
                    prev.map((m) => ({ ...m, seen: true })),
                  );
                }
              }
            }
          }
        } catch (err) {
          console.error("Ошибка загрузки сообщений:", err);
        }
      };

      fetchMsgs();
      const interval = setInterval(fetchMsgs, 3000);
      return () => {
        isMounted = false;
        clearInterval(interval);
      };
    }
  }, [selectedUser, currentUser]);

  // Список недавних чатов
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
      const interval = setInterval(fetchRecent, 5000);
      return () => clearInterval(interval);
    }
  }, [currentUser]);

  // Скролл вниз
  useEffect(() => {
    if (messageEndRef.current) {
      messageEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  // Универсальная функция: Отправка или Редактирование
  const handleAction = async () => {
    if (!newMessage.trim() || !selectedUser || !currentUser) return;

    if (editingMessage) {
      try {
        // ОБНОВЛЕНО: Используем query param ?id=
        const res = await fetch(`/api/messages?id=${editingMessage._id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: newMessage }),
        });
        if (res.ok) {
          setMessages((prev) =>
            prev.map((m) =>
              m._id === editingMessage._id
                ? { ...m, text: newMessage, isEdited: true }
                : m,
            ),
          );
          setEditingMessage(null);
          setNewMessage("");
        }
      } catch (err) {
        console.error("Ошибка PATCH:", err);
      }
    } else {
      const body = {
        sender: currentUser,
        receiver: selectedUser.username,
        text: newMessage,
      };
      try {
        const res = await fetch("/api/messages", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (res.ok) {
          const saved = await res.json();
          setMessages((prev) => [...prev, saved]);
          setNewMessage("");
        }
      } catch (err) {
        console.error("Ошибка POST:", err);
      }
    }
  };

  // Удаление сообщения
  const deleteMessage = async (messageId: string) => {
    if (!confirm("Удалить сообщение?")) return;

    try {
      const res = await fetch(`/api/messages?id=${messageId}`, {
        method: "DELETE",
      });

      if (res.ok) {
        // Испольуем filter, чтобы оставить в стейте только те сообщения,
        // ID которых НЕ совпадает с удаленным
        setMessages((prev) => prev.filter((m) => m._id !== messageId));
      } else {
        console.error("Ошибка при удалении на сервере");
      }
    } catch (error) {
      console.error("Ошибка сети:", error);
    }
  };

  if (status === "loading") {
    return (
      <div className="h-screen bg-black text-white flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mr-3"></div>
        Загрузка сессии...
      </div>
    );
  }

  if (!session) return null;

  return (
    <div className="flex h-screen bg-black text-white font-sans">
      {/* Боковая панель */}
      <aside className="w-80 bg-[#121212] m-2 rounded-2xl border border-gray-800 flex flex-col">
        <div className="p-4 border-b border-gray-800">
          <p className="text-xs text-gray-500 uppercase font-bold text-[10px]">
            Logged in as
          </p>
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
              <p className="px-3 py-2 text-[10px] text-gray-500 uppercase tracking-widest font-bold">
                Recent Chats
              </p>
              {recentChats.map((username) => (
                <div
                  key={username}
                  onClick={() => setSelectedUser({ _id: username, username })}
                  className={`p-3 mb-1 rounded-xl cursor-pointer hover:bg-[#1e1e1e] transition ${selectedUser?.username === username ? "bg-[#1e1e1e] border border-gray-700" : "border border-transparent"}`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-900 flex items-center justify-center text-[10px]">
                      {username[0].toUpperCase()}
                    </div>
                    <span className="text-sm">{username}</span>
                  </div>
                </div>
              ))}
            </>
          ) : (
            <>
              <p className="px-3 py-2 text-[10px] text-gray-500 uppercase tracking-widest font-bold">
                Search Results
              </p>
              {searchResults.map((user) => (
                <div
                  key={user._id}
                  onClick={() => {
                    setSelectedUser(user);
                    setSearchQuery("");
                  }}
                  className="p-3 mb-1 rounded-xl cursor-pointer hover:bg-[#1e1e1e] transition border border-transparent"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center text-[10px] text-gray-300">
                      ?
                    </div>
                    <span className="text-sm">{user.username}</span>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      </aside>

      {/* Основной чат */}
      <main className="flex-1 flex flex-col m-2 ml-0 bg-[#0a0a0a] rounded-2xl border border-gray-800 overflow-hidden">
        {selectedUser ? (
          <>
            <div className="p-4 border-b border-gray-800 bg-[#121212] flex justify-between items-center">
              <span className="font-bold text-lg">{selectedUser.username}</span>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.map((msg) => (
                <div
                  key={msg._id}
                  className={`flex ${msg.sender === currentUser ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`group relative p-3 rounded-2xl max-w-[70%] shadow-sm transition-all ${
                      msg.sender === currentUser
                        ? "bg-blue-600 text-white"
                        : "bg-[#1e1e1e] text-gray-200"
                    }`}
                  >
                    <p
                      className={`text-sm ${msg.isDeleted ? "italic opacity-50" : ""}`}
                    >
                      {msg.text}
                    </p>

                    <div className="flex items-center justify-end gap-1 mt-1 opacity-60 text-[9px]">
                      {msg.isEdited && !msg.isDeleted && (
                        <span className="italic mr-1">edited</span>
                      )}
                      {msg.sender === currentUser && (
                        <span>{msg.seen ? "✓✓" : "✓"}</span>
                      )}
                    </div>

                    {msg.sender === currentUser && !msg.isDeleted && (
                      <div className="absolute -left-14 top-1/2 -translate-y-1/2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-[#121212] p-1 rounded-lg border border-gray-800 z-10">
                        <button
                          onClick={() => {
                            setEditingMessage(msg);
                            setNewMessage(msg.text);
                          }}
                          className="hover:text-blue-400 p-1 text-xs"
                          title="Edit"
                        >
                          ✏️
                        </button>
                        <button
                          onClick={() => deleteMessage(msg._id)}
                          className="hover:text-red-500 p-1 text-xs"
                          title="Delete"
                        >
                          🗑️
                        </button>
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
                  <button
                    onClick={() => {
                      setEditingMessage(null);
                      setNewMessage("");
                    }}
                    className="text-red-500 hover:underline"
                  >
                    Cancel
                  </button>
                </div>
              )}
              <div className="flex gap-2">
                <input
                  className="flex-1 bg-[#1e1e1e] p-3 rounded-xl outline-none border border-transparent focus:border-gray-700 transition text-sm"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAction()}
                  placeholder="Write a message..."
                />
                <button
                  onClick={handleAction}
                  className={`${editingMessage ? "bg-green-600 hover:bg-green-500" : "bg-blue-600 hover:bg-blue-500"} px-6 rounded-xl transition-all font-bold text-xs uppercase tracking-widest active:scale-95`}
                >
                  {editingMessage ? "Save" : "Send"}
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-600">
            <div className="w-16 h-16 bg-[#121212] rounded-full mb-4 flex items-center justify-center text-2xl">
              💬
            </div>
            <p className="text-sm">Select a user to start chatting</p>
          </div>
        )}
      </main>
    </div>
  );
}
