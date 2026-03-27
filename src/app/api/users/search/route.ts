import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import User from "@/models/User";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const query = searchParams.get("q");

    if (!query) return NextResponse.json([]);

    await connectDB();

    // Ищем пользователей, чье имя содержит поисковый запрос
    const users = await User.find({
      username: { $regex: query, $options: "i" },
    })
      .select("username _id email") 
      .limit(10);

    return NextResponse.json(users);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}