document.addEventListener('DOMContentLoaded', async () => {
    const state = {
        user: JSON.parse(localStorage.getItem('user')),
        scanning: true,
        lastScanTime: 0
    };

    if (!state.user || state.user.role !== 'clinic') {
        window.location.href = '../index.html';
        return;
    }

    lucide.createIcons();

    const video = document.getElementById('scannerVideo');
    const canvas = document.getElementById('scannerCanvas');
    const ctx = canvas.getContext('2d');

    // Start Camera
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        video.srcObject = stream;
        video.setAttribute('playsinline', true);
        video.play();
        requestAnimationFrame(tick);
    } catch (err) {
        console.error('Camera error:', err);
        utils.showNotification('Could not access camera', 'error');
    }

    function tick() {
        if (video.readyState === video.HAVE_ENOUGH_DATA && state.scanning) {
            canvas.height = video.videoHeight;
            canvas.width = video.videoWidth;
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const code = jsQR(imageData.data, imageData.width, imageData.height, {
                inversionAttempts: 'dontInvert',
            });

            if (code) {
                const now = Date.now();
                if (now - state.lastScanTime > 2000) { // 2s debounce
                    state.lastScanTime = now;
                    handleScan(code.data);
                }
            }
        }
        requestAnimationFrame(tick);
    }

    async function handleScan(studentId) {
        try {
            state.scanning = false;
            utils.showNotification('Checking student ID...', 'info');

            // 1. Validate QR/Student via existing pass
            const { data: attendance, error: attErr } = await supabase
                .from('attendance')
                .select('*, students(*)')
                .eq('student_id', studentId)
                .eq('entry_type', 'clinic')
                .eq('status', 'approved')
                .single();

            if (attErr || !attendance) {
                throw new Error('No approved clinic pass found for this student');
            }

            // 2. Admission Process
            utils.showNotification('Admitting student...', 'info');

            // 2a. Insert clinic_visits
            const { data: visit, error: visitErr } = await supabase
                .from('clinic_visits')
                .insert([{
                    student_id: studentId,
                    treated_by: state.user.id,
                    visit_time: new Date().toISOString()
                }])
                .select()
                .single();

            if (visitErr) throw visitErr;

            // 2b. Update student status
            await supabase
                .from('students')
                .update({ current_status: 'in_clinic' })
                .eq('id', studentId);

            // 2c. Update attendance status
            await supabase
                .from('attendance')
                .update({ status: 'in_clinic' })
                .eq('id', attendance.id);

            // 2d. Notify Teachers (Homeroom + Subject if applicable)
            const { data: homeroom } = await supabase
                .from('classes')
                .select('adviser_id')
                .eq('id', attendance.students.class_id)
                .single();

            const teacherIds = new Set([attendance.recorded_by]); // Original issuer
            if (homeroom?.adviser_id) teacherIds.add(homeroom.adviser_id);

            const notifications = Array.from(teacherIds).map(tid => ({
                recipient_id: tid,
                actor_id: state.user.id,
                verb: 'student_in_clinic',
                object: { 
                    student_id: studentId, 
                    student_name: attendance.students.full_name,
                    visit_id: visit.id
                }
            }));
            await supabase.from('notifications').insert(notifications);

            // 3. Log Audit
            await supabase.from('audit_logs').insert([{
                actor_id: state.user.id,
                action: 'CLINIC_CHECKIN',
                target_table: 'clinic_visits',
                target_id: visit.id,
                details: { student_name: attendance.students.full_name }
            }]);

            utils.showNotification(`Admission successful: ${attendance.students.full_name}`, 'success');
            
            // Wait 3 seconds then resume scanning
            setTimeout(() => {
                state.scanning = true;
            }, 3000);

        } catch (err) {
            console.error('Scan error:', err);
            utils.showNotification(err.message, 'error');
            setTimeout(() => {
                state.scanning = true;
            }, 2000);
        }
    }

    document.getElementById('manualSubmit').addEventListener('click', () => {
        const id = document.getElementById('manualStudentId').value.trim();
        if (id) handleScan(id);
    });
});