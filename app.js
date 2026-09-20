// CONFIG SUPABASE
const SUPABASE_URL = "https://jhfoyfizlpntjrrklvqh.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpoZm95Zml6bHBudGpycmtsdnFoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk4ODYyNzgsImV4cCI6MjEwNTQ2MjI3OH0.jtVhIFN7-FoA_NhmjB00EmpuVs_pyJolHNV-jed1mMo";

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// STATE APLIKASI
let currentOutlet = null;
let currentKasir = null;
let products = [];
let cart = [];
let activeRealtimeChannel = null;

// ELEMENT DOM
const screenLogin = document.getElementById("screen-login");
const screenPos = document.getElementById("screen-pos");
const selectOutlet = document.getElementById("select-outlet");
const selectKasir = document.getElementById("select-kasir");
const btnLogin = document.getElementById("btn-login");
const btnLogout = document.getElementById("btn-logout");
const productGrid = document.getElementById("product-grid");
const cartList = document.getElementById("cart-list");
const cartTotalText = document.getElementById("cart-total");
const btnPayQris = document.getElementById("btn-pay-qris");

// MODAL QRIS DOM
const modalQris = document.getElementById("modal-qris");
const btnCloseQris = document.getElementById("btn-close-qris");
const qrisTotalText = document.getElementById("qris-total-text");
const qrisLoading = document.getElementById("qris-loading");
const qrisImage = document.getElementById("qris-image");
const paymentStatusBadge = document.getElementById("payment-status-badge");
const successState = document.getElementById("success-state");

// ================= INITALIZATION =================
document.addEventListener("DOMContentLoaded", async () => {
  await loadOutletsAndUsers();
  checkSession();

  btnLogin.addEventListener("click", handleLogin);
  btnLogout.addEventListener("click", handleLogout);
  btnPayQris.addEventListener("click", handleCreateQrisPayment);
  btnCloseQris.addEventListener("click", closeModalQris);
});

// Load Dropdown Outlets dan Users dari Supabase
async function loadOutletsAndUsers() {
  const { data: outlets } = await supabase.from("outlets").select("*");
  const { data: users } = await supabase.from("users").select("*");

  if (outlets) {
    selectOutlet.innerHTML = '<option value="">-- Pilih Outlet --</option>' +
      outlets.map(o => `<option value="${o.id}">${o.nama_outlet}</option>`).join("");
  }

  if (users) {
    selectKasir.innerHTML = '<option value="">-- Pilih Nama Kasir --</option>' +
      users.map(u => `<option value="${u.id}" data-outlet="${u.outlet_id}">${u.nama_pegawai}</option>`).join("");
  }
}

// Session Check dari LocalStorage
function checkSession() {
  const savedSession = localStorage.getItem("pos_session");
  if (savedSession) {
    const session = JSON.parse(savedSession);
    currentOutlet = session.outlet;
    currentKasir = session.kasir;

    document.getElementById("header-outlet-name").innerText = currentOutlet.nama;
    document.getElementById("header-kasir-name").innerText = `Kasir: ${currentKasir.nama}`;

    screenLogin.classList.add("hidden");
    screenPos.classList.remove("hidden");
    loadProducts();
  }
}

function handleLogin() {
  const outletId = selectOutlet.value;
  const kasirId = selectKasir.value;

  if (!outletId || !kasirId) return alert("Pilih Outlet dan Kasir!");

  const outletNama = selectOutlet.options[selectOutlet.selectedIndex].text;
  const kasirNama = selectKasir.options[selectKasir.selectedIndex].text;

  const sessionData = {
    outlet: { id: outletId, nama: outletNama },
    kasir: { id: kasirId, nama: kasirNama }
  };

  localStorage.setItem("pos_session", JSON.stringify(sessionData));
  checkSession();
}

function handleLogout() {
  localStorage.removeItem("pos_session");
  location.reload();
}

// ================= PRODUCT & CART LOGIC =================
async function loadProducts() {
  const { data, error } = await supabase
    .from("products")
    .select("*")
    .eq("outlet_id", currentOutlet.id);

  if (error) return console.error(error);
  products = data || [];
  renderProducts();
}

function renderProducts() {
  productGrid.innerHTML = products.map(p => `
    <div onclick="addToCart('${p.id}')" class="bg-white p-4 rounded-xl border border-slate-200 shadow-sm hover:border-indigo-500 cursor-pointer transition flex flex-col justify-between">
      <div>
        <h3 class="font-bold text-slate-800 mb-1">${p.nama_produk}</h3>
        <p class="text-xs text-slate-400 mb-2">Stok: ${p.stok}</p>
      </div>
      <p class="font-bold text-indigo-600">Rp ${Number(p.harga).toLocaleString('id-ID')}</p>
    </div>
  `).join("");
}

window.addToCart = (productId) => {
  const product = products.find(p => p.id === productId);
  if (!product || product.stok <= 0) return alert("Stok habis!");

  const existingItem = cart.find(item => item.id === productId);
  if (existingItem) {
    if (existingItem.qty < product.stok) {
      existingItem.qty += 1;
    } else {
      alert("Mencapai batas stok!");
    }
  } else {
    cart.push({ ...product, qty: 1 });
  }

  renderCart();
};

function renderCart() {
  if (cart.length === 0) {
    cartList.innerHTML = `<div class="text-center text-slate-400 py-10 text-sm">Keranjang masih kosong</div>`;
    btnPayQris.disabled = true;
    cartTotalText.innerText = "Rp 0";
    return;
  }

  btnPayQris.disabled = false;
  let total = 0;

  cartList.innerHTML = cart.map(item => {
    const itemTotal = item.harga * item.qty;
    total += itemTotal;
    return `
      <div class="flex justify-between items-center bg-slate-50 p-3 rounded-lg border border-slate-100">
        <div>
          <h4 class="font-semibold text-sm text-slate-800">${item.nama_produk}</h4>
          <p class="text-xs text-slate-500">Rp ${Number(item.harga).toLocaleString('id-ID')} x ${item.qty}</p>
        </div>
        <div class="flex items-center gap-2">
          <span class="font-bold text-sm">Rp ${Number(itemTotal).toLocaleString('id-ID')}</span>
          <button onclick="removeFromCart('${item.id}')" class="text-red-500 hover:text-red-700 font-bold px-1 text-xs">✕</button>
        </div>
      </div>
    `;
  }).join("");

  cartTotalText.innerText = `Rp ${Number(total).toLocaleString('id-ID')}`;
}

window.removeFromCart = (productId) => {
  cart = cart.filter(item => item.id !== productId);
  renderCart();
};

// ================= QRIS & REALTIME PAYMENT =================
async function handleCreateQrisPayment() {
  const totalHarga = cart.reduce((acc, item) => acc + (item.harga * item.qty), 0);
  const orderId = `INV-${currentOutlet.id.slice(0, 4)}-${Date.now()}`;

  // Reset Modal State
  qrisTotalText.innerText = `Rp ${Number(totalHarga).toLocaleString('id-ID')}`;
  modalQris.classList.remove("hidden");
  qrisLoading.classList.remove("hidden");
  qrisImage.classList.add("hidden");
  paymentStatusBadge.classList.remove("hidden");
  successState.classList.add("hidden");

  try {
    // 1. Simpan Transaksi PENDING ke Supabase
    const { data: tx, error: txErr } = await supabase
      .from("transactions")
      .insert([{
        midtrans_order_id: orderId,
        outlet_id: currentOutlet.id,
        user_id: currentKasir.id,
        total_harga: totalHarga,
        status_pembayaran: "PENDING"
      }])
      .select()
      .single();

    if (txErr) throw txErr;

    // Simpan Transaction Items
    const itemsToInsert = cart.map(c => ({
      transaction_id: tx.id,
      product_id: c.id,
      jumlah: c.qty,
      harga_satuan: c.harga
    }));
    await supabase.from("transaction_items").insert(itemsToInsert);

    // 2. Minta QRIS ke Supabase Edge Function
    const response = await fetch(`${SUPABASE_URL}/functions/v1/charge-qris`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId: orderId, grossAmount: totalHarga })
    });

    const result = await response.json();
    if (!result.qrImageUrl) throw new Error("Gagal mengambil QRIS");

    // Tampilkan QR Code di Modal
    qrisImage.src = result.qrImageUrl;
    qrisLoading.classList.add("hidden");
    qrisImage.classList.remove("hidden");

    // 3. Pasang Supabase Realtime Listener untuk mendengarkan saat LUNAS
    subscribeRealtimePayment(orderId);

  } catch (err) {
    alert("Error: " + err.message);
    closeModalQris();
  }
}

// SUPABASE REALTIME LISTENER (KUNCI OTOMATISASI LUNAS)
function subscribeRealtimePayment(orderId) {
  if (activeRealtimeChannel) supabase.removeChannel(activeRealtimeChannel);

  activeRealtimeChannel = supabase
    .channel(`payment-${orderId}`)
    .on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "transactions",
        filter: `midtrans_order_id=eq.${orderId}`
      },
      (payload) => {
        if (payload.new.status_pembayaran === "SUCCESS") {
          // UPDATE LAYAR MENJADI LUNAS SECARA INSTAN!
          qrisContainerHide();
          paymentStatusBadge.classList.add("hidden");
          successState.classList.remove("hidden");
          
          // Reset Cart & Reload Produk
          cart = [];
          renderCart();
          loadProducts();

          // Auto Close Modal setelah 3 detik
          setTimeout(() => {
            closeModalQris();
          }, 3000);
        }
      }
    )
    .subscribe();
}

function qrisContainerHide() {
  qrisImage.classList.add("hidden");
}

function closeModalQris() {
  modalQris.classList.add("hidden");
  if (activeRealtimeChannel) {
    supabase.removeChannel(activeRealtimeChannel);
  }
}
