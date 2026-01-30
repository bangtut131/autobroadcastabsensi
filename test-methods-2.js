const axios = require('axios');
const crypto = require('crypto');
const fs = require('fs');
require('dotenv').config();

const BASE_URL = process.env.BASE_URL; // https://member.gaji.id/gajiid-API
const SECRET_KEY = process.env.SECRET_KEY;
const API_ID = process.env.API_ID;
const API_PATH = process.env.API_PATH; // /open-api/dr-rekap-absensi/search

function generateCmd(method, contentType, timestamp, pathOverride) {
    const path = pathOverride !== undefined ? pathOverride : API_PATH;
    const concatString = method + contentType + timestamp + path;
    const hmac = crypto.createHmac('sha512', SECRET_KEY);
    hmac.update(concatString);
    const hexHash = hmac.digest('hex');
    return Buffer.from(hexHash, 'utf-8').toString('base64');
}

async function runTest(name, pathForSign) {
    const method = 'GET';
    const contentType = 'application/json';
    const timestamp = Date.now().toString();
    const apiKey = generateCmd(method, contentType, timestamp, pathForSign);

    const headers = {
        'API-ID': API_ID,
        'Api-Key': apiKey,
        'Api-Auth-Time': timestamp,
        'Content-Type': contentType
    };

    const url = `${BASE_URL}${API_PATH}`;

    try {
        const response = await axios.get(url, { headers });
        return `[PASS] ${name}: Status ${response.status}\n`;
    } catch (error) {
        if (error.response) {
            return `[FAIL] ${name}: Status ${error.response.status} - Code: ${error.response.data.errors?.[0]?.code} - Desc: ${error.response.data.errors?.[0]?.desc}\n`;
        } else {
            return `[ERR] ${name}: ${error.message}\n`;
        }
    }
}

async function runTests() {
    let output = '--- START ---\n';

    // 1. Standard (with leading slash)
    output += await runTest('Standard (With /)', API_PATH);

    // 2. Without leading slash
    const pathNoSlash = API_PATH.substring(1); // open-api/dr-rekap-absensi/search
    output += await runTest('No Leading Slash', pathNoSlash);

    output += '--- END ---\n';
    fs.writeFileSync('test_output_2.txt', output);
}

runTests();
