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
                const now = new Date().toISOString();
                const pingCount = Math.floor(Math.random() * 100000);

                // Operation 1: UPSERT keep-alive row (write activity)
                const { error: upsertError } = await this.supabase
                    .from('app_settings')
                    .upsert({ id: 99, config: { keepalive: true, last_ping: now, ping_count: pingCount } });

                if (upsertError) {
                    console.error('[Storage] Keep-alive UPSERT failed:', upsertError.message);
                }

                // Operation 2: SELECT to verify (read activity)
                const { data, error: selectError } = await this.supabase
                    .from('app_settings')
                    .select('id, config')
                    .eq('id', 99)
                    .single();

                if (selectError) {
                    console.error('[Storage] Keep-alive SELECT failed:', selectError.message);
                }

                // Operation 3: INSERT a keep-alive log entry to broadcast_logs (more write activity)
                const { error: logError } = await this.supabase
                    .from('broadcast_logs')
                    .insert({
                        type: 'keepalive',
                        targets_count: 0,
                        status: 'ping',
                        message: `Keep-alive ping at ${now}`
                    });

                if (logError) {
                    // Table might not exist yet, just warn
                    console.warn('[Storage] Keep-alive log insert failed (table may not exist yet):', logError.message);
                }

                console.log(`[Storage] Supabase keep-alive ping successful (3 ops at ${now})`);
            } catch (err) {
                console.error('[Storage] Unexpected Supabase ping error:', err.message);
            }
        }
    }

    /**
     * Log a broadcast event to Supabase for audit trail + database activity
     */
    async logBroadcast(type, targetsCount, status = 'success', message = '') {
        if (this.supabase) {
            try {
                const { error } = await this.supabase
                    .from('broadcast_logs')
                    .insert({
                        type: type,
                        targets_count: targetsCount,
                        status: status,
                        message: message
                    });

                if (error) {
                    console.warn('[Storage] Broadcast log insert failed:', error.message);
                } else {
                    console.log(`[Storage] Broadcast logged: ${type} -> ${targetsCount} target(s) [${status}]`);
                }
            } catch (err) {
                console.error('[Storage] Unexpected broadcast log error:', err.message);
            }
        }
    }

    /**
     * Clean up old keep-alive logs (older than 30 days) to prevent table bloat
     * Only removes 'keepalive' type entries, preserves broadcast logs
     */
    async cleanOldLogs() {
        if (this.supabase) {
            try {
                const cutoff = new Date();
                cutoff.setDate(cutoff.getDate() - 30);

                const { error } = await this.supabase
                    .from('broadcast_logs')
                    .delete()
                    .eq('type', 'keepalive')
                    .lt('created_at', cutoff.toISOString());

                if (error) {
                    console.warn('[Storage] Old logs cleanup failed:', error.message);
                } else {
                    console.log('[Storage] Old keep-alive logs cleaned up (30+ days)');
                }
            } catch (err) {
                console.error('[Storage] Unexpected cleanup error:', err.message);
            }
        }
    }
}

module.exports = new StorageService();
