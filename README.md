# Crafted Brews — Premium Bakery & Cafe

![Crafted Brews Website Banner](images/logo.PNG)

A beautifully crafted, modern, and highly responsive single-page e-commerce web application for a premium bakery and cafe. Built using vanilla HTML5, CSS3, and JavaScript, it features full Firebase integration (with an automatic local Mock fallback), a dynamic checkout wizard, real-time debounced search, camera profile captures, and a self-healing loyalty rewards program.

---

## ✨ Features

### 🌸 1. Premium Visual Identity
- **Harmonious Palette**: Aesthetic design blending Sakura Pink, Milk Tea, and Dark Chocolate accents.
- **Dynamic Animations**: Smooth hover translations, fade-ins, modal entries, glassmorphism headers, and interactive UI micro-animations.
- **Brand Footer**: Complete with opening hours, social links, contact coordinates, and store address.

### 🔍 2. Real-Time Debounced Search Overlay
- **Blurry Backdrop Modal**: Clicking the search icon opens a premium, fullscreen overlay with background blur.
- **Debounced Matching**: Features a `200ms` typing debounce to prevent UI lag, filtering product names case-insensitively.
- **Rich Dropdown Rows**: Renders search matches dynamically in a card list displaying thumbnail image, title, price, and hover highlights.
- **Scroll & Open Hook**: Clicking a search result closes the overlay, scrolls the page smoothly to center the product, and triggers the quick-view details modal automatically.
- **ESC & Click Closure**: Outside clicks or pressing `Escape` closes the search, clearing all inputs and result states.

### 🍰 3. E-Commerce Cart & Checkout Wizard
- **Slide-Out Cart**: Interactive shopping cart drawer displaying itemized lists, quantity modifiers, and dynamic sum calculations.
- **Stepper Checkout Modal**: A 3-step payment wizard:
  1. **Delivery Details**: Collects name, phone, address, and pre-fills from user account history.
  2. **Payment Step**: Supports dummy Credit Card forms and UPI payment (renders mock scan QR codes and validates input).
  3. **Order Placement**: Generates random receipt IDs, estimated delivery times, and commits order logs to Firestore/LocalStorage.

### 🔑 4. User Authentication & Profile Settings
- **Auth Modals**: Supports Email/Password registration, Login, Password Reset emails, and Google Popup authentication.
- **Profile Dashboard**: Slide-out user modal containing order logs, address logs, loyalty balances, and profile editors.
- **Multi-Source Avatar Uploads**: Edit name and update profile photos using preset lists, external URLs, system photo pickers (Gallery), or live browser video stream frame captures (Camera) projected onto a HTML5 `<canvas>`.
- **Base64 Canvas Scaling**: Captured photos are cropped and scaled to a lightweight `200x200` JPEG representation (~15KB) before saving. This avoids local storage allocation caps and Firestore document limits.

### 🏆 5. Self-Healing Loyalty Rewards
- **Automatic Accrual**: Credited with 1 loyalty point per Rs. 100 spent on checkout.
- **6-Month Expiry**: Points are assigned a validity expiration date set to 6 months from the latest purchase. Buying items extends the validity of all points for another 6 months.
- **Auto-Cleaner**: Checks expiry timestamps upon login and automatically resets expired points to 0.
- **Self-Correcting Sync**: Recalculates total lifetime spent across the user's orders collection to repair points balances dynamically if caches are out of sync.
- **Math Redemptions Proof**: Prevents illegitimate reward unlocks by mathematically auditing spent points (`lifetimeEarned - currentPoints`) against local coupon codes.

### 💬 6. Reviews & Double-Entry Guards
- **Feedback Forms**: Interactive star-rating submission panels.
- **Prevention Guards**: Restricts users from double-reviewing products, protecting review rankings.

---

## 🛠️ Technology Stack
- **Structure**: Semantic HTML5
- **Styling**: Vanilla CSS3 (Custom properties, CSS grid, Flexbox, media queries)
- **Logic**: Vanilla ES6+ JavaScript
- **Icons**: Font Awesome (v6 CDN)
- **Fonts**: Google Fonts (*Outfit* and *Playfair Display*)
- **Database & Auth**: Google Firebase SDK / HTML5 Web Storage API (Fallback)

---

## 🚀 Getting Started

### Method 1: Instant Local Running (No Setup Required!)
The website is equipped with a self-detecting **Mock Firebase Fallback**. If Firebase credentials are not configured, the website automatically simulates database storage, authentication, profile photos, and orders using your browser's local storage.
1. Download or clone this repository.
2. Double-click `index.html` to open it in any web browser, or serve it using an editor extension like VS Code's **Live Server**.

### Method 2: Connecting a Real Firebase Instance
To wire up a production database:
1. Create a project in the [Firebase Console](https://console.firebase.google.com/).
2. Enable **Authentication** (Email/Password & Google Sign-In) and **Cloud Firestore** in your console.
3. Open `firebase-config.js` in the project root:
   ```javascript
   const firebaseConfig = {
       apiKey: "YOUR_API_KEY",
       authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
       projectId: "YOUR_PROJECT_ID",
       storageBucket: "YOUR_PROJECT_ID.appspot.com",
       messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
       appId: "YOUR_APP_ID"
   };
   ```
4. Replace the placeholders with your project web app configuration snippet.
5. Reload the page! The website will automatically connect to your live database instance.

---

## 📂 File Directory Structure
```text
Bakery/
├── index.html          # Core markup, forms, and modals structure
├── style.css           # Grid layouts, custom variables, and media queries
├── script.js           # Client-side routing, search, profile canvas, & database handlers
├── firebase-config.js  # Production API keys & SDK connection config
└── images/             # Folder containing logo, product images, & hero media assets
```

---

## 📝 License
This project is open-source and available under the [MIT License](LICENSE).
