import { createClient } from '@supabase/supabase-js';

// Inisialisasi Supabase Client di Frontend (Gunakan Anon Key)
const supabaseUrl = 'https://YOUR_SUPABASE_PROJECT_ID.supabase.co';
const supabaseAnonKey = 'YOUR_SUPABASE_ANON_KEY';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * Memasang Supabase Realtime Listener untuk memantau transaksi yang sedang berlangsung
 * @param {string} orderId - ID unik transaksi (misal: "INV-OUTLETA-20260920-001")
 * @param {function} onPaymentSuccess - Callback function yang dijalankan saat transaksi LUNAS
 */
export function listenToPaymentStatus(orderId, onPaymentSuccess) {
  console.log(`Memulai Realtime Listener untuk Order ID: ${orderId}...`);

  // Buat channel subscription khusus untuk orderId ini
  const paymentChannel = supabase
    .channel(`payment_status_${orderId}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',                   // Hanya dengarkan event perubatan/UPDATE data
        schema: 'public',
        table: 'transactions',             // Nama tabel transaksi Anda
        filter: `midtrans_order_id=eq.${orderId}` // Filter khusus transaksi ini saja
      },
      (payload) => {
        console.log('Perubahan data terdeteksi secara real-time:', payload.new);

        // Cek jika status_pembayaran berubah menjadi 'SUCCESS'
        if (payload.new.status_pembayaran === 'SUCCESS') {
          console.log('Pembayaran Terkonfirmasi LUNAS!');

          // Panggil fungsi callback di UI kasir (misal: tampilkan centang hijau, reset keranjang)
          onPaymentSuccess(payload.new);

          // Hentikan subscription/listener karena transaksi sudah selesai
          supabase.removeChannel(paymentChannel);
        }
      }
    )
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        console.log('Tersambung ke Supabase Realtime. Menunggu pembayaran QRIS...');
      }
    });

  // Mengembalikan fungsi cleanup untuk memutus koneksi jika kasir membatalkan transaksi/pindah layar
  return () => {
    supabase.removeChannel(paymentChannel);
  };
}
