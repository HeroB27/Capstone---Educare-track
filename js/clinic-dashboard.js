import supabase from './supabase-config.js';
import { utils } from './utils.js';

document.addEventListener('DOMContentLoaded', async () => {
    // Check access
    utils.checkAccess(['clinic', 'admin']);

    const state = {
        user: utils.getCurrentUser(),
        pendingVisits: [],
        sections: {
            pending: document.getElementById('pendingSection'),
            active: document.getElementById('activeSection'),
            history: document.getElementById('historySection')
        }
    };

    // Initialize UI
    initializeSidebar();
    await fetchPendingVisits();
    initializeRealtime();

    function initializeSidebar() {
        const navLinks = document.querySelectorAll('.nav-link');
        const sectionTitle = document.getElementById('sectionTitle');
        
        navLinks.forEach(link => {
            link.addEventListener('click', () => {
                const section = link.dataset.section;
                navLinks.forEach(l => {
                    l.classList.remove('bg-red-50', 'text-red-600');
                    l.classList.add('text-gray-600', 'hover:bg-gray-50');
                });
                link.classList.add('bg-red-50', 'text-red-600');
                link.classList.remove('text-gray-600', 'hover:bg-gray-50');

                Object.values(state.sections).forEach(s => s?.classList.add('hidden'));
                state.sections[section]?.classList.remove('hidden');
                sectionTitle.innerText = link.querySelector('span').innerText;
            });
        });

        document.getElementById('logoutBtn').addEventListener('click', utils.logout);
    }

    async function fetchPendingVisits() {
        try {
            const { data, error } = await supabase
                .from('clinic_visits')
                .select('*, students(full_name, grade_level, strand)')
                .is('treated_by', null)
                .order('visit_time', { ascending: false });

            if (error) throw error;
            state.pendingVisits = data || [];
            renderPendingVisits();
        } catch (err) {
            console.error('Error fetching visits:', err);
        }
    }

    function renderPendingVisits() {
        const grid = document.getElementById('pendingPassesGrid');
        if (state.pendingVisits.length === 0) {
            grid.innerHTML = '<p class="col-span-full text-center py-20 text-gray-400">No pending clinic passes</p>';
            return;
        }

        grid.innerHTML = state.pendingVisits.map(v => `
            <div class="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-between">
                <div>
                    <div class="flex items-center justify-between mb-4">
                        <span class="text-xs font-bold text-red-600 bg-red-50 px-2 py-1 rounded uppercase">Pending Admission</span>
                        <span class="text-xs text-gray-400">${utils.formatTime(v.visit_time)}</span>
                    </div>
                    <h3 class="text-lg font-bold text-gray-900">${v.students.full_name}</h3>
                    <p class="text-sm text-gray-500 mb-4">Grade ${v.students.grade_level} ${v.students.strand || ''}</p>
                    <div class="bg-gray-50 p-3 rounded-lg mb-4">
                        <p class="text-xs font-bold text-gray-400 uppercase mb-1">Reason (from Teacher)</p>
                        <p class="text-sm text-gray-700">${v.reason}</p>
                    </div>
                </div>
                <button onclick="window.openFindings('${v.id}', '${v.students.full_name}')" class="w-full bg-red-600 text-white py-2 rounded-lg font-bold hover:bg-red-700 transition-all">
                    Process Admission
                </button>
            </div>
        `).join('');
        lucide.createIcons();
    }

    function initializeRealtime() {
        supabase
            .channel('public:clinic_visits')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'clinic_visits' }, () => {
                fetchPendingVisits();
            })
            .subscribe();
    }

    window.openFindings = (id, name) => {
        document.getElementById('visitID').value = id;
        document.getElementById('findingsStudent').value = name;
        document.getElementById('findingsModal').classList.remove('hidden');
    };

    const modal = document.getElementById('findingsModal');
    document.querySelectorAll('.close-modal').forEach(btn => btn.addEventListener('click', () => modal.classList.add('hidden')));

    document.getElementById('saveFindings').addEventListener('click', async () => {
        const id = document.getElementById('visitID').value;
        const findings = document.getElementById('medicalFindings').value;
        const treatment = document.getElementById('treatmentGiven').value;
        const rec = document.getElementById('recommendation').value;

        try {
            const notes = `Findings: ${findings}; Treatment: ${treatment}; Recommendation: ${rec}`;
            const { error } = await supabase.from('clinic_visits').update({
                notes: notes,
                treated_by: state.user.id
            }).eq('id', id);

            if (error) throw error;

            utils.showNotification('Findings saved and notifications sent!', 'success');
            modal.classList.add('hidden');
            
            // Notification chain logic would go here (Notify Teacher and Parent)
            const visit = state.pendingVisits.find(v => v.id === id);
            if (visit) {
                // Fetch student parent for notification
                const { data: link } = await supabase.from('parent_students').select('parent_id').eq('student_id', visit.student_id).single();
                if (link?.parent_id) {
                    await supabase.from('notifications').insert([{
                        recipient_id: link.parent_id,
                        actor_id: state.user.id,
                        verb: 'clinic_update',
                        object: { student_id: visit.student_id, full_name: visit.students.full_name, findings, recommendation: rec }
                    }]);
                }
            }

        } catch (err) {
            utils.showNotification(err.message, 'error');
        }
    });
});
