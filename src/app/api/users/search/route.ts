import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import User from "@/models/User"; // Твоя модель пользователя

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const query = searchParams.get("query");

  if (!query) return NextResponse.json([]);

  await connectDB();

  // Поиск пользователей, чье имя содержит query (без учета регистра)
  // Исключаем текущего пользователя, если нужно (добавь фильтр по сессии)
  const users = await User.find({
    username: { $regex: query, $options: "i" },
  })
    .limit(10)
    .select("username _id");

  return NextResponse.json(users);
}
