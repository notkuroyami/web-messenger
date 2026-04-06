import mongoose, { Schema, model, models } from "mongoose";

const MessageSchema = new Schema({
  sender: { type: String, required: true },
  chatId: { type: String, required: true }, // ID чата или группы
  text: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
  seen: { type: Boolean, default: false },
});

export default models.Message || model("Message", MessageSchema);