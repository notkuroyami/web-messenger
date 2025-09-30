"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation"; 

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const router = useRouter();
  
  const handleRegister = () => {
    router.push("/register");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    alert(`Username: ${username}\nPassword: ${password}`);
    // Для редиректа после логина можно: router.push("/dashboard");
  };

  return (
    <div className="h-screen w-screen place-content-center bg-gradient-to-r from-[#1c1b1b] via-[#000000] to-[#1c1b1b]">
      <div className="h-150 w-150 justify-self-center place-content-center">
        <h1 className='text-6xl justify-self-center mb-15 font-bold text-white tracking-[4]'>Login</h1>
        <form className='flex flex-col gap-10 tracking-[2] text-xl font-bold' onSubmit={handleSubmit}>
          <div className='flex justify-between items-center'>
            <label className='mr-3 py-1'>Username </label>
            <input
              className='bg-white rounded-xl px-3 py-1 focus:outline-none text-black'
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </div>
          <div className='flex justify-between items-center'>
            <label className='mr-3 py-1'>Password </label>
            <input 
              className='bg-white rounded-xl px-3 py-1 focus:outline-none text-black'
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <div className='flex gap-4'>
            <button 
              type="button" 
              className='px-4 w-45 py-2 hover:bg-zinc-800 active:bg-zinc-900 focus:outline-none text-white rounded block mx-auto cursor-pointer' 
              onClick={handleRegister}
            >
              Register
            </button>
            <button 
              className='px-4 w-45 py-2 bg-indigo-700 hover:bg-indigo-800 active:bg-indigo-900 focus:outline-none text-white rounded block mx-auto cursor-pointer' 
              type="submit"
            >
              Login
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
