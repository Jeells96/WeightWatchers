// Firebase initialization + Firestore helpers (buildless, via gstatic CDN).
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  collection,
  getDocs,
  onSnapshot,
  serverTimestamp,
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

export { serverTimestamp };
