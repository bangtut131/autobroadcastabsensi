const crypto = require('crypto');
require('dotenv').config();

const BASE_URL = process.env.BASE_URL;
const SECRET_KEY = process.env.SECRET_KEY;
const API_ID = process.env.API_ID;
const API_PATH = process.env.API_PATH;

function generateCmd() {
    const method = 'GET';
    const contentType = 'application/json';
    const timestamp = Date.now().toString();
    const concatString = method + contentType + timestamp + API_PATH;

    const hmac = crypto.createHmac('sha512', SECRET_KEY);
    hmac.update(concatString);
    const hexHash = hmac.digest('hex');
    const apiKey = Buffer.from(hexHash, 'utf-8').toString('base64');

    const url = `${BASE_URL}${API_PATH}`;

    console.log(`curl -v -H "API-ID: ${API_ID}" -H "Api-Key: ${apiKey}" -H "Api-Auth-Time: ${timestamp}" -H "Content-Type: ${contentType}" "${url}"`);
}

generateCmd();
