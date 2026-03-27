import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import Message from "@/models/Message";

export async function GET(req) {
  try {
    await connectDB();
    const { searchParams } = new URL(req.url);
    const currentUser = searchParams.get("user");

    if (!currentUser) {
      return NextResponse.json([]);
    }

    // Ищем все сообщения, где ты отправитель ИЛИ получатель
    const messages = await Message.find({
      $or: [{ sender: currentUser }, { receiver: currentUser }]
    }).sort({ timestamp: -1 });

    // Собираем уникальные имена собеседников
    const contacts = new Set();
    messages.forEach(msg => {
      if (msg.sender !== currentUser) contacts.add(msg.sender);
      if (msg.receiver !== currentUser) contacts.add(msg.receiver);
    });

    return NextResponse.json(Array.from(contacts));
  } catch (err) {
    console.error("Recent chats error:", err);
    return NextResponse.json([], { status: 500 });
  }
}