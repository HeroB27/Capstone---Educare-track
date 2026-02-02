const supabase = window.supabaseClient;
const utils = window.utils;

document.addEventListener('DOMContentLoaded', async () => {
    await utils.checkAccess(['clinic', 'admin']);

    const state = {
        user: utils.getCurrentUser(),
        activePatients: [],
        selectedPatient: null,
        currentDecision: null
    };

    lucide.createIcons();
    fetchActivePatients();

    // Subscribe to clinic visits
    supabase
        .channel('clinic_findings')
        .on('postgres_changes', { 
            event: '*', 
            schema: 'public', 
            table: 'clinic_visits'
        }, fetchActivePatients)
        .subscribe();

    async function fetchActivePatients() {
        try {
            const { data, error } = await supabase
                .from('clinic_visits')
                .select('*, students(id, full_name, grade_level, strand, class_id)')
                .is('notes', null) // Only those without notes yet
                .neq('status', 'released')
                .order('visit_time', { ascending: false });

            if (error) throw error;
            state.activePatients = data || [];
            renderActivePatients();
        } catch (err) {
            console.error('Fetch active patients error:', err);
        }
    }

    function renderActivePatients() {
        const list = document.getElementById('activePatients');
        if (state.activePatients.length === 0) {
            list.innerHTML = '<div class="p-8 text-center text-gray-400 italic text-xs uppercase tracking-widest font-bold bg-gray-50 rounded-2xl">No active patients</div>';
            return;
        }

        list.innerHTML = state.activePatients.map(p => `
            <button onclick="selectPatient('${p.id}')" 
                class="w-full text-left p-6 rounded-2xl border transition-all duration-300 ${
                    state.selectedPatient?.id === p.id 
                    ? 'bg-red-50 border-red-200 shadow-md ring-1 ring-red-200' 
                    : 'bg-white border-gray-100 hover:border-red-100 hover:shadow-sm'
                }">
                <div class="flex items-center space-x-4">
                    <div class="w-10 h-10 ${state.selectedPatient?.id === p.id ? 'bg-red-200 text-red-700' : 'bg-red-50 text-red-600'} rounded-xl flex items-center justify-center transition-colors">
                        <i data-lucide="user" class="w-5 h-5"></i>
                    </div>
                    <div>
                        <h4 class="font-black text-gray-900 text-sm mb-1">${p.students?.full_name}</h4>
                        <p class="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Admitted ${utils.formatTime(p.visit_time)}</p>
                    </div>
                </div>
            </button>
        `).join('');
        lucide.createIcons();
    }

    window.selectPatient = (id) => {
        state.selectedPatient = state.activePatients.find(p => p.id === id);
        document.getElementById('findingsPanel').classList.remove('hidden');
        document.getElementById('emptyFindings').classList.add('hidden');
        
        document.getElementById('selectedPatientName').textContent = state.selectedPatient.students.full_name;
        document.getElementById('selectedPatientInfo').textContent = `${state.selectedPatient.students.grade_level} ${state.selectedPatient.students.strand || ''}`;
        
        // Reset form
        document.getElementById('findingReason').value = state.selectedPatient.reason || '';
        document.getElementById('findingNotes').value = '';
        state.currentDecision = null;
        updateDecisionUI();
        renderActivePatients();
    };

    window.setDecision = (decision) => {
        state.currentDecision = decision;
        updateDecisionUI();
    };

    function updateDecisionUI() {
        document.querySelectorAll('.decision-btn').forEach(btn => {
            btn.classList.remove('border-emerald-500', 'bg-emerald-50', 'border-amber-500', 'bg-amber-50', 'border-red-500', 'bg-red-50');
            btn.classList.add('bg-gray-50', 'border-transparent');
        });

        if (state.currentDecision) {
            const btn = document.getElementById(`btn-${state.currentDecision}`);
            btn.classList.remove('bg-gray-50', 'border-transparent');
            
            const colors = {
                return_to_class: 'border-emerald-500 bg-emerald-50',
                rest_at_clinic: 'border-amber-500 bg-amber-50',
                send_home: 'border-red-500 bg-red-50'
            };
            btn.classList.add(...colors[state.currentDecision].split(' '));
        }
    }

    window.saveFindings = async () => {
        const reason = document.getElementById('findingReason').value;
        const notes = document.getElementById('findingNotes').value;

        if (!reason || !notes || !state.currentDecision) {
            return utils.showNotification('Please complete all findings and select a decision', 'warning');
        }

        try {
            utils.showNotification('Saving findings...', 'info');

            // 1. Update clinic_visits
            const { error: visitErr } = await supabase
                .from('clinic_visits')
                .update({ reason, notes: `Decision: ${state.currentDecision} | Nurse Note: ${notes}`, status: 'treated' })
                .eq('id', state.selectedPatient.id);

            if (visitErr) throw visitErr;

            // 2. Notify Teacher (Decision Phase) via clinic_passes issuer
            const { data: passRow } = await supabase
                .from('clinic_passes')
                .select('issued_by')
                .eq('clinic_visit_id', state.selectedPatient.id)
                .limit(1)
                .single();

            if (passRow?.issued_by) {
                await supabase.from('notifications').insert([{
                    recipient_id: passRow.issued_by,
                    actor_id: state.user.id,
                    verb: 'clinic_findings_ready',
                    object: { 
                        student_id: state.selectedPatient.students.id,
                        student_name: state.selectedPatient.students.full_name,
                        decision: state.currentDecision,
                        reason: reason,
                        visit_id: state.selectedPatient.id
                    }
                }]);
            }

            // 4. Log Audit
            await supabase.from('audit_logs').insert([{
                actor_id: state.user.id,
                action: 'CLINIC_FINDINGS_UPDATED',
                target_table: 'clinic_visits',
                target_id: state.selectedPatient.id,
                details: { student_name: state.selectedPatient.students.full_name, decision: state.currentDecision }
            }]);

            utils.showNotification('Findings saved! Teacher notified for approval.', 'success');
            
            // Clear selection and refresh
            state.selectedPatient = null;
            document.getElementById('findingsPanel').classList.add('hidden');
            document.getElementById('emptyFindings').classList.remove('hidden');
            fetchActivePatients();

        } catch (err) {
            console.error('Save findings error:', err);
            utils.showNotification(err.message, 'error');
        }
    };
});
