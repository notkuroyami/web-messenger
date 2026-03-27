import { NextResponse } from "next/server";
import connectDB from '@/lib/db';
import Message from '@/models/Message';

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const user1 = searchParams.get("user1");
    const user2 = searchParams.get("user2");

    await connectDB();

    const messages = await Message.find({
        $or: [
            { sender: user1, receiver: user2 },
            { sender: user2, receiver: user1 },
        ]
    }).sort({ timestamp: 1 });

    return NextResponse.json(messages);
}


export async function POST(req: Request) {
    const { sender, receiver, text } = await req.json();
    await connectDB();

    const newMessage = await Message.create({ sender, receiver, text });
    return NextResponse.json(newMessage);
}