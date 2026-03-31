import { NextResponse } from "next/server";
import dbConnect from "@/lib/db"; // Проверь путь к своему коннекту к БД
import Message from "@/models/Message";

export async function PUT(req: Request) {
  try {
    await dbConnect();

    // 1. Извлекаем данные из тела запроса (body)
    const body = await req.json();
    const { sender, receiver } = body;

    // Проверка на наличие данных, чтобы не было undefined в запросе к БД
    if (!sender || !receiver) {
      return NextResponse.json({ error: "Missing sender or receiver" }, { status: 400 });
    }

    // 2. Выполняем обновление в базе
    // Мы помечаем прочитанными те сообщения, которые пришли НАМ (receiver) ОТ НИХ (sender)
    await Message.updateMany(
      { 
        sender: sender, 
        receiver: receiver, 
        seen: false 
      },
      { 
        $set: { seen: true } 
      }
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Ошибка при обновлении статуса прочитано:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}