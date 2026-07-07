// Safe check for Firebase CDN load & configuration
const isFirebaseLoaded = typeof firebase !== "undefined";
const isFirebaseConfigured = isFirebaseLoaded && typeof firebaseConfig !== "undefined" && 
                             firebaseConfig.apiKey !== "YOUR_API_KEY" && 
                             !firebaseConfig.apiKey.startsWith("YOUR_");

// Available Rewards definitions
const REWARDS_LIST = [
    { id: "r-donut", name: "Free Donut", cost: 30, icon: "fa-cookie" },
    { id: "r-coffee", name: "Free Hot Coffee", cost: 50, icon: "fa-mug-hot" },
    { id: "r-muffin", name: "Chocolate Muffin", cost: 80, icon: "fa-bread-slice" },
    { id: "r-coupon", name: "Rs. 150 Off Coupon", cost: 150, icon: "fa-ticket" }
];

let auth, db;
let isMockMode = false;

if (!isFirebaseLoaded || !isFirebaseConfigured) {
    isMockMode = true;
    console.log("%c Crafted Brews Bakery E-Commerce Active! Mock Firebase storage initialized (LocalStorage).", "color: #D27D2D; font-weight: bold; font-size: 12px;");
    
    // Ensure firebase namespace exists for helper constants
    if (typeof window.firebase === "undefined") {
        window.firebase = {};
    }
    if (!window.firebase.firestore) {
        window.firebase.firestore = {};
    }
    window.firebase.firestore.FieldValue = {
        serverTimestamp: () => new Date(),
        arrayUnion: (val) => ({ type: 'arrayUnion', value: val }),
        arrayRemove: (val) => ({ type: 'arrayRemove', value: val }),
        increment: (val) => ({ type: 'increment', value: val })
    };
    if (!window.firebase.auth) {
        window.firebase.auth = {
            GoogleAuthProvider: class {}
        };
    }

    // Mock Database State stored in localStorage
    const getMockStorage = (key) => JSON.parse(localStorage.getItem(key)) || {};
    const setMockStorage = (key, data) => localStorage.setItem(key, JSON.stringify(data));
    
    // Simple hashing function for mock passwords (XOR + Base64 obfuscation)
    function hashPasswordMock(password) {
        if (!password) return "";
        let hash = "";
        const key = 42;
        for (let i = 0; i < password.length; i++) {
            hash += String.fromCharCode(password.charCodeAt(i) ^ key);
        }
        return btoa(hash);
    }
    
    const mockUsers = getMockStorage("mock_firebase_users");
    let mockCurrentUser = JSON.parse(localStorage.getItem("mock_current_user")) || null;
    const authCallbacks = [];
    
    const triggerAuthChange = () => {
        localStorage.setItem("mock_current_user", JSON.stringify(mockCurrentUser));
        authCallbacks.forEach(cb => cb(mockCurrentUser));
    };

    auth = {
        get currentUser() {
            return mockCurrentUser;
        },
        onAuthStateChanged: (callback) => {
            authCallbacks.push(callback);
            // Fire immediately with current state
            callback(mockCurrentUser);
        },
        createUserWithEmailAndPassword: async (email, password) => {
            if (mockUsers[email]) {
                throw { code: "auth/email-already-in-use" };
            }
            const uid = "mock_uid_" + Math.floor(1000 + Math.random() * 9000);
            mockUsers[email] = { uid, email, password: hashPasswordMock(password), displayName: "" };
            setMockStorage("mock_firebase_users", mockUsers);
            
            mockCurrentUser = { uid, email, displayName: "" };
            triggerAuthChange();
            
            return {
                user: {
                    uid,
                    email,
                    displayName: "",
                    updateProfile: async (profile) => {
                        mockUsers[email].displayName = profile.displayName;
                        setMockStorage("mock_firebase_users", mockUsers);
                        mockCurrentUser.displayName = profile.displayName;
                        triggerAuthChange();
                    }
                }
            };
        },
        signInWithEmailAndPassword: async (email, password) => {
            const user = mockUsers[email];
            const hashedPassword = hashPasswordMock(password);
            if (!user || (user.password !== password && user.password !== hashedPassword)) {
                throw { code: "auth/wrong-password" };
            }
            mockCurrentUser = { uid: user.uid, email: user.email, displayName: user.displayName };
            triggerAuthChange();
            return { user: mockCurrentUser };
        },
        signInWithPopup: async (provider) => {
            return new Promise((resolve, reject) => {
                if (googleChooserModal) {
                    googleChooserModal.classList.add("active");
                }
                
                // Show default panel and hide add custom panel
                if (googleAccountsPanel) googleAccountsPanel.style.display = "block";
                if (googleAddPanel) googleAddPanel.style.display = "none";
                
                // Reset custom form and captured data
                if (googleCustomAccountForm) googleCustomAccountForm.reset();
                googleCapturedAvatarData = "";
                if (googleCustomAvatarPreview) googleCustomAvatarPreview.innerHTML = "YP";
                
                // Render Accounts List
                renderGoogleAccountsChooser(resolve, reject);
                
                // Save resolve/reject references globally for click handlers
                window.resolveGoogleSignIn = (userObj) => {
                    mockCurrentUser = userObj;
                    triggerAuthChange();
                    if (googleChooserModal) googleChooserModal.classList.remove("active");
                    resolve({ user: mockCurrentUser });
                };
                
                window.rejectGoogleSignIn = (err) => {
                    if (googleChooserModal) googleChooserModal.classList.remove("active");
                    reject(err);
                };
            });
        },
        sendPasswordResetEmail: async (email) => {
            if (!mockUsers[email]) {
                throw { code: "auth/user-not-found" };
            }
            return true;
        },
        signOut: async () => {
            mockCurrentUser = null;
            triggerAuthChange();
        }
    };
    
    function renderGoogleAccountsChooser(resolve, reject) {
        const googleAccountsList = document.querySelector("#google-accounts-list");
        if (!googleAccountsList) return;
        googleAccountsList.innerHTML = "";
        
        // Prepopulate default Google account
        const defaultGoogle = {
            displayName: "Yashri Parmar",
            email: "yashri.parmar@gmail.com",
            photoURL: "images/profile.jpg"
        };
        
        // Gather all accounts
        const localUsers = JSON.parse(localStorage.getItem("mock_firebase_users")) || {};
        const allAccounts = [defaultGoogle];
        
        // Add other existing users if they are not already in the list
        Object.keys(localUsers).forEach(email => {
            if (email !== defaultGoogle.email) {
                allAccounts.push({
                    displayName: localUsers[email].displayName || email.split("@")[0],
                    email: email,
                    photoURL: localUsers[email].photoURL || ""
                });
            }
        });
        
        allAccounts.forEach(account => {
            let avatarHTML = "";
            if (account.photoURL) {
                avatarHTML = `<img src="${account.photoURL}" alt="${account.displayName}" class="google-avatar">`;
            } else {
                const initial = account.displayName ? account.displayName[0].toUpperCase() : account.email[0].toUpperCase();
                avatarHTML = `<div class="google-avatar-fallback">${initial}</div>`;
            }
            
            const isCurrent = mockCurrentUser && mockCurrentUser.email === account.email;
            const itemHTML = `
                <div class="google-account-item" data-email="${account.email}" data-name="${account.displayName}" data-photo="${account.photoURL}">
                    ${avatarHTML}
                    <div class="google-account-info">
                        <div class="google-name">${account.displayName}</div>
                        <div class="google-email">${account.email}</div>
                    </div>
                    ${isCurrent ? '<i class="fa-solid fa-circle-check google-active-checkmark"></i>' : ''}
                </div>
            `;
            googleAccountsList.insertAdjacentHTML("beforeend", itemHTML);
        });
        
        // Attach click listeners to account chooser items
        googleAccountsList.querySelectorAll(".google-account-item").forEach(item => {
            item.addEventListener("click", () => {
                const email = item.getAttribute("data-email");
                const name = item.getAttribute("data-name");
                const photo = item.getAttribute("data-photo");
                
                // Get or create record in mock database
                let uid = "mock_google_uid_" + Math.floor(10000 + Math.random() * 90000);
                if (localUsers[email]) {
                    uid = localUsers[email].uid;
                    localUsers[email].displayName = name;
                    localUsers[email].photoURL = photo;
                } else {
                    localUsers[email] = { uid, email, password: "", displayName: name, photoURL: photo };
                }
                localStorage.setItem("mock_firebase_users", JSON.stringify(localUsers));
                
                const userObj = { uid, email, displayName: name, photoURL: photo };
                window.resolveGoogleSignIn(userObj);
            });
        });
    }
    
    db = {
        collection: (colName) => {
            const storageKey = "mock_db_" + colName;
            return {
                doc: (docId) => {
                    const collectionData = getMockStorage(storageKey);
                    return {
                        get: async () => {
                            const data = collectionData[docId];
                            return {
                                exists: !!data,
                                data: () => data ? {
                                    ...data,
                                    createdAt: data.createdAt ? { toDate: () => new Date(data.createdAt) } : null
                                } : null
                            };
                        },
                        set: async (docData) => {
                            const dataToSave = { ...docData };
                            if (dataToSave.createdAt && typeof dataToSave.createdAt === "object") {
                                dataToSave.createdAt = new Date().toISOString();
                            }
                            collectionData[docId] = dataToSave;
                            setMockStorage(storageKey, collectionData);
                            return true;
                        },
                        update: async (updateData) => {
                            const currentDoc = collectionData[docId] || {};
                            
                            Object.keys(updateData).forEach(key => {
                                const val = updateData[key];
                                if (val && typeof val === "object" && typeof val.type === "string") {
                                    if (val.type === "arrayUnion") {
                                        if (!currentDoc[key]) currentDoc[key] = [];
                                        if (!currentDoc[key].includes(val.value)) {
                                            currentDoc[key].push(val.value);
                                        }
                                    } else if (val.type === "arrayRemove") {
                                        if (currentDoc[key]) {
                                            currentDoc[key] = currentDoc[key].filter(x => x !== val.value);
                                        }
                                    } else if (val.type === "increment") {
                                        currentDoc[key] = (currentDoc[key] || 0) + val.value;
                                    }
                                } else {
                                    currentDoc[key] = val;
                                }
                            });
                            
                            collectionData[docId] = currentDoc;
                            setMockStorage(storageKey, collectionData);
                            return true;
                        }
                    };
                },
                add: async (docData) => {
                    const collectionData = getMockStorage(storageKey);
                    const docId = "mock_doc_" + Math.floor(100000 + Math.random() * 900000);
                    
                    const dataToSave = { ...docData };
                    if (dataToSave.createdAt && typeof dataToSave.createdAt === "object") {
                        dataToSave.createdAt = new Date().toISOString();
                    }
                    
                    collectionData[docId] = dataToSave;
                    setMockStorage(storageKey, collectionData);
                    return { id: docId };
                },
                get: async () => {
                    const collectionData = getMockStorage(storageKey);
                    const results = [];
                    Object.keys(collectionData).forEach(id => {
                        results.push({
                            id,
                            data: () => ({
                                ...collectionData[id],
                                createdAt: collectionData[id].createdAt ? { toDate: () => new Date(collectionData[id].createdAt) } : null
                            })
                        });
                    });
                    return {
                        empty: results.length === 0,
                        forEach: (cb) => results.forEach(cb)
                    };
                },
                where: (field, op, val) => {
                    const collectionData = getMockStorage(storageKey);
                    return {
                        get: async () => {
                            const results = [];
                            Object.keys(collectionData).forEach(id => {
                                const doc = collectionData[id];
                                if (doc && doc[field] === val) {
                                    results.push({
                                        id,
                                        data: () => ({
                                            ...doc,
                                            createdAt: doc.createdAt ? { toDate: () => new Date(doc.createdAt) } : null
                                        })
                                    });
                                }
                            });
                            return {
                                empty: results.length === 0,
                                forEach: (cb) => results.forEach(cb)
                            };
                        }
                    };
                }
            };
        }
    };
} else {
    // Initialize real Firebase SDK
    firebase.initializeApp(firebaseConfig);
    auth = firebase.auth();
    db = firebase.firestore();
}

// Select DOM Elements
const cartItemsContainer = document.querySelector(".cart-items-container");
const navbar = document.querySelector(".navbar");

const searchBtn = document.querySelector("#search-btn");
const cartBtn = document.querySelector("#cart-btn");
const menuBtn = document.querySelector("#menu-btn");
const cartCloseBtn = document.querySelector(".cart-close-btn");

// New Search Overlay DOM Elements
const searchOverlay = document.querySelector("#search-overlay");
const searchModal = document.querySelector("#search-modal");
const searchModalBox = document.querySelector("#search-modal-box");
const searchResultsDropdown = document.querySelector("#search-results-dropdown");
const searchModalCloseBtn = document.querySelector("#search-modal-close-btn");

// Product Details Modal
const detailModal = document.querySelector("#detail-modal");
const closeDetailModal = document.querySelector("#close-detail-modal");
const modalProductImg = document.querySelector("#modal-product-img");
const modalProductName = document.querySelector("#modal-product-name");
const modalProductPrice = document.querySelector("#modal-product-price");
const modalProductDesc = document.querySelector("#modal-product-description");
const modalAddToCartBtn = document.querySelector("#modal-add-to-cart-btn");
const modalSuggestionsGrid = document.querySelector("#modal-suggestions-grid");

// Checkout Modal
const checkoutModal = document.querySelector("#checkout-modal");
const openCheckoutBtn = document.querySelector("#open-checkout-btn");
const closeCheckoutModal = document.querySelector("#close-checkout-modal");
const checkoutTotalSummary = document.querySelector("#checkout-summary-total");
const receiptId = document.querySelector("#receipt-id");
const deliveryForm = document.querySelector("#delivery-form");
const cardForm = document.querySelector("#payment-card-form");
const upiForm = document.querySelector("#payment-upi-form");
const finishOrderBtn = document.querySelector("#finish-order-btn");
const tabCard = document.querySelector("#tab-card");
const tabUpi = document.querySelector("#tab-upi");
const stepPanel1 = document.querySelector("#checkout-step-1");
const stepPanel2 = document.querySelector("#checkout-step-2");
const stepPanel3 = document.querySelector("#checkout-step-3");
const indicator1 = document.querySelector("#step-indicator-1");
const indicator2 = document.querySelector("#step-indicator-2");
const indicator3 = document.querySelector("#step-indicator-3");

// Account & Auth Modals
const authModal = document.querySelector("#auth-modal");
const closeAuthModal = document.querySelector("#close-auth-modal");
const profileModal = document.querySelector("#profile-modal");
const closeProfileModal = document.querySelector("#close-profile-modal");
const userBtn = document.querySelector("#user-btn");
const authPanelLogin = document.querySelector("#auth-panel-login");
const authPanelSignup = document.querySelector("#auth-panel-signup");
const authPanelForgot = document.querySelector("#auth-panel-forgot");
const switchToSignup = document.querySelector("#switch-to-signup");
const switchToLogin = document.querySelector("#switch-to-login");
const switchToLoginFromForgot = document.querySelector("#switch-to-login-from-forgot");
const loginForm = document.querySelector("#login-form");
const signupForm = document.querySelector("#signup-form");
const forgotForm = document.querySelector("#forgot-form");
const loginErrorMsg = document.querySelector("#login-error-msg");
const signupErrorMsg = document.querySelector("#signup-error-msg");
const forgotErrorMsg = document.querySelector("#forgot-error-msg");
const googleLoginBtn = document.querySelector("#google-login-btn");
const googleSignupBtn = document.querySelector("#google-signup-btn");
const forgotPasswordBtn = document.querySelector("#forgot-password-btn");
const logoutBtn = document.querySelector("#logout-btn");

// Profile Dashboard
const profileTabBtns = document.querySelectorAll(".profile-tab-btn");
const profilePanels = document.querySelectorAll(".profile-panel");
const profileAvatarLarge = document.querySelector("#profile-avatar-large");
const profileNameLarge = document.querySelector("#profile-name-large");
const loyaltyPointsDisplay = document.querySelector("#loyalty-points-display");
const addressesListContainer = document.querySelector("#addresses-list-container");
const addAddressForm = document.querySelector("#add-address-form");
const ordersListContainer = document.querySelector("#orders-list-container");
const checkoutLoginPrompt = document.querySelector("#checkout-login-prompt");
const checkoutLoginLink = document.querySelector("#checkout-login-link");

// Google Chooser Modals (Mock)
const closeGoogleChooser = document.querySelector("#close-google-chooser");
const googleChooserModal = document.querySelector("#google-chooser-modal");
const googleAddAccountBtn = document.querySelector("#google-add-account-btn");
const googleAccountsPanel = document.querySelector("#google-accounts-panel");
const googleAddPanel = document.querySelector("#google-add-panel");
const googleCustomAccountForm = document.querySelector("#google-custom-account-form");
const googleAddCancelBtn = document.querySelector("#google-add-cancel-btn");
const googleAvatarCameraBtn = document.querySelector("#google-avatar-camera-btn");
const googleAvatarGalleryBtn = document.querySelector("#google-avatar-gallery-btn");
const googleAvatarFileInput = document.querySelector("#google-avatar-file-input");
const googleCustomAvatarPreview = document.querySelector("#google-custom-avatar-preview");

// Profile Edit & Media
const editProfileForm = document.querySelector("#edit-profile-form");
const editProfileName = document.querySelector("#edit-profile-name");
const editProfileAvatarUrl = document.querySelector("#edit-profile-avatar-url");
const avatarPreviewBtn = document.querySelector("#avatar-preview-btn");
const presetAvatarImgs = document.querySelectorAll(".preset-avatar-img");
const presetAvatarInitialsPreview = document.querySelector("#preset-avatar-initials-preview");
const avatarPreviewBox = document.querySelector("#avatar-preview-box");
const uploadAvatarBtn = document.querySelector("#upload-avatar-btn");
const cameraAvatarBtn = document.querySelector("#camera-avatar-btn");
const editProfileAvatarFile = document.querySelector("#edit-profile-avatar-file");

// Camera Picker Modals
const cameraModal = document.querySelector("#camera-modal");
const cameraVideo = document.querySelector("#camera-video");
const cameraCanvas = document.querySelector("#camera-canvas");
const cameraCaptureBtn = document.querySelector("#camera-capture-btn");
const cameraCloseBtn = document.querySelector("#camera-close-btn");

// Customer Reviews
const reviewsListWrapper = document.querySelector("#reviews-list-wrapper");
const writeReviewToggle = document.querySelector("#write-review-toggle");
const addReviewForm = document.querySelector("#add-review-form");
const cancelReviewBtn = document.querySelector("#cancel-review-btn");
const selectedRatingInput = document.querySelector("#selected-rating");
const reviewTextInput = document.querySelector("#review-text-input");
const starRatingSelect = document.querySelectorAll(".star-rating-select .select-star");

// Close Search Overlay & Reset Inputs
function closeSearch() {
    if (searchOverlay && searchOverlay.classList.contains("active")) {
        searchOverlay.classList.remove("active");
        if (searchModalBox) {
            searchModalBox.value = "";
        }
        if (searchResultsDropdown) {
            searchResultsDropdown.innerHTML = "";
            searchResultsDropdown.style.display = "none";
        }
    }
}

// Open Search Overlay & Auto-Focus
function openSearch() {
    if (searchOverlay) {
        // Close other panels first
        if (cartItemsContainer) cartItemsContainer.classList.remove("active");
        if (navbar) navbar.classList.remove("active");
        
        searchOverlay.classList.add("active");
        setTimeout(() => {
            if (searchModalBox) searchModalBox.focus();
        }, 100);
    }
}

// Toggle Header Elements
if (searchBtn) {
    searchBtn.addEventListener("click", () => {
        if (searchOverlay && searchOverlay.classList.contains("active")) {
            closeSearch();
        } else {
            openSearch();
        }
    });
}

if (cartBtn) {
    cartBtn.addEventListener("click", () => {
        if (cartItemsContainer) cartItemsContainer.classList.toggle("active");
        closeSearch();
        if (navbar) navbar.classList.remove("active");
    });
}

if (cartCloseBtn) {
    cartCloseBtn.addEventListener("click", () => {
        if (cartItemsContainer) cartItemsContainer.classList.remove("active");
    });
}

if (menuBtn) {
    menuBtn.addEventListener("click", () => {
        if (navbar) navbar.classList.toggle("active");
        closeSearch();
        if (cartItemsContainer) cartItemsContainer.classList.remove("active");
    });
}

window.onscroll = () => {
    // Note: We DO NOT close search overlay on scroll since it is a full-screen overlay modal
    if (cartItemsContainer) cartItemsContainer.classList.remove("active");
    if (navbar) navbar.classList.remove("active");
};

// ==========================================
// E-COMMERCE CART FUNCTIONALITY
// ==========================================

let cart = JSON.parse(localStorage.getItem("bakery_cart")) || [];

// DOM Cart elements
const cartList = document.querySelector(".cart-list");
const cartTotalSpan = document.querySelector(".cart-total span");
const cartBadge = document.querySelector(".cart-badge");

// Initialize cart UI on load
updateCartUI();

// Save Cart to LocalStorage
function saveCart() {
    localStorage.setItem("bakery_cart", JSON.stringify(cart));
}

// Add Item to Cart
function addToCart(name, price, image) {
    const existingItem = cart.find(item => item.name === name);
    
    if (existingItem) {
        existingItem.quantity += 1;
    } else {
        cart.push({
            name: name,
            price: Number(price),
            image: image,
            quantity: 1
        });
    }
    
    // Play subtle badge scale animation
    if (cartBadge) {
        cartBadge.classList.add("bump");
        setTimeout(() => cartBadge.classList.remove("bump"), 300);
    }
    
    saveCart();
    updateCartUI();
}

// Change Quantity (+ or -)
function changeQuantity(name, amount) {
    const item = cart.find(item => item.name === name);
    if (!item) return;
    
    item.quantity += amount;
    
    if (item.quantity <= 0) {
        cart = cart.filter(item => item.name !== name);
    }
    
    saveCart();
    updateCartUI();
}

// Remove Item Entirely
function removeFromCart(name) {
    cart = cart.filter(item => item.name !== name);
    saveCart();
    updateCartUI();
}

// Update Cart Display UI
function updateCartUI() {
    if (!cartList) return;
    
    cartList.innerHTML = "";
    
    if (cart.length === 0) {
        cartList.innerHTML = `<div class="empty-cart-message"><i class="fa-solid fa-basket-shopping"></i><p>Your cart is empty.</p></div>`;
        if (cartTotalSpan) cartTotalSpan.textContent = "Rs. 0/-";
        if (cartBadge) {
            cartBadge.textContent = "0";
            cartBadge.style.display = "none";
        }
        return;
    }
    
    let total = 0;
    let itemCount = 0;
    
    cart.forEach(item => {
        total += item.price * item.quantity;
        itemCount += item.quantity;
        
        const cartItemHTML = `
            <div class="cart-item">
                <img src="${item.image}" alt="${item.name}">
                <div class="content">
                    <h3>${item.name}</h3>
                    <div class="price">Rs. ${item.price}/-</div>
                    <div class="quantity-controls">
                        <button class="qty-btn minus" data-name="${item.name}">-</button>
                        <span class="qty">${item.quantity}</span>
                        <button class="qty-btn plus" data-name="${item.name}">+</button>
                    </div>
                </div>
                <div class="remove-cart-item" data-name="${item.name}">
                    <span class="fas fa-trash-can"></span>
                </div>
            </div>
        `;
        cartList.insertAdjacentHTML("beforeend", cartItemHTML);
    });
    
    if (cartTotalSpan) cartTotalSpan.textContent = `Rs. ${total}/-`;
    
    if (cartBadge) {
        cartBadge.textContent = itemCount;
        cartBadge.style.display = "block";
    }
    
    // Attach Event Listeners to Cart Control Buttons
    document.querySelectorAll(".qty-btn.minus").forEach(btn => {
        btn.addEventListener("click", () => {
            changeQuantity(btn.getAttribute("data-name"), -1);
        });
    });
    
    document.querySelectorAll(".qty-btn.plus").forEach(btn => {
        btn.addEventListener("click", () => {
            changeQuantity(btn.getAttribute("data-name"), 1);
        });
    });
    
    document.querySelectorAll(".remove-cart-item").forEach(btn => {
        btn.addEventListener("click", () => {
            removeFromCart(btn.getAttribute("data-name"));
        });
    });
}

// Bind Section Card Clicks for Quick-Add Buttons
document.addEventListener("click", (e) => {
    if (e.target.classList.contains("add-to-cart-btn")) {
        const card = e.target.closest("[data-name]");
        if (card) {
            const name = card.getAttribute("data-name");
            const price = card.getAttribute("data-price");
            const image = card.getAttribute("data-image");
            addToCart(name, price, image);
            // Open Cart panel to give visual feedback
            cartItemsContainer.classList.add("active");
        }
    }
    
    if (e.target.classList.contains("add-to-cart-icon")) {
        const card = e.target.closest("[data-name]");
        if (card) {
            const name = card.getAttribute("data-name");
            const price = card.getAttribute("data-price");
            const image = card.getAttribute("data-image");
            addToCart(name, price, image);
            cartItemsContainer.classList.add("active");
        }
    }
});

// ==========================================
// SUGGESTION MODAL LOGIC
// ==========================================

// Gather all items to draw suggestions from dynamically
function getRecommendations(currentName) {
    const allCards = Array.from(document.querySelectorAll("[data-name]"));
    const items = allCards.map(card => ({
        name: card.getAttribute("data-name"),
        price: card.getAttribute("data-price"),
        image: card.getAttribute("data-image"),
        description: card.getAttribute("data-description")
    }));
    
    // Remove duplicates
    const uniqueItems = [];
    const map = new Map();
    for (const item of items) {
        if(!map.has(item.name)){
            map.set(item.name, true);
            uniqueItems.push(item);
        }
    }
    
    // Filter current and get 2 suggestions
    const filtered = uniqueItems.filter(item => item.name !== currentName);
    
    // Sort randomly and select 2
    return filtered.sort(() => 0.5 - Math.random()).slice(0, 2);
}

// Open Detail Modal
function openDetails(card) {
    const name = card.getAttribute("data-name");
    const price = card.getAttribute("data-price");
    const image = card.getAttribute("data-image");
    const description = card.getAttribute("data-description") || "A delightful freshly baked premium treat prepared with care by our master chefs.";
    
    modalProductName.textContent = name;
    modalProductPrice.textContent = `Rs. ${price}/-`;
    modalProductImg.src = image;
    modalProductImg.alt = name;
    modalProductDesc.textContent = description;
    
    // Set up add to cart listener in modal
    modalAddToCartBtn.onclick = () => {
        addToCart(name, price, image);
        detailModal.classList.remove("active");
        cartItemsContainer.classList.add("active");
    };
    
    // Render dynamic suggestions
    const suggestions = getRecommendations(name);
    modalSuggestionsGrid.innerHTML = "";
    
    suggestions.forEach(s => {
        const suggestionHTML = `
            <div class="suggestion-card">
                <img src="${s.image}" alt="${s.name}">
                <div class="s-info">
                    <h4>${s.name}</h4>
                    <div class="s-price">Rs. ${s.price}/-</div>
                    <button class="btn s-add-btn" data-name="${s.name}" data-price="${s.price}" data-image="${s.image}">Add</button>
                </div>
            </div>
        `;
        modalSuggestionsGrid.insertAdjacentHTML("beforeend", suggestionHTML);
    });
    
    // Bind click events for suggestion add buttons
    document.querySelectorAll(".s-add-btn").forEach(btn => {
        btn.addEventListener("click", (e) => {
            e.stopPropagation();
            const sName = btn.getAttribute("data-name");
            const sPrice = btn.getAttribute("data-price");
            const sImage = btn.getAttribute("data-image");
            addToCart(sName, sPrice, sImage);
            detailModal.classList.remove("active");
            cartItemsContainer.classList.add("active");
        });
    });
    
    detailModal.classList.add("active");
}

// Bind triggers for Card Clicks (excluding add-to-cart clicks)
document.addEventListener("click", (e) => {
    const cardClickable = e.target.closest(".card-clickable");
    if (cardClickable) {
        const card = cardClickable.closest("[data-name]");
        if (card) {
            openDetails(card);
        }
    }
});

// Close Details Modal
if (closeDetailModal) {
    closeDetailModal.addEventListener("click", () => {
        detailModal.classList.remove("active");
    });
}

// ==========================================
// CUSTOMER ACCOUNT & PROFILE LOGIC
// ==========================================

let currentUserDoc = null;

// Switch Panels in Auth Modal
if (switchToSignup) {
    switchToSignup.addEventListener("click", (e) => {
        e.preventDefault();
        authPanelLogin.classList.remove("active");
        authPanelSignup.classList.add("active");
        signupForm.reset();
        signupErrorMsg.textContent = "";
    });
}

if (switchToLogin) {
    switchToLogin.addEventListener("click", (e) => {
        e.preventDefault();
        authPanelSignup.classList.remove("active");
        authPanelLogin.classList.add("active");
        loginForm.reset();
        loginErrorMsg.textContent = "";
    });
}

if (forgotPasswordBtn) {
    forgotPasswordBtn.addEventListener("click", (e) => {
        e.preventDefault();
        authPanelLogin.classList.remove("active");
        authPanelForgot.classList.add("active");
        forgotForm.reset();
        forgotErrorMsg.textContent = "";
    });
}

if (switchToLoginFromForgot) {
    switchToLoginFromForgot.addEventListener("click", (e) => {
        e.preventDefault();
        authPanelForgot.classList.remove("active");
        authPanelLogin.classList.add("active");
        loginForm.reset();
        loginErrorMsg.textContent = "";
    });
}

// User Button Trigger (Open Auth or Profile Modal)
if (userBtn) {
    userBtn.addEventListener("click", async () => {
        if (auth.currentUser) {
            await fetchUserProfile(auth.currentUser.uid);
            updateProfileUI(auth.currentUser);
            profileModal.classList.add("active");
        } else {
            authPanelSignup.classList.remove("active");
            authPanelLogin.classList.add("active");
            loginErrorMsg.textContent = "";
            authModal.classList.add("active");
        }
    });
}

// Close Modals
if (closeAuthModal) {
    closeAuthModal.addEventListener("click", () => {
        authModal.classList.remove("active");
    });
}

if (closeProfileModal) {
    closeProfileModal.addEventListener("click", () => {
        profileModal.classList.remove("active");
    });
}

// Checkout Login link trigger
if (checkoutLoginLink) {
    checkoutLoginLink.addEventListener("click", (e) => {
        e.preventDefault();
        document.querySelector("#checkout-modal").classList.remove("active");
        authPanelSignup.classList.remove("active");
        authPanelLogin.classList.add("active");
        loginErrorMsg.textContent = "";
        authModal.classList.add("active");
    });
}

// Fetch Profile from Firestore
async function fetchUserProfile(uid) {
    try {
        const docRef = db.collection("users").doc(uid);
        const doc = await docRef.get();
        
        if (doc.exists) {
            currentUserDoc = doc.data() || {};
            
            // Clean up any corrupted loyaltyPoints objects (e.g. mock objects serialized in local storage)
            if (currentUserDoc && (typeof currentUserDoc.loyaltyPoints === "object" || isNaN(Number(currentUserDoc.loyaltyPoints)))) {
                currentUserDoc.loyaltyPoints = 0;
            }
            
            // Check for points expiration
            if (currentUserDoc.loyaltyPoints > 0 && currentUserDoc.loyaltyExpiry) {
                const now = new Date();
                let expiryDate;
                if (typeof currentUserDoc.loyaltyExpiry.toDate === "function") {
                    expiryDate = currentUserDoc.loyaltyExpiry.toDate();
                } else {
                    expiryDate = new Date(currentUserDoc.loyaltyExpiry);
                }
                
                if (now > expiryDate) {
                    // Points expired! Update DB and local state
                    currentUserDoc.loyaltyPoints = 0;
                    currentUserDoc.loyaltyExpiry = null;
                    await docRef.update({
                        loyaltyPoints: 0,
                        loyaltyExpiry: null
                    });
                    console.log("Loyalty points expired on " + expiryDate.toLocaleDateString());
                }
            }
            
            // Self-correcting synchronization from order history
            const ordersSnapshot = await db.collection("orders").where("userId", "==", uid).get();
            let totalSpent = 0;
            ordersSnapshot.forEach(orderDoc => {
                const order = orderDoc.data();
                totalSpent += Number(order.total || 0);
            });
            const calculatedPoints = Math.floor(totalSpent / 100);
            
            if (calculatedPoints > (currentUserDoc.loyaltyPoints || 0)) {
                const expiryDate = new Date();
                expiryDate.setMonth(expiryDate.getMonth() + 6);
                
                currentUserDoc.loyaltyPoints = calculatedPoints;
                currentUserDoc.loyaltyExpiry = expiryDate;
                await docRef.update({
                    loyaltyPoints: calculatedPoints,
                    loyaltyExpiry: expiryDate
                });
                console.log(`Synced loyalty points from order history: ${calculatedPoints} points.`);
            }
            
            // Mathematical validation of claimed rewards in local storage
            const redeemedKey = "redeemed_rewards_" + uid;
            const redeemedCodes = JSON.parse(localStorage.getItem(redeemedKey)) || {};
            const lifetimeEarned = calculatedPoints;
            const currentPoints = currentUserDoc.loyaltyPoints || 0;
            const spentPoints = Math.max(0, lifetimeEarned - currentPoints);
            
            let hasChanges = false;
            let runningCostSum = 0;
            
            // Validate claimed rewards
            Object.keys(redeemedCodes).forEach(rewardId => {
                const reward = REWARDS_LIST.find(r => r.id === rewardId);
                if (reward) {
                    if (runningCostSum + reward.cost > spentPoints) {
                        // The user did not spend enough points to have legitimately claimed this reward!
                        delete redeemedCodes[rewardId];
                        hasChanges = true;
                    } else {
                        runningCostSum += reward.cost;
                    }
                } else {
                    // Invalid reward ID
                    delete redeemedCodes[rewardId];
                    hasChanges = true;
                }
            });
            
            if (hasChanges) {
                localStorage.setItem(redeemedKey, JSON.stringify(redeemedCodes));
            }
        } else {
            // Google auth sign in on first time or fallback
            const user = auth.currentUser;
            currentUserDoc = {
                name: user.displayName || "Google User",
                email: user.email,
                photoURL: user.photoURL || "",
                loyaltyPoints: 0,
                loyaltyExpiry: null,
                addresses: [],
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            };
            await docRef.set(currentUserDoc);
        }
    } catch (err) {
        console.error("Error fetching user profile:", err);
    }
}

// Update Navbar user badge
function updateNavbarUserButton(user) {
    if (!userBtn) return;
    
    const photo = user.photoURL || (currentUserDoc && currentUserDoc.photoURL);
    if (photo) {
        userBtn.innerHTML = `<img src="${photo}" alt="User Avatar" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover; display: block;">`;
        userBtn.className = "user-avatar-btn-img";
    } else {
        let initials = "U";
        if (user.displayName) {
            const parts = user.displayName.split(" ");
            initials = parts.map(p => p[0]).join("").substring(0, 2);
        } else if (currentUserDoc && currentUserDoc.name) {
            const parts = currentUserDoc.name.split(" ");
            initials = parts.map(p => p[0]).join("").substring(0, 2);
        } else {
            initials = user.email.substring(0, 2);
        }
        
        userBtn.innerHTML = initials;
        userBtn.className = "user-avatar-btn";
    }
}

// Authentication State Listener
auth.onAuthStateChanged(async (user) => {
    if (user) {
        await fetchUserProfile(user.uid);
        if (checkoutLoginPrompt) checkoutLoginPrompt.style.display = "none";
        prefillCheckoutDetails(user);
        updateNavbarUserButton(user);
        updateProfileUI(user);
        // Refresh reviews block to check if logged in user has already reviewed
        loadReviews();
    } else {
        currentUserDoc = null;
        if (checkoutLoginPrompt) checkoutLoginPrompt.style.display = "block";
        if (userBtn) {
            userBtn.innerHTML = `<i class="fa-solid fa-user"></i>`;
            userBtn.className = "user-icon";
        }
        // Refresh reviews block for logged out state
        loadReviews();
    }
});

// Pre-fill delivery info
function prefillCheckoutDetails(user) {
    const custName = document.querySelector("#cust-name");
    const custEmail = document.querySelector("#cust-email");
    const custAddress = document.querySelector("#cust-address");
    
    if (custName && (user.displayName || (currentUserDoc && currentUserDoc.name))) {
        custName.value = user.displayName || currentUserDoc.name;
    }
    if (custEmail) {
        custEmail.value = user.email;
    }
    if (custAddress && currentUserDoc && currentUserDoc.addresses && currentUserDoc.addresses.length > 0) {
        custAddress.value = currentUserDoc.addresses[0];
    }
}

// Clean Firestore auth error messaging
function getCleanAuthErrorMessage(errCode) {
    switch (errCode) {
        case "auth/email-already-in-use":
            return "This email address is already in use.";
        case "auth/invalid-email":
            return "Please enter a valid email address.";
        case "auth/operation-not-allowed":
            return "Email/Password accounts are currently disabled.";
        case "auth/weak-password":
            return "Password is too weak. Please use at least 6 characters.";
        case "auth/user-disabled":
            return "This account has been disabled.";
        case "auth/user-not-found":
            return "No account exists with this email address.";
        case "auth/wrong-password":
            return "Incorrect password. Please try again.";
        default:
            return "An authentication error occurred. Please try again.";
    }
}

// Email/Password Signup Form Submit
if (signupForm) {
    signupForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        signupErrorMsg.textContent = "";
        
        const name = document.querySelector("#signup-name").value.trim();
        const email = document.querySelector("#signup-email").value.trim();
        const password = document.querySelector("#signup-password").value;
        const confirmPassword = document.querySelector("#signup-confirm-password").value;
        
        if (password !== confirmPassword) {
            signupErrorMsg.textContent = "Passwords do not match.";
            return;
        }
        
        try {
            const userCredential = await auth.createUserWithEmailAndPassword(email, password);
            await userCredential.user.updateProfile({ displayName: name });
            
            // Create user document in Firestore
            currentUserDoc = {
                name: name,
                email: email,
                loyaltyPoints: 0,
                addresses: [],
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            };
            await db.collection("users").doc(userCredential.user.uid).set(currentUserDoc);
            
            authModal.classList.remove("active");
            signupForm.reset();
        } catch (err) {
            console.error("Signup error:", err);
            signupErrorMsg.textContent = getCleanAuthErrorMessage(err.code);
        }
    });
}

// Email/Password Login Form Submit
if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        loginErrorMsg.textContent = "";
        
        const email = document.querySelector("#login-email").value.trim();
        const password = document.querySelector("#login-password").value;
        
        try {
            await auth.signInWithEmailAndPassword(email, password);
            authModal.classList.remove("active");
            loginForm.reset();
        } catch (err) {
            console.error("Login error:", err);
            loginErrorMsg.textContent = getCleanAuthErrorMessage(err.code);
        }
    });
}

// Google Sign-In helper
async function handleGoogleLogin(errorMsgElement) {
    errorMsgElement.textContent = "";
    const provider = new firebase.auth.GoogleAuthProvider();
    try {
        await auth.signInWithPopup(provider);
        authModal.classList.remove("active");
    } catch (err) {
        if (err && (err.code === "auth/popup-closed-by-user" || err.code === "auth/cancelled-popup-request")) {
            console.log("Google Sign-In popup closed by user.");
            return;
        }
        console.error("Google sign in error:", err);
        errorMsgElement.textContent = "Google authentication failed. Please try again.";
    }
}

if (googleLoginBtn) {
    googleLoginBtn.addEventListener("click", () => handleGoogleLogin(loginErrorMsg));
}

if (googleSignupBtn) {
    googleSignupBtn.addEventListener("click", () => handleGoogleLogin(signupErrorMsg));
}

// ==========================================
// MOCK GOOGLE CHOOSER MODAL INTERACTIONS
// ==========================================

// Dismiss Google Account Chooser
if (closeGoogleChooser) {
    closeGoogleChooser.addEventListener("click", () => {
        if (typeof window.rejectGoogleSignIn === "function") {
            window.rejectGoogleSignIn({ code: "auth/popup-closed-by-user" });
        }
    });
}

// Global click listener dismissal for Google Modal
window.addEventListener("click", (e) => {
    if (e.target === googleChooserModal) {
        if (typeof window.rejectGoogleSignIn === "function") {
            window.rejectGoogleSignIn({ code: "auth/popup-closed-by-user" });
        }
    }
});

// Panel switches: Choose list -> Add Form
if (googleAddAccountBtn) {
    googleAddAccountBtn.addEventListener("click", () => {
        if (googleAccountsPanel) googleAccountsPanel.style.display = "none";
        if (googleAddPanel) googleAddPanel.style.display = "block";
    });
}

// Panel switches: Add Form -> Choose list
if (googleAddCancelBtn) {
    googleAddCancelBtn.addEventListener("click", () => {
        if (googleAddPanel) googleAddPanel.style.display = "none";
        if (googleAccountsPanel) googleAccountsPanel.style.display = "block";
    });
}

// Custom Google Sign up and login submit
if (googleCustomAccountForm) {
    googleCustomAccountForm.addEventListener("submit", (e) => {
        e.preventDefault();
        
        const name = document.querySelector("#google-input-name").value.trim();
        const email = document.querySelector("#google-input-email").value.trim();
        
        if (!name || !email) {
            alert("Please fill in your name and email.");
            return;
        }
        
        const localUsers = JSON.parse(localStorage.getItem("mock_firebase_users")) || {};
        let uid = "mock_google_uid_" + Math.floor(10000 + Math.random() * 90000);
        
        if (localUsers[email]) {
            uid = localUsers[email].uid;
            localUsers[email].displayName = name;
            if (googleCapturedAvatarData) {
                localUsers[email].photoURL = googleCapturedAvatarData;
            }
        } else {
            localUsers[email] = {
                uid,
                email,
                password: "",
                displayName: name,
                photoURL: googleCapturedAvatarData || ""
            };
        }
        
        localStorage.setItem("mock_firebase_users", JSON.stringify(localUsers));
        
        const userObj = {
            uid,
            email,
            displayName: name,
            photoURL: localUsers[email].photoURL || ""
        };
        
        if (typeof window.resolveGoogleSignIn === "function") {
            window.resolveGoogleSignIn(userObj);
        }
    });
}

// Camera activation inside Google signup
if (googleAvatarCameraBtn) {
    googleAvatarCameraBtn.addEventListener("click", () => {
        cameraTarget = "google";
        startCamera();
    });
}

// Gallery activation inside Google signup
if (googleAvatarGalleryBtn && googleAvatarFileInput) {
    googleAvatarGalleryBtn.addEventListener("click", () => {
        googleAvatarFileInput.click();
    });
}

if (googleAvatarFileInput) {
    googleAvatarFileInput.addEventListener("change", (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                const img = new Image();
                img.onload = () => {
                    resizeImageToDataURL(img, (dataUrl) => {
                        googleCapturedAvatarData = dataUrl;
                        if (googleCustomAvatarPreview) {
                            googleCustomAvatarPreview.innerHTML = `<img src="${dataUrl}" alt="Avatar Preview">`;
                        }
                    });
                };
                img.src = event.target.result;
            };
            reader.readAsDataURL(file);
        }
    });
}

// Forgot Password Form Submit
if (forgotForm) {
    forgotForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        forgotErrorMsg.textContent = "";
        forgotErrorMsg.style.color = "#d32f2f";
        
        const email = document.querySelector("#forgot-email").value.trim();
        
        try {
            await auth.sendPasswordResetEmail(email);
            forgotErrorMsg.style.color = "#2e7d32";
            forgotErrorMsg.textContent = "Reset link sent! Redirecting...";
            
            setTimeout(() => {
                authPanelForgot.classList.remove("active");
                authPanelLogin.classList.add("active");
                loginForm.reset();
                loginErrorMsg.textContent = "";
                forgotErrorMsg.textContent = "";
            }, 3000);
        } catch (err) {
            console.error("Password reset error:", err);
            forgotErrorMsg.textContent = getCleanAuthErrorMessage(err.code);
        }
    });
}

// Logout Button
if (logoutBtn) {
    logoutBtn.addEventListener("click", async () => {
        try {
            await auth.signOut();
            profileModal.classList.remove("active");
        } catch (err) {
            console.error("Logout error:", err);
        }
    });
}

// ==========================================
// PROFILE TABS & PANELS UI
// ==========================================

// Tab Switching
profileTabBtns.forEach(btn => {
    btn.addEventListener("click", () => {
        profileTabBtns.forEach(b => b.classList.remove("active"));
        profilePanels.forEach(p => p.classList.remove("active"));
        
        btn.classList.add("active");
        const tabId = btn.getAttribute("data-tab");
        const activePanel = document.querySelector(`#${tabId}`);
        if (activePanel) activePanel.classList.add("active");
    });
});

// Update Profile UI Contents
function updateProfileUI(user) {
    if (!profileModal) return;
    
    // Header Avatar Name
    let initials = "U";
    if (user.displayName) {
        const parts = user.displayName.split(" ");
        initials = parts.map(p => p[0]).join("").substring(0, 2);
    } else if (currentUserDoc && currentUserDoc.name) {
        const parts = currentUserDoc.name.split(" ");
        initials = parts.map(p => p[0]).join("").substring(0, 2);
    }
    
    const photo = user.photoURL || (currentUserDoc && currentUserDoc.photoURL);
    if (profileAvatarLarge) {
        if (photo) {
            profileAvatarLarge.innerHTML = `<img src="${photo}" alt="Avatar" style="width:100%; height:100%; border-radius:50%; object-fit:cover; display:block;">`;
        } else {
            profileAvatarLarge.textContent = initials;
        }
    }
    if (profileNameLarge) profileNameLarge.textContent = user.displayName || (currentUserDoc ? currentUserDoc.name : "Registered User");
    
    // Prefill Edit Profile Fields
    const editNameInput = document.querySelector("#edit-profile-name");
    const editAvatarInput = document.querySelector("#edit-profile-avatar-url");
    const presetInitialsPreview = document.querySelector("#preset-avatar-initials-preview");
    const avatarPreviewBox = document.querySelector("#avatar-preview-box");
    
    if (editNameInput) editNameInput.value = user.displayName || (currentUserDoc ? currentUserDoc.name : "");
    if (editAvatarInput) editAvatarInput.value = photo || "";
    if (presetInitialsPreview) presetInitialsPreview.textContent = initials;
    if (avatarPreviewBox) {
        if (photo) {
            avatarPreviewBox.innerHTML = `<img src="${photo}" alt="Avatar">`;
        } else {
            avatarPreviewBox.textContent = initials;
        }
    }
    
    // Highlight correct preset
    document.querySelectorAll(".preset-avatar-img").forEach(img => {
        const presetUrl = img.getAttribute("data-url");
        if (photo === presetUrl) {
            img.classList.add("selected");
        } else {
            img.classList.remove("selected");
        }
    });
    
    if (presetInitialsPreview) {
        if (!photo) {
            presetInitialsPreview.classList.add("selected");
        } else {
            presetInitialsPreview.classList.remove("selected");
        }
    }
    
    // Loyalty display
    const points = currentUserDoc ? currentUserDoc.loyaltyPoints : 0;
    if (loyaltyPointsDisplay) loyaltyPointsDisplay.textContent = points;
    
    // Render loyalty expiry display
    const loyaltyExpiryDisplay = document.querySelector("#loyalty-expiry-display");
    if (loyaltyExpiryDisplay) {
        if (points > 0 && currentUserDoc && currentUserDoc.loyaltyExpiry) {
            let expiryDate;
            if (typeof currentUserDoc.loyaltyExpiry.toDate === "function") {
                expiryDate = currentUserDoc.loyaltyExpiry.toDate();
            } else {
                expiryDate = new Date(currentUserDoc.loyaltyExpiry);
            }
            const formattedExpiry = expiryDate.toLocaleDateString(undefined, {
                year: 'numeric', month: 'short', day: 'numeric'
            });
            loyaltyExpiryDisplay.querySelector("span").textContent = formattedExpiry;
            loyaltyExpiryDisplay.style.display = "block";
        } else {
            loyaltyExpiryDisplay.style.display = "none";
        }
    }
    
    updateLoyaltyTabUI(points);
    
    // Render Addresses List
    renderAddresses();
    
    // Render Orders History
    renderOrders(user.uid);
}


function updateLoyaltyTabUI(points) {
    if (!loyaltyPointsDisplay) return;
    
    // Calculate Tier and Progress
    let tier = "Bronze Member";
    let nextTierText = "";
    let fillWidth = 0;
    
    if (points >= 600) {
        tier = "Platinum Member";
        nextTierText = `${points} pts (Max Tier)`;
        fillWidth = 100;
    } else if (points >= 300) {
        tier = "Gold Member";
        const progress = points - 300;
        const nextLimit = 300; // 300 to 600
        nextTierText = `${points} / 600 pts`;
        fillWidth = Math.min((progress / nextLimit) * 100, 100);
    } else if (points >= 100) {
        tier = "Silver Member";
        const progress = points - 100;
        const nextLimit = 200; // 100 to 300
        nextTierText = `${points} / 300 pts`;
        fillWidth = Math.min((progress / nextLimit) * 100, 100);
    } else {
        tier = "Bronze Member";
        nextTierText = `${points} / 100 pts`;
        fillWidth = (points / 100) * 100;
    }
    
    // Update elements
    const tierBadge = document.querySelector("#loyalty-tier-badge");
    const nextTierSpan = document.querySelector("#loyalty-next-tier-text");
    const progressFill = document.querySelector("#loyalty-progress-fill");
    
    if (tierBadge) tierBadge.textContent = tier;
    if (nextTierSpan) nextTierSpan.textContent = nextTierText;
    if (progressFill) progressFill.style.width = `${fillWidth}%`;
    
    // Render Rewards List
    renderRewardsGrid(points);
}

function renderRewardsGrid(points) {
    const grid = document.querySelector("#rewards-grid");
    if (!grid) return;
    
    grid.innerHTML = "";
    
    // Retrieve already redeemed codes from localStorage for persistence
    const redeemedCodes = JSON.parse(localStorage.getItem("redeemed_rewards_" + (auth.currentUser ? auth.currentUser.uid : "guest"))) || {};
    
    REWARDS_LIST.forEach(reward => {
        const isLocked = points < reward.cost;
        const redeemedCode = redeemedCodes[reward.id];
        
        let cardClass = isLocked ? "reward-card locked" : "reward-card unlocked";
        let actionHTML = "";
        
        if (redeemedCode) {
            actionHTML = `<div class="redeem-code-display">${redeemedCode}</div>`;
        } else if (isLocked) {
            actionHTML = `<button class="btn reward-action-btn" disabled>Locked (${reward.cost} pts)</button>`;
        } else {
            actionHTML = `<button class="btn reward-action-btn claim-reward-btn" data-id="${reward.id}" data-cost="${reward.cost}" data-name="${reward.name}">Claim Reward</button>`;
        }
        
        const cardHTML = `
            <div class="${cardClass}">
                <div class="reward-icon-title">
                    <div class="reward-icon-wrapper">
                        <i class="fa-solid ${reward.icon}"></i>
                    </div>
                    <div class="reward-info">
                        <h5>${reward.name}</h5>
                        <span class="reward-points-cost">${reward.cost} Points</span>
                    </div>
                </div>
                ${actionHTML}
            </div>
        `;
        grid.insertAdjacentHTML("beforeend", cardHTML);
    });
    
    // Add Click Listeners for Claim Buttons
    document.querySelectorAll(".claim-reward-btn").forEach(btn => {
        btn.addEventListener("click", async () => {
            const rewardId = btn.getAttribute("data-id");
            const rewardCost = Number(btn.getAttribute("data-cost"));
            const rewardName = btn.getAttribute("data-name");
            
            if (points < rewardCost) return;
            
            if (!confirm(`Are you sure you want to spend ${rewardCost} points to claim "${rewardName}"?`)) {
                return;
            }
            
            const randomCode = `CB-${rewardName.replace(/[^A-Z0-9]/ig, "").substring(0, 5).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;
            
            try {
                // Deduct points from Firestore or Mock DB
                if (auth.currentUser) {
                    await db.collection("users").doc(auth.currentUser.uid).update({
                        loyaltyPoints: firebase.firestore.FieldValue.increment(-rewardCost)
                    });
                    
                    // Save code to local storage for persistence
                    const uid = auth.currentUser.uid;
                    const codes = JSON.parse(localStorage.getItem("redeemed_rewards_" + uid)) || {};
                    codes[rewardId] = randomCode;
                    localStorage.setItem("redeemed_rewards_" + uid, JSON.stringify(codes));
                    
                    // Re-fetch user profile
                    await fetchUserProfile(uid);
                    
                    // Render UI again
                    updateProfileUI(auth.currentUser);
                }
            } catch (err) {
                console.error("Error claiming reward:", err);
                alert("Failed to claim reward. Please try again.");
            }
        });
    });
}

// Render Saved Addresses
function renderAddresses() {
    if (!addressesListContainer) return;
    addressesListContainer.innerHTML = "";
    
    if (!currentUserDoc || !currentUserDoc.addresses || currentUserDoc.addresses.length === 0) {
        addressesListContainer.innerHTML = `<div class="no-orders-prompt"><i class="fa-solid fa-map-location-dot"></i><p>No saved addresses yet.</p></div>`;
        return;
    }
    
    currentUserDoc.addresses.forEach((address, index) => {
        const addressHTML = `
            <div class="address-item">
                <span class="address-text">${address}</span>
                <button class="remove-address-btn" data-index="${index}" aria-label="Delete address">
                    <i class="fa-solid fa-trash"></i>
                </button>
            </div>
        `;
        addressesListContainer.insertAdjacentHTML("beforeend", addressHTML);
    });
    
    // Bind remove address buttons
    document.querySelectorAll(".remove-address-btn").forEach(btn => {
        btn.addEventListener("click", async () => {
            const index = Number(btn.getAttribute("data-index"));
            const addressToDelete = currentUserDoc.addresses[index];
            
            try {
                await db.collection("users").doc(auth.currentUser.uid).update({
                    addresses: firebase.firestore.FieldValue.arrayRemove(addressToDelete)
                });
                
                // update local state
                currentUserDoc.addresses.splice(index, 1);
                renderAddresses();
                
                // If the checkout form is open, re-prefill
                prefillCheckoutDetails(auth.currentUser);
            } catch (err) {
                console.error("Error removing address:", err);
            }
        });
    });
}

// Add Address Form Submit
if (addAddressForm) {
    addAddressForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const addressInput = document.querySelector("#new-address-input");
        const newAddress = addressInput.value.trim();
        if (!newAddress) return;
        
        try {
            await db.collection("users").doc(auth.currentUser.uid).update({
                addresses: firebase.firestore.FieldValue.arrayUnion(newAddress)
            });
            
            // update local state
            if (!currentUserDoc.addresses) currentUserDoc.addresses = [];
            currentUserDoc.addresses.push(newAddress);
            
            addressInput.value = "";
            renderAddresses();
            prefillCheckoutDetails(auth.currentUser);
        } catch (err) {
            console.error("Error adding address:", err);
        }
    });
}

// Render Orders History
async function renderOrders(uid) {
    if (!ordersListContainer) return;
    ordersListContainer.innerHTML = "";
    
    try {
        const querySnapshot = await db.collection("orders").where("userId", "==", uid).get();
        
        if (querySnapshot.empty) {
            ordersListContainer.innerHTML = `<div class="no-orders-prompt"><i class="fa-solid fa-receipt"></i><p>No previous orders found.</p></div>`;
            return;
        }
        
        const orders = [];
        querySnapshot.forEach(doc => {
            orders.push({ id: doc.id, ...doc.data() });
        });
        
        // Sort by createdAt desc in memory safely to avoid index errors
        orders.sort((a, b) => {
            const dateA = a.createdAt ? a.createdAt.toDate() : new Date(0);
            const dateB = b.createdAt ? b.createdAt.toDate() : new Date(0);
            return dateB - dateA;
        });
        
        orders.forEach(order => {
            const formattedDate = order.createdAt ? order.createdAt.toDate().toLocaleDateString(undefined, {
                year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
            }) : "Recently Placed";
            
            let itemsRowsHTML = "";
            order.items.forEach(item => {
                itemsRowsHTML += `
                    <div class="profile-order-item-row">
                        <span>${item.name} (x${item.quantity})</span>
                        <span>Rs. ${item.price * item.quantity}/-</span>
                    </div>
                `;
            });
            
            const orderCardHTML = `
                <div class="profile-order-card">
                    <div class="profile-order-header">
                        <span class="profile-order-id">Order ${order.id}</span>
                        <span>${formattedDate}</span>
                    </div>
                    <div class="profile-order-items">
                        ${itemsRowsHTML}
                    </div>
                    <div class="profile-order-footer">
                        <span class="profile-order-status">Status: ${order.status}</span>
                        <div class="profile-order-total">Total: <span>Rs. ${order.total}/-</span></div>
                    </div>
                </div>
            `;
            ordersListContainer.insertAdjacentHTML("beforeend", orderCardHTML);
        });
    } catch (err) {
        console.error("Error loading order list history:", err);
        ordersListContainer.innerHTML = `<div class="no-orders-prompt"><i class="fa-solid fa-triangle-exclamation"></i><p>Error loading order logs.</p></div>`;
    }
}

// ==========================================
// CHECKOUT & PAYMENT WIZARD FLOW
// ==========================================

// Open Checkout Modal
if (openCheckoutBtn) {
    openCheckoutBtn.addEventListener("click", () => {
        if (cart.length === 0) {
            alert("Your cart is empty!");
            return;
        }
        cartItemsContainer.classList.remove("active");
        
        // Calculate subtotal total
        const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        checkoutTotalSummary.textContent = `Rs. ${subtotal}/-`;
        
        // Reset panels and checkout steps
        resetCheckoutFlow();
        
        // If user logged in, prefill values
        if (auth.currentUser) {
            prefillCheckoutDetails(auth.currentUser);
        }
        
        checkoutModal.classList.add("active");
    });
}

// Close Checkout Modal
if (closeCheckoutModal) {
    closeCheckoutModal.addEventListener("click", () => {
        checkoutModal.classList.remove("active");
    });
}

// Reset checkout to first step
function resetCheckoutFlow() {
    stepPanel1.classList.add("active");
    stepPanel2.classList.remove("active");
    stepPanel3.classList.remove("active");
    
    indicator1.classList.add("active");
    indicator2.classList.remove("active");
    indicator3.classList.remove("active");
    
    deliveryForm.reset();
    cardForm.reset();
    if (document.querySelector("#upi-id")) document.querySelector("#upi-id").value = "";
    
    // reset tab to Card
    tabCard.classList.add("active");
    tabUpi.classList.remove("active");
    cardForm.classList.add("active");
    upiForm.classList.remove("active");
    
    // reset buttons state
    document.querySelectorAll(".checkout-form-container button[type='submit']").forEach(btn => {
        btn.disabled = false;
        if(btn.tagName === "BUTTON") {
            btn.innerHTML = btn.innerText === "Pay Now" ? "Pay Now" : btn.innerText === "Continue to Payment" ? "Continue to Payment" : btn.innerHTML;
        }
    });
}

// Step 1 -> Step 2 (Delivery Address submitted)
if (deliveryForm) {
    deliveryForm.addEventListener("submit", (e) => {
        e.preventDefault();
        
        // Advance to step 2 panel
        stepPanel1.classList.remove("active");
        stepPanel2.classList.add("active");
        
        indicator1.classList.add("active");
        indicator2.classList.add("active");
    });
}

// Step 2 Tabs (Card vs UPI)
if (tabCard && tabUpi) {
    tabCard.addEventListener("click", () => {
        tabCard.classList.add("active");
        tabUpi.classList.remove("active");
        cardForm.classList.add("active");
        upiForm.classList.remove("active");
    });
    
    tabUpi.addEventListener("click", () => {
        tabUpi.classList.add("active");
        tabCard.classList.remove("active");
        upiForm.classList.add("active");
        cardForm.classList.remove("active");
    });
}

// Back button Step 2 -> Step 1
const backToDelivery = document.querySelector("#back-to-delivery");
const backToDeliveryUpi = document.querySelector("#back-to-delivery-upi");

const goBackTo1 = () => {
    stepPanel2.classList.remove("active");
    stepPanel1.classList.add("active");
    indicator2.classList.remove("active");
};

if (backToDelivery) backToDelivery.addEventListener("click", goBackTo1);
if (backToDeliveryUpi) backToDeliveryUpi.addEventListener("click", goBackTo1);

// Step 2 -> Step 3 (Payment submitted and Firebase logging)
function processPaymentSimulation(submitButton) {
    // Disable submit to prevent double click
    submitButton.disabled = true;
    submitButton.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Processing...`;
    
    // Calculate subtotal total
    const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const randomNum = Math.floor(10000 + Math.random() * 90000);
    const orderId = `CB-${randomNum}`;
    
    setTimeout(async () => {
        try {
            // Write order history to Firestore if logged in
            if (auth.currentUser) {
                const orderData = {
                    userId: auth.currentUser.uid,
                    items: cart.map(item => ({ name: item.name, price: item.price, quantity: item.quantity })),
                    total: subtotal,
                    address: document.querySelector("#cust-address").value.trim(),
                    customerName: document.querySelector("#cust-name").value.trim(),
                    customerPhone: document.querySelector("#cust-phone").value.trim(),
                    status: "Placed",
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                };
                await db.collection("orders").doc(orderId).set(orderData);
                
                // Add loyalty points (1 point per Rs. 100 spent) and set 6-month expiration due date
                const pointsEarned = Math.floor(subtotal / 100);
                if (pointsEarned > 0) {
                    const expiryDate = new Date();
                    expiryDate.setMonth(expiryDate.getMonth() + 6); // expires in 6 months from latest purchase
                    
                    await db.collection("users").doc(auth.currentUser.uid).update({
                        loyaltyPoints: firebase.firestore.FieldValue.increment(pointsEarned),
                        loyaltyExpiry: expiryDate
                    });
                    // Refresh local user state doc
                    await fetchUserProfile(auth.currentUser.uid);
                }
            }
            
            // Go to step 3 Success panel
            stepPanel2.classList.remove("active");
            stepPanel3.classList.add("active");
            indicator3.classList.add("active");
            
            receiptId.textContent = `#${orderId}`;
        } catch (err) {
            console.error("Error creating Firestore order log:", err);
            // Fallback anyway to show checkout success even if DB connection has lag
            stepPanel2.classList.remove("active");
            stepPanel3.classList.add("active");
            indicator3.classList.add("active");
            receiptId.textContent = `#${orderId}`;
        }
    }, 2000);
}

// Card Form Submission
if (cardForm) {
    cardForm.addEventListener("submit", (e) => {
        e.preventDefault();
        const submitBtn = cardForm.querySelector("button[type='submit']");
        processPaymentSimulation(submitBtn);
    });
}

// UPI QR/ID Submission
const submitUpiPay = document.querySelector("#submit-upi-pay");
if (submitUpiPay) {
    submitUpiPay.addEventListener("click", () => {
        processPaymentSimulation(submitUpiPay);
    });
}

// Finish Order (Close modal, clear cart)
if (finishOrderBtn) {
    finishOrderBtn.addEventListener("click", () => {
        checkoutModal.classList.remove("active");
        // Clear Cart
        cart = [];
        saveCart();
        updateCartUI();
    });
}

// Global modal background clicking logic to dismiss modals
window.addEventListener("click", (e) => {
    if (e.target === detailModal) {
        detailModal.classList.remove("active");
    }
    if (e.target === checkoutModal) {
        checkoutModal.classList.remove("active");
    }
    if (e.target === authModal) {
        authModal.classList.remove("active");
    }
    if (e.target === profileModal) {
        profileModal.classList.remove("active");
    }
});

// Show/Hide Password Toggle Listener
document.querySelectorAll(".toggle-password").forEach(icon => {
    icon.addEventListener("click", () => {
        const input = icon.previousElementSibling;
        if (input.type === "password") {
            input.type = "text";
            icon.classList.remove("fa-eye");
            icon.classList.add("fa-eye-slash");
        } else {
            input.type = "password";
            icon.classList.remove("fa-eye-slash");
            icon.classList.add("fa-eye");
        }
    });
});

// ==========================================
// DYNAMIC CUSTOMER REVIEWS & RATINGS SYSTEM
// ==========================================

const DEFAULT_REVIEWS = [
    {
        id: "def-1",
        name: "Sophia Sen",
        rating: 5,
        comment: "I recently ordered a cake from this bakery for a special occasion, and it was absolutely divine! The chocolate dulce de leche cake was moist and rich. Delightful experience!",
        date: "Jul 1, 2026",
        image: "images/profile.jpg"
    },
    {
        id: "def-2",
        name: "David Raj",
        rating: 4.5,
        comment: "I can't get enough of their cheesecakes! The blueberry cheesecake is incredibly smooth and creamy. Best sweet spot in town, highly recommended!",
        date: "Jun 24, 2026",
        image: "images/profile2.jpg"
    }
];

// Load & Render Reviews
async function loadReviews() {
    if (!reviewsListWrapper) return;
    reviewsListWrapper.innerHTML = "";
    
    let dbReviews = [];
    try {
        const querySnapshot = await db.collection("reviews").get();
        querySnapshot.forEach(doc => {
            const data = doc.data();
            dbReviews.push({
                id: doc.id,
                name: data.name,
                email: data.email, // capture email to prevent duplicate submissions
                rating: Number(data.rating),
                comment: data.comment,
                date: data.createdAt ? new Date(data.createdAt.toDate ? data.createdAt.toDate() : data.createdAt).toLocaleDateString(undefined, {
                    year: 'numeric', month: 'short', day: 'numeric'
                }) : "Just now",
                // User submitted reviews default to initials avatar
                isUserSubmitted: true
            });
        });
    } catch (err) {
        console.error("Error fetching database reviews:", err);
    }
    
    // Check if currently logged in user has already reviewed
    const currentUserEmail = auth.currentUser ? auth.currentUser.email : null;
    const hasUserReviewed = dbReviews.some(rev => rev.email === currentUserEmail);
    const alreadyMsg = document.querySelector("#already-reviewed-msg");
    
    if (auth.currentUser && hasUserReviewed) {
        if (writeReviewToggle) writeReviewToggle.style.display = "none";
        if (addReviewForm) addReviewForm.classList.remove("active");
        
        if (!alreadyMsg && document.querySelector("#review-form-container")) {
            const msgHTML = `<p id="already-reviewed-msg" class="already-reviewed-msg"><i class="fa-solid fa-circle-check"></i> You have already submitted a review. Thank you for your feedback!</p>`;
            document.querySelector("#review-form-container").insertAdjacentHTML("beforeend", msgHTML);
        }
    } else {
        if (writeReviewToggle) {
            writeReviewToggle.style.display = (addReviewForm && addReviewForm.classList.contains("active")) ? "none" : "inline-block";
        }
        if (alreadyMsg) alreadyMsg.remove();
    }
    
    // Combine lists: DB reviews go first (sorted newest first), followed by default reviews
    const allReviews = [...dbReviews, ...DEFAULT_REVIEWS];
    
    allReviews.forEach(rev => {
        // Star symbols HTML
        let starsHTML = "";
        const fullStars = Math.floor(rev.rating);
        const hasHalf = rev.rating % 1 !== 0;
        
        for (let i = 1; i <= 5; i++) {
            if (i <= fullStars) {
                starsHTML += `<i class="fa-solid fa-star"></i>`;
            } else if (i === fullStars + 1 && hasHalf) {
                starsHTML += `<i class="fa-solid fa-star-half-alt"></i>`;
            } else {
                starsHTML += `<i class="fa-regular fa-star"></i>`;
            }
        }
        
        // Avatar HTML
        let avatarHTML = "";
        if (rev.image) {
            avatarHTML = `<img src="${rev.image}" alt="${rev.name}" class="review-card-avatar">`;
        } else {
            const initials = rev.name ? rev.name.split(" ").map(n => n[0]).join("").substring(0, 2) : "U";
            avatarHTML = `<div class="review-card-avatar-initials">${initials}</div>`;
        }
        
        const reviewHTML = `
            <div class="review-card">
                <i class="fa-solid fa-quote-right review-card-quote-icon"></i>
                <p class="review-card-text">"${rev.comment}"</p>
                <div class="review-card-user-info">
                    ${avatarHTML}
                    <div class="review-card-user-details">
                        <span class="review-card-name">${rev.name}</span>
                        <span class="review-card-date">${rev.date}</span>
                        <div class="review-card-rating">
                            ${starsHTML}
                        </div>
                    </div>
                </div>
            </div>
        `;
        reviewsListWrapper.insertAdjacentHTML("beforeend", reviewHTML);
    });
}

// Initial Reviews Load
loadReviews();

// Toggle review submission box
if (writeReviewToggle) {
    writeReviewToggle.addEventListener("click", () => {
        if (!auth.currentUser) {
            alert("Please log in to share your experience!");
            // Open auth modal
            authPanelSignup.classList.remove("active");
            authPanelLogin.classList.add("active");
            loginErrorMsg.textContent = "";
            authModal.classList.add("active");
        } else {
            addReviewForm.classList.toggle("active");
            writeReviewToggle.style.display = addReviewForm.classList.contains("active") ? "none" : "inline-block";
        }
    });
}

// Cancel Review
if (cancelReviewBtn) {
    cancelReviewBtn.addEventListener("click", () => {
        addReviewForm.classList.remove("active");
        addReviewForm.reset();
        writeReviewToggle.style.display = "inline-block";
        // Reset stars highlight to 5
        resetStarSelectionRating(5);
    });
}

// Star Rating Selection hover/click handlers
starRatingSelect.forEach(star => {
    star.addEventListener("click", () => {
        const rating = Number(star.getAttribute("data-rating"));
        selectedRatingInput.value = rating;
        resetStarSelectionRating(rating);
    });
});

function resetStarSelectionRating(rating) {
    starRatingSelect.forEach(star => {
        const currentStarVal = Number(star.getAttribute("data-rating"));
        if (currentStarVal <= rating) {
            star.classList.remove("fa-regular");
            star.classList.add("fa-solid");
        } else {
            star.classList.remove("fa-solid");
            star.classList.add("fa-regular");
        }
    });
}

// Submit Review Form
if (addReviewForm) {
    addReviewForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        
        if (!auth.currentUser) {
            alert("Session expired. Please log in again.");
            return;
        }
        
        const reviewData = {
            name: auth.currentUser.displayName || currentUserDoc.name || "Anonymous Guest",
            email: auth.currentUser.email,
            rating: Number(selectedRatingInput.value),
            comment: reviewTextInput.value.trim(),
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        
        try {
            await db.collection("reviews").add(reviewData);
            
            // Collapse form, reset, and re-fetch list
            addReviewForm.classList.remove("active");
            addReviewForm.reset();
            writeReviewToggle.style.display = "inline-block";
            resetStarSelectionRating(5);
            
            // Reload reviews list (includes new submission at the top)
            await loadReviews();
        } catch (err) {
            console.error("Error submitting customer review:", err);
            alert("Failed to submit review. Please try again.");
        }
    });
}

// ==========================================
// EDIT PROFILE FORM & PHOTO PICKERS SYSTEM
// ==========================================

let cameraStream = null;
let cameraTarget = "profile"; // "profile" or "google"
let googleCapturedAvatarData = "";

// Helper to resize image using Canvas (keeps image small ~15KB to avoid storage limits)
function resizeImageToDataURL(imgElement, callback) {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    canvas.width = 200;
    canvas.height = 200;
    
    // Draw centered square crop
    const minDim = Math.min(imgElement.width, imgElement.height);
    const sx = (imgElement.width - minDim) / 2;
    const sy = (imgElement.height - minDim) / 2;
    
    ctx.drawImage(imgElement, sx, sy, minDim, minDim, 0, 0, 200, 200);
    callback(canvas.toDataURL("image/jpeg", 0.8));
}

// Preset click handler
presetAvatarImgs.forEach(img => {
    img.addEventListener("click", () => {
        const url = img.getAttribute("data-url");
        if (editProfileAvatarUrl) editProfileAvatarUrl.value = url;
        
        // Highlight active preset selection
        presetAvatarImgs.forEach(i => i.classList.remove("selected"));
        if (presetAvatarInitialsPreview) presetAvatarInitialsPreview.classList.remove("selected");
        
        img.classList.add("selected");
        
        // Update previews
        if (profileAvatarLarge) {
            profileAvatarLarge.innerHTML = `<img src="${url}" alt="Avatar Preview" style="width:100%; height:100%; border-radius:50%; object-fit:cover; display:block;">`;
        }
        if (avatarPreviewBox) {
            avatarPreviewBox.innerHTML = `<img src="${url}" alt="Avatar Preview">`;
        }
    });
});

// Initials/Default avatar preset click handler
if (presetAvatarInitialsPreview) {
    presetAvatarInitialsPreview.addEventListener("click", () => {
        if (editProfileAvatarUrl) editProfileAvatarUrl.value = "";
        
        presetAvatarImgs.forEach(i => i.classList.remove("selected"));
        presetAvatarInitialsPreview.classList.add("selected");
        
        // Reset previews to initials
        let initials = "U";
        const nameVal = editProfileName ? editProfileName.value.trim() : "";
        if (nameVal) {
            initials = nameVal.split(" ").map(n => n[0]).join("").substring(0, 2);
        } else if (auth.currentUser) {
            initials = auth.currentUser.email.substring(0, 2);
        }
        
        if (profileAvatarLarge) profileAvatarLarge.textContent = initials;
        if (avatarPreviewBox) avatarPreviewBox.textContent = initials;
    });
}

// Gallery Upload Trigger
if (uploadAvatarBtn && editProfileAvatarFile) {
    uploadAvatarBtn.addEventListener("click", () => {
        editProfileAvatarFile.click();
    });
}

// Gallery File selection listener
if (editProfileAvatarFile) {
    editProfileAvatarFile.addEventListener("change", (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                const img = new Image();
                img.onload = () => {
                    resizeImageToDataURL(img, (dataUrl) => {
                        if (editProfileAvatarUrl) editProfileAvatarUrl.value = dataUrl;
                        
                        presetAvatarImgs.forEach(i => i.classList.remove("selected"));
                        if (presetAvatarInitialsPreview) presetAvatarInitialsPreview.classList.remove("selected");
                        
                        if (profileAvatarLarge) {
                            profileAvatarLarge.innerHTML = `<img src="${dataUrl}" alt="Avatar Preview" style="width:100%; height:100%; border-radius:50%; object-fit:cover; display:block;">`;
                        }
                        if (avatarPreviewBox) {
                            avatarPreviewBox.innerHTML = `<img src="${dataUrl}" alt="Avatar Preview">`;
                        }
                    });
                };
                img.src = event.target.result;
            };
            reader.readAsDataURL(file);
        }
    });
}

// Camera stream controller
async function startCamera() {
    try {
        cameraStream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
            audio: false
        });
        if (cameraVideo) {
            cameraVideo.srcObject = cameraStream;
            cameraVideo.play();
        }
        if (cameraModal) cameraModal.classList.add("active");
    } catch (err) {
        console.error("Camera access failed:", err);
        alert("Unable to access camera. Please verify device permissions.");
    }
}

function stopCamera() {
    if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
        cameraStream = null;
    }
    if (cameraVideo) cameraVideo.srcObject = null;
    if (cameraModal) cameraModal.classList.remove("active");
}

if (cameraAvatarBtn) {
    cameraAvatarBtn.addEventListener("click", () => {
        cameraTarget = "profile";
        startCamera();
    });
}

if (cameraCloseBtn) {
    cameraCloseBtn.addEventListener("click", () => {
        stopCamera();
    });
}

// Capture frame from active camera stream
if (cameraCaptureBtn && cameraVideo && cameraCanvas) {
    cameraCaptureBtn.addEventListener("click", () => {
        const ctx = cameraCanvas.getContext("2d");
        cameraCanvas.width = 200;
        cameraCanvas.height = 200;
        
        // Take a square slice from video stream
        const minDim = Math.min(cameraVideo.videoWidth, cameraVideo.videoHeight);
        const sx = (cameraVideo.videoWidth - minDim) / 2;
        const sy = (cameraVideo.videoHeight - minDim) / 2;
        
        ctx.drawImage(cameraVideo, sx, sy, minDim, minDim, 0, 0, 200, 200);
        const dataUrl = cameraCanvas.toDataURL("image/jpeg", 0.85);
        
        if (cameraTarget === "google") {
            googleCapturedAvatarData = dataUrl;
            const googleCustomAvatarPreview = document.querySelector("#google-custom-avatar-preview");
            if (googleCustomAvatarPreview) {
                googleCustomAvatarPreview.innerHTML = `<img src="${dataUrl}" alt="Avatar Preview">`;
            }
        } else {
            if (editProfileAvatarUrl) editProfileAvatarUrl.value = dataUrl;
            
            presetAvatarImgs.forEach(i => i.classList.remove("selected"));
            if (presetAvatarInitialsPreview) presetAvatarInitialsPreview.classList.remove("selected");
            
            if (profileAvatarLarge) {
                profileAvatarLarge.innerHTML = `<img src="${dataUrl}" alt="Avatar Preview" style="width:100%; height:100%; border-radius:50%; object-fit:cover; display:block;">`;
            }
            if (avatarPreviewBox) {
                avatarPreviewBox.innerHTML = `<img src="${dataUrl}" alt="Avatar Preview">`;
            }
        }
        
        stopCamera();
    });
}

// URL Image Preview Action
if (avatarPreviewBtn) {
    avatarPreviewBtn.addEventListener("click", () => {
        const url = editProfileAvatarUrl ? editProfileAvatarUrl.value.trim() : "";
        if (url) {
            if (profileAvatarLarge) {
                profileAvatarLarge.innerHTML = `<img src="${url}" alt="Avatar Preview" style="width:100%; height:100%; border-radius:50%; object-fit:cover; display:block;" onerror="this.src='images/profile.jpg'; alert('Invalid image URL, falling back to default.');">`;
            }
            if (avatarPreviewBox) {
                avatarPreviewBox.innerHTML = `<img src="${url}" alt="Avatar Preview" onerror="this.src='images/profile.jpg';">`;
            }
            presetAvatarImgs.forEach(i => i.classList.remove("selected"));
            if (presetAvatarInitialsPreview) presetAvatarInitialsPreview.classList.remove("selected");
        } else {
            if (presetAvatarInitialsPreview) presetAvatarInitialsPreview.click();
        }
    });
}

// Submit Profile Edits
if (editProfileForm) {
    editProfileForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        
        if (!auth.currentUser) {
            alert("No user logged in.");
            return;
        }
        
        const name = editProfileName.value.trim();
        const avatarUrl = editProfileAvatarUrl.value.trim();
        
        if (!name) {
            alert("Please enter your name.");
            return;
        }
        
        const saveBtn = editProfileForm.querySelector("button[type='submit']");
        if (saveBtn) {
            saveBtn.disabled = true;
            saveBtn.textContent = "Saving...";
        }
        
        try {
            // Update Auth layer profile values
            if (auth.currentUser.updateProfile) {
                await auth.currentUser.updateProfile({
                    displayName: name,
                    photoURL: avatarUrl
                });
            } else {
                // Mock user update handler - reference auth.currentUser directly to bypass local scope limits
                const user = auth.currentUser;
                user.displayName = name;
                user.photoURL = avatarUrl;
                
                localStorage.setItem("mock_current_user", JSON.stringify(user));
                
                // Securely query and update Mock DB records directly from localStorage to bypass variable scopes
                const localUsers = JSON.parse(localStorage.getItem("mock_firebase_users")) || {};
                if (localUsers[user.email]) {
                    localUsers[user.email].displayName = name;
                    localUsers[user.email].photoURL = avatarUrl;
                    localStorage.setItem("mock_firebase_users", JSON.stringify(localUsers));
                }
            }
            
            // Update Firestore DB document profile records
            await db.collection("users").doc(auth.currentUser.uid).update({
                name: name,
                photoURL: avatarUrl
            });
            
            // Sync current profile variable
            if (currentUserDoc) {
                currentUserDoc.name = name;
                currentUserDoc.photoURL = avatarUrl;
            }
            
            // Re-render user badge, avatar previews, and reviews comments globally
            updateNavbarUserButton(auth.currentUser);
            updateProfileUI(auth.currentUser);
            loadReviews();
            
            alert("Profile updated successfully!");
        } catch (err) {
            console.error("Error saving user details changes:", err);
            alert("Failed to save changes. Please try again.");
        } finally {
            if (saveBtn) {
                saveBtn.disabled = false;
                saveBtn.textContent = "Save Changes";
            }
        }
    });
}

// ==========================================
// SEARCH DYNAMIC FILTERING LOGIC
// ==========================================
// ==========================================
// DEBOUNCED SEARCH OVERLAY LOGIC
// ==========================================

// Simple debounce helper
function debounce(func, wait) {
    let timeout;
    return function(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}

// Perform Live Filter Search
function performOverlaySearch() {
    if (!searchModalBox || !searchResultsDropdown) return;
    
    const query = searchModalBox.value.toLowerCase().trim();
    if (query === "") {
        searchResultsDropdown.innerHTML = "";
        searchResultsDropdown.style.display = "none";
        return;
    }
    
    // Gather all products dynamically from their data attributes on the page
    const allCards = Array.from(document.querySelectorAll(".cake-card, .cheese-card, .sourdough-card"));
    const products = allCards.map(card => ({
        name: card.getAttribute("data-name") || "",
        price: card.getAttribute("data-price") || "0",
        image: card.getAttribute("data-image") || "",
        description: card.getAttribute("data-description") || "",
        element: card
    }));
    
    // Filter matching product names (case-insensitive)
    const matches = products.filter(p => p.name.toLowerCase().includes(query));
    
    searchResultsDropdown.innerHTML = "";
    
    if (matches.length > 0) {
        matches.forEach(product => {
            // Escape double quotes in name for attribute safety
            const escapedName = product.name.replace(/"/g, '&quot;');
            
            const resultItemHTML = `
                <div class="search-result-item" data-product-name="${escapedName}">
                    <img src="${product.image}" alt="${product.name}" class="search-result-img">
                    <div class="search-result-info">
                        <span class="search-result-name">${product.name}</span>
                        <span class="search-result-price">Rs. ${product.price}/-</span>
                    </div>
                </div>
            `;
            searchResultsDropdown.insertAdjacentHTML("beforeend", resultItemHTML);
        });
        
        // Attach click listeners to result rows
        document.querySelectorAll(".search-result-item").forEach(item => {
            item.addEventListener("click", () => {
                const prodName = item.getAttribute("data-product-name");
                const matchedCard = Array.from(document.querySelectorAll(".cake-card, .cheese-card, .sourdough-card"))
                                         .find(card => card.getAttribute("data-name") === prodName);
                
                if (matchedCard) {
                    closeSearch(); // Close search modal and clear inputs
                    
                    // Smooth scroll to product card
                    matchedCard.scrollIntoView({ behavior: "smooth", block: "center" });
                    
                    // Auto-open detail quick-view modal
                    setTimeout(() => {
                        if (typeof openDetails === "function") {
                            openDetails(matchedCard);
                        }
                    }, 500);
                }
            });
        });
    } else {
        searchResultsDropdown.innerHTML = `
            <div class="search-no-results">
                <i class="fa-solid fa-cookie-bite"></i>
                No results found for "<span>${query}</span>"
            </div>
        `;
    }
    
    searchResultsDropdown.style.display = "block";
}

// Bind live search debounced keypresses
if (searchModalBox) {
    const debouncedSearch = debounce(performOverlaySearch, 200);
    
    searchModalBox.addEventListener("input", debouncedSearch);
    
    searchModalBox.addEventListener("keypress", (e) => {
        if (e.key === "Enter") {
            e.preventDefault();
            performOverlaySearch();
        }
    });
}

// Bind X button click to close search modal
if (searchModalCloseBtn) {
    searchModalCloseBtn.addEventListener("click", () => {
        closeSearch();
    });
}

// Click outside modal container (backdrop click) to close
if (searchOverlay) {
    searchOverlay.addEventListener("click", (e) => {
        if (searchModal && !searchModal.contains(e.target)) {
            closeSearch();
        }
    });
}

// Press Escape key on keyboard to close search
document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
        closeSearch();
    }
});


