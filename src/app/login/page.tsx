"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [greetingMsg, setgreetingMsg] = useState("");

  const handleRegister = () => router.push("/register");

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setMessage(data.message || "Ошибка входа");
        return;
      }

      setgreetingMsg(`Welcome, ${data.user.username}!`);

      const greeting = document.getElementById("greeting");

      if (greeting) {
        greeting.classList.remove("opacity-0");
        greeting.classList.add("opacity-100");
      }

      setTimeout(() => router.push("/chats"), 1000);
    } catch (err) {
      console.error("Request error:", err);
      setMessage("Server connection error");
    }
  };

  return (
    <div className="h-screen w-screen place-content-center bg-gradient-to-r from-[#1c1b1b] via-[#000000] to-[#1c1b1b]">
      <div className="h-150 w-150 justify-self-center place-content-center">
        <h1 className="text-6xl justify-self-center mb-15 font-bold text-white tracking-[4px]">
          Login
        </h1>
        <form
          className="flex flex-col gap-10 tracking-[2px] text-xl font-bold"
          onSubmit={handleSubmit}
        >
          <div className="flex justify-between items-center">
            <label className="mr-3 py-1">Email</label>
            <input
              className="bg-white rounded-xl px-3 py-1 focus:outline-none text-black"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="flex justify-between items-center">
            <label className="mr-3 py-1">Password</label>
            <input
              className="bg-white rounded-xl px-3 py-1 focus:outline-none text-black"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <div className="flex gap-4">
            <button
              type="button"
              className="px-4 w-45 py-2 hover:bg-zinc-800 active:bg-zinc-900 focus:outline-none text-white rounded block mx-auto cursor-pointer"
              onClick={handleRegister}
            >
              Register
            </button>
            <button
              type="submit"
              className="px-4 w-45 py-2 bg-indigo-700 hover:bg-indigo-800 active:bg-indigo-900 focus:outline-none text-white rounded block mx-auto cursor-pointer"
            >
              Login
            </button>
          </div>
        </form>

        {message && <p className="text-center mt-4 text-red-500 font-bold tracking-[4px]">{message}! o_O</p>}
        <div
          id="greeting"
          className="fixed pointer-events-none inset-0 flex items-center justify-center bg-indigo-800/50 opacity-0 transition-opacity duration-900"
        >
          <p className="text-6xl bg-black/20 p-10 rounded-[50] font-bold text-white text-center tracking-[4px]">
            {greetingMsg}! -_-
          </p>
        </div>
      </div>
    </div>
  );
}
