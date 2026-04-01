import { NextResponse, NextRequest } from "next/server";
import connectDB from '@/lib/db';
import Message from '@/models/Message';
import { getServerSession } from "next-auth/next"; // Лучше использовать /next
import { authOptions } from "@/lib/auth";

// GET и POST
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
    try {
        const { sender, receiver, text } = await req.json();
        await connectDB();
        const newMessage = await Message.create({ sender, receiver, text });
        return NextResponse.json(newMessage);
    } catch (e) {
        return new NextResponse("Error", { status: 500 });
    }
}

// PATCH (Редактирование)
export async function PATCH(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const id = searchParams.get("id");
        const { text } = await req.json();

        await connectDB();
        
        // Передаем authOptions БЕЗ "as any"
        const session = await getServerSession(authOptions);
        
        // Проверяем наличие сессии и имени пользователя
        if (!session || !session.user || !session.user.name) {
            return new NextResponse("Unauthorized", { status: 401 });
        }

        const updated = await Message.findOneAndUpdate(
            { _id: id, sender: session.user.name },
            { text, isEdited: true },
            { new: true }
        );

        return updated ? NextResponse.json(updated) : new NextResponse("Not Found", { status: 404 });
    } catch (e) { 
        return new NextResponse("Error", { status: 500 }); 
    }
}

// DELETE (Удаление)
export async function DELETE(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const id = searchParams.get("id");

        await connectDB();
        const session = await getServerSession(authOptions);
        
        if (!session || !session.user || !session.user.name) {
            return new NextResponse("Unauthorized", { status: 401 });
        }

        // Вместо обновления текста — просто УДАЛЯЕМ документ
        const deleted = await Message.findOneAndDelete({ 
            _id: id, 
            sender: session.user.name 
        });

        if (deleted) {
            return new NextResponse("Deleted", { status: 200 });
        } else {
            return new NextResponse("Not Found", { status: 404 });
        }
    } catch (e) { 
        return new NextResponse("Error", { status: 500 }); 
    }
}