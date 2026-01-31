import supabase from './supabase-config.js';
import { utils } from './utils.js';

document.addEventListener('DOMContentLoaded', async () => {
    // Check access
    utils.checkAccess(['admin']);

    // Render Layout
    utils.renderAdminLayout('calendar');

    const calendarForm = document.getElementById('calendarForm');
    
    // Fetch and render calendar
    fetchCalendar();

    // Event Listeners
    calendarForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        await submitCalendarEvent();
    });

    async function fetchCalendar() {
        try {
            const { data, error } = await supabase
                .from('school_calendar')
                .select('*')
                .gte('end_date', new Date().toISOString().split('T')[0])
                .order('start_date', { ascending: true });

            if (error) throw error;
            renderCalendar(data);
        } catch (err) {
            console.error('Error fetching calendar:', err);
            utils.showNotification('Failed to load calendar events', 'error');
        }
    }

    function renderCalendar(events) {
        const list = document.getElementById('calendarList');
        if (!list) return;

        if (events.length === 0) {
            list.innerHTML = `
                <div class="flex flex-col items-center justify-center py-20 text-center text-gray-400">
                    <i data-lucide="calendar-off" class="w-16 h-16 mb-4 opacity-20"></i>
                    <h3 class="text-lg font-bold text-gray-900">No Upcoming Events</h3>
                    <p>School schedule is clear for now.</p>
                </div>
            `;
            if (window.lucide) window.lucide.createIcons();
            return;
        }

        list.innerHTML = events.map(e => `
            <div class="flex items-center space-x-6 p-6 bg-gray-50/50 rounded-2xl border border-gray-100 hover:bg-white hover:shadow-md transition-all group">
                <div class="w-16 h-16 rounded-2xl flex flex-col items-center justify-center font-bold shadow-sm ${
                    e.type === 'holiday' ? 'bg-red-100 text-red-600' :
                    e.type === 'suspension' ? 'bg-yellow-100 text-yellow-600' : 'bg-blue-100 text-blue-600'
                }">
                    <span class="text-[10px] uppercase tracking-widest">${new Date(e.start_date).toLocaleString('default', { month: 'short' })}</span>
                    <span class="text-2xl">${new Date(e.start_date).getDate()}</span>
                </div>
                <div class="flex-1">
                    <div class="flex items-center space-x-2 mb-1">
                        <h4 class="font-bold text-gray-900 text-lg">${e.title}</h4>
                        <span class="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                            e.type === 'holiday' ? 'bg-red-50 text-red-700' :
                            e.type === 'suspension' ? 'bg-yellow-50 text-yellow-700' : 'bg-blue-50 text-blue-700'
                        }">${e.type}</span>
                    </div>
                    <p class="text-sm text-gray-500 flex items-center space-x-2">
                        <i data-lucide="clock" class="w-4 h-4"></i>
                        <span>${utils.formatDate(e.start_date)} ${e.end_date !== e.start_date ? ` - ${utils.formatDate(e.end_date)}` : ''}</span>
                    </p>
                    ${e.notes ? `<p class="text-xs text-gray-400 mt-2 italic">Note: ${e.notes}</p>` : ''}
                </div>
                <button onclick="deleteEvent('${e.id}')" class="opacity-0 group-hover:opacity-100 p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all">
                    <i data-lucide="trash-2" class="w-5 h-5"></i>
                </button>
            </div>
        `).join('');
        
        if (window.lucide) {
            window.lucide.createIcons();
        }
    }

    async function submitCalendarEvent() {
        const type = document.getElementById('eventType').value;
        const title = document.getElementById('eventTitle').value;
        const start_date = document.getElementById('eventStart').value;
        const end_date = document.getElementById('eventEnd').value;
        const notes = document.getElementById('eventNotes').value;

        try {
            const { error } = await supabase.from('school_calendar').insert([{
                type,
                title,
                start_date,
                end_date,
                notes,
                created_by: utils.getCurrentUser().id
            }]);

            if (error) throw error;

            utils.showNotification('Event added to calendar!', 'success');
            calendarForm.reset();
            fetchCalendar();
        } catch (err) {
            utils.showNotification(err.message, 'error');
        }
    }

    window.deleteEvent = async (id) => {
        if (!confirm('Remove this event from the calendar?')) return;

        try {
            const { error } = await supabase.from('school_calendar').delete().eq('id', id);
            if (error) throw error;

            utils.showNotification('Event removed', 'success');
            fetchCalendar();
        } catch (err) {
            utils.showNotification(err.message, 'error');
        }
    };
});
