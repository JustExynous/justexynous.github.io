// ==============================================================================
// GORAMIK POS - CORE APPLICATION & SUPABASE INTEGRATION
// ==============================================================================

// --- 1. Service Worker Registration (Unregistered during dev to avoid stale cache) ---
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then(registrations => {
        for (let registration of registrations) {
            registration.unregister();
        }
    });
}

// --- 2. Master Data & Konstanta Bersama ---
const OUTLETS = {
    "antang-01": "Antang 01 (Pusat)",
    "antang-02": "Antang 02 (Cabang)",
    "tamalanrea-01": "Tamalanrea 01 (Cabang)"
};

const DEFAULT_PRODUCTS = [
    { id: 1, name: "Sambal Bawang", price: 25000 },
    { id: 2, name: "Sambal Ijo", price: 25000 },
    { id: 3, name: "Sambal Cumi", price: 35000 },
    { id: 4, name: "Dimsum Ayam", price: 15000 },
    { id: 5, name: "Lumpia Renyah", price: 12000 },
    { id: 6, name: "Gyoza Panggang", price: 18000 }
];

const DEFAULT_STAFF = [
    { id: "usr-owner", username: "owner", name: "Budi Owner", role: "owner", outlet: "antang-01", phone: "081211112222", password: "123", status: "Aktif" },
    { id: "usr-mgr1", username: "andi", name: "Andi Wijaya", role: "manajer", outlet: "antang-01", phone: "081345678901", password: "123", status: "Aktif" },
    { id: "usr-mgr2", username: "faisal", name: "Faisal Ramli", role: "manajer", outlet: "antang-02", phone: "081398765432", password: "123", status: "Aktif" },
    { id: "usr-mgr3", username: "budi_mgr", name: "Budi Santoso", role: "manajer", outlet: "tamalanrea-01", phone: "081567890123", password: "123", status: "Aktif" },
    { id: "usr-ksr1", username: "rahmat", name: "Rahmat Hidayat", role: "kasir", outlet: "antang-01", phone: "081234567890", password: "123", status: "Aktif" },
    { id: "usr-ksr2", username: "siti", name: "Siti Nurhaliza", role: "kasir", outlet: "antang-02", phone: "081298765432", password: "123", status: "Aktif" },
    { id: "usr-ksr3", username: "dewi", name: "Dewi Lestari", role: "kasir", outlet: "tamalanrea-01", phone: "081987654321", password: "123", status: "Aktif" }
];

const DEFAULT_ACCOUNTS = DEFAULT_STAFF;

const DEFAULT_INVENTORY = {
    "antang-01": { 1: 45, 2: 30, 3: 15, 4: 50, 5: 40, 6: 25 },
    "antang-02": { 1: 20, 2: 18, 3: 8, 4: 30, 5: 25, 6: 12 },
    "tamalanrea-01": { 1: 35, 2: 25, 3: 20, 4: 40, 5: 35, 6: 30 }
};

const DEFAULT_SALES = [
    {
        id: "TRX-1001",
        date: "2026-09-27 11:30",
        outlet: "antang-01",
        cashier: "Rahmat Hidayat",
        items: [{ id: 1, name: "Sambal Bawang", price: 25000, qty: 2, subtotal: 50000 }, { id: 4, name: "Dimsum Ayam", price: 15000, qty: 1, subtotal: 15000 }],
        total: 65000,
        paymentMethod: "tunai"
    },
    {
        id: "TRX-1002",
        date: "2026-09-27 12:15",
        outlet: "antang-02",
        cashier: "Siti Nurhaliza",
        items: [{ id: 3, name: "Sambal Cumi", price: 35000, qty: 1, subtotal: 35000 }, { id: 6, name: "Gyoza Panggang", price: 18000, qty: 2, subtotal: 36000 }],
        total: 71000,
        paymentMethod: "qris"
    },
    {
        id: "TRX-1003",
        date: "2026-09-27 13:40",
        outlet: "tamalanrea-01",
        cashier: "Dewi Lestari",
        items: [{ id: 2, name: "Sambal Ijo", price: 25000, qty: 1, subtotal: 25000 }, { id: 5, name: "Lumpia Renyah", price: 12000, qty: 3, subtotal: 36000 }],
        total: 61000,
        paymentMethod: "tunai"
    }
];

// --- 3. Storage Lokal Helper ---
function loadData(key, fallback) {
    try {
        const item = localStorage.getItem(`goramik_${key}`);
        return item ? JSON.parse(item) : fallback;
    } catch (e) {
        return fallback;
    }
}

function saveData(key, data) {
    try {
        localStorage.setItem(`goramik_${key}`, JSON.stringify(data));
    } catch (e) {}
}

// --- 4. Konfigurasi & Inisialisasi Supabase Client ---
function getSupabaseConfig() {
    const savedUrl = localStorage.getItem('goramik_supabase_url') || "";
    const savedKey = localStorage.getItem('goramik_supabase_key') || "";
    return {
        url: savedUrl.trim(),
        anonKey: savedKey.trim()
    };
}

function saveSupabaseConfig(url, anonKey) {
    localStorage.setItem('goramik_supabase_url', (url || "").trim());
    localStorage.setItem('goramik_supabase_key', (anonKey || "").trim());
}

let supabaseClient = null;
let isSupabaseConnected = false;

function initSupabase() {
    const config = getSupabaseConfig();
    if (window.supabase && config.url && config.anonKey) {
        try {
            supabaseClient = window.supabase.createClient(config.url, config.anonKey, {
                auth: { persistSession: false, autoRefreshToken: false }
            });
            isSupabaseConnected = true;
            console.log("✅ Supabase Client siap.");
        } catch (e) {
            console.error("❌ Gagal inisialisasi Supabase:", e);
            supabaseClient = null;
            isSupabaseConnected = false;
        }
    } else {
        supabaseClient = null;
        isSupabaseConnected = false;
    }
    return supabaseClient;
}

// --- 5. Data Service Layer ---
const DataService = {
    async testConnection(url, anonKey) {
        if (!window.supabase) {
            return { success: false, message: "Library Supabase JS belum siap dimuat di browser." };
        }
        try {
            const client = window.supabase.createClient(url, anonKey, {
                auth: { persistSession: false, autoRefreshToken: false }
            });
            const { data, error } = await client.from('products').select('id').limit(1);
            if (error) {
                return { success: false, message: `Database Supabase merespon error: ${error.message}` };
            }
            return { success: true, client };
        } catch (err) {
            return { success: false, message: `Koneksi gagal: ${err.message || err}` };
        }
    },

    // Validasi Kredensial Login (Strict 4-Way: Outlet + Role + Username/Name + Password)
    async verifyUserLogin(username, password, role, outletId) {
        const cleanUser = (username || "").trim().toLowerCase();
        const cleanPass = (password || "").trim();

        if (!cleanUser) {
            return { success: false, message: "Silakan masukkan nama pengguna atau username!" };
        }
        if (!cleanPass) {
            return { success: false, message: "Silakan masukkan password / PIN login!" };
        }

        // 1. Ambil daftar pegawai dari Database Supabase atau Local Storage
        const staffListDb = await this.getStaff();

        // 2. Cari akun yang cocok persis dengan username atau nama lengkap
        const user = staffListDb.find(u => 
            (u.username && u.username.toLowerCase() === cleanUser) ||
            (u.name && u.name.toLowerCase() === cleanUser)
        );

        if (!user) {
            return { 
                success: false, 
                message: `❌ Nama pengguna '${username}' tidak terdaftar di sistem!` 
            };
        }

        // 3. Validasi Peran (Role)
        if (user.role !== role) {
            const roleName = user.role === 'owner' ? 'Pemilik (Owner)' : user.role === 'manajer' ? 'Manajer Cabang' : 'Staff (Kasir)';
            return { 
                success: false, 
                message: `❌ Peran tidak cocok! Pengguna '${user.name}' terdaftar sebagai '${roleName}', bukan peran yang dipilih.` 
            };
        }

        // 4. Validasi Penempatan Outlet (Kecuali Owner yang memiliki hak akses ke semua cabang)
        if (user.role !== 'owner') {
            const userOutlet = user.outlet_id || user.outlet;
            if (userOutlet !== outletId) {
                return { 
                    success: false, 
                    message: `❌ Penempatan cabang salah! Pengguna '${user.name}' (${user.role === 'manajer' ? 'Manajer' : 'Kasir'}) ditugaskan di ${getOutletName(userOutlet)}, bukan di ${getOutletName(outletId)}.` 
                };
            }
        }

        // 5. Validasi Password / PIN
        const registeredPassword = String(user.password || '123').trim();
        if (cleanPass !== registeredPassword) {
            return { 
                success: false, 
                message: `❌ Password / PIN salah untuk pengguna '${user.name}'!` 
            };
        }

        // Lolos seluruh 4 tahap validasi
        return { 
            success: true, 
            user: { 
                id: user.id, 
                username: user.username || cleanUser, 
                name: user.name, 
                role: user.role, 
                outlet: (user.role === 'owner' ? outletId : (user.outlet_id || user.outlet)), 
                phone: user.phone,
                password: registeredPassword
            } 
        };
    },

    async getProducts() {
        if (isSupabaseConnected && supabaseClient) {
            try {
                const { data, error } = await supabaseClient
                    .from('products')
                    .select('*')
                    .eq('is_active', true)
                    .order('id', { ascending: true });
                if (!error && data && data.length > 0) return data;
            } catch (err) {
                console.warn("Supabase fetch products error, fallback ke local:", err);
            }
        }
        return loadData("products", DEFAULT_PRODUCTS);
    },

    async saveProduct(productData, isEdit = false) {
        if (isSupabaseConnected && supabaseClient) {
            try {
                if (isEdit) {
                    const { data, error } = await supabaseClient
                        .from('products')
                        .update({ name: productData.name, price: productData.price, updated_at: new Date() })
                        .eq('id', productData.id)
                        .select();
                    if (!error && data) return data[0];
                } else {
                    const { data, error } = await supabaseClient
                        .from('products')
                        .insert([{ name: productData.name, price: productData.price }])
                        .select();
                    if (!error && data && data.length > 0) {
                        const newProdId = data[0].id;
                        const inventoryInserts = Object.keys(OUTLETS).map(outletId => ({
                            outlet_id: outletId,
                            product_id: newProdId,
                            stock: 20
                        }));
                        await supabaseClient.from('inventory').insert(inventoryInserts);
                        return data[0];
                    }
                }
            } catch (err) {
                console.warn("Supabase save product error:", err);
            }
        }
        return null;
    },

    async deleteProduct(productId) {
        if (isSupabaseConnected && supabaseClient) {
            try {
                const { error } = await supabaseClient
                    .from('products')
                    .update({ is_active: false })
                    .eq('id', productId);
                if (!error) return true;
            } catch (err) {
                console.warn("Supabase delete product error:", err);
            }
        }
        return false;
    },

    async getInventory() {
        if (isSupabaseConnected && supabaseClient) {
            try {
                const { data, error } = await supabaseClient
                    .from('inventory')
                    .select('outlet_id, product_id, stock');
                if (!error && data && data.length > 0) {
                    const formatted = {};
                    data.forEach(row => {
                        if (!formatted[row.outlet_id]) formatted[row.outlet_id] = {};
                        formatted[row.outlet_id][row.product_id] = row.stock;
                    });
                    return formatted;
                }
            } catch (err) {
                console.warn("Supabase fetch inventory error, fallback ke local:", err);
            }
        }
        return loadData("inventory", DEFAULT_INVENTORY);
    },

    async addStock(outletId, productId, quantity, notes = "Restock manual") {
        if (isSupabaseConnected && supabaseClient) {
            try {
                const { data: cur } = await supabaseClient
                    .from('inventory')
                    .select('stock')
                    .eq('outlet_id', outletId)
                    .eq('product_id', productId)
                    .single();
                
                const curStock = cur ? cur.stock : 0;
                const newStock = curStock + Number(quantity);

                await supabaseClient.from('inventory').upsert({
                    outlet_id: outletId,
                    product_id: productId,
                    stock: newStock,
                    updated_at: new Date()
                }, { onConflict: 'outlet_id, product_id' });

                await supabaseClient.from('inventory_logs').insert([{
                    outlet_id: outletId,
                    product_id: productId,
                    change_type: 'restock',
                    quantity: Number(quantity),
                    previous_stock: curStock,
                    current_stock: newStock,
                    notes: notes
                }]);

                return newStock;
            } catch (err) {
                console.warn("Supabase add stock error:", err);
            }
        }
        return null;
    },

    async getStaff() {
        if (isSupabaseConnected && supabaseClient) {
            try {
                const { data, error } = await supabaseClient
                    .from('profiles')
                    .select('*')
                    .order('created_at', { ascending: false });
                if (!error && data && data.length > 0) {
                    return data.map(p => ({
                        id: p.id,
                        username: p.username || (p.name ? p.name.toLowerCase().replace(/\s+/g, '_') : 'user'),
                        name: p.name,
                        role: p.role,
                        outlet: p.outlet_id || p.outlet || 'antang-01',
                        outlet_id: p.outlet_id || p.outlet || 'antang-01',
                        phone: p.phone || '',
                        password: p.password || '123',
                        status: p.status || 'Aktif'
                    }));
                }
            } catch (err) {
                console.warn("Supabase fetch staff error, fallback ke local:", err);
            }
        }
        return loadData("staff", DEFAULT_STAFF);
    },

    async saveStaff(staffData, isEdit = false) {
        const payload = {
            username: staffData.username ? staffData.username.trim().toLowerCase() : staffData.name.toLowerCase().replace(/\s+/g, '_'),
            name: staffData.name.trim(),
            role: staffData.role,
            outlet_id: staffData.outlet,
            phone: staffData.phone ? staffData.phone.trim() : '',
            password: staffData.password ? String(staffData.password).trim() : '123',
            status: staffData.status || 'Aktif',
            updated_at: new Date()
        };

        if (isSupabaseConnected && supabaseClient) {
            try {
                if (isEdit && staffData.id && String(staffData.id).includes('-') && !String(staffData.id).startsWith('usr-') && !String(staffData.id).startsWith('stf-')) {
                    const { data, error } = await supabaseClient
                        .from('profiles')
                        .update(payload)
                        .eq('id', staffData.id)
                        .select();
                    if (!error && data && data.length > 0) return data[0];
                } else {
                    const { data, error } = await supabaseClient
                        .from('profiles')
                        .upsert(payload, { onConflict: 'username' })
                        .select();
                    if (!error && data && data.length > 0) return data[0];
                }
            } catch (err) {
                console.warn("Supabase save staff error:", err);
            }
        }
        return payload;
    },

    async deleteStaff(staffId, staffUsername) {
        if (isSupabaseConnected && supabaseClient) {
            try {
                if (staffId && String(staffId).includes('-') && !String(staffId).startsWith('usr-') && !String(staffId).startsWith('stf-')) {
                    await supabaseClient.from('profiles').delete().eq('id', staffId);
                }
                if (staffUsername) {
                    await supabaseClient.from('profiles').delete().eq('username', staffUsername);
                }
                return true;
            } catch (err) {
                console.warn("Supabase delete staff error:", err);
            }
        }
        return false;
    },

    async getSalesHistory() {
        if (isSupabaseConnected && supabaseClient) {
            try {
                const { data, error } = await supabaseClient
                    .from('transactions')
                    .select(`
                        id,
                        order_number,
                        created_at,
                        outlet_id,
                        cashier_name,
                        total_amount,
                        payment_method,
                        payment_status,
                        transaction_items (
                            product_id,
                            product_name,
                            price,
                            quantity,
                            subtotal
                        )
                    `)
                    .order('created_at', { ascending: false })
                    .limit(100);

                if (!error && data && data.length > 0) {
                    return data.map(trx => ({
                        id: trx.order_number || trx.id,
                        date: new Date(trx.created_at).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' }),
                        outlet: trx.outlet_id,
                        cashier: trx.cashier_name,
                        items: (trx.transaction_items || []).map(item => ({
                            id: item.product_id,
                            name: item.product_name,
                            price: item.price,
                            qty: item.quantity,
                            subtotal: item.subtotal
                        })),
                        total: Number(trx.total_amount),
                        paymentMethod: trx.payment_method
                    }));
                }
            } catch (err) {
                console.warn("Supabase fetch sales error, fallback ke local:", err);
            }
        }
        return loadData("sales", DEFAULT_SALES);
    },

    async createTransaction(transactionData) {
        if (isSupabaseConnected && supabaseClient) {
            try {
                const { data: trx, error: trxErr } = await supabaseClient
                    .from('transactions')
                    .insert([{
                        order_number: transactionData.id,
                        outlet_id: transactionData.outlet,
                        cashier_name: transactionData.cashier,
                        total_amount: transactionData.total,
                        payment_method: transactionData.paymentMethod,
                        payment_status: 'paid'
                    }])
                    .select()
                    .single();
                
                if (!trxErr && trx) {
                    const itemsToInsert = transactionData.items.map(item => ({
                        transaction_id: trx.id,
                        product_id: item.id,
                        product_name: item.name,
                        price: item.price,
                        quantity: item.qty,
                        subtotal: item.price * item.qty
                    }));
                    await supabaseClient.from('transaction_items').insert(itemsToInsert);
                    return trx;
                }
            } catch (err) {
                console.warn("Supabase create transaction error:", err);
            }
        }
        return null;
    },

    setupRealtimeSubscriptions(callbacks = {}) {
        if (!isSupabaseConnected || !supabaseClient) return;

        try {
            supabaseClient
                .channel('realtime-inventory')
                .on('postgres_changes', { event: '*', schema: 'public', table: 'inventory' }, payload => {
                    if (callbacks.onInventoryChange) callbacks.onInventoryChange(payload);
                })
                .subscribe();

            supabaseClient
                .channel('realtime-transactions')
                .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'transactions' }, payload => {
                    if (callbacks.onNewTransaction) callbacks.onNewTransaction(payload);
                })
                .subscribe();
        } catch (e) {
            console.warn("Realtime setup error:", e);
        }
    }
};

// --- 6. Application State & UI Handlers ---
let products = [];
let staffList = [];
let inventory = {};
let salesHistory = [];

let currentUser = { outlet: "antang-01", role: "kasir", name: "" };
let cart = [];

function showToast(message, type = "success") {
    const container = document.getElementById("toast-container");
    if (!container) return;
    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `<span>${type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️'}</span> <div>${message}</div>`;
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(10px)';
        setTimeout(() => toast.remove(), 300);
    }, 3200);
}

function formatRupiah(amount) {
    return `Rp ${Number(amount || 0).toLocaleString('id-ID')}`;
}

function getOutletName(id) {
    return OUTLETS[id] || id;
}

// Inisialisasi Data Aplikasi
async function initAppData() {
    initSupabase();
    updateConnectionBadges();

    const config = getSupabaseConfig();
    const urlInput = document.getElementById('input-supabase-url');
    const keyInput = document.getElementById('input-supabase-key');
    if (urlInput && keyInput) {
        urlInput.value = config.url || "";
        keyInput.value = config.anonKey || "";
    }

    try {
        products = await DataService.getProducts();
        inventory = await DataService.getInventory();
        staffList = await DataService.getStaff();
        salesHistory = await DataService.getSalesHistory();

        if (document.getElementById('pos-page')?.classList.contains('active')) {
            renderPosProducts();
            updateCartUI();
        }
        if (document.getElementById('admin-page')?.classList.contains('active')) {
            renderOverviewTab();
            renderStaffTab();
            renderInventoryTab();
            renderSalesTab();
            renderProductsTab();
        }

        DataService.setupRealtimeSubscriptions({
            onInventoryChange: async () => {
                inventory = await DataService.getInventory();
                if (document.getElementById('pos-page')?.classList.contains('active')) renderPosProducts();
                if (document.getElementById('admin-page')?.classList.contains('active')) {
                    renderInventoryTab();
                    renderOverviewTab();
                }
            },
            onNewTransaction: async () => {
                salesHistory = await DataService.getSalesHistory();
                if (document.getElementById('admin-page')?.classList.contains('active')) {
                    renderSalesTab();
                    renderOverviewTab();
                }
            }
        });
    } catch (e) {
        console.error("Gagal memuat data awal:", e);
    }
}

function updateConnectionBadges() {
    const badges = [
        document.getElementById('supabase-status-badge'),
        document.getElementById('supabase-status-badge-pos'),
        document.getElementById('supabase-status-badge-login')
    ];
    badges.forEach(b => {
        if (!b) return;
        if (isSupabaseConnected) {
            b.className = 'badge badge-green';
            b.innerHTML = '🟢 Supabase Cloud Live';
            b.title = 'Terhubung langsung ke database cloud Supabase PostgreSQL';
        } else {
            b.className = 'badge badge-orange';
            b.innerHTML = '🟡 Mode Local / Demo (Klik Hubungkan Cloud)';
            b.title = 'Klik untuk menghubungkan Project URL & API Key Supabase';
        }
    });
}

async function handleSaveSupabaseConfig() {
    const urlInput = document.getElementById('input-supabase-url');
    const keyInput = document.getElementById('input-supabase-key');
    const msgBox = document.getElementById('supabase-msg-box');
    const btnSave = document.getElementById('btn-save-supabase');
    
    const url = urlInput ? urlInput.value.trim() : "";
    const key = keyInput ? keyInput.value.trim() : "";
    
    if (!url || !key) {
        if (msgBox) {
            msgBox.style.display = 'block';
            msgBox.style.background = '#f8d7da';
            msgBox.style.color = '#721c24';
            msgBox.innerText = "❌ Mohon isi Project URL dan API Key terlebih dahulu!";
        }
        showToast("Project URL dan API Key wajib diisi!", "error");
        return;
    }

    if (!url.startsWith("http://") && !url.startsWith("https://")) {
        if (msgBox) {
            msgBox.style.display = 'block';
            msgBox.style.background = '#f8d7da';
            msgBox.style.color = '#721c24';
            msgBox.innerText = "❌ Project URL harus diawali dengan https://";
        }
        showToast("Project URL harus diawali dengan https://", "error");
        return;
    }

    if (btnSave) {
        btnSave.disabled = true;
        btnSave.innerText = "⏳ Menguji Koneksi...";
    }
    if (msgBox) {
        msgBox.style.display = 'block';
        msgBox.style.background = '#d1ecf1';
        msgBox.style.color = '#0c5460';
        msgBox.innerText = "⏳ Sedang menguji koneksi ke server Supabase...";
    }

    try {
        const testResult = await DataService.testConnection(url, key);
        if (!testResult.success) {
            if (msgBox) {
                msgBox.style.display = 'block';
                msgBox.style.background = '#f8d7da';
                msgBox.style.color = '#721c24';
                msgBox.innerText = `❌ ${testResult.message}`;
            }
            showToast("Koneksi Supabase gagal! Periksa URL dan API Key.", "error");
            if (btnSave) {
                btnSave.disabled = false;
                btnSave.innerText = "Hubungkan Cloud";
            }
            return;
        }

        saveSupabaseConfig(url, key);
        if (msgBox) {
            msgBox.style.display = 'block';
            msgBox.style.background = '#d4edda';
            msgBox.style.color = '#155724';
            msgBox.innerText = "✅ Berhasil terhubung ke Supabase Cloud!";
        }
        showToast("🟢 Supabase Cloud Live terhubung!");
        
        await initAppData();

        setTimeout(() => {
            closeModal('supabase-modal');
            if (btnSave) {
                btnSave.disabled = false;
                btnSave.innerText = "Hubungkan Cloud";
            }
        }, 1200);
    } catch (e) {
        if (msgBox) {
            msgBox.style.display = 'block';
            msgBox.style.background = '#f8d7da';
            msgBox.style.color = '#721c24';
            msgBox.innerText = `❌ Terjadi kesalahan: ${e.message}`;
        }
        if (btnSave) {
            btnSave.disabled = false;
            btnSave.innerText = "Hubungkan Cloud";
        }
    }
}

function handleClearSupabaseConfig() {
    if (confirm("Reset konfigurasi Supabase dan kembali ke Mode Demo Lokal?")) {
        localStorage.removeItem('goramik_supabase_url');
        localStorage.removeItem('goramik_supabase_key');
        
        const msgBox = document.getElementById('supabase-msg-box');
        if (msgBox) {
            msgBox.style.display = 'none';
            msgBox.innerText = '';
        }
        
        closeModal('supabase-modal');
        showToast("Koneksi Supabase di-reset ke mode lokal.");
        initAppData();
    }
}

window.addEventListener('DOMContentLoaded', initAppData);

// --- 7. Auth & SPA Navigation ---
const loginPage = document.getElementById('login-page');
const posPage = document.getElementById('pos-page');
const adminPage = document.getElementById('admin-page');

function switchPage(pageElement) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    pageElement.classList.add('active');
}

async function handleLogin() {
    const outlet = document.getElementById('outlet-select').value;
    const role = document.getElementById('role-select').value;
    const nameInput = document.getElementById('user-name');
    const passwordInput = document.getElementById('user-password');
    const name = nameInput ? nameInput.value.trim() : "";
    const password = passwordInput ? passwordInput.value.trim() : "";

    if (!outlet) {
        showToast("Silakan pilih outlet penempatan!", "error");
        return;
    }
    if (!role) {
        showToast("Silakan pilih peran pengguna!", "error");
        return;
    }
    if (!name) {
        showToast("Silakan masukkan nama pengguna!", "error");
        nameInput.focus();
        return;
    }
    if (!password) {
        showToast("Silakan masukkan password / PIN!", "error");
        passwordInput.focus();
        return;
    }

    // Validasi Kredensial Pengguna via DataService (Database & Strict Owner Match)
    const authResult = await DataService.verifyUserLogin(name, password, role, outlet);
    if (!authResult.success) {
        showToast(authResult.message, "error");
        passwordInput.focus();
        return;
    }

    currentUser = { 
        outlet: authResult.user.outlet || outlet, 
        role: authResult.user.role || role, 
        name: authResult.user.name || name 
    };

    const roleLabel = currentUser.role === 'owner' ? '👑 Pemilik (Owner)' : currentUser.role === 'manajer' ? '👔 Manajer Cabang' : '👤 Staff Kasir';
    document.getElementById('pos-display-outlet').innerText = `Outlet: ${getOutletName(currentUser.outlet)}`;
    document.getElementById('pos-display-user').innerText = `${roleLabel}: ${currentUser.name}`;
    
    const btnGoDashboard = document.getElementById('btn-go-dashboard');
    if (currentUser.role === 'owner' || currentUser.role === 'manajer') {
        if (btnGoDashboard) btnGoDashboard.style.display = 'inline-flex';
        openAdminDashboard();
    } else {
        // Kasir
        if (btnGoDashboard) btnGoDashboard.style.display = 'none';
        openPosPage();
    }

    showToast(`Selamat datang, ${currentUser.name}! Masuk sebagai ${roleLabel}.`);
}

function openPosPage() {
    switchPage(posPage);
    renderPosProducts();
    updateCartUI();
}

function openAdminDashboard() {
    const roleTitle = currentUser.role === 'owner' ? '👑 Pemilik (Owner)' : '👔 Manajer Cabang';
    const adminDisplay = document.getElementById('admin-display-name');
    if (adminDisplay) {
        adminDisplay.innerText = `Halo, ${currentUser.name || 'Pengguna'} (${roleTitle})`;
    }

    // Role-based permission controls:
    const staffWarning = document.getElementById('staff-manager-warning');
    const btnAddStaff = document.getElementById('btn-open-add-staff');

    if (currentUser.role === 'manajer') {
        // Manajer: Staff management read-only
        if (staffWarning) staffWarning.style.display = 'block';
        if (btnAddStaff) btnAddStaff.style.display = 'none';
    } else {
        // Owner: Full access
        if (staffWarning) staffWarning.style.display = 'none';
        if (btnAddStaff) btnAddStaff.style.display = 'inline-flex';
    }

    switchPage(adminPage);
    renderOverviewTab();
    renderStaffTab();
    renderInventoryTab();
    renderSalesTab();
    renderProductsTab();
}

document.getElementById('btn-go-dashboard')?.addEventListener('click', openAdminDashboard);
document.getElementById('btn-open-pos')?.addEventListener('click', openPosPage);
document.getElementById('btn-logout')?.addEventListener('click', handleLogout);
document.getElementById('btn-admin-logout')?.addEventListener('click', handleLogout);

function handleLogout() {
    cart = [];
    updateCartUI();
    currentUser = { outlet: "", role: "", name: "" };
    const nameInput = document.getElementById('user-name');
    const passwordInput = document.getElementById('user-password');
    if (nameInput) nameInput.value = "";
    if (passwordInput) passwordInput.value = "";
    switchPage(loginPage);
    showToast("Anda telah keluar dari sistem.", "info");
}

// --- 8. Fitur POS Kasir ---
const productListContainer = document.getElementById('product-list');
const searchProductInput = document.getElementById('search-product');

searchProductInput?.addEventListener('input', () => {
    renderPosProducts(searchProductInput.value);
});

function renderPosProducts(filterText = "") {
    if (!productListContainer) return;
    productListContainer.innerHTML = "";

    const outletStock = inventory[currentUser.outlet] || {};
    const filtered = products.filter(p => p.name.toLowerCase().includes(filterText.toLowerCase()));

    if (filtered.length === 0) {
        productListContainer.innerHTML = `<div style="grid-column: 1/-1; text-align: center; color: #999; padding: 30px;">Menu tidak ditemukan.</div>`;
        return;
    }

    filtered.forEach(p => {
        const stock = outletStock[p.id] !== undefined ? outletStock[p.id] : 0;
        const isOutOfStock = stock <= 0;

        const card = document.createElement('div');
        card.className = `product-card ${isOutOfStock ? 'out-of-stock' : ''}`;
        card.innerHTML = `
            <div>
                <h4>${p.name}</h4>
                <div class="price">${formatRupiah(p.price)}</div>
            </div>
            <div class="stock-tag ${stock <= 5 ? 'badge badge-red' : ''}">
                ${isOutOfStock ? 'Habis (0)' : `Stok: ${stock} pcs`}
            </div>
        `;

        if (!isOutOfStock) {
            card.onclick = () => addToCart(p);
        } else {
            card.onclick = () => showToast(`Stok ${p.name} di outlet ini habis! Tambahkan supply terlebih dahulu.`, "error");
        }

        productListContainer.appendChild(card);
    });
}

function addToCart(productOrId) {
    const product = (typeof productOrId === 'object' && productOrId !== null) 
        ? productOrId 
        : products.find(p => p.id === Number(productOrId));
    
    if (!product) return;
    const outletStock = (inventory[currentUser.outlet] || {})[product.id] || 0;
    const existing = cart.find(item => item.id === product.id);

    if (existing) {
        if (existing.qty + 1 > outletStock) {
            showToast(`Maksimal stok tersedia hanya ${outletStock} pcs!`, "error");
            return;
        }
        existing.qty++;
    } else {
        if (outletStock < 1) {
            showToast(`Stok ${product.name} habis!`, "error");
            return;
        }
        cart.push({ ...product, qty: 1 });
    }
    updateCartUI();
}

function changeCartQty(productId, delta) {
    const item = cart.find(i => i.id === productId);
    if (!item) return;

    const outletStock = (inventory[currentUser.outlet] || {})[productId] || 0;
    const newQty = item.qty + delta;

    if (newQty > outletStock) {
        showToast(`Stok tidak mencukupi (sisa ${outletStock} pcs)!`, "error");
        return;
    }

    if (newQty <= 0) {
        cart = cart.filter(i => i.id !== productId);
    } else {
        item.qty = newQty;
    }
    updateCartUI();
}

function removeFromCart(productId) {
    cart = cart.filter(i => i.id !== productId);
    updateCartUI();
}

document.getElementById('btn-clear-cart')?.addEventListener('click', () => {
    if (cart.length === 0) return;
    if (confirm("Yakin ingin mengosongkan seluruh item di keranjang?")) {
        cart = [];
        updateCartUI();
        showToast("Keranjang telah dikosongkan.", "info");
    }
});

function updateCartUI() {
    const cartContainer = document.getElementById('cart-items');
    const totalEl = document.getElementById('cart-total');
    if (!cartContainer || !totalEl) return;

    cartContainer.innerHTML = "";
    let total = 0;

    if (cart.length === 0) {
        cartContainer.innerHTML = `
            <div class="cart-empty-state">
                <span style="font-size: 32px;">🛒</span>
                <p>Keranjang masih kosong</p>
                <span style="font-size: 12px;">Klik menu di sebelah kiri untuk menambah pesanan</span>
            </div>
        `;
        totalEl.innerText = formatRupiah(0);
        return;
    }

    cart.forEach(item => {
        const subtotal = item.price * item.qty;
        total += subtotal;

        const div = document.createElement('div');
        div.className = 'cart-item';
        div.innerHTML = `
            <div class="cart-item-info">
                <div class="item-title">${item.name}</div>
                <div class="item-unit-price">${formatRupiah(item.price)} / pcs</div>
            </div>
            <div class="cart-item-actions">
                <button type="button" class="btn-icon btn-secondary" onclick="changeCartQty(${item.id}, -1)">-</button>
                <span class="cart-qty-count">${item.qty}</span>
                <button type="button" class="btn-icon btn-secondary" onclick="changeCartQty(${item.id}, 1)">+</button>
                <span class="cart-item-subtotal">${formatRupiah(subtotal)}</span>
                <button type="button" class="btn-icon btn-danger" onclick="removeFromCart(${item.id})" title="Hapus item">🗑️</button>
            </div>
        `;
        cartContainer.appendChild(div);
    });

    totalEl.innerText = formatRupiah(total);
}

const btnCheckout = document.getElementById('btn-checkout');
const qrisModal = document.getElementById('qris-modal');
const btnCloseQris = document.getElementById('btn-close-qris');
const btnConfirmQris = document.getElementById('btn-confirm-qris');

btnCheckout?.addEventListener('click', () => {
    if (cart.length === 0) {
        showToast("Keranjang masih kosong! Pilih menu terlebih dahulu.", "error");
        return;
    }

    const paymentMethod = document.querySelector('input[name="payment"]:checked')?.value || "tunai";
    const totalAmount = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);

    if (paymentMethod === "tunai") {
        finalizeTransaction("tunai", totalAmount);
    } else if (paymentMethod === "qris") {
        document.getElementById('qris-amount-display').innerText = formatRupiah(totalAmount);
        openModal('qris-modal');
    }
});

async function finalizeTransaction(paymentMethod, totalAmount) {
    const orderId = `TRX-${Math.floor(1000 + Math.random() * 9000)}`;
    const now = new Date();
    const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    
    const transactionData = {
        id: orderId,
        date: dateStr,
        outlet: currentUser.outlet,
        cashier: currentUser.name || "Kasir",
        items: cart.map(i => ({ id: i.id, name: i.name, price: i.price, qty: i.qty, subtotal: i.price * i.qty })),
        total: totalAmount,
        paymentMethod: paymentMethod
    };

    if (!inventory[currentUser.outlet]) inventory[currentUser.outlet] = {};
    cart.forEach(item => {
        if (inventory[currentUser.outlet][item.id] !== undefined) {
            inventory[currentUser.outlet][item.id] = Math.max(0, inventory[currentUser.outlet][item.id] - item.qty);
        }
    });

    await DataService.createTransaction(transactionData);
    salesHistory.unshift(transactionData);
    saveData("sales", salesHistory);
    saveData("inventory", inventory);

    cart = [];
    updateCartUI();
    renderPosProducts();
    
    showToast(`Transaksi ${paymentMethod.toUpperCase()} senilai ${formatRupiah(totalAmount)} berhasil dicatat!`);
}

btnCloseQris?.addEventListener('click', () => {
    closeModal('qris-modal');
    showToast("Pembayaran QRIS dibatalkan.", "info");
});

btnConfirmQris?.addEventListener('click', () => {
    const totalAmount = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
    closeModal('qris-modal');
    finalizeTransaction("qris", totalAmount);
});

// --- 9. Dashboard Pemilik & Manajer ---
document.querySelectorAll('.nav-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.nav-tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

        btn.classList.add('active');
        const targetTabId = btn.getAttribute('data-tab');
        const targetTab = document.getElementById(targetTabId);
        if (targetTab) targetTab.classList.add('active');

        if (targetTabId === 'tab-overview') renderOverviewTab();
        if (targetTabId === 'tab-staff') renderStaffTab();
        if (targetTabId === 'tab-inventory') renderInventoryTab();
        if (targetTabId === 'tab-sales') renderSalesTab();
        if (targetTabId === 'tab-products') renderProductsTab();
    });
});

const overviewFilter = document.getElementById('overview-outlet-filter');
overviewFilter?.addEventListener('change', renderOverviewTab);

function renderOverviewTab() {
    const selectedOutlet = overviewFilter?.value || "all";
    
    const filteredSales = selectedOutlet === "all" 
        ? salesHistory 
        : salesHistory.filter(s => s.outlet === selectedOutlet);

    const totalRevenue = filteredSales.reduce((sum, s) => sum + s.total, 0);
    const totalOrders = filteredSales.length;

    const filteredStaff = selectedOutlet === "all"
        ? staffList
        : staffList.filter(st => (st.outlet === selectedOutlet || st.outlet_id === selectedOutlet));

    let totalStock = 0;
    if (selectedOutlet === "all") {
        Object.values(inventory).forEach(outletStock => {
            Object.values(outletStock).forEach(qty => totalStock += Number(qty || 0));
        });
    } else {
        const outletStock = inventory[selectedOutlet] || {};
        Object.values(outletStock).forEach(qty => totalStock += Number(qty || 0));
    }

    document.getElementById('kpi-total-revenue').innerText = formatRupiah(totalRevenue);
    document.getElementById('kpi-total-orders').innerText = `${totalOrders} Transaksi`;
    document.getElementById('kpi-total-staff').innerText = `${filteredStaff.length} Orang`;
    document.getElementById('kpi-total-stock').innerText = `${totalStock} Pcs`;

    const tbody = document.getElementById('branch-comparison-tbody');
    if (!tbody) return;
    tbody.innerHTML = "";

    Object.keys(OUTLETS).forEach(outletId => {
        const branchSales = salesHistory.filter(s => s.outlet === outletId);
        const branchOrders = branchSales.length;
        const cashRev = branchSales.filter(s => s.paymentMethod === 'tunai').reduce((sum, s) => sum + s.total, 0);
        const qrisRev = branchSales.filter(s => s.paymentMethod === 'qris').reduce((sum, s) => sum + s.total, 0);
        const totalBranchRev = cashRev + qrisRev;

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${getOutletName(outletId)}</strong></td>
            <td><span class="badge badge-blue">${branchOrders} Pesanan</span></td>
            <td>${formatRupiah(cashRev)}</td>
            <td>${formatRupiah(qrisRev)}</td>
            <td><strong style="color:#2d6a4f;">${formatRupiah(totalBranchRev)}</strong></td>
        `;
        tbody.appendChild(tr);
    });
}

const staffOutletFilter = document.getElementById('staff-outlet-filter');
staffOutletFilter?.addEventListener('change', renderStaffTab);

function renderStaffTab() {
    const tbody = document.getElementById('staff-table-tbody');
    if (!tbody) return;
    tbody.innerHTML = "";

    const isOwner = currentUser.role === 'owner';
    const selectedOutlet = staffOutletFilter?.value || "all";
    const filtered = selectedOutlet === "all"
        ? staffList
        : staffList.filter(s => s.outlet === selectedOutlet || s.outlet_id === selectedOutlet);

    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" class="text-center" style="color:#999; padding:20px;">Belum ada data pegawai untuk outlet ini.</td></tr>`;
        return;
    }

    filtered.forEach(staff => {
        const staffOutlet = staff.outlet || staff.outlet_id;
        const roleBadgeClass = staff.role === 'owner' ? 'badge-red' : staff.role === 'manajer' ? 'badge-purple' : 'badge-green';
        const roleLabel = staff.role === 'owner' ? 'Pemilik' : staff.role === 'manajer' ? 'Manajer' : 'Staff';
        const tr = document.createElement('tr');

        const actionHtml = isOwner
            ? `<button class="btn-secondary btn-sm" onclick="editStaff('${staff.id || staff.username}')">✏️ Edit</button>
               <button class="btn-danger btn-sm" onclick="deleteStaff('${staff.id}', '${staff.username}')">🗑️ Hapus</button>`
            : `<span style="color:#999; font-size:12px;">🔒 Hanya Lihat</span>`;

        tr.innerHTML = `
            <td><code>${staff.username || '-'}</code></td>
            <td><strong>${staff.name}</strong></td>
            <td><span class="badge ${roleBadgeClass}">${roleLabel}</span></td>
            <td>${getOutletName(staffOutlet)}</td>
            <td>${staff.phone || '-'}</td>
            <td><code>${isOwner ? (staff.password || '123') : '••••••'}</code></td>
            <td><span class="badge badge-blue">${staff.status || 'Aktif'}</span></td>
            <td class="text-right">${actionHtml}</td>
        `;
        tbody.appendChild(tr);
    });
}

document.getElementById('btn-open-add-staff')?.addEventListener('click', () => {
    if (currentUser.role !== 'owner') {
        showToast("⛔ Hanya Pemilik (Owner) yang dapat menambah pegawai!", "error");
        return;
    }
    document.getElementById('staff-modal-title').innerText = "Tambah Pegawai Baru";
    document.getElementById('staff-edit-id').value = "";
    document.getElementById('input-staff-username').value = "";
    document.getElementById('input-staff-name').value = "";
    document.getElementById('input-staff-role').value = "kasir";
    document.getElementById('input-staff-outlet').value = "antang-01";
    document.getElementById('input-staff-phone').value = "";
    document.getElementById('input-staff-password').value = "123";
    openModal('staff-modal');
});

function editStaff(staffIdentifier) {
    if (currentUser.role !== 'owner') {
        showToast("⛔ Hanya Pemilik (Owner) yang dapat mengedit data pegawai!", "error");
        return;
    }
    const staff = staffList.find(s => String(s.id) === String(staffIdentifier) || s.username === staffIdentifier);
    if (!staff) return;

    document.getElementById('staff-modal-title').innerText = "Edit Data Pegawai";
    document.getElementById('staff-edit-id').value = staff.id || staff.username;
    document.getElementById('input-staff-username').value = staff.username || "";
    document.getElementById('input-staff-name').value = staff.name;
    document.getElementById('input-staff-role').value = staff.role;
    document.getElementById('input-staff-outlet').value = staff.outlet || staff.outlet_id;
    document.getElementById('input-staff-phone').value = staff.phone || "";
    document.getElementById('input-staff-password').value = staff.password || "123";
    openModal('staff-modal');
}

async function saveStaff() {
    if (currentUser.role !== 'owner') {
        showToast("⛔ Hanya Pemilik (Owner) yang dapat mengelola pegawai!", "error");
        return;
    }
    const editId = document.getElementById('staff-edit-id').value;
    const username = document.getElementById('input-staff-username').value.trim().toLowerCase();
    const name = document.getElementById('input-staff-name').value.trim();
    const role = document.getElementById('input-staff-role').value;
    const outlet = document.getElementById('input-staff-outlet').value;
    const phone = document.getElementById('input-staff-phone').value.trim();
    const password = document.getElementById('input-staff-password').value.trim() || "123";

    if (!username) {
        showToast("Username login pegawai wajib diisi!", "error");
        return;
    }
    if (!name) {
        showToast("Nama lengkap pegawai wajib diisi!", "error");
        return;
    }

    const staffData = { id: editId, username, name, role, outlet, outlet_id: outlet, phone, password, status: "Aktif" };
    await DataService.saveStaff(staffData, !!editId);

    if (editId) {
        const staff = staffList.find(s => String(s.id) === String(editId) || s.username === editId);
        if (staff) {
            staff.username = username;
            staff.name = name;
            staff.role = role;
            staff.outlet = outlet;
            staff.outlet_id = outlet;
            staff.phone = phone;
            staff.password = password;
        }
        showToast(`Data pegawai ${name} berhasil diperbarui di database!`);
    } else {
        staffData.id = `usr-${Date.now()}`;
        staffList.push(staffData);
        showToast(`Pegawai baru ${name} (Username: ${username}) berhasil disimpan ke database!`);
    }

    saveData("staff", staffList);
    closeModal('staff-modal');
    renderStaffTab();
    renderOverviewTab();
}

async function deleteStaff(staffId, staffUsername) {
    if (currentUser.role !== 'owner') {
        showToast("⛔ Hanya Pemilik (Owner) yang dapat menghapus pegawai!", "error");
        return;
    }
    const staff = staffList.find(s => String(s.id) === String(staffId) || s.username === staffUsername);
    if (!staff) return;
    if (confirm(`Yakin ingin menghapus data pegawai "${staff.name}" (Username: ${staff.username || '-'})?`)) {
        await DataService.deleteStaff(staffId, staffUsername || staff.username);
        staffList = staffList.filter(s => String(s.id) !== String(staffId) && s.username !== (staffUsername || staff.username));
        saveData("staff", staffList);
        renderStaffTab();
        renderOverviewTab();
        showToast(`Pegawai ${staff.name} berhasil dihapus dari database.`, "info");
    }
}

const inventoryOutletFilter = document.getElementById('inventory-outlet-filter');
inventoryOutletFilter?.addEventListener('change', renderInventoryTab);

function renderInventoryTab() {
    const tbody = document.getElementById('inventory-table-tbody');
    if (!tbody) return;
    tbody.innerHTML = "";

    const selectedOutlet = inventoryOutletFilter?.value || "antang-01";
    const outletStock = inventory[selectedOutlet] || {};

    products.forEach(p => {
        const stock = outletStock[p.id] !== undefined ? outletStock[p.id] : 0;
        let badgeHtml = '<span class="badge badge-green">Aman</span>';
        if (stock <= 0) {
            badgeHtml = '<span class="badge badge-red">Habis</span>';
        } else if (stock <= 10) {
            badgeHtml = '<span class="badge badge-orange">Menipis</span>';
        }

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>#${p.id}</td>
            <td><strong>${p.name}</strong></td>
            <td>${formatRupiah(p.price)}</td>
            <td><strong>${stock} pcs</strong></td>
            <td>${badgeHtml}</td>
            <td class="text-right">
                <button class="btn-primary btn-sm" onclick="quickRestock('${selectedOutlet}', ${p.id}, 10)">+10 Supply</button>
                <button class="btn-secondary btn-sm" onclick="quickRestock('${selectedOutlet}', ${p.id}, 25)">+25 Supply</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

async function quickRestock(outletId, productId, qty) {
    if (!inventory[outletId]) inventory[outletId] = {};
    inventory[outletId][productId] = (inventory[outletId][productId] || 0) + Number(qty);
    
    await DataService.addStock(outletId, productId, qty, `Quick restock +${qty}`);
    saveData("inventory", inventory);
    
    const prod = products.find(p => p.id === productId);
    showToast(`Berhasil menambah +${qty} stok ${prod ? prod.name : ''} ke ${getOutletName(outletId)}!`);
    
    renderInventoryTab();
    renderOverviewTab();
    if (currentUser.outlet === outletId) renderPosProducts();
}

document.getElementById('btn-open-restock-modal')?.addEventListener('click', () => {
    const prodSelect = document.getElementById('restock-product-select');
    if (prodSelect) {
        prodSelect.innerHTML = products.map(p => `<option value="${p.id}">${p.name} (${formatRupiah(p.price)})</option>`).join('');
    }
    openModal('restock-modal');
});

function saveRestock() {
    const outlet = document.getElementById('restock-outlet-select').value;
    const productId = Number(document.getElementById('restock-product-select').value);
    const qty = Number(document.getElementById('restock-qty-input').value);

    if (!qty || qty <= 0) {
        showToast("Jumlah penambahan stok harus lebih dari 0!", "error");
        return;
    }

    quickRestock(outlet, productId, qty);
    closeModal('restock-modal');
}

const salesOutletFilter = document.getElementById('sales-outlet-filter');
salesOutletFilter?.addEventListener('change', renderSalesTab);

function renderSalesTab() {
    const tbody = document.getElementById('sales-table-tbody');
    if (!tbody) return;
    tbody.innerHTML = "";

    const selectedOutlet = salesOutletFilter?.value || "all";
    const filtered = selectedOutlet === "all"
        ? salesHistory
        : salesHistory.filter(s => s.outlet === selectedOutlet);

    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="text-center" style="color:#999; padding:20px;">Belum ada riwayat transaksi.</td></tr>`;
        return;
    }

    filtered.forEach(sale => {
        const itemSummary = (sale.items || []).map(i => `${i.name} (${i.qty}x)`).join(', ');
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><code>${sale.id}</code></td>
            <td>${sale.date}</td>
            <td><span class="badge badge-blue">${getOutletName(sale.outlet)}</span></td>
            <td>${sale.cashier}</td>
            <td style="font-size:13px; max-width: 250px;">${itemSummary}</td>
            <td><span class="badge ${sale.paymentMethod === 'qris' ? 'badge-purple' : 'badge-green'}">${(sale.paymentMethod || 'TUNAI').toUpperCase()}</span></td>
            <td><strong>${formatRupiah(sale.total)}</strong></td>
        `;
        tbody.appendChild(tr);
    });
}

document.getElementById('btn-export-sales')?.addEventListener('click', () => {
    if (salesHistory.length === 0) {
        showToast("Tidak ada riwayat penjualan untuk diekspor.", "error");
        return;
    }

    let csv = "ID Transaksi,Waktu,Outlet,Kasir,Metode Pembayaran,Rincian Pesanan,Total (Rp)\n";
    salesHistory.forEach(s => {
        const items = `"${(s.items || []).map(i => `${i.name} (${i.qty}x)`).join('; ')}"`;
        csv += `${s.id},${s.date},${getOutletName(s.outlet)},${s.cashier},${(s.paymentMethod || 'TUNAI').toUpperCase()},${items},${s.total}\n`;
    });

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Laporan_Penjualan_Goramik_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast("Laporan penjualan berhasil diunduh dalam format CSV!");
});

function renderProductsTab() {
    const tbody = document.getElementById('products-table-tbody');
    if (!tbody) return;
    tbody.innerHTML = "";

    products.forEach(p => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>#${p.id}</td>
            <td><strong>${p.name}</strong></td>
            <td>${formatRupiah(p.price)}</td>
            <td class="text-right">
                <button class="btn-secondary btn-sm" onclick="editProduct(${p.id})">✏️ Edit</button>
                <button class="btn-danger btn-sm" onclick="deleteProduct(${p.id})">🗑️ Hapus</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

document.getElementById('btn-open-add-product')?.addEventListener('click', () => {
    document.getElementById('product-modal-title').innerText = "Tambah Menu Baru";
    document.getElementById('product-edit-id').value = "";
    document.getElementById('input-product-name').value = "";
    document.getElementById('input-product-price').value = "";
    openModal('product-modal');
});

function editProduct(productId) {
    const prod = products.find(p => p.id === productId);
    if (!prod) return;

    document.getElementById('product-modal-title').innerText = "Edit Menu Produk";
    document.getElementById('product-edit-id').value = prod.id;
    document.getElementById('input-product-name').value = prod.name;
    document.getElementById('input-product-price').value = prod.price;
    openModal('product-modal');
}

async function saveProduct() {
    const editId = document.getElementById('product-edit-id').value;
    const name = document.getElementById('input-product-name').value.trim();
    const price = Number(document.getElementById('input-product-price').value);

    if (!name || !price) {
        showToast("Nama dan harga menu wajib diisi!", "error");
        return;
    }

    const prodData = { id: editId ? Number(editId) : undefined, name, price };
    await DataService.saveProduct(prodData, !!editId);

    if (editId) {
        const prod = products.find(p => p.id === Number(editId));
        if (prod) {
            prod.name = name;
            prod.price = price;
            showToast(`Menu ${name} berhasil diubah!`);
        }
    } else {
        const newId = products.length > 0 ? Math.max(...products.map(p => p.id)) + 1 : 1;
        products.push({ id: newId, name, price });
        
        Object.keys(OUTLETS).forEach(outletId => {
            if (!inventory[outletId]) inventory[outletId] = {};
            if (inventory[outletId][newId] === undefined) inventory[outletId][newId] = 20;
        });
        showToast(`Menu baru "${name}" berhasil ditambahkan!`);
    }

    saveData("products", products);
    saveData("inventory", inventory);
    closeModal('product-modal');
    renderProductsTab();
    renderInventoryTab();
    renderPosProducts();
}

async function deleteProduct(productId) {
    const prod = products.find(p => p.id === productId);
    if (!prod) return;
    if (confirm(`Yakin ingin menghapus menu "${prod.name}"?`)) {
        await DataService.deleteProduct(productId);
        products = products.filter(p => p.id !== productId);
        saveData("products", products);
        renderProductsTab();
        renderInventoryTab();
        renderPosProducts();
        showToast(`Menu ${prod.name} berhasil dihapus.`, "info");
    }
}

// Bind all necessary functions to window
window.OUTLETS = OUTLETS;
window.DEFAULT_ACCOUNTS = DEFAULT_ACCOUNTS;
window.DataService = DataService;
window.openModal = openModal;
window.closeModal = closeModal;
window.handleLogin = handleLogin;
window.handleLogout = handleLogout;
window.openPosPage = openPosPage;
window.openAdminDashboard = openAdminDashboard;
window.handleSaveSupabaseConfig = handleSaveSupabaseConfig;
window.handleClearSupabaseConfig = handleClearSupabaseConfig;
window.saveStaff = saveStaff;
window.editStaff = editStaff;
window.deleteStaff = deleteStaff;
window.saveRestock = saveRestock;
window.quickRestock = quickRestock;
window.saveProduct = saveProduct;
window.editProduct = editProduct;
window.deleteProduct = deleteProduct;
window.addToCart = addToCart;
window.changeCartQty = changeCartQty;
window.removeFromCart = removeFromCart;
window.finalizeTransaction = finalizeTransaction;

window.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal')) {
        closeModal(e.target.id);
    }
});

window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        document.querySelectorAll('.modal.active').forEach(modal => {
            closeModal(modal.id);
        });
    }
});
