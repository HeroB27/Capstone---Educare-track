import supabase from './supabase-config.js';
import { utils } from './utils.js';

document.addEventListener('DOMContentLoaded', async () => {
    utils.checkAccess(['teacher', 'admin']);
    utils.renderTeacherLayout('clinic');

    const state = {
        user: utils.getCurrentUser(),
        students: [],
        passes: []
    };

    // Initial Data
    fetchPasses();
    fetchStudents();

    // Event Listeners
    document.getElementById('newPassBtn')?.addEventListener('click', () => {
        document.getElementById('passModal').classList.remove('hidden');
    });

    const modal = document.getElementById('passModal');
    document.querySelectorAll('.close-pass-modal').forEach(btn => btn.addEventListener('click', () => modal.classList.add('hidden')));

    document.getElementById('submitPass')?.addEventListener('click', async () => {
        const studentId = document.getElementById('studentSelect').value;
        const reason = document.getElementById('clinicReason').value;
        const notes = document.getElementById('clinicNotes').value;

        if (!studentId) return utils.showNotification('Please select a student', 'warning');

        try {
            utils.showNotification('Creating clinic pass...', 'info');
            
            const student = state.students.find(s => s.id === studentId);
            
            // 1. Create Pending Attendance Record (Clinic Entry)
            const { data: attendance, error: attErr } = await supabase.from('attendance').insert([{
                student_id: studentId,
                status: 'pending',
                entry_type: 'clinic',
                recorded_by: state.user.id,
                remarks: `${reason} | ${notes}`,
                timestamp: new Date().toISOString()
            }]).select().single();

            if (attErr) throw attErr;

            // 2. Notify Clinic Staff
            const { data: clinicStaff } = await supabase.from('profiles').select('id').eq('role', 'clinic');
            
            if (clinicStaff && clinicStaff.length > 0) {
                const notifications = clinicStaff.map(staff => ({
                    recipient_id: staff.id,
                    actor_id: state.user.id,
                    verb: 'clinic_pass_issued',
                    object: { 
                        student_id: studentId, 
                        student_name: student.full_name,
                        attendance_id: attendance.id,
                        reason: reason 
                    }
                }));
                await supabase.from('notifications').insert(notifications);
            }

            // 3. Log Audit
            await supabase.from('audit_logs').insert([{
                actor_id: state.user.id,
                action: 'CLINIC_PASS_ISSUED',
                target_table: 'attendance',
                target_id: attendance.id,
                details: { student_name: student.full_name, reason }
            }]);

            utils.showNotification('Pass issued! Clinic notified.', 'success');
            modal.classList.add('hidden');
            fetchPasses();

        } catch (err) {
            console.error('Clinic pass error:', err);
            utils.showNotification(err.message, 'error');
        }
    });

    async function fetchPasses() {
        try {
            // Fetch both pending attendance and completed visits
            const [attRes, visitRes] = await Promise.all([
                supabase
                    .from('attendance')
                    .select('*, students(full_name, grade_level, strand)')
                    .eq('entry_type', 'clinic')
                    .eq('recorded_by', state.user.id)
                    .order('timestamp', { ascending: false }),
                supabase
                    .from('clinic_visits')
                    .select('*, students(full_name, grade_level, strand)')
                    .order('visit_time', { ascending: false })
            ]);

            if (attRes.error) throw attRes.error;
            if (visitRes.error) throw visitRes.error;

            state.attendancePasses = attRes.data || [];
            state.visits = visitRes.data || [];
            
            renderPasses();
            renderFindingsApproval();
            updateStats();
        } catch (err) {
            console.error('Fetch passes error:', err);
        }
    }

    function renderPasses() {
        const list = document.getElementById('clinicPassList');
        const allPasses = [...state.attendancePasses];
        
        if (allPasses.length === 0) {
            list.innerHTML = '<div class="py-20 text-center text-gray-400 italic">No clinic passes issued recently.</div>';
            return;
        }

        list.innerHTML = allPasses.map(p => `
            <div class="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                <div class="flex justify-between items-start mb-4">
                    <div class="flex items-center space-x-4">
                        <div class="w-10 h-10 bg-red-50 rounded-lg flex items-center justify-center text-red-600">
                            <i data-lucide="activity" class="w-5 h-5"></i>
                        </div>
                        <div>
                            <h4 class="font-bold text-gray-900">${p.students?.full_name}</h4>
                            <p class="text-[10px] text-gray-400 font-bold uppercase tracking-widest">${utils.formatDate(p.timestamp)} at ${utils.formatTime(p.timestamp)}</p>
                        </div>
                    </div>
                    <span class="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        p.status === 'returned' || p.status === 'sent_home' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                    }">${p.status}</span>
                </div>
                
                <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4 pt-4 border-t border-gray-50">
                    <div>
                        <p class="text-[10px] text-gray-400 font-bold uppercase mb-2">Details</p>
                        <p class="text-sm text-gray-600 italic">"${p.remarks || 'No details'}"</p>
                    </div>
                    <div>
                        <p class="text-[10px] text-gray-400 font-bold uppercase mb-2">Current Location</p>
                        <div class="flex items-center space-x-2">
                            <div class="w-2 h-2 rounded-full ${p.status === 'in_clinic' ? 'bg-blue-500 animate-pulse' : 'bg-gray-300'}"></div>
                            <span class="text-xs font-bold text-gray-700 uppercase">${p.status === 'in_clinic' ? 'In Clinic' : 'Outside'}</span>
                        </div>
                    </div>
                </div>
            </div>
        `).join('');
        lucide.createIcons();
    }

    function renderFindingsApproval() {
        const list = document.getElementById('findingsApprovalList');
        // Findings ready means remarks has "Decision:" but parent hasn't been notified yet
        const pendingApprovals = state.attendancePasses.filter(p => 
            p.status === 'in_clinic' && p.remarks?.includes('Decision:') && !p.remarks?.includes('Parent Notified')
        );

        document.getElementById('pendingApprovalCount').textContent = `${pendingApprovals.length} Pending`;

        if (pendingApprovals.length === 0) {
            list.innerHTML = '<div class="py-10 text-center text-gray-400 italic text-xs uppercase tracking-widest font-bold bg-gray-50 rounded-2xl">No findings awaiting approval</div>';
            return;
        }

        list.innerHTML = pendingApprovals.map(p => {
            const decisionMatch = p.remarks.match(/Decision: (\w+)/);
            const decision = decisionMatch ? decisionMatch[1].replace(/_/g, ' ') : 'Unknown';
            
            return `
                <div class="flex items-center justify-between p-4 bg-gray-50 rounded-2xl border border-gray-100 group">
                    <div class="flex items-center space-x-4">
                        <div class="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm">
                            <i data-lucide="clipboard-check" class="w-5 h-5 text-amber-500"></i>
                        </div>
                        <div>
                            <h4 class="font-bold text-gray-900 text-sm">${p.students?.full_name}</h4>
                            <p class="text-[10px] text-amber-600 font-black uppercase tracking-widest">Decision: ${decision}</p>
                        </div>
                    </div>
                    <button onclick="approveFindings('${p.id}')" 
                        class="bg-gray-900 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-gray-800 transition-all shadow-lg shadow-gray-200">
                        Approve Parent Notify
                    </button>
                </div>
            `;
        }).join('');
        lucide.createIcons();
    }

    window.approveFindings = async (attendanceId) => {
        try {
            utils.showNotification('Approving and notifying parent...', 'info');
            
            const pass = state.attendancePasses.find(p => p.id === attendanceId);
            
            // 1. Get Parent ID
            const { data: parentLink } = await supabase
                .from('parent_students')
                .select('parent_id')
                .eq('student_id', pass.student_id)
                .single();

            if (parentLink) {
                // 2. Notify Parent
                await supabase.from('notifications').insert([{
                    recipient_id: parentLink.parent_id,
                    actor_id: state.user.id,
                    verb: 'clinic_update',
                    object: { 
                        student_name: pass.students?.full_name,
                        details: pass.remarks 
                    }
                }]);
            }

            // 3. Log Audit
            await supabase.from('audit_logs').insert([{
                actor_id: state.user.id,
                action: 'PARENT_NOTIFIED_FROM_CLINIC',
                target_table: 'attendance',
                target_id: attendanceId,
                details: { student_name: pass.students?.full_name }
            }]);

            // Mark as "notified" by updating remarks
            await supabase
                .from('attendance')
                .update({ remarks: pass.remarks + ' | Parent Notified' })
                .eq('id', attendanceId);

            utils.showNotification('Parent notified successfully!', 'success');
            fetchPasses();
        } catch (err) {
            console.error('Approve findings error:', err);
            utils.showNotification(err.message, 'error');
        }
    };

    async function fetchStudents() {
        try {
            // Get teacher's students (homeroom or subject)
            // For now, let's get students from their homeroom
            const { data: teacher } = await supabase
                .from('teachers')
                .select('classes(*)')
                .eq('id', state.user.id)
                .single();

            if (teacher?.classes?.[0]) {
                const { data: students } = await supabase
                    .from('students')
                    .select('id, full_name')
                    .eq('class_id', teacher.classes[0].id)
                    .order('full_name');
                
                state.students = students || [];
                const select = document.getElementById('studentSelect');
                if (select) {
                    select.innerHTML = '<option value="">Select Student</option>' + 
                        state.students.map(s => `<option value="${s.id}">${s.full_name}</option>`).join('');
                }
            }
        } catch (err) {
            console.error('Fetch students error:', err);
        }
    }

    function updateStats() {
        const active = state.attendancePasses.filter(p => p.status === 'pending' || p.status === 'approved' || p.status === 'in_clinic').length;
        document.getElementById('activePassCount').textContent = active;
    }
});