import { NextResponse } from "next/server";
import dbConnect from "@/lib/db"; // Проверь путь к БД
import Message from "@/models/Message"; // Проверь путь к модели

export async function PUT(req: Request) {
  try {
    await dbConnect();
    const { sender, receiver } = await req.json();

    if (!sender || !receiver) {
      return NextResponse.json(
        { message: "Missing sender or receiver" },
        { status: 400 },
      );
    }

    // Обновляем сообщения в базе
    const result = await Message.updateMany(
      {
        sender: sender,
        receiver: receiver,
        seen: false,
      },
      {
        $set: { seen: true },
      },
    );

    return NextResponse.json({
      message: "Messages marked as read",
      modifiedCount: result.modifiedCount,
    });
  } catch (error) {
    console.error("Error in API/MESSAGES/READ:", error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 },
    );
  }
}
