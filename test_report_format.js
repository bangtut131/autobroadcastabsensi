
const scheduler = require('./services/scheduler');

// Mock Data
const mockData = [
    { nama: 'Budi', nik: '001', status: 'Hadir', jamMasuk: '08:00', jamKeluar: '17:00', menitTerlambat: 0 },
    { nama: 'Siti', nik: '002', status: 'Izin Sakit', jamMasuk: '-', jamKeluar: '-', menitTerlambat: 0, keterangan: 'Demam' },
    { nama: 'Agus', nik: '003', status: 'Cuti Tahunan', jamMasuk: '-', jamKeluar: '-', menitTerlambat: 0, keterangan: 'Liburan' },
    { nama: 'Rina', nik: '004', status: 'Alpha', jamMasuk: '-', jamKeluar: '-', menitTerlambat: 0 },
    { nama: 'Joko', nik: '005', status: 'Hadir', jamMasuk: '08:15', jamKeluar: '17:15', menitTerlambat: 15 },
    { nama: 'Doni', nik: '006', status: 'Tanpa Keterangan', jamMasuk: '-', jamKeluar: '-', menitTerlambat: 0 },
    { nama: 'Eka', nik: '007', status: 'Hadir', jamMasuk: '08:05', jamKeluar: '17:00', menitTerlambat: 5 }
];

// Mock Settings
global.SETTINGS = { messageTemplate: "*HEAD*\n{{data}}" };

console.log("\n--- TEST: LEAVE REPORT ---");
const leaveReport = scheduler.generateReport(mockData, 'leave');
console.log(leaveReport);

console.log("\n--- TEST: LATE REPORT ---");
const lateReport = scheduler.generateReport(mockData, 'late');
console.log(lateReport);

console.log("\n--- TEST: GENERAL REPORT ---");
const generalReport = scheduler.generateReport(mockData, 'general');
console.log(generalReport);
