const supabase = window.supabaseClient;
const utils = window.utils;

document.addEventListener('DOMContentLoaded', async () => {
    // Check access
    await utils.checkAccess(['clinic', 'admin']);

    // State
    const state = {
        visits: [],
        sections: {
            pending: document.getElementById('pendingSection'),
            active: document.getElementById('activeSection'),
            history: document.getElementById('historySection'),
            analytics: document.getElementById('analyticsSection')
        },
        charts: {
            reasons: null,
            trends: null,
            grades: null
        }
    };

    const sectionTitle = document.getElementById('sectionTitle');

    // Initialize UI
    initializeSidebar();
    await fetchPendingVisits();
    fetchAnnouncements();
    initializeRealtime();

    function initializeSidebar() {
        const links = document.querySelectorAll('.nav-link');
        links.forEach(link => {
            link.addEventListener('click', () => {
                const section = link.dataset.section;
                links.forEach(l => l.classList.remove('bg-rose-50', 'text-rose-600', 'font-bold'));
                link.classList.add('bg-rose-50', 'text-rose-600', 'font-bold');

                Object.values(state.sections).forEach(s => s?.classList.add('hidden'));
                state.sections[section]?.classList.remove('hidden');
                sectionTitle.innerText = link.querySelector('span').innerText;

                if (section === 'analytics') {
                    fetchAnalytics();
                }
            });
        });
    }

    async function fetchPendingVisits() {
        try {
            const { data, error } = await supabase
                .from('clinic_visits')
                .select('*, students(full_name, grade_level, strand)')
                .eq('status', 'pending')
                .order('visit_time', { ascending: true });

            if (error) throw error;
            renderPendingVisits(data);
        } catch (err) {
            console.error('Error fetching visits:', err);
        }
    }

    function renderPendingVisits(visits) {
        const grid = document.getElementById('pendingPassesGrid');
        if (visits.length === 0) {
            grid.innerHTML = '<p class="col-span-full text-center py-20 text-gray-400 font-bold uppercase tracking-widest text-xs">No pending clinic passes</p>';
            return;
        }

        grid.innerHTML = visits.map(v => `
            <div class="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm hover:shadow-md transition-all">
                <div class="flex justify-between items-start mb-4">
                    <div class="bg-rose-100 text-rose-600 p-2 rounded-xl">
                        <i data-lucide="clock" class="w-5 h-5"></i>
                    </div>
                    <span class="text-[10px] font-black text-rose-600 bg-rose-50 px-2 py-1 rounded-lg uppercase">Pending Approval</span>
                </div>
                <h4 class="text-lg font-black text-gray-900 mb-1">${v.students.full_name}</h4>
                <p class="text-xs text-gray-500 font-bold mb-4 uppercase">Grade ${v.students.grade_level} ${v.students.strand || ''}</p>
                <div class="p-3 bg-gray-50 rounded-2xl mb-4">
                    <p class="text-[10px] text-gray-400 font-black uppercase tracking-widest mb-1">Reason</p>
                    <p class="text-xs font-bold text-gray-700">${v.reason || 'Not specified'}</p>
                </div>
                <div class="grid grid-cols-2 gap-3">
                    <button onclick="updateVisitStatus('${v.id}', 'active')" class="bg-rose-600 text-white py-3 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-rose-700 shadow-lg shadow-rose-100">Approve</button>
                    <button onclick="updateVisitStatus('${v.id}', 'rejected')" class="bg-gray-100 text-gray-600 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-gray-200">Reject</button>
                </div>
            </div>
        `).join('');
        if (window.lucide) window.lucide.createIcons();
    }

    window.updateVisitStatus = async (id, status) => {
        try {
            const { error } = await supabase
                .from('clinic_visits')
                .update({ status })
                .eq('id', id);

            if (error) throw error;
            utils.showNotification(`Visit ${status}`, 'success');
            fetchPendingVisits();
        } catch (err) {
            console.error('Error updating status:', err);
        }
    };

    async function fetchAnnouncements() {
        const list = document.getElementById('clinicAnnouncements');
        if (!list) return;

        try {
            const { data: anns } = await supabase
                .from('announcements')
                .select('*')
                .contains('audience', ['clinic'])
                .order('is_pinned', { ascending: false })
                .order('created_at', { ascending: false })
                .limit(5);

            if (anns && anns.length > 0) {
                list.innerHTML = anns.map(a => `
                    <div class="p-4 bg-gray-50 rounded-2xl border border-gray-100 hover:bg-white hover:border-rose-100 transition-all group relative overflow-hidden">
                        ${a.is_pinned ? `
                            <div class="absolute top-0 right-0 p-2">
                                <i data-lucide="pin" class="text-rose-600 w-3 h-3 fill-rose-600"></i>
                            </div>
                        ` : ''}
                        <h4 class="text-xs font-black text-gray-900 mb-1 group-hover:text-rose-600 transition-colors">${a.title}</h4>
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

    async function fetchAnalytics() {
        try {
            const { data: visits, error } = await supabase
                .from('clinic_visits')
                .select('*, students(grade_level)');

            if (error) throw error;

            renderReasonsChart(visits);
            renderTrendsChart(visits);
            renderGradesChart(visits);
        } catch (err) {
            console.error('Analytics error:', err);
            utils.showNotification('Failed to load analytics data', 'error');
        }
    }

    function renderReasonsChart(visits) {
        const ctx = document.getElementById('reasonsChart')?.getContext('2d');
        if (!ctx) return;

        const reasons = visits.reduce((acc, v) => {
            const reason = v.reason || 'Other';
            acc[reason] = (acc[reason] || 0) + 1;
            return acc;
        }, {});

        if (state.charts.reasons) state.charts.reasons.destroy();
        state.charts.reasons = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: Object.keys(reasons),
                datasets: [{
                    data: Object.values(reasons),
                    backgroundColor: ['#fb7185', '#f43f5e', '#e11d48', '#be123c', '#9f1239', '#881337'],
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 10, weight: 'bold' } } }
                }
            }
        });
    }

    function renderTrendsChart(visits) {
        const ctx = document.getElementById('trendsChart')?.getContext('2d');
        if (!ctx) return;

        const last7Days = Array.from({ length: 7 }, (_, i) => {
            const d = new Date();
            d.setDate(d.getDate() - (6 - i));
            return d.toISOString().split('T')[0];
        });

        const trends = last7Days.map(date => {
            return visits.filter(v => v.visit_time?.startsWith(date)).length;
        });

        if (state.charts.trends) state.charts.trends.destroy();
        state.charts.trends = new Chart(ctx, {
            type: 'line',
            data: {
                labels: last7Days.map(d => new Date(d).toLocaleDateString('en-US', { weekday: 'short' })),
                datasets: [{
                    label: 'Visits',
                    data: trends,
                    borderColor: '#e11d48',
                    backgroundColor: 'rgba(225, 29, 72, 0.1)',
                    fill: true,
                    tension: 0.4,
                    borderWidth: 3,
                    pointRadius: 4,
                    pointBackgroundColor: '#fff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    y: { beginAtZero: true, grid: { color: '#f3f4f6' }, ticks: { font: { weight: 'bold' } } },
                    x: { grid: { display: false }, ticks: { font: { weight: 'bold' } } }
                }
            }
        });
    }

    function renderGradesChart(visits) {
        const ctx = document.getElementById('gradesChart')?.getContext('2d');
        if (!ctx) return;

        const grades = visits.reduce((acc, v) => {
            const grade = `Grade ${v.students?.grade_level || 'N/A'}`;
            acc[grade] = (acc[grade] || 0) + 1;
            return acc;
        }, {});

        if (state.charts.grades) state.charts.grades.destroy();
        state.charts.grades = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: Object.keys(grades),
                datasets: [{
                    label: 'Visits',
                    data: Object.values(grades),
                    backgroundColor: '#e11d48',
                    borderRadius: 8
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    y: { beginAtZero: true, grid: { color: '#f3f4f6' }, ticks: { font: { weight: 'bold' } } },
                    x: { grid: { display: false }, ticks: { font: { weight: 'bold' } } }
                }
            }
        });
    }

    function initializeRealtime() {
        supabase
            .channel('clinic_changes')
            .on('postgres_changes', { event: '*', table: 'clinic_visits' }, () => {
                fetchPendingVisits();
            })
            .subscribe();
    }
});
