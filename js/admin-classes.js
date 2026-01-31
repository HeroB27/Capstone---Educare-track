import supabase from './supabase-config.js';
import { utils } from './utils.js';

document.addEventListener('DOMContentLoaded', async () => {
    // Check access
    utils.checkAccess(['admin']);

    // Render Layout
    utils.renderAdminLayout('classes');

    const state = {
        classes: [],
        teachers: [],
        currentSchedules: [],
        predefinedSubjects: {
            'Kinder': ['Socio-Emotional', 'Values Education', 'Physical Health', 'Language, Literacy & Comm', 'Mathematics', 'Understanding Phys/Nat Environment'],
            '1': ['Mother Tongue', 'Filipino', 'English', 'Mathematics', 'Araling Panlipunan', 'MAPEH', 'EsP'],
            '2': ['Mother Tongue', 'Filipino', 'English', 'Mathematics', 'Araling Panlipunan', 'MAPEH', 'EsP'],
            '3': ['Mother Tongue', 'Filipino', 'English', 'Mathematics', 'Araling Panlipunan', 'MAPEH', 'EsP'],
            '4': ['Filipino', 'English', 'Mathematics', 'Science', 'Araling Panlipunan', 'EPP', 'MAPEH', 'EsP'],
            '5': ['Filipino', 'English', 'Mathematics', 'Science', 'Araling Panlipunan', 'EPP', 'MAPEH', 'EsP'],
            '6': ['Filipino', 'English', 'Mathematics', 'Science', 'Araling Panlipunan', 'EPP', 'MAPEH', 'EsP'],
            '7': ['Filipino', 'English', 'Mathematics', 'Science', 'Araling Panlipunan', 'MAPEH', 'EsP', 'TLE'],
            '8': ['Filipino', 'English', 'Mathematics', 'Science', 'Araling Panlipunan', 'MAPEH', 'EsP', 'TLE'],
            '9': ['Filipino', 'English', 'Mathematics', 'Science', 'Araling Panlipunan', 'MAPEH', 'EsP', 'TLE'],
            '10': ['Filipino', 'English', 'Mathematics', 'Science', 'Araling Panlipunan', 'MAPEH', 'EsP', 'TLE'],
            'STEM': ['Pre-Calculus', 'Basic Calculus', 'General Biology 1', 'General Physics 1', 'General Chemistry 1'],
            'ABM': ['Fundamentals of ABM 1', 'Business Math', 'Organization & Management', 'Principles of Marketing'],
            'HUMSS': ['Creative Writing', 'Intro to World Religions', 'Philippine Politics & Governance', 'Trends, Networks & Critical Thinking'],
            'TVL-ICT': ['Computer Programming', 'Animation', 'Computer Systems Servicing', 'Illustration']
        }
    };

    // Initialize UI
    fetchClasses();
    fetchTeachers();
    initializeModals();

    async function fetchTeachers() {
        const { data } = await supabase.from('profiles').select('id, full_name').eq('role', 'teacher');
        state.teachers = data || [];
    }

    async function fetchClasses() {
        try {
            const { data: classes, error } = await supabase
                .from('classes')
                .select('*, teachers(profiles(full_name))');

            if (error) throw error;
            state.classes = classes || [];
            renderClasses(classes);
            renderRanking(classes);
        } catch (err) {
            console.error('Error fetching classes:', err);
            utils.showNotification('Failed to load classes', 'error');
        }
    }

    function renderRanking(classes) {
        const list = document.getElementById('rankingList');
        if (!list) return;

        // Mock ranking data for now
        const rankedClasses = classes.map(c => ({
            ...c,
            attendanceRate: Math.floor(Math.random() * (100 - 85 + 1)) + 85
        })).sort((a, b) => b.attendanceRate - a.attendanceRate);

        list.innerHTML = rankedClasses.map((c, i) => `
            <div class="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100">
                <div class="flex items-center space-x-3">
                    <span class="text-xs font-bold ${i < 3 ? 'text-yellow-600' : 'text-gray-400'}">#${i + 1}</span>
                    <div>
                        <p class="text-sm font-bold text-gray-900">Grade ${c.grade}</p>
                        <p class="text-[10px] text-gray-500">${(c.grade === '11' || c.grade === '12') && c.strand ? c.strand : 'General'}</p>
                    </div>
                </div>
                <div class="text-right">
                    <p class="text-sm font-bold text-violet-600">${c.attendanceRate}%</p>
                    <div class="w-16 h-1 bg-gray-200 rounded-full mt-1 overflow-hidden">
                        <div class="bg-violet-500 h-full" style="width: ${c.attendanceRate}%"></div>
                    </div>
                </div>
            </div>
        `).join('');
    }

    function renderClasses(classes) {
        const grid = document.getElementById('classesGrid');
        if (!grid) return;

        if (classes.length === 0) {
            grid.innerHTML = `
                <div class="col-span-full bg-white p-12 rounded-2xl border border-gray-100 text-center">
                    <div class="bg-violet-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                        <i data-lucide="book-open" class="text-violet-600 w-8 h-8"></i>
                    </div>
                    <h3 class="text-lg font-bold text-gray-900">No Classes Created</h3>
                    <p class="text-gray-500">Start by creating a new class and assigning a teacher.</p>
                </div>
            `;
            if (window.lucide) window.lucide.createIcons();
            return;
        }

        grid.innerHTML = classes.map(c => `
            <div class="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-all">
                <div class="flex justify-between items-start mb-6">
                    <div class="bg-violet-50 p-3 rounded-xl">
                        <i data-lucide="graduation-cap" class="text-violet-600 w-6 h-6"></i>
                    </div>
                    <div class="flex items-start space-x-2">
                        <div class="text-right">
                            <h4 class="text-xl font-bold text-gray-900">Grade ${c.grade}</h4>
                            <p class="text-xs text-violet-600 font-bold uppercase tracking-widest">${(c.grade === '11' || c.grade === '12') && c.strand ? c.strand : 'General'}</p>
                        </div>
                        <button onclick="openEditClassModal('${c.id}', '${c.grade}', '${c.strand || ''}', '${c.room || ''}')" class="p-1 text-gray-400 hover:text-violet-600 transition-all">
                            <i data-lucide="edit-2" class="w-4 h-4"></i>
                        </button>
                    </div>
                </div>
                
                <div class="space-y-4 mb-8">
                    <div class="flex items-center justify-between text-sm">
                        <div class="flex items-center space-x-2 text-gray-500">
                            <i data-lucide="user" class="w-4 h-4"></i>
                            <span>Adviser:</span>
                        </div>
                        <span class="font-bold text-gray-900">${c.teachers?.profiles?.full_name || 'Not Assigned'}</span>
                    </div>
                    <div class="flex items-center justify-between text-sm">
                        <div class="flex items-center space-x-2 text-gray-500">
                            <i data-lucide="map-pin" class="w-4 h-4"></i>
                            <span>Room:</span>
                        </div>
                        <span class="font-bold text-gray-900">${c.room || 'TBA'}</span>
                    </div>
                </div>

                <div class="grid grid-cols-2 gap-2">
                    <button onclick="openAssignModal('${c.id}', 'Grade ${c.grade}')" class="py-2 bg-violet-600 text-white text-xs font-bold rounded-lg hover:bg-violet-700 transition-all shadow-sm">
                        Assign Teacher
                    </button>
                    <button onclick="viewClassStudents('${c.id}', 'Grade ${c.grade} ${c.strand || ''}')" class="py-2 bg-violet-50 text-violet-600 text-xs font-bold rounded-lg hover:bg-violet-100 transition-all">
                        View Students
                    </button>
                    <button onclick="deleteClass('${c.id}')" class="col-span-2 py-2 bg-gray-50 text-gray-400 text-xs font-bold rounded-lg hover:text-red-600 hover:bg-red-50 transition-all border border-gray-100">
                        Delete Class
                    </button>
                </div>
            </div>
        `).join('');
        
        if (window.lucide) {
            window.lucide.createIcons();
        }
    }

    function initializeModals() {
        const createModal = document.getElementById('createClassModal');
        const addClassBtn = document.getElementById('addClassBtn');
        const closeCreateBtn = document.querySelector('.close-create-modal');
        const createForm = document.getElementById('createClassForm');
        const gradeSelect = document.getElementById('newClassGrade');
        const strandContainer = document.getElementById('newClassStrandContainer');

        gradeSelect?.addEventListener('change', () => {
            const isSeniorHigh = gradeSelect.value === '11' || gradeSelect.value === '12';
            strandContainer.classList.toggle('hidden', !isSeniorHigh);
            if (!isSeniorHigh) document.getElementById('newClassStrand').value = '';
        });

        addClassBtn?.addEventListener('click', () => createModal.classList.remove('hidden'));
        closeCreateBtn?.addEventListener('click', () => createModal.classList.add('hidden'));
        createForm?.addEventListener('submit', async (e) => {
            e.preventDefault();
            await submitCreateClass();
        });

        // View Students Modal
        const viewStudentsModal = document.getElementById('viewStudentsModal');
        const closeViewStudentsBtns = document.querySelectorAll('.close-view-students-modal');
        closeViewStudentsBtns.forEach(btn => btn.addEventListener('click', () => viewStudentsModal.classList.add('hidden')));

        // Assign Teacher Modal
        const closeAssignBtns = document.querySelectorAll('.close-assign-modal');
        closeAssignBtns.forEach(btn => btn.addEventListener('click', () => {
            document.getElementById('assignTeacherModal').classList.add('hidden');
        }));

        // Edit Class Modal
        const editModal = document.getElementById('editClassModal');
        const closeEditBtns = document.querySelectorAll('.close-edit-modal');
        const editForm = document.getElementById('editClassForm');
        const editGradeSelect = document.getElementById('editClassGrade');
        const editStrandContainer = document.getElementById('editClassStrandContainer');

        editGradeSelect?.addEventListener('change', () => {
            const isSeniorHigh = editGradeSelect.value === '11' || editGradeSelect.value === '12';
            editStrandContainer.classList.toggle('hidden', !isSeniorHigh);
            if (!isSeniorHigh) document.getElementById('editClassStrand').value = '';
        });

        closeEditBtns.forEach(btn => btn.addEventListener('click', () => editModal.classList.add('hidden')));
        editForm?.addEventListener('submit', async (e) => {
            e.preventDefault();
            await submitEditClass();
        });

        const addScheduleBtn = document.getElementById('addScheduleBtn');
        addScheduleBtn?.addEventListener('click', () => {
            const grade = document.getElementById('assignClassName').value.split(' ')[1]; // Extract grade
            const subjects = state.predefinedSubjects[grade] || state.predefinedSubjects['1'];
            
            state.currentSchedules.push({
                subject: subjects[0],
                teacher_id: state.teachers[0]?.id,
                start_time: '08:00',
                end_time: '09:00'
            });
            renderScheduleItems();
        });

        const assignForm = document.getElementById('assignTeacherForm');
        assignForm?.addEventListener('submit', async (e) => {
            e.preventDefault();
            await saveClassConfiguration();
        });

        // Transfer Student Modal
        const transferModal = document.getElementById('transferStudentModal');
        const closeTransferBtns = document.querySelectorAll('.close-transfer-modal');
        const transferForm = document.getElementById('transferStudentForm');

        closeTransferBtns.forEach(btn => btn.addEventListener('click', () => transferModal.classList.add('hidden')));
        transferForm?.addEventListener('submit', async (e) => {
            e.preventDefault();
            await submitTransferStudent();
        });
    }

    window.openTransferModal = (studentId, studentName) => {
        document.getElementById('transferStudentID').value = studentId;
        document.getElementById('transferStudentName').innerText = studentName;
        
        const select = document.getElementById('transferClassSelect');
        select.innerHTML = state.classes.map(c => `
            <option value="${c.id}">Grade ${c.grade} ${c.strand || ''} (${c.room || 'No Room'})</option>
        `).join('');
        
        document.getElementById('transferStudentModal').classList.remove('hidden');
    };

    async function submitTransferStudent() {
        const studentId = document.getElementById('transferStudentID').value;
        const newClassId = document.getElementById('transferClassSelect').value;
        
        const newClass = state.classes.find(c => c.id === newClassId);

        try {
            const { error } = await supabase.from('students').update({
                class_id: newClassId,
                grade_level: newClass.grade,
                strand: newClass.strand
            }).eq('id', studentId);

            if (error) throw error;

            // Log Audit
            await supabase.from('audit_logs').insert([{
                actor_id: (utils.getCurrentUser()).id,
                action: 'TRANSFER_STUDENT',
                target_table: 'students',
                target_id: studentId,
                details: { from_class: 'previous', to_class: newClassId }
            }]);

            utils.showNotification('Student transferred successfully!', 'success');
            document.getElementById('transferStudentModal').classList.add('hidden');
            document.getElementById('viewStudentsModal').classList.add('hidden');
            fetchClasses();
        } catch (err) {
            utils.showNotification(err.message, 'error');
        }
    }

    window.openEditClassModal = (id, grade, strand, room) => {
        document.getElementById('editClassID').value = id;
        document.getElementById('editClassGrade').value = grade;
        document.getElementById('editClassStrand').value = strand;
        document.getElementById('editClassRoom').value = room;
        
        const isSeniorHigh = grade === '11' || grade === '12';
        document.getElementById('editClassStrandContainer').classList.toggle('hidden', !isSeniorHigh);
        
        document.getElementById('editClassModal').classList.remove('hidden');
    };

    async function submitEditClass() {
        const id = document.getElementById('editClassID').value;
        const grade = document.getElementById('editClassGrade').value;
        const strand = document.getElementById('editClassStrand').value;
        const room = document.getElementById('editClassRoom').value;

        try {
            const { error } = await supabase.from('classes').update({
                grade,
                strand: strand || null,
                room
            }).eq('id', id);

            if (error) throw error;

            // Log Audit
            await supabase.from('audit_logs').insert([{
                actor_id: (utils.getCurrentUser()).id,
                action: 'UPDATE_CLASS',
                target_table: 'classes',
                target_id: id,
                details: { grade, strand, room }
            }]);

            utils.showNotification('Class updated successfully!', 'success');
            document.getElementById('editClassModal').classList.add('hidden');
            fetchClasses();
        } catch (err) {
            utils.showNotification(err.message, 'error');
        }
    }

    window.openAssignModal = async (id, name) => {
        document.getElementById('assignClassID').value = id;
        document.getElementById('assignClassName').value = name;
        
        try {
            // Fetch current class adviser
            const { data: cls } = await supabase.from('classes').select('adviser_id').eq('id', id).single();
            const adviserSelect = document.getElementById('adviserSelect');
            adviserSelect.innerHTML = `<option value="">Select Adviser</option>` + 
                state.teachers.map(t => `<option value="${t.id}" ${t.id === cls.adviser_id ? 'selected' : ''}>${t.full_name}</option>`).join('');

            // Fetch current schedules
            const { data: schedules } = await supabase.from('class_schedules').select('*').eq('class_id', id);
            state.currentSchedules = schedules || [];
            renderScheduleItems();
            
            document.getElementById('assignTeacherModal').classList.remove('hidden');
        } catch (err) {
            utils.showNotification('Failed to load class configuration', 'error');
        }
    };

    window.viewClassStudents = async (classId, classInfo) => {
        const modal = document.getElementById('viewStudentsModal');
        const list = document.getElementById('classStudentsList');
        const info = document.getElementById('viewStudentsClassInfo');

        info.innerText = classInfo;
        list.innerHTML = `<tr><td colspan="3" class="px-6 py-12 text-center text-gray-400">Loading students...</td></tr>`;
        modal.classList.remove('hidden');

        try {
            const { data: students, error } = await supabase
                .from('students')
                .select('full_name, lrn, id')
                .eq('class_id', classId)
                .order('full_name');

            if (error) throw error;

            if (!students || students.length === 0) {
                list.innerHTML = `<tr><td colspan="3" class="px-6 py-12 text-center text-gray-400">No students enrolled in this class yet.</td></tr>`;
                return;
            }

            list.innerHTML = students.map(s => `
                <tr class="hover:bg-gray-50 transition-all">
                    <td class="px-6 py-4">
                        <div class="flex items-center space-x-3">
                            <div class="w-8 h-8 rounded-full bg-violet-100 flex items-center justify-center text-xs font-bold text-violet-600">
                                ${s.full_name[0]}
                            </div>
                            <span class="font-bold text-gray-900">${s.full_name}</span>
                        </div>
                    </td>
                    <td class="px-6 py-4 text-sm text-gray-500">${s.lrn}</td>
                    <td class="px-6 py-4 text-right flex justify-end space-x-3">
                        <button onclick="openTransferModal('${s.id}', '${s.full_name}')" class="text-indigo-600 hover:text-indigo-800 font-bold text-xs uppercase tracking-widest">
                            Transfer
                        </button>
                        <button onclick="window.location.href='admin-ids.html?search=${s.lrn}'" class="text-violet-600 hover:text-violet-800 font-bold text-xs uppercase tracking-widest">
                            View ID
                        </button>
                    </td>
                </tr>
            `).join('');
        } catch (err) {
            console.error('Error fetching class students:', err);
            list.innerHTML = `<tr><td colspan="3" class="px-6 py-12 text-center text-red-500">Failed to load students.</td></tr>`;
        }
    };

    function renderScheduleItems() {
        const list = document.getElementById('scheduleList');
        if (!list) return;

        const grade = document.getElementById('assignClassName').value.split(' ')[1];
        const subjects = state.predefinedSubjects[grade] || [];
        
        list.innerHTML = state.currentSchedules.map((s, i) => `
            <div class="grid grid-cols-12 gap-2 items-center bg-gray-50 p-3 rounded-xl border border-gray-100">
                <div class="col-span-4">
                    <select onchange="updateSchedule(${i}, 'subject', this.value)" class="w-full text-xs p-2 border border-gray-200 rounded-lg outline-none">
                        ${subjects.map(sub => `<option value="${sub}" ${sub === s.subject ? 'selected' : ''}>${sub}</option>`).join('')}
                        <option value="Custom" ${!subjects.includes(s.subject) ? 'selected' : ''}>Custom...</option>
                    </select>
                </div>
                <div class="col-span-4">
                    <select onchange="updateSchedule(${i}, 'teacher_id', this.value)" class="w-full text-xs p-2 border border-gray-200 rounded-lg outline-none">
                        ${state.teachers.map(t => `<option value="${t.id}" ${t.id === s.teacher_id ? 'selected' : ''}>${t.full_name}</option>`).join('')}
                    </select>
                </div>
                <div class="col-span-3 flex space-x-1">
                    <input type="time" value="${s.start_time}" onchange="updateSchedule(${i}, 'start_time', this.value)" class="w-full text-[10px] p-1 border border-gray-200 rounded-lg outline-none">
                </div>
                <div class="col-span-1 text-right">
                    <button type="button" onclick="removeSchedule(${i})" class="text-red-400 hover:text-red-600">
                        <i data-lucide="trash-2" class="w-4 h-4"></i>
                    </button>
                </div>
            </div>
        `).join('');
        if (window.lucide) window.lucide.createIcons();
    }

    window.updateSchedule = (i, field, value) => {
        state.currentSchedules[i][field] = value;
    };

    window.removeSchedule = (i) => {
        state.currentSchedules.splice(i, 1);
        renderScheduleItems();
    };

    async function saveClassConfiguration() {
        const classId = document.getElementById('assignClassID').value;
        const adviserId = document.getElementById('adviserSelect').value;

        try {
            // 1. Update Class Adviser
            await supabase.from('classes').update({ adviser_id: adviserId || null }).eq('id', classId);

            // 2. Delete existing schedules for this class
            await supabase.from('class_schedules').delete().eq('class_id', classId);

            // 3. Insert new schedules
            if (state.currentSchedules.length > 0) {
                const schedulesToInsert = state.currentSchedules.map(s => ({
                    class_id: classId,
                    subject: s.subject,
                    teacher_id: s.teacher_id,
                    start_time: s.start_time,
                    end_time: s.end_time || '17:00'
                }));
                await supabase.from('class_schedules').insert(schedulesToInsert);
            }

            utils.showNotification('Class configuration saved successfully!', 'success');
            document.getElementById('assignTeacherModal').classList.add('hidden');
            fetchClasses();
        } catch (err) {
            utils.showNotification(err.message, 'error');
        }
    }

    async function submitCreateClass() {
        const grade = document.getElementById('newClassGrade').value;
        const isSeniorHigh = grade === '11' || grade === '12';
        const strand = isSeniorHigh ? document.getElementById('newClassStrand').value : null;
        const room = document.getElementById('newClassRoom').value;

        try {
            const { error } = await supabase.from('classes').insert([{
                grade,
                strand,
                room
            }]);

            if (error) throw error;

            utils.showNotification('Class created successfully!', 'success');
            document.getElementById('createClassModal').classList.add('hidden');
            document.getElementById('createClassForm').reset();
            fetchClasses();
        } catch (err) {
            utils.showNotification(err.message, 'error');
        }
    }

    window.deleteClass = async (id) => {
        if (!confirm('Are you sure you want to delete this class? This may affect student assignments.')) return;

        try {
            const { error } = await supabase.from('classes').delete().eq('id', id);
            if (error) throw error;

            utils.showNotification('Class deleted successfully', 'success');
            fetchClasses();
        } catch (err) {
            utils.showNotification(err.message, 'error');
        }
    };
});
