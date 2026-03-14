const cron = require('node-cron');
const attendanceService = require('./attendance');
const wahaService = require('./waha');

class SchedulerService {
    constructor() {
        this.tasks = {};
    }

    // Initialize tasks based on settings
    init(settings) {
        console.log(`[Scheduler] Initializing. Server Time: ${new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}`);
        console.log(`[Scheduler] AutoBroadcast Enabled: ${settings.autoBroadcast}`);

        this.stopAll();
        if (settings.autoBroadcast) {
            this.scheduleTasks(settings.schedules, settings, 'general');
            this.scheduleTasks(settings.schedulesLeave, settings, 'leave');
            this.scheduleTasks(settings.schedulesLate, settings, 'late');
            this.scheduleTasks(settings.schedulesWeeklyRecap, settings, 'weekly_recap');
        }

        // Keep-alive Supabase (runs every day at 00:00)
        console.log(`[Scheduler] Scheduling Supabase Keep-Alive ping (0 0 * * *)`);
        this.tasks['supabase_ping'] = cron.schedule('0 0 * * *', async () => {
             console.log('[Scheduler] Running Supabase keep-alive ping');
             const storage = require('./storage'); // Require dynamically or rely on it being the single instance
             await storage.pingSupabase();
        });
    }

    scheduleTasks(timeArray, settings, type) {
        if (!timeArray || !Array.isArray(timeArray)) return;

        timeArray.forEach((time, index) => {
            // Time format: "HH:mm"
            const [hour, minute] = time.split(':');
            let cronExpr = `${minute} ${hour} * * *`;
            
            if (type === 'weekly_recap') {
                cronExpr = `${minute} ${hour} * * 6`; // 6 corresponds to Saturday
            }
            
            const taskId = `${type}_${index}`;

            console.log(`[Scheduler] Scheduling ${type} broadcast for ${time} (${cronExpr})`);

            this.tasks[taskId] = cron.schedule(cronExpr, async () => {
                console.log(`[Scheduler] Triggering ${type} broadcast for ${time}`);
                await this.runBroadcastRoutine(settings, type);
            });
        });
    }

    stopAll() {
        Object.values(this.tasks).forEach(task => task.stop());
        this.tasks = {};
    }

    async runBroadcastRoutine(settings, type = 'general') {
        try {
            // Check for Holiday (Skip standard broadcasts, but run weekly recap regardless)
            if (type !== 'weekly_recap' && this.isHoliday(settings)) {
                console.log(`[Scheduler] Today is a holiday. Skipping ${type} broadcast.`);
                return;
            }

            // 1. Fetch Data
            let data;
            if (type === 'weekly_recap') {
                data = await attendanceService.getMonthlyRecap();
            } else {
                data = await attendanceService.fetchData();
                global.ATTENDANCE_CACHE = {
                    timestamp: new Date().toLocaleString(),
                    results: data
                };
            }

            // 2. Generate Report based on type
            const report = this.generateReport(data, type);

            // 3. Send via WAHA - Support multiple targets
            // Backward compatibility: support both targetNumber (string) and targetNumbers (array)
            const targets = this.getTargets(settings);

            if (targets.length === 0) {
                console.log('[Scheduler] No target numbers set, skipping broadcast');
                return;
            }

            console.log(`[Scheduler] Sending ${type} broadcast to ${targets.length} target(s)...`);

            for (let i = 0; i < targets.length; i++) {
                const target = targets[i];
                try {
                    await wahaService.sendText(settings.wahaUrl, settings.sessionId, settings.apiKey, target, report);
                    console.log(`[Scheduler] ${type} broadcast sent to ${target} (${i + 1}/${targets.length})`);

                    // Add delay between sends to avoid rate limiting (1.5 seconds)
                    if (i < targets.length - 1) {
                        await this.delay(1500);
                    }
                } catch (err) {
                    console.error(`[Scheduler] Failed to send to ${target}:`, err.message);
                    // Continue to next target even if one fails
                }
            }

            console.log(`[Scheduler] ${type} broadcast completed to all targets`);
        } catch (error) {
            console.error('[Scheduler] Routine failed:', error.message);
        }
    }

    generateReport(data, type = 'general') {
        const today = new Date().toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'Asia/Jakarta' });

        // Use template from settings or default
        let template = global.SETTINGS.messageTemplate || '*Laporan Absensi Harian*\n📅 {{date}}\n\n{{data}}';
        let body = "";

        // --- TYPE: WEEKLY RECAP ---
        if (type === 'weekly_recap') {
            const dateObj = new Date();
            const monthName = dateObj.toLocaleDateString('id-ID', { month: 'long', year: 'numeric', timeZone: 'Asia/Jakarta' });
            
            body += `*Rekapitulasi Keterlambatan*\n`;
            const lateItems = data.filter(d => d.totalLateMinutes > 0).sort((a,b) => b.totalLateMinutes - a.totalLateMinutes);
            if (lateItems.length === 0) body += `_Tidak ada rekor keterlambatan bulan ini._\n`;
            else {
                lateItems.forEach((item, i) => {
                    body += `${i+1}. ${item.nama} - ⏳ ${item.totalLateMinutes} menit\n`;
                });
            }

            body += `\n*Rekapitulasi Alpha*\n`;
            const alphaItems = data.filter(d => d.totalAlphaDays > 0).sort((a,b) => b.totalAlphaDays - a.totalAlphaDays);
            if (alphaItems.length === 0) body += `_Tidak ada rekor alpha bulan ini._\n`;
            else {
                alphaItems.forEach((item, i) => {
                    body += `${i+1}. ${item.nama} - ❌ ${item.totalAlphaDays} hari\n`;
                });
            }

            // Provide a note indicating it is for current month
            body += `\n_Catatan: Rekapitulasi dihitung dari awal bulan hingga hari ini._`;

            template = template.replace('Laporan Absensi Harian', `Laporan Rekapitulasi Absensi (${monthName})`);
        }
        
        // --- TYPE: LEAVE (Izin & Cuti) ---
        else if (type === 'leave') {
            // Fix: Also match 'leave' (English format from Gaji.id API: "Unpaid leave", "Paid leave", etc.)
            const izinItems = data.filter(item => {
                const status = (item.status || '').toLowerCase();
                return status.includes('izin') || status.includes('leave');
            });
            const cutiItems = data.filter(item => item.status.includes('Cuti'));
            const sickItems = data.filter(item => item.status.includes('Sakit'));

            // NEW: Late Permission - Employees who are present but have approved late permission
            const latePermissionItems = data.filter(item => item.hasLatePermission === true);

            // Section: Izin
            body += `*Izin*\n`;
            if (izinItems.length === 0) body += `_Tidak ada karyawan yang izin._\n`;
            else {
                izinItems.forEach((item, i) => {
                    body += `${i + 1}. ${item.nama} (${item.keterangan || item.status})\n`;
                });
            }
            body += `\n`;

            // Section: Cuti
            body += `*Cuti*\n`;
            if (cutiItems.length === 0) body += `_Tidak ada karyawan yang cuti._\n`;
            else {
                cutiItems.forEach((item, i) => {
                    body += `${i + 1}. ${item.nama} (${item.keterangan || item.status})\n`;
                });
            }

            // Section: Sakit (Optional addition for completeness)
            if (sickItems.length > 0) {
                body += `\n*Sakit*\n`;
                sickItems.forEach((item, i) => {
                    body += `${i + 1}. ${item.nama}\n`;
                });
            }

            // NEW Section: Izin Terlambat (Present with approved late permission)
            body += `\n*Izin Terlambat Masuk*\n`;
            if (latePermissionItems.length === 0) body += `_Tidak ada karyawan dengan izin terlambat._\n`;
            else {
                latePermissionItems.forEach((item, i) => {
                    body += `${i + 1}. ${item.nama}\n   🕒 Masuk: ${item.jamMasuk} | ⏳ ${item.menitTerlambatDenganIzin} menit (diizinkan)\n`;
                });
            }

            template = template.replace('Laporan Absensi Harian', `Laporan Khusus Izin & Cuti`);
        }

        // --- TYPE: LATE (Alpha & Terlambat) ---
        else if (type === 'late') {
            const alphaKeywords = ['alpha', 'alpa', 'mangkir', 'bolos', 'tanpa keterangan'];
            const alphaItems = data.filter(item => alphaKeywords.some(k => item.status.toLowerCase().includes(k)));

            // Late: Must have > 0 late minutes AND not be Alpha
            const lateItems = data.filter(item => item.menitTerlambat > 0 && !alphaKeywords.some(k => item.status.toLowerCase().includes(k)));

            // Section: Alpha (Names Only)
            body += `*Alpha*\n`;
            if (alphaItems.length === 0) body += `_Tidak ada data._\n`;
            else {
                alphaItems.forEach((item, i) => {
                    body += `${i + 1}. ${item.nama}\n`;
                });
            }
            body += `\n`;

            // Section: Terlambat (Name, In Time, Late Duration)
            body += `*Terlambat*\n`;
            if (lateItems.length === 0) body += `_Tidak ada data._\n`;
            else {
                lateItems.forEach((item, i) => {
                    body += `${i + 1}. ${item.nama}\n   🕒 Masuk: ${item.jamMasuk} | ⏳ ${item.menitTerlambat} menit\n`;
                });
            }

            template = template.replace('Laporan Absensi Harian', `Laporan Absensi Terlambat & Alpha`);
        }

        // --- TYPE: GENERAL (Default) ---
        else {
            // Original logic for General Report
            if (data.length === 0) {
                body = `_Tidak ada data._`;
            } else {
                data.forEach((item, i) => {
                    let statusIcon = item.status === 'Hadir' ? '✅' : '⚠️';
                    if (item.status.includes('Cuti') || item.status.includes('Izin')) statusIcon = 'ℹ️';
                    if (item.status.includes('Sakit')) statusIcon = '🏥';

                    body += `${i + 1}. *${item.nama}* (${item.nik})\n   ${statusIcon} Status: ${item.status}\n   🕒 Masuk: ${item.jamMasuk} | Keluar: ${item.jamKeluar}\n`;

                    if (item.menitTerlambat > 0) {
                        body += `   ⏳ Terlambat: ${item.menitTerlambat} menit\n`;
                    }
                    if (item.keterangan && item.keterangan !== '-') {
                        body += `   📝 Ket: ${item.keterangan}\n`;
                    }
                    body += `\n`;
                });
            }
        }

        // Replace placeholders
        let message = template
            .replace('{{date}}', today)
            .replace('{{data}}', body);

        return message;
    }

    isHoliday(settings) {
        const now = new Date();
        const todayDate = now.toISOString().split('T')[0]; // "YYYY-MM-DD"
        // Adjust for timezone if needed, but 'new Date()' on server should be local
        // Better to use Indonesian time for clarity
        const idTime = new Date().toLocaleString('en-US', { timeZone: 'Asia/Jakarta' });
        const dateObj = new Date(idTime);
        const dayOfWeek = dateObj.getDay();
        const dateStr = dateObj.toISOString().split('T')[0];

        // 1. Check Specific Dates
        if (settings.holidays && Array.isArray(settings.holidays)) {
            if (settings.holidays.includes(dateStr)) {
                console.log(`[Scheduler] Holiday Match: ${dateStr} is set as holiday.`);
                return true;
            }
        }

        // 2. Check Weekly Holidays (Sat/Sun)
        if (settings.holidayDays && Array.isArray(settings.holidayDays)) {
            // Ensure inputs are integers
            const days = settings.holidayDays.map(d => parseInt(d));
            if (days.includes(dayOfWeek)) {
                console.log(`[Scheduler] Holiday Match: Day ${dayOfWeek} is a weekly holiday.`);
                return true;
            }
        }

        return false;
    }

    // Helper: Get targets array with backward compatibility
    getTargets(settings) {
        // Support new format: targetNumbers (array)
        if (settings.targetNumbers && Array.isArray(settings.targetNumbers) && settings.targetNumbers.length > 0) {
            return settings.targetNumbers.filter(t => t && t.trim());
        }
        // Backward compatibility: old format targetNumber (string)
        if (settings.targetNumber && typeof settings.targetNumber === 'string' && settings.targetNumber.trim()) {
            return [settings.targetNumber.trim()];
        }
        return [];
    }

    // Helper: Delay function for rate limiting
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

module.exports = new SchedulerService();
