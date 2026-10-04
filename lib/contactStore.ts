"use client";
import { MAX_CONTACTS, sanitizeContacts, type TrustedContact } from "./contacts";
// Trusted contacts live only in this browser. The single contact from the warning screen's "Tell someone I trust"
// is offered as a starting point so the user doesn't type it twice.
const KEY = "callcanary.trustedContacts";
const LEGACY_KEY = "callcanary.trustedContact";
export function loadContacts(): TrustedContact[] {
  try {
    const saved = sanitizeContacts(JSON.parse(localStorage.getItem(KEY) || "null"));
    if (saved.length || localStorage.getItem(KEY)) return saved;
    return sanitizeContacts([JSON.parse(localStorage.getItem(LEGACY_KEY) || "null")]);
  } catch { return []; }
}
export function saveContacts(contacts: TrustedContact[]) {
  try { localStorage.setItem(KEY, JSON.stringify(contacts.slice(0, MAX_CONTACTS))); return true; } catch { return false; }
}
