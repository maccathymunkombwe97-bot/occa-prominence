// Central phone-number validation & normalization.
//
// Why this exists: the old auth code just did `phone.replace(/\D/g, "")` —
// stripping everything that wasn't a digit — and used that as the account's
// storage key. That "works" only if a person types their number exactly the
// same way at registration and at every later login. In practice people
// don't: "+260977123456" at signup vs "0977123456" at login are the *same*
// real phone but produce two different keys ("260977123456" vs
// "0977123456"), so a 100% correct phone + password combo would silently
// fail to authenticate. That inconsistency — not a broken password check —
// was the source of the intermittent "correct details, still rejected" bug.
//
// This module fixes that by parsing the number against real ITU/E.164
// numbering-plan data (via libphonenumber-js) and always keying accounts off
// one canonical form. As a side effect this also gives us real validation:
// a made-up country code (e.g. "+103", which doesn't exist) or a real
// country code followed by the wrong number of digits for that country
// (the classic mistake of keeping the local trunk "0" after adding a country
// code, e.g. "+260 0977 123 456" or "+33 0754 12 34 56") is correctly
// rejected, because it isn't a real, dialable/WhatsApp-reachable number.
import { parsePhoneNumberFromString } from 'libphonenumber-js';
import type { CountryCode } from 'libphonenumber-js';

// Used only when someone types a local number with no country code at all
// (e.g. "0977123456"). Adjust if the primary market changes.
export const DEFAULT_PHONE_COUNTRY: CountryCode = 'ZM';

export interface PhoneValidation {
  valid: boolean;
  /** Canonical E.164 form, e.g. "+260977123456". Only set when valid. */
  e164?: string;
  /** E.164 without the leading "+" — this is what accounts are keyed by, e.g. "260977123456". */
  storageKey?: string;
  /** Nicely formatted international form for display / wa.me links, e.g. "+260 97 712 3456". */
  display?: string;
  /**
   * Older / alternate digit-string shapes this same real number may have
   * been stored under previously (e.g. before this normalization existed,
   * or if someone dials with "00" instead of "+"). Used as a lookup
   * fallback so existing accounts keep working, and as a duplicate-account
   * check so the same number can't register twice under different keys.
   */
  legacyKeys?: string[];
  error?: string;
}

export function validatePhone(raw: string): PhoneValidation {
  const input = (raw ?? '').trim();

  if (!input) {
    return { valid: false, error: 'Please enter your phone number.' };
  }

  if (!/^[+0-9()\-\s]+$/.test(input)) {
    return { valid: false, error: 'Phone number can only contain digits, spaces, dashes, and a leading +.' };
  }

  let phoneNumber;
  try {
    phoneNumber = parsePhoneNumberFromString(input, DEFAULT_PHONE_COUNTRY);
  } catch {
    phoneNumber = undefined;
  }

  if (!phoneNumber || !phoneNumber.isValid()) {
    // The single most common real-world mistake: keeping the local "0"
    // after already adding a country code. Give a specific, actionable hint
    // instead of a generic "invalid number" error.
    const nationalDigits = phoneNumber?.nationalNumber ?? '';
    if (input.startsWith('+') && phoneNumber?.country && nationalDigits.startsWith('0')) {
      return {
        valid: false,
        error: 'Drop the extra 0 right after your country code — e.g. +260 97 712 3456, not +260 0977 123 456.',
      };
    }
    return {
      valid: false,
      error: "That doesn't look like a real, WhatsApp-reachable number. Include a valid country code (e.g. +260 97 712 3456) and check the digit count.",
    };
  }

  const e164 = phoneNumber.number; // already canonical E.164
  const storageKey = e164.slice(1); // digits only, no "+"
  const countryCallingCode = phoneNumber.countryCallingCode;
  const nationalNumber = phoneNumber.nationalNumber;

  const legacyKeys = Array.from(
    new Set(
      [
        storageKey,
        nationalNumber,
        `0${nationalNumber}`,
        `${countryCallingCode}${nationalNumber}`,
        `00${countryCallingCode}${nationalNumber}`,
      ].filter(Boolean)
    )
  );

  return {
    valid: true,
    e164,
    storageKey,
    display: phoneNumber.formatInternational(),
    legacyKeys,
  };
}
