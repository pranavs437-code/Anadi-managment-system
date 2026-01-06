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
        { id: 'ED-MILK', name: 'Raw Milk', unit: 'L' },
        { id: 'ED-CURD', name: 'Fresh Curd', unit: 'Kg' },
        { id: 'ED-BUTTERMILK', name: 'Buttermilk', unit: 'L' },
        { id: 'ED-W-BUTTER', name: 'White Butter', unit: 'Kg' },
        { id: 'ED-PANEER', name: 'Paneer', unit: 'Kg' },
        { id: 'ED-GHEE', name: 'Desi Ghee', unit: 'Kg' }
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
            initStockObject(); 
        } else {
            initStockObject();
            saveDataToFirebase();
        }

        renderInventory();
        renderLogs();
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
    const cat = document.getElementById('in-cat').value;
    const select = document.getElementById('in-product');
    select.innerHTML = '';

    const items = cat === 'edible' ? CATALOG.edible : CATALOG.byprod;
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
    const price = parseFloat(document.getElementById('in-price').value) || 0;

    if(!qty || qty <= 0) return alert("Please enter valid quantity");

    if(!appState.stock[pId]) appState.stock[pId] = 0;
    appState.stock[pId] += qty;
    
    const pName = getProductName(pId);
    const totalVal = qty * price;
    const note = price > 0 ? `Purchase (₹${totalVal})` : 'Stock Update';
    
    addLog('Stock In', pName, `+${qty}`, note);
    saveDataToFirebase();
    generateLabel(pId, pName, qty);
    
    document.getElementById('in-qty').value = '';
    document.getElementById('in-price').value = '';
    document.getElementById('in-total-display').innerText = '₹ 0';
};

window.printLabel = function() {
    const content = document.getElementById('print-area').innerHTML;
    const win = window.open('', '', 'height=500,width=500');
    win.document.write('<html><head><title>Print Label</title>');
    win.document.write('<link href="https://cdn.tailwindcss.com" rel="stylesheet">'); 
    win.document.write('</head><body class="flex items-center justify-center h-screen">');
    win.document.write('<div class="border-2 border-black p-4 rounded text-center w-64">');
    win.document.write(content);
    win.document.write('</div></body></html>');
    win.document.close();
    win.print();
};

window.startScanner = function() {
    document.getElementById('scan-result-placeholder').classList.add('hidden');
    const statusEl = document.getElementById('scanner-status');
    
    html5QrcodeScanner = new Html5Qrcode("reader");
    const config = { fps: 10, qrbox: { width: 250, height: 250 }, aspectRatio: 1.0 };

    html5QrcodeScanner.start(
        { facingMode: "environment" }, 
        config,
        onScanSuccess,
        onScanFailure
    ).then(() => {
        statusEl.innerText = "On";
        statusEl.classList.remove('bg-red-500/80');
        statusEl.classList.add('bg-green-500/80');
    }).catch(err => {
        console.error(err);
        alert("Camera Error: Check permissions or use HTTPS.");
    });
};

window.stopScanner = function() {
    if(html5QrcodeScanner) {
        html5QrcodeScanner.stop().then(() => {
            html5QrcodeScanner.clear();
            html5QrcodeScanner = null;
            resetScannerUI();
            const statusEl = document.getElementById('scanner-status');
            if(statusEl) {
                statusEl.innerText = "Off";
                statusEl.classList.add('bg-red-500/80');
                statusEl.classList.remove('bg-green-500/80');
            }
        }).catch(err => console.log(err));
    }
};

window.processDispatch = function() {
    const input = document.getElementById('res-qty-input');
    const id = input.dataset.id;
    const qtyToRemove = parseFloat(input.value);
    const currentStock = appState.stock[id] || 0;

    if(!qtyToRemove || qtyToRemove <= 0) return alert("Invalid Qty");
    if(qtyToRemove > currentStock) return alert(`Low Stock! Max: ${currentStock}`);

    appState.stock[id] -= qtyToRemove;
    addLog('Dispatch', getProductName(id), `-${qtyToRemove}`, 'Sale');
    saveDataToFirebase();
    
    alert("Dispatched Successfully!");
    resetScannerUI();
};

window.clearSystem = function() {
    if(confirm("Delete ALL data from Cloud?")) {
        set(ref(db, DB_PATH), { stock: {}, logs: [] })
          .then(() => location.reload());
    }
};

// --- RENDER & HELPER FUNCTIONS ---

function renderInventory() {
    let totalItems = 0;
    let edibleVal = 0;
    let byprodVal = 0;

    const createRow = (item, qty) => {
        let colorClass = 'bg-green-100 text-green-700';
        let statusText = 'In Stock';
        if(qty === 0) { colorClass = 'bg-red-100 text-red-700'; statusText = 'Out'; }
        else if(qty < 10) { colorClass = 'bg-yellow-100 text-yellow-700'; statusText = 'Low'; }

        return `
            <div class="p-4 flex flex-row items-center justify-between md:grid md:grid-cols-4 md:gap-4 hover:bg-slate-50 transition">
                <div class="flex flex-col md:block">
                    <span class="font-bold text-slate-700">${item.name}</span>
                    <span class="text-xs text-slate-400 md:hidden">${item.id}</span>
                </div>
                <div class="text-sm text-slate-500 hidden md:block">${item.unit}</div>
                <div class="flex items-center gap-2">
                    <span class="text-xs text-slate-400 md:hidden">Qty:</span>
                    <span class="font-bold text-lg md:text-base text-slate-800">${qty} <span class="text-xs font-normal md:hidden">${item.unit}</span></span>
                </div>
                <div class="text-right md:text-left">
                    <span class="px-2 py-1 rounded text-[10px] md:text-xs font-bold uppercase ${colorClass}">${statusText}</span>
                </div>
            </div>
        `;
    };

    const edibleBody = document.getElementById('table-edible');
    if(edibleBody) {
        edibleBody.innerHTML = '';
        CATALOG.edible.forEach(item => {
            const qty = appState.stock[item.id] || 0;
            totalItems += qty;
            edibleVal += qty * 50; 
            edibleBody.innerHTML += createRow(item, qty);
        });
    }

    const byprodBody = document.getElementById('table-byprod');
    if(byprodBody) {
        byprodBody.innerHTML = '';
        CATALOG.byprod.forEach(item => {
            const qty = appState.stock[item.id] || 0;
            totalItems += qty;
            byprodVal += qty * 100;
            byprodBody.innerHTML += createRow(item, qty);
        });
    }

    const tItems = document.getElementById('stat-total-items');
    if(tItems) tItems.innerText = totalItems;
    const tEdible = document.getElementById('stat-edible-val');
    if(tEdible) tEdible.innerText = edibleVal.toLocaleString('en-IN');
    const tByprod = document.getElementById('stat-byprod-val');
    if(tByprod) tByprod.innerText = byprodVal.toLocaleString('en-IN');
}

function getProductName(id) {
    const all = [...CATALOG.edible, ...CATALOG.byprod];
    const found = all.find(x => x.id === id);
    return found ? found.name : 'Unknown';
}

function generateLabel(id, name, qty) {
    const qrData = JSON.stringify({ id: id, type: 'gau-erp-item' });
    const target = document.getElementById('lbl-qr-target');
    target.innerHTML = ''; 

    new QRCode(target, {
        text: qrData,
        width: 128,
        height: 128,
        colorDark : "#000000",
        colorLight : "#ffffff",
        correctLevel : QRCode.CorrectLevel.H
    });

    document.getElementById('lbl-name').innerText = name;
    document.getElementById('lbl-id').innerText = id;
    document.getElementById('lbl-qty').innerText = 'Qty: ' + qty;

    document.getElementById('qr-container').classList.add('hidden');
    document.getElementById('print-area').classList.remove('hidden');
    document.getElementById('printBtn').classList.remove('hidden');
}

function onScanSuccess(decodedText, decodedResult) {
    if(!document.getElementById('scan-result-active').classList.contains('hidden')) return;
    try {
        const data = JSON.parse(decodedText);
        if(data.type === 'gau-erp-item' && data.id) {
            speakSuccess(); 
            showScanResult(data.id);
        }
    } catch (e) { }
}

function onScanFailure(error) {}

function showScanResult(id) {
    const pName = getProductName(id);
    const currentStock = appState.stock[id] || 0;
    
    document.getElementById('scan-result-active').classList.remove('hidden');
    document.getElementById('res-name').innerText = pName;
    document.getElementById('res-stock').innerText = currentStock;
    document.getElementById('res-type').innerText = id.startsWith('ED') ? 'Edible' : 'By-Prod';
    
    const input = document.getElementById('res-qty-input');
    input.dataset.id = id;
    input.value = 1;
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
    (appState.logs || []).slice(0, 20).forEach(log => {
        const typeColor = log.type === 'Stock In' ? 'text-green-600' : 'text-red-600';
        
        let displayDate = '';
        if(log.date) {
            const parts = log.date.split('-');
            displayDate = `${parts[2]}-${parts[1]}-${parts[0]}`;
        } else {
            displayDate = 'Old Data';
        }

        tbody.innerHTML += `
            <tr class="border-b border-slate-50 hover:bg-slate-50 transition">
                <td class="p-3">
                    <div class="font-bold text-slate-700">${log.product}</div>
                    <div class="text-xs text-slate-500 mt-1">
                        <span class="bg-slate-100 px-1 rounded border border-slate-200 font-mono text-slate-600">📅 ${displayDate}</span>
                        <span class="mx-1">|</span> 
                        <span>⏰ ${log.time}</span>
                    </div>
                    <div class="text-xs mt-1">
                        <span class="${typeColor} font-bold uppercase tracking-wide" style="font-size: 0.65rem;">${log.type}</span>
                    </div>
                </td>
                <td class="p-3 text-right align-top">
                    <span class="font-mono font-bold text-lg text-slate-800">${log.qty}</span>
                </td>
            </tr>
        `;
    });
}

function speakSuccess() {
    if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const msg = new SpeechSynthesisUtterance();
        msg.text = "QR Scanning Complete"; 
        msg.volume = 1; 
        msg.rate = 1;   
        msg.pitch = 1;  
        msg.lang = 'en-IN'; 
        window.speechSynthesis.speak(msg);
    }
}

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