const supabase = window.supabaseClient;
const utils = window.utils;

document.addEventListener('DOMContentLoaded', async () => {
    await utils.checkAccess(['admin']);
    utils.renderAdminLayout('settings');

    const ruleModal = document.getElementById('ruleModal');
    const ruleForm = document.getElementById('ruleForm');
    const systemForm = document.getElementById('systemSettingsForm');
    const rulesTable = document.getElementById('rulesTableBody');

    // Load initial data
    fetchRules();
    fetchSystemSettings();

    // Event listeners
    document.querySelectorAll('.close-modal').forEach(btn => {
        btn.addEventListener('click', () => ruleModal.classList.add('hidden'));
    });

    ruleForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        await saveRule();
    });

    systemForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        await saveSystemSettings();
    });

    async function fetchRules() {
        try {
            const { data, error } = await supabase
                .from('attendance_rules')
                .select('*')
                .order('grade_level', { ascending: true });

            if (error) throw error;
            renderRules(data);
        } catch (err) {
            console.error('Error fetching rules:', err);
            utils.showNotification('Failed to load rules', 'error');
        }
    }

    function renderRules(rules) {
        if (!rulesTable) return;
        
        rulesTable.innerHTML = rules.map(r => `
            <tr class="border-b border-gray-50 hover:bg-gray-50 transition-all">
                <td class="px-6 py-4 font-bold text-gray-900">Grade ${r.grade_level}</td>
                <td class="px-6 py-4 text-sm text-gray-600">${r.in_start}</td>
                <td class="px-6 py-4 text-sm text-gray-600">${r.grace_until}</td>
                <td class="px-6 py-4 text-sm text-gray-600">${r.late_until}</td>
                <td class="px-6 py-4 text-sm text-gray-600">${r.dismissal_time || 'N/A'}</td>
                <td class="px-6 py-4 text-sm text-gray-600">${r.late_arrival_threshold} min</td>
                <td class="px-6 py-4">
                    <button onclick="editRule('${r.grade_level}')" class="text-violet-600 hover:text-violet-800 font-bold text-xs uppercase tracking-widest transition-all">
                        Edit
                    </button>
                </td>
            </tr>
        `).join('');
    }

    window.editRule = async (grade) => {
        const { data: rule } = await supabase.from('attendance_rules').select('*').eq('grade_level', grade).single();
        if (rule) {
            document.getElementById('editGradeLevel').value = rule.grade_level;
            document.getElementById('inStart').value = rule.in_start;
            document.getElementById('graceUntil').value = rule.grace_until;
            document.getElementById('lateUntil').value = rule.late_until;
            document.getElementById('dismissalTime').value = rule.dismissal_time || '';
            document.getElementById('lateArrivalThreshold').value = rule.late_arrival_threshold || 60;
            ruleModal.classList.remove('hidden');
        }
    };

    async function saveRule() {
        const grade = document.getElementById('editGradeLevel').value;
        const payload = {
            in_start: document.getElementById('inStart').value,
            grace_until: document.getElementById('graceUntil').value,
            late_until: document.getElementById('lateUntil').value,
            dismissal_time: document.getElementById('dismissalTime').value,
            late_arrival_threshold: parseInt(document.getElementById('lateArrivalThreshold').value) || 60
        };

        try {
            const { error } = await supabase.from('attendance_rules').update(payload).eq('grade_level', grade);
            if (error) throw error;

            utils.showNotification(`Rules updated for Grade ${grade}`, 'success');
            ruleModal.classList.add('hidden');
            fetchRules();
        } catch (err) {
            utils.showNotification(err.message, 'error');
        }
    }

    async function fetchSystemSettings() {
        try {
            const { data } = await supabase.from('system_settings').select('*');
            data?.forEach(s => {
                if (s.key === 'school_info') document.getElementById('schoolName').value = s.value.name || '';
                if (s.key === 'academic_year') document.getElementById('academicYear').value = s.value.year || '';
            });
        } catch (err) {}
    }

    async function saveSystemSettings() {
        const name = document.getElementById('schoolName').value;
        const year = document.getElementById('academicYear').value;

        try {
            await Promise.all([
                supabase.from('system_settings').upsert({ key: 'school_info', value: { name } }, { onConflict: 'key' }),
                supabase.from('system_settings').upsert({ key: 'academic_year', value: { year } }, { onConflict: 'key' })
            ]);
            utils.showNotification('System settings saved', 'success');
        } catch (err) {
            utils.showNotification('Failed to save settings', 'error');
        }
    }
});
