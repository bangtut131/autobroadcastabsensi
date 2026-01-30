const cron = require('node-cron');
const attendanceService = require('./attendance');
const wahaService = require('./waha');

class SchedulerService {
    constructor() {
        this.tasks = {};
    }

    // Initialize tasks based on settings
    init(settings) {
        console.log(`[Scheduler] Initializing. Server Time: ${new Date().toString()}`);
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
                // Don't send empty reports for specific filters if no data matches
                if (type !== 'general' && report.includes("_Tidak ada data")) {
                    console.log(`[Scheduler] No data for ${type} report, skipping.`);
                    return;
                }

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
        const today = new Date().toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

        let filteredData = data;
        let titleSuffix = "";

        // Filter Logic
        if (type === 'leave') {
            filteredData = data.filter(item =>
                item.status.includes('Cuti') ||
                item.status.includes('Izin') ||
                item.status.includes('Sakit')
            );
            titleSuffix = " (Cuti & Izin)";
        } else if (type === 'late') {
            // Debug: Log all unique statuses found
            const statuses = [...new Set(data.map(item => item.status))];
            console.log(`[Scheduler] Debug Statuses: ${statuses.join(', ')}`);

            filteredData = data.filter(item =>
                item.menitTerlambat > 0 ||
                item.status.toLowerCase().includes('alpha') ||
                item.status.toLowerCase().includes('alpa') ||
                item.status.toLowerCase().includes('mangkir') ||
                item.status.toLowerCase().includes('bolos')
            );
            titleSuffix = " (Terlambat & Alpha)";
        }

        // Generate list string first
        let listStr = "";
        if (filteredData.length === 0) {
            listStr = `_Tidak ada data${titleSuffix.toLowerCase()}._`;
        } else {
            filteredData.forEach((item, i) => {
                let statusIcon = item.status === 'Hadir' ? '✅' : '⚠️';
                if (item.status.includes('Cuti') || item.status.includes('Izin')) statusIcon = 'ℹ️';
                if (item.status.includes('Sakit')) statusIcon = '🏥';

                listStr += `${i + 1}. *${item.nama}* (${item.nik})\n   ${statusIcon} Status: ${item.status}\n   🕒 Masuk: ${item.jamMasuk} | Keluar: ${item.jamKeluar}\n`;

                if (item.menitTerlambat > 0) {
                    listStr += `   ⏳ Terlambat: ${item.menitTerlambat} menit\n`;
                }
                if (item.keterangan && item.keterangan !== '-') {
                    listStr += `   📝 Ket: ${item.keterangan}\n`;
                }
                listStr += `\n`;
            });
        }

        // Use template from settings or default
        let template = global.SETTINGS.messageTemplate || '*Laporan Absensi Harian*\n📅 {{date}}\n\n{{data}}';

        // Adjust title in template if needed (simple hack: insert suffix in first line)
        if (titleSuffix) {
            template = template.replace('Laporan Absensi Harian', `Laporan Absensi Harian${titleSuffix}`);
        }

        // Replace placeholders
        let message = template
            .replace('{{date}}', today)
            .replace('{{data}}', listStr);

        return message;
    }
}

module.exports = new SchedulerService();
