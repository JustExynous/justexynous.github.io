// ==============================================================================
// GORAMIK POS - KONFIGURASI GLOBAL SUPABASE (CENTRAL SERVER CONFIG)
// ==============================================================================
// Masukkan Project URL dan Anon Key Supabase di bawah ini agar SELURUH perangkat
// kasir, manajer, dan owner langsung otomatis terhubung ke database cloud
// tanpa perlu memasukkan konfigurasi secara manual di setiap perangkat!
// ==============================================================================

const GLOBAL_SUPABASE_CONFIG = {
    // Masukkan URL Supabase Anda di sini (misal: "https://xyzcompany.supabase.co")
    url: "https://bwhcicxwujgefkhfdazq.supabase.co",

    // Masukkan Anon / Public Key Supabase Anda di sini
    anonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ3aGNpY3h3dWpnZWZraGZkYXpxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA0ODI5MjYsImV4cCI6MjEwNjA1ODkyNn0.BkKCsT22_gCyrHzWgv5lqL2bjI7nw_iCQpMSvS0Nb84"
};

// Pasang ke window object
window.GLOBAL_SUPABASE_CONFIG = GLOBAL_SUPABASE_CONFIG;

