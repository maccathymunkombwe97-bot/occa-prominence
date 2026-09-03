import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Send, Briefcase, MoreHorizontal, Loader2 } from 'lucide-react';
import { Conversation, Message, Listing } from '../types';
import { formatMessageClockTime, formatDayDivider } from '../utils/timeFormatter';
import { hasAvailableExternalContactMethods } from '../utils/contactAvailability';

interface ConversationPageProps {
  conversation: Conversation;
  listings: Listing[];
  authFetch: (url: string, options?: RequestInit) => Promise<Response>;
  onBack: () => void;
  onShowToast: (msg: string) => void;
  onConversationUpdate: (conversation: Conversation) => void;
  onOpenListing: (listing: Listing) => void;
  onShowOtherContactOptions: (listing: Listing) => void;
}

// A message this account just sent but hasn't been confirmed by the server yet — shown
// immediately so sending feels instant, then reconciled once the request resolves.
interface PendingMessage extends Message {
  isPending?: boolean;
  isFailed?: boolean;
}

const Avatar: React.FC<{ name: string; profilePicUrl?: string; sizeClass?: string }> = ({
  name,
  profilePicUrl,
  sizeClass = 'w-7 h-7',
}) =>
  profilePicUrl ? (
    <img src={profilePicUrl} alt={name} className={`${sizeClass} rounded-full object-cover border border-neutral-700 shrink-0`} />
  ) : (
    <div className={`${sizeClass} rounded-full bg-black border border-neutral-700 flex items-center justify-center font-bold text-amber-400 text-xs shrink-0`}>
      {name?.[0]?.toUpperCase() || '?'}
    </div>
  );

// While this page is open, poll for new messages every few seconds — the app doesn't run
// a websocket server, so this keeps a thread feeling live without one. Backgrounded tabs
// pause polling entirely (see the visibility-change effect below) so an idle chat window
// doesn't keep hitting the network/battery on a low-resource device.
const POLL_INTERVAL_MS = 5000;

export const ConversationPage: React.FC<ConversationPageProps> = ({
  conversation,
  listings,
  authFetch,
  onBack,
  onShowToast,
  onConversationUpdate,
  onOpenListing,
  onShowOtherContactOptions,
}) => {
  // Confirmed messages (from the server) and in-flight optimistic sends are kept
  // separate and only combined for rendering — this keeps the merge-on-poll logic
  // simple: polls only ever touch `messages`, never `pendingMessages`.
  const [messages, setMessages] = useState<Message[]>([]);
  const [pendingMessages, setPendingMessages] = useState<PendingMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [draft, setDraft] = useState('');
  const [isSending, setIsSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  // Timestamp of the newest message we've already fetched, so subsequent polls can ask
  // the server for only what's new (?since=...) instead of re-downloading and
  // re-sorting the whole thread every 5 seconds.
  const latestTimestampRef = useRef<string | undefined>(undefined);

  const displayMessages: PendingMessage[] = [...messages, ...pendingMessages];

  const relatedListing = conversation.listingId ? listings.find((l) => l.id === conversation.listingId) : undefined;
  const canShowOtherContactOptions = !!relatedListing && hasAvailableExternalContactMethods(relatedListing);

  const scrollToBottom = (smooth = false) => {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: smooth ? 'smooth' : 'auto' });
    });
  };

  const loadMessages = async (opts: { silent?: boolean } = {}) => {
    try {
      // A silent (polling) call asks only for messages newer than the last one we have —
      // a full re-fetch only happens on first open of the thread.
      const since = opts.silent ? latestTimestampRef.current : undefined;
      const url = since
        ? `/api/conversations/${conversation.id}/messages?since=${encodeURIComponent(since)}`
        : `/api/conversations/${conversation.id}/messages`;
      const res = await authFetch(url);
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Could not load messages.');
      }
      const fetched: Message[] = data.messages;
      if (fetched.length > 0) {
        latestTimestampRef.current = fetched[fetched.length - 1].createdAt;
        if (since) {
          setMessages((prev) => {
            const existingIds = new Set(prev.map((m) => m.id));
            const newOnes = fetched.filter((m) => !existingIds.has(m.id));
            return newOnes.length > 0 ? [...prev, ...newOnes] : prev;
          });
        } else {
          setMessages(fetched);
        }
      } else if (!since) {
        setMessages([]);
      }
      if (data.conversation) {
        onConversationUpdate(data.conversation);
      }
    } catch (e: any) {
      if (!opts.silent) {
        onShowToast(e.message || 'Could not load messages. Please check your connection.');
      }
    } finally {
      if (!opts.silent) setIsLoading(false);
    }
  };

  useEffect(() => {
    setMessages([]);
    setPendingMessages([]);
    latestTimestampRef.current = undefined;
    setIsLoading(true);
    loadMessages().then(() => scrollToBottom());

    // Pausing the poll while the tab/app is backgrounded avoids burning battery and data
    // on a thread nobody is looking at, and catches up instantly (not just on the next
    // tick) the moment it's visible again.
    let intervalId: ReturnType<typeof setInterval> | null = null;
    const startPolling = () => {
      if (intervalId) return;
      intervalId = setInterval(() => loadMessages({ silent: true }), POLL_INTERVAL_MS);
    };
    const stopPolling = () => {
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }
    };
    const handleVisibilityChange = () => {
      if (document.hidden) {
        stopPolling();
      } else {
        loadMessages({ silent: true });
        startPolling();
      }
    };

    if (!document.hidden) startPolling();
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      stopPolling();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversation.id]);

  useEffect(() => {
    scrollToBottom(true);
  }, [displayMessages.length]);

  const handleSend = async () => {
    const text = draft.trim();
    if (!text || isSending) return;

    const tempId = `temp-${Date.now()}`;
    const optimisticMessage: PendingMessage = {
      id: tempId,
      conversationId: conversation.id,
      text,
      createdAt: new Date().toISOString(),
      isMine: true,
      senderName: 'You',
      isPending: true,
    };
    setPendingMessages((prev) => [...prev, optimisticMessage]);
    setDraft('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
    setIsSending(true);

    try {
      const res = await authFetch(`/api/conversations/${conversation.id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      const data = await res.json();
      if (!res.ok || !data.success || !data.message) {
        throw new Error(data.error || 'Message failed to send.');
      }
      setPendingMessages((prev) => prev.filter((m) => m.id !== tempId));
      setMessages((prev) => (prev.some((m) => m.id === data.message.id) ? prev : [...prev, data.message]));
      latestTimestampRef.current = data.message.createdAt;
      if (data.conversation) {
        onConversationUpdate(data.conversation);
      }
    } catch (e: any) {
      setPendingMessages((prev) => prev.map((m) => (m.id === tempId ? { ...m, isPending: false, isFailed: true } : m)));
      onShowToast(e.message || 'Message failed to send. Please try again.');
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const label = conversation.otherParticipant.companyName || conversation.otherParticipant.name;

  // Insert a date divider whenever the calendar day changes between consecutive messages.
  let lastDay = '';


  return (
    <div className="max-w-3xl mx-auto h-[calc(100vh-64px)] flex flex-col animate-in fade-in">
      {/* Thread Header */}
      <div className="px-4 sm:px-6 py-3 border-b border-neutral-800 flex items-center gap-3 bg-black/60 backdrop-blur-sm sticky top-0 z-10">
        <button onClick={onBack} className="text-neutral-400 hover:text-amber-400 transition-colors shrink-0" title="Back to Messages">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <Avatar name={label} profilePicUrl={conversation.otherParticipant.profilePicUrl} sizeClass="w-9 h-9" />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold text-white truncate">{label}</div>
          {conversation.listingTitle && (
            <button
              onClick={() => relatedListing && onOpenListing(relatedListing)}
              disabled={!relatedListing}
              className="text-[11px] text-amber-400/90 hover:text-amber-300 flex items-center gap-1 truncate disabled:cursor-default disabled:hover:text-amber-400/90"
            >
              <Briefcase className="w-3 h-3 shrink-0" />
              <span className="truncate">{conversation.listingTitle}</span>
            </button>
          )}
        </div>
        {canShowOtherContactOptions && (
          <button
            onClick={() => onShowOtherContactOptions(relatedListing!)}
            className="text-neutral-500 hover:text-amber-400 transition-colors shrink-0 p-1.5 rounded-lg hover:bg-neutral-900"
            title="Other ways to contact"
          >
            <MoreHorizontal className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Message Thread */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 space-y-1">
        {isLoading ? (
          <div className="flex items-center justify-center h-full text-neutral-600">
            <Loader2 className="w-5 h-5 animate-spin" />
          </div>
        ) : displayMessages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center gap-2 px-6">
            <Avatar name={label} profilePicUrl={conversation.otherParticipant.profilePicUrl} sizeClass="w-14 h-14" />
            <p className="text-sm font-bold text-white mt-2">{label}</p>
            <p className="text-xs text-neutral-500 max-w-xs">
              {conversation.listingTitle
                ? `Say hello about "${conversation.listingTitle}" — this is the start of your conversation.`
                : 'This is the start of your conversation.'}
            </p>
          </div>
        ) : (
          displayMessages.map((message, idx) => {
            const day = formatDayDivider(message.createdAt);
            const showDivider = day !== lastDay;
            lastDay = day;
            const showAvatar = !message.isMine && (idx === 0 || displayMessages[idx - 1].isMine);

            return (
              <React.Fragment key={message.id}>
                {showDivider && (
                  <div className="flex items-center justify-center py-3">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-600 bg-neutral-900 border border-neutral-800 rounded-full px-3 py-1">
                      {day}
                    </span>
                  </div>
                )}
                <div className={`flex items-end gap-2 ${message.isMine ? 'justify-end' : 'justify-start'} mt-1.5`}>
                  {!message.isMine && (
                    <div className="w-7 shrink-0">
                      {showAvatar && (
                        <Avatar name={message.senderName} profilePicUrl={message.senderProfilePicUrl} />
                      )}
                    </div>
                  )}
                  <div
                    className={`max-w-[75%] sm:max-w-[65%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed break-words ${
                      message.isMine
                        ? `text-black rounded-br-sm ${message.isFailed ? 'bg-red-400/80' : 'bg-amber-400'}`
                        : 'bg-neutral-900 border border-neutral-800 text-neutral-100 rounded-bl-sm'
                    } ${message.isPending ? 'opacity-60' : ''}`}
                  >
                    {message.text}
                    <div className={`text-[10px] mt-1 ${message.isMine ? 'text-black/60' : 'text-neutral-500'}`}>
                      {message.isFailed ? 'Failed to send' : message.isPending ? 'Sending…' : formatMessageClockTime(message.createdAt)}
                    </div>
                  </div>
                </div>
              </React.Fragment>
            );
          })
        )}
      </div>

      {/* Composer */}
      <div className="px-4 sm:px-6 py-3 border-t border-neutral-800 bg-black/60 backdrop-blur-sm">
        <div className="flex items-end gap-2 bg-neutral-900 border border-neutral-800 rounded-2xl px-3 py-2 focus-within:border-amber-400/50 transition-colors">
          <textarea
            ref={textareaRef}
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
              e.target.style.height = 'auto';
              e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
            }}
            onKeyDown={handleKeyDown}
            placeholder={`Message ${label}…`}
            rows={1}
            className="flex-1 bg-transparent text-sm text-white placeholder-neutral-500 resize-none outline-none max-h-[120px] py-1.5"
          />
          <button
            onClick={handleSend}
            disabled={!draft.trim() || isSending}
            className="shrink-0 w-9 h-9 rounded-full bg-amber-400 disabled:bg-neutral-800 disabled:text-neutral-600 text-black flex items-center justify-center transition-all active:scale-95"
            title="Send"
          >
            {isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </div>
  );
};
