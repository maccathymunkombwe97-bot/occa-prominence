import { Listing, ContactMethod } from '../types';

/**
 * In-app Messages is always on for every listing — this is only about the OPTIONAL
 * extra channels (WhatsApp / Email / Direct Message) a poster can additionally enable
 * in PostFormSheet. Filters a listing's declared contactMethods down to the ones that
 * actually have real contact info behind them, so the UI never offers a channel that
 * would just fail.
 */
export function getAvailableExternalContactMethods(listing: Listing): ContactMethod[] {
  const enabledMethods = listing.contactMethods || [];
  return enabledMethods.filter((method) => {
    if (method === 'whatsapp' || method === 'dm') return !!listing.posterWhatsapp;
    if (method === 'email') return !!listing.posterEmail;
    return false;
  });
}

export function hasAvailableExternalContactMethods(listing: Listing): boolean {
  return getAvailableExternalContactMethods(listing).length > 0;
}
