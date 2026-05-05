import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, push, set, onValue, remove, update, off, get } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
const firebaseConfig = {
    apiKey: "AIzaSyDR1rzGFqynhkan3zGChtjmZv1s0JJ73Ls",
    authDomain: "newbillingtry.firebaseapp.com",
    databaseURL: "https://newbillingtry-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "newbillingtry",
    storageBucket: "newbillingtry.firebasestorage.app",
    messagingSenderId: "399103082623",
    appId: "1:399103082623:web:225ba06a04c04ed3957f4a",
    measurementId: "G-4MDEEBR10F"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const State = { products: {}, users: {}, cart: [], currentUser: null, fp: null };

// --- UI UTILS ---
window.toggleSidebar = () => {
    document.getElementById('sidebar').classList.toggle('-translate-x-full');
    document.getElementById('sidebar-backdrop').classList.toggle('hidden');
};

window.Toast = (msg, type = 'success') => {
    const container = document.getElementById('toast-container');
    if (!container) return; // Safety check

    const el = document.createElement('div');
    el.className = `p-4 rounded-xl shadow-lg border-l-4 bg-white animate-bounce flex items-center gap-2 ${type === 'error' ? 'border-red-500 text-red-600' : 'border-emerald-500 text-slate-800'}`;
    el.innerHTML = `<i class="fa-solid ${type === 'error' ? 'fa-circle-exclamation' : 'fa-circle-check'}"></i> <span class="font-bold text-sm">${msg}</span>`;
    container.appendChild(el);
    setTimeout(() => el.remove(), 3000);
};

window.router = (view) => {
    // ✅ FIX BUG 5: Close all modals when switching views
    document.getElementById('edit-modal').classList.add('hidden');
    document.getElementById('quick-modal').classList.add('hidden');
    document.getElementById('modal-overlay').classList.add('hidden');
    document.getElementById('stats-modal').classList.add('hidden');
    document.getElementById('monthly-stats-modal').classList.add('hidden');

    document.querySelectorAll('section[id^="view-"]').forEach(e => e.classList.add('hidden'));
    document.getElementById('view-' + view).classList.remove('hidden');

    // Nav Styles
    document.querySelectorAll('.nav-item').forEach(b => {
        b.className = "nav-item w-full flex items-center gap-3 px-4 py-3 rounded-lg text-slate-500 hover:bg-slate-50 hover:text-brand font-medium transition";
    });
    const active = document.getElementById('nav-' + view);
    if (active) active.className = "nav-item w-full flex items-center gap-3 px-4 py-3 rounded-lg bg-brand/10 text-brand font-bold shadow-sm transition";

    if (window.innerWidth < 1024) {
        document.getElementById('sidebar').classList.add('-translate-x-full');
        document.getElementById('sidebar-backdrop').classList.add('hidden');
        const titles = { billing: 'Billing', dashboard: 'Dashboard', manage: 'Inventory', history: 'Transactions', share: 'App Link' };
        document.getElementById('page-title-mob').innerText = titles[view] || 'AdminOS';
    }

    // ✅ FIX BUG 8: Only Init Dashboard once, not every click
    if (view === 'dashboard') Dashboard.init();
    if (view === 'share') Share.init();
};

// --- MODULES ---

// 1. BILLING
window.Billing = {
    // Add these inside window.Billing = { ... }

    addSelectedDate() {
        const dateInput = document.getElementById('pos-date');
        const dateVal = dateInput.value;

        if (!dateVal) return window.Toast("Select a date first", "error");
        if (State.selectedDates.includes(dateVal)) return window.Toast("Date already added", "error");

        State.selectedDates.push(dateVal);
        this.renderDates();
    },

    removeDate(index) {
        State.selectedDates.splice(index, 1);
        this.renderDates();
    },

    renderDates() {
        const container = document.getElementById('selected-dates-container');
        container.innerHTML = State.selectedDates.map((d, idx) => `
        <span class="bg-brand/10 text-brand text-[10px] font-bold px-2 py-1 rounded-lg flex items-center gap-2">
            ${d}
            <i class="fa-solid fa-xmark cursor-pointer hover:text-red-500" onclick="Billing.removeDate(${idx})"></i>
        </span>
    `).join('');
    },
    populateDropdown() {
        const select = document.getElementById('pos-product-select');
        select.innerHTML = '<option value="">Select Product...</option>';
        for (let id in State.products) {
            const p = State.products[id];
            const opt = document.createElement('option');
            opt.value = id;
            opt.text = p.name;
            opt.dataset.price = p.price;
            select.appendChild(opt);
        }
    },
    updatePrice() {
        const select = document.getElementById('pos-product-select');
        const priceInput = document.getElementById('pos-price');
        const selectedOpt = select.options[select.selectedIndex];

        if (selectedOpt.value) {
            let price = selectedOpt.dataset.price;
            
            // NAYA LOGIC: Agar customer selected hai aur uski profile me fixed milk rate hai
            if (State.currentUser) {
                const custInfo = State.users[State.currentUser.phone];
                // Condition: Product ke naam mein "milk" shabd hona chahiye (e.g. "Cow Milk", "Buffalo Milk")
                if (custInfo && custInfo.milkPrice && selectedOpt.text.toLowerCase().includes('milk')) {
                    price = custInfo.milkPrice;
                    window.Toast(`Custom Milk Rate Applied: ₹${price}`);
                }
            }
            
            priceInput.value = price;
        } else {
            priceInput.value = '';
        }
    },
    addItemManual() {
        const select = document.getElementById('pos-product-select');
        const qtyInput = document.getElementById('pos-qty');
        const priceInput = document.getElementById('pos-price');

        const id = select.value;
        const name = select.options[select.selectedIndex]?.text || "Custom Item";

        // --- CHANGE 1: parseInt ki jagah parseFloat use kiya ---
        let qty = parseFloat(qtyInput.value);
        let manualPrice = parseFloat(priceInput.value);

        if (!id) return window.Toast("Please select a product", "error");

        // Strict Checks
        if (isNaN(manualPrice) || manualPrice < 0) {
            return window.Toast("Invalid Price entered", "error");
        }

        // --- CHANGE 2: Validation ab 0 se bada check karegi (0.05 allow hoga) ---
        if (isNaN(qty) || qty <= 0) {
            return window.Toast("Quantity must be greater than 0", "error");
        }

        const exist = State.cart.find(i => i.id === id && i.price === manualPrice);

        if (exist) {
            exist.qty += qty;
            // Total calculation ab decimal support karegi
            exist.total = exist.qty * manualPrice;
        } else {
            State.cart.push({ id, name: name, price: manualPrice, qty: qty, total: manualPrice * qty });
        }

        this.renderCart();
        window.Toast("Item Added");
        qtyInput.value = 1;
    },
    selectUser() {
        const val = document.getElementById('pos-customer').value;
        if (val.includes('|')) {
            const [name, phone] = val.split('|').map(s => s.trim());
            State.currentUser = { name, phone };
            document.getElementById('cust-name').innerText = name;
            document.getElementById('cust-display').classList.remove('hidden');
            
            // NAYA: Customer select hone par agar product pehle se selected hai, toh price update karega
            this.updatePrice();
        }
    },

    
    clearCart() {
        if (State.cart.length === 0) return;
        if (confirm("Are you sure you want to empty the cart?")) {
            State.cart = [];
            this.renderCart();
        }
    },
    renderCart() {
        const list = document.getElementById('cart-list');
        // ✅ FIX BUG 4: Eliminate innerHTML race condition by building string
        let htmlBuffer = '';
        let total = 0, count = 0;

        if (State.cart.length === 0) {
            list.innerHTML = `
                <div class="h-full flex flex-col items-center justify-center text-slate-300">
                    <i class="fa-solid fa-basket-shopping text-5xl mb-3 opacity-20"></i>
                    <p class="text-sm font-medium">Cart is empty</p>
                </div>`;
            document.getElementById('summ-count').innerText = '0';
            document.getElementById('summ-sub').innerText = '0.00';
            document.getElementById('summ-total').innerText = '0.00';
            return;
        }

        State.cart.forEach((i, idx) => {
            total += i.total; count += i.qty;
            htmlBuffer += `
                <div class="flex justify-between items-center p-3 mb-2 bg-slate-50 border border-slate-100 rounded-xl hover:bg-white hover:shadow-sm transition">
                    <div>
                        <div class="font-bold text-slate-800 text-sm">${i.name}</div>
                        <div class="text-xs text-slate-400 font-medium">₹${i.price} x ${i.qty}</div>
                    </div>
                    <div class="font-bold text-slate-700 text-right">
                        <div>₹${i.total}</div>
                        <button onclick="Billing.removeItem(${idx})" class="text-[10px] text-red-500 hover:underline uppercase mt-1">Remove</button>
                    </div>
                </div>`;
        });

        list.innerHTML = htmlBuffer;
        document.getElementById('summ-count').innerText = count;
        document.getElementById('summ-sub').innerText = total.toFixed(2);
        document.getElementById('summ-total').innerText = total.toFixed(2);
    },
    removeItem(idx) {
        State.cart.splice(idx, 1);
        this.renderCart();
    },
    // Replace old checkout with this in admin.js
async checkout() {
    if (!State.currentUser) return window.Toast("Select Customer", "error");
    if (State.cart.length === 0) return window.Toast("Cart is Empty", "error");
    
    // Calendar se dates nikaalein
    const selectedDates = State.fp.selectedDates; 
    if (selectedDates.length === 0) return window.Toast("Please select at least one date", "error");

    const total = parseFloat(document.getElementById('summ-total').innerText);
    const promises = [];

    // Har selected date ke liye alag bill banayenge
    selectedDates.forEach(dateObj => {
        // Date format convert karein MM-DD-YYYY
        const m = String(dateObj.getMonth() + 1).padStart(2, '0');
        const d = String(dateObj.getDate()).padStart(2, '0');
        const y = dateObj.getFullYear();
        const formattedDate = `${m}-${d}-${y}`;

        const data = {
        consumerName: State.currentUser.name,
        consumerPhone: State.currentUser.phone,
        items: JSON.parse(JSON.stringify(State.cart)),
        totalAmount: total,
        date: formattedDate,
        // YE LINE IMPORTANT HAI: Date object se exact time nikaalna
        timestamp: dateObj.getTime() 
    };

    // Billing.checkout ke loop ke andar check karein:
const p = push(ref(db, `bills/${State.currentUser.phone}`), {
    item: `Order (${State.cart.length} items)`,
    amount: total,
    date: formattedDate,
    timestamp: dateObj.getTime(), // YE LINE BAHAR HONI CHAHIYE
    details: data
});
    promises.push(p);
});

    try {
        await Promise.all(promises);
        window.Toast(`Success! Bills generated for ${selectedDates.length} days.`);
        
        // Reset Everything
        State.cart = [];
        this.renderCart();
        State.fp.clear(); // Calendar clear karein
        State.fp.setDate(new Date()); // Wapas aaj ki date set karein
    } catch (err) {
        window.Toast("Error saving bills", "error");
    }
}
};

// 2. MANAGEMENT
window.Manage = {
    editProdId: null,
    editUserPhone: null,

    initListeners() {
        // Products
        onValue(ref(db, 'products'), (snap) => {
            State.products = snap.val() || {};
            Billing.populateDropdown();
            // Dashboard.init(); // Remove direct call, let listeners handle it

            const list = document.getElementById('manage-prod-list');
            list.innerHTML = '';

            // ✅ FIX BUG 4: HTML Buffer
            let html = '';
            if (Object.keys(State.products).length === 0) {
                list.innerHTML = '<div class="text-center text-slate-400 py-4 italic">No products added.</div>';
                return;
            }

            for (let id in State.products) {
                const p = State.products[id];
                html += `
                    <div class="flex justify-between items-center p-3 bg-slate-50 border border-slate-100 rounded-lg hover:shadow-sm transition group">
                        <div>
                            <div class="font-bold text-slate-700">${p.name}</div>
                            <div class="text-xs text-slate-500 font-mono">₹${p.price}</div>
                        </div>
                        <div class="flex gap-2 opacity-100 lg:opacity-0 group-hover:opacity-100 transition">
                            <button onclick="Manage.editProd('${id}')" class="text-blue-500 hover:bg-blue-50 p-2 rounded-lg" title="Edit"><i class="fa-solid fa-pen-to-square"></i></button>
                            <button onclick="Manage.delProd('${id}', '${p.name}')" class="text-red-500 hover:bg-red-50 p-2 rounded-lg" title="Delete"><i class="fa-solid fa-trash"></i></button>
                        </div>
                    </div>`;
            }
            list.innerHTML = html;
        });

        // Users
        onValue(ref(db, 'users'), (snap) => {
            State.users = snap.val() || {};

            // Populate Dropdown
            const dl = document.getElementById('dl-consumers');
            dl.innerHTML = '';
            for (let ph in State.users) {
                const u = State.users[ph];
                dl.innerHTML += `<option value="${u.name} | ${u.phone}">`;
            }
            this.renderUsers();
        });
        this.monitorPopup();
    },

    renderUsers(query = '') {
        const list = document.getElementById('manage-user-list');
        list.innerHTML = '';

        const usersArray = Object.values(State.users || {});
        // ✅ FIX BUG 6: Null Safety during search
        const searchTerm = (query || '').toLowerCase().trim();

        const filtered = usersArray.filter(u => {
            const name = (u.name || '').toLowerCase();
            const phone = (u.phone || '').toString();
            const addr = (u.address || '').toLowerCase();
            return name.includes(searchTerm) || phone.includes(searchTerm) || addr.includes(searchTerm);
        });

        const countEl = document.getElementById('man-user-count');
        if (countEl) countEl.innerText = filtered.length;

        if (filtered.length === 0) {
            list.innerHTML = '<div class="text-center text-slate-400 py-4 italic text-xs">No matching customers found.</div>';
            return;
        }

        let html = '';
        filtered.forEach(u => {
            const addr = u.address ? u.address : '<span class="italic opacity-50">No Address</span>';
            html += `
                <div class="flex justify-between items-start p-3 bg-slate-50 border border-slate-100 rounded-lg hover:shadow-sm transition group">
                    <div>
                        <div class="font-bold text-slate-800 text-sm">${u.name}</div>
                        <div class="text-xs text-brand font-mono font-bold tracking-wide my-0.5"><i class="fa-solid fa-phone text-[10px]"></i> ${u.phone}</div>
                        <div class="text-xs text-slate-500"><i class="fa-solid fa-location-dot text-[10px]"></i> ${addr}</div>
                    </div>
                    <div class="flex gap-2 opacity-100 lg:opacity-0 group-hover:opacity-100 transition">
                        <button onclick="Manage.editUser('${u.phone}')" class="text-blue-500 hover:bg-blue-50 p-2 rounded-lg" title="Edit"><i class="fa-solid fa-pen-to-square"></i></button>
                        <button onclick="Manage.delUser('${u.phone}', '${u.name}')" class="text-red-500 hover:bg-red-50 p-2 rounded-lg" title="Delete"><i class="fa-solid fa-trash"></i></button>
                    </div>
                </div>`;
        });
        list.innerHTML = html;
    },

    saveProduct() {
        const name = document.getElementById('man-prod-name').value;
        const price = parseFloat(document.getElementById('man-prod-price').value);

        if (!name || isNaN(price)) return window.Toast("Invalid Name or Price", "error");

        const payload = { name, price };

        if (this.editProdId) {
            update(ref(db, `products/${this.editProdId}`), payload).then(() => { window.Toast("Product Updated"); this.resetProdForm(); });
        } else {
            push(ref(db, 'products'), payload).then(() => { window.Toast("Product Added"); document.getElementById('man-prod-name').value = ''; document.getElementById('man-prod-price').value = ''; });
        }
    },
    delProd(id, name) {
        // ✅ FIX BUG 7: Stronger Confirmation
        if (confirm(`Delete product "${name}"? This cannot be undone.`)) {
            remove(ref(db, `products/${id}`));
            if (this.editProdId === id) this.resetProdForm();
        }
    },
    // ... editProd & resetProdForm remain the same (omitted for brevity, they are safe) ...
    editProd(id) {
        const p = State.products[id];
        document.getElementById('man-prod-name').value = p.name;
        document.getElementById('man-prod-price').value = p.price;
        this.editProdId = id;
        document.getElementById('btn-save-prod').innerText = "Update Product";
        document.getElementById('btn-save-prod').classList.add('bg-orange-600', 'hover:bg-orange-700');
        document.getElementById('btn-cancel-prod').classList.remove('hidden');
    },
    resetProdForm() {
        this.editProdId = null;
        document.getElementById('man-prod-name').value = '';
        document.getElementById('man-prod-price').value = '';
        document.getElementById('btn-save-prod').innerText = "Add Product";
        document.getElementById('btn-save-prod').classList.remove('bg-orange-600', 'hover:bg-orange-700');
        document.getElementById('btn-cancel-prod').classList.add('hidden');
    },

    async saveUser() {
        const name = document.getElementById('man-user-name').value.trim();
        const phone = document.getElementById('man-user-phone').value.trim();
        const address = document.getElementById('man-user-address').value.trim();
        // NAYA: Milk Price input se value lein
        const milkInput = document.getElementById('man-user-milk').value;
        const milkPrice = milkInput ? parseFloat(milkInput) : null; 

        const phoneRegex = /^[0-9]{10}$/;
        if (!name) return window.Toast("Name is required", "error");
        if (!phoneRegex.test(phone)) return window.Toast("Phone must be 10 digits", "error");

        const oldPhone = this.editUserPhone;

        // SCENARIO 1: Phone number CHANGE kiya gaya hai
        if (oldPhone && oldPhone !== phone) {
            if (State.users[phone]) return window.Toast("This new phone number is already registered!", "error");
            if (!confirm(`Are you sure? Change phone from ${oldPhone} to ${phone}? All billing history will be safely moved.`)) return;

            try {
                const oldBillsSnap = await get(ref(db, `bills/${oldPhone}`));
                const oldBills = oldBillsSnap.val();
                const updates = {};
                
                // NAYA: milkPrice bhi database mein save karein
                updates[`users/${phone}`] = { name, phone, address, milkPrice };
                updates[`users/${oldPhone}`] = null;

                if (oldBills) {
                    for (let billId in oldBills) {
                        if (oldBills[billId].details) oldBills[billId].details.consumerPhone = phone;
                    }
                    updates[`bills/${phone}`] = oldBills;
                    updates[`bills/${oldPhone}`] = null;
                }

                await update(ref(db), updates);
                window.Toast("Customer & Bills Migrated Successfully!");
                this.resetUserForm();
                return;
            } catch (error) {
                return window.Toast("Error updating phone number", "error");
            }
        }

        // SCENARIO 2: Normal Edit YA Naya Customer
        update(ref(db, `users/${phone}`), { name, phone, address, milkPrice }).then(() => {
            window.Toast(document.getElementById('btn-save-user').innerText === "Update Customer" ? "Customer Updated" : "Customer Registered");
            this.resetUserForm();
        });
    },

    editUser(phone) {
        const u = State.users[phone];
        this.editUserPhone = phone;

        document.getElementById('man-user-name').value = u.name;
        document.getElementById('man-user-phone').value = u.phone;
        document.getElementById('man-user-address').value = u.address || "";
        // NAYA: Edit karte waqt purana milk rate dikhaye
        document.getElementById('man-user-milk').value = u.milkPrice || ""; 
        
        document.getElementById('man-user-phone').readOnly = false;
        document.getElementById('man-user-phone').classList.remove('bg-slate-200', 'text-slate-500');
        
        document.getElementById('btn-save-user').innerText = "Update Customer";
        document.getElementById('btn-save-user').classList.add('bg-orange-600', 'hover:bg-orange-700');
        document.getElementById('btn-cancel-user').classList.remove('hidden');
    },

    resetUserForm() {
        this.editUserPhone = null;
        document.getElementById('man-user-name').value = '';
        document.getElementById('man-user-phone').value = '';
        document.getElementById('man-user-address').value = '';
        // NAYA: Form reset hone par field khali kare
        document.getElementById('man-user-milk').value = ''; 
        
        document.getElementById('man-user-phone').readOnly = false;
        document.getElementById('man-user-phone').classList.remove('bg-slate-200', 'text-slate-500');
        
        document.getElementById('btn-save-user').innerText = "Register Customer";
        document.getElementById('btn-save-user').classList.remove('bg-orange-600', 'hover:bg-orange-700');
        document.getElementById('btn-cancel-user').classList.add('hidden');
    },
    // --- POPUP LOGIC START ---

    // 1. Publish Logic
    // --- UPDATED POPUP LOGIC FOR admin.js ---

    publishPopup() {
        const title = document.getElementById('popup-title').value.trim(); // NEW
        const msg = document.getElementById('popup-text').value.trim();
        const img = document.getElementById('popup-image').value.trim();

        if (!title) return window.Toast("Popup Title is required!", "error"); // Title Mandatory

        const payload = {
            title: title, // NEW
            imageUrl: img,
            message: msg,
            active: true,
            timestamp: Date.now()
        };

        set(ref(db, 'marketing/popup'), payload).then(() => {
            window.Toast("Popup Published Successfully!", "success");
        }).catch(e => window.Toast("Error publishing", "error"));
    },

    deletePopup() {
        if (!confirm("Stop showing this popup?")) return;
        remove(ref(db, 'marketing/popup')).then(() => {
            window.Toast("Popup Removed");
            // Clear inputs
            document.getElementById('popup-title').value = '';
            document.getElementById('popup-text').value = '';
            document.getElementById('popup-image').value = '';
        });
    },

    monitorPopup() {
        onValue(ref(db, 'marketing/popup'), (snap) => {
            const data = snap.val();
            const badge = document.getElementById('popup-badge');
            const box = document.getElementById('popup-status');

            if (!badge) return;

            if (data && data.active) {
                badge.className = "px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs font-bold animate-pulse";
                badge.innerHTML = '<i class="fa-solid fa-circle text-[8px] mr-1"></i> Live Now';
                box.className = "bg-emerald-50 rounded-xl p-3 text-center border border-emerald-200";

                // Prefill inputs
                if (document.getElementById('popup-title').value === '') document.getElementById('popup-title').value = data.title || '';
                if (document.getElementById('popup-image').value === '') document.getElementById('popup-image').value = data.imageUrl || '';
                if (document.getElementById('popup-text').value === '') document.getElementById('popup-text').value = data.message || '';
            } else {
                badge.className = "px-3 py-1 bg-slate-200 text-slate-500 rounded-full text-xs font-bold";
                badge.innerHTML = 'Inactive';
                box.className = "bg-slate-50 rounded-xl p-3 text-center border border-slate-200 border-dashed";
            }
        });
    },
    // --- POPUP LOGIC END ---
    downloadUserPDF() { /* ... Same as your code ... */
        const { jsPDF } = window.jspdf;
        if (!jsPDF) return window.Toast("PDF Library Loading...", "error");
        const doc = new jsPDF();
        doc.setFontSize(18);
        doc.text("Registered Customers List", 14, 22);
        doc.setFontSize(10);
        doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 14, 28);
        const tableBody = Object.values(State.users || {}).map(u => [u.name, u.phone, u.address || 'N/A']);
        doc.autoTable({ head: [['Customer Name', 'Phone Number', 'Address']], body: tableBody, startY: 35, theme: 'grid', headStyles: { fillColor: [67, 56, 202] }, styles: { fontSize: 10, cellPadding: 3 }, alternateRowStyles: { fillColor: [243, 244, 246] } });
        doc.save('Customers_List.pdf');
    }

};

// 3. DASHBOARD
// 3. DASHBOARD (Fixed: PDF & WhatsApp Logic Restored)
// 3. DASHBOARD (Updated with Month-Wise Billing Logic)
window.Dashboard = {
    allBills: [],
    customerTotals: [],
    listenerAttached: false,

    init() {
        document.getElementById('dash-products').innerText = Object.keys(State.products || {}).length;
        const now = new Date();
        const dateEl = document.getElementById('dash-today-date');
        const monthEl = document.getElementById('dash-month-name');
        if (dateEl) dateEl.innerText = now.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'short' });
        if (monthEl) monthEl.innerText = now.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

        if (this.listenerAttached) {
            if (this.allBills.length > 0) {
                this.calculateStats();
                this.renderProductStats();
            }
            return;
        }

        this.listenerAttached = true;
        onValue(ref(db, 'bills'), (snap) => {
            const data = snap.val();
            this.allBills = [];

            if (data) {
                for (let ph in data) {
                    for (let id in data[ph]) {
                        const bill = data[ph][id];
                        let ts = 0;
                        if (bill.details?.timestamp) ts = bill.details.timestamp;
                        else if (bill.date) ts = new Date(bill.date).getTime();

                        this.allBills.push({ ...bill, timestamp: ts || 0, phone: ph });
                    }
                }
            }
            this.calculateStats();
            this.renderProductStats();
        });
    },

    // ... renderProductStats, calculateStats, applyFilter (Same as your old code) ...
    renderProductStats() {
        const grid = document.getElementById('dash-prod-stats');
        if (!grid) return;
        const productCounts = {};
        for (let id in State.products) productCounts[State.products[id].name] = 0;

        this.allBills.forEach(bill => {
            if (bill.details && bill.details.items) {
                bill.details.items.forEach(item => {
                    const name = item.name || "Unknown";
                    const qty = parseFloat(item.qty || 0);
                    productCounts[name] = (productCounts[name] !== undefined) ? productCounts[name] + qty : qty;
                });
            }
        });

        if (Object.keys(productCounts).length === 0) {
            grid.innerHTML = `<div class="col-span-full text-slate-400 text-sm italic p-4 border rounded-lg bg-slate-50">No sales data available yet.</div>`;
            return;
        }

        grid.innerHTML = Object.keys(productCounts).map(pName => {
            const qty = productCounts[pName];
            const displayQty = Number.isInteger(qty) ? qty : qty.toFixed(2);
            return `
                <div class="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col items-center text-center hover:shadow-md hover:border-brand/30 transition group">
                    <div class="bg-indigo-50 text-brand w-10 h-10 rounded-full flex items-center justify-center mb-2 group-hover:scale-110 transition">
                        <i class="fa-solid fa-box-open"></i>
                    </div>
                    <h4 class="font-bold text-slate-700 text-sm truncate w-full" title="${pName}">${pName}</h4>
                    <p class="text-[10px] text-slate-400 mt-1 uppercase font-bold tracking-wider">Total Sold</p>
                    <p class="font-bold text-slate-800 text-xl mt-0.5">${displayQty} <span class="text-[10px] text-slate-500 font-normal">Units</span></p>
                </div>`;
        }).join('');
    },

    calculateStats() {
        const now = new Date();
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

        // Exact Current Month aur Year for Filtering
        const currentMonthStr = String(now.getMonth() + 1).padStart(2, '0');
        const currentYearStr = String(now.getFullYear());

        let totalSales = 0, todaySales = 0, monthSales = 0, totalOrders = 0;

        this.allBills.forEach(b => {
            // FIXED: History table ki tarah exact b.amount use karein
            const billAmt = parseFloat(b.amount || 0);

            // 1. Lifetime Total
            totalSales += billAmt;

            // 2. Total Orders Counter
            totalOrders++;

            // 3. Today Sales logic
            if (b.timestamp >= startOfDay) {
                todaySales += billAmt;
            }

            // 4. Current Month Sales logic (Using your robust parser)
            const my = Dashboard._getBillMonthYear(b);
            if (my && my.month === currentMonthStr && my.year === currentYearStr) {
                monthSales += billAmt;
            }
        });

        // UI Update with Indian Formatting
        const safeSet = (id, val) => {
            const el = document.getElementById(id);
            if (el) el.innerText = val;
        };

        // en-IN format taaki commas (₹ 9,51,293.5) sahi dikhein
        safeSet('dash-sales', totalSales.toLocaleString('en-IN', { minimumFractionDigits: 1, maximumFractionDigits: 2 }));
        safeSet('dash-orders', totalOrders);
        safeSet('dash-today', todaySales.toLocaleString('en-IN', { minimumFractionDigits: 1, maximumFractionDigits: 2 }));
        safeSet('dash-month', monthSales.toLocaleString('en-IN', { minimumFractionDigits: 1, maximumFractionDigits: 2 }));
    },

    // 1. DASHBOARD FILTER (To match PDF exactly)
    applyFilter() {
        const startVal = document.getElementById('filter-start').value;
        const endVal = document.getElementById('filter-end').value;
        if (!startVal || !endVal) return window.Toast("Select Start & End Date", "error");

        const startDate = new Date(startVal).getTime();
        const endDate = new Date(endVal);
        endDate.setHours(23, 59, 59, 999);
        const endTime = endDate.getTime();

        if (startDate > endTime) return window.Toast("Invalid Date Range", "error");

        let rangeTotal = 0;
        let count = 0;

        this.allBills.forEach(b => {
            if (b.timestamp >= startDate && b.timestamp <= endTime) {
                // Use exactly the same amount logic as PDF
                rangeTotal += parseFloat(b.amount || 0);
                count++;
            }
        });

        document.getElementById('filter-result').innerText = rangeTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        window.Toast(`Found ${count} orders`);
    },

    // 2. UPDATED PDF LOGIC (Matching Dashboard Total)
    downloadRangePDF() {
        const startVal = document.getElementById('filter-start').value;
        const endVal = document.getElementById('filter-end').value;

        if (!startVal || !endVal) return window.Toast("Select Start & End Date", "error");

        const startDate = new Date(startVal).getTime();
        const endDate = new Date(endVal);
        endDate.setHours(23, 59, 59, 999);
        const endTime = endDate.getTime();

        const filteredBills = this.allBills.filter(b => b.timestamp >= startDate && b.timestamp <= endTime);
        if (filteredBills.length === 0) return window.Toast("No transactions found", "error");

        const customerGroup = {};
        let overallGrandTotal = 0;

        filteredBills.forEach(bill => {
            const ph = bill.phone;
            const name = bill.details?.consumerName || State.users[ph]?.name || 'Unknown';
            const billAmt = parseFloat(bill.amount || 0);

            if (!customerGroup[ph]) {
                customerGroup[ph] = {
                    name: name,
                    phone: ph,
                    itemSummary: {},
                    customerTotal: 0
                };
            }

            // Add to Totals (Using the exact bill amount)
            customerGroup[ph].customerTotal += billAmt;
            overallGrandTotal += billAmt;

            // Group Items for display
            if (bill.details?.items) {
                bill.details.items.forEach(it => {
                    const itemKey = `${it.name.toUpperCase()}_${it.price}`;
                    const qty = parseFloat(it.qty || 0);
                    const price = parseFloat(it.price || 0);

                    if (!customerGroup[ph].itemSummary[itemKey]) {
                        customerGroup[ph].itemSummary[itemKey] = { name: it.name.toUpperCase(), price: price, qty: 0 };
                    }
                    customerGroup[ph].itemSummary[itemKey].qty += qty;
                });
            }
        });

        // Generate PDF
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF('p', 'mm', 'a4');

        doc.setFont("helvetica", "bold");
        doc.setFontSize(18);
        doc.text("SALES SUMMARY REPORT", 14, 15);

        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        doc.setTextColor(100);
        doc.text(`Range: ${startVal} to ${endVal}`, 14, 22);
        doc.text(`Generated: ${new Date().toLocaleString('en-IN')}`, 14, 27);

        const tableRows = Object.values(customerGroup).map((c) => {
            const itemsStrings = Object.values(c.itemSummary).map(item => {
                const lineTotal = item.qty * item.price;
                // Perfect Formatting as requested
                return `${item.name.padEnd(12)} x ${item.qty.toFixed(2).padStart(5)} @ Rs.${item.price.toFixed(2).padStart(7)} = Rs.${lineTotal.toFixed(2).padStart(10)}`;
            });

            return [
                { content: `${c.name}\n${c.phone}`, styles: { fontStyle: 'bold' } },
                { content: itemsStrings.join("\n"), styles: { font: 'courier' } },
                { content: `Rs. ${c.customerTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, styles: { halign: 'right', fontStyle: 'bold', valign: 'middle' } }
            ];
        });

        doc.autoTable({
            head: [['Customer Details', 'Items Summary', 'Total']],
            body: tableRows,
            startY: 35,
            theme: 'grid',
            headStyles: { fillColor: [51, 65, 85], textColor: [255, 255, 255], fontStyle: 'bold' },
            styles: { fontSize: 8, cellPadding: 3, valign: 'top' },
            columnStyles: { 0: { cellWidth: 40 }, 1: { cellWidth: 'auto' }, 2: { cellWidth: 35 } },
            foot: [[
                { content: 'REPORT GRAND TOTAL', colSpan: 2, styles: { halign: 'right', fontStyle: 'bold', fillColor: [241, 245, 249] } },
                { content: `Rs. ${overallGrandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, styles: { halign: 'right', fontStyle: 'bold', fillColor: [220, 252, 231], textColor: [21, 128, 61], fontSize: 10 } }
            ]],
        });

        doc.save(`Sales_Summary_${startVal}.pdf`);
        window.Toast("PDF Sync Successful!");
    },
    // --- NEW MONTH-WISE BILLING LOGIC STARTS HERE ---

    openQuickAction() {
        const monthInput = document.getElementById('quick-month-filter');
        const now = new Date();
        const currentYearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        if (monthInput) {
            monthInput.value = currentYearMonth;
        }
        const searchInput = document.getElementById('quick-search-input');
        if (searchInput) searchInput.value = "";

        this.calculateCustomerTotals();
        document.getElementById('quick-modal').classList.remove('hidden');
    },

    // 1. यह फंक्शन डेटा कैलकुलेट करता है (महीने के हिसाब से)
    // ── Shared data builder ── called by list, PDF, and Excel so totals always match ──
    // Extracts { month: "MM", year: "YYYY" } from any bill — handles all date formats
    _getBillMonthYear(bill) {
        // Format 1: MM-DD-YYYY (current stored format)  e.g. "03-15-2026"
        if (bill.date && typeof bill.date === 'string') {
            const parts = bill.date.split('-');
            if (parts.length === 3) {
                // MM-DD-YYYY: parts[0] is 1-2 digit month, parts[2] is 4 digit year
                if (parts[2] && parts[2].length === 4) {
                    return { month: parts[0].padStart(2, '0'), year: parts[2] };
                }
                // YYYY-MM-DD: parts[0] is 4 digit year
                if (parts[0] && parts[0].length === 4) {
                    return { month: parts[1].padStart(2, '0'), year: parts[0] };
                }
            }
            // Format: MM/DD/YYYY or DD/MM/YYYY slash separated
            const slashParts = bill.date.split('/');
            if (slashParts.length === 3 && slashParts[2].length === 4) {
                return { month: slashParts[0].padStart(2, '0'), year: slashParts[2] };
            }
        }
        // Fallback: use timestamp from details or bill level
        const ts = bill.details?.timestamp || bill.timestamp;
        if (ts && ts > 0) {
            const d = new Date(ts);
            return {
                month: String(d.getMonth() + 1).padStart(2, '0'),
                year: String(d.getFullYear())
            };
        }
        return null; // cannot determine
    },

    _buildLedgerData(monthFilter) {
        let fYear = null, fMonth = null;
        if (monthFilter) [fYear, fMonth] = monthFilter.split('-');

        // Group bills by phone, applying month filter
        const phoneMap = {};
        this.allBills.forEach(bill => {
            if (monthFilter) {
                const my = this._getBillMonthYear(bill);
                if (!my) return; // skip if date unreadable
                if (my.month !== fMonth || my.year !== fYear) return;
            }
            if (!phoneMap[bill.phone]) phoneMap[bill.phone] = [];
            phoneMap[bill.phone].push(bill);
        });

        // Build per-customer summaries using price × qty (single source of truth)
        const customers = [];
        const overallItems = {}; // for grand item summary
        let grandTotal = 0;

        Object.keys(phoneMap).forEach(ph => {
            const bills = phoneMap[ph];
            const name = State.users[ph]?.name || bills[0]?.details?.consumerName || 'Unknown';
            const items = {};
            let custTotal = 0;

            bills.forEach(bill => {
                if (bill.details?.items && Array.isArray(bill.details.items)) {
                    bill.details.items.forEach(item => {
                        const n = item.name || 'Unknown';
                        const price = parseFloat(item.price || 0);
                        const qty = parseFloat(item.qty || 0);
                        const line = price * qty;
                        if (!items[n]) items[n] = { qty: 0, totalAmt: 0, price };
                        items[n].qty += qty;
                        items[n].totalAmt += line;
                        custTotal += line;
                        // overall item summary
                        if (!overallItems[n]) overallItems[n] = { qty: 0, totalAmt: 0, price };
                        overallItems[n].qty += qty;
                        overallItems[n].totalAmt += line;
                    });
                } else {
                    const fb = parseFloat(bill.amount || 0);
                    custTotal += fb;
                }
            });

            grandTotal += custTotal;
            customers.push({ name, phone: ph, total: custTotal, items, orders: bills.length });
        });

        // Sort alphabetically by name
        customers.sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));

        return { customers, overallItems, grandTotal };
    },

    calculateCustomerTotals() {
        const monthFilter = document.getElementById('quick-month-filter')?.value;
        const { customers } = this._buildLedgerData(monthFilter);

        // Update customerTotals for the modal list (sorted by total desc for display)
        this.customerTotals = customers
            .filter(c => !monthFilter || c.total > 0)
            .sort((a, b) => b.total - a.total);

        this.filterQuickList();
    },

    // 2. यह फंक्शन सर्च इनपुट के आधार पर लिस्ट को स्क्रीन पर दिखाता है
    filterQuickList() {
        const query = document.getElementById('quick-search-input')?.value || '';
        this.renderQuickList(query);
    },

    // 3. यह फंक्शन लिस्ट को रेंडर करता है
    renderQuickList(query = '') {
        const list = document.getElementById('quick-list-body');
        if (!list) return;

        const term = query.toLowerCase().trim();

        // customerTotals में से सर्च टर्म मैच करें
        const filtered = this.customerTotals.filter(c =>
            (c.name || '').toLowerCase().includes(term) ||
            (c.phone || '').includes(term)
        );

        if (filtered.length === 0) {
            list.innerHTML = '<div class="text-center p-8 text-slate-400">No customers found</div>';
            return;
        }

        list.innerHTML = filtered.map(c => `
         <div class="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 hover:bg-slate-50 transition">
            <div>
                <h4 class="font-bold text-slate-800 text-sm">${c.name}</h4>
                <div class="flex items-center gap-2 mt-1">
                    <span class="text-xs font-mono text-slate-500 bg-slate-100 px-1.5 rounded">${c.phone}</span>
                    ${c.total > 0 ? '<span class="text-[10px] text-emerald-600 bg-emerald-50 px-1.5 rounded font-bold">Has Purchases</span>' : ''}
                </div>
            </div>
            <div class="flex items-center gap-3 self-end sm:self-auto">
                <div class="text-right mr-2 hidden sm:block">
                    <span class="block text-xs text-slate-400 font-bold uppercase">Total Spend</span>
                    <span class="font-bold text-slate-800">₹${c.total.toLocaleString()}</span>
                </div>
                <button onclick="Dashboard.showCustomerStats('${c.phone}', '${c.name}')" class="bg-violet-100 hover:bg-violet-200 text-violet-700 w-9 h-9 rounded-full flex items-center justify-center transition shadow-sm" title="View Statistics"><i class="fa-solid fa-chart-bar"></i></button>
                <button onclick="Dashboard.downloadCustomerStatement('${c.phone}', '${c.name}')" class="bg-red-100 hover:bg-red-200 text-red-600 w-9 h-9 rounded-full flex items-center justify-center transition shadow-sm" title="Download Statement"><i class="fa-solid fa-file-pdf"></i></button>
                <button onclick="Dashboard.sendWhatsApp('${c.phone}', '${c.name}', ${c.total})" class="bg-[#25D366] hover:bg-[#1ebc57] text-white px-4 py-2 rounded-full flex items-center gap-2 text-xs font-bold shadow-md"><i class="fa-brands fa-whatsapp text-lg"></i> Send</button>
            </div>
        </div>`).join('');
    },

    // --- CUSTOMER STATS MODAL ---
    showCustomerStats(phone, name) {
        const monthFilter = document.getElementById('quick-month-filter')?.value;

        // Filter bills for this customer
        let customerBills = this.allBills.filter(b => b.phone === phone);

        // Apply month filter using robust parser
        let monthLabel = "Overall / Lifetime";
        if (monthFilter) {
            const [fYear, fMonth] = monthFilter.split('-');
            customerBills = customerBills.filter(b => {
                const my = Dashboard._getBillMonthYear(b);
                return my && my.month === fMonth && my.year === fYear;
            });
            monthLabel = new Date(fYear, fMonth - 1).toLocaleString('default', { month: 'long', year: 'numeric' });
        }

        // Build item summary — same calculation as PDF, fully accurate
        const itemSummary = {};
        let grandTotal = 0;

        customerBills.forEach(bill => {
            if (bill.details && bill.details.items) {
                bill.details.items.forEach(item => {
                    const pName = item.name || "Unknown Item";
                    const unitPrice = parseFloat(item.price || 0);
                    const qty = parseFloat(item.qty || 0);
                    const lineTotal = unitPrice * qty;

                    if (!itemSummary[pName]) {
                        itemSummary[pName] = { qty: 0, totalAmt: 0, price: unitPrice };
                    }
                    itemSummary[pName].qty += qty;
                    itemSummary[pName].totalAmt += lineTotal;
                    grandTotal += lineTotal;
                });
            }
        });

        const totalOrders = customerBills.length;

        // Build table rows HTML
        let rowsHtml = '';
        if (Object.keys(itemSummary).length === 0) {
            rowsHtml = `<tr><td colspan="4" class="text-center py-6 text-slate-400 italic text-sm">No purchase data for this period.</td></tr>`;
        } else {
            let sNo = 1;
            for (const pName in itemSummary) {
                const d = itemSummary[pName];
                const qtyDisp = Number.isInteger(d.qty) ? d.qty : d.qty.toFixed(2);
                const priceDisp = d.price.toLocaleString();
                const amtDisp = d.totalAmt.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                rowsHtml += `
                    <tr class="border-b border-slate-100 hover:bg-violet-50/40 transition">
                        <td class="py-2.5 px-3 text-xs text-slate-500 font-mono">${sNo++}</td>
                        <td class="py-2.5 px-3 text-sm font-semibold text-slate-800">${pName}</td>
                        <td class="py-2.5 px-3 text-center text-sm font-bold text-slate-700">${qtyDisp}</td>
                        <td class="py-2.5 px-3 text-right text-sm font-bold text-slate-700">₹${priceDisp}</td>
                        <td class="py-2.5 px-3 text-right text-sm font-bold text-emerald-700">₹${amtDisp}</td>
                    </tr>`;
            }
        }

        const grandTotalDisp = grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

        // Inject into stats modal
        document.getElementById('stats-modal-title').innerText = name;
        document.getElementById('stats-modal-period').innerText = monthLabel;
        document.getElementById('stats-modal-orders').innerText = totalOrders;
        document.getElementById('stats-modal-total').innerText = '₹' + grandTotalDisp;
        document.getElementById('stats-table-body').innerHTML = rowsHtml;
        document.getElementById('stats-grand-total').innerText = '₹' + grandTotalDisp;

        document.getElementById('stats-modal').classList.remove('hidden');
    },

    downloadCustomerStatement(phone, name) {
        const { jsPDF } = window.jspdf;
        if (!jsPDF) return window.Toast("PDF Library Error", "error");

        const monthFilter = document.getElementById('quick-month-filter')?.value;
        let customerBills = this.allBills.filter(b => b.phone === phone);
        let monthLabel = "Overall / Lifetime";

        // Filter bills if a month is selected
        if (monthFilter) {
            const [fYear, fMonth] = monthFilter.split('-');
            customerBills = customerBills.filter(b => {
                const my = Dashboard._getBillMonthYear(b);
                return my && my.month === fMonth && my.year === fYear;
            });
            monthLabel = new Date(fYear, fMonth - 1).toLocaleString('default', { month: 'long', year: 'numeric' });
        }

        if (customerBills.length === 0) return window.Toast("No history found for selected month", "error");

        // Sort bills by date (Oldest to Newest for chronological statement)
        customerBills.sort((a, b) => (a.details?.timestamp || 0) - (b.details?.timestamp || 0));

        const tableBody = [];
        let grandTotal = 0;

        // Iterate through each bill and each item to show "Kiss din kya gaya"
        customerBills.forEach(bill => {
            const billDate = bill.date || "N/A";

            if (bill.details && bill.details.items && Array.isArray(bill.details.items)) {
                bill.details.items.forEach((item, index) => {
                    const unitPrice = parseFloat(item.price || 0);
                    const qty = parseFloat(item.qty || 0);
                    const lineTotal = unitPrice * qty;
                    grandTotal += lineTotal;

                    tableBody.push([
                        index === 0 ? billDate : "", // Sirf pehle item ke liye date dikhayega agar ek bill me multiple items hain
                        item.name || "Unknown",
                        qty % 1 === 0 ? qty : qty.toFixed(2),
                        `Rs. ${unitPrice.toLocaleString()}`,
                        `Rs. ${lineTotal.toLocaleString()}`
                    ]);
                });
            } else {
                // Fallback agar items list nahi hai (Sirf total amount hai)
                const amt = parseFloat(bill.amount || 0);
                grandTotal += amt;
                tableBody.push([billDate, "Order Total (Details N/A)", "1", `Rs. ${amt}`, `Rs. ${amt}`]);
            }
        });

        const doc = new jsPDF();

        // Header
        doc.setFontSize(18);
        doc.setTextColor(67, 56, 202); // Brand Indigo
        doc.text("DETAILED TRANSACTION STATEMENT", 14, 20);

        doc.setFontSize(10);
        doc.setTextColor(100);
        doc.text(`Billing Period: ${monthLabel}`, 14, 26);
        doc.text(`Generated on: ${new Date().toLocaleString('en-IN')}`, 14, 31);

        // Customer Info Box
        doc.setDrawColor(200);
        doc.setFillColor(248, 250, 252);
        doc.rect(14, 35, 182, 20, 'F');
        doc.setFontSize(11);
        doc.setTextColor(0);
        doc.setFont(undefined, 'bold');
        doc.text(`Customer: ${name}`, 18, 43);
        doc.setFont(undefined, 'normal');
        doc.text(`Phone: ${phone}`, 18, 50);

        // Detailed Table
        doc.autoTable({
            head: [['Date', 'Item Name', 'Qty', 'Unit Price', 'Total']],
            body: tableBody,
            startY: 60,
            theme: 'grid',
            headStyles: { fillColor: [67, 56, 202], textColor: [255, 255, 255], fontStyle: 'bold' },
            columnStyles: {
                0: { cellWidth: 25 }, // Date
                1: { cellWidth: 'auto' }, // Item Name
                2: { cellWidth: 20, halign: 'center' }, // Qty
                3: { cellWidth: 30, halign: 'right' }, // Unit Price
                4: { cellWidth: 30, halign: 'right', fontStyle: 'bold' } // Total
            },
            styles: { fontSize: 9, cellPadding: 3 },
            foot: [['', '', '', 'GRAND TOTAL:', `Rs. ${grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`]],
            footStyles: { fillColor: [240, 253, 244], textColor: [21, 128, 61], fontStyle: 'bold', fontSize: 10 }
        });

        doc.save(`${name.replace(/\s+/g, '_')}_Statement_${monthLabel.replace(/\s+/g, '_')}.pdf`);
        window.Toast("Detailed PDF Generated!");
    },

    downloadLedgerPDF() {
        const { jsPDF } = window.jspdf;
        if (!jsPDF) return window.Toast("PDF Library Error", "error");

        const monthFilter = document.getElementById('quick-month-filter')?.value;
        let monthLabel = "Overall / Lifetime";
        if (monthFilter) {
            const [y, m] = monthFilter.split('-');
            monthLabel = new Date(y, m - 1).toLocaleString('default', { month: 'long', year: 'numeric' });
        }

        const { customers, overallItems, grandTotal } = this._buildLedgerData(monthFilter);
        if (customers.length === 0) return window.Toast("No billing data found for this period", "error");

        const fmt = (n) => parseFloat(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

        const doc = new jsPDF();

        // ── Title ──
        doc.setFontSize(20); doc.setTextColor(67, 56, 202);
        doc.setFont(undefined, 'bold');
        doc.text('Customer Ledger Report', 14, 18);
        doc.setFont(undefined, 'normal');
        doc.setFontSize(9); doc.setTextColor(100);
        doc.text(`Period: ${monthLabel}   |   Generated: ${new Date().toLocaleDateString('en-IN')}   |   Customers: ${customers.length}`, 14, 25);

        // ── Grand Total Banner ──
        doc.setFillColor(67, 56, 202); doc.setDrawColor(67, 56, 202);
        doc.roundedRect(14, 28, 182, 12, 2, 2, 'F');
        doc.setFontSize(11); doc.setTextColor(255, 255, 255);
        doc.setFont(undefined, 'bold');
        doc.text(`GRAND TOTAL:  Rs. ${fmt(grandTotal)}`, 18, 36);
        doc.setFont(undefined, 'normal');

        // ── Per-customer table ──
        const tableBody = customers.map(c => {
            const itemLines = Object.keys(c.items).map(k => {
                const d = c.items[k];
                const q = Number.isInteger(d.qty) ? d.qty : d.qty.toFixed(2);
                return `${k}  x${q} @ Rs.${d.price}  =  Rs.${fmt(d.totalAmt)}`;
            });
            return [
                `${c.name}\n${c.phone}`,
                itemLines.length ? itemLines.join('\n') : 'No item details',
                `Rs. ${fmt(c.total)}`
            ];
        });

        doc.autoTable({
            head: [['Customer', 'Items Purchased', 'Total']],
            body: tableBody,
            startY: 44,
            theme: 'grid',
            headStyles: { fillColor: [67, 56, 202], halign: 'center', valign: 'middle', fontSize: 9, fontStyle: 'bold' },
            styles: { fontSize: 8.5, cellPadding: 3, valign: 'top', overflow: 'linebreak' },
            columnStyles: { 0: { cellWidth: 42 }, 1: { cellWidth: 'auto' }, 2: { cellWidth: 38, halign: 'right', fontStyle: 'bold' } },
            alternateRowStyles: { fillColor: [248, 250, 252] },
            foot: [['', 'GRAND TOTAL', `Rs. ${fmt(grandTotal)}`]],
            footStyles: { fillColor: [235, 240, 255], textColor: [40, 40, 140], fontStyle: 'bold', halign: 'right' }
        });

        // ── Overall Item Summary ──
        const summaryBody = Object.keys(overallItems).sort().map(k => {
            const d = overallItems[k];
            const q = Number.isInteger(d.qty) ? d.qty : d.qty.toFixed(2);
            return [k, `Rs. ${d.price}`, q, `Rs. ${fmt(d.totalAmt)}`];
        });

        const afterY = doc.lastAutoTable.finalY + 10;

        // Add new page if not enough space
        if (afterY > 250) doc.addPage();
        const startSumY = afterY > 250 ? 15 : afterY;

        doc.setFontSize(13); doc.setTextColor(67, 56, 202);
        doc.setFont(undefined, 'bold');
        doc.text('Overall Item Summary', 14, startSumY);
        doc.setFont(undefined, 'normal');
        doc.setFontSize(9); doc.setTextColor(100);
        doc.text(`Total quantity and amount sold per item — ${monthLabel}`, 14, startSumY + 5);

        doc.autoTable({
            head: [['Item Name', 'Unit Price', 'Total Qty Sold', 'Total Amount']],
            body: summaryBody,
            startY: startSumY + 8,
            theme: 'grid',
            headStyles: { fillColor: [15, 23, 42], halign: 'center', valign: 'middle', fontSize: 9, fontStyle: 'bold' },
            styles: { fontSize: 9, cellPadding: 3, valign: 'middle' },
            columnStyles: {
                0: { cellWidth: 'auto', fontStyle: 'bold' },
                1: { cellWidth: 35, halign: 'center' },
                2: { cellWidth: 35, halign: 'center', fontStyle: 'bold', textColor: [67, 56, 202] },
                3: { cellWidth: 45, halign: 'right', fontStyle: 'bold', textColor: [5, 95, 70] }
            },
            alternateRowStyles: { fillColor: [248, 250, 252] },
            foot: [['TOTAL', '', '', `Rs. ${fmt(grandTotal)}`]],
            footStyles: { fillColor: [235, 240, 255], textColor: [40, 40, 140], fontStyle: 'bold', halign: 'right' }
        });

        doc.save(`Ledger_${monthLabel.replace(/ /g, '_')}.pdf`);
        window.Toast("Ledger PDF Downloaded!");
    },

    downloadLedgerExcel() {
        const monthFilter = document.getElementById('quick-month-filter')?.value;
        let monthLabel = "Overall / Lifetime";
        if (monthFilter) {
            const [y, m] = monthFilter.split('-');
            monthLabel = new Date(y, m - 1).toLocaleString('default', { month: 'long', year: 'numeric' });
        }

        const { customers, overallItems, grandTotal } = this._buildLedgerData(monthFilter);
        if (customers.length === 0) return window.Toast("No billing data found for this period", "error");

        const fmt = (n) => parseFloat(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        const grandFmt = fmt(grandTotal);
        const today = new Date().toLocaleDateString('en-IN');

        const C = {
            brand: '#4338CA', brandDark: '#312E81', brandLight: '#EEF2FF',
            custBg: '#1E1B4B', white: '#FFFFFF',
            colHdr: '#4338CA', rowAlt: '#F8F9FF', rowNorm: '#FFFFFF',
            totalBg: '#ECFDF5', totalTxt: '#065F46', totalBdr: '#6EE7B7',
            grandBg: '#312E81', grandAmt: '#FCD34D',
            summHdr: '#0F172A', summAlt: '#F1F5F9',
            itemHdr: '#1E293B',
            border: '#CBD5E1', textDark: '#1E293B', textMid: '#475569', textLight: '#94A3B8',
        };

        const border = `border:1px solid ${C.border};`;
        const font = `font-family:Calibri,Arial;`;
        const td = (val, extra = '') => `<td style="${border}padding:8px 12px;${font}font-size:11pt;color:${C.textDark};${extra}">${val ?? ''}</td>`;
        const th = (val, extra = '') => `<th style="${border}padding:9px 12px;${font}font-size:11pt;font-weight:bold;background:${C.colHdr};color:${C.white};text-align:center;${extra}">${val}</th>`;

        // ════════════════ SHEET 1: Ledger ════════════════
        let ledgerSheet = `
<table style="border-collapse:collapse;width:100%;${font}">
  <tr><td colspan="4" style="padding:18px 14px 4px;${font}font-size:18pt;font-weight:bold;color:${C.brand};border:none;">Customer Ledger Report</td></tr>
  <tr><td colspan="4" style="padding:2px 14px 8px;${font}font-size:10pt;color:${C.textMid};border:none;">
    Period: <b>${monthLabel}</b> &nbsp;|&nbsp; Generated: <b>${today}</b> &nbsp;|&nbsp; Customers: <b>${customers.length}</b>
  </td></tr>
  <tr>
    <td colspan="2" style="border:none;padding:4px;"></td>
    <td style="padding:10px 14px;${font}font-size:11pt;font-weight:bold;background:${C.grandBg};color:${C.white};border:2px solid ${C.grandBg};">GRAND TOTAL</td>
    <td style="padding:10px 14px;${font}font-size:13pt;font-weight:bold;background:${C.grandBg};color:${C.grandAmt};text-align:right;border:2px solid ${C.grandBg};">Rs. ${grandFmt}</td>
  </tr>
  <tr><td colspan="4" style="border:none;padding:5px;"></td></tr>`;

        customers.forEach((c, ci) => {
            const itemKeys = Object.keys(c.items);
            const totalFmt = fmt(c.total);

            ledgerSheet += `
  <tr>
    <td colspan="4" style="background:${C.custBg};color:${C.white};padding:10px 14px;${font}font-size:12pt;font-weight:bold;border:2px solid ${C.custBg};">
      ${ci + 1}.&nbsp; ${c.name} &nbsp;|&nbsp; ${c.phone} &nbsp;|&nbsp; Orders: ${c.orders}
    </td>
  </tr>
  <tr>${th('Item Name', 'text-align:left;')}${th('Price (Rs)')}${th('Qty')}${th('Amount (Rs)', 'text-align:right;')}</tr>`;

            if (itemKeys.length === 0) {
                ledgerSheet += `<tr><td colspan="4" style="padding:10px;font-style:italic;color:${C.textLight};${border}${font}">No item details</td></tr>`;
            } else {
                itemKeys.forEach((k, idx) => {
                    const d = c.items[k];
                    const q = Number.isInteger(d.qty) ? d.qty : d.qty.toFixed(2);
                    const a = fmt(d.totalAmt);
                    const bg = idx % 2 === 0 ? C.rowNorm : C.rowAlt;
                    ledgerSheet += `
  <tr>
    ${td(k, `font-weight:500;background:${bg};`)}
    ${td(d.price.toLocaleString('en-IN'), `text-align:center;background:${bg};`)}
    ${td(q, `text-align:center;font-weight:bold;color:${C.brand};background:${bg};`)}
    ${td('Rs. ' + a, `text-align:right;font-weight:bold;background:${bg};`)}
  </tr>`;
                });
            }

            // Total row
            ledgerSheet += `
  <tr>
    <td colspan="2" style="${border}padding:8px 12px;background:${C.totalBg};${font}"></td>
    <td style="border:1px solid ${C.totalBdr};padding:8px 12px;${font}font-size:11pt;font-weight:bold;color:${C.totalTxt};text-align:center;background:${C.totalBg};">TOTAL</td>
    <td style="border:1px solid ${C.totalBdr};padding:8px 12px;${font}font-size:12pt;font-weight:bold;color:${C.totalTxt};text-align:right;background:${C.totalBg};">Rs. ${totalFmt}</td>
  </tr>
  <tr><td colspan="4" style="border:none;padding:4px;"></td></tr>`;
        });

        // Bottom grand total
        ledgerSheet += `
  <tr>
    <td colspan="2" style="border:2px solid ${C.grandBg};padding:12px;background:${C.grandBg};"></td>
    <td style="border:2px solid ${C.grandBg};padding:12px 14px;${font}font-size:13pt;font-weight:bold;color:${C.white};text-align:center;background:${C.grandBg};">GRAND TOTAL</td>
    <td style="border:2px solid ${C.grandBg};padding:12px 14px;${font}font-size:14pt;font-weight:bold;color:${C.grandAmt};text-align:right;background:${C.grandBg};">Rs. ${grandFmt}</td>
  </tr>
</table>`;

        // ════════════════ SHEET 2: Item Summary ════════════════
        const itemKeys = Object.keys(overallItems).sort();
        let itemSheet = `
<table style="border-collapse:collapse;width:100%;${font}">
  <tr><td colspan="4" style="padding:18px 14px 4px;${font}font-size:18pt;font-weight:bold;color:${C.itemHdr};border:none;">Overall Item Summary</td></tr>
  <tr><td colspan="4" style="padding:2px 14px 10px;${font}font-size:10pt;color:${C.textMid};border:none;">
    Period: <b>${monthLabel}</b> &nbsp;|&nbsp; Total quantity & amount sold per item
  </td></tr>
  <tr>
    <th style="${border}padding:10px 12px;${font}font-size:11pt;font-weight:bold;background:${C.itemHdr};color:${C.white};text-align:left;">#</th>
    <th style="${border}padding:10px 12px;${font}font-size:11pt;font-weight:bold;background:${C.itemHdr};color:${C.white};text-align:left;">Item Name</th>
    <th style="${border}padding:10px 12px;${font}font-size:11pt;font-weight:bold;background:${C.itemHdr};color:${C.white};text-align:center;">Unit Price (Rs)</th>
    <th style="${border}padding:10px 12px;${font}font-size:11pt;font-weight:bold;background:${C.itemHdr};color:${C.white};text-align:center;">Total Qty Sold</th>
    <th style="${border}padding:10px 12px;${font}font-size:11pt;font-weight:bold;background:${C.itemHdr};color:${C.white};text-align:right;">Total Amount (Rs)</th>
  </tr>`;

        itemKeys.forEach((k, idx) => {
            const d = overallItems[k];
            const q = Number.isInteger(d.qty) ? d.qty : d.qty.toFixed(2);
            const a = fmt(d.totalAmt);
            const bg = idx % 2 === 0 ? C.white : C.summAlt;
            itemSheet += `
  <tr style="background:${bg};">
    <td style="${border}padding:8px 12px;${font}font-size:11pt;text-align:center;color:${C.textMid};background:${bg};">${idx + 1}</td>
    <td style="${border}padding:8px 12px;${font}font-size:11pt;font-weight:bold;color:${C.textDark};background:${bg};">${k}</td>
    <td style="${border}padding:8px 12px;${font}font-size:11pt;text-align:center;background:${bg};">Rs. ${d.price.toLocaleString('en-IN')}</td>
    <td style="${border}padding:8px 12px;${font}font-size:12pt;font-weight:bold;text-align:center;color:${C.brand};background:${bg};">${q}</td>
    <td style="${border}padding:8px 12px;${font}font-size:11pt;font-weight:bold;text-align:right;color:${C.totalTxt};background:${bg};">Rs. ${a}</td>
  </tr>`;
        });

        // Item summary grand total
        itemSheet += `
  <tr>
    <td colspan="3" style="border:2px solid ${C.grandBg};padding:10px 14px;background:${C.grandBg};"></td>
    <td style="border:2px solid ${C.grandBg};padding:10px 14px;${font}font-size:12pt;font-weight:bold;color:${C.white};text-align:center;background:${C.grandBg};">GRAND TOTAL</td>
    <td style="border:2px solid ${C.grandBg};padding:10px 14px;${font}font-size:13pt;font-weight:bold;color:${C.grandAmt};text-align:right;background:${C.grandBg};">Rs. ${grandFmt}</td>
  </tr>
</table>`;

        // ════════════════ SHEET 3: Summary ════════════════
        let summarySheet = `
<table style="border-collapse:collapse;width:100%;${font}">
  <tr><td colspan="5" style="padding:18px 14px 4px;${font}font-size:18pt;font-weight:bold;color:${C.summHdr};border:none;">Customer Summary</td></tr>
  <tr><td colspan="5" style="padding:2px 14px 10px;${font}font-size:10pt;color:${C.textMid};border:none;">
    Period: <b>${monthLabel}</b> &nbsp;|&nbsp; Customers: <b>${customers.length}</b> &nbsp;|&nbsp; Grand Total: <b>Rs. ${grandFmt}</b>
  </td></tr>
  <tr style="background:${C.summHdr};">
    <th style="border:1px solid #334155;padding:10px 12px;${font}font-size:11pt;font-weight:bold;color:${C.white};text-align:center;">#</th>
    <th style="border:1px solid #334155;padding:10px 12px;${font}font-size:11pt;font-weight:bold;color:${C.white};text-align:left;">Customer Name</th>
    <th style="border:1px solid #334155;padding:10px 12px;${font}font-size:11pt;font-weight:bold;color:${C.white};text-align:center;">Phone</th>
    <th style="border:1px solid #334155;padding:10px 12px;${font}font-size:11pt;font-weight:bold;color:${C.white};text-align:center;">Orders</th>
    <th style="border:1px solid #334155;padding:10px 12px;${font}font-size:11pt;font-weight:bold;color:${C.white};text-align:right;">Total Amount (Rs)</th>
  </tr>`;

        customers.sort((a, b) => b.total - a.total).forEach((c, idx) => {
            const bg = idx % 2 === 0 ? C.white : C.summAlt;
            const tf = fmt(c.total);
            summarySheet += `
  <tr style="background:${bg};">
    <td style="${border}padding:8px 12px;${font}font-size:11pt;text-align:center;color:${C.textMid};background:${bg};">${idx + 1}</td>
    <td style="${border}padding:8px 12px;${font}font-size:11pt;font-weight:bold;color:${C.textDark};background:${bg};">${c.name}</td>
    <td style="${border}padding:8px 12px;${font}font-size:11pt;text-align:center;color:${C.brand};font-weight:600;background:${bg};">${c.phone}</td>
    <td style="${border}padding:8px 12px;${font}font-size:11pt;text-align:center;background:${bg};">${c.orders}</td>
    <td style="${border}padding:8px 12px;${font}font-size:11pt;font-weight:bold;text-align:right;color:${C.totalTxt};background:${bg};">Rs. ${tf}</td>
  </tr>`;
        });
        summarySheet += `
  <tr>
    <td colspan="3" style="border:2px solid ${C.grandBg};padding:10px;background:${C.grandBg};"></td>
    <td style="border:2px solid ${C.grandBg};padding:10px 14px;${font}font-size:12pt;font-weight:bold;color:${C.white};text-align:center;background:${C.grandBg};">GRAND TOTAL</td>
    <td style="border:2px solid ${C.grandBg};padding:10px 14px;${font}font-size:13pt;font-weight:bold;color:${C.grandAmt};text-align:right;background:${C.grandBg};">Rs. ${grandFmt}</td>
  </tr>
</table>`;

        // Assemble full HTML workbook (3 sheets via page-break)
        const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office"
      xmlns:x="urn:schemas-microsoft-com:office:excel"
      xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="UTF-8">
<!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets>
  <x:ExcelWorksheet><x:Name>Ledger</x:Name><x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions></x:ExcelWorksheet>
  <x:ExcelWorksheet><x:Name>Item Summary</x:Name><x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions></x:ExcelWorksheet>
  <x:ExcelWorksheet><x:Name>Customer Summary</x:Name><x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions></x:ExcelWorksheet>
</x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]-->
</head><body>
${ledgerSheet}
<br clear="all" style="page-break-before:always">
${itemSheet}
<br clear="all" style="page-break-before:always">
${summarySheet}
</body></html>`;

        const blob = new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = `Ledger_${monthLabel.replace(/ /g, '_')}.xls`;
        document.body.appendChild(a); a.click();
        document.body.removeChild(a); URL.revokeObjectURL(url);
        window.Toast("Excel Downloaded!");
    },

    sendWhatsApp(phone, name, totalGrand) {
        const monthFilter = document.getElementById('quick-month-filter')?.value; // "2026-03"
        let customerBills = this.allBills.filter(b => b.phone === phone);
        let monthLabel = "OVERALL";

        if (monthFilter) {
            const [fYear, fMonth] = monthFilter.split('-'); // ["2026", "03"]

            // स्ट्रिक्ट फिल्टरिंग: केवल वही बिल लें जिनकी तारीख का महीना और साल मैच करे
            customerBills = customerBills.filter(b => {
                const my = Dashboard._getBillMonthYear(b);
                return my && my.month === fMonth && my.year === fYear;
            });

            const [yyyy, mm] = monthFilter.split('-');
            monthLabel = new Date(yyyy, mm - 1).toLocaleString('default', { month: 'long', year: 'numeric' }).toUpperCase();
        }

        // अब जो बिल बचे हैं, केवल उनका सामान (Items) इकट्ठा करें
        const itemSummary = {};
        let finalTotal = 0; // दोबारा कैलकुलेट करें ताकि पुराने महीने का अमाउंट न जुड़े

        customerBills.forEach(bill => {
            if (bill.details && bill.details.items) {
                bill.details.items.forEach(item => {
                    const pName = item.name || "Unknown";
                    if (!itemSummary[pName]) itemSummary[pName] = { qty: 0, totalAmt: 0, price: item.price };

                    const qty = parseFloat(item.qty || 0);
                    const lineTotal = item.price * qty;

                    itemSummary[pName].qty += qty;
                    itemSummary[pName].totalAmt += lineTotal;
                    finalTotal += lineTotal;
                });
            }
        });

        if (customerBills.length === 0) return window.Toast("No bills found for this month", "error");

        let itemDetailsStr = "";
        for (let prodName in itemSummary) {
            const data = itemSummary[prodName];
            const qtyDisp = Number.isInteger(data.qty) ? data.qty : data.qty.toFixed(2);
            itemDetailsStr += `🔹 ${prodName} (${qtyDisp} x ₹${data.price}) = ₹${data.totalAmt.toLocaleString()}\n`;
        }

        const appLink = "https://userdaily-delivery-tracking-billing.vercel.app/";
        const text = `*BILL SUMMARY - ${monthLabel}* 🧾\n` +
            `Customer: ${name}\n` +
            `Phone: ${phone}\n\n` +
            `*Items Purchased:*\n${itemDetailsStr}\n` +
            `----------------\n` +
            `*GRAND TOTAL: ₹${finalTotal.toLocaleString()}*\n` +
            `----------------\n\n` +
            `💸 *PAYMENT DETAILS:*\n` +
            `UPI: 9810017422\n` +
            `📸 Please make the online transaction and share the screenshot for confirmation.\n\n` +
            `👇 *Track your live bills here:*\n${appLink}\n\n` +
            `_Generated by Anadi Billing System_`;

        window.open(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`, '_blank');
    },



};
// 4. HISTORY (Includes Bugs 3 & 6 Fixes)
// 4. HISTORY (Updated with Load More Logic)
window.History = {
    allTransactions: [], // Stores all fetched data
    currentData: [],     // Stores data currently being filtered/viewed
    limit: 50,           // How many to show initially

    init() {
    const list = document.getElementById('history-body');
    list.innerHTML = '<tr><td colspan="6" class="p-8 text-center text-slate-400"><i class="fa-solid fa-circle-notch fa-spin text-2xl"></i><br>Loading Transactions...</td></tr>';

    onValue(ref(db, 'bills'), (snap) => {
        const data = snap.val();
        this.allTransactions = []; 

        if (data) {
            for (let ph in data) {
                for (let id in data[ph]) {
                    const bill = data[ph][id];
                    // Pehle koshish karein details wala timestamp lene ki, phir root wala
                    const ts = bill.details?.timestamp || bill.timestamp || 0;
                    this.allTransactions.push({ ...bill, id, phone: ph, sortTs: ts });
                }
            }
        }

        // --- SABSE RECENT UPAR DIKHANE KE LIYE ---
        this.allTransactions.sort((a, b) => b.sortTs - a.sortTs);
        
        this.limit = 50;
        this.render(this.allTransactions);
    });
},
    // Checkboxes select/deselect karne ke liye
toggleAll(masterCheckbox) {
    const checkboxes = document.querySelectorAll('.bill-checkbox');
    checkboxes.forEach(cb => cb.checked = masterCheckbox.checked);
    this.updateDeleteButton();
},

// UI mein Delete button dikhane/chupane ke liye
updateDeleteButton() {
    const checked = document.querySelectorAll('.bill-checkbox:checked');
    const btn = document.getElementById('bulk-delete-btn');
    const countEl = document.getElementById('selected-count');
    
    if (checked.length > 0) {
        btn.classList.remove('hidden');
        countEl.innerText = checked.length;
    } else {
        btn.classList.add('hidden');
        document.getElementById('history-select-all').checked = false;
    }
},

// Multiple Bills delete karne ka main function
async deleteSelected() {
    const selected = document.querySelectorAll('.bill-checkbox:checked');
    if (selected.length === 0) return;

    if (!confirm(`Are you sure you want to delete ${selected.length} transactions? This cannot be undone.`)) return;

    const updates = {};
    selected.forEach(cb => {
        const phone = cb.dataset.phone;
        const id = cb.dataset.id;
        // Firebase multi-path update for bulk delete
        updates[`bills/${phone}/${id}`] = null;
    });

    try {
        await update(ref(db), updates);
        window.Toast(`${selected.length} bills deleted successfully`);
        document.getElementById('history-select-all').checked = false;
        this.updateDeleteButton();
    } catch (err) {
        console.error(err);
        window.Toast("Error deleting multiple records", "error");
    }
},
    filter(query) {
        const term = (query || '').toLowerCase().trim();

        // Reset limit when searching so user sees top results immediately
        this.limit = 50;

        if (!term) {
            this.render(this.allTransactions);
            return;
        }

        const filtered = this.allTransactions.filter(b => {
            const name = (b.details?.consumerName || '').toLowerCase();
            const phone = (b.phone || '').toString();
            const userObj = State.users[b.phone];
            const address = (userObj && userObj.address) ? userObj.address.toLowerCase() : '';
            return name.includes(term) || phone.includes(term) || address.includes(term);
        });

        this.render(filtered);
    },

    loadMore() {
        // Increase limit by 50
        this.limit += 50;
        // Re-render the current dataset (whether filtered or full)
        this.render(this.currentData, false); // false = don't reset view, just append
    },

    render(transactions, resetScroll = true) {
        // Update current reference for Load More to work
        this.currentData = transactions;

        const list = document.getElementById('history-body');
        const btnContainer = document.getElementById('history-load-more-container');
        const countShow = document.getElementById('hist-showing-count');
        const countTotal = document.getElementById('hist-total-count');

        if (transactions.length === 0) {
            list.innerHTML = '<tr><td colspan="5" class="p-8 text-center text-slate-400 italic">No Transactions Found</td></tr>';
            if (btnContainer) btnContainer.classList.add('hidden');
            return;
        }

        // --- THE MAGIC: Slice data based on limit ---
        const visibleTransactions = transactions.slice(0, this.limit);

        let html = '';
        visibleTransactions.forEach(b => {
            const name = b.details?.consumerName || 'Unknown';
            const phone = b.phone;
            const userObj = State.users[phone];
            const address = (userObj && userObj.address) ? userObj.address : '<span class="text-slate-300 italic">No Address</span>';

            // Safe Date Parsing
            let displayDate = b.date;
            let displayTime = '';
            try {
                const dObj = new Date(b.details?.timestamp || 0);
                displayTime = dObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            } catch (e) { displayTime = '-'; }

            let itemsHtml = '';
            if (b.details && b.details.items && Array.isArray(b.details.items)) {
                itemsHtml = b.details.items.map(item => `
                    <div class="flex justify-between items-center border-b border-slate-50 last:border-0 py-1">
                        <span class="text-slate-700 font-medium">${item.name} <span class="text-slate-400 text-xs">x${item.qty}</span></span>
                        <span class="text-slate-400 text-xs">₹${item.price * item.qty}</span>
                    </div>`).join('');
            } else {
                itemsHtml = `<span class="text-slate-500 italic">${b.item || 'Order Details Unavailable'}</span>`;
            }

            html += `
            <tr class="hover:bg-slate-50 transition group align-top">
                <!-- 1. CHECKBOX COLUMN (YE ABHI ADD KIYA HAI) -->
                <td class="p-4 pt-5">
                    <input type="checkbox" class="bill-checkbox w-4 h-4 rounded border-slate-300 text-brand cursor-pointer" 
                        data-phone="${phone}" data-id="${b.id}" onchange="History.updateDeleteButton()">
                </td>

                <!-- 2. DATE COLUMN (YE PEHLE SE THA) -->
                <td class="p-4 text-xs font-mono text-slate-500 whitespace-nowrap pt-5">
                    ${displayDate}<br><span class="text-[10px] opacity-60 text-slate-400">${displayTime}</span>
                </td>
                    <td class="p-4 pt-5">
                        <div class="font-bold text-slate-800">${name}</div>
                        <div class="text-xs text-brand font-mono my-1"><i class="fa-solid fa-phone text-[10px]"></i> ${phone}</div>
                        <div class="text-xs text-slate-500 leading-snug"><i class="fa-solid fa-map-pin text-[10px] mr-1"></i> ${address}</div>
                    </td>
                    <td class="p-4">
                        <div class="bg-slate-50/50 rounded-lg p-2 border border-slate-100 text-sm max-h-32 overflow-y-auto custom-scrollbar">${itemsHtml}</div>
                    </td>
                    <td class="p-4 text-right pt-5">
                        <div class="font-bold text-emerald-600 text-lg">₹${b.amount}</div>
                        <div class="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Paid</div>
                    </td>
                    <td class="p-4 text-center pt-5">
                        <div class="flex justify-center gap-2">
                            <button onclick="History.edit('${b.phone}','${b.id}')" class="text-blue-400 hover:text-blue-600 hover:bg-blue-50 p-2 rounded-full transition"><i class="fa-solid fa-pen"></i></button>
                            <button onclick="History.del('${b.phone}','${b.id}')" class="text-red-300 hover:text-red-500 hover:bg-red-50 p-2 rounded-full transition"><i class="fa-solid fa-trash"></i></button>
                        </div>
                    </td>
                </tr>`;
        });

        list.innerHTML = html;

        // --- BUTTON LOGIC ---
        if (btnContainer) {
            // Agar total data zyada hai current limit se, tabhi button dikhao
            if (transactions.length > this.limit) {
                btnContainer.classList.remove('hidden');
                if (countShow) countShow.innerText = visibleTransactions.length;
                if (countTotal) countTotal.innerText = transactions.length;
            } else {
                btnContainer.classList.add('hidden');
            }
        }
    },

    // ... edit, saveUpdate, closeModal, del (Baki functions same rahenge) ...
    edit(phone, id) {
        const bill = this.allTransactions.find(b => b.id === id && b.phone === phone);
        if (bill) {
            document.getElementById('edit-bill-id').value = id;
            document.getElementById('edit-bill-phone').value = phone;
            document.getElementById('edit-name').value = bill.details?.consumerName || 'Unknown';
            document.getElementById('edit-amount').value = bill.amount;
            document.getElementById('edit-date').value = bill.date;
            document.getElementById('edit-modal').classList.remove('hidden');
        } else { window.Toast("Error loading transaction", "error"); }
    },
    saveUpdate() {
        const id = document.getElementById('edit-bill-id').value;
        const phone = document.getElementById('edit-bill-phone').value;
        const newName = document.getElementById('edit-name').value;
        const newAmount = parseFloat(document.getElementById('edit-amount').value);
        const newDate = document.getElementById('edit-date').value;

        if (isNaN(newAmount) || !newName) return window.Toast("Invalid details", "error");

        const updates = {};
        updates[`bills/${phone}/${id}/amount`] = newAmount;
        updates[`bills/${phone}/${id}/date`] = newDate;
        updates[`bills/${phone}/${id}/details/consumerName`] = newName;
        updates[`bills/${phone}/${id}/details/totalAmount`] = newAmount;
        updates[`bills/${phone}/${id}/details/date`] = newDate;

        update(ref(db), updates).then(() => {
            window.Toast("Transaction Updated");
            this.closeModal();
        });
    },
    closeModal() { document.getElementById('edit-modal').classList.add('hidden'); },
    del(ph, id) { if (confirm("Delete this transaction permanently?")) remove(ref(db, `bills/${ph}/${id}`)); }
};

// 5. SHARE (Simple module)
// 5. SHARE (Updated with Fixed Link)
window.Share = {
    // Yahan humne aapka fixed link hardcode kar diya hai
    finalUrl: 'https://userdaily-delivery-tracking-billing.vercel.app/',

    init() {
        const container = document.getElementById('qrcode');
        if (!container) return;
        container.innerHTML = '';

        // QR Code ab hamesha finalUrl ka banega
        new QRCode(container, {
            text: this.finalUrl,
            width: 200,
            height: 200,
            colorDark: "#000000",
            colorLight: "#ffffff",
            correctLevel: QRCode.CorrectLevel.H
        });

        // Input box me bhi wahi link dikhega
        document.getElementById('share-link-input').value = this.finalUrl;
    },

    copyLink() {
        const input = document.getElementById('share-link-input');
        input.select();
        input.setSelectionRange(0, 99999);
        navigator.clipboard.writeText(this.finalUrl).then(() => window.Toast("Link Copied!"));
    },

    shareWhatsApp() {
        // Share tab wala WhatsApp button
        const msg = encodeURIComponent(`Hello! View your bill history here: ${this.finalUrl}`);
        window.open(`https://wa.me/?text=${msg}`, '_blank');
    },

    printStandee() {
        const printContainer = document.getElementById('qrcode-print');
        printContainer.innerHTML = '';
        // Standee QR bhi fixed link use karega
        new QRCode(printContainer, { text: this.finalUrl, width: 300, height: 300 });
        setTimeout(() => window.print(), 500);
    }
};

// INIT
window.addEventListener('DOMContentLoaded', () => {
    // Initialize Multi-Date Calendar
    State.fp = flatpickr("#pos-date", {
        mode: "multiple",
        dateFormat: "Y-m-d",
        defaultDate: "today",
        conjunction: ", " // Dates ke beech mein comma dikhega
    });

    router('billing');
    Manage.initListeners();
    History.init();
});
