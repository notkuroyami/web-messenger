import mongoose, { Schema, model, models } from "mongoose";

const MessageSchema = new Schema({
  sender: { type: String, required: true },
  chatId: { type: String, required: true },
  text: { type: String, required: false, default: "" }, 
  mediaUrl: { type: String, required: false }, 
  timestamp: { type: Date, default: Date.now },
  seen: { type: Boolean, default: false },
});

export default models.Message || model("Message", MessageSchema);