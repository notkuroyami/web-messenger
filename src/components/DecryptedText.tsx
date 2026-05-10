"use client";

import { useState, useEffect } from "react";
import { decryptMessage } from "@/lib/crypto";

interface DecryptedTextProps {
  text: string;
  currentUser: string;
  sender: string;
  mediaUrl?: string;
  onExpand?: (url: string) => void;
}

export default function DecryptedText({
  text,
  currentUser,
  sender,
  mediaUrl,
  onExpand,
}: DecryptedTextProps) {
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

  const isSticker = mediaUrl?.includes("/stickers/");

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
}