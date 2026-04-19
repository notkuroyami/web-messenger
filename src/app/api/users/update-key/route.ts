import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import User from "@/models/User";

export async function PATCH(req: Request) {
  try {
    await connectDB();
    const { username, publicKey } = await req.json();

    if (!username || !publicKey) {
      return NextResponse.json(
        { message: "Username and publicKey are required" },
        { status: 400 }
      );
    }

    const updatedUser = await User.findOneAndUpdate(
      { username },
      { publicKey },
      { new: true }
    );

    if (!updatedUser) {
      return NextResponse.json({ message: "User not found" }, { status: 404 });
    }

    return NextResponse.json({ message: "Key updated" }, { status: 200 });
  } catch (err) {
    // Вместо any используем проверку типа
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    
    console.error("Update Key Error:", err);
    return NextResponse.json(
      { message: errorMessage },
      { status: 500 }
    );
  }
}