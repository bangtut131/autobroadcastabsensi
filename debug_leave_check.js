/**
 * Debug script to check leave data format from Gaji.id API
 * Run: node debug_leave_check.js
 */

const axios = require('axios');
const crypto = require('crypto');
const fs = require('fs');
require('dotenv').config();

const BASE_URL = (process.env.BASE_URL || '').trim();
const SECRET_KEY = (process.env.SECRET_KEY || '').trim();
const API_ID = (process.env.API_ID || '').trim();
const API_PATH = (process.env.API_PATH || '').trim();

function generateHMACSHA512(data) {
    const hmac = crypto.createHmac('sha512', SECRET_KEY);
    hmac.update(data);
    return hmac.digest('hex');
}

function encodeBase64(input) {
    return Buffer.from(input, 'utf8').toString('base64');
}

function generateAuthHeaders(method = 'GET', contentType = 'application/json') {
    const timestamp = Date.now().toString();
    const concatString = method + contentType + timestamp + API_PATH;
    const hmacSha512 = generateHMACSHA512(concatString);
    const apiKey = encodeBase64(hmacSha512);

    return {
        'API-ID': API_ID,
        'Api-Key': apiKey,
        'Api-Auth-Time': timestamp,
        'Content-Type': contentType
    };
}

async function fetchAndAnalyzeData() {
    const headers = generateAuthHeaders();
    const url = `${BASE_URL}${API_PATH}`;
    const today = new Date().toISOString().split('T')[0];

    const params = {
        namaFormatLaporan: 'Data Harian',
        tanggalAbsensiAwal: today,
        tanggalAbsensiAkhir: today
    };

    console.log(`\n🔍 DEBUG LEAVE CHECK - ${today}`);
    console.log(`URL: ${url}`);
    console.log('-------------------------------------------');

    try {
        const response = await axios.get(url, { headers, params });
        const rawData = response.data;

        // Save raw response for inspection
        fs.writeFileSync('debug_raw_response.json', JSON.stringify(rawData, null, 2));
        console.log('📁 Raw response saved to: debug_raw_response.json');

        let list = [];
        if (rawData.data && Array.isArray(rawData.data.rptInquiryAbsensiHarians)) {
            list = rawData.data.rptInquiryAbsensiHarians;
        } else if (Array.isArray(rawData.data)) {
            list = rawData.data;
        }

        console.log(`📊 Total Records: ${list.length}`);
        console.log('-------------------------------------------');

        // Analyze all unique status types
        const statusTypes = {};
        list.forEach(item => {
            const status = item.jenisabsensirealisasi || item.status || 'Unknown';
            if (!statusTypes[status]) {
                statusTypes[status] = [];
            }
            statusTypes[status].push(item.nmkry || item.fullName || 'Unknown');
        });

        console.log('\n📋 STATUS BREAKDOWN:');
        console.log('-------------------------------------------');
        for (const [status, employees] of Object.entries(statusTypes)) {
            console.log(`\n[${status}] - ${employees.length} karyawan`);
            employees.forEach((name, i) => {
                console.log(`  ${i + 1}. ${name}`);
            });
        }

        // Filter Logic Analysis
        console.log('\n\n🔎 FILTER ANALYSIS (Current Logic):');
        console.log('-------------------------------------------');

        const izinItems = list.filter(item => {
            const status = item.jenisabsensirealisasi || item.status || '';
            return status.includes('Izin');
        });
        console.log(`\n✅ Izin (includes 'Izin'): ${izinItems.length}`);
        izinItems.forEach((item, i) => {
            console.log(`  ${i + 1}. ${item.nmkry} - Status: ${item.jenisabsensirealisasi || item.status}`);
        });

        const cutiItems = list.filter(item => {
            const status = item.jenisabsensirealisasi || item.status || '';
            return status.includes('Cuti');
        });
        console.log(`\n✅ Cuti (includes 'Cuti'): ${cutiItems.length}`);
        cutiItems.forEach((item, i) => {
            console.log(`  ${i + 1}. ${item.nmkry} - Status: ${item.jenisabsensirealisasi || item.status}`);
        });

        // Check for case sensitivity and variations
        console.log('\n\n🔎 CASE-INSENSITIVE CHECK:');
        console.log('-------------------------------------------');

        const izinLower = list.filter(item => {
            const status = (item.jenisabsensirealisasi || item.status || '').toLowerCase();
            return status.includes('izin');
        });
        console.log(`izin (lowercase): ${izinLower.length}`);

        const cutiLower = list.filter(item => {
            const status = (item.jenisabsensirealisasi || item.status || '').toLowerCase();
            return status.includes('cuti');
        });
        console.log(`cuti (lowercase): ${cutiLower.length}`);

        // Check for related keywords
        console.log('\n\n🔎 RELATED KEYWORD CHECK:');
        console.log('-------------------------------------------');
        const keywords = ['permission', 'permit', 'leave', 'ijin', 'off', 'tidak hadir', 'absen', 'mangkir', 'libur'];
        keywords.forEach(keyword => {
            const matches = list.filter(item => {
                const status = (item.jenisabsensirealisasi || item.status || '').toLowerCase();
                return status.includes(keyword);
            });
            if (matches.length > 0) {
                console.log(`"${keyword}": ${matches.length} records found`);
            }
        });

        // Summary
        console.log('\n\n📊 SUMMARY:');
        console.log('-------------------------------------------');
        console.log(`Total Records: ${list.length}`);
        console.log(`Hadir: ${list.filter(item => (item.jenisabsensirealisasi || item.status) === 'Hadir').length}`);
        console.log(`Matched as 'Izin': ${izinItems.length}`);
        console.log(`Matched as 'Cuti': ${cutiItems.length}`);
        console.log(`\nUnique Status Values:`);
        Object.keys(statusTypes).forEach(s => {
            console.log(`  - "${s}" (${statusTypes[s].length})`);
        });

    } catch (error) {
        console.error('❌ Error:', error.message);
        if (error.response) {
            console.error('Response:', JSON.stringify(error.response.data, null, 2));
        }
    }
}

fetchAndAnalyzeData();
