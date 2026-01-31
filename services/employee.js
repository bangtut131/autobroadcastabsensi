const axios = require('axios');
const crypto = require('crypto');
require('dotenv').config();

class EmployeeService {
    constructor() {
        // Use the new URL specifically for Employee Search as requested
        // Fallback to env BASE_URL if not set, but prefer the 'new' one for this service
        this.BASE_URL = 'https://member.gaji.id/gajiid-API-new';
        this.SECRET_KEY = (process.env.SECRET_KEY || '').trim();
        this.API_ID = (process.env.API_ID || '').trim();
        this.API_PATH = '/open-api/karyawan/search';
    }

    generateHMACSHA512(data) {
        const hmac = crypto.createHmac('sha512', this.SECRET_KEY);
        hmac.update(data);
        return hmac.digest('hex');
    }

    encodeBase64(input) {
        return Buffer.from(input, 'utf8').toString('base64');
    }

    generateAuthHeaders(method = 'GET', contentType = 'application/json') {
        const timestamp = Date.now().toString();
        // Signature uses the PATH only, not the full URL or query params
        const concatString = method + contentType + timestamp + this.API_PATH;
        const hmacSha512 = this.generateHMACSHA512(concatString);
        const apiKey = this.encodeBase64(hmacSha512);

        return {
            'API-ID': this.API_ID,
            'Api-Key': apiKey,
            'Api-Auth-Time': timestamp,
            'Content-Type': contentType
        };
    }

    async fetchEmployees() {
        if (!this.BASE_URL) throw new Error('BASE_URL not configured');

        const headers = this.generateAuthHeaders();
        // Append query params for filtering
        const url = `${this.BASE_URL}${this.API_PATH}?statusBekerja=MasihBekerja`;

        try {
            console.log(`[EmployeeService] Fetching from ${url}`);
            const response = await axios.get(url, { headers });

            if (response.data && (response.data.status === 'ERROR' || response.data.error)) {
                console.error('[EmployeeService] API returned error:', response.data);
                throw new Error('API Error: ' + JSON.stringify(response.data));
            }

            return this.processData(response.data);
        } catch (error) {
            console.error('[EmployeeService] Failed to fetch:', error.message);
            if (error.response) {
                console.error('[EmployeeService] Response Status:', error.response.status);
                // Check if it is the HTML error page
                if (error.response.status === 404 && typeof error.response.data === 'string' && error.response.data.includes('<!doctype html>')) {
                    throw new Error(`Endpoint not found (404). Please contact Gaji.id support to enable '/open-api/karyawan/search'.`);
                }
            }
            throw error;
        }
    }

    processData(rawData) {
        let list = [];
        // Handle various response wrappers
        if (rawData.data && Array.isArray(rawData.data)) {
            list = rawData.data;
        } else if (rawData.data && rawData.data.listKaryawan) {
            list = rawData.data.listKaryawan;
        } else if (Array.isArray(rawData)) {
            list = rawData;
        }

        console.log(`[EmployeeService] Found ${list.length} records`);

        return list.map(item => {
            return {
                id: item.idKaryawan || item.nik || item.employeeId || '-',
                nama: item.namaKaryawan || item.nama || item.fullName || '-',
                posisi: item.namaJabatan || item.jabatan || item.position || '-',
                departemen: item.namaDepartemen || item.departemen || item.department || '-',
                status: item.statusBekerja || item.status || '-',
                joinDate: item.tanggalBergabung || item.joinDate || item.tglMasuk || '-'
            };
        });
    }
}

module.exports = new EmployeeService();
