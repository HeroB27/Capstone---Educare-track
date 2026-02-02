const supabase = window.supabaseClient;
const utils = window.utils;

document.addEventListener('DOMContentLoaded', async () => {
    // Check access
    await utils.checkAccess(['guard', 'admin']);

    // Initialize UI
    utils.renderGuardLayout('dashboard');
    initializeScanner();
    initializeManualInput();
    fetchRecentScans();
    fetchAnnouncements();
    fetchLateAnalytics();
    loadSettings();

    // 1. Scanner Initialization (Placeholder for hardware integration)
    function initializeScanner() {
        // Listen for keyboard input (most USB scanners act as keyboards)
        let buffer = '';
        let lastKeyTime = Date.now();

        document.addEventListener('keydown', (e) => {
            const now = Date.now();
            if (now - lastKeyTime > 100) buffer = '';
            lastKeyTime = now;

            if (e.key === 'Enter') {
                if (buffer.length > 5) { // Minimum ID length
                    processScan(buffer);
                }
                buffer = '';
            } else if (e.key.length === 1) {
                buffer += e.key;
            }
        });
    }

    // 2. Manual Input
    function initializeManualInput() {
        const btn = document.getElementById('processManualID');
        const input = document.getElementById('manualID');

        const handleManual = () => {
            if (input.value.trim()) {
                processScan(input.value.trim());
                input.value = '';
            }
        };

        btn.addEventListener('click', handleManual);
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') handleManual();
        });
    }

    // 3. Process Scan Logic
    async function processScan(scannedText, timestamp) {
        const currentTime = timestamp ? new Date(timestamp) : new Date();
        
        let resolvedID = scannedText;

        // 1. Resolve QR Hash if necessary (Secure QR logic)
        const { data: qrData } = await supabase
            .from('qr_codes')
            .select('student_id')
            .eq('qr_hash', scannedText)
            .eq('is_active', true)
            .maybeSingle();

        if (qrData) {
            resolvedID = qrData.student_id;
        }

        try {
            utils.showLoading(true);

            // Fetch Student
            const { data: student, error: sError } = await supabase
                .from('students')
                .select('*, parent_students(parent_id, profiles(full_name, phone))')
                .eq('id', resolvedID)
                .single();
            
            if (sError || !student) throw new Error('Student record not found');

            // Log Attendance Event (Raw)
            // The Database Trigger 'trg_process_attendance_event' will calculate status and update 'attendance' table
            const { error: aError } = await supabase.from('attendance_events').insert([{
                student_id: student.id,
                event_type: 'IN', // Default to IN for dashboard entry
                timestamp: currentTime.toISOString(),
                device_id: 'web-dashboard',
                recorded_by: (utils.getCurrentUser())?.id
            }]);

            if (aError) throw aError;

            // Notify Parent (SMS Mockup)
            const parent = student.parent_students?.[0]?.profiles;
            if (parent?.phone) {
                console.log(`SMS to ${parent.phone}: ${student.full_name} has arrived at school at ${currentTime.toLocaleTimeString()}.`);
            }

            utils.showNotification(`Scanned: ${student.full_name}`, 'success');
            setTimeout(fetchRecentScans, 1000); // Wait for trigger to process

        } catch (err) {
            console.error('Scan error:', err);
            utils.showNotification(err.message, 'error');
        } finally {
            utils.showLoading(false);
        }
    }

    // 4. Fetch Recent Scans
    async function fetchRecentScans() {
        const list = document.getElementById('recentScansList');
        if (!list) return;

        try {
            const today = new Date().toISOString().split('T')[0];
            const { data: scans } = await supabase
                .from('attendance')
                .select('*, students(full_name, grade_level)')
                .gte('timestamp', `${today}T00:00:00`)
                .order('timestamp', { ascending: false })
                .limit(10);

            if (!scans || scans.length === 0) {
                list.innerHTML = '<tr><td colspan="4" class="text-center py-8 text-gray-400 text-xs font-bold uppercase">No scans today</td></tr>';
                return;
            }

            list.innerHTML = scans.map(s => `
                <tr class="hover:bg-gray-50 transition-colors">
                    <td class="py-3 pr-4">
                        <p class="text-sm font-bold text-gray-900">${s.students.full_name}</p>
                        <p class="text-[10px] text-gray-400 font-bold uppercase">Grade ${s.students.grade_level}</p>
                    </td>
                    <td class="py-3">
                        <span class="px-2 py-1 rounded-md text-[10px] font-black uppercase tracking-widest ${
                            s.status === 'late' ? 'bg-amber-100 text-amber-700' : 
                            s.status === 'absent' ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'
                        }">${s.status}</span>
                    </td>
                    <td class="py-3 text-xs font-bold text-gray-500 font-mono">
                        ${new Date(s.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td class="py-3 text-xs font-bold text-gray-400 uppercase">
                        ${s.method}
                    </td>
                </tr>
            `).join('');

        } catch (err) {
            console.error('Error fetching scans:', err);
        }
    }

    async function loadSettings() {
        const { data } = await supabase.from('system_settings').select('*').eq('key', 'school_branding').single();
        if (data?.value?.logo_url) {
            // Update branding if needed
        }
    }

    async function fetchAnnouncements() {
        const list = document.getElementById('guardAnnouncements');
        if (!list) return;

        try {
            const { data: anns } = await supabase
                .from('announcements')
                .select('*')
                .contains('audience', ['guard'])
                .order('is_pinned', { ascending: false })
                .order('created_at', { ascending: false })
                .limit(4);

            if (anns && anns.length > 0) {
                list.innerHTML = anns.map(a => `
                    <div class="p-4 bg-gray-50 rounded-2xl border border-gray-100 hover:bg-white hover:border-yellow-100 transition-all group relative overflow-hidden">
                        ${a.is_pinned ? `
                            <div class="absolute top-0 right-0 p-2">
                                <i data-lucide="pin" class="text-yellow-600 w-3 h-3 fill-yellow-600"></i>
                            </div>
                        ` : ''}
                        <h4 class="text-xs font-black text-gray-900 mb-1 group-hover:text-yellow-600 transition-colors">${a.title}</h4>
                        <p class="text-[10px] text-gray-600 font-medium line-clamp-2">${a.content}</p>
                        <p class="text-[8px] text-gray-400 font-bold uppercase tracking-widest mt-2">${utils.formatDate(a.created_at)}</p>
                    </div>
                `).join('');
                if (window.lucide) window.lucide.createIcons();
            }
        } catch (err) {
            console.error('Error fetching announcements:', err);
        }
    }

    async function fetchLateAnalytics() {
        const list = document.getElementById('lateMonitorList');
        if (!list) return;

        try {
            const oneWeekAgo = new Date();
            oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

            const { data: lateLogs, error } = await supabase
                .from('attendance')
                .select('student_id, students(full_name, grade_level, strand)')
                .eq('status', 'late')
                .gte('timestamp', oneWeekAgo.toISOString());

            if (error) throw error;

            const frequencies = (lateLogs || []).reduce((acc, log) => {
                if (!acc[log.student_id]) {
                    acc[log.student_id] = { 
                        name: log.students?.full_name, 
                        grade: log.students?.grade_level,
                        strand: log.students?.strand,
                        count: 0 
                    };
                }
                acc[log.student_id].count++;
                return acc;
            }, {});

            const topLate = Object.values(frequencies)
                .sort((a, b) => b.count - a.count)
                .slice(0, 5);

            if (topLate.length === 0) {
                list.innerHTML = `
                    <div class="py-10 text-center text-gray-400">
                        <p class="text-[10px] font-black uppercase tracking-widest">No frequent late arrivals recorded</p>
                    </div>
                `;
                return;
            }

            list.innerHTML = topLate.map((s, idx) => `
                <div class="flex items-center justify-between p-4 bg-gray-50 rounded-2xl border border-gray-100 hover:border-rose-100 transition-all">
                    <div class="flex items-center space-x-4">
                        <div class="w-8 h-8 rounded-full ${idx === 0 ? 'bg-rose-600' : 'bg-gray-200'} flex items-center justify-center text-white font-black text-xs">
                            ${idx + 1}
                        </div>
                        <div>
                            <p class="text-sm font-black text-gray-900">${s.name}</p>
                            <p class="text-[10px] text-gray-400 font-bold uppercase">Grade ${s.grade} ${s.strand || ''}</p>
                        </div>
                    </div>
                    <div class="text-right">
                        <p class="text-lg font-black text-rose-600">${s.count}</p>
                        <p class="text-[8px] text-gray-400 font-black uppercase tracking-widest">Times Late</p>
                    </div>
                </div>
            `).join('');

        } catch (err) {
            console.error('Late analytics error:', err);
        }
    }

    document.getElementById('logoutBtn').addEventListener('click', utils.logout);
});
