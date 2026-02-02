const supabase = window.supabaseClient;
const utils = window.utils;

document.addEventListener('DOMContentLoaded', async () => {
    await utils.checkAccess(['clinic', 'admin']);

    const state = {
        user: utils.getCurrentUser(),
        pendingPasses: []
    };

    lucide.createIcons();
    fetchPendingPasses();

    // Subscribe to new clinic passes
    supabase
        .channel('clinic_approvals')
        .on('postgres_changes', { 
            event: 'INSERT', 
            schema: 'public', 
            table: 'clinic_passes'
        }, payload => {
            fetchPendingPasses();
            utils.showNotification('New clinic pass request received!', 'info');
        })
        .subscribe();

    async function fetchPendingPasses() {
        try {
            const { data, error } = await supabase
                .from('clinic_passes')
                .select('*, students(full_name, grade_level, strand), profiles:issued_by(full_name)')
                .eq('status', 'pending')
                .order('issued_at', { ascending: false });

            if (error) throw error;
            state.pendingPasses = data || [];
            renderPendingPasses();
        } catch (err) {
            console.error('Fetch pending passes error:', err);
            utils.showNotification(err.message, 'error');
        }
    }

    function renderPendingPasses() {
        const list = document.getElementById('pendingList');
        if (state.pendingPasses.length === 0) {
            list.innerHTML = `
                <div class="col-span-full py-20 text-center">
                    <div class="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
                        <i data-lucide="inbox" class="w-10 h-10 text-gray-300"></i>
                    </div>
                    <p class="text-gray-400 font-bold uppercase tracking-widest">No pending passes</p>
                </div>
            `;
            lucide.createIcons();
            return;
        }

        list.innerHTML = state.pendingPasses.map(p => `
            <div class="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm hover:shadow-md transition-all duration-300">
                <div class="flex justify-between items-start mb-6">
                    <div class="flex items-center space-x-4">
                        <div class="w-14 h-14 bg-red-50 rounded-2xl flex items-center justify-center text-red-600 shadow-inner">
                            <i data-lucide="user" class="w-7 h-7"></i>
                        </div>
                        <div>
                            <h4 class="font-black text-gray-900 text-lg">${p.students?.full_name}</h4>
                            <p class="text-xs text-gray-400 font-bold uppercase tracking-widest">
                                ${p.students?.grade_level} ${p.students?.strand || ''}
                            </p>
                        </div>
                    </div>
                    <div class="text-right">
                        <p class="text-[10px] text-gray-400 font-black uppercase tracking-widest mb-1">Issued At</p>
                        <p class="text-xs font-bold text-gray-900">${utils.formatTime(p.issued_at)}</p>
                    </div>
                </div>

                <div class="bg-gray-50 rounded-2xl p-4 mb-6">
                    <p class="text-[10px] text-gray-400 font-black uppercase tracking-widest mb-2">Teacher's Note</p>
                    <p class="text-sm text-gray-700 font-medium leading-relaxed italic">"${p.reason || ''}"</p>
                    <p class="mt-3 text-[10px] text-gray-400 font-bold uppercase">Issued by: ${p.profiles?.full_name}</p>
                </div>

                <div class="grid grid-cols-2 gap-4">
                    <button onclick="handleAction('${p.id}', 'approved')" 
                        class="flex items-center justify-center space-x-2 bg-emerald-600 hover:bg-emerald-700 text-white py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all duration-300 shadow-lg shadow-emerald-100">
                        <i data-lucide="check-circle" class="w-4 h-4"></i>
                        <span>Approve Pass</span>
                    </button>
                    <button onclick="handleAction('${p.id}', 'rejected')" 
                        class="flex items-center justify-center space-x-2 bg-white border-2 border-red-100 text-red-600 hover:bg-red-50 py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all duration-300">
                        <i data-lucide="x-circle" class="w-4 h-4"></i>
                        <span>Reject Pass</span>
                    </button>
                </div>
            </div>
        `).join('');
        lucide.createIcons();
    }

    window.handleAction = async (id, status) => {
        try {
            utils.showNotification(`${status === 'approved' ? 'Approving' : 'Rejecting'} pass...`, 'info');
            
            const pass = state.pendingPasses.find(p => p.id === id);

            // 1. Update Clinic Pass Status
            const { error: updateErr } = await supabase
                .from('clinic_passes')
                .update({ status })
                .eq('id', id);

            if (updateErr) throw updateErr;

            // 2. Notify Teacher
            await supabase.from('notifications').insert([{
                recipient_id: pass.issued_by,
                actor_id: state.user.id,
                verb: status === 'approved' ? 'clinic_pass_approved' : 'clinic_pass_rejected',
                object: { 
                    student_id: pass.student_id, 
                    student_name: pass.students?.full_name,
                    clinic_pass_id: id
                }
            }]);

            // 3. Log Audit
            await supabase.from('audit_logs').insert([{
                actor_id: state.user.id,
                action: status === 'approved' ? 'CLINIC_PASS_APPROVED' : 'CLINIC_PASS_REJECTED',
                target_table: 'clinic_passes',
                target_id: id,
                details: { student_name: pass.students?.full_name }
            }]);

            utils.showNotification(`Pass ${status}! Teacher notified.`, 'success');
            fetchPendingPasses();
        } catch (err) {
            console.error('Handle action error:', err);
            utils.showNotification(err.message, 'error');
        }
    };
});
