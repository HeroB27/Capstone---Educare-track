import supabase from './supabase-config.js';
import { utils } from './utils.js';

document.addEventListener('DOMContentLoaded', async () => {
    // Check access
    utils.checkAccess(['admin']);

    // Render Layout
    utils.renderAdminLayout('settings');

    const settingsForm = document.getElementById('settingsForm');
    
    // Fetch and load current settings
    fetchSettings();
    fetchUpcomingEvents();

    // Event Listeners
    settingsForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        await saveSettings();
    });

    async function fetchUpcomingEvents() {
        try {
            const { data, error } = await supabase
                .from('school_calendar')
                .select('*')
                .gte('end_date', new Date().toISOString())
                .order('start_date', { ascending: true })
                .limit(3);

            if (error) throw error;
            renderEvents(data);
        } catch (err) {
            console.error('Error fetching events:', err);
        }
    }

    function renderEvents(events) {
        const list = document.getElementById('settingsEventList');
        if (!list) return;

        if (!events || events.length === 0) {
            list.innerHTML = '<p class="text-center py-10 text-gray-400 italic">No upcoming events scheduled.</p>';
            return;
        }

        list.innerHTML = events.map(e => `
            <div class="flex items-center space-x-4 p-4 bg-gray-50 rounded-2xl border border-gray-100">
                <div class="w-12 h-12 rounded-xl flex flex-col items-center justify-center font-bold ${
                    e.type === 'holiday' ? 'bg-red-100 text-red-600' :
                    e.type === 'suspension' ? 'bg-yellow-100 text-yellow-600' : 'bg-blue-100 text-blue-600'
                }">
                    <span class="text-[8px] uppercase">${new Date(e.start_date).toLocaleString('default', { month: 'short' })}</span>
                    <span class="text-lg">${new Date(e.start_date).getDate()}</span>
                </div>
                <div>
                    <h4 class="font-bold text-gray-900">${e.title}</h4>
                    <p class="text-xs text-gray-500">${utils.formatDate(e.start_date)}</p>
                </div>
            </div>
        `).join('');
    }

    async function fetchSettings() {
        try {
            const { data, error } = await supabase
                .from('system_settings')
                .select('*');

            if (error) throw error;

            if (data) {
                const settings = data.reduce((acc, curr) => {
                    acc[curr.key] = curr.value;
                    return acc;
                }, {});

                if (settings.tap_times) {
                    const times = settings.tap_times;
                    document.getElementById('startTime').value = times.arrival || '07:30';
                    document.getElementById('kinderDismissal').value = times.kinder || '12:00';
                    document.getElementById('g13Dismissal').value = times.g13 || '13:00';
                    document.getElementById('g46Dismissal').value = times.g46 || '15:00';
                    document.getElementById('jhsDismissal').value = times.jhs || '16:00';
                    document.getElementById('shsDismissal').value = times.shs || '16:30';
                }

                if (settings.school_branding) {
                    const branding = settings.school_branding;
                    document.getElementById('schoolName').value = branding.name || 'Educare Colleges Inc';
                    document.getElementById('schoolAddress').value = branding.address || 'Purok 4 Irisan Baguio City';
                }
            }
        } catch (err) {
            console.error('Error fetching settings:', err);
            utils.showNotification('Failed to load settings', 'error');
        }
    }

    async function saveSettings() {
        const tap_times = {
            arrival: document.getElementById('startTime').value,
            kinder: document.getElementById('kinderDismissal').value,
            g13: document.getElementById('g13Dismissal').value,
            g46: document.getElementById('g46Dismissal').value,
            jhs: document.getElementById('jhsDismissal').value,
            shs: document.getElementById('shsDismissal').value
        };

        const school_branding = {
            name: document.getElementById('schoolName').value,
            address: document.getElementById('schoolAddress').value
        };

        try {
            await Promise.all([
                supabase.from('system_settings').upsert({
                    key: 'tap_times',
                    value: tap_times,
                    updated_at: new Date().toISOString()
                }, { onConflict: 'key' }),
                supabase.from('system_settings').upsert({
                    key: 'school_branding',
                    value: school_branding,
                    updated_at: new Date().toISOString()
                }, { onConflict: 'key' })
            ]);

            utils.showNotification('System settings saved successfully!', 'success');
        } catch (err) {
            console.error('Error saving settings:', err);
            utils.showNotification(err.message, 'error');
        }
    }
});
