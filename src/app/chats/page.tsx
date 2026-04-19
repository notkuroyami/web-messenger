"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useSession, signOut } from "next-auth/react";
import io, { Socket } from "socket.io-client";
import { initE2E, encryptMessage, decryptMessage } from "@/lib/crypto";

// Интерфейсы
interface User {
  _id: string;
  username: string;
}
interface IMessage {
  _id: string;
  sender: string;
  text: string;
  timestamp: string;
  chatId: string;
  seen?: boolean;
}
interface IChat {
  _id: string;
  name: string;
  type: "direct" | "group" | "channel";
  participants: string[];
}

// Обновленный компонент расшифровки с поддержкой кэша для своих сообщений
const DecryptedText = ({
  text,
  currentUser,
  sender,
}: {
  text: string;
  currentUser: string;
  sender: string;
}) => {
  const [decrypted, setDecrypted] = useState("🔒...");

  useEffect(() => {
    const attemptDecrypt = async () => {
      if (!text.includes("|")) {
        setDecrypted(text);
        return;
      }

      const [forMe, forPartner] = text.split("|");
      const targetCipher = sender === currentUser ? forMe : forPartner;

      try {
        const result = await decryptMessage(targetCipher, currentUser);
        setDecrypted(result || "❌ Ошибка");
      } catch (e) {
        setDecrypted("🔒 Ошибка расшифровки");
      }
    };
    attemptDecrypt();
  }, [text, currentUser, sender]);

  return <span>{decrypted}</span>;
};

let socket: Socket | null = null;

export default function ChatsPage() {
  const { data: session, status } = useSession();
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<User[]>([]);

  const [isGroupMode, setIsGroupMode] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState<User[]>([]);
  const [groupName, setGroupName] = useState("");

  const [selectedChat, setSelectedChat] = useState<IChat | null>(null);
  const [recentChats, setRecentChats] = useState<IChat[]>([]);
  const [messages, setMessages] = useState<IMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [isPeerTyping, setIsPeerTyping] = useState(false);
  const [isWindowFocused, setIsWindowFocused] = useState(true);
  const [editingMessage, setEditingMessage] = useState<IMessage | null>(null);

  // Кэш для хранения открытого текста отправленных сообщений в текущей сессии
  const [sentMessagesCache, setSentMessagesCache] = useState<
    Record<string, string>
  >({});

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const messageEndRef = useRef<HTMLDivElement>(null);
  const isAtBottom = useRef(true);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const selectedChatRef = useRef<IChat | null>(null);
  const currentUser = session?.user?.name || "";

  useEffect(() => {
    selectedChatRef.current = selectedChat;
  }, [selectedChat]);

  useEffect(() => {
    if (status === "authenticated" && currentUser) {
      initE2E(currentUser);
    }
  }, [status, currentUser]);

  const handleScroll = () => {
    const container = scrollContainerRef.current;
    if (container) {
      const distanceFromBottom =
        container.scrollHeight - container.scrollTop - container.clientHeight;
      isAtBottom.current = distanceFromBottom < 100;
    }
  };

  useEffect(() => {
    if (messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      if (lastMessage.sender === currentUser || isAtBottom.current) {
        messageEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }
    }
  }, [messages, currentUser]);

  useEffect(() => {
    const onFocus = () => setIsWindowFocused(true);
    const onBlur = () => setIsWindowFocused(false);
    window.addEventListener("focus", onFocus);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("blur", onBlur);
    };
  }, []);

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      if (searchQuery.trim().length > 0) {
        fetch(`/api/users?query=${encodeURIComponent(searchQuery)}`)
          .then((res) => res.json())
          .then((data) => {
            setSearchResults(
              data.filter((u: User) => u.username !== currentUser),
            );
          })
          .catch((err) => console.error("Search error:", err));
      } else {
        setSearchResults([]);
      }
    }, 300);
    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery, currentUser]);

  const fetchRecentChats = useCallback(async () => {
    if (!currentUser) return;
    try {
      const res = await fetch(
        `/api/chats?username=${encodeURIComponent(currentUser)}`,
      );
      if (res.ok) setRecentChats(await res.json());
    } catch (err) {
      console.error(err);
    }
  }, [currentUser]);

  useEffect(() => {
    fetchRecentChats();
  }, [fetchRecentChats]);

  const createGroupChat = async () => {
    if (selectedUsers.length < 1 || !groupName.trim()) return;
    const res = await fetch("/api/chats", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        participants: [currentUser, ...selectedUsers.map((u) => u.username)],
        type: "group",
        name: groupName.trim(),
      }),
    });
    if (res.ok) {
      const newChat = await res.json();
      setSelectedChat(newChat);
      setIsGroupMode(false);
      setSelectedUsers([]);
      setGroupName("");
      setSearchQuery("");
      fetchRecentChats();
    }
  };

  const markAsRead = useCallback(
    async (chatId: string) => {
      // Убираем лишние проверки, оставляем только самые необходимые
      if (!currentUser || !socket) return;

      try {
        await fetch("/api/messages/read", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chatId, username: currentUser }),
        });

        // Отправляем сигнал всем участникам, что мы прочитали сообщения
        socket.emit("mark-as-read", { chatId, reader: currentUser });
      } catch (err) {
        console.error("Read update error:", err);
      }
    },
    [currentUser],
  );

  const deleteMessage = async (messageId: string) => {
    if (!confirm("Удалить сообщение?")) return;

    try {
      const res = await fetch(`/api/messages?messageId=${messageId}`, {
        method: "DELETE",
      });

      if (res.ok) {
        // Уведомляем других через сокет
        socket?.emit("delete-message", {
          messageId,
          chatId: selectedChat?._id,
        });
        // Удаляем у себя в интерфейсе
        setMessages((prev) => prev.filter((m) => m._id !== messageId));
      }
    } catch (err) {
      console.error("Delete error:", err);
    }
  };

  const startEdit = async (msg: IMessage) => {
    // Нам нужно расшифровать наше же сообщение из двойного шифра
    if (msg.text.includes("|")) {
      const [forMe] = msg.text.split("|");
      const originalText = await decryptMessage(forMe, currentUser);
      setNewMessage(originalText);
    } else {
      setNewMessage(msg.text);
    }

    setEditingMessage(msg);
  };

  const cancelEdit = () => {
    setEditingMessage(null);
    setNewMessage("");
  };

  const handleAction = async () => {
    if (!newMessage.trim() || !selectedChat || !socket) return;

    let textToDatabase = newMessage;

    // Логика шифрования (Double Encryption)
    if (selectedChat.type === "direct") {
      const partner = selectedChat.participants.find((p) => p !== currentUser);
      try {
        const resKey = await fetch(`/api/users/get-key?username=${partner}`);
        const { publicKey: partnerKey } = await resKey.json();
        const myPublicKey = localStorage.getItem(`publicKey_${currentUser}`);

        if (partnerKey && myPublicKey) {
          const encForPartner = await encryptMessage(newMessage, partnerKey);
          const encForMe = await encryptMessage(newMessage, myPublicKey);
          // Сохраняем в формате: МойШифр|ЕгоШифр
          textToDatabase = `${encForMe}|${encForPartner}`;
        }
      } catch (e) {
        console.error("Encryption error:", e);
      }
    }

    if (editingMessage) {
      // РЕДАКТИРОВАНИЕ
      try {
        const res = await fetch("/api/messages", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messageId: editingMessage._id,
            text: textToDatabase, // Отправляем новый двойной шифр
          }),
        });

        if (res.ok) {
          const updated = await res.json();
          socket.emit("update-message", updated);
          // Обновляем локальный стейт сообщений
          setMessages((prev) =>
            prev.map((m) => (m._id === updated._id ? updated : m)),
          );
          cancelEdit();
        }
      } catch (err) {
        console.error("Update error:", err);
      }
    } else {
      // ОТПРАВКА НОВОГО
      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sender: currentUser,
          chatId: selectedChat._id,
          text: textToDatabase,
        }),
      });

      if (res.ok) {
        const savedMsg = await res.json();
        socket.emit("send-message", savedMsg);
        setNewMessage("");
      }
    }
  };

  useEffect(() => {
    if (!currentUser) return;
    const initSocket = async () => {
      await fetch("/api/socket");
      if (!socket) {
        socket = io({ path: "/api/socket" });
        socket.on("receive-message", (data: IMessage) => {
          // Проверяем, относится ли сообщение к текущему открытому чату
          if (data.chatId === selectedChatRef.current?._id) {
            setMessages((prev) => {
              // Предотвращаем дубликаты
              if (prev.find((m) => m._id === data._id)) return prev;
              return [...prev, data];
            });

            // ГЛАВНОЕ: Если окно в фокусе и это сообщение от собеседника — помечаем как прочитанное
            if (data.sender !== currentUser && document.hasFocus()) {
              markAsRead(data.chatId);
            }
          }
          fetchRecentChats();
        });
        socket.on("message-updated", (updatedMsg: IMessage) => {
          if (updatedMsg.chatId === selectedChatRef.current?._id) {
            setMessages((prev) =>
              prev.map((m) => (m._id === updatedMsg._id ? updatedMsg : m)),
            );
          }
        });
        socket.on("message-deleted", ({ messageId }: { messageId: string }) => {
          setMessages((prev) => prev.filter((m) => m._id !== messageId));
        });
        socket.on("messages-read-update", (data) => {
          if (data.chatId === selectedChatRef.current?._id) {
            setMessages((prev) =>
              prev.map((m) =>
                m.sender !== data.reader ? { ...m, seen: true } : m,
              ),
            );
          }
        });
        socket.on("user-typing", (data) => {
          if (
            data.chatId === selectedChatRef.current?._id &&
            data.username !== currentUser
          ) {
            setIsPeerTyping(data.isTyping);
          }
        });
      }
    };
    initSocket();
  }, [currentUser, fetchRecentChats, markAsRead]);

  const handleTyping = () => {
    socket?.emit("typing", {
      chatId: selectedChat?._id,
      username: currentUser,
      isTyping: true,
    });
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      socket?.emit("typing", {
        chatId: selectedChat?._id,
        username: currentUser,
        isTyping: false,
      });
    }, 2000);
  };

  useEffect(() => {
    const handleFocus = () => {
      if (
        selectedChatRef.current &&
        messages.some((m) => m.sender !== currentUser && !m.seen)
      ) {
        markAsRead(selectedChatRef.current._id);
      }
    };

    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [currentUser, markAsRead, messages]);

  const handleSelectUser = async (targetUsername: string) => {
    const res = await fetch("/api/chats", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        participants: [currentUser, targetUsername],
        type: "direct",
      }),
    });
    if (res.ok) {
      const newChat = await res.json();
      setSelectedChat(newChat);
      setSearchQuery("");
      fetchRecentChats();
    }
  };

  useEffect(() => {
    if (selectedChat) {
      socket?.emit("join-chat", selectedChat._id);
      setIsPeerTyping(false);
      fetch(`/api/messages?chatId=${selectedChat._id}`)
        .then((res) => res.json())
        .then((data: IMessage[]) => {
          setMessages(data);
          isAtBottom.current = true;
          setTimeout(
            () => messageEndRef.current?.scrollIntoView({ behavior: "auto" }),
            50,
          );
          if (
            data.some((m) => m.sender !== currentUser && !m.seen) &&
            document.hasFocus()
          ) {
            markAsRead(selectedChat._id);
          }
        });
    }
  }, [selectedChat, currentUser, markAsRead]);

  const getChatDisplayName = (chat: IChat) =>
    chat.type === "direct"
      ? chat.participants.find((p) => p !== currentUser)
      : chat.name;

  if (status === "loading")
    return (
      <div className="h-screen bg-black flex items-center justify-center text-blue-500">
        Loading...
      </div>
    );

  return (
    <div className="flex h-screen bg-black text-white font-sans overflow-hidden">
      {/* Sidebar */}
      <aside className="w-80 bg-[#121212] m-2 rounded-2xl border border-gray-800 flex flex-col relative">
        <div className="p-4 border-b border-gray-800 flex justify-between items-center">
          <div>
            <p className="text-[10px] text-gray-500 uppercase font-bold tracking-widest">
              Logged in
            </p>
            <p className="text-blue-400 font-medium">{currentUser}</p>
          </div>
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="text-[10px] bg-red-500/10 text-red-500 px-3 py-1.5 rounded-lg border border-red-500/20 hover:bg-red-500/20 transition-all"
          >
            EXIT
          </button>
        </div>

        <div className="flex flex-col gap-2 p-4 border-b border-gray-800">
          <input
            className="p-3 bg-[#1e1e1e] rounded-xl outline-none border border-transparent focus:border-blue-600 text-sm transition-all"
            placeholder={isGroupMode ? "Add participants..." : "Search..."}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />

          {isGroupMode && (
            <div className="animate-in fade-in slide-in-from-top-2 flex flex-col gap-2">
              <input
                className="p-3 bg-blue-600/10 rounded-xl outline-none border border-blue-600/30 text-sm"
                placeholder="Enter group name..."
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
              />
              <div className="flex gap-2">
                <button
                  onClick={createGroupChat}
                  disabled={selectedUsers.length === 0 || !groupName}
                  className="flex-1 bg-blue-600 py-2 rounded-lg text-[10px] font-bold uppercase disabled:opacity-30"
                >
                  Create ({selectedUsers.length})
                </button>
                <button
                  onClick={() => {
                    setIsGroupMode(false);
                    setSelectedUsers([]);
                  }}
                  className="bg-gray-800 px-4 py-2 rounded-lg text-[10px] font-bold uppercase"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-2 pt-2">
          {searchQuery ? (
            <div className="space-y-1">
              {searchResults.map((u) => {
                const isSelected = selectedUsers.some(
                  (sel) => sel._id === u._id,
                );
                return (
                  <div
                    key={u._id}
                    onClick={() => {
                      if (isGroupMode) {
                        setSelectedUsers((prev) =>
                          isSelected
                            ? prev.filter((user) => user._id !== u._id)
                            : [...prev, u],
                        );
                      } else {
                        handleSelectUser(u.username);
                      }
                    }}
                    className={`p-3 rounded-xl cursor-pointer flex items-center justify-between transition-all ${isSelected ? "bg-blue-600/20 border border-blue-600/40" : "hover:bg-[#1e1e1e]"}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center text-xs">
                        {u.username[0]}
                      </div>
                      <span className="text-sm">{u.username}</span>
                    </div>
                    {isGroupMode && (
                      <div
                        className={`w-4 h-4 rounded border ${isSelected ? "bg-blue-500" : "border-gray-600"}`}
                      >
                        {isSelected && "✓"}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            recentChats.map((c) => (
              <div
                key={c._id}
                onClick={() => setSelectedChat(c)}
                className={`p-3 rounded-xl cursor-pointer mb-1 transition-all ${selectedChat?._id === c._id ? "bg-blue-600/20 border border-blue-600/50" : "hover:bg-[#1e1e1e]"}`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-xs ${c.type === "group" ? "bg-indigo-600" : "bg-blue-600"}`}
                  >
                    {getChatDisplayName(c)?.[0]}
                  </div>
                  <span className="text-sm font-medium">
                    {getChatDisplayName(c)}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>

        {!isGroupMode && (
          <button
            onClick={() => setIsGroupMode(true)}
            className="absolute bottom-6 right-6 w-14 h-14 bg-blue-600 hover:bg-blue-500 rounded-full flex items-center justify-center shadow-2xl active:scale-90"
          >
            +
          </button>
        )}
      </aside>

      {/* Main Chat Area */}
      <main className="flex-1 flex flex-col m-2 ml-0 bg-[#0a0a0a] rounded-2xl border border-gray-800 overflow-hidden">
        {selectedChat ? (
          <>
            <div className="p-4 border-b border-gray-800 bg-[#121212] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="font-bold text-lg">
                  {getChatDisplayName(selectedChat)}
                </span>
                {isPeerTyping && (
                  <div className="text-[10px] text-blue-400 animate-pulse">
                    typing...
                  </div>
                )}
              </div>
            </div>

            <div
              className="flex-1 overflow-y-auto p-4 space-y-4"
              ref={scrollContainerRef}
              onScroll={handleScroll}
            >
              {messages.map((msg) => (
                <div
                  key={msg._id}
                  className={`flex group ${msg.sender === currentUser ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`relative p-3 rounded-2xl max-w-[70%] text-sm shadow-lg transition-all ${
                      msg.sender === currentUser
                        ? "bg-blue-600 ml-12"
                        : "bg-[#1e1e1e] mr-12"
                    }`}
                  >
                    {/* Кнопки управления (видны только владельцу при наведении) */}
                    {msg.sender === currentUser && (
                      <div className="absolute -left-25 top-1/2 -translate-y-1/2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => startEdit(msg)}
                          className="p-1.5 hover:bg-gray-800 rounded text-gray-400 hover:text-blue-400"
                          title="Edit"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => deleteMessage(msg._id)}
                          className="p-1.5 hover:bg-gray-800 rounded text-gray-400 hover:text-red-400"
                          title="Delete"
                        >
                          Delete
                        </button>
                      </div>
                    )}

                    <DecryptedText
                      text={msg.text}
                      currentUser={currentUser}
                      sender={msg.sender}
                    />

                    <div className="flex justify-end items-center gap-1 mt-1 opacity-40 text-[9px]">
                      {new Date(msg.timestamp).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                      {msg.sender === currentUser && (
                        <span className={msg.seen ? "text-blue-200" : ""}>
                          {msg.seen ? " ✓✓" : " ✓"}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              <div ref={messageEndRef} />
            </div>

            <div className="p-4 bg-[#121212] border-t border-gray-800 flex flex-col gap-2">
              {editingMessage && (
                <div className="flex justify-between text-[10px] text-blue-400 px-2 uppercase font-bold">
                  Editing mode <button onClick={cancelEdit}>Cancel</button>
                </div>
              )}
              <div className="flex gap-2">
                <input
                  className="flex-1 bg-[#1e1e1e] p-3 rounded-xl outline-none text-sm focus:ring-1 ring-blue-500"
                  value={newMessage}
                  onChange={(e) => {
                    setNewMessage(e.target.value);
                    handleTyping();
                  }}
                  onKeyDown={(e) => e.key === "Enter" && handleAction()}
                  placeholder="Message..."
                />
                <button
                  onClick={handleAction}
                  className="bg-blue-600 px-6 rounded-xl text-xs font-bold active:scale-95"
                >
                  {editingMessage ? "SAVE" : "SEND"}
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-700 italic text-sm">
            Select a chat
          </div>
        )}
      </main>
    </div>
  );
}
