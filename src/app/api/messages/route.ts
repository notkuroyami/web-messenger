import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import Message from "@/models/Message";

// Увеличиваем лимит размера тела запроса для тяжелых файлов (например, видео или длинных голосовых)
export const config = {
  api: {
    bodyParser: {
      sizeLimit: "10mb",
    },
  },
};

/**
 * Получение сообщений
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const chatId = searchParams.get("chatId");

    if (!chatId) {
      return NextResponse.json({ error: "No chatId provided" }, { status: 400 });
    }

    await connectDB();
    const messages = await Message.find({ chatId }).sort({ timestamp: 1 });
    return NextResponse.json(messages);
  } catch (error) {
    console.error("GET Messages Error:", error);
    return NextResponse.json({ error: "Failed to fetch messages" }, { status: 500 });
  }
}

/**
 * Создание нового сообщения
 */
export async function POST(req: Request) {
  try {
    await connectDB();
    const body = await req.json();

    const { sender, chatId, text, mediaUrl, type, size, duration } = body;

    // Валидация для диплома: сообщение должно иметь либо текст, либо медиафайл
    if (!text && !mediaUrl) {
      return NextResponse.json(
        { error: "Message must contain either text or media" },
        { status: 400 }
      );
    }

    // Проверка обязательных полей
    if (!sender || !chatId) {
      return NextResponse.json(
        { error: "Sender and chatId are required" },
        { status: 400 }
      );
    }

    const newMessage = await Message.create({
      sender, // Ожидается строка (username)[cite: 1]
      chatId,
      text: text || "",
      mediaUrl: mediaUrl || null,
      type: type || "text",
      size: Number(size) || 0,
      duration: Number(duration) || 0,
      seen: false,
      timestamp: new Date(),
    });

    return NextResponse.json(newMessage, { status: 201 });
  } catch (error: unknown) {
    // Выводим детальную ошибку в консоль сервера (терминал VS Code)
    console.error("POST Message Error Details:", error);
    
    return NextResponse.json(
      { 
        error: "Failed to create message", 
        details: error instanceof Error ? error.message : "Unknown error" 
      },
      { status: 500 }
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
      return NextResponse.json({ error: "Message ID is required" }, { status: 400 });
    }

    await connectDB();
    const updated = await Message.findByIdAndUpdate(
      messageId,
      { text },
      { new: true }
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
      return NextResponse.json({ error: "Message ID is required" }, { status: 400 });
    }

    await connectDB();
    await Message.findByIdAndDelete(messageId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE Message Error:", error);
    return NextResponse.json({ error: "Delete failed" }, { status: 500 });
  }
}