import React from 'react';
import { X, MessageSquare, Mail, MessageCircle, Inbox } from 'lucide-react';
import { ContactMethod, Listing } from '../types';

interface ContactOptionsSheetProps {
  listing: Listing | null;
  methods: ContactMethod[];
  onClose: () => void;
  onSelectWhatsApp: (listing: Listing) => void;
  onSelectEmail: (listing: Listing) => void;
  onSelectDirectMessage: (listing: Listing) => void;
}

const METHOD_META: Record<ContactMethod, { label: string; sublabel: string; icon: React.ReactNode }> = {
  whatsapp: {
    label: 'WhatsApp',
    sublabel: 'Chat instantly on WhatsApp',
    icon: <MessageSquare className="w-4 h-4" />,
  },
  email: {
    label: 'Email',
    sublabel: 'Write to them via Gmail',
    icon: <Mail className="w-4 h-4" />,
  },
  dm: {
    label: 'Direct Message',
    sublabel: 'Send a text (SMS) message',
    icon: <MessageCircle className="w-4 h-4" />,
  },
};

export const ContactOptionsSheet: React.FC<ContactOptionsSheetProps> = ({
  listing,
  methods,
  onClose,
  onSelectWhatsApp,
  onSelectEmail,
  onSelectDirectMessage,
}) => {
  if (!listing) return null;

  const handleSelect = (method: ContactMethod) => {
    if (method === 'whatsapp') onSelectWhatsApp(listing);
    if (method === 'email') onSelectEmail(listing);
    if (method === 'dm') onSelectDirectMessage(listing);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm bg-neutral-900 border border-neutral-800 rounded-t-xl sm:rounded-xl overflow-hidden shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-3.5 border-b border-neutral-800 flex items-center justify-between bg-black/60">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Inbox className="w-4 h-4 text-amber-400" />
            Contact {listing.companyName}
          </h3>
          <button onClick={onClose} className="text-neutral-500 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-3 space-y-2">
          <p className="px-1.5 pb-1 text-[11px] text-neutral-500">
            Choose how you'd like to reach out about "{listing.title}".
          </p>
          {methods.map((method) => (
            <button
              key={method}
              onClick={() => handleSelect(method)}
              className="w-full flex items-center gap-3 py-3 px-3.5 rounded-lg bg-black border border-neutral-800 hover:border-amber-400/60 hover:bg-neutral-800/60 transition-all text-left"
            >
              <span className="w-8 h-8 rounded-full bg-amber-400/15 text-amber-400 flex items-center justify-center shrink-0">
                {METHOD_META[method].icon}
              </span>
              <span className="flex-1 min-w-0">
                <span className="block text-xs font-bold text-white">{METHOD_META[method].label}</span>
                <span className="block text-[10px] text-neutral-500 truncate">{METHOD_META[method].sublabel}</span>
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
