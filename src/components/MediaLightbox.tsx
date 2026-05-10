"use client";

interface MediaLightboxProps {
  url: string;
  onClose: () => void;
}

export default function MediaLightbox({ url, onClose }: MediaLightboxProps) {
  return (
    <div
      className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <button className="absolute top-8 right-8 text-white/50 hover:text-white text-5xl transition-colors">
        ×
      </button>
      <div
        className="relative max-w-[90vw] max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {url.match(/\.(mp4|webm|mov)$/i) ? (
          <video
            src={url}
            controls
            autoPlay
            className="max-w-full max-h-[90vh] rounded-lg shadow-2xl"
          />
        ) : (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={url}
            alt="Preview"
            className="max-w-full max-h-[90vh] rounded-lg shadow-2xl object-contain"
          />
        )}
      </div>
    </div>
  );
}