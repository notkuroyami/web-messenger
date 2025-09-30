"use client"

import React, { useState } from 'react';
import { useRouter } from "next/navigation";

export default function RegisterPage() {

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

   const router = useRouter();

     const handleLogin = () => {
    router.push("/login");
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      alert("Passwords do not match!");
      return;
    }
    alert(`Registered!\nUsername: ${username}\nPassword: ${password}`);
  };

  return (
    <div className="h-screen w-screen place-content-center bg-gradient-to-r from-[#1c1b1b] via-[#000000] to-[#1c1b1b]">
      <div className="h-150 w-150 justify-self-center place-content-center">
        <h1 className='text-6xl justify-self-center mb-15 font-bold tracking-[4px] text-white text-center'>Register</h1>
        <form className='flex flex-col gap-10 tracking-[2px] text-xl font-bold text-white' onSubmit={handleSubmit}>
          <div className='flex justify-between items-center'>
            <label className='mr-3 py-1'>Username</label>
            <input
              className='bg-white rounded-xl px-3 py-1 focus:outline-none text-black'
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </div>
          <div className='flex justify-between items-center'>
            <label className='mr-3 py-1'>Password</label>
            <input
              className='bg-white rounded-xl px-3 py-1 focus:outline-none text-black'
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <div className='flex justify-between items-center'>
            <label className='mr-3 py-1'>Confirm</label>
            <input
              className='bg-white rounded-xl px-3 py-1 focus:outline-none text-black'
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
          </div>
          <div className='flex'>
              <button 
              className='px-4 w-45 py-2 hover:bg-zinc-800 active:bg-zinc-900 focus:outline-none text-white rounded block mx-auto cursor-pointer' 
              type="submit"
              onClick={handleLogin}
              >Login</button>
            <button 
            className='px-4 w-45 py-2 bg-indigo-700 hover:bg-indigo-800 active:bg-indigo-900 focus:outline-none text-white rounded block mx-auto cursor-pointer' 
            type="submit">Register</button>
            </div>
        </form>
      </div>
    </div>
  );
}
