const axios = require('axios');
const crypto = require('crypto');
const fs = require('fs');
require('dotenv').config();

const BASE_URL = process.env.BASE_URL;
const SECRET_KEY = process.env.SECRET_KEY;
const API_ID = process.env.API_ID;
const API_PATH = process.env.API_PATH;

function generateCmd(method, contentType, timestamp) {
    const concatString = method + contentType + timestamp + API_PATH;
    const hmac = crypto.createHmac('sha512', SECRET_KEY);
    hmac.update(concatString);
    const hexHash = hmac.digest('hex');
    return Buffer.from(hexHash, 'utf-8').toString('base64');
}

async function runTest(name, method, sendContentType, signContentType) {
    const timestamp = Date.now().toString();
    const apiKey = generateCmd(method, signContentType || '', timestamp);

    const headers = {
        'API-ID': API_ID,
        'Api-Key': apiKey,
        'Api-Auth-Time': timestamp
    };
    if (sendContentType) {
        headers['Content-Type'] = sendContentType;
    }

    const url = `${BASE_URL}${API_PATH}`;

    try {
        let response;
        if (method === 'GET') {
            response = await axios.get(url, { headers });
        } else {
            response = await axios.post(url, {}, { headers });
        }
        return `[PASS] ${name}: Status ${response.status}\n`;
    } catch (error) {
        if (error.response) {
            return `[FAIL] ${name}: Status ${error.response.status} - Data: ${JSON.stringify(error.response.data)}\n`;
        } else {
            return `[ERR] ${name}: ${error.message}\n`;
        }
    }
}

async function runTests() {
    let output = '--- START ---\n';

    output += await runTest('GET Standard', 'GET', 'application/json', 'application/json');
    output += await runTest('GET NoHeader SignJSON', 'GET', null, 'application/json');
    // output += await runTest('GET Standard SignEmpty', 'GET', 'application/json', '');
    // output += await runTest('GET NoHeader SignEmpty', 'GET', null, '');
    output += await runTest('POST Standard', 'POST', 'application/json', 'application/json');

    output += '--- END ---\n';
    fs.writeFileSync('test_output.txt', output);
}

runTests();
