import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import Chat from "@/models/Chat";

export async function GET(req: Request) {
  try {
    await connectDB();
    const { searchParams } = new URL(req.url);
    const username = searchParams.get("username");

    if (!username) return NextResponse.json({ error: "No username" }, { status: 400 });

    // Ищем чаты, где пользователь является участником
    const chats = await Chat.find({ participants: username }).sort({ updatedAt: -1 });
    return NextResponse.json(chats);
  } catch (e) {
    return NextResponse.json({ error: "Error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    await connectDB();
    const { participants, type, name } = await req.json();

    // Проверяем, существует ли уже такой direct-чат
    if (type === "direct") {
      const existing = await Chat.findOne({
        type: "direct",
        participants: { $all: participants }
      });
      if (existing) return NextResponse.json(existing);
    }

    const newChat = await Chat.create({ participants, type, name: name || "" });
    return NextResponse.json(newChat);
  } catch (e) {
    return NextResponse.json({ error: "Error" }, { status: 500 });
  }
}