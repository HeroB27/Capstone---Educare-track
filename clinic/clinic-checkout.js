const supabase = window.supabaseClient;
const utils = window.utils;

document.addEventListener('DOMContentLoaded', async () => {
    await utils.checkAccess(['clinic', 'admin']);

    const state = {
        user: utils.getCurrentUser(),
        readyToDischarge: []
    };

    lucide.createIcons();
    fetchReadyToDischarge();

    async function fetchReadyToDischarge() {
        try {
            // Ready means treated and has decision and parent notified in notes
            const { data, error } = await supabase
                .from('clinic_visits')
                .select('*, students(id, full_name, grade_level, strand)')
                .eq('status', 'treated')
                .like('notes', '%Decision:%')
                .like('notes', '%Parent Notified%')
                .order('visit_time', { ascending: false });

            if (error) throw error;
            state.readyToDischarge = data || [];
            renderDischargeList();
        } catch (err) {
            console.error('Fetch discharge list error:', err);
        }
    }

    function renderDischargeList() {
        const list = document.getElementById('dischargeList');
        if (state.readyToDischarge.length === 0) {
            list.innerHTML = `
                <div class="col-span-full py-20 text-center">
                    <div class="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
                        <i data-lucide="check-circle" class="w-10 h-10 text-gray-300"></i>
                    </div>
                    <p class="text-gray-400 font-bold uppercase tracking-widest text-xs">No students ready for discharge</p>
                    <p class="text-[10px] text-gray-300 mt-2 italic">(Awaiting teacher's parent-notification approval)</p>
                </div>
            `;
            lucide.createIcons();
            return;
        }

        list.innerHTML = state.readyToDischarge.map(p => {
            const decisionMatch = p.notes.match(/Decision: (\w+)/);
            const decision = decisionMatch ? decisionMatch[1].replace(/_/g, ' ') : 'Unknown';
            const colorClass = decision.includes('home') ? 'text-red-600 bg-red-50' : 'text-emerald-600 bg-emerald-50';

            return `
                <div class="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
                    <div class="flex items-center space-x-4 mb-6">
                        <div class="w-12 h-12 bg-gray-50 rounded-2xl flex items-center justify-center text-gray-400">
                            <i data-lucide="user" class="w-6 h-6"></i>
                        </div>
                        <div>
                            <h4 class="font-black text-gray-900 text-sm">${p.students?.full_name}</h4>
                            <div class="inline-flex items-center px-2 py-1 rounded-lg text-[8px] font-black uppercase tracking-tighter ${colorClass}">
                                ${decision}
                            </div>
                        </div>
                    </div>

                    <div class="bg-gray-50 rounded-2xl p-4 mb-6">
                        <p class="text-[9px] text-gray-400 font-black uppercase tracking-widest mb-2">Final Decision Details</p>
                        <p class="text-xs text-gray-600 font-medium leading-relaxed italic truncate-3-lines">"${p.notes}"</p>
                    </div>

                    <button onclick="checkoutStudent('${p.id}', '${p.student_id}', '${decision}')" 
                        class="w-full bg-gray-900 text-white py-4 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-gray-800 transition-all shadow-lg shadow-gray-200 flex items-center justify-center space-x-2">
                        <i data-lucide="log-out" class="w-4 h-4"></i>
                        <span>Confirm Discharge</span>
                    </button>
                </div>
            `;
        }).join('');
        lucide.createIcons();
    }

    window.checkoutStudent = async (visitId, studentId, decision) => {
        try {
            utils.showNotification('Processing discharge...', 'info');

            const status = decision.includes('home') ? 'sent_home' : 'returned';
            const studentStatus = decision.includes('home') ? 'sent_home' : 'out';

            // 1. Update Student Status
            await supabase
                .from('students')
                .update({ current_status: studentStatus })
                .eq('id', studentId);

            // 2. Mark visit as released
            await supabase
                .from('clinic_visits')
                .update({ status: 'released' })
                .eq('id', visitId);

            // 3. Update today's subject attendance (if present) to reflect final disposition
            const today = new Date().toISOString().split('T')[0];
            await supabase
                .from('subject_attendance')
                .update({ remarks: `Clinic Visit ${visitId} (Result: ${status})` })
                .eq('student_id', studentId)
                .eq('date', today);

            // 4. Notify Teacher & Parent
            const visit = state.readyToDischarge.find(p => p.id === visitId);
            const { data: passRow } = await supabase
                .from('clinic_passes')
                .select('issued_by')
                .eq('clinic_visit_id', visitId)
                .limit(1)
                .single();

            const { data: parentLink } = await supabase
                .from('parent_students')
                .select('parent_id')
                .eq('student_id', studentId)
                .single();

            const notifications = [];
            if (passRow?.issued_by) {
                notifications.push({
                    recipient_id: passRow.issued_by,
                    actor_id: state.user.id,
                    verb: 'clinic_checkout',
                    object: { student_name: visit.students.full_name, status: status, visit_id: visitId }
                });
            }

            if (parentLink) {
                notifications.push({
                    recipient_id: parentLink.parent_id,
                    actor_id: state.user.id,
                    verb: 'clinic_checkout',
                    object: { student_name: visit.students.full_name, status: status, visit_id: visitId }
                });
            }

            if (notifications.length > 0) {
                await supabase.from('notifications').insert(notifications);
            }

            // 4. Log Audit
            await supabase.from('audit_logs').insert([{
                actor_id: state.user.id,
                action: 'CLINIC_CHECKOUT',
                target_table: 'clinic_visits',
                target_id: visitId,
                details: { student_name: visit.students.full_name, final_status: status }
            }]);

            utils.showNotification('Student discharged successfully!', 'success');
            fetchReadyToDischarge();
        } catch (err) {
            console.error('Checkout error:', err);
            utils.showNotification(err.message, 'error');
        }
    };
});
