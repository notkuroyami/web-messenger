"use client";

import { signOut } from "next-auth/react";
import { IChat, User } from "@/types/chat";

interface ChatSidebarProps {
  currentUser: string;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  searchResults: User[];
  isGroupMode: boolean;
  setIsGroupMode: (v: boolean) => void;
  selectedUsers: User[];
  setSelectedUsers: (fn: (prev: User[]) => User[]) => void;
  groupName: string;
  setGroupName: (v: string) => void;
  recentChats: IChat[];
  selectedChat: IChat | null;
  setSelectedChat: (chat: IChat) => void;
  getChatDisplayName: (chat: IChat) => string | undefined;
  handleSelectUser: (username: string) => void;
  createGroupChat: () => void;
}

export default function ChatSideBar({
  currentUser,
  searchQuery,
  setSearchQuery,
  searchResults,
  isGroupMode,
  setIsGroupMode,
  selectedUsers,
  setSelectedUsers,
  groupName,
  setGroupName,
  recentChats,
  selectedChat,
  setSelectedChat,
  getChatDisplayName,
  handleSelectUser,
  createGroupChat,
}: ChatSidebarProps) {
  return (
    <aside className="w-80 bg-[#121212] m-2 rounded-2xl border border-gray-800 flex flex-col relative">
      {/* Header */}
      <div className="p-4 border-b border-gray-800 flex justify-between items-center">
        <div>
          <p className="text-[10px] text-gray-500 uppercase font-bold tracking-widest">
            Logged in
          </p>
          <p className="text-blue-400 font-medium">{currentUser}</p>
        </div>
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="text-[10px] bg-red-500/20 text-red-500 px-3 py-1.5 rounded-lg border border-red-500/20 hover:bg-red-500/20 transition-all"
        >
          EXIT
        </button>
      </div>

      {/* Search & Group Mode */}
      <div className="flex flex-col gap-2 p-4 border-b border-gray-800">
        <input
          className="p-3 bg-[#1e1e1e] rounded-xl outline-none border border-transparent focus:border-blue-600 text-sm transition-all"
          placeholder={isGroupMode ? "Add participants..." : "Search..."}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />

        {isGroupMode && (
          <div className="animate-in fade-in slide-in-from-top-2 flex flex-col gap-2">
            <input
              className="p-3 bg-blue-600/10 rounded-xl outline-none border border-blue-600/30 text-sm"
              placeholder="Enter group name..."
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
            />
            <div className="flex gap-2">
              <button
                onClick={createGroupChat}
                disabled={selectedUsers.length === 0 || !groupName}
                className="flex-1 bg-blue-600 py-2 rounded-lg text-[10px] font-bold uppercase disabled:opacity-30"
              >
                Create ({selectedUsers.length})
              </button>
              <button
                onClick={() => {
                  setIsGroupMode(false);
                  setSelectedUsers(() => []);
                }}
                className="bg-gray-800 px-4 py-2 rounded-lg text-[10px] font-bold uppercase"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Chat / Search List */}
      <div className="flex-1 overflow-y-auto px-2 pt-2 custom-scrollbar">
        {searchQuery ? (
          <div className="space-y-1">
            {searchResults.map((u) => {
              const isSelected = selectedUsers.some((sel) => sel._id === u._id);
              return (
                <div
                  key={u._id}
                  onClick={() => {
                    if (isGroupMode) {
                      setSelectedUsers((prev) =>
                        isSelected
                          ? prev.filter((user) => user._id !== u._id)
                          : [...prev, u],
                      );
                    } else {
                      handleSelectUser(u.username);
                    }
                  }}
                  className={`p-3 rounded-xl cursor-pointer flex items-center justify-between transition-all ${
                    isSelected
                      ? "bg-blue-600/20 border border-blue-600/40"
                      : "hover:bg-[#1e1e1e]"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center text-xs">
                      {u.username[0]}
                    </div>
                    <span className="text-sm">{u.username}</span>
                  </div>
                  {isGroupMode && (
                    <div
                      className={`w-4 h-4 rounded border flex items-center justify-center ${isSelected ? "bg-blue-500 border-blue-500" : "border-gray-600"}`}
                    >
                      {isSelected && <span className="text-[10px]">✓</span>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          recentChats.map((c) => (
            <div
              key={c._id}
              onClick={() => setSelectedChat(c)}
              className={`p-3 rounded-xl cursor-pointer mb-1 transition-all ${
                selectedChat?._id === c._id
                  ? "bg-blue-600/20 border border-blue-600/50"
                  : "hover:bg-[#1e1e1e]"
              }`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-xs ${c.type === "group" ? "bg-indigo-600" : "bg-blue-600"}`}
                >
                  {getChatDisplayName(c)?.[0]}
                </div>
                <span className="text-sm font-medium">
                  {getChatDisplayName(c)}
                </span>
              </div>
            </div>
          ))
        )}
      </div>

      {/* New Group Button */}
      {!isGroupMode && (
        <button
          onClick={() => setIsGroupMode(true)}
          className="absolute bottom-6 right-6 w-14 h-14 bg-blue-600 hover:bg-blue-500 rounded-full flex items-center justify-center shadow-2xl active:scale-90 transition-transform"
        >
          <span className="text-2xl">+</span>
        </button>
      )}
    </aside>
  );
}