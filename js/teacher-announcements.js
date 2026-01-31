import supabase from './supabase-config.js';
import { utils } from './utils.js';

document.addEventListener('DOMContentLoaded', async () => {
    utils.checkAccess(['teacher', 'admin']);
    utils.renderTeacherLayout('announcements');

    const state = {
        user: utils.getCurrentUser(),
        announcements: []
    };

    fetchAnnouncements();

    // Event Listeners
    document.getElementById('newAnnBtn')?.addEventListener('click', () => {
        document.getElementById('annModal').classList.remove('hidden');
    });

    const modal = document.getElementById('annModal');
    document.querySelectorAll('.close-ann-modal').forEach(btn => btn.addEventListener('click', () => modal.classList.add('hidden')));

    document.getElementById('annForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const title = document.getElementById('annTitle').value;
        const message = document.getElementById('annMessage').value;
        const priority = document.getElementById('annPriority').value;

        try {
            utils.showNotification('Posting announcement...', 'info');
            
            const { error } = await supabase.from('announcements').insert([{
                title,
                message,
                priority,
                audience: ['parents'], // Automatically target parents
                created_by: state.user.id
            }]);

            if (error) throw error;

            utils.showNotification('Announcement posted successfully!', 'success');
            modal.classList.add('hidden');
            document.getElementById('annForm').reset();
            fetchAnnouncements();

        } catch (err) {
            console.error('Post announcement error:', err);
            utils.showNotification(err.message, 'error');
        }
    });

    async function fetchAnnouncements() {
        try {
            const { data, error } = await supabase
                .from('announcements')
                .select('*')
                .eq('created_by', state.user.id)
                .order('created_at', { ascending: false });

            if (error) throw error;
            state.announcements = data || [];
            renderAnnouncements();
        } catch (err) {
            console.error('Fetch announcements error:', err);
        }
    }

    function renderAnnouncements() {
        const list = document.getElementById('announcementList');
        if (state.announcements.length === 0) {
            list.innerHTML = '<div class="py-20 text-center text-gray-400 italic">No class announcements posted yet.</div>';
            return;
        }

        list.innerHTML = state.announcements.map(a => `
            <div class="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm relative group">
                <div class="flex justify-between items-start mb-4">
                    <span class="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        a.priority === 'high' ? 'bg-red-100 text-red-700' :
                        a.priority === 'medium' ? 'bg-yellow-100 text-yellow-700' : 'bg-blue-100 text-blue-700'
                    }">${a.priority} Priority</span>
                    <button onclick="deleteAnnouncement('${a.id}')" class="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100">
                        <i data-lucide="trash-2" class="w-4 h-4"></i>
                    </button>
                </div>
                <h4 class="text-lg font-bold text-gray-900 mb-2">${a.title}</h4>
                <p class="text-sm text-gray-600 mb-4 whitespace-pre-wrap">${a.message}</p>
                <div class="flex items-center text-[10px] text-gray-400 font-bold uppercase tracking-widest">
                    <i data-lucide="calendar" class="w-3 h-3 mr-1"></i>
                    <span>Posted on ${utils.formatDate(a.created_at)}</span>
                </div>
            </div>
        `).join('');
        if (window.lucide) window.lucide.createIcons();
    }

    window.deleteAnnouncement = async (id) => {
        if (!confirm('Are you sure you want to delete this announcement?')) return;
        try {
            const { error } = await supabase.from('announcements').delete().eq('id', id);
            if (error) throw error;
            utils.showNotification('Announcement deleted', 'success');
            fetchAnnouncements();
        } catch (err) {
            utils.showNotification(err.message, 'error');
        }
    };
});