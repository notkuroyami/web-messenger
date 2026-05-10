"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useSession } from "next-auth/react";
import io, { Socket } from "socket.io-client";
import { initE2E, encryptMessage, decryptMessage } from "@/lib/crypto";
import axios from "axios";
import dynamic from "next/dynamic";

import { IMessage, IChat, User } from "@/types/chat";
import ChatSidebar from "@/components/ChatSideBar";
import MessageInput from "@/components/MessageInput";
import DecryptedText from "@/components/DecryptedText";
import MediaLightbox from "@/components/MediaLightbox";

const VoiceMessage = dynamic(() => import("@/components/VoiceMessage"), {
  ssr: false,
  loading: () => (
    <div className="w-48 h-10 bg-gray-800 animate-pulse rounded-xl" />
  ),
});

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
  const [editingMessage, setEditingMessage] = useState<IMessage | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [fullscreenMedia, setFullscreenMedia] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [file, setFile] = useState<File | null>(null);
  const [mediaMode] = useState<"voice" | "video">("voice");
  const [isRecording, setIsRecording] = useState(false);
  const [recordingElapsed, setRecordingElapsed] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingStartTimeRef = useRef<number | null>(null);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const messageEndRef = useRef<HTMLDivElement>(null);
  const isAtBottom = useRef(true);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const selectedChatRef = useRef<IChat | null>(null);

  const currentUser = session?.user?.name || "";

  // ── Helpers ────────────────────────────────────────────────────────────────

  const formatFileSize = (bytes: number): string => {
    if (!bytes) return "";
    const kb = bytes / 1024;
    return kb >= 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${Math.round(kb)}`;
  };

  const formatDurationSecs = (seconds: number): string => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const getChatDisplayName = (chat: IChat) =>
    chat.type === "direct"
      ? chat.participants.find((p) => p !== currentUser)
      : chat.name;

  // ── Effects ────────────────────────────────────────────────────────────────

  useEffect(() => {
    selectedChatRef.current = selectedChat;
  }, [selectedChat]);

  useEffect(() => {
    if (status === "authenticated" && currentUser) initE2E(currentUser);
  }, [status, currentUser]);

  useEffect(() => {
    if (messages.length > 0) {
      const last = messages[messages.length - 1];
      if (last.sender === currentUser || isAtBottom.current) {
        messageEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }
    }
  }, [messages, currentUser]);

  useEffect(() => {
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, []);

  useEffect(() => {
    const onFocus = () => {};
    const onBlur = () => {};
    window.addEventListener("focus", onFocus);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("blur", onBlur);
    };
  }, []);

  useEffect(() => {
    const delay = setTimeout(() => {
      if (searchQuery.trim().length > 0) {
        fetch(`/api/users?query=${encodeURIComponent(searchQuery)}`)
          .then((r) => r.json())
          .then((data) =>
            setSearchResults(
              data.filter((u: User) => u.username !== currentUser),
            ),
          )
          .catch(console.error);
      } else {
        setSearchResults([]);
      }
    }, 300);
    return () => clearTimeout(delay);
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

  // ── Socket ─────────────────────────────────────────────────────────────────

  const markAsRead = useCallback(
    async (chatId: string) => {
      if (!currentUser || !socket) return;
      try {
        await fetch("/api/messages/read", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chatId, username: currentUser }),
        });
        socket.emit("mark-as-read", { chatId, reader: currentUser });
      } catch (err) {
        console.error("Read update error:", err);
      }
    },
    [currentUser],
  );

  useEffect(() => {
    if (!currentUser) return;
    const initSocket = async () => {
      await fetch("/api/socket");
      if (!socket) {
        socket = io({ path: "/api/socket" });

        socket.on("receive-message", (data: IMessage) => {
          if (data.chatId === selectedChatRef.current?._id) {
            setMessages((prev) =>
              prev.find((m) => m._id === data._id) ? prev : [...prev, data],
            );
          }
          setRecentChats((prevChats) => {
            const idx = prevChats.findIndex((c) => c._id === data.chatId);
            if (idx !== -1) {
              const updated = [...prevChats];
              const [target] = updated.splice(idx, 1);
              return [target, ...updated];
            }
            fetchRecentChats();
            return prevChats;
          });
        });

        socket.on("message-updated", (updated: IMessage) => {
          if (updated.chatId === selectedChatRef.current?._id) {
            setMessages((prev) =>
              prev.map((m) => (m._id === updated._id ? updated : m)),
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

  useEffect(() => {
    if (selectedChat) {
      socket?.emit("join-chat", selectedChat._id);
      setIsPeerTyping(false);
      fetch(`/api/messages?chatId=${selectedChat._id}`)
        .then((r) => r.json())
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

  // ── Actions ────────────────────────────────────────────────────────────────

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

  const sendSticker = async (url: string) => {
    if (!selectedChat || !socket) return;
    try {
      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sender: currentUser,
          chatId: selectedChat._id,
          text: "",
          mediaUrl: url,
        }),
      });
      if (res.ok) socket.emit("send-message", await res.json());
    } catch (err) {
      console.error("Sticker send error:", err);
    }
  };

  const uploadToCloudinary = async (
    file: File,
    onProgress: (p: number) => void,
  ): Promise<string> => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", "messenger_preset");
    try {
      const response = await axios.post(
        `https://api.cloudinary.com/v1_1/doua0g09z/auto/upload`,
        formData,
        {
          onUploadProgress: (pe) =>
            onProgress(Math.round((pe.loaded * 100) / (pe.total || 1))),
        },
      );
      return response.data.secure_url;
    } catch (error: unknown) {
      if (axios.isAxiosError(error))
        console.error(
          "Cloudinary Error:",
          error.response?.data?.error?.message,
        );
      else console.error("Unexpected Error:", error);
      throw error;
    }
  };

  const handleAction = async (
    file?: File,
    audioDuration?: number,
    audioBlobSize?: number,
  ) => {
    let mediaUrl = "";
    setIsUploading(true);
    setUploadProgress(0);
    try {
      if (file) {
        try {
          mediaUrl = await uploadToCloudinary(file, setUploadProgress);
        } catch {
          alert("Ошибка при загрузке файла");
          return;
        }
      }
      if (!newMessage.trim() && !mediaUrl) return;
      if (!selectedChat || !socket) return;

      let textToDatabase = newMessage;

      if (selectedChat.type === "direct" && newMessage.trim()) {
        const partner = selectedChat.participants.find(
          (p) => p !== currentUser,
        );
        try {
          const resKey = await fetch(`/api/users/get-key?username=${partner}`);
          const { publicKey: partnerKey } = await resKey.json();
          const myPublicKey = localStorage.getItem(`publicKey_${currentUser}`);
          if (partnerKey && myPublicKey) {
            const encForPartner = await encryptMessage(newMessage, partnerKey);
            const encForMe = await encryptMessage(newMessage, myPublicKey);
            textToDatabase = `${encForMe}|${encForPartner}`;
          }
        } catch (e) {
          console.error("Encryption error:", e);
        }
      }

      if (editingMessage) {
        const res = await fetch("/api/messages", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messageId: editingMessage._id,
            text: textToDatabase,
            type: "text",
          }),
        });
        if (res.ok) {
          const updated = await res.json();
          socket.emit("update-message", updated);
          setMessages((prev) =>
            prev.map((m) => (m._id === updated._id ? updated : m)),
          );
          cancelEdit();
        }
      } else {
        const res = await fetch("/api/messages", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sender: currentUser,
            chatId: selectedChat._id,
            text: textToDatabase || "",
            mediaUrl: mediaUrl || undefined,
            type:
              file?.type.startsWith("audio/") || file?.name.includes("voice")
                ? "audio"
                : "text",
            duration:
              audioDuration !== undefined
                ? formatDurationSecs(audioDuration)
                : undefined,
            size:
              audioBlobSize !== undefined
                ? formatFileSize(audioBlobSize)
                : undefined,
          }),
        });
        if (res.ok) {
          socket.emit("send-message", await res.json());
          setNewMessage("");
          setFile(null);
        } else {
          alert("Серверная ошибка при отправке");
        }
      }
    } catch (err) {
      console.error("Action error:", err);
      alert("Произошла ошибка при обработке сообщения");
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const deleteMessage = async (messageId: string) => {
    if (!confirm("Удалить сообщение?")) return;
    try {
      const res = await fetch(`/api/messages?messageId=${messageId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        socket?.emit("delete-message", {
          messageId,
          chatId: selectedChat?._id,
        });
        setMessages((prev) => prev.filter((m) => m._id !== messageId));
      }
    } catch (err) {
      console.error("Delete error:", err);
    }
  };

  const startEdit = async (msg: IMessage) => {
    if (msg.text.includes("|")) {
      const [forMe] = msg.text.split("|");
      setNewMessage(await decryptMessage(forMe, currentUser));
    } else {
      setNewMessage(msg.text);
    }
    setEditingMessage(msg);
  };

  const cancelEdit = () => {
    setEditingMessage(null);
    setNewMessage("");
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: mediaMode === "video",
      });
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        const blob = new Blob(audioChunksRef.current, {
          type: mediaMode === "voice" ? "audio/webm" : "video/webm",
        });
        const finalDurSecs = recordingStartTimeRef.current
          ? Math.round((Date.now() - recordingStartTimeRef.current) / 1000)
          : 0;
        const finalBlobSize = blob.size;
        const fileName =
          mediaMode === "voice" ? "voice_message.webm" : "video_message.webm";
        const recordedFile = new File([blob], fileName, { type: blob.type });
        await handleAction(recordedFile, finalDurSecs, finalBlobSize);
        stream.getTracks().forEach((t) => t.stop());
        recordingStartTimeRef.current = null;
      };

      recordingStartTimeRef.current = Date.now();
      setRecordingElapsed(0);
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      recorder.start();
      setIsRecording(true);

      timerIntervalRef.current = setInterval(() => {
        if (recordingStartTimeRef.current) {
          setRecordingElapsed(
            Math.floor((Date.now() - recordingStartTimeRef.current) / 1000),
          );
        }
      }, 1000);
    } catch (err) {
      console.error("Recording error:", err);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
      setRecordingElapsed(0);
    }
  };

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

  const handleScroll = () => {
    const c = scrollContainerRef.current;
    if (c)
      isAtBottom.current = c.scrollHeight - c.scrollTop - c.clientHeight < 100;
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  if (status === "loading")
    return (
      <div className="h-screen bg-black flex items-center justify-center text-blue-500">
        Loading...
      </div>
    );

  return (
    <div className="flex h-screen bg-black text-white font-sans overflow-hidden">
      <ChatSidebar
        currentUser={currentUser}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        searchResults={searchResults}
        isGroupMode={isGroupMode}
        setIsGroupMode={setIsGroupMode}
        selectedUsers={selectedUsers}
        setSelectedUsers={setSelectedUsers}
        groupName={groupName}
        setGroupName={setGroupName}
        recentChats={recentChats}
        selectedChat={selectedChat}
        setSelectedChat={setSelectedChat}
        getChatDisplayName={getChatDisplayName}
        handleSelectUser={handleSelectUser}
        createGroupChat={createGroupChat}
      />

      <main className="flex-1 flex flex-col m-2 ml-0 bg-[#0a0a0a] rounded-2xl border border-gray-800 overflow-hidden relative">
        {selectedChat ? (
          <>
            {/* Chat Header */}
            <div className="p-4 border-b border-gray-800 bg-[#121212] flex items-center justify-between z-10">
              <div className="flex items-center gap-3">
                <span className="font-bold text-lg">
                  {getChatDisplayName(selectedChat)}
                </span>
                {isPeerTyping && (
                  <div className="text-[10px] text-blue-400 animate-pulse uppercase tracking-tighter">
                    typing...
                  </div>
                )}
              </div>
            </div>

            {/* Messages */}
            <div
              className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar"
              ref={scrollContainerRef}
              onScroll={handleScroll}
            >
              {messages.map((msg) => {
                const isSticker = msg.mediaUrl?.includes("/stickers/");
                const isAudio =
                  msg.type === "audio" || msg.mediaUrl?.endsWith(".webm");

                return (
                  <div
                    key={msg._id}
                    className={`flex group ${msg.sender === currentUser ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`relative transition-all ${
                        isSticker
                          ? "bg-transparent shadow-none"
                          : msg.sender === currentUser
                            ? "bg-blue-600 shadow-lg p-3 rounded-2xl"
                            : "bg-[#1e1e1e] shadow-lg p-3 rounded-2xl"
                      } max-w-[30%] text-sm`}
                    >
                      {msg.sender === currentUser && !isSticker && (
                        <div className="absolute -left-20 top-1/2 -translate-y-1/2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => startEdit(msg)}
                            className="p-1 text-[10px] bg-gray-800 rounded text-gray-400 hover:text-blue-400 uppercase font-bold"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => deleteMessage(msg._id)}
                            className="p-1 text-[10px] bg-gray-800 rounded text-gray-400 hover:text-red-400 uppercase font-bold"
                          >
                            Del
                          </button>
                        </div>
                      )}

                      {isAudio ? (
                        <div className="flex flex-col gap-2">
                          <VoiceMessage
                            audioUrl={msg.mediaUrl || ""}
                            duration={msg.duration}
                          />
                          {msg.text && (
                            <div className="border-t border-white/10 mt-1 pt-1">
                              <DecryptedText
                                text={msg.text}
                                currentUser={currentUser}
                                sender={msg.sender}
                                onExpand={(url) => {
                                  if (!url.includes("/stickers/"))
                                    setFullscreenMedia(url);
                                }}
                              />
                            </div>
                          )}
                        </div>
                      ) : (
                        <DecryptedText
                          text={msg.text}
                          currentUser={currentUser}
                          sender={msg.sender}
                          mediaUrl={msg.mediaUrl}
                          onExpand={(url) => {
                            if (!url.includes("/stickers/"))
                              setFullscreenMedia(url);
                          }}
                        />
                      )}

                      <div
                        className={`flex justify-end items-center gap-1 mt-1 text-[9px] ${
                          isSticker ? "text-gray-500" : "opacity-40 text-white"
                        }`}
                      >
                        {new Date(msg.timestamp).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                        {msg.sender === currentUser && (
                          <span className={msg.seen ? "text-blue-400" : ""}>
                            {msg.seen ? " ✓✓" : " ✓"}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={messageEndRef} />
            </div>

            {/* Input */}
            <MessageInput
              newMessage={newMessage}
              setNewMessage={setNewMessage}
              file={file}
              setFile={setFile}
              isUploading={isUploading}
              uploadProgress={uploadProgress}
              editingMessage={editingMessage}
              isRecording={isRecording}
              recordingElapsed={recordingElapsed}
              onSend={handleAction}
              onStartRecording={startRecording}
              onStopRecording={stopRecording}
              onSendSticker={sendSticker}
              onTyping={handleTyping}
              onCancelEdit={cancelEdit}
              formatDurationSecs={formatDurationSecs}
            />
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-700 space-y-4">
            <div className="w-16 h-16 border-2 border-dashed border-gray-800 rounded-full flex items-center justify-center">
              <span className="text-2xl">💬</span>
            </div>
            <p className="italic text-sm">Select a chat to start messaging</p>
          </div>
        )}
      </main>

      {fullscreenMedia && (
        <MediaLightbox
          url={fullscreenMedia}
          onClose={() => setFullscreenMedia(null)}
        />
      )}
    </div>
  );
}
