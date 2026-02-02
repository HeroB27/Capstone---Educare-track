const supabase = window.supabaseClient;
const utils = window.utils;

document.addEventListener('DOMContentLoaded', async () => {
    // Check access
    await utils.checkAccess(['admin']);

    // Render Layout
    utils.renderAdminLayout('announcements');

    const user = utils.getCurrentUser();
    const annModal = document.getElementById('announcementModal');
    const createAnnBtn = document.getElementById('createAnnouncementBtn');
    const annForm = document.getElementById('announcementForm');
    const closeAnnBtns = document.querySelectorAll('.close-announcement-modal');

    // Fetch and render announcements
    fetchAnnouncements();

    // Event Listeners
    createAnnBtn?.addEventListener('click', () => annModal.classList.remove('hidden'));
    
    closeAnnBtns.forEach(btn => btn.addEventListener('click', () => {
        annModal.classList.add('hidden');
        annForm.reset();
    }));

    annForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        await submitAnnouncement();
    });

    async function fetchAnnouncements() {
        try {
            const { data, error } = await supabase
                .from('announcements')
                .select('*, profiles:posted_by(full_name)')
                .order('is_pinned', { ascending: false })
                .order('created_at', { ascending: false });

            if (error) throw error;
            renderAnnouncements(data);
        } catch (err) {
            console.error('Error fetching announcements:', err);
            utils.showNotification('Failed to load announcements', 'error');
        }
    }

    function renderAnnouncements(anns) {
        const list = document.getElementById('announcementsList');
        if (!list) return;

        if (anns.length === 0) {
            list.innerHTML = `
                <div class="bg-white p-12 rounded-2xl border border-gray-100 text-center">
                    <div class="bg-violet-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                        <i data-lucide="megaphone" class="text-violet-600 w-8 h-8"></i>
                    </div>
                    <h3 class="text-lg font-bold text-gray-900">No Announcements Yet</h3>
                    <p class="text-gray-500">Create your first announcement to notify the school community.</p>
                </div>
            `;
            utils.renderAdminLayout('announcements'); // Re-run to fix icons
            return;
        }

        list.innerHTML = anns.map(a => `
            <div class="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-all relative">
                ${a.is_pinned ? `
                    <div class="absolute -top-2 -right-2 bg-amber-500 text-white p-1.5 rounded-lg shadow-lg z-10">
                        <i data-lucide="pin" class="w-3 h-3"></i>
                    </div>
                ` : ''}
                <div class="flex justify-between items-start mb-4">
                    <div>
                        <h4 class="text-lg font-bold text-gray-900">${a.title}</h4>
                        <span class="text-xs text-gray-400">${utils.formatDate(a.created_at)} at ${utils.formatTime(a.created_at)}</span>
                    </div>
                    <div class="flex space-x-2">
                        <button onclick="togglePinAnnouncement('${a.id}', ${!a.is_pinned})" class="text-gray-400 hover:text-amber-500 transition-all p-2 hover:bg-amber-50 rounded-lg" title="${a.is_pinned ? 'Unpin Announcement' : 'Pin Announcement'}">
                            <i data-lucide="${a.is_pinned ? 'pin-off' : 'pin'}" class="w-5 h-5"></i>
                        </button>
                        <button onclick="deleteAnnouncement('${a.id}')" class="text-gray-400 hover:text-red-600 transition-all p-2 hover:bg-red-50 rounded-lg">
                            <i data-lucide="trash-2" class="w-5 h-5"></i>
                        </button>
                    </div>
                </div>
                <p class="text-gray-600 mb-6 whitespace-pre-wrap">${a.content}</p>
                <div class="flex flex-wrap gap-2 pt-4 border-t border-gray-50">
                    <span class="text-[10px] font-bold text-gray-400 uppercase tracking-widest mr-2">Target:</span>
                    ${a.audience.map(aud => `
                        <span class="px-3 py-1 bg-violet-50 text-violet-600 rounded-full text-[10px] font-bold uppercase tracking-wider border border-violet-100">${aud}</span>
                    `).join('')}
                </div>
            </div>
        `).join('');
        
        if (window.lucide) {
            window.lucide.createIcons();
        }
    }

    async function submitAnnouncement() {
        const title = document.getElementById('announcementTitle').value;
        const content = document.getElementById('announcementMessage').value;
        const audience = Array.from(document.querySelectorAll('input[name="audience"]:checked')).map(cb => cb.value);

        if (audience.length === 0) {
            return utils.showNotification('Please select at least one target audience', 'error');
        }

        try {
            const { error } = await supabase.from('announcements').insert([{
                title,
                content,
                audience,
                posted_by: user.id,
                is_pinned: false
            }]);

            if (error) throw error;

            utils.showNotification('Announcement published successfully!', 'success');
            annModal.classList.add('hidden');
            annForm.reset();
            fetchAnnouncements();
        } catch (err) {
            console.error('Error submitting announcement:', err);
            utils.showNotification(err.message, 'error');
        }
    }

    window.togglePinAnnouncement = async (id, isPinned) => {
        try {
            const { error } = await supabase
                .from('announcements')
                .update({ is_pinned: isPinned })
                .eq('id', id);

            if (error) throw error;

            utils.showNotification(isPinned ? 'Announcement pinned' : 'Announcement unpinned', 'success');
            fetchAnnouncements();
        } catch (err) {
            console.error('Error updating announcement priority:', err);
            utils.showNotification(err.message, 'error');
        }
    };

    // Expose delete function to window for the onclick handler
    window.deleteAnnouncement = async (id) => {
        if (!confirm('Are you sure you want to delete this announcement?')) return;

        try {
            const { error } = await supabase
                .from('announcements')
                .delete()
                .eq('id', id);

            if (error) throw error;
            
            utils.showNotification('Announcement deleted', 'success');
            fetchAnnouncements();
        } catch (err) {
            console.error('Error deleting announcement:', err);
            utils.showNotification(err.message, 'error');
        }
    };
});

