const axios = require('axios');
const crypto = require('crypto');
const fs = require('fs');
require('dotenv').config();

const BASE_URL = process.env.BASE_URL;
const SECRET_KEY = process.env.SECRET_KEY;
const API_ID = process.env.API_ID;
const API_PATH_BASE = process.env.API_PATH; // /open-api/dr-rekap-absensi/search

function generateCmd(method, contentType, timestamp, path) {
    const concatString = method + contentType + timestamp + path;
    const hmac = crypto.createHmac('sha512', SECRET_KEY);
    hmac.update(concatString);
    const hexHash = hmac.digest('hex');
    return Buffer.from(hexHash, 'utf-8').toString('base64');
}

async function runTest(name, pathWithQuery) {
    const timestamp = Date.now().toString();
    const apiKey = generateCmd('GET', 'application/json', timestamp, pathWithQuery);

    const headers = {
        'API-ID': API_ID,
        'Api-Key': apiKey,
        'Api-Auth-Time': timestamp,
        'Content-Type': 'application/json'
    };

    const url = `${BASE_URL}${pathWithQuery}`;

    try {
        const response = await axios.get(url, { headers });
        return `[PASS] ${name}: Status ${response.status} - Data: ${JSON.stringify(response.data).substring(0, 100)}\n`;
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

    // 1. With Query Parameters
    const today = new Date().toISOString().split('T')[0]; // 2026-01-30
    const query = `?startDate=${today}&endDate=${today}`;
    const pathWithQuery = API_PATH_BASE + query;

    output += await runTest('With Query Params', pathWithQuery);

    output += '--- END ---\n';
    fs.writeFileSync('test_output_3.txt', output);
}

runTests();
