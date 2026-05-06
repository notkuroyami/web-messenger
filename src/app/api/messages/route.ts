import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import Message from "@/models/Message";

/**
 * Получение сообщений для конкретного чата
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const chatId = searchParams.get("chatId");

    if (!chatId) {
      return NextResponse.json(
        { error: "No chatId provided" },
        { status: 400 },
      );
    }

    await connectDB();
    const messages = await Message.find({ chatId }).sort({ timestamp: 1 });
    return NextResponse.json(messages);
  } catch (error) {
    console.error("GET Messages Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch messages" },
      { status: 500 },
    );
  }
}

/**
 * Создание нового сообщения (текстового или медиа)
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    await connectDB();

    // Явное перечисление полей гарантирует, что метаданные (size, duration)
    // сохранятся, даже если они придут как часть зашифрованного пакета.
    const newMessage = await Message.create({
      sender: body.sender,
      chatId: body.chatId,
      text: body.text || "",
      mediaUrl: body.mediaUrl,
      // Новые поля для твоего бакалаврского диплома:
      type: body.type || "text",
      size: body.size || 0,
      duration: body.duration || 0,
      seen: false,
    });

    return NextResponse.json(newMessage);
  } catch (error) {
    console.error("POST Message Error:", error);
    return NextResponse.json(
      { error: "Failed to create message" },
      { status: 500 },
    );
  }
}

/**
 * Редактирование текста сообщения
 */
export async function PATCH(req: Request) {
  try {
    const { messageId, text } = await req.json();

    if (!messageId) {
      return NextResponse.json(
        { error: "Message ID is required" },
        { status: 400 },
      );
    }

    await connectDB();
    const updated = await Message.findByIdAndUpdate(
      messageId,
      { text },
      { new: true }, // Возвращает уже обновленный документ
    );

    return NextResponse.json(updated);
  } catch (error) {
    console.error("PATCH Message Error:", error);
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }
}

/**
 * Удаление сообщения
 */
export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const messageId = searchParams.get("messageId");

    if (!messageId) {
      return NextResponse.json(
        { error: "Message ID is required" },
        { status: 400 },
      );
    }

    await connectDB();
    await Message.findByIdAndDelete(messageId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE Message Error:", error);
    return NextResponse.json({ error: "Delete failed" }, { status: 500 });
  }
}
