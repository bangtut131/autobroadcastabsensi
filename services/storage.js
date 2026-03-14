const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const SETTINGS_FILE = path.join(__dirname, '../settings.json');

class StorageService {
    constructor() {
        this.supabase = null;
        if (process.env.SUPABASE_URL && process.env.SUPABASE_KEY) {
            this.supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
            console.log('[Storage] Supabase client initialized');
        } else {
            console.log('[Storage] Supabase credentials not found, using local file only');
        }
    }

    // Default settings structure
    getDefaults() {
        return {
            wahaUrl: 'http://localhost:3000',
            targetNumbers: [],
            sessionId: 'default',
            apiKey: '',
            messageTemplate: '*Laporan Absensi Harian*\n📅 {{date}}\n\n{{data}}',
            autoBroadcast: false,
            schedules: [],
            schedulesLeave: [],
            schedulesLate: [],
            schedulesWeeklyRecap: []
        };
    }

    async loadSettings() {
        let settings = this.getDefaults();

        // 1. Try loading from Supabase
        if (this.supabase) {
            try {
                const { data, error } = await this.supabase
                    .from('app_settings')
                    .select('config')
                    .eq('id', 1)
                    .single();

                if (error && error.code !== 'PGRST116') { // PGRST116 is "Row not found"
                    console.error('[Storage] Supabase load error:', error.message);
                } else if (data && data.config) {
                    console.log('[Storage] Loaded settings from Supabase');
                    return { ...settings, ...data.config };
                }
            } catch (err) {
                console.error('[Storage] Unexpected Supabase error:', err.message);
            }
        }

        // 2. Fallback to local file (if Supabase failed or not configured)
        try {
            if (fs.existsSync(SETTINGS_FILE)) {
                const localSettings = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8'));
                console.log('[Storage] Loaded settings from local file');
                return { ...settings, ...localSettings };
            }
        } catch (err) {
            console.error('[Storage] Local file load error:', err.message);
        }

        return settings;
    }

    async saveSettings(newSettings) {
        // 1. Save to Supabase
        if (this.supabase) {
            try {
                const { error } = await this.supabase
                    .from('app_settings')
                    .upsert({ id: 1, config: newSettings });

                if (error) {
                    console.error('[Storage] Supabase save error:', error.message);
                } else {
                    console.log('[Storage] Saved settings to Supabase');
                }
            } catch (err) {
                console.error('[Storage] Unexpected Supabase error:', err.message);
            }
        }

        // 2. Always save to local file as backup/cache
        try {
            fs.writeFileSync(SETTINGS_FILE, JSON.stringify(newSettings, null, 2));
            console.log('[Storage] Saved settings to local file');
        } catch (err) {
            console.error('[Storage] Local file save error:', err.message);
        }
    }

    async pingSupabase() {
        if (this.supabase) {
            try {
                // Lightweight query to keep Supabase project active
                const { error } = await this.supabase
                    .from('app_settings')
                    .select('id')
                    .limit(1);

                if (error) {
                    console.error('[Storage] Supabase keep-alive ping failed:', error.message);
                } else {
                    console.log('[Storage] Supabase keep-alive ping successful');
                }
            } catch (err) {
                console.error('[Storage] Unexpected Supabase ping error:', err.message);
            }
        }
    }
}

module.exports = new StorageService();
