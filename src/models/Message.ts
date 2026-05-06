import mongoose, { Schema, model, models } from "mongoose";

const MessageSchema = new Schema({
  sender: { type: String, required: true },
  chatId: { type: String, required: true },
  text: { type: String, required: false, default: "" }, 
  mediaUrl: { type: String, required: false }, 
  // Новые поля для поддержки голосовых сообщений и файлов
  type: { 
    type: String, 
    enum: ["text", "audio", "image", "file"], 
    default: "text" 
  },
  size: { type: Number, required: false, default: 0 },      // Размер в байтах
  duration: { type: Number, required: false, default: 0 },  // Длительность в секундах
  // ---
  timestamp: { type: Date, default: Date.now },
  seen: { type: Boolean, default: false },
});

export default models.Message || model("Message", MessageSchema);