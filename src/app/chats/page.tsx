"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useSession, signOut } from "next-auth/react";
import io, { Socket } from "socket.io-client";
import { initE2E, encryptMessage, decryptMessage } from "@/lib/crypto";
import axios from "axios";
import { Send, Mic, Video, Paperclip, Smile } from "lucide-react";
import dynamic from "next/dynamic";

const VoiceMessage = dynamic(() => import("@/components/VoiceMessage"), {
  ssr: false,
  loading: () => (
    <div className="w-48 h-10 bg-gray-800 animate-pulse rounded-xl" />
  ),
});

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
  mediaUrl?: string;
  type?: "text" | "image" | "audio" | "video" | "sticker";
  duration?: string; // e.g. "0:07"
  size?: string; // e.g. "36 KB"
}
interface IChat {
  _id: string;
  name: string;
  type: "direct" | "group" | "channel";
  participants: string[];
}

const DecryptedText = ({
  text,
  currentUser,
  sender,
  mediaUrl,
  onExpand, // Добавляем новый проп
}: {
  text: string;
  currentUser: string;
  sender: string;
  mediaUrl?: string;
  onExpand?: (url: string) => void; // Типизация
}) => {
  const [decrypted, setDecrypted] = useState("🔒...");

  useEffect(() => {
    const attemptDecrypt = async () => {
      if (!text || !text.includes("|")) {
        setDecrypted(text || "");
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

  // ... внутри функции компонента DecryptedText ...

  const isSticker = mediaUrl?.includes("/stickers/"); // Проверка прямо по ссылке

  return (
    <div className="flex flex-col gap-2">
      {mediaUrl && (
        <div
          className={`rounded-lg overflow-hidden flex justify-center transition-all ${
            isSticker
              ? "bg-transparent border-none shadow-none cursor-default"
              : "bg-black/20 border border-white/10 shadow-sm cursor-pointer w-full"
          }`}
          onClick={() => {
            if (!isSticker) onExpand?.(mediaUrl);
          }}
        >
          {mediaUrl.match(/\.(mp4|webm|mov)$/i) ? (
            <video
              src={mediaUrl}
              className="max-w-[300px] max-h-[400px] w-auto h-auto block pointer-events-none"
            />
          ) : (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={mediaUrl}
              alt="attachment"
              className={
                isSticker
                  ? "max-w-[160px] h-auto block border-none"
                  : "max-w-full h-auto block border border-gray-800"
              }
            />
          )}
        </div>
      )}
      {decrypted && <span className="break-words">{decrypted}</span>}
    </div>
  );
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
  const [isUploading, setIsUploading] = useState(false);
  const [fullscreenMedia, setFullscreenMedia] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0); // 0 to 100
  const [file, setFile] = useState<File | null>(null); // ДОБАВИТЬ ЭТО
  const [mediaMode, setMediaMode] = useState<"voice" | "video">("voice");
  const [isRecording, setIsRecording] = useState(false); // Для визуализации записи
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingStartTimeRef = useRef<number | null>(null);
  const [recordingElapsed, setRecordingElapsed] = useState(0); // seconds, for UI display
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [showStickers, setShowStickers] = useState(false);

  // Кэш для хранения открытого текста отправленных сообщений в текущей сессии
  const [sentMessagesCache, setSentMessagesCache] = useState<
    Record<string, string>
  >({});

  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const messageEndRef = useRef<HTMLDivElement>(null);
  const isAtBottom = useRef(true);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const selectedChatRef = useRef<IChat | null>(null);
  const currentUser = session?.user?.name || "";

  const stickerPacks = [
    {
      name: "KANEKI",
      stickers: [
        "https://res.cloudinary.com/doua0g09z/image/upload/v1777992460/stickers/chill.png",
        "https://res.cloudinary.com/doua0g09z/image/upload/v1777992460/stickers/kiss.png",
        "https://res.cloudinary.com/doua0g09z/image/upload/v1777992460/stickers/thinking.png",
        "https://res.cloudinary.com/doua0g09z/image/upload/v1777992459/stickers/happy.png",
        "https://res.cloudinary.com/doua0g09z/image/upload/v1777993938/stickers/worry.png",
        "https://res.cloudinary.com/doua0g09z/image/upload/v1777992458/stickers/sick.png",
        "https://res.cloudinary.com/doua0g09z/image/upload/v1777992458/stickers/calm.png",
        "https://res.cloudinary.com/doua0g09z/image/upload/v1777992457/stickers/greetings.png",
        "https://res.cloudinary.com/doua0g09z/image/upload/v1777992457/stickers/boring.png",
      ],
    },
  ];

  useEffect(() => {
    // Указываем тип MouseEvent для параметра event
    const handleClickOutside = (event: MouseEvent) => {
      // Используем Type Assertion для target, чтобы иметь доступ к методу closest
      const target = event.target as HTMLElement;

      if (showStickers && !target.closest(".emoji-container")) {
        setShowStickers(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showStickers]);

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
    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
    };
  }, []);

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

  const sendSticker = async (url: string) => {
    if (!selectedChat || !socket) return;

    try {
      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sender: currentUser,
          chatId: selectedChat._id,
          text: "", // Стикер — это сообщение без текста
          mediaUrl: url,
        }),
      });

      if (res.ok) {
        const savedMsg = await res.json();
        socket.emit("send-message", savedMsg);
        setShowStickers(false); // Закрываем панель после отправки
      }
    } catch (err) {
      console.error("Ошибка при отправке стикера:", err);
    }
  };

  const startRecording = async () => {
    try {
      // 1. Запрашиваем доступ к медиа
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: mediaMode === "video",
      });

      // 2. Инициализируем Recorder
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      // 3. Логика завершения записи
      recorder.onstop = async () => {
        const blob = new Blob(audioChunksRef.current, {
          type: mediaMode === "voice" ? "audio/webm" : "video/webm",
        });

        // Используем Ref для получения точного времени на момент остановки
        const finalDurSecs = recordingStartTimeRef.current
          ? Math.round((Date.now() - recordingStartTimeRef.current) / 1000)
          : 0;

        const finalBlobSize = blob.size;
        const fileName =
          mediaMode === "voice" ? "voice_message.webm" : "video_message.webm";
        const recordedFile = new File([blob], fileName, { type: blob.type });

        // Отправка файла на сервер/Cloudinary
        await handleAction(recordedFile, finalDurSecs, finalBlobSize);

        // Останавливаем все дорожки микрофона/камеры
        stream.getTracks().forEach((track) => track.stop());

        // Сбрасываем время начала записи
        recordingStartTimeRef.current = null;
      };

      // 4. Запуск таймера и записи
      const start = Date.now();
      recordingStartTimeRef.current = start;

      // СБРОС: Обнуляем визуальный счетчик перед стартом[cite: 1]
      setRecordingElapsed(0);

      // Очистка старого интервала, если он почему-то не удалился
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);

      recorder.start();
      setIsRecording(true);

      // Запускаем новый интервал для обновления UI каждую секунду[cite: 1]
      timerIntervalRef.current = setInterval(() => {
        setRecordingElapsed(Math.floor((Date.now() - start) / 1000));
      }, 1000);
    } catch (err) {
      console.error("Error accessing media devices:", err);
      alert("Could not access microphone/camera");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      // Останавливаем физическую запись
      mediaRecorderRef.current.stop();
      setIsRecording(false);

      // ОЧИСТКА: Останавливаем таймер и обнуляем его стейт[cite: 1]
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }

      // Визуально сбрасываем счетчик в 0, чтобы он не «залипал» на последней секунде[cite: 1]
      setRecordingElapsed(0);
    }
  };

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

  const uploadToCloudinary = async (
    file: File,
    onProgress: (percent: number) => void,
  ): Promise<string> => {
    // Указываем, что функция возвращает строку (URL)
    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", "messenger_preset");

    try {
      const response = await axios.post(
        `https://api.cloudinary.com/v1_1/doua0g09z/auto/upload`,
        formData,
        {
          onUploadProgress: (pe) => {
            const total = pe.total || 1;
            const percent = Math.round((pe.loaded * 100) / total);
            onProgress(percent);
          },
        },
      );
      return response.data.secure_url;
    } catch (error: unknown) {
      // Используем unknown вместо any
      if (axios.isAxiosError(error)) {
        const serverMessage = error.response?.data?.error?.message;
        console.error("Cloudinary Error:", serverMessage || error.message);
      } else {
        console.error("Unexpected Error:", error);
      }
      throw error;
    }
  };

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

  // Замени свою функцию handleAction на эту:
  const handleAction = async (
    file?: File,
    audioDuration?: number,
    audioBlobSize?: number,
  ) => {
    let mediaUrl = "";

    // 1. Подготовка: включаем индикатор загрузки и сбрасываем прогресс
    setIsUploading(true);
    setUploadProgress(0);

    try {
      // 2. Загрузка файла, если он есть
      if (file) {
        try {
          // Передаем файл и функцию обратного вызова для отслеживания %
          mediaUrl = await uploadToCloudinary(file, (percent) => {
            setUploadProgress(percent);
          });
          console.log("Uploaded to Cloudinary:", mediaUrl);
        } catch (e) {
          alert("Ошибка при загрузке файла");
          return; // Перейдет сразу в finally
        }
      }

      // 3. Проверки безопасности
      if (!newMessage.trim() && !mediaUrl) return;
      if (!selectedChat || !socket) return;

      let textToDatabase = newMessage;

      // 4. Логика шифрования (текст сообщения выступает как подпись к медиа)
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
          // Если шифрование упало, отправим как обычный текст или прервем?
          // В мессенджере лучше прервать, если важна приватность
        }
      }

      // 5. Отправка (редактирование или новое сообщение)
      if (editingMessage) {
        const res = await fetch("/api/messages", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messageId: editingMessage._id,
            text: textToDatabase,
            // Добавляем принудительную смену типа на "text",
            // чтобы компонент переключился с плеера на отображение текста
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
        // ОТПРАВКА НОВОГО СООБЩЕНИЯ
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
          const savedMsg = await res.json();
          socket.emit("send-message", savedMsg);

          // 6. Очистка состояния после успешной отправки
          setNewMessage("");
          setFile(null); // Очищаем выбранный файл
          if (fileInputRef.current) {
            fileInputRef.current.value = ""; // Сбрасываем input
          }
        } else {
          const errorData = await res.json();
          console.error("Server error:", errorData);
          alert("Серверная ошибка при отправке");
        }
      }
    } catch (err) {
      console.error("Action error:", err);
      alert("Произошла ошибка при обработке сообщения");
    } finally {
      // ВАЖНО: Выключаем индикаторы в любом случае
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  useEffect(() => {
    if (!currentUser) return;
    const initSocket = async () => {
      await fetch("/api/socket");
      if (!socket) {
        socket = io({ path: "/api/socket" });
        socket.on("receive-message", (data: IMessage) => {
          // 1. Обновляем сообщения, если открыт этот чат
          if (data.chatId === selectedChatRef.current?._id) {
            setMessages((prev) =>
              prev.find((m) => m._id === data._id) ? prev : [...prev, data],
            );
          }

          // 2. Перемещаем чат наверх в списке сайдбара
          setRecentChats((prevChats) => {
            // Находим чат, в который пришло сообщение
            const chatIndex = prevChats.findIndex((c) => c._id === data.chatId);

            if (chatIndex !== -1) {
              const updatedChats = [...prevChats];
              const [targetChat] = updatedChats.splice(chatIndex, 1); // Вырезаем его
              return [targetChat, ...updatedChats]; // Вставляем в начало
            }

            // Если чата нет в списке (например, новое первое сообщение),
            // лучше просто перезапросить список через fetchRecentChats()
            fetchRecentChats();
            return prevChats;
          });
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
            className="text-[10px] bg-red-500/20 text-red-500 px-3 py-1.5 rounded-lg border border-red-500/20 hover:bg-red-500/20 transition-all"
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

        <div className="flex-1 overflow-y-auto px-2 pt-2 custom-scrollbar">
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
                    className={`p-3 rounded-xl cursor-pointer flex items-center justify-between transition-all ${
                      isSelected
                        ? "bg-blue-600/20 border border-blue-600/40"
                        : "hover:bg-[#1e1e1e]"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center text-xs">
                        {u.username[0]}
                      </div>
                      <span className="text-sm">{u.username}</span>
                    </div>
                    {isGroupMode && (
                      <div
                        className={`w-4 h-4 rounded border flex items-center justify-center ${isSelected ? "bg-blue-500 border-blue-500" : "border-gray-600"}`}
                      >
                        {isSelected && <span className="text-[10px]">✓</span>}
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
                className={`p-3 rounded-xl cursor-pointer mb-1 transition-all ${
                  selectedChat?._id === c._id
                    ? "bg-blue-600/20 border border-blue-600/50"
                    : "hover:bg-[#1e1e1e]"
                }`}
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
            className="absolute bottom-6 right-6 w-14 h-14 bg-blue-600 hover:bg-blue-500 rounded-full flex items-center justify-center shadow-2xl active:scale-90 transition-transform"
          >
            <span className="text-2xl">+</span>
          </button>
        )}
      </aside>

      {/* Main Chat Area */}
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

            {/* Messages Area */}
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
                      {/* Кнопки редактирования (показываем только если не стикер или по желанию) */}
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
                          {/* Голосовое сообщение */}
                          <VoiceMessage
                            audioUrl={msg.mediaUrl || ""}
                            duration={msg.duration}
                          />

                          {/* Добавляем текст под аудио, если он есть */}
                          {msg.text && (
                            <div className="border-t border-white/10 mt-1 pt-1">
                              <DecryptedText
                                text={msg.text}
                                currentUser={currentUser}
                                sender={msg.sender}
                                // Здесь mediaUrl не передаем, чтобы не дублировать плеер
                                onExpand={(url) => {
                                  if (!url.includes("/stickers/")) {
                                    setFullscreenMedia(url);
                                  }
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
                            if (!url.includes("/stickers/")) {
                              setFullscreenMedia(url);
                            }
                          }}
                        />
                      )}
                      {/* Время сообщения для стикера можно сделать полупрозрачным под ним */}
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

            {/* Input Area */}
            <div className="p-4 bg-[#121212] border-t border-gray-800 flex flex-col gap-2 relative">
              <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept="image/*,video/*"
                onChange={(e) => {
                  const selectedFile = e.target.files?.[0];
                  if (selectedFile) setFile(selectedFile);
                }}
              />

              {editingMessage && (
                <div className="flex justify-between text-[10px] text-blue-400 px-2 uppercase font-bold animate-in fade-in">
                  Editing message{" "}
                  <button
                    onClick={cancelEdit}
                    className="text-gray-500 hover:text-white"
                  >
                    Cancel
                  </button>
                </div>
              )}

              {/* File Preview & Upload Progress */}
              {(file || isUploading) && (
                <div className="px-4 py-3 border rounded-xl border-white/10 bg-white/5 mb-2">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-blue-400 truncate">
                      📎 {file?.name || "Uploading..."}
                    </span>
                    {!isUploading && (
                      <button
                        onClick={() => setFile(null)}
                        className="text-red-500"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                  {isUploading && (
                    <div className="w-full bg-white/10 rounded-full h-1 overflow-hidden">
                      <div
                        className="bg-blue-500 h-full transition-all duration-300"
                        style={{ width: `${uploadProgress}%` }}
                      />
                    </div>
                  )}
                </div>
              )}

              <div className="flex items-end gap-3 relative">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading || !!editingMessage}
                  className="p-3 bg-[#1e1e1e] rounded-xl hover:bg-gray-800 transition-colors disabled:opacity-30 flex-shrink-0"
                >
                  <Paperclip size={20} className="text-gray-400" />
                </button>

                <div className="flex-1 relative">
                  <input
                    className="w-full bg-[#1e1e1e] p-3 pr-12 rounded-xl outline-none text-sm focus:ring-1 ring-blue-500 text-white min-h-[46px]"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyDown={(e) =>
                      e.key === "Enter" && handleAction(file || undefined)
                    }
                    placeholder="Write a message..."
                  />

                  {/* Emoji/Sticker Trigger */}
                  {/* Кнопка эмодзи внутри инпута справа */}
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center emoji-container">
                    <button
                      type="button"
                      onClick={() => setShowStickers(!showStickers)} // Переключаем по клику
                      className={`p-2 transition-colors ${showStickers ? "text-blue-500" : "text-gray-400 hover:text-white"}`}
                    >
                      <Smile size={22} />
                    </button>

                    {/* ПАНЕЛЬ СТИКЕРОВ */}
                    {showStickers && (
                      <div className="absolute bottom-full right-0 mb-4 w-72 h-96 bg-[#121212] border border-gray-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden z-50 animate-in fade-in slide-in-from-bottom-2">
                        <div className="flex justify-around p-3 border-b border-gray-800 text-[10px] font-bold uppercase text-gray-500 bg-[#0a0a0a]">
                          <span className="hover:text-white cursor-pointer">
                            Эмодзи
                          </span>
                          <span className="text-blue-500 border-b border-blue-500 pb-1">
                            Стикеры
                          </span>
                          <span className="hover:text-white cursor-pointer">
                            GIF
                          </span>
                        </div>

                        <div className="flex-1 overflow-y-auto p-3 custom-scrollbar bg-[#121212]">
                          {stickerPacks.map((pack) => (
                            <div key={pack.name} className="mb-4">
                              <p className="text-[10px] text-gray-500 mb-2">
                                {pack.name}
                              </p>
                              <div className="grid grid-cols-4 gap-2">
                                {pack.stickers.map((url, i) => (
                                  <img
                                    key={i}
                                    src={url}
                                    className="w-full aspect-square object-contain cursor-pointer hover:scale-110 hover:bg-white/5 rounded-lg transition-all"
                                    onClick={() => {
                                      sendSticker(url);
                                      setShowStickers(false); // Закрываем после выбора
                                    }}
                                    alt="sticker"
                                  />
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex-shrink-0 flex items-center gap-2">
                  {isRecording && (
                    <span className="text-red-400 text-xs font-mono animate-pulse">
                      {formatDurationSecs(recordingElapsed)}
                    </span>
                  )}
                  {newMessage.trim() || file || editingMessage ? (
                    <button
                      onClick={() => handleAction(file || undefined)}
                      disabled={isUploading}
                      className="bg-blue-600 hover:bg-blue-700 text-white font-bold h-[46px] px-6 rounded-xl transition-all active:scale-95 flex items-center justify-center gap-2"
                    >
                      <Send size={18} />
                      <span className="text-xs uppercase">
                        {editingMessage ? "Save" : "Send"}
                      </span>
                    </button>
                  ) : (
                    <button
                      onMouseDown={startRecording}
                      onMouseUp={stopRecording}
                      className={`p-3 rounded-full transition-all flex items-center justify-center ${
                        isRecording
                          ? "bg-red-500 scale-110 shadow-lg text-white"
                          : "bg-[#1e1e1e] text-gray-400 hover:bg-gray-800"
                      }`}
                    >
                      <Mic size={22} />
                    </button>
                  )}
                </div>
              </div>
            </div>
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

      {/* Fullscreen Media Lightbox */}
      {fullscreenMedia && (
        <div
          className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setFullscreenMedia(null)}
        >
          <button className="absolute top-8 right-8 text-white/50 hover:text-white text-5xl transition-colors">
            ×
          </button>
          <div
            className="relative max-w-[90vw] max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {fullscreenMedia.match(/\.(mp4|webm|mov)$/i) ? (
              <video
                src={fullscreenMedia}
                controls
                autoPlay
                className="max-w-full max-h-[90vh] rounded-lg shadow-2xl"
              />
            ) : (
              <img
                src={fullscreenMedia}
                alt="Preview"
                className="max-w-full max-h-[90vh] rounded-lg shadow-2xl object-contain"
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
