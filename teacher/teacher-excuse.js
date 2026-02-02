const supabase = window.supabaseClient;
const utils = window.utils;

document.addEventListener('DOMContentLoaded', async () => {
    await utils.checkAccess(['teacher', 'admin']);
    utils.renderTeacherLayout('excuse');

    const state = {
        user: utils.getCurrentUser(),
        letters: []
    };

    fetchLetters();

    async function fetchLetters() {
        try {
            const { data, error } = await supabase
                .from('excuse_letters')
                .select('*, students(full_name, class_id), parents(profiles(full_name))')
                .order('issued_at', { ascending: false });

            if (error) throw error;
            state.letters = data || [];
            renderLetters();
        } catch (err) {
            console.error('Fetch letters error:', err);
            utils.showNotification('Failed to load letters', 'error');
        }
    }

    function renderLetters() {
        const list = document.getElementById('letterList');
        if (state.letters.length === 0) {
            list.innerHTML = '<div class="py-20 text-center text-gray-400 italic">No excuse letters submitted yet.</div>';
            return;
        }

        list.innerHTML = state.letters.map(l => `
            <div class="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div class="flex-1">
                    <div class="flex items-center space-x-3 mb-2">
                        <span class="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                            l.status === 'pending' ? 'bg-amber-100 text-amber-700' :
                            l.status === 'approved' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                        }">${l.status}</span>
                        <p class="text-[10px] text-gray-400 font-bold uppercase tracking-widest">${utils.formatDate(l.issued_at)}</p>
                    </div>
                    <h4 class="text-lg font-bold text-gray-900 mb-1">${l.students?.full_name}</h4>
                    <p class="text-sm text-gray-600 mb-4">${l.reason}</p>
                    <div class="flex items-center space-x-4 text-xs text-gray-400">
                        <span class="flex items-center"><i data-lucide="user" class="w-3 h-3 mr-1"></i> Parent: ${l.parents?.profiles?.full_name}</span>
                        <span class="flex items-center"><i data-lucide="calendar" class="w-3 h-3 mr-1"></i> Absent Date: ${utils.formatDate(l.absent_date)}</span>
                    </div>
                </div>
                ${l.status === 'pending' ? `
                    <div class="flex space-x-2">
                        <button onclick="openDecisionModal('${l.id}', 'rejected')" class="px-4 py-2 border border-red-100 text-red-600 rounded-xl text-sm font-bold hover:bg-red-50 transition-all">Reject</button>
                        <button onclick="openDecisionModal('${l.id}', 'approved')" class="px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/20">Approve</button>
                    </div>
                ` : `
                    <div class="text-right">
                        <p class="text-xs text-gray-400 font-medium italic">Reviewed by ${state.user.full_name}</p>
                        ${l.remarks ? `<p class="text-xs text-gray-500 mt-1 max-w-xs">"${l.remarks}"</p>` : ''}
                    </div>
                `}
            </div>
        `).join('');
        if (window.lucide) window.lucide.createIcons();
    }

    window.openDecisionModal = (id, status) => {
        document.getElementById('decLetterID').value = id;
        document.getElementById('decStatus').value = status;
        document.getElementById('decisionTitle').innerText = status === 'approved' ? 'Approve Excuse Letter' : 'Reject Excuse Letter';
        document.getElementById('decComment').value = '';
        document.getElementById('decisionModal').classList.remove('hidden');
    };

    const modal = document.getElementById('decisionModal');
    document.querySelectorAll('.close-dec-modal').forEach(btn => btn.addEventListener('click', () => modal.classList.add('hidden')));

    document.getElementById('submitDecision').addEventListener('click', async () => {
        const id = document.getElementById('decLetterID').value;
        const status = document.getElementById('decStatus').value;
        const comment = document.getElementById('decComment').value;

        if (status === 'rejected' && !comment) {
            return utils.showNotification('Comment is required for rejections', 'warning');
        }

        try {
            utils.showNotification('Submitting decision...', 'info');
            const letter = state.letters.find(l => l.id === id);

            // 1. Update Letter Status
            const { error: updErr } = await supabase
                .from('excuse_letters')
                .update({ 
                    status, 
                    remarks: comment || null
                })
                .eq('id', id);

            if (updErr) throw updErr;

            // 2. If approved, update attendance to 'excused'
            if (status === 'approved') {
                const absentDate = letter.absent_date;
                const startOfDay = `${absentDate}T00:00:00.000Z`;
                const endOfDay = `${absentDate}T23:59:59.999Z`;

                // Update Homeroom Attendance
                await supabase
                    .from('attendance')
                    .update({ 
                        status: 'excused',
                        remarks: `Excuse Letter ID: ${id}`
                    })
                    .eq('student_id', letter.student_id)
                    .gte('timestamp', startOfDay)
                    .lte('timestamp', endOfDay);

                // Update Subject Attendance
                await supabase
                    .from('subject_attendance')
                    .update({ 
                        status: 'excused',
                        remarks: `Excuse Letter ID: ${id}`
                    })
                    .eq('student_id', letter.student_id)
                    .eq('date', letter.absent_date);
            }

            // 3. Create Notification for Parent
            await supabase.from('notifications').insert([{
                recipient_id: letter.parent_id,
                actor_id: state.user.id,
                verb: 'excuse_letter_decision',
                object: {
                    status,
                    student_id: letter.student_id,
                    student_name: letter.students?.full_name,
                    absent_date: letter.absent_date,
                    comment: comment || null
                },
                read: false
            }]);

            utils.showNotification(`Letter ${status} successfully!`, 'success');
            modal.classList.add('hidden');
            fetchLetters();

        } catch (err) {
            console.error('Decision error:', err);
            utils.showNotification(err.message, 'error');
        }
    });
});
