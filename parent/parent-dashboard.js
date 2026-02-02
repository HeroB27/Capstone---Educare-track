const supabase = window.supabaseClient;
const utils = window.utils;

document.addEventListener('DOMContentLoaded', async () => {
    // Check access
    await utils.checkAccess(['parent', 'admin']);

    // State
    const state = {
        user: utils.getCurrentUser(),
        children: [],
        notifications: []
    };

    // Initialize UI
    utils.renderParentLayout('dashboard');
    document.getElementById('parentName').innerText = state.user?.full_name || 'Guardian';

    // Initialize UI
    initializeSidebar();
    await fetchChildren();
    fetchAnnouncements();
    initializeRealtime();

    function initializeSidebar() {
        // Sidebar logic if any
    }

    async function fetchChildren() {
        try {
            // 1. Get student links
            const { data: links, error: lErr } = await supabase
                .from('parent_students')
                .select('student_id')
                .eq('parent_id', state.user.id);

            if (lErr) throw lErr;
            if (!links || links.length === 0) {
                renderNoChildren();
                return;
            }

            // 2. Get student details & attendance
            const studentIds = links.map(l => l.student_id);
            const { data: children, error: sErr } = await supabase
                .from('students')
                .select('*, attendance(*)')
                .in('id', studentIds);

            if (sErr) throw sErr;
            state.children = children;
            renderChildren();

        } catch (err) {
            console.error('Error fetching children:', err);
        }
    }

    function renderChildren() {
        const grid = document.getElementById('childrenGrid');
        grid.innerHTML = state.children.map(child => {
            const today = new Date().toISOString().split('T')[0];
            const todayLogs = (child.attendance || []).filter(a => a.timestamp.startsWith(today));
            const latestStatus = todayLogs.length > 0 ? todayLogs[0].status : 'not_arrived';

            return `
                <div class="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm hover:shadow-md transition-all group">
                    <div class="flex items-center space-x-4 mb-6">
                        <div class="w-16 h-16 rounded-2xl bg-green-50 flex items-center justify-center text-green-600 font-black text-2xl shadow-sm group-hover:bg-green-600 group-hover:text-white transition-all">
                            ${child.full_name[0]}
                        </div>
                        <div>
                            <h4 class="text-xl font-black text-gray-900">${child.full_name}</h4>
                            <p class="text-xs text-gray-400 font-bold uppercase tracking-widest">Grade ${child.grade_level} ${child.strand || ''}</p>
                        </div>
                    </div>

                    <div class="grid grid-cols-2 gap-4 mb-6">
                        <div class="p-4 bg-gray-50 rounded-2xl border border-gray-100">
                            <p class="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Gate Status</p>
                            <span class="px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest ${
                                latestStatus === 'present' ? 'bg-green-100 text-green-700' :
                                latestStatus === 'late' ? 'bg-amber-100 text-amber-700' :
                                'bg-gray-100 text-gray-400'
                            }">${latestStatus.replace('_', ' ')}</span>
                        </div>
                        <div class="p-4 bg-gray-50 rounded-2xl border border-gray-100">
                            <p class="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Last Update</p>
                            <p class="text-xs font-black text-gray-900">${todayLogs.length > 0 ? new Date(todayLogs[0].timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}</p>
                        </div>
                    </div>

                    <button class="w-full py-4 bg-gray-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-black transition-all shadow-lg shadow-gray-100">
                        View Full History
                    </button>
                </div>
            `;
        }).join('');
    }

    function renderNoChildren() {
        document.getElementById('childrenGrid').innerHTML = `
            <div class="col-span-full flex flex-col items-center justify-center py-20 bg-white rounded-3xl border-2 border-dashed border-gray-100">
                <div class="bg-gray-50 p-4 rounded-full mb-4">
                    <i data-lucide="user-minus" class="text-gray-300 w-12 h-12"></i>
                </div>
                <p class="text-gray-500 font-bold">No students linked to your account</p>
                <p class="text-xs text-gray-400 mt-1">Please contact the administrator to link your child's ID</p>
            </div>
        `;
        if (window.lucide) window.lucide.createIcons();
    }

    async function fetchAnnouncements() {
        const list = document.getElementById('schoolAnnouncements');
        if (!list) return;

        try {
            const { data: anns } = await supabase
                .from('announcements')
                .select('*')
                .contains('audience', ['parent'])
                .order('is_pinned', { ascending: false })
                .order('created_at', { ascending: false })
                .limit(5);

            if (anns && anns.length > 0) {
                list.innerHTML = anns.map(a => `
                    <div class="p-4 bg-gray-50 rounded-2xl border border-gray-100 hover:bg-white hover:border-green-100 transition-all group relative overflow-hidden">
                        ${a.is_pinned ? `
                            <div class="absolute top-0 right-0 p-2">
                                <i data-lucide="pin" class="text-green-600 w-3 h-3 fill-green-600"></i>
                            </div>
                        ` : ''}
                        <h4 class="text-xs font-black text-gray-900 mb-1 group-hover:text-green-600 transition-colors">${a.title}</h4>
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

    function initializeRealtime() {
        supabase
            .channel('parent_updates')
            .on('postgres_changes', { event: '*', table: 'attendance' }, () => {
                fetchChildren();
            })
            .subscribe();

        supabase
            .channel('parent_notifications')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, (payload) => {
                if (payload?.new?.recipient_id === state.user.id) {
                    fetchNotifications();
                    utils.showNotification('New notification received', 'success');
                }
            })
            .subscribe();
    }

    // Initial load for notifications
    fetchNotifications();

    async function fetchNotifications() {
        try {
            const { data, error } = await supabase
                .from('notifications')
                .select('id, verb, object, created_at, read')
                .eq('recipient_id', state.user.id)
                .order('created_at', { ascending: false })
                .limit(20);

            if (error) throw error;
            state.notifications = data || [];
            renderNotifications();
        } catch (err) {
            console.error('Error fetching notifications:', err);
        }
    }

    function renderNotifications() {
        const list = document.getElementById('notificationsList');
        if (!list) return;

        if (!state.notifications || state.notifications.length === 0) {
            list.innerHTML = `
                <div class="flex flex-col items-center justify-center py-10 text-gray-400">
                    <i data-lucide="bell-off" class="w-10 h-10 mb-2 opacity-20"></i>
                    <p class="text-[10px] font-black uppercase tracking-widest">No notifications</p>
                </div>
            `;
            if (window.lucide) window.lucide.createIcons();
            return;
        }

        list.innerHTML = state.notifications.map(n => `
            <div class="p-4 rounded-2xl border transition-all ${n.read ? 'bg-white border-gray-100' : 'bg-green-50 border-green-100'}">
                <div class="flex items-start justify-between space-x-3">
                    <div class="flex-1">
                        <p class="text-[10px] font-black uppercase tracking-widest ${n.read ? 'text-gray-400' : 'text-green-700'}">${n.verb}</p>
                        <p class="text-xs text-gray-700 font-medium mt-1 break-words">${JSON.stringify(n.object || {})}</p>
                        <p class="text-[8px] text-gray-400 font-bold uppercase tracking-widest mt-2">${utils.formatDate(n.created_at)} • ${utils.formatTime(n.created_at)}</p>
                    </div>
                    ${n.read ? '' : `
                        <button onclick="markNotificationRead('${n.id}')" class="text-[10px] font-black uppercase tracking-widest text-green-700 hover:text-green-800 transition-all whitespace-nowrap">
                            Mark read
                        </button>
                    `}
                </div>
            </div>
        `).join('');
    }

    window.markNotificationRead = async (id) => {
        try {
            const { error } = await supabase
                .from('notifications')
                .update({ read: true })
                .eq('id', id)
                .eq('recipient_id', state.user.id);

            if (error) throw error;
            fetchNotifications();
        } catch (err) {
            console.error('Mark notification read error:', err);
        }
    };

    document.getElementById('markAllNotificationsRead')?.addEventListener('click', async () => {
        try {
            const { error } = await supabase
                .from('notifications')
                .update({ read: true })
                .eq('recipient_id', state.user.id)
                .eq('read', false);

            if (error) throw error;
            fetchNotifications();
        } catch (err) {
            console.error('Mark all notifications read error:', err);
        }
    });
});
