const supabase = window.supabaseClient;
const utils = window.utils;

document.addEventListener('DOMContentLoaded', async () => {
    await utils.checkAccess(['teacher', 'admin']);
    utils.renderTeacherLayout('gatekeeper');

    const state = {
        user: utils.getCurrentUser(),
        isGatekeeper: false,
        scanner: null,
        isScanning: false
    };

    checkGatekeeperAccess();

    async function checkGatekeeperAccess() {
        try {
            const { data: teacher } = await supabase
                .from('teachers')
                .select('is_gatekeeper')
                .eq('id', state.user.id)
                .single();

            if (teacher?.is_gatekeeper || state.user.role === 'admin') {
                state.isGatekeeper = true;
                document.getElementById('gatekeeperArea').classList.remove('hidden');
                fetchRecentLogs();
            } else {
                document.getElementById('accessDenied').classList.remove('hidden');
            }
        } catch (err) {
            console.error('Access check error:', err);
        }
    }

    const toggleBtn = document.getElementById('toggleScanner');
    toggleBtn?.addEventListener('click', () => {
        if (state.isScanning) stopScanner();
        else startScanner();
    });

    function startScanner() {
        state.scanner = new Html5Qrcode("reader");
        state.scanner.start(
            { facingMode: "environment" },
            { fps: 10, qrbox: { width: 250, height: 250 } },
            onScanSuccess
        );
        state.isScanning = true;
        toggleBtn.innerHTML = '<i data-lucide="stop-circle" class="w-5 h-5"></i><span>Stop Scanner</span>';
        if (window.lucide) window.lucide.createIcons();
    }

    function stopScanner() {
        if (state.scanner) {
            state.scanner.stop();
            state.scanner = null;
        }
        state.isScanning = false;
        toggleBtn.innerHTML = '<i data-lucide="camera" class="w-5 h-5"></i><span>Start Scanner</span>';
        if (window.lucide) window.lucide.createIcons();
    }

    async function onScanSuccess(decodedText) {
        // decodedText should be the Student ID (e.g. EDU-2026-XXXX-XXXX)
        stopScanner();
        utils.showNotification('ID Scanned: ' + decodedText, 'info');
        processID(decodedText);
    }

    async function processID(studentId) {
        try {
            // Test 9.1: Suspension Day Enforcement
            const isSchoolDay = await utils.isSchoolDay();
            if (!isSchoolDay) {
                throw new Error('Attendance is blocked today (School Holiday/Suspension)');
            }

            // 1. Fetch Student
            const { data: student, error: sErr } = await supabase
                .from('students')
                .select('*')
                .eq('id', studentId)
                .single();

            if (sErr) throw new Error('Student not found or invalid ID');

            // 2. Determine entry/exit
            const newStatus = student.current_status === 'in' ? 'out' : 'in';
            const type = newStatus === 'in' ? 'entry' : 'exit';

            // 3. Update Student Status
            await supabase.from('students').update({ current_status: newStatus }).eq('id', studentId);

            // 4. Log to Attendance
            await supabase.from('attendance').insert([{
                student_id: studentId,
                class_id: student.class_id,
                status: newStatus === 'in' ? 'present' : 'out',
                entry_type: type,
                session: new Date().getHours() < 12 ? 'AM' : 'PM',
                method: 'qr',
                recorded_by: state.user.id
            }]);

            // 5. Update UI
            showScanResult(student, type, newStatus);
            fetchRecentLogs();
            utils.showNotification(`${student.full_name} marked as ${newStatus.toUpperCase()}`, 'success');

        } catch (err) {
            utils.showNotification(err.message, 'error');
            setTimeout(startScanner, 2000);
        }
    }

    function showScanResult(student, type, status) {
        const result = document.getElementById('scanResult');
        result.classList.remove('hidden');
        
        document.getElementById('resultName').innerText = student.full_name;
        document.getElementById('resultLRN').innerText = `LRN: ${student.lrn}`;
        document.getElementById('resultTime').innerText = new Date().toLocaleTimeString();
        
        const statusBox = document.getElementById('resultStatus');
        const statusText = document.getElementById('resultStatusText');
        
        statusText.innerText = type === 'entry' ? 'SCHOOL ENTRY' : 'SCHOOL EXIT';
        statusBox.className = `p-4 rounded-2xl mb-6 ${type === 'entry' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`;

        const photoContainer = document.getElementById('resultPhoto');
        if (student.photo_url) {
            const { data } = supabase.storage.from('photos').getPublicUrl(student.photo_url);
            photoContainer.innerHTML = `<img src="${data.publicUrl}" class="w-full h-full object-cover">`;
        } else {
            photoContainer.innerHTML = '<i data-lucide="user" class="text-gray-300 w-12 h-12"></i>';
        }
        
        if (window.lucide) window.lucide.createIcons();
        
        // Auto-restart scanner after 3 seconds
        setTimeout(startScanner, 3000);
    }

    async function fetchRecentLogs() {
        try {
            const { data } = await supabase
                .from('attendance')
                .select('*, students(full_name)')
                .eq('recorded_by', state.user.id)
                .order('timestamp', { ascending: false })
                .limit(5);

            const list = document.getElementById('recentLogs');
            if (data?.length > 0) {
                list.innerHTML = data.map(l => `
                    <div class="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100">
                        <div>
                            <p class="text-xs font-bold text-gray-900">${l.students?.full_name}</p>
                            <p class="text-[10px] text-gray-400">${utils.formatTime(l.timestamp)}</p>
                        </div>
                        <span class="text-[8px] font-bold uppercase tracking-widest ${l.entry_type === 'entry' ? 'text-emerald-600' : 'text-amber-600'}">${l.entry_type}</span>
                    </div>
                `).join('');
            }
        } catch (err) {
            console.error('Fetch logs error:', err);
        }
    }
});
