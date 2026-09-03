import React from 'react';
import { MessageCircle, Send, ChevronRight, Briefcase } from 'lucide-react';
import { Conversation } from '../types';
import { formatChatTimestamp } from '../utils/timeFormatter';

interface MessagesPageProps {
  conversations: Conversation[];
  isLoading: boolean;
  onOpenConversation: (conversation: Conversation) => void;
}

const ConversationAvatar: React.FC<{ conversation: Conversation }> = ({ conversation }) => {
  const { otherParticipant } = conversation;
  const label = otherParticipant.companyName || otherParticipant.name;
  return otherParticipant.profilePicUrl ? (
    <img
      src={otherParticipant.profilePicUrl}
      alt={label}
      className="w-12 h-12 rounded-full object-cover border border-neutral-700 shrink-0"
    />
  ) : (
    <div className="w-12 h-12 rounded-full bg-black border border-neutral-700 flex items-center justify-center font-bold text-amber-400 text-base shrink-0">
      {label?.[0]?.toUpperCase() || '?'}
    </div>
  );
};

export const MessagesPage: React.FC<MessagesPageProps> = ({ conversations, isLoading, onOpenConversation }) => {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-8 py-6 space-y-6 animate-in fade-in">
      {/* Page Header */}
      <div className="pb-5 border-b border-neutral-800">
        <span className="text-xs font-bold uppercase tracking-widest text-amber-400">Direct Messages</span>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight mt-1">Messages</h1>
        <p className="text-xs sm:text-sm text-neutral-400 mt-1 max-w-2xl">
          Chat directly with buyers and posters — the fastest way to reach anyone on Occa. Tap "Message" on any
          listing to start a conversation.
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-20 rounded-xl bg-neutral-900/60 border border-neutral-800 animate-pulse" />
          ))}
        </div>
      ) : conversations.length === 0 ? (
        <div className="text-center py-16 px-4 bg-neutral-900/50 border border-neutral-800 rounded-2xl space-y-4">
          <div className="w-16 h-16 rounded-full bg-neutral-800 border border-neutral-700 flex items-center justify-center mx-auto text-amber-400">
            <MessageCircle className="w-8 h-8" />
          </div>
          <div className="max-w-md mx-auto space-y-2">
            <h3 className="text-lg font-bold text-white">No Conversations Yet</h3>
            <p className="text-xs text-neutral-400 leading-relaxed">
              When you tap "Message" on a listing, your conversation with that poster will show up here.
            </p>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-neutral-800 overflow-hidden divide-y divide-neutral-800 bg-neutral-900/40">
          {conversations.map((conversation) => {
            const hasUnread = conversation.unreadCount > 0;
            const label = conversation.otherParticipant.companyName || conversation.otherParticipant.name;
            const preview = conversation.lastMessageText
              ? `${conversation.lastMessageIsMine ? 'You: ' : ''}${conversation.lastMessageText}`
              : conversation.listingTitle
              ? `Say hello about "${conversation.listingTitle}"`
              : 'Start the conversation';

            return (
              <button
                key={conversation.id}
                onClick={() => onOpenConversation(conversation)}
                className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-neutral-800/50 transition-colors"
              >
                <ConversationAvatar conversation={conversation} />

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className={`text-sm truncate ${hasUnread ? 'font-extrabold text-white' : 'font-bold text-neutral-200'}`}>
                      {label}
                    </span>
                    <span className={`text-[11px] shrink-0 ${hasUnread ? 'text-amber-400 font-bold' : 'text-neutral-500'}`}>
                      {formatChatTimestamp(conversation.lastMessageAt || conversation.createdAt)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2 mt-0.5">
                    <span className={`text-xs truncate ${hasUnread ? 'text-neutral-100 font-semibold' : 'text-neutral-500'}`}>
                      {conversation.listingTitle && !conversation.lastMessageText && (
                        <Briefcase className="w-3 h-3 inline-block mr-1 -mt-0.5 text-amber-400/80" />
                      )}
                      {preview}
                    </span>
                    {hasUnread ? (
                      <span className="shrink-0 min-w-[18px] h-[18px] px-1 rounded-full bg-amber-400 text-black text-[10px] font-extrabold flex items-center justify-center">
                        {conversation.unreadCount > 9 ? '9+' : conversation.unreadCount}
                      </span>
                    ) : (
                      <ChevronRight className="w-3.5 h-3.5 text-neutral-700 shrink-0" />
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {!isLoading && conversations.length > 0 && (
        <p className="text-center text-[11px] text-neutral-600 flex items-center justify-center gap-1.5">
          <Send className="w-3 h-3" />
          Messages sync automatically while the app is open.
        </p>
      )}
    </div>
  );
};
