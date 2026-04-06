import { NextResponse } from "next/server";
import connectDB  from "@/lib/db";
import Message from "@/models/Message";

// ПОЛУЧЕНИЕ СООБЩЕНИЙ (GET)
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const chatId = searchParams.get("chatId");
  if (!chatId) return NextResponse.json({ error: "No chatId" }, { status: 400 });

  await connectDB();
  const messages = await Message.find({ chatId }).sort({ timestamp: 1 });
  return NextResponse.json(messages);
}

// СОЗДАНИЕ (POST)
export async function POST(req: Request) {
  try {
    const body = await req.json();
    await connectDB();
    const newMessage = await Message.create(body);
    return NextResponse.json(newMessage);
  } catch (error) {
    return NextResponse.json({ error: "Post failed" }, { status: 500 });
  }
}

// РЕДАКТИРОВАНИЕ (PATCH)
export async function PATCH(req: Request) {
  try {
    const { messageId, text } = await req.json(); // ID берем из тела
    await connectDB();
    const updated = await Message.findByIdAndUpdate(
      messageId,
      { text },
      { new: true }
    );
    return NextResponse.json(updated);
  } catch (error) {
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }
}

// УДАЛЕНИЕ (DELETE)
export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const messageId = searchParams.get("messageId"); // ID берем из query-параметра
    
    await connectDB();
    await Message.findByIdAndDelete(messageId);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: "Delete failed" }, { status: 500 });
  }
}