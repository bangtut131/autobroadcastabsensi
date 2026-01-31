const axios = require('axios');
const crypto = require('crypto');
require('dotenv').config();

class AttendanceService {
    constructor() {
        this.BASE_URL = (process.env.BASE_URL || '').trim();
        this.SECRET_KEY = (process.env.SECRET_KEY || '').trim();
        this.API_ID = (process.env.API_ID || '').trim();
        this.API_PATH = (process.env.API_PATH || '').trim();
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

    async fetchData() {
        if (!this.BASE_URL) throw new Error('BASE_URL not configured');

        const headers = this.generateAuthHeaders();
        const url = `${this.BASE_URL}${this.API_PATH}`;
        const today = new Date().toISOString().split('T')[0];

        const params = {
            namaFormatLaporan: 'Data Harian',
            tanggalAbsensiAwal: today,
            tanggalAbsensiAkhir: today
        };

        try {
            console.log(`[AttendanceService] Fetching from ${url}`);
            const response = await axios.get(url, { headers, params });

            // Fix: Only throw error if status is explicitly ERROR, or code is present and not 200
            if (response.data && (response.data.status === 'ERROR' || (response.data.code && response.data.code !== 200))) {
                console.error('[AttendanceService] API returned error:', response.data);
                throw new Error('API Error: ' + JSON.stringify(response.data));
            }

            return this.processData(response.data);
        } catch (error) {
            console.error('[AttendanceService] Failed to fetch:', error.message);
            throw error;
        }
    }

    processData(rawData) {
        // Updated mapping based on: {"data":{"rptInquiryAbsensiHarians":[...]}}
        let list = [];

        if (rawData.data && Array.isArray(rawData.data.rptInquiryAbsensiHarians)) {
            list = rawData.data.rptInquiryAbsensiHarians;
        } else if (Array.isArray(rawData.data)) {
            list = rawData.data; // Fallback
        }

        console.log(`[AttendanceService] Processed ${list.length} records.`);

        // Note: Field times are missing in 'Data Harian' from debug observation. 
        // We map what we can, and default to '-' for missing times.
        return list.map(item => {
            // Helper to find dynamic leave description
            let leaveDesc = '-';
            if (item.jenisabsensirealisasi && ['Cuti', 'Izin', 'Sakit'].some(s => item.jenisabsensirealisasi.includes(s))) {
                leaveDesc = item.jenisabsensirealisasi;
            }
            // Check for specific dynamic keys if needed (e.g. sick_leave_*, special_leave_*)
            // For now, relying on 'jenisabsensirealisasi' is safer as a summary, 
            // but we can iterate keys if that is insufficient.

            return {
                nama: item.nmkry || item.fullName || 'Unknown',
                nik: item.nik || '-',
                // Docs: jammasuk, jampulang. If null -> '-'
                jamMasuk: item.jammasuk || '-',
                jamKeluar: item.jampulang || '-',
                // Docs: menitterlambatdiluarizin, menitterlambattermasukizin
                menitTerlambat: (parseFloat(item.menitterlambatdiluarizin) || 0) + (parseFloat(item.menitterlambattermasukizin) || 0),
                status: item.jenisabsensirealisasi || item.status || 'Hadir',
                keterangan: leaveDesc,
                // Additional fields for Karyawan menu
                posisi: item.nmjabatan || item.jabatan || item.posisi || '-',
                departemen: item.nmdivisi || item.divisi || item.nmdepartemen || item.departemen || '-',
                joinDate: item.tglmasuk || item.joindate || '-'
            };
        });
    }
}

module.exports = new AttendanceService();
