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
        }
    }

    scheduleTasks(timeArray, settings, type) {
        if (!timeArray || !Array.isArray(timeArray)) return;

        timeArray.forEach((time, index) => {
            // Time format: "HH:mm"
            const [hour, minute] = time.split(':');
            const cronExpr = `${minute} ${hour} * * *`;
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
            // Check for Holiday
            if (this.isHoliday(settings)) {
                console.log(`[Scheduler] Today is a holiday. Skipping ${type} broadcast.`);
                return;
            }

            // 1. Fetch Data
            const data = await attendanceService.fetchData();
            global.ATTENDANCE_CACHE = {
                timestamp: new Date().toLocaleString(),
                results: data
            };

            // 2. Generate Report based on type
            const report = this.generateReport(data, type);

            // 3. Send via WAHA
            if (settings.targetNumber) {
                // Don't skip empty reports (User Request: Always send to verify scheduler works)
                /* 
                if (type !== 'general' && report.includes("_Tidak ada data")) {
                     console.log(`[Scheduler] No data for ${type} report, skipping.`);
                     return;
                }
                */

                await wahaService.sendText(settings.wahaUrl, settings.sessionId, settings.apiKey, settings.targetNumber, report);
                console.log(`[Scheduler] ${type} broadcast sent successfully`);
            } else {
                console.log('[Scheduler] No target number set, skipping broadcast');
            }
        } catch (error) {
            console.error('[Scheduler] Routine failed:', error.message);
        }
    }

    generateReport(data, type = 'general') {
        const today = new Date().toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'Asia/Jakarta' });

        // Use template from settings or default
        let template = global.SETTINGS.messageTemplate || '*Laporan Absensi Harian*\n📅 {{date}}\n\n{{data}}';
        let body = "";

        // --- TYPE: LEAVE (Izin & Cuti) ---
        if (type === 'leave') {
            const izinItems = data.filter(item => item.status.includes('Izin'));
            const cutiItems = data.filter(item => item.status.includes('Cuti'));
            const sickItems = data.filter(item => item.status.includes('Sakit')); // Optional: Include Sakit if needed, or group with Izin

            // Section: Izin
            body += `*Izin*\n`;
            if (izinItems.length === 0) body += `_Tidak ada data._\n`;
            else {
                izinItems.forEach((item, i) => {
                    body += `${i + 1}. ${item.nama} (${item.keterangan || item.status})\n`;
                });
            }
            body += `\n`;

            // Section: Cuti
            body += `*Cuti*\n`;
            if (cutiItems.length === 0) body += `_Tidak ada data._\n`;
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

            template = template.replace('Laporan Absensi Harian', `Laporan Khusus Terlambat & Alpha`);
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
}

module.exports = new SchedulerService();
