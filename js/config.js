// Firebase project configuration (shared project).
// The app stores all of its data under the `ww_profiles` collection,
// so it does not touch the other sites that use this project.
export const firebaseConfig = {
  apiKey: "AIzaSyB2D5foTWkfu9oDF479wNvGCWMpErEffP0",
  authDomain: "fantasy-supermotocross.firebaseapp.com",
  projectId: "fantasy-supermotocross",
  storageBucket: "fantasy-supermotocross.firebasestorage.app",
  messagingSenderId: "534646221561",
  appId: "1:534646221561:web:bbd8c9123e30d672279028",
};

// Collection used by this app.
export const PROFILES_COLLECTION = "ww_profiles";

// USDA FoodData Central API key for the big food database (~600k foods).
// This is a free, rate-limited key (no billing, no account access) — safe to
// ship in the app, which is how it has to work for a client-side app anyway.
// You can regenerate it anytime at https://fdc.nal.usda.gov/api-key-signup.
// A per-device key entered in More → Food database overrides this value.
export const USDA_API_KEY = "j69rLqkmqtBhkgcMTbNPW9jCfCPkDWjtDWh7mLQ6";
