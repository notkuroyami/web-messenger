import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import User from "@/models/User"; // Убедись, что путь к модели User верный

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const query = searchParams.get("query");

    if (!query) {
      return NextResponse.json([]);
    }

    await connectDB();

    // Ищем пользователей, где username содержит query (без учета регистра)
    const users = await User.find({
      username: { $regex: query, $options: "i" }
    })
    .select("username _id") // Берем только нужные поля
    .limit(10);

    return NextResponse.json(users);
  } catch (error) {
    console.error("Search API Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}