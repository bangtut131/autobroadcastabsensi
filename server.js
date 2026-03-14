const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3010;

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
    targetNumbers: [], // Multiple targets support
    sessionId: 'default', // Default session
    apiKey: '', // Optional API Key
    messageTemplate: '*Laporan Absensi Harian*\n📅 {{date}}\n\n{{data}}', // Default Template
    autoBroadcast: false,
    schedules: [],       // General Report (All)
    schedulesLeave: [],  // Leave/Permission Only
    schedulesLate: []    // Late/Alpha Only
};

const session = require('express-session');
const attendanceService = require('./services/attendance');
const wahaService = require('./services/waha');
const schedulerService = require('./services/scheduler');
const storageService = require('./services/storage');
const employeeService = require('./services/employee');

// Initialize App
(async () => {
    // Load Settings (Supabase or Local)
    global.SETTINGS = await storageService.loadSettings();
    schedulerService.init(global.SETTINGS);

    // Global Cache for Employee Data
    global.EMPLOYEE_CACHE = null;

    // Session Middleware
    app.use(session({
        secret: 'gas-secret-key-12345',
        resave: false,
        saveUninitialized: true,
        cookie: { maxAge: 24 * 60 * 60 * 1000 } // 1 day
    }));

    // Authentication Middleware
    const requireAuth = (req, res, next) => {
        if (req.session.authenticated) {
            next();
        } else {
            res.redirect('/login');
        }
    };

    // Public Routes
    app.get('/login', (req, res) => {
        // If already logged in, redirect to dashboard
        if (req.session.authenticated) return res.redirect('/');
        res.render('login', { error: null });
    });

    app.post('/login', (req, res) => {
        const { username, password } = req.body;
        // Hardcoded credentials as requested
        const validUser = process.env.APP_USER || 'gasproject';
        const validPass = process.env.APP_PASS || 'GAS1180';

        if (username === validUser && password === validPass) {
            req.session.authenticated = true;
            req.session.user = username;
            res.redirect('/');
        } else {
            res.render('login', { error: 'Username atau Password salah!' });
        }
    });

    app.get('/logout', (req, res) => {
        req.session.destroy();
        res.redirect('/login');
    });

    // Protected Routes - Frontend
    app.get('/', requireAuth, (req, res) => {
        res.render('dashboard', {
            page: 'dashboard',
            data: global.ATTENDANCE_CACHE
        });
    });

    app.get('/details', requireAuth, (req, res) => {
        res.render('details', {
            page: 'details',
            data: global.ATTENDANCE_CACHE
        });
    });

    app.get('/input-broadcast', requireAuth, (req, res) => {
        res.render('broadcast', {
            page: 'broadcast',
            settings: global.SETTINGS
        });
    });

    app.get('/karyawan', requireAuth, (req, res) => {
        res.render('karyawan', {
            page: 'karyawan',
            data: global.EMPLOYEE_CACHE
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

    app.post('/api/karyawan/sync', async (req, res) => {
        try {
            // Temporary: Use attendance data as requested by user until credentials for employee API are available
            const data = await attendanceService.fetchData();

            // Map/Transform if necessary, but attendanceService already has the fields we added
            global.EMPLOYEE_CACHE = {
                timestamp: new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' }),
                results: data
            };
            res.json({ success: true, message: 'Data synced from Attendance Records', data: global.EMPLOYEE_CACHE });
        } catch (error) {
            // Return 200 with success: false so frontend can display the message nicely
            res.json({ success: false, message: error.message });
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

    app.post('/api/test-report', async (req, res) => {
        try {
            const { reportType, target, wahaUrl, sessionId, apiKey } = req.body;

            const targetNum = (target || global.SETTINGS.targetNumber || '').trim();
            const targetUrl = wahaUrl || global.SETTINGS.wahaUrl;
            const targetSession = sessionId || global.SETTINGS.sessionId;
            const targetApiKey = apiKey || global.SETTINGS.apiKey;

            if (!targetNum) {
                return res.status(400).json({ success: false, message: 'Target number is required' });
            }

            // Fetch data based on report type
            let data;
            if (reportType === 'weekly_recap') {
                data = await attendanceService.getMonthlyRecap();
            } else {
                data = await attendanceService.fetchData();
            }

            // Generate Report
            const report = schedulerService.generateReport(data, reportType || 'general');

            // Send via WAHA
            await wahaService.sendText(targetUrl, targetSession, targetApiKey, targetNum, report);
            res.json({ success: true, message: `Test ${reportType} report sent successfully` });
        } catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    });

    app.post('/api/settings', async (req, res) => {
        // Use default empty object if keys missing to avoid undefined
        const { wahaUrl, sessionId, apiKey, targetNumbers, autoBroadcast, schedules, schedulesLeave, schedulesLate, schedulesWeeklyRecap, messageTemplate } = req.body;

        // Update Global Settings (Merge logic: Only update if provided value is not undefined/null)
        // Note: For booleans/strings, we check undefined specifically
        if (wahaUrl !== undefined) global.SETTINGS.wahaUrl = wahaUrl;
        if (sessionId !== undefined) global.SETTINGS.sessionId = sessionId;
        if (apiKey !== undefined) global.SETTINGS.apiKey = apiKey;
        if (messageTemplate !== undefined) global.SETTINGS.messageTemplate = messageTemplate;

        // Handle targetNumbers - support both array and comma-separated string
        if (targetNumbers !== undefined) {
            if (Array.isArray(targetNumbers)) {
                global.SETTINGS.targetNumbers = targetNumbers.filter(t => t && t.trim());
            } else if (typeof targetNumbers === 'string') {
                global.SETTINGS.targetNumbers = targetNumbers.split(',').map(t => t.trim()).filter(t => t);
            }
        }

        // AutoBroadcast is a checkbox, typically 'on' or undefined in form submit, 
        // but since we JSON.stringify data from frontend, it might be explicitly true/false or 'off'
        if (autoBroadcast !== undefined) {
            global.SETTINGS.autoBroadcast = (autoBroadcast === 'on' || autoBroadcast === true);
        }

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
        global.SETTINGS.schedulesWeeklyRecap = parseSchedules(schedulesWeeklyRecap);

        // Handle Holidays
        // holidays: "2024-02-14, 2024-12-25" -> Array
        global.SETTINGS.holidays = parseSchedules(req.body.holidays);
        // holidayDays: ["0", "6"] (Sundays, Saturdays) -> Array
        global.SETTINGS.holidayDays = req.body.holidayDays || [];

        // Save (Supabase + Local)
        await storageService.saveSettings(global.SETTINGS);

        schedulerService.init(global.SETTINGS);
        res.json({ success: true, message: 'Settings saved', settings: global.SETTINGS });
    });

    app.listen(PORT, () => {
        console.log(`Server running at http://localhost:${PORT}`);
    });
})();
