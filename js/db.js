// Firebase initialization + Firestore helpers (buildless, via gstatic CDN).
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  getDocs,
  onSnapshot,
  serverTimestamp,
  arrayUnion,
  arrayRemove,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
import { firebaseConfig, PROFILES_COLLECTION } from "./config.js";

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export function slug(name) {
  return String(name || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function profileRef(id) {
  return doc(db, PROFILES_COLLECTION, id);
}

// Returns the raw profile object or null.
export async function loadProfile(id) {
  const snap = await getDoc(profileRef(id));
  return snap.exists() ? snap.data() : null;
}

// Full overwrite (merge) of a profile document.
export async function saveProfile(id, data) {
  const payload = { ...data, updatedAt: serverTimestamp() };
  await setDoc(profileRef(id), payload, { merge: true });
}

// List all profiles (for the "who's tracking?" screen).
export async function listProfiles() {
  const snap = await getDocs(collection(db, PROFILES_COLLECTION));
  const out = [];
  snap.forEach((d) => {
    const data = d.data() || {};
    out.push({ id: d.id, name: data.name || d.id, settings: data.settings || {} });
  });
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

// Live subscription to a profile. Returns an unsubscribe function.
export function watchProfile(id, cb) {
  return onSnapshot(profileRef(id), (snap) => {
    cb(snap.exists() ? snap.data() : null);
  });
}

// Merge a few top-level fields into a profile (own or a friend's) without
// overwriting the whole document.
export async function patchProfile(id, fields) {
  await updateDoc(profileRef(id), { ...fields, updatedAt: serverTimestamp() });
}

// Append/remove items from an array field (supports dotted nested paths).
export async function arrayPush(id, path, value) {
  await updateDoc(profileRef(id), { [path]: arrayUnion(value) });
}
export async function arrayPull(id, path, value) {
  await updateDoc(profileRef(id), { [path]: arrayRemove(value) });
}

// SHA-256 hex of a PIN (so the raw PIN is never stored).
export async function hashPin(pin) {
  const data = new TextEncoder().encode("ww-pin:" + String(pin));
  const buf = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export { serverTimestamp, arrayUnion, arrayRemove };
