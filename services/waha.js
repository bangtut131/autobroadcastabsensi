const axios = require('axios');

class WahaService {
    constructor() {
        // Defaults, can be overridden by settings
        this.defaultUrl = 'http://localhost:3000';
    }

    async sendText(baseUrl, sessionId, apiKey, chatId, message) {
        // Remove trailing slash if present to avoid double slashes
        const cleanBaseUrl = (baseUrl || this.defaultUrl).replace(/\/$/, '');
        const url = `${cleanBaseUrl}/api/sendText`;
        const payload = {
            chatId: chatId,
            text: message,
            session: sessionId || 'default'
        };

        const headers = {};
        if (apiKey) {
            headers['X-Api-Key'] = apiKey;
        }

        try {
            console.log(`[WahaService] Sending to ${url}`, payload);
            const response = await axios.post(url, payload, { headers });
            return response.data;
        } catch (error) {
            console.error('[WahaService] Send failed:', error.message);
            if (error.response) {
                console.error('[WahaService] Status:', error.response.status);
                console.error('[WahaService] Data:', JSON.stringify(error.response.data));
            } else if (error.request) {
                console.error('[WahaService] No response received (Network Error?)');
            }
            throw error;
        }
    }
}

module.exports = new WahaService();
