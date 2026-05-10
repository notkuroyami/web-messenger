"use client";

import React, { useEffect, useRef, useState } from "react";
import { Send, Mic, Paperclip, Smile } from "lucide-react";
import { IMessage } from "@/types/chat";
import EmojiPicker from "./EmojiPicker";

interface MessageInputProps {
  newMessage: string;
  setNewMessage: React.Dispatch<React.SetStateAction<string>>;
  file: File | null;
  setFile: (f: File | null) => void;
  isUploading: boolean;
  uploadProgress: number;
  editingMessage: IMessage | null;
  isRecording: boolean;
  recordingElapsed: number;
  onSend: (file?: File) => void;
  onStartRecording: () => void;
  onStopRecording: () => void;
  onSendSticker: (url: string) => void;
  onTyping: () => void;
  onCancelEdit: () => void;
  formatDurationSecs: (s: number) => string;
}

export default function MessageInput({
  newMessage,
  setNewMessage,
  file,
  setFile,
  isUploading,
  uploadProgress,
  editingMessage,
  isRecording,
  recordingElapsed,
  onSend,
  onStartRecording,
  onStopRecording,
  onSendSticker,
  onTyping,
  onCancelEdit,
  formatDurationSecs,
}: MessageInputProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showStickers, setShowStickers] = useState(false);
  const emojiContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        showStickers &&
        emojiContainerRef.current &&
        !emojiContainerRef.current.contains(e.target as Node)
      ) {
        setShowStickers(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showStickers]);

  return (
    <div className="p-4 bg-[#121212] border-t border-gray-800 flex flex-col gap-2">
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
          <button onClick={onCancelEdit} className="text-gray-500 hover:text-white">
            Cancel
          </button>
        </div>
      )}

      {/* File preview & upload progress */}
      {(file || isUploading) && (
        <div className="px-4 py-3 border rounded-xl border-white/10 bg-white/5 mb-2">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-blue-400 truncate">
              📎 {file?.name || "Uploading..."}
            </span>
            {!isUploading && (
              <button onClick={() => setFile(null)} className="text-red-500">
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

      <div className="flex items-end gap-3">
        {/* Attach file */}
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading || !!editingMessage}
          className="p-3 bg-[#1e1e1e] rounded-xl hover:bg-gray-800 transition-colors disabled:opacity-30 flex-shrink-0"
        >
          <Paperclip size={20} className="text-gray-400" />
        </button>

        {/* Text input */}
        <div className="flex-1">
          <input
            className="w-full bg-[#1e1e1e] p-3 rounded-xl outline-none text-sm focus:ring-1 ring-blue-500 text-white min-h-[46px]"
            value={newMessage}
            onChange={(e) => {
              setNewMessage(e.target.value);
              onTyping();
            }}
            onKeyDown={(e) => e.key === "Enter" && onSend(file || undefined)}
            placeholder="Write a message..."
          />
        </div>

        {/* Emoji / Sticker trigger — outside the input wrapper so picker has no clipping parent */}
        <div ref={emojiContainerRef} className="relative flex-shrink-0 emoji-container">
          <button
            type="button"
            onClick={() => setShowStickers(!showStickers)}
            className={`p-3 rounded-xl bg-[#1e1e1e] hover:bg-gray-800 transition-colors ${
              showStickers ? "text-blue-500" : "text-gray-400 hover:text-white"
            }`}
          >
            <Smile size={22} />
          </button>

          {showStickers && (
            <EmojiPicker
              onEmojiSelect={(emoji) => setNewMessage((prev) => prev + emoji)}
              onStickerSelect={(url) => {
                onSendSticker(url);
                setShowStickers(false);
              }}
            />
          )}
        </div>

        {/* Send / Record */}
        <div className="flex-shrink-0 flex items-center gap-2">
          {isRecording && (
            <span className="text-red-400 text-xs font-mono animate-pulse">
              {formatDurationSecs(recordingElapsed)}
            </span>
          )}
          {newMessage.trim() || file || editingMessage ? (
            <button
              onClick={() => onSend(file || undefined)}
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
              onMouseDown={onStartRecording}
              onMouseUp={onStopRecording}
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
  );
}