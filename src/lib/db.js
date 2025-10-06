import mongoose from "mongoose";

let isConnected = false;

export default async function connectDB() {
  if (isConnected) return;

  if (!process.env.MONGO_URI) {
    throw new Error("❌ MONGO_URI is not defined in .env.local");
  }

  try {
    console.log("Connecting to MongoDB:", process.env.MONGO_URI);
    await mongoose.connect(process.env.MONGO_URI, { dbName: "web-messenger" });
    isConnected = true;
    console.log("✅ MongoDB connected");
  } catch (err) {
    console.error("❌ DB connection error:", err);
    throw err;
  }
}
