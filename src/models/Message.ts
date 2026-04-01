import mongoose from 'mongoose';

const MessageSchema = new mongoose.Schema({
    sender: { type: String, required: true },
    receiver: { type: String, required: true},
    text: { type: String, required: true},
    timestamp: { type: Date, default: Date.now },
    seen: { type: Boolean, default: false},
    isEdited: { type: Boolean, default: false },
    isDeleted: { type: Boolean, default: false },
    content: { type: String },
});

export default mongoose.models.Message || mongoose.model("Message", MessageSchema);