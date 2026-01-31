import supabase from './supabase-config.js';
import { utils } from './utils.js';

document.addEventListener('DOMContentLoaded', async () => {
    // Check access
    utils.checkAccess(['admin']);

    // Render Layout
    utils.renderAdminLayout('analytics');

    const state = {
        pieChart: null,
        barChart: null,
        trendChart: null,
        classChart: null,
        attendanceData: [],
        clinicData: [],
        currentRange: 'today'
    };

    // Initialize UI
    fetchAnalytics();

    // Event Listeners
    document.getElementById('refreshDataBtn')?.addEventListener('click', fetchAnalytics);
    document.getElementById('exportCSVBtn')?.addEventListener('click', exportToCSV);
    
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('bg-violet-600', 'text-white'));
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.add('text-gray-500'));
            
            e.target.classList.remove('text-gray-500');
            e.target.classList.add('bg-violet-600', 'text-white');
            
            state.currentRange = e.target.dataset.range;
            processAndRenderCharts();
        });
    });

    async function fetchAnalytics() {
        try {
            utils.showNotification('Updating analytics...', 'info');
            
            // Fetch all data once (since the dataset is small enough for now)
            const [attResponse, clinicResponse] = await Promise.all([
                supabase.from('attendance').select('*, students(full_name, class_id, grade_level)'),
                supabase.from('clinic_visits').select('*, students(full_name)')
            ]);

            if (attResponse.error) throw attResponse.error;
            if (clinicResponse.error) throw clinicResponse.error;

            state.attendanceData = attResponse.data;
            state.clinicData = clinicResponse.data;

            processAndRenderCharts();
        } catch (err) {
            console.error('Error fetching analytics:', err);
            utils.showNotification('Failed to load analytics', 'error');
        }
    }

    function processAndRenderCharts() {
        const now = new Date();
        let filteredAttendance = state.attendanceData;
        let filteredClinic = state.clinicData;

        // Apply Time Filter
        if (state.currentRange !== 'all') {
            const rangeStart = new Date();
            if (state.currentRange === 'today') rangeStart.setHours(0, 0, 0, 0);
            else if (state.currentRange === 'week') rangeStart.setDate(now.getDate() - 7);
            else if (state.currentRange === 'month') rangeStart.setMonth(now.getMonth() - 1);

            filteredAttendance = state.attendanceData.filter(a => new Date(a.timestamp) >= rangeStart);
            filteredClinic = state.clinicData.filter(c => new Date(c.visit_time) >= rangeStart);
        }

        // 1. Stats Overview
        const total = filteredAttendance.length || 1;
        const presentCount = filteredAttendance.filter(a => a.status === 'present').length;
        const lateCount = filteredAttendance.filter(a => a.status === 'late').length;
        const absentCount = filteredAttendance.filter(a => a.status === 'absent').length;
        const excusedCount = filteredAttendance.filter(a => a.status === 'excused').length;

        document.getElementById('statAvgAttendance').innerText = `${Math.round(((presentCount + lateCount) / total) * 100)}%`;
        document.getElementById('statTotalClinic').innerText = filteredClinic.length;
        document.getElementById('statOnTime').innerText = `${Math.round((presentCount / (presentCount + lateCount || 1)) * 100)}%`;

        // 2. Pie Chart
        renderPieChart({ present: presentCount, late: lateCount, absent: absentCount, excused: excusedCount });

        // 3. Clinic Bar Chart
        const clinicStats = filteredClinic.reduce((acc, curr) => {
            acc[curr.reason] = (acc[curr.reason] || 0) + 1;
            return acc;
        }, {});
        renderClinicChart(clinicStats);

        // 4. Trend Chart (Last 7 days of filtered data)
        renderTrendChart(filteredAttendance);

        // 5. Class Performance Chart
        renderClassChart(filteredAttendance);

        // 6. Critical & Late Lists
        const attendanceMap = filteredAttendance.reduce((acc, curr) => {
            const id = curr.student_id;
            if (!acc[id]) {
                acc[id] = { name: curr.students?.full_name, grade: curr.students?.grade_level, absentCount: 0, lateCount: 0 };
            }
            if (curr.status === 'absent') acc[id].absentCount++;
            if (curr.status === 'late') acc[id].lateCount++;
            return acc;
        }, {});

        const warningList = Object.values(attendanceMap).filter(s => s.absentCount >= 10).sort((a, b) => b.absentCount - a.absentCount);
        const criticalList = warningList.filter(s => s.absentCount >= 20);
        const lateList = Object.values(attendanceMap).filter(s => s.lateCount >= 5).sort((a, b) => b.lateCount - a.lateCount);

        renderCriticalList(warningList); // Renders both warnings and critical
        renderLateList(lateList);
        
        document.getElementById('statCritical').innerText = criticalList.length;
        document.getElementById('criticalCount').innerText = `${criticalList.length} critical / ${warningList.length} total warnings`;
        document.getElementById('lateArrivalCount').innerText = `${lateList.length} students`;
    }

    function renderPieChart(stats) {
        const ctx = document.getElementById('attendancePieChart')?.getContext('2d');
        if (!ctx) return;
        if (state.pieChart) state.pieChart.destroy();
        state.pieChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Present', 'Late', 'Absent', 'Excused'],
                datasets: [{
                    data: [stats.present, stats.late, stats.absent, stats.excused],
                    backgroundColor: ['#10b981', '#f59e0b', '#ef4444', '#6366f1'],
                    borderWidth: 0,
                    hoverOffset: 10
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '70%',
                plugins: { legend: { position: 'bottom', labels: { usePointStyle: true, padding: 20, font: { size: 10, weight: 'bold' } } } }
            }
        });
    }

    function renderTrendChart(data) {
        const ctx = document.getElementById('attendanceTrendChart')?.getContext('2d');
        if (!ctx) return;
        if (state.trendChart) state.trendChart.destroy();

        // Group by date
        const daily = data.reduce((acc, curr) => {
            const date = new Date(curr.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            if (!acc[date]) acc[date] = { present: 0, total: 0 };
            if (curr.status === 'present' || curr.status === 'late') acc[date].present++;
            acc[date].total++;
            return acc;
        }, {});

        const labels = Object.keys(daily).slice(-7);
        const values = labels.map(l => Math.round((daily[l].present / daily[l].total) * 100));

        state.trendChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels,
                datasets: [{
                    label: 'Attendance %',
                    data: values,
                    borderColor: '#10b981',
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    fill: true,
                    tension: 0.4,
                    pointRadius: 4,
                    pointBackgroundColor: '#10b981'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    y: { min: 0, max: 100, grid: { color: '#f3f4f6' }, ticks: { callback: v => v + '%' } },
                    x: { grid: { display: false } }
                }
            }
        });
    }

    function renderClinicChart(stats) {
        const ctx = document.getElementById('clinicBarChart')?.getContext('2d');
        if (!ctx) return;
        if (state.barChart) state.barChart.destroy();
        state.barChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: Object.keys(stats),
                datasets: [{
                    data: Object.values(stats),
                    backgroundColor: '#ef4444',
                    borderRadius: 6,
                    barThickness: 20
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                indexAxis: 'y',
                plugins: { legend: { display: false } },
                scales: {
                    x: { grid: { display: false }, ticks: { stepSize: 1 } },
                    y: { grid: { display: false } }
                }
            }
        });
    }

    function renderClassChart(data) {
        const ctx = document.getElementById('classPerformanceChart')?.getContext('2d');
        if (!ctx) return;
        if (state.classChart) state.classChart.destroy();

        const classStats = data.reduce((acc, curr) => {
            const cls = curr.students?.class_id || 'Unknown';
            if (!acc[cls]) acc[cls] = { present: 0, total: 0 };
            if (curr.status === 'present' || curr.status === 'late') acc[cls].present++;
            acc[cls].total++;
            return acc;
        }, {});

        const sorted = Object.entries(classStats)
            .map(([name, s]) => ({ name, rate: Math.round((s.present / s.total) * 100) }))
            .sort((a, b) => b.rate - a.rate)
            .slice(0, 5);

        state.classChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: sorted.map(s => s.name.replace('CLS-', '')),
                datasets: [{
                    data: sorted.map(s => s.rate),
                    backgroundColor: '#6366f1',
                    borderRadius: 6,
                    barThickness: 25
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    y: { min: 0, max: 100, ticks: { callback: v => v + '%' } },
                    x: { grid: { display: false } }
                }
            }
        });
    }

    function renderCriticalList(students) {
        const list = document.getElementById('criticalAbsencesList');
        if (!list) return;

        if (students.length === 0) {
            list.innerHTML = `
                <div class="flex flex-col items-center justify-center py-8 text-gray-400">
                    <i data-lucide="check-circle" class="w-12 h-12 mb-2 text-green-100"></i>
                    <p class="text-sm">No critical absences recorded</p>
                </div>
            `;
        } else {
            list.innerHTML = students.map(s => {
                const isCritical = s.absentCount >= 20;
                return `
                    <div class="flex items-center justify-between p-4 ${isCritical ? 'bg-red-50 border-red-100' : 'bg-orange-50 border-orange-100'} rounded-xl border">
                        <div class="flex items-center space-x-3">
                            <div class="w-10 h-10 rounded-full ${isCritical ? 'bg-red-100 text-red-600' : 'bg-orange-100 text-orange-600'} flex items-center justify-center font-bold">
                                ${s.name[0]}
                            </div>
                            <div>
                                <div class="flex items-center space-x-2">
                                    <p class="text-sm font-bold text-gray-900">${s.name}</p>
                                    <span class="px-2 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider ${isCritical ? 'bg-red-600 text-white' : 'bg-orange-500 text-white'}">
                                        ${isCritical ? 'Critical' : 'Warning'}
                                    </span>
                                </div>
                                <p class="text-xs text-gray-500">Grade ${s.grade}</p>
                            </div>
                        </div>
                        <div class="text-right">
                            <p class="${isCritical ? 'text-red-600' : 'text-orange-600'} font-bold">${s.absentCount}</p>
                            <p class="text-[10px] text-gray-400 uppercase font-bold">Absences</p>
                        </div>
                    </div>
                `;
            }).join('');
        }
        if (window.lucide) window.lucide.createIcons();
    }

    function renderLateList(students) {
        const list = document.getElementById('frequentLateList');
        if (!list) return;

        if (students.length === 0) {
            list.innerHTML = `
                <div class="flex flex-col items-center justify-center py-8 text-gray-400">
                    <i data-lucide="check-circle" class="w-12 h-12 mb-2 text-green-100"></i>
                    <p class="text-sm">No frequent late arrivals</p>
                </div>
            `;
        } else {
            list.innerHTML = students.map(s => `
                <div class="flex items-center justify-between p-4 bg-yellow-50 rounded-xl border border-yellow-100">
                    <div class="flex items-center space-x-3">
                        <div class="w-10 h-10 rounded-full bg-yellow-100 flex items-center justify-center text-yellow-600 font-bold">
                            ${s.name[0]}
                        </div>
                        <div>
                            <p class="text-sm font-bold text-gray-900">${s.name}</p>
                            <p class="text-xs text-gray-500">Grade ${s.grade}</p>
                        </div>
                    </div>
                    <div class="text-right">
                        <p class="text-yellow-600 font-bold">${s.lateCount}</p>
                        <p class="text-[10px] text-yellow-500 uppercase font-bold">Times Late</p>
                    </div>
                </div>
            `).join('');
        }
        if (window.lucide) window.lucide.createIcons();
    }

    function exportToCSV() {
        if (state.attendanceData.length === 0) {
            return utils.showNotification('No data available to export', 'warning');
        }

        const headers = ['Student Name', 'Grade', 'Status', 'Date', 'Time'];
        const rows = state.attendanceData.map(a => [
            a.students?.full_name || 'Unknown',
            a.students?.grade_level || '?',
            a.status,
            new Date(a.timestamp).toLocaleDateString(),
            new Date(a.timestamp).toLocaleTimeString()
        ]);

        let csvContent = "data:text/csv;charset=utf-8," 
            + headers.join(",") + "\n"
            + rows.map(e => e.join(",")).join("\n");

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `educare_attendance_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        utils.showNotification('CSV Exported successfully!', 'success');
    }
});
