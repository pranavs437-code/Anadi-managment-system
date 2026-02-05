import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, push, set, onValue, remove, update } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

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
    const el = document.createElement('div');
    el.className = `p-4 rounded-xl shadow-lg border-l-4 bg-white animate-bounce flex items-center gap-2 ${type === 'error' ? 'border-red-500 text-red-600' : 'border-emerald-500 text-slate-800'}`;
    el.innerHTML = `<i class="fa-solid ${type === 'error' ? 'fa-circle-exclamation' : 'fa-circle-check'}"></i> <span class="font-bold text-sm">${msg}</span>`;
    document.getElementById('toast-container').appendChild(el);
    setTimeout(() => el.remove(), 3000);
};

window.router = (view) => {
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
        document.getElementById('page-title-mob').innerText = titles[view];
    }

    if (view === 'dashboard') Dashboard.init();
    if (view === 'share') Share.init();
};

// --- MODULES ---

// 1. BILLING (New Logic)
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
    // REPLACE Billing.addItemManual inside window.Billing object

    addItemManual() {
        const select = document.getElementById('pos-product-select');
        const qtyInput = document.getElementById('pos-qty');
        const priceInput = document.getElementById('pos-price'); // Get Price Input

        const id = select.value;
        const name = select.options[select.selectedIndex]?.text || "Custom Item"; // Handle name
        const qty = parseInt(qtyInput.value);

        // CHANGE: Ab hum price input box se value le rahe hain, na ki database se
        const manualPrice = parseFloat(priceInput.value);

        if (!id) return window.Toast("Please select a product", "error");
        if (!manualPrice || manualPrice < 0) return window.Toast("Invalid Price", "error");
        if (!qty || qty < 1) return window.Toast("Invalid quantity", "error");

        const exist = State.cart.find(i => i.id === id && i.price === manualPrice);

        if (exist) {
            exist.qty += qty;
            exist.total = exist.qty * manualPrice;
        } else {
            // Use manualPrice here
            State.cart.push({ id, name: name, price: manualPrice, qty: qty, total: manualPrice * qty });
        }

        this.renderCart();
        window.Toast("Item Added");

        // Reset Inputs (Optional: Keep price if you want to add same item multiple times)
        // select.value = ""; 
        // priceInput.value = ""; 
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
        if (confirm("Clear Cart?")) {
            State.cart = [];
            this.renderCart();
        }
    },
    renderCart() {
        const list = document.getElementById('cart-list');
        list.innerHTML = '';
        let total = 0, count = 0;

        if (State.cart.length === 0) {
            list.innerHTML = `
                <div class="h-full flex flex-col items-center justify-center text-slate-300">
                    <i class="fa-solid fa-basket-shopping text-5xl mb-3 opacity-20"></i>
                    <p class="text-sm font-medium">Cart is empty</p>
                </div>`;
        }

        State.cart.forEach((i, idx) => {
            total += i.total; count += i.qty;
            list.innerHTML += `
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

        document.getElementById('summ-count').innerText = count;
        document.getElementById('summ-sub').innerText = total;
        document.getElementById('summ-total').innerText = total;
    },
    removeItem(idx) {
        State.cart.splice(idx, 1);
        this.renderCart();
    },
    checkout() {
        if (!State.currentUser) return window.Toast("Select Customer", "error");
        if (State.cart.length === 0) return window.Toast("Cart is Empty", "error");

        const total = parseFloat(document.getElementById('summ-total').innerText);
        const dateVal = document.getElementById('pos-date').value;

        const data = {
            consumerName: State.currentUser.name,
            consumerPhone: State.currentUser.phone,
            items: State.cart,
            totalAmount: total,
            date: new Date(dateVal).toLocaleDateString(),
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
            Dashboard.init();
        });
    }
};

// 2. MANAGEMENT
// REPLACE THE ENTIRE window.Manage OBJECT WITH THIS

// REPLACE THE ENTIRE window.Manage OBJECT WITH THIS

window.Manage = {
    editProdId: null,

    initListeners() {
        // --- PRODUCTS LISTENER ---
        onValue(ref(db, 'products'), (snap) => {
            State.products = snap.val() || {};
            Billing.populateDropdown();
            Dashboard.init();

            const list = document.getElementById('manage-prod-list');
            list.innerHTML = '';

            if (Object.keys(State.products).length === 0) {
                list.innerHTML = '<div class="text-center text-slate-400 py-4 italic">No products added.</div>';
            }

            for (let id in State.products) {
                const p = State.products[id];
                list.innerHTML += `
                    <div class="flex justify-between items-center p-3 bg-slate-50 border border-slate-100 rounded-lg hover:shadow-sm transition group">
                        <div>
                            <div class="font-bold text-slate-700">${p.name}</div>
                            <div class="text-xs text-slate-500 font-mono">₹${p.price}</div>
                        </div>
                        <div class="flex gap-2 opacity-100 lg:opacity-0 group-hover:opacity-100 transition">
                            <button onclick="Manage.editProd('${id}')" class="text-blue-500 hover:bg-blue-50 p-2 rounded-lg" title="Edit"><i class="fa-solid fa-pen-to-square"></i></button>
                            <button onclick="Manage.delProd('${id}')" class="text-red-500 hover:bg-red-50 p-2 rounded-lg" title="Delete"><i class="fa-solid fa-trash"></i></button>
                        </div>
                    </div>`;
            }
        });

        // --- USERS LISTENER ---
        onValue(ref(db, 'users'), (snap) => {
            State.users = snap.val() || {};
            Dashboard.init(); // Update dashboard counts

            // 1. Populate Dropdown for Billing (Always shows all users)
            const dl = document.getElementById('dl-consumers');
            dl.innerHTML = '';
            for (let ph in State.users) {
                const u = State.users[ph];
                dl.innerHTML += `<option value="${u.name} | ${u.phone}">`;
            }

            // 2. Render List in Manage Tab (Supports Search)
            this.renderUsers();
        });
    },

    // --- NEW: Render Users with Search Filter ---
    renderUsers(query = '') {
        const list = document.getElementById('manage-user-list');
        list.innerHTML = '';

        // Convert Users Object to Array
        const usersArray = Object.values(State.users || {});

        // Filter logic
        const searchTerm = query.toLowerCase().trim();
        const filtered = usersArray.filter(u => {
            const name = (u.name || '').toLowerCase();
            const phone = (u.phone || '').toString();
            const addr = (u.address || '').toLowerCase();
            return name.includes(searchTerm) || phone.includes(searchTerm) || addr.includes(searchTerm);
        });

        if (filtered.length === 0) {
            list.innerHTML = '<div class="text-center text-slate-400 py-4 italic text-xs">No matching customers found.</div>';
            return;
        }

        // Generate HTML
        filtered.forEach(u => {
            const addr = u.address ? u.address : '<span class="italic opacity-50">No Address</span>';
            list.innerHTML += `
                <div class="flex justify-between items-start p-3 bg-slate-50 border border-slate-100 rounded-lg hover:shadow-sm transition group">
                    <div>
                        <div class="font-bold text-slate-800 text-sm">${u.name}</div>
                        <div class="text-xs text-brand font-mono font-bold tracking-wide my-0.5"><i class="fa-solid fa-phone text-[10px]"></i> ${u.phone}</div>
                        <div class="text-xs text-slate-500"><i class="fa-solid fa-location-dot text-[10px]"></i> ${addr}</div>
                    </div>
                    <div class="flex gap-2 opacity-100 lg:opacity-0 group-hover:opacity-100 transition">
                        <button onclick="Manage.editUser('${u.phone}')" class="text-blue-500 hover:bg-blue-50 p-2 rounded-lg" title="Edit"><i class="fa-solid fa-pen-to-square"></i></button>
                        <button onclick="Manage.delUser('${u.phone}')" class="text-red-500 hover:bg-red-50 p-2 rounded-lg" title="Delete"><i class="fa-solid fa-trash"></i></button>
                    </div>
                </div>`;
        });
    },

    // --- NEW: Download PDF Function ---
    downloadUserPDF() {
        const { jsPDF } = window.jspdf;
        if (!jsPDF) return window.Toast("PDF Library Loading...", "error");

        const doc = new jsPDF();

        // Header
        doc.setFontSize(18);
        doc.text("Registered Customers List", 14, 22);
        doc.setFontSize(10);
        doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 14, 28);

        // Table Data Preparation
        const tableBody = Object.values(State.users || {}).map(u => [
            u.name,
            u.phone,
            u.address || 'N/A'
        ]);

        // Generate Table
        doc.autoTable({
            head: [['Customer Name', 'Phone Number', 'Address']],
            body: tableBody,
            startY: 35,
            theme: 'grid',
            headStyles: { fillColor: [67, 56, 202] }, // Brand Color (Indigo)
            styles: { fontSize: 10, cellPadding: 3 },
            alternateRowStyles: { fillColor: [243, 244, 246] }
        });

        doc.save('Customers_List.pdf');
        window.Toast("Downloading PDF...");
    },

    // --- EXISTING LOGIC (Unchanged functionality) ---
    saveProduct() {
        const name = document.getElementById('man-prod-name').value;
        const price = document.getElementById('man-prod-price').value;
        if (!name || !price) return window.Toast("Fill all fields", "error");
        const payload = { name, price: parseFloat(price) };

        if (this.editProdId) {
            update(ref(db, `products/${this.editProdId}`), payload).then(() => { window.Toast("Product Updated"); this.resetProdForm(); });
        } else {
            push(ref(db, 'products'), payload).then(() => { window.Toast("Product Added"); document.getElementById('man-prod-name').value = ''; document.getElementById('man-prod-price').value = ''; });
        }
    },
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
    delProd(id) { if (confirm("Delete Product?")) { remove(ref(db, `products/${id}`)); if (this.editProdId === id) this.resetProdForm(); } },

    saveUser() {
        const name = document.getElementById('man-user-name').value;
        const phone = document.getElementById('man-user-phone').value;
        const address = document.getElementById('man-user-address').value || "";
        if (!name || !phone) return window.Toast("Name & Phone required", "error");
        update(ref(db, `users/${phone}`), { name, phone, address }).then(() => {
            window.Toast(document.getElementById('btn-save-user').innerText === "Update Customer" ? "Customer Updated" : "Customer Registered");
            this.resetUserForm();
        });
    },
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
    delUser(ph) { if (confirm("Delete User?")) { remove(ref(db, `users/${ph}`)); if (document.getElementById('man-user-phone').value === ph) this.resetUserForm(); } }
};

// 3. DASHBOARD & HISTORY
// REPLACE THE ENTIRE window.Dashboard OBJECT WITH THIS

// REPLACE THE ENTIRE window.Dashboard OBJECT WITH THIS

window.Dashboard = {
    allBills: [], // Keeps raw bill data
    customerTotals: [], // Keeps calculated totals per customer

    init() {
        // 1. Basic Dashboard Counts
        document.getElementById('dash-products').innerText = Object.keys(State.products || {}).length;

        // 2. Set UI Dates
        const now = new Date();
        const dateEl = document.getElementById('dash-today-date');
        const monthEl = document.getElementById('dash-month-name');

        if (dateEl) dateEl.innerText = now.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'short' });
        if (monthEl) monthEl.innerText = now.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

        // 3. Fetch Data from Firebase
        onValue(ref(db, 'bills'), (snap) => {
            const data = snap.val();
            this.allBills = [];

            if (data) {
                for (let ph in data) {
                    for (let id in data[ph]) {
                        const bill = data[ph][id];
                        // Handle timestamp fallback for old data
                        const ts = bill.details?.timestamp || new Date(bill.date).getTime();
                        this.allBills.push({ ...bill, timestamp: ts, phone: ph });
                    }
                }
            }
            this.calculateStats();
        });
    },
    // --- NEW: Download Detailed Customer Statement (WhatsApp Style) ---
    downloadCustomerStatement(phone, name) {
        const { jsPDF } = window.jspdf;
        if (!jsPDF) return window.Toast("PDF Library Error", "error");

        // 1. Filter Bills for this specific customer
        const customerBills = this.allBills.filter(b => b.phone === phone);

        if (customerBills.length === 0) return window.Toast("No transaction history found", "error");

        // 2. Aggregate Items (Same logic as WhatsApp)
        const itemSummary = {};
        let grandTotal = 0;

        customerBills.forEach(bill => {
            if (bill.details && bill.details.items) {
                bill.details.items.forEach(item => {
                    const pName = item.name || "Unknown Item";
                    // Initialize if new
                    if (!itemSummary[pName]) {
                        itemSummary[pName] = { qty: 0, totalAmt: 0, price: item.price };
                    }
                    // Update calculations
                    itemSummary[pName].qty += item.qty;
                    const itemTotal = item.price * item.qty;
                    itemSummary[pName].totalAmt += itemTotal;
                    grandTotal += itemTotal; // Ensure grand total matches items
                });
            }
        });

        // 3. Prepare Data for PDF Table
        // Format: [Item Name, Price, Total Qty, Total Amount]
        const tableBody = Object.keys(itemSummary).map(itemName => {
            const data = itemSummary[itemName];
            return [
                itemName,
                data.price,
                data.qty,
                data.totalAmt.toLocaleString()
            ];
        });

        // 4. Generate PDF
        const doc = new jsPDF();

        // -- Header --
        doc.setFontSize(18);
        doc.setTextColor(67, 56, 202); // Brand Color
        doc.text("Customer Purchase Statement", 14, 20);
        
        doc.setFontSize(10);
        doc.setTextColor(100);
        doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 14, 26);

        // -- Customer Info Box --
        doc.setDrawColor(200);
        doc.setFillColor(248, 250, 252);
        doc.rect(14, 30, 182, 20, 'F'); // Gray Box
        
        doc.setFontSize(11);
        doc.setTextColor(0);
        doc.text(`Customer Name: ${name}`, 18, 38);
        doc.text(`Phone Number: ${phone}`, 18, 45);

        // -- Table --
        doc.autoTable({
            head: [['Item Name', 'Price (Rs)', 'Total Qty', 'Total Amount (Rs)']],
            body: tableBody,
            startY: 55,
            theme: 'grid',
            headStyles: { fillColor: [67, 56, 202] }, // Indigo
            columnStyles: {
                0: { cellWidth: 'auto' }, // Name
                1: { halign: 'right' },   // Price
                2: { halign: 'center' },  // Qty
                3: { halign: 'right', fontStyle: 'bold' } // Total
            },
            foot: [['', '', 'GRAND TOTAL:', `Rs. ${grandTotal.toLocaleString()}`]],
            footStyles: { fillColor: [240, 253, 244], textColor: [0, 0, 0], fontStyle: 'bold' }
        });

        // -- Footer Message --
        const finalY = doc.lastAutoTable.finalY + 10;
        doc.setFontSize(9);
        doc.setTextColor(150);
        doc.text("Thank you for your business!", 14, finalY);

        // Save File
        doc.save(`${name}_Statement.pdf`);
        window.Toast("Statement Downloaded Successfully");
    },
    calculateStats() {
        const now = new Date();
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

        let totalSales = 0, todaySales = 0, monthSales = 0, totalOrders = 0;

        this.allBills.forEach(b => {
            const amt = parseFloat(b.amount);
            totalSales += amt;
            totalOrders++;

            if (b.timestamp >= startOfDay) todaySales += amt;
            if (b.timestamp >= startOfMonth) monthSales += amt;
        });

        // Update Dashboard Cards
        const elSales = document.getElementById('dash-sales');
        const elOrders = document.getElementById('dash-orders');
        const elToday = document.getElementById('dash-today');
        const elMonth = document.getElementById('dash-month');

        if (elSales) elSales.innerText = totalSales.toLocaleString();
        if (elOrders) elOrders.innerText = totalOrders;
        if (elToday) elToday.innerText = todaySales.toLocaleString();
        if (elMonth) elMonth.innerText = monthSales.toLocaleString();
    },

    applyFilter() {
        const startVal = document.getElementById('filter-start').value;
        const endVal = document.getElementById('filter-end').value;

        if (!startVal || !endVal) return window.Toast("Select Start & End Date", "error");

        const startDate = new Date(startVal).getTime();
        const endDate = new Date(endVal);
        endDate.setHours(23, 59, 59, 999);
        const endTime = endDate.getTime();

        if (startDate > endTime) return window.Toast("Start date cannot be after End date", "error");

        let rangeTotal = 0;
        let count = 0;

        this.allBills.forEach(b => {
            if (b.timestamp >= startDate && b.timestamp <= endTime) {
                rangeTotal += parseFloat(b.amount);
                count++;
            }
        });

        const resEl = document.getElementById('filter-result');
        if (resEl) resEl.innerText = rangeTotal.toLocaleString();

        window.Toast(`Found ${count} orders in range`);
    },

    // --- NEW: QUICK CUSTOMER VIEW LOGIC ---

    openQuickAction() {
        // 1. Calculate Totals per Phone Number
        const totalsMap = {};

        // A. Sum from Bills
        this.allBills.forEach(b => {
            if (!totalsMap[b.phone]) totalsMap[b.phone] = 0;
            totalsMap[b.phone] += parseFloat(b.amount);
        });

        // B. Merge with Registered Users (to get Names)
        this.customerTotals = [];
        const allPhones = new Set([...Object.keys(totalsMap), ...Object.keys(State.users || {})]);

        allPhones.forEach(phone => {
            const user = State.users[phone] || {};
            const billTotal = totalsMap[phone] || 0;

            if (billTotal > 0 || user.name) {
                this.customerTotals.push({
                    name: user.name || 'Unknown Guest',
                    phone: phone,
                    total: billTotal
                });
            }
        });



        // Sort by Total Amount (High to Low)
        this.customerTotals.sort((a, b) => b.total - a.total);

        this.renderQuickList();
        const modal = document.getElementById('quick-modal');
        if (modal) modal.classList.remove('hidden');
    },
    // ADD THIS FUNCTION INSIDE window.Dashboard OBJECT

    downloadLedgerPDF() {
        // 1. Check Library
        const { jsPDF } = window.jspdf;
        if (!jsPDF) return window.Toast("PDF Library Error", "error");

        // 2. Check Data
        if (!this.customerTotals || this.customerTotals.length === 0) {
            return window.Toast("No data to download", "error");
        }

        const doc = new jsPDF();

        // 3. Header
        doc.setFontSize(18);
        doc.setTextColor(67, 56, 202); // Brand Color (Indigo)
        doc.text("Detailed Customer Ledger", 14, 22);
        
        doc.setFontSize(10);
        doc.setTextColor(100);
        doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 14, 28);
        doc.text(`Total Customers: ${this.customerTotals.length}`, 14, 33);

        // 4. Prepare Table Data with Address & Item Details
        const tableBody = this.customerTotals.map(c => {
            
            // A. Get Address from State (Global User List)
            const userObj = State.users[c.phone] || {};
            const address = userObj.address ? `Addr: ${userObj.address}` : '(No Address)';

            // B. Filter Bills for this customer
            const custBills = this.allBills.filter(b => b.phone === c.phone);

            // C. Aggregate Items (Jodna)
            const itemSummary = {};
            custBills.forEach(bill => {
                if (bill.details && bill.details.items) {
                    bill.details.items.forEach(item => {
                        const pName = item.name || "Unknown";
                        if (!itemSummary[pName]) {
                            itemSummary[pName] = { qty: 0, total: 0 };
                        }
                        itemSummary[pName].qty += item.qty;
                        itemSummary[pName].total += (item.price * item.qty);
                    });
                }
            });

            // D. Format Item List String
            let itemDetailsString = "";
            const itemKeys = Object.keys(itemSummary);
            
            if(itemKeys.length > 0) {
                itemDetailsString = itemKeys.map(k => {
                    const d = itemSummary[k];
                    return `• ${k} (x${d.qty}) = ${d.total}`;
                }).join("\n");
            } else {
                itemDetailsString = "No Item Details";
            }

            // E. Return Row for PDF Table
            return [
                `${c.name}\n${c.phone}\n${address}`,  // Col 1: Name, Phone & Address
                itemDetailsString,                     // Col 2: Item List
                `Rs. ${c.total.toLocaleString()}`      // Col 3: Grand Total
            ];
        });

        // 5. Generate Table
        doc.autoTable({
            head: [['Customer Details', 'Purchased Items Summary', 'Total Spend']],
            body: tableBody,
            startY: 40,
            theme: 'grid',
            headStyles: { 
                fillColor: [67, 56, 202], // Indigo Header
                halign: 'center'
            },
            styles: { 
                fontSize: 9, 
                cellPadding: 3, 
                valign: 'middle',
                overflow: 'linebreak' 
            },
            columnStyles: {
                0: { cellWidth: 60 }, // Increased width for Address
                1: { cellWidth: 'auto' }, 
                2: { cellWidth: 35, halign: 'right', fontStyle: 'bold' }
            },
            alternateRowStyles: { fillColor: [248, 250, 252] }
        });

        // 6. Save File
        doc.save('Detailed_Ledger_Report.pdf');
        window.Toast("Detailed Ledger PDF Downloaded!");
    },
    renderQuickList(query = '') {
        const list = document.getElementById('quick-list-body');
        if (!list) return;

        list.innerHTML = '';

        const term = query.toLowerCase().trim();
        const filtered = this.customerTotals.filter(c =>
            c.name.toLowerCase().includes(term) || c.phone.includes(term)
        );

        if (filtered.length === 0) {
            list.innerHTML = '<div class="text-center p-8 text-slate-400">No customers found</div>';
            return;
        }

        filtered.forEach(c => {
            list.innerHTML += `
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

                        <!-- PDF Download Button (New) -->
                        <button onclick="Dashboard.downloadCustomerStatement('${c.phone}', '${c.name}')" 
                                class="bg-red-100 hover:bg-red-200 text-red-600 w-9 h-9 rounded-full flex items-center justify-center transition shadow-sm" 
                                title="Download Full Statement">
                            <i class="fa-solid fa-file-pdf"></i>
                        </button>

                        <!-- WhatsApp Button -->
                        <button onclick="Dashboard.sendWhatsApp('${c.phone}', '${c.name}', ${c.total})" 
                                class="bg-[#25D366] hover:bg-[#1ebc57] text-white px-4 py-2 rounded-full flex items-center gap-2 text-xs font-bold shadow-md active:scale-95 transition">
                            <i class="fa-brands fa-whatsapp text-lg"></i> Send Bill
                        </button>
                    </div>
                </div>
            `;
        });
    },

    // FIND 'sendWhatsApp' INSIDE window.Dashboard AND REPLACE IT WITH THIS:

    // FIND THE 'sendWhatsApp' FUNCTION INSIDE window.Dashboard AND REPLACE IT WITH THIS:

    sendWhatsApp(phone, name, totalGrand) {
        // 1. Customer ke saare bills filter karein
        const customerBills = this.allBills.filter(b => b.phone === phone);

        // 2. Items ko jodna (Aggregation Logic)
        // Example: Agar 2 baar Milk liya hai to quantity jud jayegi
        const itemSummary = {};

        customerBills.forEach(bill => {
            if (bill.details && bill.details.items) {
                bill.details.items.forEach(item => {
                    const pName = item.name || "Unknown Item";
                    // Agar item pehle se list mein nahi hai
                    if (!itemSummary[pName]) {
                        itemSummary[pName] = { qty: 0, totalAmt: 0, price: item.price };
                    }
                    // Quantity aur Amount update karein
                    itemSummary[pName].qty += item.qty;
                    itemSummary[pName].totalAmt += (item.price * item.qty);
                });
            }
        });

        // 3. Message Text Banana (Items List)
        let itemDetailsStr = "";
        for (let prodName in itemSummary) {
            const data = itemSummary[prodName];
            // Format: 🔹 Milk (10 x 50) = 500
            itemDetailsStr += `🔹 ${prodName} (${data.qty} x ₹${data.price}) = ₹${data.totalAmt.toLocaleString()}\n`;
        }

        // 4. Link Generate Karna (Correct Logic)
        // admin.html ko hata kar user.html lagana
        let appLink = window.location.href;
        if (appLink.includes('admin.html')) {
            appLink = appLink.replace('admin.html', 'user.html');
        } else {
            // Fallback agar URL mein filename nahi hai
            appLink = window.location.origin + '/user.html';
        }
        // Hash (#) hata dein taaki link clean rahe
        appLink = appLink.split('#')[0];

        // 5. Final Message Construct Karna
        const text =
            `*BILL SUMMARY* 🧾
Customer: ${name}
Phone: ${phone}

*Items Purchased:*
${itemDetailsStr}
--------------------------------
*GRAND TOTAL: ₹${totalGrand.toLocaleString()}* 💰
--------------------------------

👇 *Click here to view full history & download bills:*
${appLink}

Thank you!`;

        // 6. WhatsApp Open Karna (Encoded Text ke saath)
        // encodeURIComponent zaroori hai taaki new lines aur symbols sahi se jaayein
        window.open(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`, '_blank');
    }


};

// REPLACE THE ENTIRE window.History OBJECT WITH THIS

window.History = {
    allTransactions: [], // Stores all data locally

    init() {
        const list = document.getElementById('history-body');
        list.innerHTML = '<tr><td colspan="5" class="p-8 text-center text-slate-400"><i class="fa-solid fa-circle-notch fa-spin text-2xl"></i><br>Loading Transactions...</td></tr>';

        // Listen to Database
        onValue(ref(db, 'bills'), (snap) => {
            const data = snap.val();
            this.allTransactions = []; // Reset array

            if (!data) {
                this.render([]);
                return;
            }

            // Flatten Data (Convert Tree to Array)
            for (let ph in data) {
                for (let id in data[ph]) {
                    this.allTransactions.push({ ...data[ph][id], id, phone: ph });
                }
            }

            // Sort by Timestamp (Newest First)
            this.allTransactions.sort((a, b) => (b.details?.timestamp || 0) - (a.details?.timestamp || 0));

            // Initial Render
            this.render(this.allTransactions);
        });
    },

    // --- SEARCH FILTER ---
    filter(query) {
        const term = query.toLowerCase().trim();

        if (!term) {
            this.render(this.allTransactions);
            return;
        }

        const filtered = this.allTransactions.filter(b => {
            const name = (b.details?.consumerName || '').toLowerCase();
            const phone = (b.phone || '').toString();

            // Search Address from Users List
            const userObj = State.users[b.phone];
            const address = (userObj && userObj.address) ? userObj.address.toLowerCase() : '';

            return name.includes(term) || phone.includes(term) || address.includes(term);
        });

        this.render(filtered);
    },

    // --- RENDER UI ---
    render(transactions) {
        const list = document.getElementById('history-body');
        list.innerHTML = '';

        if (transactions.length === 0) {
            list.innerHTML = '<tr><td colspan="5" class="p-8 text-center text-slate-400 italic">No Transactions Found</td></tr>';
            return;
        }

        transactions.forEach(b => {
            const name = b.details?.consumerName || 'Unknown';
            const phone = b.phone;
            const userObj = State.users[phone];
            const address = (userObj && userObj.address) ? userObj.address : '<span class="text-slate-300 italic">No Address</span>';

            let itemsHtml = '';
            if (b.details && b.details.items && Array.isArray(b.details.items)) {
                b.details.items.forEach(item => {
                    itemsHtml += `
                        <div class="flex justify-between items-center border-b border-slate-50 last:border-0 py-1">
                            <span class="text-slate-700 font-medium">${item.name} <span class="text-slate-400 text-xs">x${item.qty}</span></span>
                            <span class="text-slate-400 text-xs">₹${item.price * item.qty}</span>
                        </div>`;
                });
            } else {
                itemsHtml = `<span class="text-slate-500 italic">${b.item || 'Order Details Unavailable'}</span>`;
            }

            list.innerHTML += `
                <tr class="hover:bg-slate-50 transition group align-top">
                    <td class="p-4 text-xs font-mono text-slate-500 whitespace-nowrap pt-5">
                        ${b.date}<br>
                        <span class="text-[10px] opacity-60 text-slate-400">${new Date(b.details?.timestamp || 0).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </td>
                    <td class="p-4 pt-5">
                        <div class="font-bold text-slate-800">${name}</div>
                        <div class="text-xs text-brand font-mono my-1"><i class="fa-solid fa-phone text-[10px]"></i> ${phone}</div>
                        <div class="text-xs text-slate-500 leading-snug"><i class="fa-solid fa-map-pin text-[10px] mr-1"></i> ${address}</div>
                    </td>
                    <td class="p-4">
                        <div class="bg-slate-50/50 rounded-lg p-2 border border-slate-100 text-sm max-h-32 overflow-y-auto custom-scrollbar">
                            ${itemsHtml}
                        </div>
                    </td>
                    <td class="p-4 text-right pt-5">
                        <div class="font-bold text-emerald-600 text-lg">₹${b.amount}</div>
                        <div class="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Paid</div>
                    </td>
                    <td class="p-4 text-center pt-5">
                        <div class="flex justify-center gap-2">
                            <button onclick="History.edit('${b.phone}','${b.id}')" class="text-blue-400 hover:text-blue-600 hover:bg-blue-50 p-2 rounded-full transition" title="Edit Bill">
                                <i class="fa-solid fa-pen"></i>
                            </button>
                            <button onclick="History.del('${b.phone}','${b.id}')" class="text-red-300 hover:text-red-500 hover:bg-red-50 p-2 rounded-full transition" title="Delete Bill">
                                <i class="fa-solid fa-trash"></i>
                            </button>
                        </div>
                    </td>
                </tr>`;
        });
    },

    // --- EDIT FUNCTION (FIXED) ---
    edit(phone, id) {
        // Find data directly from local memory (Faster & No extra imports needed)
        const bill = this.allTransactions.find(b => b.id === id && b.phone === phone);

        if (bill) {
            document.getElementById('edit-bill-id').value = id;
            document.getElementById('edit-bill-phone').value = phone;

            // Fill Inputs
            document.getElementById('edit-name').value = bill.details?.consumerName || 'Unknown';
            document.getElementById('edit-amount').value = bill.amount;
            document.getElementById('edit-date').value = bill.date;

            // Show Modal
            document.getElementById('edit-modal').classList.remove('hidden');
        } else {
            window.Toast("Error loading transaction details", "error");
        }
    },

    // --- SAVE UPDATE ---
    saveUpdate() {
        const id = document.getElementById('edit-bill-id').value;
        const phone = document.getElementById('edit-bill-phone').value;

        const newName = document.getElementById('edit-name').value;
        const newAmount = parseFloat(document.getElementById('edit-amount').value);
        const newDate = document.getElementById('edit-date').value;

        if (!newAmount || !newName) return window.Toast("Invalid details", "error");

        const updates = {};
        // Multiple paths update logic
        updates[`bills/${phone}/${id}/amount`] = newAmount;
        updates[`bills/${phone}/${id}/date`] = newDate;
        updates[`bills/${phone}/${id}/details/consumerName`] = newName;
        updates[`bills/${phone}/${id}/details/totalAmount`] = newAmount;
        updates[`bills/${phone}/${id}/details/date`] = newDate;

        update(ref(db), updates)
            .then(() => {
                window.Toast("Transaction Updated");
                this.closeModal();
                // No need to call init() manually, firebase listener will auto-update UI
            })
            .catch(e => {
                console.error(e);
                window.Toast("Error updating", "error");
            });
    },

    closeModal() {
        document.getElementById('edit-modal').classList.add('hidden');
    },

    del(ph, id) {
        if (confirm("Are you sure you want to delete this transaction permanently?")) {
            remove(ref(db, `bills/${ph}/${id}`));
        }
    }
};

// REPLACE THE ENTIRE window.Share OBJECT WITH THIS
window.Share = {
    // Yahan apni User App wali website ka link daal dein
    userAppUrl: 'https://https://anadigodhamuserapp.vercel.app/', // <--- CHANGE THIS

    init() {
        const container = document.getElementById('qrcode');
        container.innerHTML = ''; 

        // Ab hum hardcoded URL use karenge
        const finalUrl = this.userAppUrl;

        // Generate QR Code
        new QRCode(container, {
            text: finalUrl,
            width: 200,
            height: 200,
            colorDark: "#000000",
            colorLight: "#ffffff",
            correctLevel: QRCode.CorrectLevel.H
        });

        // Set Input Value
        document.getElementById('share-link-input').value = finalUrl;
    },

    copyLink() {
        const input = document.getElementById('share-link-input');
        input.select();
        input.setSelectionRange(0, 99999);
        navigator.clipboard.writeText(this.userAppUrl).then(() => { // Use variable
            window.Toast("Link Copied to Clipboard!");
        });
    },

    shareWhatsApp() {
        const msg = encodeURIComponent(Hello! View your bill history and download invoices here: ${this.userAppUrl});
        const waUrl = https://wa.me/?text=${msg};
        window.open(waUrl, '_blank');
    },

    printStandee() {
        const printContainer = document.getElementById('qrcode-print');
        printContainer.innerHTML = '';
        new QRCode(printContainer, {
            text: this.userAppUrl, // Use variable
            width: 300,
            height: 300
        });

        setTimeout(() => {
            window.print();
        }, 500);
    }
};

// INIT
window.addEventListener('DOMContentLoaded', () => {
    document.getElementById('pos-date').valueAsDate = new Date();
    router('billing');
    Manage.initListeners();
    History.init();
});
