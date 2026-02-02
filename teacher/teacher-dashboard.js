const supabase = window.supabaseClient;
const utils = window.utils;

document.addEventListener('DOMContentLoaded', async () => {
    // Check access
    await utils.checkAccess(['teacher', 'admin']);

    // State
    const state = {
        user: utils.getCurrentUser(),
        homeroomClass: null,
        subjects: [],
        attendance: {},
        todaySessions: []
    };

    // Initialize UI
    utils.renderTeacherLayout('dashboard');

    // Initial Data Fetch
    await fetchInitialData();
    fetchAtRiskStudents();
    fetchSubjectAnalytics();

    async function fetchInitialData() {
        try {
            // 1. Fetch Teacher Info & Homeroom
            const { data: teacher, error: tErr } = await supabase
                .from('teachers')
                .select('*, classes(*)')
                .eq('id', state.user.id)
                .single();

            if (tErr) throw tErr;
            state.homeroomClass = teacher.classes;
            renderHomeroomCard();

            // 2. Fetch Today's Subject Sessions
            const dayOfWeek = new Date().toLocaleDateString('en-US', { weekday: 'long' });
            const { data: sessions, error: sErr } = await supabase
                .from('subject_schedules')
                .select('*, classes(grade, strand)')
                .eq('teacher_id', state.user.id)
                .eq('day_of_week', dayOfWeek)
                .order('start_time', { ascending: true });

            if (sErr) throw sErr;
            state.todaySessions = sessions;
            renderSessions();

            // 3. Fetch Announcements
            fetchClassAnnouncements();

        } catch (err) {
            console.error('Initialization error:', err);
        }
    }

    function renderHomeroomCard() {
        if (!state.homeroomClass) {
            document.getElementById('homeroomCard').classList.add('hidden');
            return;
        }

        document.getElementById('className').innerText = `Grade ${state.homeroomClass.grade}`;
        document.getElementById('classStrand').innerText = state.homeroomClass.strand || 'General';
        
        // Fetch student count
        supabase.from('students')
            .select('*', { count: 'exact', head: true })
            .eq('class_id', state.homeroomClass.id)
            .then(({ count }) => {
                document.getElementById('studentCount').innerText = count || 0;
            });

        // Fetch present today
        const today = new Date().toISOString().split('T')[0];
        supabase.from('attendance')
            .select('*', { count: 'exact', head: true })
            .eq('class_id', state.homeroomClass.id)
            .eq('status', 'present')
            .gte('timestamp', `${today}T00:00:00`)
            .then(({ count }) => {
                document.getElementById('presentToday').innerText = count || 0;
            });
    }

    function renderSessions() {
        const grid = document.getElementById('sessionsGrid');
        if (state.todaySessions.length === 0) {
            grid.innerHTML = '<p class="col-span-full text-center py-10 text-gray-400 font-bold uppercase tracking-widest text-[10px]">No sessions scheduled for today</p>';
            return;
        }

        grid.innerHTML = state.todaySessions.map(s => `
            <div class="p-6 bg-gray-50 rounded-2xl border border-gray-100 hover:bg-white hover:border-blue-100 transition-all group">
                <div class="flex justify-between items-start mb-4">
                    <div class="text-blue-600 font-black text-xs uppercase tracking-tighter">${s.start_time.slice(0, 5)} - ${s.end_time.slice(0, 5)}</div>
                    <div class="px-2 py-1 bg-blue-100 text-blue-700 rounded-lg text-[9px] font-black uppercase tracking-widest">G${s.classes.grade} ${s.classes.strand || ''}</div>
                </div>
                <h5 class="text-lg font-black text-gray-900 mb-4">${s.subject_name}</h5>
                <a href="teacher-attendance.html?session=${s.id}" class="w-full flex items-center justify-center space-x-2 py-3 bg-white border-2 border-blue-600 text-blue-600 rounded-xl font-black text-[10px] uppercase tracking-widest group-hover:bg-blue-600 group-hover:text-white transition-all shadow-sm">
                    <i data-lucide="check-circle" class="w-4 h-4"></i>
                    <span>Start Roll Call</span>
                </a>
            </div>
        `).join('');
        if (window.lucide) window.lucide.createIcons();
    }

    async function fetchClassAnnouncements() {
        const list = document.getElementById('classAnnouncements');
        try {
            const { data: anns } = await supabase
                .from('announcements')
                .select('*')
                .contains('audience', ['teacher'])
                .order('is_pinned', { ascending: false })
                .order('created_at', { ascending: false })
                .limit(3);

            if (anns?.length > 0) {
                list.innerHTML = anns.map(a => `
                    <div class="p-3 bg-amber-50 rounded-xl border border-amber-100 transition-all hover:bg-white hover:shadow-sm relative overflow-hidden">
                        ${a.is_pinned ? `
                            <div class="absolute top-0 right-0 p-1">
                                <i data-lucide="pin" class="text-amber-600 w-3 h-3 fill-amber-600"></i>
                            </div>
                        ` : ''}
                        <p class="text-xs font-black text-gray-900 mb-1 pr-4">${a.title}</p>
                        <p class="text-[10px] text-gray-600 line-clamp-2 font-medium">${a.content}</p>
                        <p class="text-[8px] text-gray-400 mt-1 font-bold">${utils.formatDate(a.created_at)}</p>
                    </div>
                `).join('');
                if (window.lucide) window.lucide.createIcons();
            }
        } catch (err) {
            console.error('Announcements error:', err);
        }
    }

    async function fetchAtRiskStudents() {
        if (!state.homeroomClass) return;
        const list = document.getElementById('atRiskList');

        try {
            const oneWeekAgo = new Date();
            oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

            const { data: attendanceLogs } = await supabase
                .from('attendance')
                .select('student_id, status, students(full_name)')
                .eq('class_id', state.homeroomClass.id)
                .gte('timestamp', oneWeekAgo.toISOString());

            const riskScores = (attendanceLogs || []).reduce((acc, log) => {
                if (log.status === 'absent' || log.status === 'late') {
                    if (!acc[log.student_id]) {
                        acc[log.student_id] = { name: log.students?.full_name, score: 0, lates: 0, absences: 0 };
                    }
                    if (log.status === 'absent') {
                        acc[log.student_id].score += 2;
                        acc[log.student_id].absences++;
                    } else {
                        acc[log.student_id].score += 1;
                        acc[log.student_id].lates++;
                    }
                }
                return acc;
            }, {});

            const atRisk = Object.values(riskScores)
                .filter(s => s.score >= 3)
                .sort((a, b) => b.score - a.score);

            if (atRisk.length === 0) {
                list.innerHTML = `
                    <div class="py-8 text-center">
                        <p class="text-xs font-black text-emerald-600 uppercase tracking-widest">All students are on track</p>
                    </div>
                `;
                return;
            }

            list.innerHTML = atRisk.map(s => `
                <div class="flex items-center justify-between p-3 bg-rose-50 rounded-xl border border-rose-100">
                    <div class="flex items-center space-x-3">
                        <div class="w-8 h-8 rounded-lg bg-white flex items-center justify-center text-rose-600 font-black shadow-sm text-xs">
                            ${s.name[0]}
                        </div>
                        <div>
                            <p class="text-xs font-black text-gray-900">${s.name}</p>
                            <p class="text-[9px] text-rose-500 font-bold uppercase">${s.absences} Absences • ${s.lates} Lates</p>
                        </div>
                    </div>
                    <div class="px-2 py-1 bg-rose-100 text-rose-700 rounded-md text-[9px] font-black uppercase tracking-tighter">
                        High Risk
                    </div>
                </div>
            `).join('');

            document.getElementById('atRiskCount').innerText = atRisk.length;

        } catch (err) {
            console.error('At-risk fetch error:', err);
        }
    }

    async function fetchSubjectAnalytics() {
        const ctx = document.getElementById('subjectPerformanceChart')?.getContext('2d');
        if (!ctx) return;

        try {
            const { data: subjectAtt } = await supabase
                .from('subject_attendance')
                .select('subject_code, status')
                .eq('recorded_by', state.user.id);

            const stats = (subjectAtt || []).reduce((acc, curr) => {
                if (!acc[curr.subject_code]) acc[curr.subject_code] = { present: 0, total: 0 };
                acc[curr.subject_code].total++;
                if (curr.status === 'present') acc[curr.subject_code].present++;
                return acc;
            }, {});

            const labels = Object.keys(stats);
            const data = labels.map(l => Math.round((stats[l].present / stats[l].total) * 100));

            new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: labels,
                    datasets: [{
                        label: 'Attendance Rate %',
                        data: data,
                        backgroundColor: '#3b82f6',
                        borderRadius: 8,
                        barThickness: 20
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: {
                        y: { beginAtZero: true, max: 100, grid: { display: false }, ticks: { font: { size: 9, weight: 'bold' } } },
                        x: { grid: { display: false }, ticks: { font: { size: 9, weight: 'bold' } } }
                    }
                }
            });
        } catch (err) {
            console.error('Subject analytics error:', err);
        }
    }
});
