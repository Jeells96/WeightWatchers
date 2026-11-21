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
// Get a free key (1 min, no card) at: https://fdc.nal.usda.gov/api-key-signup
// Paste it here, OR enter it in the app under More → Food database (that is
// saved per-device and overrides this value). "DEMO_KEY" works but is limited
// to ~30 searches/hour across all users.
export const USDA_API_KEY = "DEMO_KEY";
