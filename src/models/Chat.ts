import mongoose, { Schema, models, model } from "mongoose";

const ChatSchema = new Schema(
  {

    name: { type: String, default: "" }, 
    

    type: { 
      type: String, 
      enum: ["direct", "group", "channel"], 
      default: "direct" 
    },


    participants: [{ type: String, required: true }],

    admin: { type: String },

    lastMessage: { type: Schema.Types.ObjectId, ref: "Message" }
  },
  { timestamps: true }
);

const Chat = models.Chat || model("Chat", ChatSchema);
export default Chat;