import supabase from './supabase-config.js';
import { utils } from './utils.js';

document.addEventListener('DOMContentLoaded', async () => {
    // Check access
    utils.checkAccess(['teacher', 'admin']);
    utils.renderTeacherLayout('dashboard');

    const state = {
        user: utils.getCurrentUser(),
        teacherInfo: null,
        homeroomClass: null,
        students: [],
        sessions: [],
        pendingExcuses: 0
    };

    // Initial Data Fetch
    await fetchInitialData();

    async function fetchInitialData() {
        try {
            // 1. Get Teacher & Homeroom Info
            const { data: teacher, error: tErr } = await supabase
                .from('teachers')
                .select('*, classes(*)')
                .eq('id', state.user.id)
                .single();

            if (tErr) throw tErr;
            state.teacherInfo = teacher;
            state.homeroomClass = teacher.classes?.[0] || null;

            if (state.homeroomClass) {
                document.getElementById('statHomeroom').innerText = state.homeroomClass.id.replace('CLS-', '');
                document.getElementById('statHomeroomGrade').innerText = `Grade ${state.homeroomClass.grade} ${state.homeroomClass.strand || ''}`;
                await fetchHomeroomStats();
            } else {
                document.getElementById('statHomeroom').innerText = 'No Class';
            }

            // 2. Get Today's Sessions
            const { data: sessions } = await supabase
                .from('class_schedules')
                .select('*, classes(grade, strand, room)')
                .eq('teacher_id', state.user.id);
            
            state.sessions = sessions || [];
            document.getElementById('statSessions').innerText = state.sessions.length;
            renderSessions();

            // 3. Get Pending Excuse Letters
            if (state.homeroomClass) {
                const { count } = await supabase
                    .from('excuse_letters')
                    .select('*', { count: 'exact', head: true })
                    .eq('status', 'pending');
                // Note: Ideally we'd filter by students in the homeroom, 
                // but for now we show total pending if teacher has a class.
                state.pendingExcuses = count || 0;
                document.getElementById('statExcuses').innerText = state.pendingExcuses;
            }

            // 4. Get Clinic Feedback
            fetchClinicFeedback();
            
            // 5. Get Announcements
            fetchClassAnnouncements();

        } catch (err) {
            console.error('Dashboard init error:', err);
            utils.showNotification('Failed to load dashboard data', 'error');
        }
    }

    async function fetchHomeroomStats() {
        if (!state.homeroomClass) return;

        const { data: students } = await supabase
            .from('students')
            .select('current_status')
            .eq('class_id', state.homeroomClass.id);

        const stats = (students || []).reduce((acc, s) => {
            if (s.current_status === 'present') acc.onTime++;
            else if (s.current_status === 'late') acc.late++;
            else if (s.current_status === 'absent') acc.absent++;
            else acc.out++;
            return acc;
        }, { onTime: 0, late: 0, absent: 0, out: 0 });

        document.getElementById('hrOnTime').innerText = stats.onTime;
        document.getElementById('hrLate').innerText = stats.late;
        document.getElementById('hrAbsent').innerText = stats.absent;
        document.getElementById('hrOut').innerText = stats.out;

        // Calculate Attendance Rate (Simplified)
        const rate = students?.length > 0 ? Math.round(((stats.onTime + stats.late) / students.length) * 100) : 100;
        document.getElementById('statAttendance').innerText = `${rate}%`;
    }

    function renderSessions() {
        const grid = document.getElementById('sessionsGrid');
        if (state.sessions.length === 0) {
            grid.innerHTML = '<p class="text-center py-4 text-gray-400 text-xs">No subject sessions today</p>';
            return;
        }

        grid.innerHTML = state.sessions.map(s => `
            <div class="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-100 group hover:border-blue-200 transition-all">
                <div class="flex items-center space-x-4">
                    <div class="w-10 h-10 bg-white rounded-lg flex items-center justify-center text-blue-600 shadow-sm">
                        <i data-lucide="book" class="w-5 h-5"></i>
                    </div>
                    <div>
                        <p class="text-sm font-bold text-gray-900">${s.subject}</p>
                        <p class="text-[10px] text-gray-500 uppercase tracking-widest">Grade ${s.classes.grade} ${s.classes.strand || ''} • Room ${s.classes.room}</p>
                    </div>
                </div>
                <div class="flex items-center space-x-4">
                    <div class="text-right">
                        <p class="text-xs font-bold text-gray-900">${s.start_time || 'TBA'}</p>
                        <p class="text-[10px] text-gray-400 italic">Scheduled</p>
                    </div>
                    <a href="teacher-attendance.html?scheduleId=${s.id}" class="p-2 bg-white text-blue-600 rounded-lg shadow-sm border border-gray-100 hover:bg-blue-600 hover:text-white transition-all">
                        <i data-lucide="chevron-right" class="w-5 h-5"></i>
                    </a>
                </div>
            </div>
        `).join('');
        if (window.lucide) window.lucide.createIcons();
    }

    async function fetchClinicFeedback() {
        const list = document.getElementById('clinicFeedbackList');
        try {
            const { data: visits } = await supabase
                .from('clinic_visits')
                .select('*, students(full_name)')
                .order('visit_time', { ascending: false })
                .limit(3);

            if (visits?.length > 0) {
                list.innerHTML = visits.map(v => `
                    <div class="p-3 bg-red-50 rounded-xl border border-red-100">
                        <div class="flex justify-between items-start mb-1">
                            <p class="text-xs font-bold text-gray-900">${v.students?.full_name}</p>
                            <span class="text-[8px] text-red-600 font-bold uppercase">${v.status}</span>
                        </div>
                        <p class="text-[10px] text-gray-600 line-clamp-2">${v.medical_findings || 'Awaiting findings...'}</p>
                    </div>
                `).join('');
            }
        } catch (err) {
            console.error('Clinic feedback error:', err);
        }
    }

    async function fetchClassAnnouncements() {
        const list = document.getElementById('classAnnouncements');
        try {
            const { data: anns } = await supabase
                .from('announcements')
                .select('*')
                .contains('audience', ['parents'])
                .eq('created_by', state.user.id)
                .order('created_at', { ascending: false })
                .limit(3);

            if (anns?.length > 0) {
                list.innerHTML = anns.map(a => `
                    <div class="p-3 bg-amber-50 rounded-xl border border-amber-100">
                        <p class="text-xs font-bold text-gray-900 mb-1">${a.title}</p>
                        <p class="text-[10px] text-gray-600 line-clamp-2">${a.message}</p>
                    </div>
                `).join('');
            }
        } catch (err) {
            console.error('Announcements error:', err);
        }
    }
});