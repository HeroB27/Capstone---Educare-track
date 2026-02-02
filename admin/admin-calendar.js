const supabase = window.supabaseClient;
const utils = window.utils;

document.addEventListener('DOMContentLoaded', async () => {
    await utils.checkAccess(['admin']);
    utils.renderAdminLayout('calendar');

    const modal = document.getElementById('eventModal');
    const form = document.getElementById('eventForm');
    const tbody = document.getElementById('calendarTableBody');

    // Load initial data
    fetchCalendar();

    // Event listeners
    document.getElementById('addEventBtn').addEventListener('click', () => {
        form.reset();
        modal.classList.remove('hidden');
    });

    document.querySelectorAll('.close-modal').forEach(btn => {
        btn.addEventListener('click', () => modal.classList.add('hidden'));
    });

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        await saveEvent();
    });

    async function fetchCalendar() {
        try {
            const { data, error } = await supabase
                .from('school_calendar')
                .select('*')
                .order('start_date', { ascending: false });

            if (error) throw error;
            renderCalendar(data);
        } catch (err) {
            console.error('Error fetching calendar:', err);
            utils.showNotification('Failed to load calendar', 'error');
        }
    }

    function renderCalendar(events) {
        if (!tbody) return;
        
        if (events.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" class="px-6 py-12 text-center text-gray-500 italic">No calendar entries found</td></tr>`;
            return;
        }

        tbody.innerHTML = events.map(e => `
            <tr class="border-b border-gray-50 hover:bg-gray-50 transition-all">
                <td class="px-6 py-4">
                    <p class="font-bold text-gray-900">${e.title}</p>
                    <p class="text-xs text-gray-500">${e.notes || ''}</p>
                </td>
                <td class="px-6 py-4">
                    <span class="px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        e.type === 'holiday' ? 'bg-green-100 text-green-700' :
                        e.type === 'suspension' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'
                    }">${e.type}</span>
                </td>
                <td class="px-6 py-4 text-sm text-gray-600">
                    ${utils.formatDate(e.start_date)} - ${utils.formatDate(e.end_date)}
                </td>
                <td class="px-6 py-4">
                    <span class="text-xs font-medium text-gray-500 uppercase tracking-widest">${e.grade_scope || 'all'}</span>
                </td>
                <td class="px-6 py-4">
                    <button onclick="deleteEvent('${e.id}')" class="p-2 text-gray-400 hover:text-red-600 transition-all">
                        <i data-lucide="trash-2" class="w-5 h-5"></i>
                    </button>
                </td>
            </tr>
        `).join('');
        
        if (window.lucide) window.lucide.createIcons();
    }

    async function saveEvent() {
        const payload = {
            title: document.getElementById('eventTitle').value,
            type: document.getElementById('eventType').value,
            start_date: document.getElementById('startDate').value,
            end_date: document.getElementById('endDate').value,
            grade_scope: document.getElementById('gradeScope').value,
            notes: document.getElementById('eventNotes').value,
            created_by: (utils.getCurrentUser()).id
        };

        try {
            const { error } = await supabase.from('school_calendar').insert([payload]);
            if (error) throw error;

            utils.showNotification('Calendar entry saved!', 'success');
            modal.classList.add('hidden');
            fetchCalendar();
        } catch (err) {
            utils.showNotification(err.message, 'error');
        }
    }

    window.deleteEvent = async (id) => {
        if (!confirm('Delete this entry?')) return;
        try {
            const { error } = await supabase.from('school_calendar').delete().eq('id', id);
            if (error) throw error;
            utils.showNotification('Entry deleted', 'success');
            fetchCalendar();
        } catch (err) {
            utils.showNotification(err.message, 'error');
        }
    };
});
