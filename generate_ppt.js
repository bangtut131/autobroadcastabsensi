const pptxgen = require('pptxgenjs');

let pptx = new pptxgen();

// Title Slide
let slide1 = pptx.addSlide();
slide1.addText('Sistem Auto Broadcast & Monitoring Absensi Gaji.id', { x: 0.5, y: 2, w: '90%', h: 1, fontSize: 32, bold: true, align: 'center', color: '363636' });
slide1.addText('Otomatisasi Laporan Kehadiran Karyawan via WhatsApp', { x: 0.5, y: 3, w: '90%', h: 1, fontSize: 18, align: 'center', color: '666666' });
slide1.addText('Oleh: Tim IT / HR', { x: 0.5, y: 4, w: '90%', h: 0.5, fontSize: 14, align: 'center', color: '999999' });

// Slide 2
let slide2 = pptx.addSlide();
slide2.addText('Latar Belakang & Masalah', { x: 0.5, y: 0.5, w: '90%', h: 0.8, fontSize: 28, bold: true, color: 'E74C3C' });
slide2.addText([
    { text: '1. Monitoring Harian Manual: HR harus mengecek Gaji.id secara manual setiap hari.\n' },
    { text: '2. Distribusi Informasi Lambat: Laporan keterlambatan tidak real-time ke pimpinan.\n' },
    { text: '3. Risiko Terlewat: Kasus keterlambatan tanpa izin sering luput dari pantauan.\n' },
    { text: '4. Rekapitulasi Menguras Waktu: Merekap performa tiap akhir minggu butuh waktu ekstra.' }
], { x: 0.5, y: 1.5, w: '90%', h: 3.5, fontSize: 18, bullet: true, color: '363636' });

// Slide 3
let slide3 = pptx.addSlide();
slide3.addText('Solusi yang Ditawarkan', { x: 0.5, y: 0.5, w: '90%', h: 0.8, fontSize: 28, bold: true, color: '2E86AB' });
slide3.addText('Aplikasi Middleware Auto Broadcast Absensi\nSebuah sistem otomatis yang bertugas menarik data dari Gaji.id secara periodik, memilah datanya, lalu menyiarkan (broadcast) laporan tersebut langsung via WhatsApp secara terjadwal.', { x: 0.5, y: 1.5, w: '90%', h: 1.5, fontSize: 18, color: '363636' });
slide3.addText('Tujuan Utama:', { x: 0.5, y: 3.0, w: '90%', h: 0.5, fontSize: 20, bold: true, color: '2E86AB' });
slide3.addText([
    { text: 'Mempercepat distribusi informasi absensi (Hadir/Telat/Alpha).' },
    { text: 'Mengeliminasi beban kerja manual.' },
    { text: 'Menyediakan Dashboard rekapan yang instan dan terstruktur.' }
], { x: 0.5, y: 3.5, w: '90%', h: 1.5, fontSize: 18, bullet: true, color: '363636' });

// Slide 4
let slide4 = pptx.addSlide();
slide4.addText('Fitur Utama Aplikasi', { x: 0.5, y: 0.5, w: '90%', h: 0.8, fontSize: 28, bold: true, color: '27AE60' });
slide4.addText([
    { text: 'Dashboard Monitoring Web: Sinkronisasi live dari Gaji.id.\n' },
    { text: 'Auto-Broadcast WhatsApp (Terjadwal): Cron Job untuk laporan otomatis.\n' },
    { text: 'Smart Categorization Report: Laporan Umum, Telat/Alpha, Izin/Cuti, dan Rekap Mingguan.\n' },
    { text: 'Dynamic Settings: Template WA, Hari Libur, Jam Pengiriman diatur dari UI Admin.' }
], { x: 0.5, y: 1.5, w: '90%', h: 3.5, fontSize: 18, bullet: true, color: '363636' });

// Slide 5
let slide5 = pptx.addSlide();
slide5.addText('Kesimpulan & Nilai Tambah (Benefits)', { x: 0.5, y: 0.5, w: '90%', h: 0.8, fontSize: 28, bold: true, color: 'F39C12' });
slide5.addText([
    { text: 'Efisiensi Waktu: Nol menit untuk cross-check data mentah.\n' },
    { text: 'Budaya Kedisiplinan: Pimpinan / Spv bisa pantau real-time dari WhatsApp.\n' },
    { text: 'Fleksibel & Terpusat: Perubahan template dan jadwal tanpa repot meminta revisi kode.\n' },
    { text: 'Cloud-Ready: Siap untuk berjalan 24/7 di environment Cloud.' }
], { x: 0.5, y: 1.5, w: '90%', h: 3.5, fontSize: 18, bullet: true, color: '363636' });

// Save
pptx.writeFile({ fileName: 'Presentasi_Absensi_Gaji_ID.pptx' }).then(fileName => {
    console.log(`created file: ${fileName}`);
});
