const supabase = window.supabaseClient;
const utils = window.utils;

document.addEventListener('DOMContentLoaded', async () => {
    await utils.checkAccess(['teacher', 'admin']);
    utils.renderTeacherLayout('attendance');

    const state = {
        user: utils.getCurrentUser(),
        scheduleId: new URLSearchParams(window.location.search).get('scheduleId'),
        session: null,
        students: [],
        attendance: {}, // studentId -> { status, minutes, reason }
        isLocked: false
    };

    if (!state.scheduleId) {
        document.getElementById('sessionSelector').classList.remove('hidden');
        return;
    }

    await fetchSessionData();

    // Event Listeners
    document.getElementById('markAllPresent')?.addEventListener('click', () => {
        if (state.isLocked) return;
        state.students.forEach(s => {
            if (!state.attendance[s.id] || state.attendance[s.id].status === 'unmarked') {
                state.attendance[s.id] = { status: 'present' };
            }
        });
        renderRollCall();
    });

    document.getElementById('validateSession')?.addEventListener('click', submitAttendance);
    
    const lateModal = document.getElementById('lateModal');
    document.querySelectorAll('.close-late-modal').forEach(btn => btn.addEventListener('click', () => lateModal.classList.add('hidden')));
    
    document.getElementById('saveLateInfo')?.addEventListener('click', () => {
        const studentId = document.getElementById('lateStudentID').value;
        const minutes = document.getElementById('lateMinutes').value;
        const reason = document.getElementById('lateReason').value;
        
        state.attendance[studentId] = { status: 'late', minutes, reason };
        lateModal.classList.add('hidden');
        renderRollCall();
    });

    async function fetchSessionData() {
        try {
            // 1. Get Session Info
            const { data: session, error: sErr } = await supabase
                .from('class_schedules')
                .select('*, classes(*)')
                .eq('id', state.scheduleId)
                .eq('teacher_id', state.user.id) // Test 1.2: Scope Enforcement
                .single();

            if (sErr || !session) {
                utils.showNotification('Unauthorized access or session not found.', 'error');
                setTimeout(() => window.location.href = 'teacher-dashboard.html', 2000);
                return;
            }
            state.session = session;
            document.getElementById('sessionInfo').innerText = `${session.subject} • Grade ${session.classes.grade} ${session.classes.strand || ''} • Room ${session.classes.room}`;

            // 2. Check if already locked for today (using attendance_validations)
            const today = new Date().toISOString().split('T')[0];
            const { data: validation } = await supabase
                .from('attendance_validations')
                .select('*')
                .eq('class_id', session.class_id)
                .eq('subject', session.subject)
                .eq('attendance_date', today)
                .single();

            if (validation) {
                state.isLocked = true;
                document.getElementById('lockStatus').classList.remove('hidden');
                document.getElementById('validateSession').disabled = true;
                document.getElementById('validateSession').classList.add('opacity-50', 'cursor-not-allowed');
                document.getElementById('markAllPresent').classList.add('hidden');
            }

            // 3. Get Students and their attendance for today
            const { data: students } = await supabase
                .from('students')
                .select('*')
                .eq('class_id', session.class_id)
                .order('full_name');

            state.students = students || [];

            // Fetch existing attendance rows for these students today
            // Test 3.3: Prioritize manual validation over automated scans
            const { data: existingAtt } = await supabase
                .from('attendance')
                .select('*')
                .eq('class_id', session.class_id)
                .eq('session', session.start_time?.includes('AM') ? 'AM' : 'PM')
                .gte('timestamp', today + 'T00:00:00')
                .lte('timestamp', today + 'T23:59:59')
                .order('method', { ascending: false }); // 'manual' (m) comes after 'qr' (q) in descending? No, 'm' < 'q'.
                // Let's just sort by timestamp and then override with manual.

            if (existingAtt) {
                // First pass: all scans
                existingAtt.filter(a => a.method === 'qr').forEach(a => {
                    state.attendance[a.student_id] = { status: a.status, reason: a.remarks };
                });
                // Second pass: manual (teacher) always wins
                existingAtt.filter(a => a.method === 'manual').forEach(a => {
                    state.attendance[a.student_id] = { status: a.status, reason: a.remarks };
                });
            }
            document.getElementById('rollCallArea').classList.remove('hidden');
            renderRollCall();

        } catch (err) {
            console.error('Session fetch error:', err);
            utils.showNotification('Failed to load session data', 'error');
        }
    }

    function renderRollCall() {
        const list = document.getElementById('rollCallList');
        const stats = { present: 0, late: 0, absent: 0 };

        list.innerHTML = state.students.map(s => {
            const att = state.attendance[s.id] || { status: 'unmarked' };
            if (att.status === 'present') stats.present++;
            else if (att.status === 'late') stats.late++;
            else if (att.status === 'absent') stats.absent++;

            return `
                <tr class="hover:bg-gray-50 transition-all">
                    <td class="px-8 py-4">
                        <div class="flex items-center space-x-4">
                            <div class="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-600 border border-gray-200">
                                ${s.full_name[0]}
                            </div>
                            <div>
                                <p class="text-sm font-bold text-gray-900">${s.full_name}</p>
                                <p class="text-[10px] text-gray-400 font-mono">${s.lrn}</p>
                            </div>
                        </div>
                    </td>
                    <td class="px-8 py-4">
                        <div class="flex items-center">
                            ${getStatusBadge(att.status)}
                        </div>
                    </td>
                    <td class="px-8 py-4 text-right">
                        ${!state.isLocked ? `
                            <div class="flex justify-end space-x-2">
                                <button onclick="cycleStatus('${s.id}')" class="p-2 bg-white border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 transition-all shadow-sm" title="Cycle Status">
                                    <i data-lucide="refresh-cw" class="w-4 h-4"></i>
                                </button>
                                <button onclick="openLateModal('${s.id}')" class="p-2 bg-white border border-gray-200 text-amber-600 rounded-lg hover:bg-amber-50 transition-all shadow-sm" title="Mark Late with Details">
                                    <i data-lucide="clock" class="w-4 h-4"></i>
                                </button>
                            </div>
                        ` : '<span class="text-[10px] font-bold text-gray-300 uppercase tracking-widest italic">Locked</span>'}
                    </td>
                </tr>
            `;
        }).join('');

        document.getElementById('rollTotal').innerText = state.students.length;
        document.getElementById('rollPresent').innerText = stats.present;
        document.getElementById('rollLate').innerText = stats.late;
        document.getElementById('rollAbsent').innerText = stats.absent;

        if (window.lucide) window.lucide.createIcons();
    }

    function getStatusBadge(status) {
        switch(status) {
            case 'present': return '<span class="px-3 py-1 bg-green-100 text-green-700 rounded-full text-[10px] font-bold uppercase tracking-wider">Present</span>';
            case 'late': return '<span class="px-3 py-1 bg-yellow-100 text-yellow-700 rounded-full text-[10px] font-bold uppercase tracking-wider">Late</span>';
            case 'absent': return '<span class="px-3 py-1 bg-red-100 text-red-700 rounded-full text-[10px] font-bold uppercase tracking-wider">Absent</span>';
            case 'excused': return '<span class="px-3 py-1 bg-indigo-100 text-indigo-700 rounded-full text-[10px] font-bold uppercase tracking-wider">Excused</span>';
            case 'clinic': return '<span class="px-3 py-1 bg-rose-100 text-rose-700 rounded-full text-[10px] font-bold uppercase tracking-wider">Clinic</span>';
            default: return '<span class="px-3 py-1 bg-gray-100 text-gray-400 rounded-full text-[10px] font-bold uppercase tracking-wider">Unmarked</span>';
        }
    }

    window.cycleStatus = (studentId) => {
        if (state.isLocked) return;
        const current = state.attendance[studentId]?.status || 'unmarked';
        // 'clinic' and 'excused' are usually system-driven, but teacher can override to clinic if they know.
        // Excused usually comes from approved letters.
        const sequence = ['unmarked', 'present', 'absent', 'clinic']; 
        const nextIndex = (sequence.indexOf(current) + 1) % sequence.length;
        state.attendance[studentId] = { status: sequence[nextIndex] };
        renderRollCall();
    };

    window.openLateModal = (studentId) => {
        if (state.isLocked) return;
        document.getElementById('lateStudentID').value = studentId;
        document.getElementById('lateMinutes').value = state.attendance[studentId]?.minutes || 15;
        document.getElementById('lateReason').value = state.attendance[studentId]?.reason || '';
        document.getElementById('lateModal').classList.remove('hidden');
    };

    async function submitAttendance() {
        if (state.isLocked) return;

        try {
            // Test 9.1: Suspension Day Enforcement
            const isSchoolDay = await utils.isSchoolDay();
            if (!isSchoolDay) {
                throw new Error('Roll call is blocked today (School Holiday/Suspension)');
            }

            const unmarked = state.students.filter(s => !state.attendance[s.id] || state.attendance[s.id].status === 'unmarked');
            if (unmarked.length > 0) {
                if (!confirm(`${unmarked.length} students are still unmarked. Mark them as ABSENT?`)) return;
                unmarked.forEach(s => state.attendance[s.id] = { status: 'absent' });
                renderRollCall();
            }

            if (!confirm('Are you sure you want to VALIDATE and LOCK this session? You will not be able to edit it afterwards.')) return;

            utils.showNotification('Validating session...', 'info');
            
            const today = new Date().toISOString().split('T')[0];
            const sessionType = state.session.start_time?.includes('AM') ? 'AM' : 'PM';

            // 1. Prepare attendance rows (History-based, append-only)
            const attendanceRows = state.students.map(s => ({
                student_id: s.id,
                class_id: state.session.class_id,
                status: state.attendance[s.id].status,
                entry_type: 'entry',
                session: sessionType,
                method: 'manual',
                recorded_by: state.user.id,
                remarks: state.attendance[s.id].reason || null,
                timestamp: new Date().toISOString()
            }));

            // 2. Prepare validation lock
            const validationRow = {
                class_id: state.session.class_id,
                teacher_id: state.user.id,
                subject: state.session.subject,
                session: sessionType,
                attendance_date: today,
                validated_by: state.user.id,
                remarks: `Validated via roll call for ${state.session.subject}`
            };

            // 3. Prepare Audit Log
            const auditLog = {
                actor_id: state.user.id,
                action: 'VALIDATE_SESSION',
                target_table: 'attendance_validations',
                details: {
                    subject: state.session.subject,
                    class_id: state.session.class_id,
                    student_count: state.students.length
                }
            };

            // Execute all in sequence
            const { error: attError } = await supabase.from('attendance').insert(attendanceRows);
            if (attError) throw attError;

            const { error: valError } = await supabase.from('attendance_validations').insert(validationRow);
            if (valError) throw valError;

            const { error: auditError } = await supabase.from('audit_logs').insert(auditLog);
            if (auditError) console.warn('Failed to log audit:', auditError);

            utils.showNotification('Attendance validated and locked!', 'success');
            fetchSessionData(); // Reload to show lock state

        } catch (err) {
            console.error('Submit error:', err);
            utils.showNotification(err.message, 'error');
        }
    }
});
