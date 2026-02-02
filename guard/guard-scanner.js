const supabase = window.supabaseClient;
const utils = window.utils;

document.addEventListener('DOMContentLoaded', async () => {
    await utils.checkAccess(['guard', 'teacher', 'admin']);
    const state = { last: { id: null, ts: 0 }, arrival: '07:30' };
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
                // throttle decoding briefly to avoid repeated decodes while the QR stays in frame
                setTimeout(() => {}, 800);
            }
        }
        requestAnimationFrame(tick);
    }
    document.getElementById('processManualID').addEventListener('click', () => {
        const v = document.getElementById('manualID').value;
        if (v) onScanSuccess(v);
        document.getElementById('manualID').value = '';
    });
    document.getElementById('manualID').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            const v = document.getElementById('manualID').value;
            if (v) onScanSuccess(v);
            document.getElementById('manualID').value = '';
        }
    });
    document.getElementById('logoutBtn').addEventListener('click', utils.logout);
    async function onScanSuccess(text) {
        const now = Date.now();
        if (text === state.last.id && now - state.last.ts < 4000) return;
        state.last = { id: text, ts: now };
        try {
            const { data: student, error: sError } = await supabase
                .from('students')
                .select('*, parent_students(parent_id)')
                .eq('id', text)
                .single();
            if (sError || !student) throw new Error('Student not found');
            const current = student.current_status || 'out';
            // Map to 'IN'/'OUT' for the event engine
            const eventType = current === 'out' ? 'IN' : 'OUT';
            const tsISO = new Date().toISOString();

            // Insert into Raw Events Log
            const { error: aError } = await supabase.from('attendance_events').insert([{
                student_id: student.id,
                event_type: eventType,
                timestamp: tsISO,
                device_id: 'web-scanner',
                recorded_by: utils.getCurrentUser()?.id
            }]);

            if (aError) throw aError;

            // Estimate status for immediate feedback (Real status is calculated by DB Trigger)
            const displayType = eventType === 'IN' ? 'entry' : 'exit';
            const status = deriveStatus(displayType);
            const remarks = deriveRemarks(displayType, status);
            
            // Note: DB Trigger handles 'attendance' upsert, 'notifications', and 'students' status update.
            
            renderStatus(student.full_name, displayType, remarks);
            document.getElementById('successSound').play();
            setTimeout(renderHistory, 1000); // Wait for trigger
        } catch (err) {
            utils.showNotification(err.message, 'error');
            document.getElementById('errorSound').play();
        }
    }
    function deriveStatus(type) {
        const t = utils.formatTime(new Date());
        if (type === 'entry') return t > state.arrival ? 'late' : 'present';
        return 'present';
    }
    function deriveRemarks(type, status) {
        if (type === 'entry') return status === 'late' ? 'Entered Late' : 'On Time Entry';
        return 'Regular Exit';
    }
    function renderStatus(name, type, remarks) {
        const card = document.getElementById('statusCard');
        const icon = document.getElementById('statusIcon');
        const title = document.getElementById('statusTitle');
        const studentName = document.getElementById('statusStudent');
        const time = document.getElementById('statusTime');
        const details = document.getElementById('statusDetails');
        card.classList.remove('hidden');
        icon.className = `w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${type === 'entry' ? 'bg-green-100 text-green-600' : 'bg-blue-100 text-blue-600'}`;
        icon.innerHTML = `<i data-lucide="${type === 'entry' ? 'log-in' : 'log-out'}" class="w-6 h-6"></i>`;
        title.innerText = type === 'entry' ? 'Entry Recorded' : 'Exit Recorded';
        studentName.innerText = name;
        time.innerText = utils.formatTime(new Date());
        details.innerText = remarks;
        if (window.lucide) window.lucide.createIcons();
    }
    async function renderHistory() {
        const { data } = await supabase
            .from('attendance')
            .select('*, students(full_name)')
            .order('timestamp', { ascending: false })
            .limit(10);
        const history = document.getElementById('scanHistory');
        history.innerHTML = (data || []).map(s => `
            <div class="flex items-center space-x-3 p-3 bg-gray-50 rounded-xl border border-gray-100">
                <div class="w-8 h-8 rounded-full flex items-center justify-center ${s.entry_type === 'entry' ? 'bg-green-100 text-green-600' : 'bg-blue-100 text-blue-600'}">
                    <i data-lucide="${s.entry_type === 'entry' ? 'log-in' : 'log-out'}" class="w-4 h-4"></i>
                </div>
                <div class="flex-1">
                    <p class="text-sm font-bold text-gray-900">${s.students.full_name}</p>
                    <p class="text-xs text-gray-500">${utils.formatTime(s.timestamp)} - ${s.remarks || ''}</p>
                </div>
            </div>
        `).join('');
        if (window.lucide) window.lucide.createIcons();
    }
});

