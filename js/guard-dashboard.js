import supabase from './supabase-config.js';
import { utils } from './utils.js';

document.addEventListener('DOMContentLoaded', () => {
    // Check access
    utils.checkAccess(['guard', 'admin', 'teacher']); // Teachers can also be gatekeepers

    const state = {
        scanner: null,
        lastScannedID: null,
        lastScanTime: 0,
        settings: {
            kinder: { end: '12:00' },
            g1_3: { end: '13:00' },
            g4_6: { end: '15:00' },
            jhs: { end: '16:00' },
            shs: { end: '16:30' },
            arrival: '07:30'
        }
    };

    // Initialize UI
    utils.initOfflineMonitoring();
    initializeScanner();
    initializeManualInput();
    fetchRecentScans();
    loadSettings();

    // Listen for sync requirements when back online
    window.addEventListener('sync-required', () => {
        syncOfflineScans();
    });

    async function loadSettings() {
        try {
            const { data } = await supabase.from('system_settings').select('*');
            if (data) {
                const settings = data.reduce((acc, curr) => {
                    acc[curr.key] = curr.value;
                    return acc;
                }, {});

                if (settings.tap_times) {
                    const t = settings.tap_times;
                    state.settings = {
                        arrival: t.arrival || '07:30',
                        kinder: { end: t.kinder || '12:00' },
                        g1_3: { end: t.g13 || '13:00' },
                        g4_6: { end: t.g46 || '15:00' },
                        jhs: { end: t.jhs || '16:00' },
                        shs: { end: t.shs || '16:30' }
                    };
                }
            }
        } catch (err) {
            console.error('Error loading settings:', err);
        }
    }

    function initializeScanner() {
        const reader = document.getElementById('reader');
        const video = document.createElement('video');
        video.setAttribute('playsinline', true);
        const canvas = document.createElement('canvas');
        canvas.style.display = 'none';
        const ctx = canvas.getContext('2d');
        reader.appendChild(video);
        reader.appendChild(canvas);
        navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } }).then(stream => {
            video.srcObject = stream;
            video.play();
            requestAnimationFrame(tick);
        });
        function tick() {
            if (video.readyState === video.HAVE_ENOUGH_DATA) {
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                const code = jsQR(imageData.data, canvas.width, canvas.height);
                if (code && code.data) {
                    onScanSuccess(code.data);
                    setTimeout(() => {}, 800);
                }
            }
            requestAnimationFrame(tick);
        }
    }

    function initializeManualInput() {
        const input = document.getElementById('manualID');
        const btn = document.getElementById('processManualID');

        btn.addEventListener('click', () => {
            if (input.value) {
                onScanSuccess(input.value);
                input.value = '';
            }
        });

        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && input.value) {
                onScanSuccess(input.value);
                input.value = '';
            }
        });
    }

    async function onScanSuccess(decodedText) {
        if (!navigator.onLine) {
            queueOfflineScan(decodedText);
            return;
        }

        // Prevent duplicate scans within 5 seconds
        const now = Date.now();
        if (decodedText === state.lastScannedID && now - state.lastScanTime < 5000) {
            utils.showNotification('Duplicate scan ignored', 'warning');
            return;
        }
        
        state.lastScannedID = decodedText;
        state.lastScanTime = now;

        try {
            await processScan(decodedText);
        } catch (err) {
            console.error(err);
            utils.showNotification(err.message, 'error');
            const errorSound = document.getElementById('errorSound');
            if (errorSound) errorSound.play();
        }
    }

    function queueOfflineScan(studentId) {
        const offlineQueue = JSON.parse(localStorage.getItem('offline_scans') || '[]');
        const scan = {
            studentId,
            timestamp: new Date().toISOString(),
            id: Math.random().toString(36).substring(2, 9)
        };
        offlineQueue.push(scan);
        localStorage.setItem('offline_scans', JSON.stringify(offlineQueue));
        
        utils.showNotification('Offline: Scan queued for sync', 'info');
    }

    async function syncOfflineScans() {
        const offlineQueue = JSON.parse(localStorage.getItem('offline_scans') || '[]');
        if (offlineQueue.length === 0) return;

        utils.showNotification(`Syncing ${offlineQueue.length} offline scans...`, 'info');
        
        for (const scan of offlineQueue) {
            try {
                await processScan(scan.studentId, scan.timestamp);
            } catch (err) {
                console.error('Sync failed for scan:', scan.id, err);
            }
        }

        localStorage.removeItem('offline_scans');
        utils.showNotification('Offline sync complete!', 'success');
        fetchRecentScans();
    }

    async function processScan(studentId, timestamp) {
        const currentTime = timestamp ? new Date(timestamp) : new Date();

        // Check for School Holiday/Suspension
        const isSchoolDay = await utils.isSchoolDay();
        if (!isSchoolDay) {
            throw new Error('Attendance is blocked today (Holiday/Suspension)');
        }

        // 1. Fetch Student Info
        const { data: student, error: sError } = await supabase
            .from('students')
            .select('*, parent_students(parent_id, profiles(full_name, phone))')
            .eq('id', studentId)
            .single();

        if (sError || !student) throw new Error('Student not found');

        // 2. Fetch Today's Attendance for this student
        const today = currentTime.toISOString().split('T')[0];
        const { data: todayLogs } = await supabase
            .from('attendance')
            .select('*')
            .eq('student_id', student.id)
            .gte('timestamp', `${today}T00:00:00`)
            .lte('timestamp', `${today}T23:59:59`)
            .order('timestamp', { ascending: true });

        const currentStatus = student.current_status;
        const entryType = currentStatus === 'out' ? 'entry' : 'exit';
        const timeStr = currentTime.toTimeString().slice(0, 5);
        const isAfternoon = timeStr >= '12:00';
        
        let remarks = '';
        let attendanceStatus = 'present';

        // 3. Apply Tap Logic
        if (entryType === 'entry') {
            if (todayLogs && todayLogs.some(l => l.entry_type === 'entry' && l.status !== 'morning_absent')) {
                throw new Error('Student already recorded as entered today');
            }

            if (isAfternoon) {
                attendanceStatus = 'morning_absent';
                remarks = 'First scan is afternoon (Morning Absent)';
            } else if (timeStr > state.settings.arrival) {
                attendanceStatus = 'late';
                remarks = 'Entered Late';
            } else {
                remarks = 'On Time Entry';
            }
        } else {
            // Exit logic
            const dismissalTime = getDismissalTime(student.grade_level);
            if (timeStr < dismissalTime) {
                attendanceStatus = 'early_exit';
                remarks = 'Early Dismissal';
            } else if (isTooLate(timeStr, dismissalTime)) {
                remarks = 'Late Exit';
            } else {
                remarks = 'Regular Exit';
            }
        }

        // 4. Update Database (Append-only history)
        const { data: attendance, error: aError } = await supabase.from('attendance').insert([{
            student_id: student.id,
            status: attendanceStatus,
            entry_type: entryType,
            session: isAfternoon ? 'PM' : 'AM',
            method: 'qr',
            timestamp: currentTime.toISOString(),
            remarks: remarks,
            recorded_by: (utils.getCurrentUser()).id
        }]).select().single();

        if (aError) throw aError;

        // 5. Update Student Current Status
        await supabase.from('students').update({ 
            current_status: entryType === 'entry' ? 'present' : 'out' 
        }).eq('id', student.id);

        // 6. Notify Parent (Internal System)
        const parent = student.parent_students[0];
        if (parent) {
            await supabase.from('notifications').insert([{
                recipient_id: parent.parent_id,
                actor_id: (utils.getCurrentUser()).id,
                verb: entryType === 'entry' ? 'attendance_entry' : 'attendance_exit',
                object: {
                    student_id: student.id, 
                    full_name: student.full_name, 
                    remarks, 
                    time: currentTime.toISOString(),
                    status: attendanceStatus
                }
            }]);
        }

        // 7. Log Audit
        await supabase.from('audit_logs').insert([{
            actor_id: (utils.getCurrentUser()).id,
            action: entryType === 'entry' ? 'GATE_ENTRY' : 'GATE_EXIT',
            target_table: 'attendance',
            target_id: attendance.id,
            details: { student_name: student.full_name, status: attendanceStatus, remarks }
        }]);

        // 8. Show Success UI
        showStatus(student, entryType, remarks, true);
        const successSound = document.getElementById('successSound');
        if (successSound) successSound.play();
        fetchRecentScans();
    }

    function onScanError(err) {}

    function getDismissalTime(grade) {
        if (grade === 'Kinder') return state.settings.kinder.end;
        const g = parseInt(grade);
        if (g <= 3) return state.settings.g1_3.end;
        if (g <= 6) return state.settings.g4_6.end;
        if (g <= 10) return state.settings.jhs.end;
        return state.settings.shs.end;
    }

    function isTooLate(currentTime, dismissalTime) {
        const [ch, cm] = currentTime.split(':').map(Number);
        const [dh, dm] = dismissalTime.split(':').map(Number);
        const diff = (ch * 60 + cm) - (dh * 60 + dm);
        return diff > 30; // 30 minutes threshold
    }

    function showStatus(student, type, remarks, success) {
        const card = document.getElementById('statusCard');
        const icon = document.getElementById('statusIcon');
        const title = document.getElementById('statusTitle');
        const studentName = document.getElementById('statusStudent');
        const time = document.getElementById('statusTime');
        const details = document.getElementById('statusDetails');

        card.classList.remove('hidden');
        setTimeout(() => {
            card.classList.remove('scale-95', 'opacity-0');
            card.classList.add('scale-100', 'opacity-100');
        }, 10);

        if (success) {
            icon.className = 'w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 bg-green-100 text-green-600';
            icon.innerHTML = `<i data-lucide="${type === 'entry' ? 'login' : 'logout'}" class="w-10 h-10"></i>`;
            title.innerText = type === 'entry' ? 'Entry Recorded' : 'Exit Recorded';
            title.className = 'text-2xl font-bold mb-2 text-green-600';
        }

        studentName.innerText = student.full_name;
        time.innerText = utils.formatTime(new Date());
        details.innerText = remarks;

        lucide.createIcons();

        // Auto-hide after 5 seconds
        setTimeout(() => {
            card.classList.add('scale-95', 'opacity-0');
            setTimeout(() => card.classList.add('hidden'), 300);
        }, 5000);
    }

    async function fetchRecentScans() {
        const { data: scans, error } = await supabase
            .from('attendance')
            .select('*, students(full_name)')
            .order('timestamp', { ascending: false })
            .limit(10);

        if (error) return;

        const history = document.getElementById('scanHistory');
        if (scans.length === 0) {
            history.innerHTML = '<p class="text-gray-400 text-sm text-center py-10">No scans recorded yet</p>';
            return;
        }

        history.innerHTML = scans.map(s => `
            <div class="flex items-center space-x-3 p-3 bg-gray-50 rounded-xl border border-gray-100 transition-all hover:bg-white hover:shadow-sm">
                <div class="w-10 h-10 rounded-full flex items-center justify-center ${
                    s.entry_type === 'entry' ? 'bg-green-100 text-green-600' : 'bg-blue-100 text-blue-600'
                }">
                    <i data-lucide="${s.entry_type === 'entry' ? 'log-in' : 'log-out'}" class="w-5 h-5"></i>
                </div>
                <div class="flex-1">
                    <p class="text-sm font-bold text-gray-900">${s.students.full_name}</p>
                    <p class="text-xs text-gray-500">${utils.formatTime(s.timestamp)} - ${s.remarks}</p>
                </div>
            </div>
        `).join('');
        lucide.createIcons();
    }

    document.getElementById('logoutBtn').addEventListener('click', utils.logout);
    document.getElementById('logoutBtnMobile').addEventListener('click', utils.logout);
});
