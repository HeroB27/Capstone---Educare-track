import supabase from './supabase-config.js';
import { utils } from './utils.js';

document.addEventListener('DOMContentLoaded', async () => {
    // Check access
    utils.checkAccess(['parent', 'admin']);

    const state = {
        user: utils.getCurrentUser(),
        children: [],
        sections: {
            'child-status': document.getElementById('childStatusSection'),
            'history': document.getElementById('historySection'),
            'excuse': document.getElementById('excuseSection'),
            'notifications': document.getElementById('notificationsSection')
        }
    };

    // Initialize UI
    initializeSidebar();
    await fetchChildren();
    initializeRealtime();

    function initializeSidebar() {
        const navLinks = document.querySelectorAll('.nav-link');
        const sectionTitle = document.getElementById('sectionTitle');
        
        navLinks.forEach(link => {
            link.addEventListener('click', () => {
                const section = link.dataset.section;
                navLinks.forEach(l => {
                    l.classList.remove('bg-green-50', 'text-green-600');
                    l.classList.add('text-gray-600', 'hover:bg-gray-50');
                });
                link.classList.add('bg-green-50', 'text-green-600');
                link.classList.remove('text-gray-600', 'hover:bg-gray-50');

                Object.values(state.sections).forEach(s => s?.classList.add('hidden'));
                state.sections[section]?.classList.remove('hidden');
                sectionTitle.innerText = link.querySelector('span').innerText;

                if (section === 'history') renderCalendar();
            });
        });

        document.getElementById('logoutBtn').addEventListener('click', utils.logout);
        document.getElementById('logoutBtnMobile').addEventListener('click', utils.logout);
    }

    async function fetchChildren() {
        try {
            const { data, error } = await supabase
                .from('parent_students')
                .select('student_id, students(*)')
                .eq('parent_id', state.user.id);

            if (error) throw error;
            state.children = data.map(d => d.students);
            renderChildren();
            populateExcuseDropdown();
        } catch (err) {
            console.error('Error fetching children:', err);
        }
    }

    function renderChildren() {
        const grid = document.getElementById('childrenGrid');
        grid.innerHTML = state.children.map(c => `
            <div class="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col items-center text-center">
                <div class="w-20 h-20 rounded-full bg-green-50 flex items-center justify-center text-green-600 font-bold text-2xl mb-4 border-2 border-green-100">
                    ${c.full_name[0]}
                </div>
                <h3 class="text-xl font-bold text-gray-900 mb-1">${c.full_name}</h3>
                <p class="text-sm text-gray-500 mb-4">Grade ${c.grade_level} ${c.strand || ''}</p>
                
                <div class="w-full pt-4 border-t border-gray-50 flex justify-between items-center">
                    <span class="text-sm font-medium text-gray-400 uppercase tracking-wider">Status</span>
                    <span class="px-3 py-1 rounded-full text-xs font-bold uppercase ${
                        c.current_status === 'present' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                    }">${c.current_status === 'present' ? 'Inside School' : 'Outside'}</span>
                </div>
                
                <div class="w-full mt-4 flex items-center space-x-2 text-xs text-gray-400">
                    <i data-lucide="clock" class="w-4 h-4"></i>
                    <span>Last updated: ${utils.formatTime(new Date())}</span>
                </div>
            </div>
        `).join('');
        lucide.createIcons();
    }

    function populateExcuseDropdown() {
        const select = document.getElementById('excuseChild');
        if (!select) return;
        select.innerHTML = state.children.map(c => `<option value="${c.id}">${c.full_name}</option>`).join('');
    }

    async function renderCalendar() {
        const grid = document.getElementById('calendarGrid');
        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        
        let html = days.map(d => `<div class="text-center text-xs font-bold text-gray-400 py-2">${d}</div>`).join('');
        
        const date = new Date();
        const year = date.getFullYear();
        const month = date.getMonth();
        const firstDay = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();

        // Fetch real attendance for all children this month
        const startOfMonth = new Date(year, month, 1).toISOString();
        const endOfMonth = new Date(year, month + 1, 0).toISOString();
        
        const { data: attendance } = await supabase
            .from('attendance')
            .select('*')
            .in('student_id', state.children.map(c => c.id))
            .gte('timestamp', startOfMonth)
            .lte('timestamp', endOfMonth);

        const attendanceByDay = (attendance || []).reduce((acc, curr) => {
            const day = new Date(curr.timestamp).getDate();
            if (!acc[day] || curr.status === 'absent' || curr.status === 'late') {
                acc[day] = curr.status;
            }
            return acc;
        }, {});

        for (let i = 0; i < firstDay; i++) {
            html += `<div class="h-12"></div>`;
        }

        for (let d = 1; d <= daysInMonth; d++) {
            const isToday = d === date.getDate();
            const status = attendanceByDay[d] || 'none';
            const color = status === 'present' ? 'bg-green-500' : 
                          status === 'late' ? 'bg-yellow-500' : 
                          status === 'absent' ? 'bg-red-500' : 'bg-transparent';
            
            html += `
                <div class="h-12 flex flex-col items-center justify-center relative rounded-lg hover:bg-gray-50 transition-all cursor-pointer">
                    <span class="text-sm font-medium ${isToday ? 'text-green-600 font-bold' : 'text-gray-700'}">${d}</span>
                    <span class="w-1.5 h-1.5 ${color} rounded-full mt-1"></span>
                </div>
            `;
        }
        
        grid.innerHTML = html;
    }

    function initializeRealtime() {
        supabase.channel('public:students')
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'students' }, payload => {
                const updatedChild = state.children.find(c => c.id === payload.new.id);
                if (updatedChild) {
                    Object.assign(updatedChild, payload.new);
                    renderChildren();
                    utils.showNotification(`Attendance status updated for ${updatedChild.full_name}`, 'info');
                }
            }).subscribe();
        supabase.channel('public:notifications')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, payload => {
                const n = payload.new;
                if (n.target_users && n.target_users.includes(state.user.id)) {
                    renderNotifications([n], true);
                    utils.showNotification('New notification received', 'success');
                }
            }).subscribe();
    }

    // Excuse Letter Logic
    document.getElementById('submitExcuse').addEventListener('click', async () => {
        const childId = document.getElementById('excuseChild').value;
        const reason = document.getElementById('excuseReason').value;
        const file = document.getElementById('excuseFile').files[0];

        if (!reason) return utils.showNotification('Please provide a reason', 'error');

        try {
            const { error } = await supabase.from('excuse_letters').insert([{
                student_id: childId,
                parent_id: state.user.id,
                reason: reason,
                status: 'pending'
            }]);

            if (error) throw error;

            utils.showNotification('Excuse letter submitted successfully!', 'success');
            document.getElementById('excuseReason').value = '';
        } catch (err) {
            utils.showNotification(err.message, 'error');
        }
    });

    // Notifications
    async function fetchNotifications() {
        const { data } = await supabase
            .from('notifications')
            .select('*')
            .contains('target_users', [state.user.id])
            .order('created_at', { ascending: false })
            .limit(20);
        renderNotifications(data || []);
    }
    function renderNotifications(list, prepend = false) {
        const box = document.getElementById('notificationsList');
        if (!box) return;
        if ((list || []).length === 0 && !prepend) {
            box.innerHTML = '<p class="text-gray-400 text-sm text-center py-10">No notifications</p>';
            return;
        }
        const items = (list || []).map(n => `
            <div class="flex items-center justify-between p-2 bg-white rounded-lg border border-gray-50">
                <div class="flex items-center space-x-2">
                    <span class="w-2 h-2 rounded-full ${n.read_by && n.read_by.includes(state.user.id) ? 'bg-gray-300' : 'bg-green-500'}"></span>
                    <span class="text-xs text-gray-500">${utils.formatTime(n.created_at)}</span>
                </div>
                <div class="flex-1 ml-3">
                    <p class="text-sm font-medium text-gray-900">${n.title}</p>
                    <p class="text-xs text-gray-500">${n.message}</p>
                </div>
                <button class="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded hover:bg-gray-200" onclick="markRead('${n.id}')">Mark read</button>
            </div>
        `).join('');
        if (prepend) {
            box.innerHTML = items + box.innerHTML;
        } else {
            box.innerHTML = items;
        }
    }
    window.markRead = async (id) => {
        await supabase.from('notifications').update({ read_by: supabase.raw('array_append(read_by, ?)', [state.user.id]) }).eq('id', id);
    };
    document.getElementById('markAllRead')?.addEventListener('click', async () => {
        await supabase.from('notifications').update({ read_by: supabase.raw('array_append(read_by, ?)', [state.user.id]) }).contains('target_users', [state.user.id]);
        fetchNotifications();
    });

    // Initial load for notifications
    fetchNotifications();
});
