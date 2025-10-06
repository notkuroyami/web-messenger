import { NextResponse } from "next/server";
import bcrypt from "bcrypt";
import connectDB from "@/lib/db";
import User from "@/models/User";

export async function POST(req) {
  try {
    await connectDB();

    const { username, email, password } = await req.json();

    // Проверка существующего email
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return NextResponse.json(
        { message: "Email already used" },
        { status: 400 }
      );
    }

    // Хэшируем пароль
    const passwordHash = await bcrypt.hash(password, 10);

    // Создаём пользователя
    const user = await User.create({ username, email, passwordHash });

    return NextResponse.json(
      {
        message: "Register successful",
        user: { id: user._id, username, email },
      },
      { status: 201 }
    );
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { message: "Server error", error: err.message },
      { status: 500 }
    );
  }
}
