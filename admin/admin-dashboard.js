const supabase = window.supabaseClient;
const utils = window.utils;

document.addEventListener('DOMContentLoaded', async () => {
    // Check access
    await utils.checkAccess(['admin']);

    // Render Layout
    utils.renderAdminLayout('dashboard');

    // Initialize UI
    initializeStats();
    initializeCharts();
    fetchRecentAnnouncements();
    initializeNotifications();
    fetchCriticalData();

    // Stats Logic
    async function initializeStats() {
        try {
            const { count: studentCount } = await supabase.from('students').select('*', { count: 'exact', head: true });
            document.getElementById('totalStudents').innerText = studentCount || 0;

            const { count: teacherCount } = await supabase.from('teachers').select('*', { count: 'exact', head: true });
            document.getElementById('totalTeachers').innerText = teacherCount || 0;

            const today = new Date().toISOString().split('T')[0];
            const { data: attendanceToday } = await supabase
                .from('attendance')
                .select('status')
                .gte('timestamp', `${today}T00:00:00`)
                .lte('timestamp', `${today}T23:59:59`);

            const stats = attendanceToday?.reduce((acc, curr) => {
                acc[curr.status] = (acc[curr.status] || 0) + 1;
                return acc;
            }, { present: 0, late: 0, absent: 0, excused: 0, clinic: 0 }) || { present: 0, late: 0, absent: 0, excused: 0, clinic: 0 };

            document.getElementById('presentCount').innerText = stats.present;
            document.getElementById('lateCount').innerText = stats.late;
            document.getElementById('absentCount').innerText = stats.absent;
            document.getElementById('excusedCount').innerText = stats.excused;
            // Note: Dashboard HTML might need a clinicCount element if we want to show it there too.
            // For now I'll just update the JS logic.

            renderDistributionChart(stats);
        } catch (err) {
            console.error('Error fetching stats:', err);
        }
    }

    function renderDistributionChart(stats) {
        const distCtx = document.getElementById('attendanceDistChart')?.getContext('2d');
        if (distCtx) {
            new Chart(distCtx, {
                type: 'pie',
                data: {
                    labels: ['Present', 'Late', 'Absent', 'Excused', 'Clinic'],
                    datasets: [{
                        data: [stats.present, stats.late, stats.absent, stats.excused, stats.clinic],
                        backgroundColor: ['#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#e11d48']
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { position: 'bottom' }
                    }
                }
            });
        }
    }

    // Charts Logic
    async function initializeCharts() {
        // Performance Trend Chart
        const trendCtx = document.getElementById('performanceTrendChart')?.getContext('2d');
        if (trendCtx) {
            new Chart(trendCtx, {
                type: 'line',
                data: {
                    labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
                    datasets: [{
                        label: 'Attendance Rate %',
                        data: [95, 92, 94, 90, 93],
                        borderColor: '#7c3aed',
                        backgroundColor: 'rgba(124, 58, 237, 0.1)',
                        fill: true,
                        tension: 0.4
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: {
                        y: { beginAtZero: true, max: 100, grid: { color: '#f3f4f6' } },
                        x: { grid: { display: false } }
                    }
                }
            });
        }

        // Class Performance Chart
        const classCtx = document.getElementById('classPerformanceChart')?.getContext('2d');
        if (classCtx) {
            try {
                const { data: classes } = await supabase.from('classes').select('grade, strand');
                const labels = classes.map(c => `G${c.grade}${c.strand ? `-${c.strand}` : ''}`);
                const data = classes.map(() => Math.floor(Math.random() * (100 - 80 + 1)) + 80); // Mock data for now

                new Chart(classCtx, {
                    type: 'bar',
                    data: {
                        labels: labels,
                        datasets: [{
                            label: 'Attendance %',
                            data: data,
                            backgroundColor: '#7c3aed',
                            borderRadius: 6
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: { legend: { display: false } },
                        scales: {
                            y: { beginAtZero: true, max: 100, grid: { color: '#f3f4f6' } },
                            x: { grid: { display: false } }
                        }
                    }
                });
            } catch (err) {
                console.error('Error fetching class stats:', err);
            }
        }
    }

    async function fetchRecentAnnouncements() {
        try {
            const { data, error } = await supabase
                .from('announcements')
                .select('*')
                .order('is_pinned', { ascending: false })
                .order('created_at', { ascending: false })
                .limit(3);

            if (error) throw error;
            renderRecentAnnouncements(data);
        } catch (err) {
            console.error('Error fetching recent announcements:', err);
        }
    }

    function renderRecentAnnouncements(anns) {
        const list = document.getElementById('recentAnnouncements');
        if (!list) return;

        if (anns.length === 0) {
            list.innerHTML = '<p class="text-gray-500 text-sm text-center py-8 italic">No recent announcements</p>';
            return;
        }

        list.innerHTML = anns.map(a => `
            <div class="p-4 bg-gray-50 rounded-xl border border-gray-100 hover:bg-white hover:border-violet-100 transition-all cursor-default">
                <div class="flex justify-between items-start mb-1">
                    <h5 class="font-bold text-gray-900 text-sm truncate pr-4">${a.title}</h5>
                    <span class="text-[10px] text-gray-400 whitespace-nowrap">${utils.formatDate(a.created_at)}</span>
                </div>
                <p class="text-xs text-gray-600 line-clamp-2">${a.content}</p>
            </div>
        `).join('');
    }

    async function initializeNotifications() {
        const bellBtn = document.querySelector('button .lucide-bell')?.parentElement;
        const badge = document.querySelector('button span.bg-red-500');
        const user = utils.getCurrentUser();

        try {
            const { data, error } = await supabase
                .from('notifications')
                .select('id, verb, object, created_at, read')
                .eq('recipient_id', user.id)
                .eq('read', false)
                .order('created_at', { ascending: false })
                .limit(20);

            if (error) throw error;

            const unreadCount = data?.length || 0;

            if (badge) {
                badge.innerText = unreadCount.toString();
                badge.classList.toggle('hidden', unreadCount === 0);
            }

            bellBtn?.addEventListener('click', () => {
                if (unreadCount > 0) {
                    const list = data.map(n => `${n.verb}: ${JSON.stringify(n.object || {})}`).join('\n\n');
                    alert(`Recent Notifications:\n\n${list}`);
                    markNotificationsRead(user.id, data.map(n => n.id));
                } else {
                    utils.showNotification('No new notifications', 'info');
                }
            });

        } catch (err) {
            console.error('Error fetching notifications:', err);
        }
    }

    async function markNotificationsRead(userId, notificationIds) {
        try {
            const { error } = await supabase
                .from('notifications')
                .update({ 
                    read: true
                })
                .in('id', notificationIds);

            if (error) throw error;
            
            initializeNotifications(); // Refresh badge
        } catch (err) {
            console.error('Error marking notifications as read:', err);
        }
    }

    async function fetchCriticalData() {
        try {
            // Critical Absences (20+)
            const { data: absences } = await supabase
                .from('attendance')
                .select('student_id, students(full_name, class_id)')
                .eq('status', 'absent');

            const absCounts = absences.reduce((acc, curr) => {
                const id = curr.student_id;
                if (!acc[id]) acc[id] = { name: curr.students.full_name, class: curr.students.class_id, count: 0 };
                acc[id].count++;
                return acc;
            }, {});

            const critical = Object.values(absCounts).filter(s => s.count >= 20).sort((a, b) => b.count - a.count);
            renderCriticalAbsences(critical);

            // Frequent Lates (Top 5)
            const { data: lates } = await supabase
                .from('attendance')
                .select('student_id, students(full_name, class_id)')
                .eq('status', 'late');

            const lateCounts = lates.reduce((acc, curr) => {
                const id = curr.student_id;
                if (!acc[id]) acc[id] = { name: curr.students.full_name, class: curr.students.class_id, count: 0 };
                acc[id].count++;
                return acc;
            }, {});

            const frequent = Object.values(lateCounts).sort((a, b) => b.count - a.count).slice(0, 5);
            renderFrequentLates(frequent);

        } catch (err) {
            console.error('Error fetching critical data:', err);
        }
    }

    function renderCriticalAbsences(data) {
        const list = document.getElementById('criticalAbsenceList');
        if (!list) return;
        if (data.length === 0) return;

        list.innerHTML = data.map(s => `
            <tr class="border-b border-gray-50 hover:bg-gray-50 transition-all">
                <td class="py-3 font-bold text-gray-900">${s.name}</td>
                <td class="py-3 text-gray-500">${s.class}</td>
                <td class="py-3 text-right text-red-600 font-bold">${s.count}</td>
            </tr>
        `).join('');
    }

    function renderFrequentLates(data) {
        const list = document.getElementById('frequentLateList');
        if (!list) return;
        if (data.length === 0) return;

        list.innerHTML = data.map(s => `
            <tr class="border-b border-gray-50 hover:bg-gray-50 transition-all">
                <td class="py-3 font-bold text-gray-900">${s.name}</td>
                <td class="py-3 text-gray-500">${s.class}</td>
                <td class="py-3 text-right text-yellow-600 font-bold">${s.count}</td>
            </tr>
        `).join('');
    }
});

