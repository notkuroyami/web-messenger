import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import connectDB from "@/lib/db";
import User from "@/models/User";
import bcrypt from "bcrypt";

export const authOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        await connectDB();

        // Ищем пользователя в твоей базе по Email
        const user = await User.findOne({ email: credentials.email });

        if (!user) {
          return null;
        }

        // Проверяем пароль (сравниваем с passwordHash из базы)
        const isValid = await bcrypt.compare(credentials.password, user.passwordHash);

        if (!isValid) {
          return null;
        }

        // Возвращаем объект пользователя. 
        // Поле "name" в NextAuth — это то, что мы выводим как username
        return {
          id: user._id.toString(),
          name: user.username,
          email: user.email,
        };
      }
    })
  ],
  session: {
    strategy: "jwt", // Используем JSON Web Tokens для сессий
  },
  pages: {
    signIn: "/login", // Куда редиректить, если нужна авторизация
  },
  secret: process.env.NEXTAUTH_SECRET, // Должен быть в твоем .env.local
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };