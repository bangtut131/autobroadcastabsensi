require('dotenv').config();
const axios = require('axios');
const crypto = require('crypto');
const fs = require('fs');

// Configuration
const BASE_URL = (process.env.BASE_URL || '').trim();
const SECRET_KEY = (process.env.SECRET_KEY || '').trim();
const API_ID = (process.env.API_ID || '').trim();
const API_PATH = (process.env.API_PATH || '').trim();

// ...



/**
 * Generate HMAC SHA-512 Hash
 */
function generateHMACSHA512(data, secretKey) {
    const hmac = crypto.createHmac('sha512', secretKey);
    hmac.update(data);
    return hmac.digest('hex');
}

/**
 * Encode String to Base64
 */
function encodeBase64(input) {
    return Buffer.from(input, 'utf8').toString('base64');
}

/**
 * Generate API Authentication Headers
 */
function generateAuthHeaders(method = 'GET', contentType = 'application/json') {
    const timestamp = Date.now().toString();
    const concatString = method + contentType + timestamp + API_PATH;

    // Create HMAC SHA-512
    const hmacSha512 = generateHMACSHA512(concatString, SECRET_KEY);

    // Base64 encode the Hex String
    const apiKey = encodeBase64(hmacSha512);

    // Detailed Logging for Debugging
    console.log("--- Generating API Credentials ---");
    console.log(`Endpoint Path: ${API_PATH}`);
    console.log(`Method: ${method}`);
    console.log(`Content-Type: ${contentType}`);
    console.log(`Timestamp (Api-Auth-Time): ${timestamp}`);
    console.log(`Signature String: ${concatString}`);
    console.log(`HMAC SHA-512 (Hex): ${hmacSha512}`);
    console.log(`Generated API Key (Api-Key): ${apiKey}`);
    console.log("---------------------------------");

    return {
        'API-ID': API_ID,
        'Api-Key': apiKey,
        'Api-Auth-Time': timestamp,
        'Content-Type': contentType
    };
}

async function fetchAttendance() {
    const headers = generateAuthHeaders();
    const url = `${BASE_URL}${API_PATH}`;

    const today = new Date().toISOString().split('T')[0];
    const params = {
        namaFormatLaporan: 'Data Harian',
        tanggalAbsensiAwal: today,
        tanggalAbsensiAkhir: today
    };

    console.log(`[INFO] Fetching data from: ${url}`);
    console.log(`[INFO] Params:`, JSON.stringify(params));

    try {
        // Explicitly set Content-Type for GET request as it is part of the signature
        const response = await axios.get(url, {
            headers,
            params
        });
        const data = response.data;

        console.log('[SUCCESS] Data fetched successfully.');

        // Log a sample of the data to understand the structure
        console.log('[DATA SAMPLE]', JSON.stringify(data, null, 2).substring(0, 500));

        if (data.status === 'ERROR' || (data.code && data.code !== 200)) {
            console.error('[API ERROR]', JSON.stringify(data, null, 2));
            if (data.errors) {
                data.errors.forEach(err => {
                    console.error(` - Error Code: ${err.code}`);
                    console.error(` - Description: ${err.desc}`);
                });
            }
            return;
        }

        processAttendanceData(data);

    } catch (error) {
        if (error.response) {
            const errorLog = `[HTTP ERROR] Status: ${error.response.status}\n` +
                `[RESPONSE DATA]\n${JSON.stringify(error.response.data, null, 2)}\n` +
                `[HEADERS SENT]\n${JSON.stringify(error.config.headers, null, 2)}\n`;
            console.error(errorLog);
            fs.writeFileSync('error.log', errorLog);
        } else {
            console.error('[ERROR]', error.message);
            fs.writeFileSync('error.log', `[ERROR] ${error.message}`);
        }
    }
}

function processAttendanceData(data) {
    const today = new Date().toISOString().split('T')[0];
    const timestamp = new Date().toLocaleString();
    console.log(`\n--- ATTENDANCE REPORT (${today}) ---`);
    console.log('Processing data...');

    // Simple processing example - adjust based on actual API response structure
    // Assuming data.data or similar contains the list
    let results = [];
    if (data && data.data) {
        // This mapping depends on the actual structure of 'data' from API
        // For now we map generically or based on what we see in logs
        // If data is an array
        const list = Array.isArray(data.data) ? data.data : (Array.isArray(data) ? data : []);

        results = list.map(item => ({
            nama: item.fullName || item.nama || 'Unknown',
            nik: item.employeeNo || item.nik || '-',
            jamMasuk: item.attendanceIn || '-',
            jamKeluar: item.attendanceOut || '-',
            status: item.status || 'Hadir'
        }));
    }

    const outputData = {
        timestamp: timestamp,
        results: results
    };

    const fileContent = `window.ATTENDANCE_DATA = ${JSON.stringify(outputData, null, 2)};`;

    try {
        fs.writeFileSync('data.js', fileContent);
        console.log('[SUCCESS] Data saved to data.js for web view.');
    } catch (err) {
        console.error('[ERROR] Failed to save data.js:', err.message);
    }
}

// Run the script
fetchAttendance();
