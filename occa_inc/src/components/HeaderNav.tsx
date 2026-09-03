import React from 'react';
import { Home, Search, UserRound, MessageCircle } from 'lucide-react';
import { PageTab } from '../types';

interface HeaderNavProps {
  activeTab: PageTab;
  onSelectTab: (tab: PageTab) => void;
  messagesUnreadCount?: number;
}

export const HeaderNav: React.FC<HeaderNavProps> = ({
  activeTab,
  onSelectTab,
  messagesUnreadCount,
}) => {
  return (
    <header className="sticky top-0 z-30 bg-black/40 backdrop-blur-md border-b border-neutral-800/80 px-4 sm:px-8 py-3.5 flex items-center justify-between gap-3 text-white shadow-lg">
      {/* Name Only Header Area - OCCA in Yellow */}
      <div 
        className="cursor-pointer flex flex-col select-none group"
        onClick={() => onSelectTab('home')}
      >
        <div className="text-xl font-black tracking-widest uppercase leading-none text-amber-400 group-hover:text-yellow-300 transition-colors">
          OCCA
        </div>
        <div className="text-[10px] text-amber-500/80 font-bold tracking-widest uppercase mt-0.5">
          technology
        </div>
      </div>

      <nav className="flex items-center gap-1 sm:gap-2">
        <button
          onClick={() => onSelectTab('home')}
          className={`relative p-2 sm:px-3.5 sm:py-2 rounded-full transition-all flex items-center gap-2 text-xs font-bold uppercase tracking-wider ${
            activeTab === 'home'
              ? 'bg-amber-400 text-black shadow-sm'
              : 'text-neutral-400 hover:text-white hover:bg-neutral-800'
          }`}
          title="Home Feed"
        >
          <Home className="w-4 h-4" />
          <span className="hidden md:inline">Home</span>
        </button>

        <button
          onClick={() => onSelectTab('messages')}
          className={`relative p-2 sm:px-3.5 sm:py-2 rounded-full transition-all flex items-center gap-2 text-xs font-bold uppercase tracking-wider ${
            activeTab === 'messages'
              ? 'bg-amber-400 text-black shadow-sm'
              : 'text-neutral-400 hover:text-white hover:bg-neutral-800'
          }`}
          title="Messages"
        >
          <MessageCircle className="w-4 h-4" />
          <span className="hidden md:inline">Messages</span>
          {messagesUnreadCount !== undefined && messagesUnreadCount > 0 && (
            <span
              className={`absolute -top-1 -right-1 min-w-[16px] h-[16px] px-1 rounded-full text-[9px] font-extrabold flex items-center justify-center ${
                activeTab === 'messages' ? 'bg-black text-amber-400' : 'bg-amber-400 text-black'
              }`}
            >
              {messagesUnreadCount > 9 ? '9+' : messagesUnreadCount}
            </span>
          )}
        </button>

        <button
          onClick={() => onSelectTab('search')}
          className={`relative p-2 sm:px-3.5 sm:py-2 rounded-full transition-all flex items-center gap-2 text-xs font-bold uppercase tracking-wider ${
            activeTab === 'search'
              ? 'bg-amber-400 text-black shadow-sm'
              : 'text-neutral-400 hover:text-white hover:bg-neutral-800'
          }`}
          title="Browse OCCA products and services"
        >
          <Search className="w-4 h-4" />
          <span className="hidden md:inline">Products</span>
        </button>

        <button
          onClick={() => onSelectTab('settings')}
          className={`relative p-2 sm:px-3.5 sm:py-2 rounded-full transition-all flex items-center gap-2 text-xs font-bold uppercase tracking-wider ${
            activeTab === 'settings'
              ? 'bg-amber-400 text-black shadow-sm'
              : 'text-neutral-400 hover:text-white hover:bg-neutral-800'
          }`}
          title="Settings"
        >
          <UserRound className="w-4 h-4" />
          <span className="hidden md:inline">Account</span>
        </button>
      </nav>
    </header>
  );
};

