const supabase = window.supabaseClient;
const utils = window.utils;

document.addEventListener('DOMContentLoaded', async () => {
    // Check access
    await utils.checkAccess(['parent', 'admin']);

    // State
    const state = {
        user: utils.getCurrentUser(),
        children: [],
        letters: []
    };

    // Initialize Layout
    utils.renderParentLayout('excuse');

    // Initial Data Fetch
    await Promise.all([
        fetchChildren(),
        fetchLetters()
    ]);

    // Event Listeners
    const modal = document.getElementById('submitModal');
    document.getElementById('openSubmitModal')?.addEventListener('click', () => modal.classList.remove('hidden'));
    document.getElementById('closeSubmitModal')?.addEventListener('click', () => modal.classList.add('hidden'));
    document.getElementById('excuseForm')?.addEventListener('submit', handleSubmit);

    async function fetchChildren() {
        try {
            const { data: links, error: lErr } = await supabase
                .from('parent_students')
                .select('student_id, students(full_name)')
                .eq('parent_id', state.user.id);

            if (lErr) throw lErr;
            state.children = links || [];
            
            const select = document.getElementById('studentSelect');
            if (select) {
                select.innerHTML = '<option value="">Choose student...</option>' + 
                    state.children.map(c => `<option value="${c.student_id}">${c.students.full_name}</option>`).join('');
            }
        } catch (err) {
            console.error('Error fetching children:', err);
        }
    }

    async function fetchLetters() {
        try {
            const { data, error } = await supabase
                .from('excuse_letters')
                .select('*, students(full_name)')
                .eq('parent_id', state.user.id)
                .order('issued_at', { ascending: false });

            if (error) throw error;
            state.letters = data || [];
            renderLetters();
        } catch (err) {
            console.error('Error fetching letters:', err);
        }
    }

    function renderLetters() {
        const list = document.getElementById('letterList');
        if (!list) return;

        if (state.letters.length === 0) {
            list.innerHTML = `
                <div class="flex flex-col items-center justify-center py-20 bg-white rounded-3xl border border-gray-100 text-gray-400">
                    <div class="bg-gray-50 p-4 rounded-full mb-4">
                        <i data-lucide="file-text" class="w-12 h-12 text-gray-300"></i>
                    </div>
                    <p class="text-xs font-bold uppercase tracking-widest">No excuse letters submitted yet</p>
                </div>
            `;
            if (window.lucide) window.lucide.createIcons();
            return;
        }

        list.innerHTML = state.letters.map(l => `
            <div class="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm hover:shadow-md transition-all">
                <div class="flex justify-between items-start mb-6">
                    <div>
                        <div class="flex items-center space-x-3 mb-2">
                            <span class="px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest ${
                                l.status === 'pending' ? 'bg-amber-100 text-amber-700' :
                                l.status === 'approved' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                            }">${l.status}</span>
                            <span class="text-[9px] text-gray-400 font-black uppercase tracking-widest">${utils.formatDate(l.issued_at)}</span>
                        </div>
                        <h4 class="text-lg font-black text-gray-900">${l.students?.full_name}</h4>
                    </div>
                    <div class="text-right">
                        <p class="text-[9px] text-gray-400 font-black uppercase tracking-widest mb-1">Absent Date</p>
                        <p class="text-xs font-black text-gray-900">${utils.formatDate(l.absent_date)}</p>
                    </div>
                </div>

                <div class="bg-gray-50 rounded-2xl p-6 mb-6">
                    <p class="text-[9px] text-gray-400 font-black uppercase tracking-widest mb-2">Reason provided</p>
                    <p class="text-sm text-gray-600 font-medium leading-relaxed italic">"${l.reason}"</p>
                </div>

                ${l.remarks ? `
                    <div class="border-t border-gray-50 pt-6">
                        <p class="text-[9px] text-gray-400 font-black uppercase tracking-widest mb-2">Teacher's Feedback</p>
                        <p class="text-sm text-gray-900 font-bold">"${l.remarks}"</p>
                    </div>
                ` : ''}
            </div>
        `).join('');
        if (window.lucide) window.lucide.createIcons();
    }

    async function handleSubmit(e) {
        e.preventDefault();
        const studentId = document.getElementById('studentSelect').value;
        const absentDate = document.getElementById('absentDate').value;
        const reason = document.getElementById('reason').value;

        try {
            utils.showNotification('Submitting excuse letter...', 'info');

            const { error } = await supabase
                .from('excuse_letters')
                .insert([{
                    parent_id: state.user.id,
                    student_id: studentId,
                    absent_date: absentDate,
                    reason: reason,
                    status: 'pending'
                }]);

            if (error) throw error;

            utils.showNotification('Letter submitted successfully!', 'success');
            modal.classList.add('hidden');
            document.getElementById('excuseForm').reset();
            fetchLetters();

        } catch (err) {
            console.error('Submission error:', err);
            utils.showNotification(err.message, 'error');
        }
    }
});
