/**
 * Test script to verify late permission detection feature
 * Run: node test_late_permission.js
 */

const attendanceService = require('./services/attendance');
const schedulerService = require('./services/scheduler');

async function runTest() {
    console.log('\n🧪 TEST: Late Permission Detection Feature');
    console.log('='.repeat(50));

    try {
        // Fetch data
        console.log('\n1️⃣ Fetching data from Gaji.id API...');
        const data = await attendanceService.fetchData();
        console.log(`   ✅ Fetched ${data.length} records`);

        // Check new fields
        console.log('\n2️⃣ Verifying new fields in processed data...');
        const sampleItem = data[0];
        console.log('   Sample item fields:');
        console.log(`   - hasLatePermission: ${sampleItem.hasLatePermission !== undefined ? '✅' : '❌'} (${sampleItem.hasLatePermission})`);
        console.log(`   - menitTerlambatDenganIzin: ${sampleItem.menitTerlambatDenganIzin !== undefined ? '✅' : '❌'} (${sampleItem.menitTerlambatDenganIzin})`);

        // Find late permission items
        console.log('\n3️⃣ Finding employees with late permission...');
        const latePermissionItems = data.filter(item => item.hasLatePermission === true);
        console.log(`   Found: ${latePermissionItems.length} employee(s)`);

        if (latePermissionItems.length > 0) {
            console.log('\n   📋 Employees with Izin Terlambat:');
            latePermissionItems.forEach((item, i) => {
                console.log(`   ${i + 1}. ${item.nama}`);
                console.log(`      🕒 Jam Masuk: ${item.jamMasuk}`);
                console.log(`      ⏳ Terlambat: ${item.menitTerlambatDenganIzin} menit (diizinkan)`);
            });
        }

        // Check Izin filter (includes 'leave')
        console.log('\n4️⃣ Testing updated Izin filter (includes "leave")...');
        const izinItems = data.filter(item => {
            const status = (item.status || '').toLowerCase();
            return status.includes('izin') || status.includes('leave');
        });
        console.log(`   Found: ${izinItems.length} employee(s) with Izin/Leave status`);
        if (izinItems.length > 0) {
            izinItems.forEach((item, i) => {
                console.log(`   ${i + 1}. ${item.nama} - ${item.status}`);
            });
        }

        // Generate Leave Report
        console.log('\n5️⃣ Generating Leave Report (preview)...');

        // Mock global settings
        global.SETTINGS = {
            messageTemplate: '*Laporan Absensi Harian*\n📅 {{date}}\n\n{{data}}'
        };

        const report = schedulerService.generateReport(data, 'leave');
        console.log('\n' + '─'.repeat(50));
        console.log(report);
        console.log('─'.repeat(50));

        console.log('\n✅ TEST COMPLETED SUCCESSFULLY!');

    } catch (error) {
        console.error('\n❌ TEST FAILED:', error.message);
    }
}

runTest();
