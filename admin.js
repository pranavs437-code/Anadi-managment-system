import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, push, set, onValue, remove, update, off } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

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
const State = { products: {}, users: {}, cart: [], currentUser: null };

// --- UI UTILS ---
window.toggleSidebar = () => {
    document.getElementById('sidebar').classList.toggle('-translate-x-full');
    document.getElementById('sidebar-backdrop').classList.toggle('hidden');
};

window.Toast = (msg, type = 'success') => {
    const container = document.getElementById('toast-container');
    if(!container) return; // Safety check

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
            priceInput.value = selectedOpt.dataset.price;
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
    checkout() {
        if (!State.currentUser) return window.Toast("Select Customer", "error");
        if (State.cart.length === 0) return window.Toast("Cart is Empty", "error");

        const total = parseFloat(document.getElementById('summ-total').innerText);
        // ✅ FIX BUG 3: Date Validation
        const dateInput = document.getElementById('pos-date').value;
        if(!dateInput) return window.Toast("Please select a date", "error");

        const data = {
            consumerName: State.currentUser.name,
            consumerPhone: State.currentUser.phone,
            items: State.cart,
            totalAmount: total,
            date: new Date(dateInput).toLocaleDateString(),
            timestamp: Date.now()
        };

        push(ref(db, `bills/${State.currentUser.phone}`), {
            item: `Order (${State.cart.length} items)`,
            amount: total,
            date: data.date,
            details: data
        }).then(() => {
            window.Toast("Bill Generated Successfully!");
            State.cart = [];
            this.renderCart();
            // Dashboard updates automatically via listener
        }).catch(err => {
            console.error(err);
            window.Toast("Network Error: Could not save bill", "error");
        });
    }
};

// 2. MANAGEMENT
window.Manage = {
    editProdId: null,

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

    saveUser() {
        const name = document.getElementById('man-user-name').value.trim();
        const phone = document.getElementById('man-user-phone').value.trim();
        const address = document.getElementById('man-user-address').value.trim();

        // ✅ FIX BUG 2: Phone Validation Regex
        const phoneRegex = /^[0-9]{10}$/;
        if (!name) return window.Toast("Name is required", "error");
        if (!phoneRegex.test(phone)) return window.Toast("Phone must be 10 digits", "error");

        update(ref(db, `users/${phone}`), { name, phone, address }).then(() => {
            window.Toast(document.getElementById('btn-save-user').innerText === "Update Customer" ? "Customer Updated" : "Customer Registered");
            this.resetUserForm();
        });
    },
    delUser(ph, name) { 
        // ✅ FIX BUG 7: Stronger Confirmation
        if (confirm(`Delete customer "${name}" (${ph})?`)) { 
            remove(ref(db, `users/${ph}`)); 
            if (document.getElementById('man-user-phone').value === ph) this.resetUserForm(); 
        } 
    },
    // ... editUser & resetUserForm remain same ...
    editUser(phone) {
        const u = State.users[phone];
        document.getElementById('man-user-name').value = u.name;
        document.getElementById('man-user-phone').value = u.phone;
        document.getElementById('man-user-address').value = u.address || "";
        document.getElementById('man-user-phone').readOnly = true;
        document.getElementById('man-user-phone').classList.add('bg-slate-200', 'text-slate-500');
        document.getElementById('btn-save-user').innerText = "Update Customer";
        document.getElementById('btn-save-user').classList.add('bg-orange-600', 'hover:bg-orange-700');
        document.getElementById('btn-cancel-user').classList.remove('hidden');
    },
    resetUserForm() {
        document.getElementById('man-user-name').value = '';
        document.getElementById('man-user-phone').value = '';
        document.getElementById('man-user-address').value = '';
        document.getElementById('man-user-phone').readOnly = false;
        document.getElementById('man-user-phone').classList.remove('bg-slate-200', 'text-slate-500');
        document.getElementById('btn-save-user').innerText = "Register Customer";
        document.getElementById('btn-save-user').classList.remove('bg-orange-600', 'hover:bg-orange-700');
        document.getElementById('btn-cancel-user').classList.add('hidden');
    },
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
window.Dashboard = {
    allBills: [],
    customerTotals: [],
    listenerAttached: false,

    init() {
        // UI Updates always run
        document.getElementById('dash-products').innerText = Object.keys(State.products || {}).length;
        const now = new Date();
        const dateEl = document.getElementById('dash-today-date');
        const monthEl = document.getElementById('dash-month-name');
        if (dateEl) dateEl.innerText = now.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'short' });
        if (monthEl) monthEl.innerText = now.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

        // Database Listener - Only attach ONCE
        if (this.listenerAttached) {
            if(this.allBills.length > 0) {
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
                        if(bill.details?.timestamp) ts = bill.details.timestamp;
                        else if(bill.date) ts = new Date(bill.date).getTime();
                        
                        this.allBills.push({ ...bill, timestamp: ts || 0, phone: ph });
                    }
                }
            }
            
            this.calculateStats();
            this.renderProductStats();
        });
    },

    renderProductStats() {
        const grid = document.getElementById('dash-prod-stats');
        if (!grid) return;
        grid.innerHTML = ''; 

        const productCounts = {};
        for (let id in State.products) {
            const pName = State.products[id].name;
            productCounts[pName] = 0; 
        }

        this.allBills.forEach(bill => {
            if (bill.details && bill.details.items) {
                bill.details.items.forEach(item => {
                    const name = item.name || "Unknown";
                    const qty = parseFloat(item.qty || 0); // Changed to parseFloat for decimals

                    if (productCounts[name] !== undefined) {
                        productCounts[name] += qty;
                    } else {
                        productCounts[name] = qty;
                    }
                });
            }
        });

        if (Object.keys(productCounts).length === 0) {
            grid.innerHTML = `<div class="col-span-full text-slate-400 text-sm italic p-4 border rounded-lg bg-slate-50">No sales data available yet.</div>`;
            return;
        }

        let html = '';
        for (let pName in productCounts) {
            const totalQty = productCounts[pName];
            // Fix long decimal points (e.g., 0.3000004 -> 0.3)
            const displayQty = Number.isInteger(totalQty) ? totalQty : totalQty.toFixed(2);
            
            html += `
                <div class="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col items-center text-center hover:shadow-md hover:border-brand/30 transition group">
                    <div class="bg-indigo-50 text-brand w-10 h-10 rounded-full flex items-center justify-center mb-2 group-hover:scale-110 transition">
                        <i class="fa-solid fa-box-open"></i>
                    </div>
                    <h4 class="font-bold text-slate-700 text-sm truncate w-full" title="${pName}">${pName}</h4>
                    <p class="text-[10px] text-slate-400 mt-1 uppercase font-bold tracking-wider">Total Sold</p>
                    <p class="font-bold text-slate-800 text-xl mt-0.5">${displayQty} <span class="text-[10px] text-slate-500 font-normal">Units</span></p>
                </div>`;
        }
        grid.innerHTML = html;
    },

    calculateStats() {
        const now = new Date();
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
        let totalSales = 0, todaySales = 0, monthSales = 0, totalOrders = 0;
        this.allBills.forEach(b => {
            const amt = parseFloat(b.amount || 0);
            totalSales += amt; totalOrders++;
            if (b.timestamp >= startOfDay) todaySales += amt;
            if (b.timestamp >= startOfMonth) monthSales += amt;
        });
        const safeSet = (id, val) => { const el = document.getElementById(id); if(el) el.innerText = val; };
        safeSet('dash-sales', totalSales.toLocaleString());
        safeSet('dash-orders', totalOrders);
        safeSet('dash-today', todaySales.toLocaleString());
        safeSet('dash-month', monthSales.toLocaleString());
    },
    
    applyFilter() {
        const startVal = document.getElementById('filter-start').value;
        const endVal = document.getElementById('filter-end').value;
        if (!startVal || !endVal) return window.Toast("Select Start & End Date", "error");
        
        const startDate = new Date(startVal).getTime();
        const endDate = new Date(endVal);
        endDate.setHours(23, 59, 59, 999);
        
        if (startDate > endDate.getTime()) return window.Toast("Invalid Date Range", "error");
        
        let rangeTotal = 0, count = 0;
        this.allBills.forEach(b => {
            if (b.timestamp >= startDate && b.timestamp <= endDate.getTime()) {
                rangeTotal += parseFloat(b.amount || 0); count++;
            }
        });
        document.getElementById('filter-result').innerText = rangeTotal.toLocaleString();
        window.Toast(`Found ${count} orders`);
    },

    openQuickAction() {
        const totalsMap = {};
        this.allBills.forEach(b => {
            if (!totalsMap[b.phone]) totalsMap[b.phone] = 0;
            totalsMap[b.phone] += parseFloat(b.amount || 0);
        });
        this.customerTotals = [];
        const allPhones = new Set([...Object.keys(totalsMap), ...Object.keys(State.users || {})]);
        allPhones.forEach(phone => {
            const user = State.users[phone] || {};
            const billTotal = totalsMap[phone] || 0;
            if (billTotal > 0 || user.name) {
                this.customerTotals.push({ name: user.name || 'Unknown Guest', phone: phone, total: billTotal });
            }
        });
        this.customerTotals.sort((a, b) => b.total - a.total);
        this.renderQuickList();
        document.getElementById('quick-modal').classList.remove('hidden');
    },

    renderQuickList(query = '') {
        const list = document.getElementById('quick-list-body');
        if (!list) return;
        const term = (query || '').toLowerCase().trim();
        const filtered = this.customerTotals.filter(c => (c.name || '').toLowerCase().includes(term) || (c.phone || '').includes(term));
        
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
                     <button onclick="Dashboard.downloadCustomerStatement('${c.phone}', '${c.name}')" class="bg-red-100 hover:bg-red-200 text-red-600 w-9 h-9 rounded-full flex items-center justify-center transition shadow-sm"><i class="fa-solid fa-file-pdf"></i></button>
                    <button onclick="Dashboard.sendWhatsApp('${c.phone}', '${c.name}', ${c.total})" class="bg-[#25D366] hover:bg-[#1ebc57] text-white px-4 py-2 rounded-full flex items-center gap-2 text-xs font-bold shadow-md"><i class="fa-brands fa-whatsapp text-lg"></i> Send</button>
                </div>
            </div>`).join('');
    },

    // --- RESTORED FUNCTIONS ---

    downloadCustomerStatement(phone, name) {
        const { jsPDF } = window.jspdf;
        if (!jsPDF) return window.Toast("PDF Library Error", "error");

        const customerBills = this.allBills.filter(b => b.phone === phone);
        if (customerBills.length === 0) return window.Toast("No history found", "error");

        const itemSummary = {};
        let grandTotal = 0;

        customerBills.forEach(bill => {
            if (bill.details && bill.details.items) {
                bill.details.items.forEach(item => {
                    const pName = item.name || "Unknown Item";
                    if (!itemSummary[pName]) itemSummary[pName] = { qty: 0, totalAmt: 0, price: item.price };
                    
                    itemSummary[pName].qty += parseFloat(item.qty || 0);
                    const itemTotal = item.price * parseFloat(item.qty || 0);
                    itemSummary[pName].totalAmt += itemTotal;
                    grandTotal += itemTotal;
                });
            }
        });

        const tableBody = Object.keys(itemSummary).map(itemName => {
            const data = itemSummary[itemName];
            // Format Qty (remove extra decimals if integer)
            const qtyDisp = Number.isInteger(data.qty) ? data.qty : data.qty.toFixed(2);
            return [itemName, data.price, qtyDisp, data.totalAmt.toLocaleString()];
        });

        const doc = new jsPDF();
        doc.setFontSize(18);
        doc.setTextColor(67, 56, 202);
        doc.text("Customer Purchase Statement", 14, 20);
        doc.setFontSize(10);
        doc.setTextColor(100);
        doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 14, 26);

        doc.setDrawColor(200);
        doc.setFillColor(248, 250, 252);
        doc.rect(14, 30, 182, 20, 'F');
        doc.setFontSize(11);
        doc.setTextColor(0);
        doc.text(`Customer Name: ${name}`, 18, 38);
        doc.text(`Phone Number: ${phone}`, 18, 45);

        doc.autoTable({
            head: [['Item Name', 'Price (Rs)', 'Qty', 'Amount (Rs)']],
            body: tableBody,
            startY: 55,
            theme: 'grid',
            headStyles: { fillColor: [67, 56, 202] },
            columnStyles: { 3: { halign: 'right', fontStyle: 'bold' } },
            foot: [['', '', 'TOTAL:', `Rs. ${grandTotal.toLocaleString()}`]],
            footStyles: { fillColor: [240, 253, 244], textColor: [0, 0, 0], fontStyle: 'bold' }
        });

        doc.save(`${name}_Statement.pdf`);
        window.Toast("Downloading PDF...");
    },

    // REPLACE YOUR OLD downloadLedgerPDF FUNCTION WITH THIS:

    downloadLedgerPDF() {
        const { jsPDF } = window.jspdf;
        if (!jsPDF) return window.Toast("PDF Library Error", "error");
        
        // Data Check
        if (!this.customerTotals || this.customerTotals.length === 0) {
            return window.Toast("No data to download", "error");
        }

        const doc = new jsPDF();

        // --- Header ---
        doc.setFontSize(18);
        doc.setTextColor(67, 56, 202); // Brand Indigo
        doc.text("Detailed Customer Ledger", 14, 22);
        
        doc.setFontSize(10);
        doc.setTextColor(100);
        doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 14, 28);
        doc.text(`Total Customers: ${this.customerTotals.length}`, 14, 33);

        // --- Prepare Table Data ---
        const tableBody = this.customerTotals.map(c => {
            
            // 1. Get all bills for this customer
            const custBills = this.allBills.filter(b => b.phone === c.phone);

            // 2. Aggregate Items (Combine duplicates)
            const itemSummary = {};
            custBills.forEach(bill => {
                if (bill.details && bill.details.items) {
                    bill.details.items.forEach(item => {
                        const pName = item.name || "Unknown";
                        // Init object if new
                        if (!itemSummary[pName]) {
                            itemSummary[pName] = { qty: 0, total: 0, price: item.price };
                        }
                        
                        // Add values
                        const qty = parseFloat(item.qty || 0);
                        itemSummary[pName].qty += qty;
                        itemSummary[pName].total += (item.price * qty);
                    });
                }
            });

            // 3. Format List String for PDF Cell
            // Example: "• Milk (2 x 50) = 100"
            let itemDetailsString = "";
            const itemKeys = Object.keys(itemSummary);
            
            if(itemKeys.length > 0) {
                itemDetailsString = itemKeys.map(k => {
                    const d = itemSummary[k];
                    // Clean up decimals for quantity
                    const qtyDisp = Number.isInteger(d.qty) ? d.qty : d.qty.toFixed(2);
                    return `• ${k} (${qtyDisp} x ${d.price}) = ${d.total.toLocaleString()}`;
                }).join("\n");
            } else {
                itemDetailsString = "No Item Details";
            }

            // 4. Return Row Array
            return [
                `${c.name}\n${c.phone}`,       // Col 1: Customer Info
                itemDetailsString,              // Col 2: Item List (Name, Qty, Price)
                `Rs. ${c.total.toLocaleString()}` // Col 3: Grand Total
            ];
        });

        // --- Generate Table ---
        doc.autoTable({
            head: [['Customer', 'Purchased Items History (Qty x Price)', 'Grand Total']],
            body: tableBody,
            startY: 40,
            theme: 'grid',
            headStyles: { 
                fillColor: [67, 56, 202], 
                halign: 'center',
                valign: 'middle'
            },
            styles: { 
                fontSize: 9, 
                cellPadding: 3, 
                valign: 'top',      // Align text to top so lists look good
                overflow: 'linebreak' 
            },
            columnStyles: {
                0: { cellWidth: 40 }, // Customer column width
                1: { cellWidth: 'auto' }, // Items column takes remaining space
                2: { cellWidth: 35, halign: 'right', fontStyle: 'bold' } // Total column
            },
            alternateRowStyles: { fillColor: [248, 250, 252] }
        });

        // --- Save ---
        doc.save('Detailed_Ledger_Report.pdf');
        window.Toast("Detailed Ledger Downloaded!");
    },

    sendWhatsApp(phone, name, totalGrand) {
        const customerBills = this.allBills.filter(b => b.phone === phone);
        const itemSummary = {};

        customerBills.forEach(bill => {
            if (bill.details && bill.details.items) {
                bill.details.items.forEach(item => {
                    const pName = item.name || "Unknown";
                    if (!itemSummary[pName]) itemSummary[pName] = { qty: 0, totalAmt: 0, price: item.price };
                    
                    itemSummary[pName].qty += parseFloat(item.qty || 0);
                    itemSummary[pName].totalAmt += (item.price * parseFloat(item.qty || 0));
                });
            }
        });

        let itemDetailsStr = "";
        for (let prodName in itemSummary) {
            const data = itemSummary[prodName];
            const qtyDisp = Number.isInteger(data.qty) ? data.qty : data.qty.toFixed(2);
            itemDetailsStr += `🔹 ${prodName} (${qtyDisp} x ₹${data.price}) = ₹${data.totalAmt.toLocaleString()}\n`;
        }

        let appLink = window.location.href.replace('admin.html', 'user.html').split('#')[0];
        if (!appLink.includes('user.html')) appLink = window.location.origin + '/user.html';

        const text = `*BILL SUMMARY* 🧾\nCustomer: ${name}\nPhone: ${phone}\n\n*Items Purchased:*\n${itemDetailsStr}\n----------------\n*GRAND TOTAL: ₹${totalGrand.toLocaleString()}*\n----------------\n\n👇 *Track your bills here:*\n${appLink}\n\nThank you!`;

        window.open(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`, '_blank');
    }
};
// 4. HISTORY (Includes Bugs 3 & 6 Fixes)
window.History = {
    allTransactions: [], 

    init() {
        const list = document.getElementById('history-body');
        list.innerHTML = '<tr><td colspan="5" class="p-8 text-center text-slate-400"><i class="fa-solid fa-circle-notch fa-spin text-2xl"></i><br>Loading Transactions...</td></tr>';

        onValue(ref(db, 'bills'), (snap) => {
            const data = snap.val();
            this.allTransactions = []; 

            if (!data) {
                this.render([]);
                return;
            }
            for (let ph in data) {
                for (let id in data[ph]) {
                    this.allTransactions.push({ ...data[ph][id], id, phone: ph });
                }
            }
            // Sort Descending
            this.allTransactions.sort((a, b) => (b.details?.timestamp || 0) - (a.details?.timestamp || 0));
            this.render(this.allTransactions);
        });
    },

    filter(query) {
        const term = (query || '').toLowerCase().trim();
        if (!term) { this.render(this.allTransactions); return; }

        const filtered = this.allTransactions.filter(b => {
            const name = (b.details?.consumerName || '').toLowerCase();
            const phone = (b.phone || '').toString();
            const userObj = State.users[b.phone];
            const address = (userObj && userObj.address) ? userObj.address.toLowerCase() : '';
            return name.includes(term) || phone.includes(term) || address.includes(term);
        });
        this.render(filtered);
    },

    render(transactions) {
        const list = document.getElementById('history-body');
        list.innerHTML = '';
        if (transactions.length === 0) {
            list.innerHTML = '<tr><td colspan="5" class="p-8 text-center text-slate-400 italic">No Transactions Found</td></tr>';
            return;
        }

        let html = '';
        transactions.forEach(b => {
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
            } catch(e) { displayTime = '-'; }

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
    },
    // ... edit, saveUpdate, closeModal, del (standard logic) ...
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
window.Share = {
    finalUrl: '',
    init() {
        const container = document.getElementById('qrcode');
        container.innerHTML = ''; 
        const url = window.location.href.replace('admin.html', 'user.html').split('#')[0];
        this.finalUrl = url.includes('user.html') ? url : window.location.origin + '/user.html';
        new QRCode(container, { text: this.finalUrl, width: 200, height: 200, colorDark: "#000000", colorLight: "#ffffff", correctLevel: QRCode.CorrectLevel.H });
        document.getElementById('share-link-input').value = this.finalUrl;
    },
    copyLink() {
        const input = document.getElementById('share-link-input');
        input.select();
        input.setSelectionRange(0, 99999);
        navigator.clipboard.writeText(this.finalUrl).then(() => window.Toast("Link Copied!"));
    },
    shareWhatsApp() {
        const msg = encodeURIComponent(`Hello! View your bill history here: ${this.finalUrl}`);
        window.open(`https://wa.me/?text=${msg}`, '_blank');
    },
    printStandee() {
        const printContainer = document.getElementById('qrcode-print');
        printContainer.innerHTML = '';
        new QRCode(printContainer, { text: this.finalUrl, width: 300, height: 300 });
        setTimeout(() => window.print(), 500);
    }
};

// INIT
window.addEventListener('DOMContentLoaded', () => {
    document.getElementById('pos-date').valueAsDate = new Date();
    router('billing');
    Manage.initListeners();
    History.init();
});
