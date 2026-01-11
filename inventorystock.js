// --- FIREBASE IMPORTS ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-app.js";
import { getDatabase, ref, set, onValue } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-database.js";
import { 
    getAuth, 
    signInWithPopup, 
    GoogleAuthProvider, 
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js"; 

const firebaseConfig = {
  apiKey: "AIzaSyDVn6-jt6bNgy3DmXzgiWILydudHVQed7c",
  authDomain: "anadi-inventory-stockmanagment.firebaseapp.com",
  databaseURL: "https://anadi-inventory-stockmanagment-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "anadi-inventory-stockmanagment",
  storageBucket: "anadi-inventory-stockmanagment.firebasestorage.app",
  messagingSenderId: "707078446914",
  appId: "1:707078446914:web:fad8f73c3c99a0be4ef2db",
  measurementId: "G-Y5V49CMZVM"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const auth = getAuth(app); // Auth Init
const provider = new GoogleAuthProvider(); // Google Provider

// Database Path
const DB_PATH = 'Anadi_inventory_data';

// --- DATA & CONFIG ---
const CATALOG = {
    edible: [
        { id: 'ED-MILK', name: 'Milk', unit: 'L' },
        { id: 'ED-CURD', name: 'Curd', unit: 'Kg' },
        { id: 'ED-BUTTERMILK', name: 'Buttermilk', unit: 'L' },
        { id: 'ED-W-BUTTER', name: 'WhiteButter', unit: 'Kg' },
        { id: 'ED-PANEER', name: 'Paneer', unit: 'Kg' },
        { id: 'ED-GHEE', name: 'Ghee', unit: 'Kg' }
    ],
    byprod: [
        { id: 'BY-DHOOP', name: 'Dhoop Sticks', unit: 'Box' },
        { id: 'BY-SAMBRANI', name: 'Sambrani Cup', unit: 'Pack' },
        { id: 'BY-HAWAN-S', name: 'Chotti Hawan Tikki', unit: 'Pack' },
        { id: 'BY-HAWAN-L', name: 'Badi Hawan Tikki', unit: 'Pack' },
        { id: 'BY-GOUMUTRA', name: 'Goumutra Ark', unit: 'Bottle' },
        { id: 'BY-NASYA', name: 'Nasya', unit: 'Drop' },
        { id: 'BY-KHAAD', name: 'Organic Khaad', unit: 'Bag' }
    ]
};

let appState = {
    stock: {},
    logs: []
};

let html5QrcodeScanner = null;

// --- AUTHENTICATION LOGIC (New & Fixed) ---

// 1. Auth State Observer (Login/Logout Check)
// --- AUTHENTICATION LOGIC ---

// --- AUTHENTICATION LOGIC (Open for All Users) ---
onAuthStateChanged(auth, (user) => {
    const loginScreen = document.getElementById('login-screen');
    const appContent = document.getElementById('app-content');

    if (user) {
        // User Login है (Koi bhi Google user)
        console.log("User logged in:", user.email);
        
        // 1. UI Update karein
        loginScreen.classList.add('hidden');
        appContent.classList.remove('hidden');
        appContent.classList.add('flex');
        
        // 2. Data Load karein
        loadRealtimeData(); 
        
        // 3. Loader hatayein
        hideGlobalLoader();

    } else {
        // User Logout hai
        console.log("User logged out");
        
        loginScreen.classList.remove('hidden');
        appContent.classList.add('hidden');
        appContent.classList.remove('flex');
        
        // Loader hatayein (taaki login screen dikhe)
        hideGlobalLoader();
        resetLoginButtons();
    }
});

// 2. Google Login with Loader
window.handleGoogleLogin = function() {
    const btn = document.querySelector('button[onclick="handleGoogleLogin()"]');
    const originalContent = btn.innerHTML;
    
    // Show Loader
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Signing in...';

    signInWithPopup(auth, provider)
        .then((result) => {
            // Success: onAuthStateChanged will handle UI
        })
        .catch((error) => {
            console.error(error);
            alert("Login Failed: " + error.message);
            // Reset Button on Error
            btn.disabled = false;
            btn.innerHTML = originalContent;
        });
};

// 3. Email Login with Loader
window.handleEmailLogin = function() {
    const email = document.getElementById('login-email').value;
    const pass = document.getElementById('login-pass').value;
    const btn = document.querySelector('button[onclick="handleEmailLogin()"]');
    const originalContent = btn.innerHTML;

    if(!email || !pass) return alert("Please enter email and password");

    // Show Loader
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Verifying...';

    signInWithEmailAndPassword(auth, email, pass)
        .then((userCredential) => {
            // Success
        })
        .catch((error) => {
            alert("Error: " + error.message);
            // Reset Button
            btn.disabled = false;
            btn.innerHTML = originalContent;
        });
};

// 4. Logout Function
window.handleLogout = function() {
    if(confirm("Are you sure you want to logout?")) {
        signOut(auth).then(() => {
            location.reload();
        }).catch((error) => {
            console.error(error);
        });
    }
};

// --- DATA LOADING (Moved inside Auth) ---
function loadRealtimeData() {
    populateProductDropdown();
    const dataRef = ref(db, DB_PATH);
    
    onValue(dataRef, (snapshot) => {
        const data = snapshot.val();
        
        if (data) {
            appState = data;
            
            if (!appState.stock) appState.stock = {};
            if (!appState.logs) appState.logs = [];

            let needSave = false;

            // --- 1. PRODUCT CATALOG MIGRATION (Jo pehle kiya tha) ---
            if (!appState.products) {
                console.log("Migrating Catalog...");
                if(typeof CATALOG !== 'undefined') {
                    appState.products = JSON.parse(JSON.stringify(CATALOG));
                    needSave = true;
                }
            }

            // --- 2. LOGS ID FIX (Ye naya hai - Old Logs ko ID dega) ---
            if (appState.logs.length > 0) {
                appState.logs.forEach((log, index) => {
                    // Agar logId nahi hai, to ek bana do
                    if (!log.logId) {
                        // ID format: OLD_timestamp_index
                        log.logId = 'OLD_' + Date.now() + '_' + index;
                        needSave = true;
                    }
                });
            }

            // Agar kuch change hua hai to database me save karo
            if (needSave) {
                console.log("System Updated Old Data automatically.");
                saveDataToFirebase();
            }
            
        } else {
            // New User
            appState = {
                stock: {},
                logs: [],
                products: (typeof CATALOG !== 'undefined') ? JSON.parse(JSON.stringify(CATALOG)) : {}
            };
            initStockObject();
            saveDataToFirebase();
        }

        // Render Views
        renderInventory();
        renderLogs();
        if(typeof renderProductList === 'function') renderProductList();
        populateProductDropdown();
    });
}
// --- 🔄 LOADER LOGIC ---
const loaderIcons = ['🐄', '🥛', '🌿', '✨', '🌸'];
let loaderIndex = 0;
const loaderElement = document.getElementById('global-loader');
const emojiElement = document.getElementById('loader-emoji');

// Icon Change Interval (Zepto Effect)
const iconInterval = setInterval(() => {
    if(emojiElement) {
        loaderIndex = (loaderIndex + 1) % loaderIcons.length;
        emojiElement.innerText = loaderIcons[loaderIndex];
    }
}, 600); // Har 0.6 second me icon badlega

function hideGlobalLoader() {
    if(loaderElement) {
        // Fade out effect
        loaderElement.style.opacity = '0';
        setTimeout(() => {
            loaderElement.classList.add('hidden');
            clearInterval(iconInterval); // Stop animation to save memory
        }, 500);
    }
}

// --- INITIALIZATION (Standard) ---
document.addEventListener('DOMContentLoaded', () => {
    
    // Dropdown UI load
    // --- 🌟 MAGIC LOGO ANIMATION 🌟 ---
    startMagicLogoEffect();
    populateProductDropdown();
    // Note: Data loading removed from here, moved to AuthStateChanged
});

function initStockObject() {
    let updated = false;
    [...CATALOG.edible, ...CATALOG.byprod].forEach(item => {
        if (appState.stock[item.id] === undefined) {
            appState.stock[item.id] = 0;
            updated = true;
        }
    });
    if(updated) saveDataToFirebase();
}

function saveDataToFirebase() {
    const dataRef = ref(db, DB_PATH);
    set(dataRef, appState)
      .then(() => console.log("Synced to Firebase"))
      .catch((err) => console.error("Firebase Error:", err));
}

// --- NAVIGATION & UI FUNCTIONS ---

window.switchTab = function(tabId) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
    
    const targetTab = document.getElementById(tabId);
    if(targetTab) targetTab.classList.remove('hidden');
    
    // Mobile Nav Logic
    document.querySelectorAll('.mobile-nav-item').forEach(el => {
        el.classList.remove('text-green-600');
        el.classList.add('text-slate-400');
        const span = el.querySelector('span');
        if(span) { span.classList.remove('text-green-600'); span.classList.add('text-slate-400'); }
    });

    const activeMobile = document.querySelector(`.mobile-nav-item[data-tab="${tabId}"]`);
    if(activeMobile) {
        activeMobile.classList.remove('text-slate-400');
        if(tabId !== 'scanner') {
            activeMobile.classList.add('text-green-600');
        } else {
            const span = activeMobile.querySelector('span');
            if(span) { span.classList.remove('text-slate-400'); span.classList.add('text-green-600'); }
        }
    }

    // Title Logic
    const titles = {
        'inventory': 'Inventory Overview',
        'stockin': 'Stock Entry',
        'scanner': 'Dispatch Point',
        'logs': 'History'
    };
    const titleEl = document.getElementById('pageTitle');
    if(titleEl && titles[tabId]) titleEl.innerText = titles[tabId];

    if(tabId !== 'scanner' && typeof stopScanner === 'function') {
        stopScanner();
    }
};

window.populateProductDropdown = function() {
    const cat = document.getElementById('in-cat').value; // 'edible' or 'byprod'
    const select = document.getElementById('in-product');
    select.innerHTML = '';

    const items = (appState.products && appState.products[cat]) ? appState.products[cat] : [];
    
    items.forEach(item => {
        const opt = document.createElement('option');
        opt.value = item.id;
        opt.innerText = item.name;
        select.appendChild(opt);
    });
};

window.calculateTotal = function() {
    const qty = parseFloat(document.getElementById('in-qty').value) || 0;
    const price = parseFloat(document.getElementById('in-price').value) || 0;
    const total = qty * price;
    document.getElementById('in-total-display').innerText = 
        total > 0 ? `₹ ${total.toLocaleString('en-IN')}` : '₹ 0';
};

window.handleAddStock = function() {
    const pId = document.getElementById('in-product').value;
    const qty = parseFloat(document.getElementById('in-qty').value);
    
    // Price value le rahe hain
    const price = parseFloat(document.getElementById('in-price').value) || 0;
    
    const isVip = document.getElementById('in-vip').checked;

    // Dates Logic
    const mfgDate = document.getElementById('in-mfg').value;
    const hasExp = document.getElementById('in-has-exp').checked;
    let expDate = '-------';
    if(hasExp) {
        expDate = document.getElementById('in-exp').value;
        if(!expDate) return alert("Please select an Expiry Date!");
    }

    if(!qty || qty <= 0) return alert("Please enter valid quantity");
    if(!mfgDate) return alert("MFG Date is required");

    // 1. STOCK UPDATE
    if(!appState.stock[pId]) appState.stock[pId] = 0;
    appState.stock[pId] += qty;
    
    // --- NEW: PRICE UPDATE (Fix Calculation) ---
    // Hum product list me price update kar denge taaki dashboard sahi calculate kare
    const catKey = pId.startsWith('ED') ? 'edible' : 'byprod';
    if(appState.products && appState.products[catKey]) {
        const prodIndex = appState.products[catKey].findIndex(p => p.id === pId);
        if(prodIndex > -1 && price > 0) {
            // Product ke andar price save kar rahe hain (Last Purchase Price)
            appState.products[catKey][prodIndex].lastPrice = price;
        }
    }
    // -------------------------------------------

    const pName = getProductName(pId);
    let batchNo = generateBatchNumber(pName);
    if (isVip) batchNo = '👑' + batchNo;

    const totalVal = qty * price;
    
    // Note for Logs
    const noteObj = {
        msg: price > 0 ? `Purchase (₹${totalVal})` : `Stock Update`,
        batch: batchNo,
        mfg: mfgDate,
        exp: expDate,
        mrp: price
    };
    
    addLog('Stock In', pName, `+${qty}`, JSON.stringify(noteObj));
    saveDataToFirebase();
    
    generateLabel(pId, pName, qty, batchNo, isVip, mfgDate, expDate, price);
    
    // Reset Form
    document.getElementById('in-qty').value = '';
    document.getElementById('in-price').value = '';
    document.getElementById('in-vip').checked = false;
    document.getElementById('in-has-exp').checked = false;
    toggleExpiryInput(); 
    setDefaultDate(); 
    document.getElementById('in-total-display').innerText = '₹ 0';
};

window.startScanner = function() {
    // UI Update
    document.getElementById('scan-result-placeholder').classList.add('hidden');
    document.getElementById('scan-result-active').classList.add('hidden'); // Ensure result is hidden initially
    
    // Scanner Status
    const statusEl = document.getElementById('scanner-status');
    if(statusEl) statusEl.innerText = "Starting...";

    // Init Scanner
    if(html5QrcodeScanner) {
        // Agar pehle se chal raha hai to clear karein
        html5QrcodeScanner.clear().then(() => initCamera());
    } else {
        initCamera();
    }
};

function initCamera() {
    if(html5QrcodeScanner) {
        try { html5QrcodeScanner.clear(); } catch(e){}
    }

    html5QrcodeScanner = new Html5Qrcode("reader");
    
    const config = { 
        fps: 50, // Ultra High FPS
        // Size thoda chhota rakhenge taaki user camera paas laye (Better for small/damaged QRs)
        qrbox: { width: 220, height: 220 }, 
        aspectRatio: 1.0,
        disableFlip: false,
        formatsToSupport: [ Html5QrcodeSupportedFormats.QR_CODE ],
        experimentalFeatures: {
            useBarCodeDetectorIfSupported: true
        }
    };

    html5QrcodeScanner.start(
        { facingMode: "environment" }, 
        config,
        onScanSuccess, 
        (error) => { /* No-op for speed */ }
    ).then(() => {
        const statusEl = document.getElementById('scanner-status');
        if(statusEl) {
            statusEl.innerText = "High-Res Mode";
            statusEl.classList.remove('bg-red-500/80');
            statusEl.classList.add('bg-blue-600', 'text-white');
        }
    }).catch(err => {
        alert("Camera Error: " + err);
        resetScannerUI();
    });
}

window.stopScanner = function() {
    if(html5QrcodeScanner) {
        // Stop returns a promise
        html5QrcodeScanner.stop().then(() => {
            html5QrcodeScanner.clear();
            html5QrcodeScanner = null;
        }).catch(err => console.log("Stop failed", err));
    }
    
    // Status update
    const statusEl = document.getElementById('scanner-status');
    if(statusEl) {
        statusEl.innerText = "Off";
        statusEl.classList.add('bg-red-500/80');
        statusEl.classList.remove('bg-green-500/80');
    }
};

window.resetScannerUI = function() {
    // Cancel dabane par camera band nahi karenge, bas wapas resume karenge
    continueScanning(); 
};

window.processDispatch = function() {
    const input = document.getElementById('res-qty-input');
    const id = input.dataset.id;
    const qtyToRemove = parseFloat(input.value);
    
    // --- NEW: Capture Customer Details ---
    const custName = document.getElementById('res-cust-name').value.trim() || 'Guest';
    const custPhone = document.getElementById('res-cust-phone').value.trim() || '-';
    const custAddr = document.getElementById('res-cust-addr').value.trim() || '-';
    // -------------------------------------

    const batchFromScan = input.dataset.batch || 'N/A';
    const isVip = input.dataset.vip === 'true';

    // Validation
    if(!id || !appState.stock[id]) return alert("Product Error");
    const currentStock = appState.stock[id];

    if(!qtyToRemove || qtyToRemove <= 0) return alert("Invalid Qty");
    if(qtyToRemove > currentStock) return alert(`Low Stock! Max: ${currentStock}`);

    // 1. Stock Update
    appState.stock[id] -= qtyToRemove;
    
    // 2. Log Entry (Packing all details in JSON)
    const pName = getProductName(id);
    
    const noteObj = {
        msg: 'Scan Sale',
        batch: batchFromScan,
        vip: isVip,
        // Saving Customer Data inside JSON note
        customer: {
            name: custName,
            phone: custPhone,
            addr: custAddr
        }
    };

    addLog('Dispatch', pName, `-${qtyToRemove}`, JSON.stringify(noteObj));
    saveDataToFirebase();
    
    // 3. Fast Feedback
    if ('speechSynthesis' in window) {
        const msg = new SpeechSynthesisUtterance("Order Dispatched");
        msg.rate = 1.5; 
        window.speechSynthesis.speak(msg);
    }
    
    // 4. Auto Resume
    continueScanning(); 
};



// --- RENDER & HELPER FUNCTIONS ---

function renderInventory() {
    let totalItems = 0;
    let edibleVal = 0; 
    let byprodVal = 0;

    const createRow = (item, qty, currentPrice) => {
        let colorClass = 'bg-green-100 text-green-700';
        let statusText = 'In Stock';
        if(qty === 0) { colorClass = 'bg-red-100 text-red-700'; statusText = 'Out'; }
        else if(qty < 10) { colorClass = 'bg-yellow-100 text-yellow-700'; statusText = 'Low'; }

        // --- CHANGE: Calculate Total Value ---
        const totalValue = qty * currentPrice;
        const valueDisplay = totalValue > 0 ? `Total: ₹${totalValue.toLocaleString('en-IN')}` : '-';

        return `
            <div class="p-4 flex flex-row items-center justify-between md:grid md:grid-cols-5 md:gap-4 hover:bg-slate-50 transition border-b border-slate-100">
                
                <!-- Name Column -->
                <div class="flex flex-col md:block md:col-span-2">
                    <span class="font-bold text-slate-700">${item.name}</span>
                    <span class="text-xs text-slate-400 md:hidden">${item.id}</span>
                </div>
                
                <!-- Unit Column -->
                <div class="text-sm text-slate-500 hidden md:block">${item.unit}</div>
                
                <!-- Qty & Total Value Column -->
                <div class="flex flex-col justify-center">
                    <span class="font-bold text-lg text-slate-800">
                        ${qty} <span class="text-xs font-normal text-slate-400">${item.unit}</span>
                    </span>
                    <!-- Yaha ab Total Value dikhegi (e.g. Total: ₹6,000) -->
                    <span class="text-[10px] text-slate-500 font-medium bg-slate-100 px-1 rounded w-fit mt-1">
                        ${valueDisplay}
                    </span>
                </div>

                <!-- Status Column -->
                <div class="text-right md:text-left">
                    <span class="px-2 py-1 rounded text-[10px] md:text-xs font-bold uppercase ${colorClass}">${statusText}</span>
                </div>
            </div>
        `;
    };

    // --- FIX CALCULATION LOGIC ---
    
    // Render Edible
    const edibleBody = document.getElementById('table-edible');
    if(edibleBody) {
        edibleBody.innerHTML = '';
        const edibles = (appState.products && appState.products.edible) ? appState.products.edible : [];
        edibles.forEach(item => {
            const qty = appState.stock[item.id] || 0;
            const price = item.lastPrice || 0; // Use saved price
            
            totalItems += qty;
            edibleVal += qty * price; // Actual Calculation
            
            edibleBody.innerHTML += createRow(item, qty, price);
        });
    }

    // Render ByProd
    const byprodBody = document.getElementById('table-byprod');
    if(byprodBody) {
        byprodBody.innerHTML = '';
        const byprods = (appState.products && appState.products.byprod) ? appState.products.byprod : [];
        byprods.forEach(item => {
            const qty = appState.stock[item.id] || 0;
            const price = item.lastPrice || 0; // Use saved price

            totalItems += qty;
            byprodVal += qty * price; // Actual Calculation
            
            byprodBody.innerHTML += createRow(item, qty, price);
        });
    }
    
    // Update Stats on Dashboard
    if(document.getElementById('stat-total-items')) document.getElementById('stat-total-items').innerText = totalItems;
    if(document.getElementById('stat-edible-val')) document.getElementById('stat-edible-val').innerText = edibleVal.toLocaleString('en-IN');
    if(document.getElementById('stat-byprod-val')) document.getElementById('stat-byprod-val').innerText = byprodVal.toLocaleString('en-IN');
}

// Is function ko file me kahi bhi add kar lein
function getAllProducts() {
    let products = [];
    
    // 1. Database se products lo
    if (appState.products) {
        if(appState.products.edible) products = [...products, ...appState.products.edible];
        if(appState.products.byprod) products = [...products, ...appState.products.byprod];
    }
    
    // 2. Agar DB khali hai, to Hardcoded Catalog use karo (Backup)
    if (products.length === 0) {
        if(typeof CATALOG !== 'undefined') {
            products = [...CATALOG.edible, ...CATALOG.byprod];
        }
    }
    
    return products;
}

// Update: Get Product Name from DB
function getProductName(id) {
    const all = getAllProducts();
    const found = all.find(x => x.id === id);
    // Agar product mil gaya to Naam dikhao, nahi to ID dikhao
    return found ? found.name : id; 
}
// --- BATCH NUMBER GENERATOR ---
// Format: Name ke first 4 letters + 6 Unique Digits (Time based)
function generateBatchNumber(productName) {
    // 1. Naam se spaces hataye aur first 4 letters lein
    const cleanName = productName.replace(/[^a-zA-Z]/g, '').toUpperCase();
    const prefix = cleanName.substring(0, 4);

    // 2. Unique Number Generate karein
    // Date.now() millisecond timestamp deta hai, uske last 6 digits kabhi repeat nahi honge
    const uniqueSuffix = Date.now().toString().slice(-6);

    // Output example: GHEE849201
    return `${prefix}${uniqueSuffix}`;
}
// Function me 'batchNo' parameter add kiya gaya hai
// Function me 'isVip' parameter add kiya
function generateLabel(id, name, qty, batchNo, isVip, mfg, exp, price) {
    const target = document.getElementById('lbl-qr-target');
    if (!target) return;

    const cleanBatch = batchNo ? batchNo.replace(/👑/g, '') : '';
    const vipFlag = isVip ? '1' : '0';

    // --- STRATEGY: PIPE FORMAT (No JSON) ---
    // Format: ID|BATCH|VIP
    // Example: ED-MILK|MILK84920|1
    // Ye JSON se 40% chota hota hai, isliye dots BADE banenge.
    const rawData = `${id}|${cleanBatch}|${vipFlag}`;

    target.innerHTML = ''; 

    try {
        new QRCode(target, {
            text: rawData,
            width: 128,
            height: 128,
            colorDark : "#000000",
            colorLight : "#ffffff",
            // --- CRITICAL CHANGE: High Error Correction ---
            // H = High (30% Damage Recovery). 
            // Kyunki data kam hai, Level H use karne par bhi QR dense nahi hoga.
            correctLevel : QRCode.CorrectLevel.H 
        });
    } catch (e) { console.error(e); }

    // --- VISUAL LABEL ---
    const nameEl = document.getElementById('lbl-name');
    nameEl.innerHTML = (isVip ? '👑 ' : '') + name;
     nameEl.style.fontSize = '24px';  // Font size badhaya
    nameEl.style.fontWeight = '900'; // Extra Bold kiya
    nameEl.style.marginBottom = '5px';
    if(isVip) nameEl.classList.add('text-yellow-600');
    else nameEl.classList.remove('text-yellow-600');

    document.getElementById('lbl-id').innerText = id;
    document.getElementById('lbl-qty').innerText = 'Qty: ' + qty;
    
    const batchEl = document.getElementById('lbl-batch');
     batchEl.innerHTML = `
        <!-- BATCH (Highlighted Background) -->
        <div style="font-size: 16px; font-weight: 800; background: #e5e7eb; padding: 4px 0; margin-bottom: 4px;">
            BATCH: ${batchNo}
        </div>
        
        <!-- MRP (Sabse Bada aur Bold) -->
        <div style="font-size: 22px; font-weight: 900; padding: 2px 0; border-top: 2px dashed #000; border-bottom: 2px dashed #000;">
            MRP: ₹${price}
        </div>
        
        <!-- DATES (Bold aur Flex layout) -->
        <div style="font-size: 13px; font-weight: 800; margin-top: 5px; display: flex; justify-content: space-between; padding: 0 5px;">
            <span>MFG: ${mfg}</span>
            <span>EXP: ${exp}</span>
        </div>
    `;
    
    // Border styling for better print contrast
    const baseClass = "px-2 py-1 rounded text-xs font-mono font-bold tracking-widest block border-2 ";
    if(isVip) batchEl.className = baseClass + "bg-yellow-50 text-yellow-900 border-yellow-500";
    else batchEl.className = baseClass + "bg-white text-slate-900 border-black";

    document.getElementById('qr-container').classList.add('hidden');
    document.getElementById('print-area').classList.remove('hidden');
    document.getElementById('printBtn').classList.remove('hidden');
}

function onScanSuccess(decodedText, decodedResult) {
    if(html5QrcodeScanner) {
        html5QrcodeScanner.pause(true); 
    }

    if ('speechSynthesis' in window) {
        const msg = new SpeechSynthesisUtterance("Ok"); // Shortest word for speed
        msg.rate = 2.0; 
        window.speechSynthesis.speak(msg);
    }

    try {
        let id = null;
        let batch = null;
        let isVip = false;
        let price = 0;

        // --- NEW: PIPE FORMAT PARSER ---
        if (decodedText.includes('|')) {
            const parts = decodedText.split('|');
            // Format: ID|BATCH|VIP
            if(parts.length >= 2) {
                id = parts[0];
                batch = parts[1];
                isVip = (parts[2] === '1');
            }
        } 
        // Fallback for JSON (Old QRs)
        else {
            const data = JSON.parse(decodedText);
            if (data.i) { id = data.i; batch = data.b; }
            else if (data.id) { id = data.id; batch = data.batch; isVip = data.vip; }
        }

        if (id) {
            // Get price from Database since it's not in QR anymore
            const product = getAllProducts().find(p => p.id === id);
            if(product && product.lastPrice) {
                price = product.lastPrice;
            }
            showScanResult(id, batch, isVip, price);
        } else {
            console.log("Unknown QR Format");
            html5QrcodeScanner.resume();
        }

    } catch (e) {
        console.error("Scan Error", e);
        html5QrcodeScanner.resume();
    }
}
function onScanFailure(error) {}
// Function signature me batchNo add karein
function showScanResult(id, batchNo, isVip, price) { // Added price param
    const pName = getProductName(id);
    const currentStock = appState.stock[id] || 0;
    
    document.getElementById('scan-result-placeholder').classList.add('hidden');
    document.getElementById('scan-result-active').classList.remove('hidden');

    // Name
    const nameEl = document.getElementById('res-name');
    nameEl.innerHTML = (isVip ? '<span class="text-yellow-600 mr-1">👑</span> ' : '') + pName;
    
    // --- CHANGE: Show Price with Stock ---
    const stockEl = document.getElementById('res-stock');
    if(price > 0) {
        stockEl.innerHTML = `${currentStock} <span class="ml-2 text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded border border-green-200">MRP: ₹${price}</span>`;
    } else {
        stockEl.innerText = currentStock;
    }
    
    // Batch Label
    const typeLabel = document.getElementById('res-type');
    if(batchNo) {
        typeLabel.innerText = batchNo;
        typeLabel.className = isVip 
            ? "text-[10px] font-mono font-bold px-2 py-1 rounded bg-yellow-100 text-yellow-800 border border-yellow-400"
            : "text-[10px] font-mono font-bold bg-slate-100 text-slate-600 border border-slate-300 px-2 py-1 rounded";
    } else {
        typeLabel.innerText = 'Standard';
    }
    
    const input = document.getElementById('res-qty-input');
    input.dataset.id = id;
    input.dataset.batch = batchNo || ''; 
    input.dataset.vip = isVip ? 'true' : 'false';
    input.dataset.price = price; // Price bhi dataset me rakh lo future use ke liye

    input.value = 1; 
    input.select();
    input.focus();
}


function resetScannerUI() {
    document.getElementById('scan-result-active').classList.add('hidden');
    document.getElementById('scan-result-placeholder').classList.remove('hidden');
    document.getElementById('res-qty-input').value = '';
}

function addLog(type, product, qty, notes) {
    const now = new Date();
    const log = {
        logId: Date.now().toString(), // <--- YE LINE ADD KARNA JARURI HAI
        date: now.toISOString().split('T')[0],
        time: now.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}),
        type, product, qty, notes
    };
    
    if(!appState.logs) appState.logs = [];
    appState.logs.unshift(log);
    renderLogs();
}

function renderLogs() {
    const tbody = document.getElementById('logs-body');
    if(!tbody) return;
    
    tbody.innerHTML = '';
    
    (appState.logs || []).slice(0, 30).forEach(log => {
        // ... (Uppar ka purana code same rahega: Date, Note parsing etc) ...
        // ... (Yahan bas Customer HTML wala hissa change ho raha hai) ...

        const isStockIn = log.type === 'Stock In';
        const typeColor = isStockIn ? 'text-green-600' : 'text-red-600';
        const typeBg = isStockIn ? 'bg-green-50' : 'bg-red-50';
        
        // Date Logic...
        let transDate = log.date || '-';
        if(log.date && log.date.includes('-')) {
            const parts = log.date.split('-');
            if(parts.length === 3) transDate = `${parts[2]}-${parts[1]}-${parts[0]}`;
        }

        // Parsing...
        let displayBatch = '-';
        let displayMsg = '-';
        let isVip = false;
        let customer = null;

        try {
            if(log.notes && log.notes.startsWith('{')) {
                const noteObj = JSON.parse(log.notes);
                displayBatch = noteObj.batch || 'No Batch';
                displayMsg = noteObj.msg || '-';
                isVip = noteObj.vip || false;
                customer = noteObj.customer;
            } else { displayBatch = log.notes; }
        } catch(e) { displayBatch = log.notes; }

        const vipIcon = (displayBatch.includes('👑') || isVip) ? '<span class="mr-1">👑</span>' : '';
        const cleanBatch = displayBatch.replace('👑', '');

        // --- NEW CUSTOMER HTML (COLLAPSIBLE) ---
        // --- NEW SMOOTH CUSTOMER HTML ---
        let customerHtml = '';
        if (customer && customer.name) {
            const detailId = `cust-${log.logId}`;
            
            customerHtml = `
                <!-- Button -->
                <div class="mt-2">
                    <button onclick="toggleLogDetails('${detailId}', this)" 
                        class="text-[10px] font-bold text-blue-500 hover:text-blue-700 flex items-center transition focus:outline-none">
                        View Order Details <i class="fa-solid fa-chevron-down ml-1 transition-transform duration-300"></i>
                    </button>
                </div>

                <!-- Wrapper for Animation (Initially Closed: grid-rows-0) -->
                <div id="${detailId}" class="smooth-wrapper">
                    <div class="smooth-inner">
                        
                        <!-- Real Content -->
                        <div class="mt-2 p-3 bg-slate-50 rounded-lg border border-slate-100">
                            <!-- Name -->
                            <div class="flex items-center gap-2 mb-1">
                                <div class="bg-white p-1 rounded-full border border-slate-200 text-slate-400">
                                    <i class="fa-solid fa-user text-xs w-3 h-3 flex items-center justify-center"></i>
                                </div>
                                <span class="text-xs font-bold text-slate-700">${customer.name}</span>
                            </div>

                            <!-- Phone -->
                            <div class="flex items-center gap-2 mb-1">
                                <div class="bg-white p-1 rounded-full border border-slate-200 text-slate-400">
                                    <i class="fa-solid fa-phone text-xs w-3 h-3 flex items-center justify-center"></i>
                                </div>
                                <span class="text-xs font-mono text-slate-600 select-all">${customer.phone}</span>
                            </div>

                            <!-- Address -->
                            <div class="flex gap-2 mt-2 pt-2 border-t border-slate-200">
                                <div class="mt-0.5 text-slate-400">
                                    <i class="fa-solid fa-location-dot text-xs"></i>
                                </div>
                                <span class="text-xs text-slate-500 leading-relaxed break-words w-full">
                                    ${customer.addr}
                                </span>
                            </div>
                        </div>
                        <!-- End Real Content -->

                    </div>
                </div>
            `;
        }
        // ----------------------------------------

        tbody.innerHTML += `
            <tr class="border-b border-slate-50 hover:bg-slate-50 transition text-sm">
                <td class="p-3 align-top"> <!-- align-top added -->
                    <div class="font-bold text-slate-800 text-base flex items-center">
                       ${vipIcon} ${log.product}
                    </div>
                    <div class="flex items-center gap-3 text-[11px] text-slate-400 mt-1 font-mono">
                        <span>📅 ${transDate}</span>
                        <span>⏰ ${log.time}</span>
                    </div>
                    
                    <!-- Insert Collapsible Customer HTML -->
                    ${customerHtml}
                </td>

                <td class="p-3 align-top">
                     <div class="inline-block px-2 py-1 rounded border bg-slate-100 border-slate-200 text-slate-600 font-mono text-xs font-bold mb-1">
                        ${cleanBatch}
                    </div>
                    <div class="text-[10px] text-slate-400">${displayMsg}</div>
                </td>

                <td class="p-3 text-center align-top">
                    <span class="font-bold text-lg ${typeColor} ${typeBg} px-3 py-1 rounded-lg">
                        ${log.qty}
                    </span>
                </td>

                <td class="p-3 text-right align-top">
                    <button onclick="deleteLogEntry('${log.logId}')" 
                        class="text-slate-300 hover:text-red-600 hover:bg-red-50 p-2 rounded-full transition">
                        <i class="fa-solid fa-trash-can"></i>
                    </button>
                </td>
            </tr>
        `;
    });
}

// Beep Sound (Faster than Speech)
const context = new (window.AudioContext || window.webkitAudioContext)();
const osc = context.createOscillator();
osc.type = "sine";
osc.frequency.value = 800;
osc.connect(context.destination);
osc.start();
setTimeout(() => osc.stop(), 100); // 100ms beep

window.generatePDF = function() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    const startDate = document.getElementById('pdf-start').value;
    const endDate = document.getElementById('pdf-end').value;

    doc.setFontSize(18);
    doc.text("Anadi Inventory Report", 14, 20);
    doc.setFontSize(10);
    doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 28);
    
    let yPos = 35;
    
    // Summary
    doc.setFontSize(14);
    doc.setTextColor(220, 38, 38);
    doc.text("1. Current Stock Status", 14, yPos);
    yPos += 5;

    const stockRows = [];
    [...CATALOG.edible, ...CATALOG.byprod].forEach(item => {
        const qty = appState.stock[item.id] || 0;
        stockRows.push([item.name, item.unit, qty]);
    });

    doc.autoTable({
        startY: yPos,
        head: [['Product Name', 'Unit', 'Current Quantity']],
        body: stockRows,
        theme: 'grid',
        headStyles: { fillColor: [40, 40, 40] },
    });

    yPos = doc.lastAutoTable.finalY + 15;

    // Logs
    doc.setFontSize(14);
    doc.setTextColor(220, 38, 38);
    doc.text("2. Transaction History", 14, yPos);
    
    let filteredLogs = appState.logs || [];
    let dateText = "All Records";

    if (startDate && endDate) {
        dateText = `From ${startDate} To ${endDate}`;
        filteredLogs = filteredLogs.filter(log => {
            if (!log.date) return false; 
            return log.date >= startDate && log.date <= endDate;
        });
    }

    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`(${dateText})`, 70, yPos);
    yPos += 5;

    const logRows = filteredLogs.map(log => {
        let pdfDate = '-';
        if(log.date) {
            const parts = log.date.split('-');
            pdfDate = `${parts[2]}-${parts[1]}-${parts[0]}`;
        }
        return [
            pdfDate,
            log.time,
            log.product,
            log.type,
            log.qty,
            log.notes || '-'
        ];
    });

    if (logRows.length === 0) {
        doc.setFontSize(10);
        doc.text("No records found for selected dates.", 14, yPos + 10);
    } else {
        doc.autoTable({
            startY: yPos,
            head: [['Date', 'Time', 'Product', 'Type', 'Qty', 'Note']],
            body: logRows,
            theme: 'striped',
            headStyles: { fillColor: [22, 163, 74] },
            styles: { fontSize: 8, cellPadding: 2 },
            columnStyles: {
                0: { cellWidth: 25 },
                1: { cellWidth: 20 },
                5: { cellWidth: 'auto' }
            }
        });
    }

    doc.save(`Anadi_Report_${new Date().toISOString().slice(0,10)}.pdf`);
};
// --- LOGO PARTICLE EFFECT FUNCTION ---
function startMagicLogoEffect() {
    // 1. Login Screen wala Logo dhundhein
    const logoImg = document.querySelector('#login-screen img');
    
    if (!logoImg) return; // Agar logo nahi mila to ruk jao

    // Gaushala Theme Icons
    const particles = ['🥛', '🌿', '✨', '🌸', '🐄']; 

    setInterval(() => {
        // Agar login screen hidden hai to animation mat chalao
        if(document.getElementById('login-screen').classList.contains('hidden')) return;

        // 2. Logo ki position pata karein
        const rect = logoImg.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;

        // 3. Naya Element banayein
        const el = document.createElement('div');
        el.innerText = particles[Math.floor(Math.random() * particles.length)];
        
        // CSS Styles
        el.style.position = 'fixed';
        el.style.left = centerX + 'px';
        el.style.top = centerY + 'px';
        el.style.fontSize = '20px';
        el.style.pointerEvents = 'none'; // Click block na kare
        el.style.zIndex = '50';
        el.style.transition = 'all 1.5s ease-out';
        el.style.opacity = '1';
        el.style.transform = 'translate(-50%, -50%) scale(0.5)';

        document.body.appendChild(el);

        // 4. Animation Calculate karein (Random Direction)
        // Random angle (0 to 360 degree)
        const angle = Math.random() * 360; 
        // Random distance (50px to 150px door)
        const velocity = 50 + Math.random() * 100; 

        const moveX = Math.cos(angle * (Math.PI / 180)) * velocity;
        const moveY = Math.sin(angle * (Math.PI / 180)) * velocity;

        // 5. Thoda ruk kar animate karein (taaki browser render kar le)
        requestAnimationFrame(() => {
            el.style.transform = `translate(calc(-50% + ${moveX}px), calc(-50% + ${moveY}px)) scale(1.5) rotate(${Math.random()*360}deg)`;
            el.style.opacity = '0'; // Dheere dheere gayab
        });

        // 6. Safai Abhiyan (Remove element after animation)
        setTimeout(() => {
            el.remove();
        }, 1500);

    }, 300); // Har 300ms (0.3 second) me ek naya item niklega
}

// --- MANUAL ENTRY LOGIC ---
window.handleManualCode = function() {
    const code = document.getElementById('manual-code').value.trim().toUpperCase();
    
    if(!code) return alert("Please enter a Product ID or Batch Number!");

    // --- CHANGE 1: Use 'getAllProducts' instead of hardcoded CATALOG ---
    // Ye function DB aur Old Catalog dono se data lata hai
    const allItems = getAllProducts(); 
    
    let foundId = null;
    let foundBatch = null;

    // 1. Direct ID Check (Example: ED-MILK)
    const exactIdMatch = allItems.find(item => item.id === code);
    
    if (exactIdMatch) {
        foundId = exactIdMatch.id;
    } 
    else {
        // 2. Batch Number Check logic
        const batchMatch = allItems.find(item => {
            // Humne Batch kaise banaya tha? -> Name ke first 4 letters se.
            // Wahi logic wapas lagayenge check karne ke liye.
            
            const cleanName = item.name.replace(/[^a-zA-Z]/g, '').toUpperCase();
            const prefix = cleanName.substring(0, 4); // First 4 letters e.g. MILK
            
            // Check: Kya Input code iss prefix se start hota hai?
            // E.g. Input: MILK84920 -> Starts with MILK? -> Yes
            if(code.startsWith(prefix)) return true;

            // Extra Check: Agar ID se match kare (e.g. ED-MILK -> MILK)
            const idPart = item.id.split('-')[1]; // ED-MILK -> MILK
            if(idPart && code.startsWith(idPart)) return true;

            return false;
        });

        if (batchMatch) {
            foundId = batchMatch.id;
            foundBatch = code;
        }
    }

    // 3. Result
    if (foundId) {
        stopScanner();
        // Manual entry hai, isliye VIP false maan rahe hain (ya DB se fetch kar sakte hain future me)
        showScanResult(foundId, foundBatch, false, 0); 
        document.getElementById('manual-code').value = '';
    } else {
        console.log("Searched inside:", allItems.map(i => i.name)); // Debugging ke liye console dekhein
        alert("Product NOT found! \nTip: Ensure the Product Name matches the Batch prefix.");
    }
};
// --- DATE HELPERS ---

// Page load hone par MFG date ko 'Today' set karein
function setDefaultDate() {
    const today = new Date().toISOString().split('T')[0];
    const mfgInput = document.getElementById('in-mfg');
    if(mfgInput) mfgInput.value = today;
}

// Expiry Checkbox ka logic
window.toggleExpiryInput = function() {
    const checkbox = document.getElementById('in-has-exp');
    const input = document.getElementById('in-exp');
    
    if(checkbox.checked) {
        input.disabled = false;
        input.classList.remove('bg-slate-200', 'text-slate-400');
        input.classList.add('bg-slate-50', 'text-slate-800');
    } else {
        input.disabled = true;
        input.value = ''; // Reset date
        input.classList.add('bg-slate-200', 'text-slate-400');
        input.classList.remove('bg-slate-50', 'text-slate-800');
    }
};

// App start hone par date set karein
document.addEventListener('DOMContentLoaded', () => {
    setDefaultDate(); 
    // ... baaki existing code ...
});
function continueScanning() {
    document.getElementById('scan-result-active').classList.add('hidden');
    document.getElementById('scan-result-placeholder').classList.remove('hidden');
    
    // Clear Inputs
    document.getElementById('res-qty-input').value = '';
    
    // --- NEW: Clear Customer Inputs ---
    document.getElementById('res-cust-name').value = '';
    document.getElementById('res-cust-phone').value = '';
    document.getElementById('res-cust-addr').value = '';
    // ----------------------------------

    if(html5QrcodeScanner) {
        try { html5QrcodeScanner.resume(); } catch(e) { startScanner(); }
    }
}
// --- PRODUCT MANAGEMENT ---

window.renderProductList = function() {
    const tbody = document.getElementById('product-list-body');
    if(!tbody) return;
    tbody.innerHTML = '';

    const all = getAllProducts();

    all.forEach(item => {
        const catLabel = item.id.startsWith('ED') ? 'Edible' : 'By-Prod';
        const catColor = item.id.startsWith('ED') ? 'bg-green-100 text-green-700' : 'bg-purple-100 text-purple-700';

        tbody.innerHTML += `
            <tr>
                <td class="p-3 font-bold text-slate-700">
                    ${item.name} <br>
                    <span class="text-[10px] text-slate-400 font-mono">${item.id}</span>
                </td>
                <td class="p-3">
                    <span class="text-[10px] uppercase font-bold px-2 py-1 rounded ${catColor}">${catLabel}</span>
                    <span class="text-xs text-slate-500 ml-1 bg-slate-100 px-2 py-1 rounded">Unit: ${item.unit}</span>
                </td>
                <td class="p-3 text-right">
                    <button onclick="handleDeleteProduct('${item.id}', '${catLabel}')" class="text-red-500 hover:bg-red-50 p-2 rounded transition">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </td>
            </tr>
        `;
    });
};

window.handleAddNewProduct = function() {
    const name = document.getElementById('new-prod-name').value.trim();
    const cat = document.getElementById('new-prod-cat').value; // edible/byprod
    const unit = document.getElementById('new-prod-unit').value;

    if(!name) return alert("Enter Product Name");

    // Generate ID: ED-NAME or BY-NAME (Random number to prevent duplicates)
    const prefix = cat === 'edible' ? 'ED' : 'BY';
    const cleanName = name.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().substring(0, 5);
    const uniqueId = `${prefix}-${cleanName}-${Math.floor(Math.random()*1000)}`;

    const newItem = { id: uniqueId, name: name, unit: unit };

    if(!appState.products[cat]) appState.products[cat] = [];
    appState.products[cat].push(newItem);
    
    // Initialize stock for new item
    if(!appState.stock) appState.stock = {};
    appState.stock[uniqueId] = 0;

    saveDataToFirebase();
    alert("Product Added!");
    
    // Reset Form
    document.getElementById('new-prod-name').value = '';
    renderProductList();
};

window.handleDeleteProduct = function(id, typeLabel) {
    if(!confirm("Delete this product? Scan history will remain, but you can't add new stock.")) return;

    // Determine category key based on label or ID
    const catKey = id.startsWith('ED') ? 'edible' : 'byprod';
    
    // Remove from array
    appState.products[catKey] = appState.products[catKey].filter(item => item.id !== id);
    
    // Optional: Delete stock entry too? usually safer to keep stock as 0
    // delete appState.stock[id]; 

    saveDataToFirebase();
    renderProductList();
};
window.deleteLogEntry = function(logId) {
    // Debugging ke liye
    console.log("Deleting Log ID:", logId);

    if(!logId || logId === 'undefined') {
        alert("Error: This log cannot be deleted properly. Please Refresh the page and try again.");
        return;
    }

    if(!confirm("Are you sure you want to delete this record permanently?")) return;
    
    // Purana count
    const oldLength = appState.logs.length;

    // Filter logic
    appState.logs = appState.logs.filter(log => log.logId !== logId);
    
    // Check agar delete hua ya nahi
    if(appState.logs.length === oldLength) {
        alert("Delete Failed! Log ID mismatch.");
    } else {
        saveDataToFirebase();
        renderLogs();
        
        // Optional: Delete hone par sound/toast
        if ('speechSynthesis' in window) {
            const msg = new SpeechSynthesisUtterance("Deleted");
            msg.rate = 1.5;
            window.speechSynthesis.speak(msg);
        }
    }
};
// --- TOGGLE LOG DETAILS ---
// --- SMOOTH TOGGLE LOG DETAILS ---
window.toggleLogDetails = function(id, btn) {
    const el = document.getElementById(id);
    const icon = btn.querySelector('i');
    
    // Check if class 'open' exists
    if (el.classList.contains('open')) {
        // CLOSE KARO
        el.classList.remove('open');
        btn.innerHTML = 'View Order Details <i class="fa-solid fa-chevron-down ml-1 transition-transform duration-300"></i>';
        btn.classList.remove('text-slate-700');
        btn.classList.add('text-blue-500');
    } else {
        // OPEN KARO
        el.classList.add('open');
        btn.innerHTML = 'Hide Details <i class="fa-solid fa-chevron-up ml-1 transition-transform duration-300"></i>';
        btn.classList.add('text-slate-700');
        btn.classList.remove('text-blue-500');
    }
};
window.printLabel = function() {
    // 1. Content nikalo
    const printArea = document.getElementById('print-area');
    if(!printArea) return alert("Label not generated yet!");

    // Clone content to avoid messing up UI
    const content = printArea.innerHTML;

    // 2. Nayi Window kholo (Standard Method)
    const win = window.open('', '', 'height=600,width=500');
    
    if (win) {
        // Agar popup khul gaya
        win.document.write('<html><head><title>Print Label</title>');
        // Tailwind CDN taaki style same rahe
        win.document.write('<script src="https://cdn.tailwindcss.com"></script>'); 
        win.document.write('<style>@page { size: 4in 6in; margin: 0; } body { margin: 0; display: flex; align-items: center; justify-content: center; height: 100vh; }</style>');
        win.document.write('</head><body>');
        
        // Content Wrapper
        win.document.write('<div style="width: 350px; text-align: center; border: 2px solid #000; padding: 10px; border-radius: 10px;">');
        win.document.write(content);
        win.document.write('</div>');
        
        win.document.write('</body></html>');
        win.document.close();
        
        // Thoda wait karo taaki styles load ho jayein
        setTimeout(() => {
            win.print();
            win.close(); // Print ke baad band kar do
        }, 500);
    } else {
        // 3. Fallback (Agar Popup Blocked hai)
        alert("Pop-up blocked! Please allow pop-ups for printing.");
    }
};
// --- CUSTOMER / ACCOUNT MODAL LOGIC ---

// --- MODAL & WHATSAPP LOGIC (COMPLETE) ---

// 1. Open Modal (Slide Up Animation)
window.openCustomerModal = function() {
    const modal = document.getElementById('customer-modal');
    if(!modal) return;
    
    // Reset classes for animation
    modal.classList.remove('hidden');
    
    // Allow browser to render 'hidden' removal before animating translate
    setTimeout(() => {
        modal.classList.remove('closed');
        modal.classList.add('open');
    }, 10);

    // Default load Orders Tab
    switchModalTab('tab-orders');
};

// 2. Close Modal (Slide Down Animation)
window.closeCustomerModal = function() {
    const modal = document.getElementById('customer-modal');
    modal.classList.remove('open');
    modal.classList.add('closed');
    
    // Wait for animation to finish before hiding
    setTimeout(() => {
        modal.classList.add('hidden');
    }, 300);
};

// 3. Switch Tabs inside Modal (Orders vs Billing)
window.switchModalTab = function(tabId) {
    // Hide all contents
    document.querySelectorAll('.tab-pane').forEach(el => el.classList.add('hidden'));
    document.getElementById(tabId).classList.remove('hidden');

    // Update Buttons Styles
    const btnOrders = document.getElementById('btn-tab-orders');
    const btnUsers = document.getElementById('btn-tab-users');

    if(tabId === 'tab-orders') {
        renderOrderDispatchTab();
        btnOrders.className = "flex-1 py-4 text-sm font-bold uppercase text-center border-b-4 border-brand text-brand transition";
        btnUsers.className = "flex-1 py-4 text-sm font-bold uppercase text-center border-b-4 border-transparent text-slate-400 hover:text-slate-600 transition";
    } else {
        renderUserBillingTab();
        btnUsers.className = "flex-1 py-4 text-sm font-bold uppercase text-center border-b-4 border-blue-500 text-blue-600 transition";
        btnOrders.className = "flex-1 py-4 text-sm font-bold uppercase text-center border-b-4 border-transparent text-slate-400 hover:text-slate-600 transition";
    }
};

// --- TAB 1: ORDERS (WITH DISPATCH TOGGLE) ---
function renderOrderDispatchTab() {
    const container = document.getElementById('tab-orders');
    container.innerHTML = '';

    // Get Logs containing Customer Data (Only 'Dispatch' type)
    const orders = (appState.logs || []).filter(log => {
        if(log.type !== 'Dispatch') return false;
        try {
            const n = JSON.parse(log.notes);
            return n.customer && n.customer.name;
        } catch(e) { return false; }
    });

    if(orders.length === 0) {
        container.innerHTML = `<div class="text-center text-slate-400 mt-10">No recent orders found.</div>`;
        return;
    }

    orders.forEach(log => {
        const note = JSON.parse(log.notes);
        const cust = note.customer;
        // Unique ID for toggle button
        const toggleId = `toggle_${log.logId}`;
        
        // Render HTML Card with Toggle
        container.innerHTML += `
            <div class="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex items-center justify-between">
                <div>
                    <h4 class="font-bold text-slate-800">${cust.name}</h4>
                    <p class="text-xs text-slate-500 font-mono">${log.product} (Qty: ${log.qty})</p>
                    <p class="text-[10px] text-slate-400 mt-1">${log.date} at ${log.time}</p>
                </div>

                <!-- DISPATCH TOGGLE BUTTON -->
                <div class="flex flex-col items-center gap-1">
                    <label for="${toggleId}" class="flex items-center cursor-pointer relative">
                        <input type="checkbox" id="${toggleId}" class="sr-only" onchange="handleDispatchNotify(this, '${cust.phone}', '${cust.name}', '${log.product}', '${log.qty}')">
                        <div class="w-11 h-6 bg-slate-200 rounded-full border border-slate-300 toggle-label transition-colors duration-300"></div>
                        <div class="dot absolute left-1 top-1 w-4 h-4 bg-white rounded-full transition transform duration-300"></div>
                    </label>
                    <span class="text-[9px] font-bold text-slate-400 uppercase tracking-wide">Dispatch</span>
                </div>
            </div>
            <style>
                #${toggleId}:checked ~ .toggle-label { background-color: #10b981; border-color: #10b981; }
                #${toggleId}:checked ~ .dot { transform: translateX(100%); }
            </style>
        `;
    });
}

// Logic: Send Dispatch Notification on WhatsApp
window.handleDispatchNotify = function(checkbox, phone, name, product, qty) {
    if(checkbox.checked) {
        // WhatsApp Message Format
        const msg = `Namaste ${name}, \n\nYour order for *${product}* (Qty: ${Math.abs(qty)}) has been *DISPATCHED* from Anadi Godham. \n\nThank you for choosing purity! 🌿`;
        
        // Open WhatsApp API
        const url = `https://wa.me/91${cleanPhone(phone)}?text=${encodeURIComponent(msg)}`;
        window.open(url, '_blank');
    }
};

// --- TAB 2: ALL USERS (BILL GENERATION) ---
// --- MODAL, SEARCH & WHATSAPP LOGIC (FINAL & SINGLE VERSION) ---

// 1. Open Modal
window.openCustomerModal = function() {
    const modal = document.getElementById('customer-modal');
    if(!modal) return;
    
    // Clear search on open
    const searchInput = document.getElementById('modal-search-input');
    if(searchInput) searchInput.value = '';

    modal.classList.remove('hidden');
    setTimeout(() => {
        modal.classList.remove('closed');
        modal.classList.add('open');
    }, 10);

    switchModalTab('tab-orders');
};

// 2. Close Modal
window.closeCustomerModal = function() {
    const modal = document.getElementById('customer-modal');
    modal.classList.remove('open');
    modal.classList.add('closed');
    setTimeout(() => {
        modal.classList.add('hidden');
    }, 300);
};

// 3. Switch Tabs (Updated to keep Search active)
window.switchModalTab = function(tabId) {
    document.querySelectorAll('.tab-pane').forEach(el => el.classList.add('hidden'));
    document.getElementById(tabId).classList.remove('hidden');

    // Update Buttons
    const btnOrders = document.getElementById('btn-tab-orders');
    const btnUsers = document.getElementById('btn-tab-users');
    
    // Get current search query to maintain filtering when switching tabs
    const searchInput = document.getElementById('modal-search-input');
    const currentQuery = searchInput ? searchInput.value.trim().toLowerCase() : '';

    if(tabId === 'tab-orders') {
        if(typeof renderOrderDispatchTab === 'function') renderOrderDispatchTab(currentQuery);
        if(btnOrders) btnOrders.className = "flex-1 py-4 text-sm font-bold uppercase text-center border-b-4 border-brand text-brand transition";
        if(btnUsers) btnUsers.className = "flex-1 py-4 text-sm font-bold uppercase text-center border-b-4 border-transparent text-slate-400 hover:text-slate-600 transition";
    } else {
        if(typeof renderUserBillingTab === 'function') renderUserBillingTab(currentQuery);
        if(btnUsers) btnUsers.className = "flex-1 py-4 text-sm font-bold uppercase text-center border-b-4 border-blue-500 text-blue-600 transition";
        if(btnOrders) btnOrders.className = "flex-1 py-4 text-sm font-bold uppercase text-center border-b-4 border-transparent text-slate-400 hover:text-slate-600 transition";
    }
};

// 4. SEARCH HANDLER
window.handleModalSearch = function() {
    const query = document.getElementById('modal-search-input').value.trim().toLowerCase();
    
    // Check which tab is active
    if(!document.getElementById('tab-orders').classList.contains('hidden')) {
        renderOrderDispatchTab(query);
    } else {
        renderUserBillingTab(query);
    }
};

// --- TAB 1: ORDERS RENDER (With Search) ---
window.renderOrderDispatchTab = function(searchQuery = '') {
    const container = document.getElementById('tab-orders');
    if(!container) return;
    container.innerHTML = '';

    const orders = (appState.logs || []).filter(log => {
        if(log.type !== 'Dispatch') return false;
        try {
            const n = JSON.parse(log.notes);
            if(!n.customer || !n.customer.name) return false;

            // Search Filter
            const name = n.customer.name.toLowerCase();
            const phone = (n.customer.phone || '').toString();
            return name.includes(searchQuery) || phone.includes(searchQuery);

        } catch(e) { return false; }
    });

    if(orders.length === 0) {
        container.innerHTML = `<div class="text-center text-slate-400 mt-10">
            ${searchQuery ? 'No matching orders found.' : 'No recent orders found.'}
        </div>`;
        return;
    }

    orders.forEach(log => {
        const note = JSON.parse(log.notes);
        const cust = note.customer;
        const toggleId = `toggle_${log.logId}`;
        
        container.innerHTML += `
            <div class="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex items-center justify-between animate-fade-in">
                <div>
                    <h4 class="font-bold text-slate-800 text-lg">${highlightMatch(cust.name, searchQuery)}</h4>
                    <p class="text-xs text-slate-500 font-mono">${log.product} (Qty: ${log.qty})</p>
                    <p class="text-[10px] text-slate-400 mt-1">
                        <i class="fa-solid fa-phone mr-1"></i>${highlightMatch(cust.phone, searchQuery)}
                    </p>
                </div>

                <div class="flex flex-col items-center gap-1">
                    <label for="${toggleId}" class="flex items-center cursor-pointer relative">
                        <input type="checkbox" id="${toggleId}" class="sr-only" onchange="handleDispatchNotify(this, '${cust.phone}', '${cust.name}', '${log.product}', '${log.qty}')">
                        <div class="w-11 h-6 bg-slate-200 rounded-full border border-slate-300 toggle-label transition-colors duration-300"></div>
                        <div class="dot absolute left-1 top-1 w-4 h-4 bg-white rounded-full transition transform duration-300"></div>
                    </label>
                    <span class="text-[9px] font-bold text-slate-400 uppercase tracking-wide">Dispatch</span>
                </div>
            </div>
            <style>
                #${toggleId}:checked ~ .toggle-label { background-color: #10b981; border-color: #10b981; }
                #${toggleId}:checked ~ .dot { transform: translateX(100%); }
                .highlight-text { background-color: #fde047; color: black; padding: 0 2px; border-radius: 2px; }
                @keyframes fadeIn { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: translateY(0); } }
                .animate-fade-in { animation: fadeIn 0.3s ease-out; }
            </style>
        `;
    });
};

// Logic: Send Dispatch Notification
window.handleDispatchNotify = function(checkbox, phone, name, product, qty) {
    if(checkbox.checked) {
        const msg = `Namaste ${name}, \n\nYour order for *${product}* (Qty: ${Math.abs(qty)}) has been *DISPATCHED* from Anadi Godham. \n\nThank you for choosing purity! 🌿`;
        const url = `https://wa.me/91${cleanPhone(phone)}?text=${encodeURIComponent(msg)}`;
        window.open(url, '_blank');
    }
};

// --- TAB 2: USERS BILLING RENDER (With Search) ---
window.renderUserBillingTab = function(searchQuery = '') {
    const container = document.getElementById('tab-users');
    if(!container) return;
    container.innerHTML = '';

    const userMap = {};

    // 1. Aggregate Data
    (appState.logs || []).forEach(log => {
        if(log.type !== 'Dispatch') return;
        try {
            const note = JSON.parse(log.notes);
            if(!note.customer || !note.customer.phone) return;

            const phone = note.customer.phone;
            
            if(!userMap[phone]) {
                userMap[phone] = {
                    name: note.customer.name,
                    phone: phone,
                    orders: [],
                    totalAmount: 0
                };
            }

            const products = getAllProducts();
            const prodDetails = products.find(p => p.name === log.product);
            const price = prodDetails ? (prodDetails.lastPrice || 0) : 0;
            const qty = Math.abs(log.qty);
            const cost = price * qty;

            userMap[phone].totalAmount += cost;
            userMap[phone].orders.push({
                item: log.product,
                qty: qty,
                cost: cost,
                date: log.date
            });

        } catch(e) {}
    });

    // 2. Filter Logic
    const users = Object.values(userMap).filter(u => {
        const name = u.name.toLowerCase();
        const phone = u.phone.toString();
        return name.includes(searchQuery) || phone.includes(searchQuery);
    });

    if(users.length === 0) {
        container.innerHTML = `<div class="text-center text-slate-400 mt-10">
            ${searchQuery ? 'No customer found with that name/phone.' : 'No customer history found.'}
        </div>`;
        return;
    }

    // 3. Render filtered users
    users.forEach(u => {
        container.innerHTML += `
            <div class="bg-white p-4 rounded-xl shadow-sm border border-slate-200 cursor-pointer hover:bg-slate-50 transition animate-fade-in" onclick="generateAndSendBill('${u.phone}', '${u.name}')">
                <div class="flex justify-between items-center mb-2">
                    <div class="flex items-center gap-3">
                        <div class="w-10 h-10 rounded-full bg-blue-50 text-blue-600 font-bold flex items-center justify-center text-lg shrink-0">
                            ${u.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                            <h4 class="font-bold text-slate-800 text-lg">${highlightMatch(u.name, searchQuery)}</h4>
                            <span class="text-xs text-slate-500 font-mono">
                                <i class="fa-solid fa-phone text-[10px] mr-1"></i>${highlightMatch(u.phone, searchQuery)}
                            </span>
                        </div>
                    </div>
                    <div class="text-right">
                        <span class="block text-xs text-slate-400 uppercase font-bold">Total Bill</span>
                        <span class="text-xl font-bold text-red-600">₹${u.totalAmount.toLocaleString('en-IN')}</span>
                    </div>
                </div>
                
                <button class="w-full mt-2 bg-green-50 text-green-700 py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-2 hover:bg-green-100 transition">
                    <i class="fa-brands fa-whatsapp text-lg"></i> Send Bill on WhatsApp
                </button>
            </div>
        `;
    });
};

// Logic: Generate Full Bill Text & Send via WhatsApp
window.generateAndSendBill = function(phone, name) {
    let billMsg = `*BILL INVOICE - Anadi Godham* 🌿\n\n`;
    billMsg += `Customer: *${name}*\n`;
    billMsg += `-----------------------------\n`;
    
    let total = 0;
    
    (appState.logs || []).forEach(log => {
        if(log.type !== 'Dispatch') return;
        try {
            const note = JSON.parse(log.notes);
            if(note.customer && note.customer.phone === phone) {
                const products = getAllProducts();
                const prodDetails = products.find(p => p.name === log.product);
                const price = prodDetails ? (prodDetails.lastPrice || 0) : 0;
                const qty = Math.abs(log.qty);
                const cost = price * qty;
                
                total += cost;
                billMsg += `${log.date}: ${log.product} x${qty} = ₹${cost}\n`;
            }
        } catch(e){}
    });

    billMsg += `-----------------------------\n`;
    billMsg += `*TOTAL AMOUNT: ₹${total.toLocaleString('en-IN')}*\n`;
    billMsg += `-----------------------------\n\n`;
    billMsg += `Please pay on this number:\n*9810017422* (Online/UPI)\n\n`;
    billMsg += `Kindly share the payment screenshot here. Thanks! 🙏`;

    const url = `https://wa.me/91${cleanPhone(phone)}?text=${encodeURIComponent(billMsg)}`;
    window.open(url, '_blank');
};

// Helper: Clean Phone Number
window.cleanPhone = function(p) {
    if(!p) return '';
    return p.replace(/[^0-9]/g, '').slice(-10); 
};

// Helper: Highlight Search Text
window.highlightMatch = function(text, query) {
    if(!query || !text) return text;
    const regex = new RegExp(`(${query})`, 'gi');
    return text.toString().replace(regex, '<span class="highlight-text">$1</span>');
};
