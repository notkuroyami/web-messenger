export interface User {
  _id: string;
  username: string;
}

export interface IMessage {
  _id: string;
  sender: string;
  text: string;
  timestamp: string;
  chatId: string;
  seen?: boolean;
  mediaUrl?: string;
  type?: "text" | "image" | "audio" | "video" | "sticker";
  duration?: string;
  size?: string;
}

export interface IChat {
  _id: string;
  name: string;
  type: "direct" | "group" | "channel";
  participants: string[];
}

export interface GiphyGif {
  id: string;
  images: {
    fixed_height_small: {
      url: string;
    };
    fixed_height: {
      url: string;
    };
  };
}