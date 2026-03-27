import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true },
    passwordHash: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
  },
  { 
    collection: "Users",
    timestamps: true 
  }
);

const User = mongoose.models.User || mongoose.model("User", userSchema, "Users");

export default User;