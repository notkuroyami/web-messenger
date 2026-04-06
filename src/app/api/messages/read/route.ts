import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import Message from "@/models/Message";

export async function PATCH(req: Request) {
  try {
    const { chatId, username } = await req.json();
    await connectDB();

    // Помечаем прочитанными все сообщения в этом чате, 
    // где отправитель НЕ текущий пользователь
    await Message.updateMany(
      { chatId, sender: { $ne: username }, seen: false },
      { $set: { seen: true } }
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: "Read update failed" }, { status: 500 });
  }
}