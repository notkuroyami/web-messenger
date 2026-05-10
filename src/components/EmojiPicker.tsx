"use client";

import { useState, useEffect } from "react";
import { GiphyGif } from "@/types/chat";
import { emojis, stickerPacks } from "@/constants/chatData";

interface EmojiPickerProps {
  onEmojiSelect: (emoji: string) => void;
  onStickerSelect: (url: string) => void;
}

export default function EmojiPicker({
  onEmojiSelect,
  onStickerSelect,
}: EmojiPickerProps) {
  const [activeTab, setActiveTab] = useState<"stickers" | "emoji" | "gif">("emoji");
  const [gifSearch, setGifSearch] = useState("");
  const [gifs, setGifs] = useState<GiphyGif[]>([]);

  const fetchGifs = async (query: string) => {
    const apiKey = "9jT7FBPb8eTtrYkrnnQvoKviXCLO42FH";
    const url = query
      ? `https://api.giphy.com/v1/gifs/search?api_key=${apiKey}&q=${query}&limit=20`
      : `https://api.giphy.com/v1/gifs/trending?api_key=${apiKey}&limit=20`;

    const res = await fetch(url);
    const { data } = await res.json();
    setGifs(data);
  };

  useEffect(() => {
    if (activeTab === "gif") fetchGifs("");
  }, [activeTab]);

  return (
    <div
      className="absolute bottom-full right-0 mb-4 w-72 h-96 border border-gray-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden z-[999] animate-in fade-in slide-in-from-bottom-2"
      style={{ backgroundColor: "#121212" }}
    >
      {/* Tab headers */}
      <div className="flex justify-around p-3 border-b border-gray-800 text-[10px] font-bold uppercase text-gray-500 bg-[#0a0a0a]">
        <span
          onClick={() => setActiveTab("emoji")}
          className={`cursor-pointer transition-colors ${activeTab === "emoji" ? "text-blue-500 border-b border-blue-500 pb-1" : "hover:text-white"}`}
        >
          Эмодзи
        </span>
        <span
          onClick={() => setActiveTab("stickers")}
          className={`cursor-pointer transition-colors ${activeTab === "stickers" ? "text-blue-500 border-b border-blue-500 pb-1" : "hover:text-white"}`}
        >
          Стикеры
        </span>
        <span
          onClick={() => setActiveTab("gif")}
          className={`cursor-pointer transition-colors ${activeTab === "gif" ? "text-blue-500 border-b border-blue-500 pb-1" : "hover:text-white"}`}
        >
          GIF
        </span>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto p-3 custom-scrollbar bg-[#121212]">
        {activeTab === "emoji" && (
          <div className="grid grid-cols-6 gap-2">
            {emojis.map((emoji, index) => (
              <button
                key={index}
                onClick={() => onEmojiSelect(emoji)}
                className="text-2xl hover:bg-white/10 p-1 rounded-lg transition-colors active:scale-125"
              >
                {emoji}
              </button>
            ))}
          </div>
        )}

        {activeTab === "stickers" &&
          stickerPacks.map((pack) => (
            <div key={pack.name} className="mb-4">
              <p className="text-[10px] text-gray-500 mb-2">{pack.name}</p>
              <div className="grid grid-cols-4 gap-2">
                {pack.stickers.map((url, i) => (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    key={i}
                    src={url}
                    className="w-full aspect-square object-contain cursor-pointer hover:scale-110 hover:bg-white/5 rounded-lg transition-all"
                    onClick={() => onStickerSelect(url)}
                    alt="sticker"
                  />
                ))}
              </div>
            </div>
          ))}

        {activeTab === "gif" && (
          <div className="flex flex-col gap-3 h-full">
            <input
              className="w-full p-2 bg-[#0a0a0a] border border-gray-800 rounded-lg text-[10px] text-white outline-none focus:border-blue-500 transition-colors"
              placeholder="Search GIPHY..."
              value={gifSearch}
              onChange={(e) => {
                setGifSearch(e.target.value);
                fetchGifs(e.target.value);
              }}
            />
            <div className="grid grid-cols-2 gap-2 pb-2">
              {gifs.length > 0 ? (
                gifs.map((gif: GiphyGif) => (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    key={gif.id}
                    src={gif.images.fixed_height_small.url}
                    className="w-full h-24 object-cover cursor-pointer hover:opacity-80 rounded-lg bg-gray-900 transition-all"
                    onClick={() => onStickerSelect(gif.images.fixed_height.url)}
                    alt="gif"
                  />
                ))
              ) : (
                <div className="col-span-2 text-center py-10 text-[10px] text-gray-600 uppercase tracking-widest">
                  {gifSearch ? "Nothing found" : "Type to search..."}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}