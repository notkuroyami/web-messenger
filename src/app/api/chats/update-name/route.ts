import { NextResponse } from "next/server";
import connectDB from "@/lib/db"; 
import Chat from "@/models/Chat"; // Проверь путь к модели чата

export async function PATCH(req: Request) {
  try {
    await connectDB();
    const { chatId, newName } = await req.json();

    if (!chatId || !newName) {
      return NextResponse.json({ message: "Missing data" }, { status: 400 });
    }

    // Обновляем название чата в базе
    // Если у тебя сейчас чаты привязаны к именам, позже заменим на ID
    const updatedChat = await Chat.findByIdAndUpdate(
      chatId,
      { name: newName },
      { new: true }
    );

    return NextResponse.json(updatedChat, { status: 200 });
  } catch (error) {
    return NextResponse.json({ message: "Error updating name" }, { status: 500 });
  }
}