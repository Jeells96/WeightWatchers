# Weight Watchers (personal build)

A private, installable web app (PWA) for tracking **Points**, food, weight, and
activity — modeled on the Weight Watchers app. Built for personal use (you + your
wife), no passwords: you just pick your name.

Works on iPhone: open in Safari → **Share → Add to Home Screen**. It then runs
full-screen like a native app, with its own icon, and works offline.

---

## 1. Update your Firestore rules (required — do this first)

The app stores data in a new collection, `ww_profiles`. Your current rules don't
allow it yet, so **nothing will save until you add the rule below.**

Firebase console → your project → **Firestore Database → Rules**, paste this and
click **Publish** (this is your existing rules with the app's collection added):

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /league/state {
      allow read, write: if true;
    }
    match /soft75/{docId} {
      allow read, write: if true;
    }
    match /soft75_players/{playerId} {
      allow read, write: if true;
    }

    // Weight Watchers app — one document per person, by name.
    match /ww_profiles/{profileId} {
      allow read, write: if true;
    }
  }
}
```

The same text is in [`firestore.rules`](./firestore.rules).

> Note on security: as you asked, there's no login — anyone with the link and a
> name can read/write that name's profile. That's fine for a private family app.
> If you ever want it locked down, tell me and I'll add a simple PIN.

## 2. Host it (pick one)

The app is just static files, so any static host with **HTTPS** works (HTTPS is
required for "Add to Home Screen" and the camera/barcode scanner).

**Option A — GitHub Pages (easiest, recommended, doesn't touch your other Firebase sites)**
1. Push this repo to GitHub (this branch is already set up).
2. Repo **Settings → Pages →** Source: *Deploy from a branch*, pick this branch,
   folder `/ (root)`, Save.
3. Your app will be at `https://<your-user>.github.io/<repo>/`.

**Option B — Firebase Hosting**
⚠️ Your Firebase project (`fantasy-supermotocross`) may already host another site.
Deploying hosting to its **default** site can overwrite that. To be safe, create a
**new Hosting site** in the Firebase console (Hosting → Add another site, e.g.
`weightwatchers-fam`), then:
```
npm i -g firebase-tools
firebase login
firebase target:apply hosting app weightwatchers-fam   # link the new site
# add "target": "app" under hosting in firebase.json, or just deploy the whole thing
firebase deploy --only hosting
```
You can also deploy the rules from here instead of pasting them:
```
firebase deploy --only firestore:rules
```

## 3. First run

1. Open the hosted URL on the iPhone in Safari.
2. **Add to Home Screen**, open it from the new icon.
3. Tap **Create your profile**, enter a name, set weight goal + Points budget.
4. Do the same for the second person — both profiles live in the same project and
   you can switch between them in **More → Switch profile**.

---

## Preview without saving anything

Add `?demo=1` to the URL (e.g. `.../index.html?demo=1`) to see the whole app
filled with sample data. Nothing is written to Firebase in demo mode.

## How Points are calculated

WW's exact formula is proprietary and not published. Food Points here use a
well-known nutrition-based approximation (calories, saturated fat, sugar, protein)
that lands close to familiar values, with common fruits/veg/lean proteins treated
as **ZeroPoint**. You can always adjust a food's points or toggle ZeroPoint when
adding it, and your daily/weekly budgets are whatever you enter in Settings.
If your wife's plan uses specific numbers, set the daily/weekly budget in Settings
to match and it'll track exactly.

## Project layout

```
index.html              app shell + iOS PWA meta
manifest.webmanifest    home-screen install config
sw.js                   offline service worker
css/app.css             all styling (light + dark)
assets/                 app icons
js/
  config.js             Firebase config + collection name
  db.js                 Firebase init + Firestore helpers
  state.js              app state, budget math, Firestore sync
  points.js             Points calculation
  foods.js              Open Food Facts search + barcode + common foods
  foodsearch.js         the add-food experience (search/scan/serving)
  ui.js                 DOM helpers, icons, budget ring, weight chart
  app.js                router + bottom tab bar
  views/                my day, food, weight, activity, settings, onboarding
```
