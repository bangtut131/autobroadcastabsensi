const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3001;

const fs = require('fs');
const SETTINGS_FILE = path.join(__dirname, 'settings.json');

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// View Engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Globals
global.ATTENDANCE_CACHE = null; // Cache for attendance data
global.SETTINGS = {
    wahaUrl: 'http://localhost:3000',
    targetNumber: '', // Default target
    sessionId: 'default', // Default session
    apiKey: '', // Optional API Key
    messageTemplate: '*Laporan Absensi Harian*\n📅 {{date}}\n\n{{data}}', // Default Template
    autoBroadcast: false,
    schedules: [],       // General Report (All)
    schedulesLeave: [],  // Leave/Permission Only
    schedulesLate: []    // Late/Alpha Only
};

const attendanceService = require('./services/attendance');
const wahaService = require('./services/waha');
const schedulerService = require('./services/scheduler');
const storageService = require('./services/storage');

// Initialize App
(async () => {
    // Load Settings (Supabase or Local)
    global.SETTINGS = await storageService.loadSettings();
    schedulerService.init(global.SETTINGS);

    // Routes - Frontend
    app.get('/', (req, res) => {
        res.render('dashboard', {
            page: 'dashboard',
            data: global.ATTENDANCE_CACHE
        });
    });

    app.get('/details', (req, res) => {
        res.render('details', {
            page: 'details',
            data: global.ATTENDANCE_CACHE
        });
    });

    app.get('/input-broadcast', (req, res) => {
        res.render('broadcast', {
            page: 'broadcast',
            settings: global.SETTINGS
        });
    });

    // Routes - API
    app.post('/api/run-check', async (req, res) => {
        try {
            const data = await attendanceService.fetchData();
            global.ATTENDANCE_CACHE = {
                timestamp: new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' }),
                results: data
            };
            res.json({ success: true, message: 'Data refreshed successfully', data: global.ATTENDANCE_CACHE });
        } catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    });

    app.post('/api/broadcast', async (req, res) => {
        try {
            // Allow overriding settings via request body (useful for manual test from UI)
            const { message, target, wahaUrl, sessionId, apiKey } = req.body;

            const targetNum = (target || global.SETTINGS.targetNumber).trim();
            const targetUrl = wahaUrl || global.SETTINGS.wahaUrl;
            const targetSession = sessionId || global.SETTINGS.sessionId;
            const targetApiKey = apiKey || global.SETTINGS.apiKey;

            if (!targetNum) {
                return res.status(400).json({ success: false, message: 'Target number is required' });
            }

            await wahaService.sendText(targetUrl, targetSession, targetApiKey, targetNum, message);
            res.json({ success: true, message: 'Broadcast sent successfully' });
        } catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    });

    app.post('/api/settings', async (req, res) => {
        const { wahaUrl, sessionId, apiKey, targetNumber, autoBroadcast, schedules, schedulesLeave, schedulesLate, messageTemplate } = req.body;

        // Update Global Settings (In-Memory)
        global.SETTINGS.wahaUrl = wahaUrl;
        global.SETTINGS.sessionId = sessionId || 'default';
        global.SETTINGS.apiKey = apiKey || '';
        global.SETTINGS.targetNumber = targetNumber;
        global.SETTINGS.messageTemplate = messageTemplate || '*Laporan Absensi Harian*\n📅 {{date}}\n\n{{data}}';
        global.SETTINGS.autoBroadcast = autoBroadcast === 'on' || autoBroadcast === true;

        // Helper to parse comma separated string
        const parseSchedules = (input) => {
            if (typeof input === 'string') {
                return input.split(',').map(s => s.trim()).filter(s => s);
            } else if (Array.isArray(input)) {
                return input;
            }
            return [];
        };

        global.SETTINGS.schedules = parseSchedules(schedules);
        global.SETTINGS.schedulesLeave = parseSchedules(schedulesLeave);
        global.SETTINGS.schedulesLate = parseSchedules(schedulesLate);

        // Save (Supabase + Local)
        await storageService.saveSettings(global.SETTINGS);

        schedulerService.init(global.SETTINGS);
        res.json({ success: true, message: 'Settings saved', settings: global.SETTINGS });
    });

    app.listen(PORT, () => {
        console.log(`Server running at http://localhost:${PORT}`);
    });
})();
