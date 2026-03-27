"use client";
import React, { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

interface User { _id: string; username: string; }
interface IMessage { sender: string; text: string; timestamp: string; }

export default function ChatsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [messages, setMessages] = useState<IMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [recentChats, setRecentChats] = useState<string[]>([]);

  const currentUser = session?.user?.name || "";

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/login");
    }
  }, [status, router]);

  useEffect(() => {
    const delay = setTimeout(async () => {
      if (searchQuery && currentUser) {
        const res = await fetch(`/api/users/search?q=${searchQuery}`);
        if (res.ok) {
          const data = await res.json();
          setSearchResults(data.filter((u: User) => u.username !== currentUser));
        }
      } else {
        setSearchResults([]);
      }
    }, 300);
    return () => clearTimeout(delay);
  }, [searchQuery, currentUser]);

  useEffect(() => {
    if (selectedUser && currentUser) {
      const fetchMsgs = async () => {
        const res = await fetch(`/api/messages?user1=${currentUser}&user2=${selectedUser.username}`);
        if (res.ok) {
          setMessages(await res.json());
        }
      };
      fetchMsgs();
      const interval = setInterval(fetchMsgs, 3000);
      return () => clearInterval(interval);
    }
  }, [selectedUser, currentUser]);

  useEffect(() => {
    if (currentUser) {
      const fetchRecent = async () => {
        const res = await fetch(`/api/chats/recent?user=${currentUser}`);
        if (res.ok) {
          const data = await res.json();
          setRecentChats(data);
        }
      };
      fetchRecent();
      const interval = setInterval(fetchRecent, 5000);
      return () => clearInterval(interval);
    }
  }, [currentUser]);

  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedUser || !currentUser) return;
    const body = { sender: currentUser, receiver: selectedUser.username, text: newMessage };
    try {
      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        setNewMessage("");
        setMessages((prev) => [...prev, { ...body, timestamp: new Date().toISOString() }]);
      }
    } catch (error) {
      console.error(error);
    }
  };

  if (status === "loading") {
    return (
      <div className="h-screen bg-black text-white flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mr-3"></div>
        Загрузка сессии...
      </div>
    );
  }

  if (!session) return null;

  return (
    <div className="flex h-screen bg-black text-white font-sans">
      <aside className="w-80 bg-[#121212] m-2 rounded-2xl border border-gray-800 flex flex-col">
        <div className="p-4 border-b border-gray-800">
          <p className="text-xs text-gray-500 uppercase font-bold">Logged in as</p>
          <p className="text-blue-400 font-medium">{currentUser}</p>
        </div>
        
        <input 
          className="m-4 p-3 bg-[#1e1e1e] rounded-xl outline-none border border-transparent focus:border-blue-600 transition" 
          placeholder="Search users..." 
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />

        <div className="flex-1 overflow-y-auto px-2">
          {/* ЛОГИКА ОТОБРАЖЕНИЯ СПИСКА */}
          {searchQuery.trim() === "" ? (
            // ПОКАЗЫВАЕМ НЕДАВНИЕ ЧАТЫ
            <>
              <p className="px-3 py-2 text-[10px] text-gray-500 uppercase tracking-widest font-bold">Recent Chats</p>
              {recentChats.length > 0 ? (
                recentChats.map((username) => (
                  <div 
                    key={username} 
                    onClick={() => setSelectedUser({ _id: username, username })} 
                    className={`p-3 mb-1 rounded-xl cursor-pointer hover:bg-[#1e1e1e] transition ${selectedUser?.username === username ? 'bg-[#1e1e1e] border border-gray-700' : 'border border-transparent'}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-900 flex items-center justify-center text-xs">
                        {username[0].toUpperCase()}
                      </div>
                      <span>{username}</span>
                    </div>
                  </div>
                ))
              ) : (
                <p className="p-3 text-sm text-gray-600">No recent chats</p>
              )}
            </>
          ) : (
            // ПОКАЗЫВАЕМ РЕЗУЛЬТАТЫ ПОИСКА
            <>
              <p className="px-3 py-2 text-[10px] text-gray-500 uppercase tracking-widest font-bold">Search Results</p>
              {searchResults.map(user => (
                <div 
                  key={user._id} 
                  onClick={() => {
                    setSelectedUser(user);
                    setSearchQuery(""); // Очищаем поиск после выбора
                  }}
                  className="p-3 mb-1 rounded-xl cursor-pointer hover:bg-[#1e1e1e] transition border border-transparent"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center text-xs text-gray-300">
                      ?
                    </div>
                    <span>{user.username}</span>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      </aside>

      <main className="flex-1 flex flex-col m-2 ml-0 bg-[#0a0a0a] rounded-2xl border border-gray-800 overflow-hidden">
        {selectedUser ? (
          <>
            <div className="p-4 border-b border-gray-800 bg-[#121212] flex justify-between items-center">
              <span className="font-bold text-lg">{selectedUser.username}</span>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.map((msg, i) => (
                <div key={i} className={`flex ${msg.sender === currentUser ? 'justify-end' : 'justify-start'}`}>
                  <div className={`p-3 rounded-2xl max-w-[70%] shadow-sm ${msg.sender === currentUser ? 'bg-blue-600 text-white' : 'bg-[#1e1e1e] text-gray-200'}`}>
                    {msg.text}
                  </div>
                </div>
              ))}
            </div>
            <div className="p-4 bg-[#121212] flex gap-2">
              <input 
                className="flex-1 bg-[#1e1e1e] p-3 rounded-xl outline-none border border-transparent focus:border-gray-700 transition" 
                value={newMessage} 
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                placeholder="Write a message..."
              />
              <button 
                onClick={sendMessage} 
                className="bg-blue-600 px-6 rounded-xl hover:bg-blue-500 active:scale-95 transition-all font-medium"
              >
                Send
              </button>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-600">
            <div className="w-16 h-16 bg-[#121212] rounded-full mb-4 flex items-center justify-center text-2xl">💬</div>
            <p>Select a user to start chatting</p>
          </div>
        )}
      </main>
    </div>
  );
}