"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";

export default function RegisterPage() {
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");

  const router = useRouter();

  const handleLogin = () => {
    router.push("/login");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      setMessage("❌ Passwords do not match");
      return;
    }

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, email, password }),
      });

      const data = await res.json();

      if (res.ok) {
        setMessage("✅ Successful register!");

        setTimeout(() => router.push("/login"), 1000);
      } else {
        setMessage(`❌ Error: ${data.message}`);
      }
    } catch (err) {
      setMessage("❌ Server error, try later");
    }
  };

  return (
    <div className="h-screen w-screen place-content-center bg-gradient-to-r from-[#1c1b1b] via-[#000000] to-[#1c1b1b]">
      <div className="h-150 w-150 justify-self-center place-content-center">
        <h1 className="text-6xl justify-self-center mb-15 font-bold tracking-[4px] text-white text-center">
          Register
        </h1>

        <form
          className="flex flex-col gap-10 tracking-[2px] text-xl font-bold text-white"
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
            <label className="mr-3 py-1">Username</label>
            <input
              className="bg-white rounded-xl px-3 py-1 focus:outline-none text-black"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
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

          <div className="flex justify-between items-center">
            <label className="mr-3 py-1">Confirm</label>
            <input
              className="bg-white rounded-xl px-3 py-1 focus:outline-none text-black"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
          </div>

          <div className="flex">
            <button
              className="px-4 w-45 py-2 hover:bg-zinc-800 active:bg-zinc-900 focus:outline-none text-white rounded block mx-auto cursor-pointer"
              type="button"
              onClick={handleLogin}
            >
              Login
            </button>

            <button
              className="px-4 w-45 py-2 bg-indigo-700 hover:bg-indigo-800 active:bg-indigo-900 focus:outline-none text-white rounded block mx-auto cursor-pointer"
              type="submit"
            >
              Register
            </button>
          </div>
        </form>

        {message && <p className="text-center mt-4 text-white">{message}</p>}
      </div>
    </div>
  );
}
