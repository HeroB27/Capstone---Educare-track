const supabase = window.supabaseClient;
const utils = window.utils;

document.addEventListener('DOMContentLoaded', async () => {
    // Check access
    await utils.checkAccess(['admin']);

    // Render Layout
    utils.renderAdminLayout('users');

    const state = {
        currentStep: 1,
        users: [],
        filteredUsers: [],
        tempStudents: [],
        parentPhoto: null,
        studentPhoto: null
    };

    // Initialize UI
    initializeModals();
    fetchUsers();
    setupPhotoUploads();

    function setupPhotoUploads() {
        const studentPhotoInput = document.getElementById('studentPhotoInput');
        const editPhotoInput = document.getElementById('editPhotoInput');

        studentPhotoInput?.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                state.studentPhoto = file;
                const reader = new FileReader();
                reader.onload = (re) => {
                    document.getElementById('studentPhotoPreview').innerHTML = `<img src="${re.target.result}" class="w-full h-full object-cover">`;
                };
                reader.readAsDataURL(file);
            }
        });

        editPhotoInput?.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                state.editPhoto = file;
                const reader = new FileReader();
                reader.onload = (re) => {
                    document.getElementById('editPhotoPreview').innerHTML = `<img src="${re.target.result}" class="w-full h-full object-cover">`;
                };
                reader.readAsDataURL(file);
            }
        });
    }

    async function uploadPhoto(file, path) {
        if (!file) return null;
        try {
            const fileExt = file.name.split('.').pop();
            const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${fileExt}`;
            const filePath = `${path}/${fileName}`;

            const { error: uploadError } = await supabase.storage
                .from('photos')
                .upload(filePath, file);

            if (uploadError) {
                console.error('Photo upload error:', uploadError);
                throw new Error(`Photo upload failed: ${uploadError.message}. Please check if the "photos" bucket is public and has proper RLS policies.`);
            }

            return filePath;
        } catch (err) {
            console.error('Photo upload catch:', err);
            throw err;
        }
    }

    // Search and Filter
    const userSearch = document.getElementById('userSearch');
    const roleFilter = document.getElementById('roleFilter');

    userSearch?.addEventListener('input', filterUsers);
    roleFilter?.addEventListener('change', filterUsers);

    async function fetchUsers() {
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select(`
                    id, full_name, role, phone, email, username, is_active, created_at,
                    teachers(is_gatekeeper)
                `)
                .order('created_at', { ascending: false });

            if (error) throw error;
            state.users = data;
            state.filteredUsers = data;
            renderUsers();
        } catch (err) {
            console.error('Error fetching users:', err);
            utils.showNotification('Failed to load users', 'error');
        }
    }

    function filterUsers() {
        const searchTerm = userSearch.value.toLowerCase();
        const role = roleFilter.value;

        state.filteredUsers = state.users.filter(u => {
            const matchesSearch = u.full_name.toLowerCase().includes(searchTerm) || 
                                 (u.username && u.username.toLowerCase().includes(searchTerm)) ||
                                 (u.phone && u.phone.includes(searchTerm));
            const matchesRole = role === 'all' || u.role === role;
            return matchesSearch && matchesRole;
        });

        renderUsers();
    }

    function renderUsers() {
        const tbody = document.getElementById('userTableBody');
        if (!tbody) return;

        if (state.filteredUsers.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" class="px-6 py-12 text-center text-gray-500 italic">
                        No users found matching your criteria
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = state.filteredUsers.map(u => `
            <tr class="border-b border-gray-50 hover:bg-gray-50 transition-all">
                <td class="px-6 py-4">
                    <div class="flex items-center space-x-3">
                        <div class="w-10 h-10 rounded-full bg-violet-100 flex items-center justify-center text-sm font-bold text-violet-600">
                            ${u.full_name[0]}
                        </div>
                        <div>
                            <p class="font-bold text-gray-900">${u.full_name}</p>
                            <p class="text-xs text-gray-500">${u.username || 'No username'}</p>
                        </div>
                    </div>
                </td>
                <td class="px-6 py-4">
                    <span class="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        u.role === 'admin' ? 'bg-purple-100 text-purple-700' :
                        u.role === 'teacher' ? 'bg-blue-100 text-blue-700' :
                        u.role === 'parent' ? 'bg-green-100 text-green-700' : 
                        u.role === 'clinic' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-700'
                    }">${u.role}</span>
                </td>
                <td class="px-6 py-4 text-sm text-gray-600">
                    <p>${u.phone || 'N/A'}</p>
                    <p class="text-xs text-gray-400">${u.email || ''}</p>
                </td>
                <td class="px-6 py-4">
                    <span class="flex items-center space-x-2 ${u.is_active ? 'text-green-600' : 'text-gray-400'}">
                        <span class="w-2 h-2 rounded-full ${u.is_active ? 'bg-green-500' : 'bg-gray-300'}"></span>
                        <span class="text-xs font-bold uppercase">${u.is_active ? 'Active' : 'Inactive'}</span>
                    </span>
                </td>
                <td class="px-6 py-4">
                    ${u.role === 'teacher' ? `
                        <label class="relative inline-flex items-center cursor-pointer">
                            <input type="checkbox" value="" class="sr-only peer" ${u.teachers?.is_gatekeeper ? 'checked' : ''} onchange="toggleGatekeeper('${u.id}', this.checked)">
                            <div class="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-violet-600"></div>
                        </label>
                    ` : '<span class="text-gray-300">-</span>'}
                </td>
                <td class="px-6 py-4">
                    <div class="flex items-center space-x-2">
                        ${u.role === 'parent' ? `
                            <button onclick="viewAssociatedStudents('${u.id}')" class="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all" title="View Children">
                                <i data-lucide="users" class="w-5 h-5"></i>
                            </button>
                        ` : ''}
                        <button onclick="editUser('${u.id}')" class="p-2 text-gray-400 hover:text-violet-600 hover:bg-violet-50 rounded-lg transition-all" title="Edit Profile">
                            <i data-lucide="edit-3" class="w-5 h-5"></i>
                        </button>
                        <button onclick="deleteUser('${u.id}')" class="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all" title="Delete User">
                            <i data-lucide="trash-2" class="w-5 h-5"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');
        
        if (window.lucide) {
            window.lucide.createIcons();
        }
    }

    window.toggleGatekeeper = async (id, isGatekeeper) => {
        try {
            const { error } = await supabase
                .from('teachers')
                .update({ is_gatekeeper: isGatekeeper })
                .eq('id', id);

            if (error) throw error;
            utils.showNotification(`Gatekeeper role ${isGatekeeper ? 'assigned' : 'revoked'}`, 'success');
        } catch (err) {
            console.error('Error toggling gatekeeper:', err);
            utils.showNotification('Failed to update gatekeeper role', 'error');
            fetchUsers(); // Refresh to revert UI
        }
    };

    function initializeModals() {
        // Staff Modal initialization moved to staff modal logic section

        // Parent Student Modal
        const psModal = document.getElementById('parentStudentModal');
        const addPSBtn = document.getElementById('addParentStudentBtn');
        const closePSBtns = document.querySelectorAll('.close-modal');
        const nextBtn = document.getElementById('nextStep');
        const prevBtn = document.getElementById('prevStep');
        const addAnotherBtn = document.getElementById('addAnotherStudentBtn');

        addAnotherBtn?.addEventListener('click', () => {
            const name = document.getElementById('studentFullName').value;
            const lrn = document.getElementById('studentLRN').value;
            const grade = document.getElementById('studentGrade').value;
            const isSeniorHigh = grade === '11' || grade === '12';
            const strand = isSeniorHigh ? document.getElementById('studentStrand').value : null;

            if (!name || !lrn) return utils.showNotification('Please fill student name and LRN', 'error');

            state.tempStudents.push({
                name, lrn, grade, strand,
                photo: state.studentPhoto
            });

            // Reset student form
            document.getElementById('studentFullName').value = '';
            document.getElementById('studentLRN').value = '';
            document.getElementById('studentGrade').value = 'Kinder';
            document.getElementById('studentPhotoPreview').innerHTML = '<i data-lucide="camera" class="text-gray-400 w-8 h-8"></i>';
            state.studentPhoto = null;
            if (window.lucide) window.lucide.createIcons();

            renderTempStudents();
        });

        addPSBtn?.addEventListener('click', () => {
            state.currentStep = 1;
            state.tempStudents = [];
            state.studentPhoto = null;
            document.getElementById('studentPhotoPreview').innerHTML = '<i data-lucide="camera" class="text-gray-400 w-8 h-8"></i>';
            renderTempStudents();
            updateModalStep();
            psModal.classList.remove('hidden');
        });

        // Parent Username Auto-fill
        const parentPhone = document.getElementById('parentPhone');
        const parentUsername = document.getElementById('parentUsername');
        parentPhone?.addEventListener('input', () => {
            if (!parentUsername.value || parentUsername.value === parentPhone.value.slice(0, -1)) {
                parentUsername.value = parentPhone.value;
            }
        });

        closePSBtns.forEach(btn => btn.addEventListener('click', () => psModal.classList.add('hidden')));

        nextBtn?.addEventListener('click', async () => {
            if (state.currentStep === 1) {
                if (!document.getElementById('parentFullName').value || !document.getElementById('parentPhone').value) {
                    return utils.showNotification('Please fill parent details', 'error');
                }
                state.currentStep = 2;
                updateModalStep();
            } else if (state.currentStep === 2) {
                if (!document.getElementById('parentEmail').value || !document.getElementById('parentUsername').value || !document.getElementById('parentPassword').value) {
                    return utils.showNotification('Please fill account details', 'error');
                }
                state.currentStep = 3;
                updateModalStep();
            } else if (state.currentStep === 3) {
                // If there's data in the inputs but not in temp list, add it automatically
                const name = document.getElementById('studentFullName').value;
                const lrn = document.getElementById('studentLRN').value;
                const grade = document.getElementById('studentGrade').value;
                const isSeniorHigh = grade === '11' || grade === '12';

                if (name && lrn) {
                    state.tempStudents.push({
                        name, lrn, grade,
                        strand: isSeniorHigh ? document.getElementById('studentStrand').value : null,
                        photo: state.studentPhoto
                    });
                }

                if (state.tempStudents.length === 0) {
                    return utils.showNotification('Please add at least one student', 'error');
                }

                generateIDPreview();
                state.currentStep = 4;
                updateModalStep();
            } else if (state.currentStep === 4) {
                await submitParentStudent();
            }
        });

        prevBtn?.addEventListener('click', () => {
            if (state.currentStep > 1) {
                state.currentStep--;
                updateModalStep();
            }
        });

        // Edit Modal
        const editModal = document.getElementById('editUserModal');
        const editForm = document.getElementById('editUserForm');
        const closeEditBtns = document.querySelectorAll('.close-edit-modal');

        closeEditBtns.forEach(btn => btn.addEventListener('click', () => editModal.classList.add('hidden')));
        editForm?.addEventListener('submit', async (e) => {
            e.preventDefault();
            await submitEditUser();
        });

        // Quick View Modal
        const qvModal = document.getElementById('quickViewModal');
        const closeQvBtns = document.querySelectorAll('.close-qv-modal');
        closeQvBtns.forEach(btn => btn.addEventListener('click', () => qvModal.classList.add('hidden')));

        // Bulk Print
        document.getElementById('bulkPrintBtn')?.addEventListener('click', () => {
            window.print();
        });
    }

    function renderTempStudents() {
        const list = document.getElementById('tempStudentList');
        if (!list) return;

        if (state.tempStudents.length === 0) {
            list.innerHTML = '<p class="text-xs text-gray-400 italic">No students added yet.</p>';
            return;
        }

        list.innerHTML = state.tempStudents.map((s, i) => `
            <div class="flex items-center justify-between bg-white p-2 rounded-lg border border-violet-100 shadow-sm">
                <div class="flex items-center space-x-2">
                    <div class="w-6 h-6 rounded-full bg-violet-100 flex items-center justify-center text-[10px] font-bold text-violet-600">
                        ${s.name[0]}
                    </div>
                    <div>
                        <p class="text-[10px] font-bold text-gray-900">${s.name}</p>
                        <p class="text-[8px] text-gray-500">Grade ${s.grade} ${s.strand || ''}</p>
                    </div>
                </div>
                <button type="button" onclick="removeTempStudent(${i})" class="text-red-400 hover:text-red-600">
                    <i data-lucide="x" class="w-3 h-3"></i>
                </button>
            </div>
        `).join('');
        if (window.lucide) window.lucide.createIcons();
    }

    window.removeTempStudent = (i) => {
        state.tempStudents.splice(i, 1);
        renderTempStudents();
    };

    // --- Staff Modal Logic ---
    let currentStaffStep = 1;
    const staffModal = document.getElementById('staffModal');

    function updateStaffModal() {
        document.querySelectorAll('.staff-step-content').forEach(el => el.classList.add('hidden'));
        document.getElementById(`staffStep${currentStaffStep}`).classList.remove('hidden');

        const circles = document.querySelectorAll('.staff-step-circle');
        const line = document.getElementById('staff-step-line');
        if (line) line.style.width = `${((currentStaffStep - 1) / (circles.length - 1)) * 100}%`;

        circles.forEach((circle, idx) => {
            const step = idx + 1;
            if (step < currentStaffStep) {
                circle.className = 'staff-step-circle w-8 h-8 rounded-full bg-green-500 text-white flex items-center justify-center font-bold mb-2';
                circle.innerHTML = '<i data-lucide="check" class="w-4 h-4"></i>';
            } else if (step === currentStaffStep) {
                circle.className = 'staff-step-circle w-8 h-8 rounded-full bg-violet-600 text-white flex items-center justify-center font-bold mb-2';
                circle.innerHTML = step;
            } else {
                circle.className = 'staff-step-circle w-8 h-8 rounded-full bg-gray-200 text-gray-600 flex items-center justify-center font-bold mb-2';
                circle.innerHTML = step;
            }
        });

        document.getElementById('prevStaffStep').classList.toggle('hidden', currentStaffStep === 1);
        const nextBtn = document.getElementById('nextStaffStep');
        nextBtn.innerText = currentStaffStep === 3 ? 'Finish' : 'Next';

        if (currentStaffStep === 3) {
            const role = document.getElementById('staffRole').value;
            const phone = document.getElementById('staffPhone').value;
            const staffID = utils.generateStaffID(role, new Date().getFullYear(), phone);
            document.getElementById('generatedStaffIDDisplay').textContent = staffID;
        }

        if (window.lucide) window.lucide.createIcons();
    }

    window.selectStaffRole = (role) => {
        document.getElementById('staffRole').value = role;
        document.querySelectorAll('.role-option').forEach(opt => {
            opt.classList.remove('border-violet-600', 'bg-violet-50');
            if (opt.getAttribute('onclick').includes(role)) {
                opt.classList.add('border-violet-600', 'bg-violet-50');
            }
        });
        document.getElementById('teacherFields').classList.toggle('hidden', role !== 'teacher');
        currentStaffStep = 2;
        updateStaffModal();
    };

    document.getElementById('nextStaffStep')?.addEventListener('click', () => {
        if (currentStaffStep === 1) {
            if (!document.getElementById('staffRole').value) {
                return utils.showNotification('Please select a role', 'warning');
            }
            currentStaffStep++;
        } else if (currentStaffStep === 2) {
            const name = document.getElementById('staffFullName').value;
            const phone = document.getElementById('staffPhone').value;
            const email = document.getElementById('staffEmail').value;
            if (!name || !phone || !email) {
                return utils.showNotification('Please fill in all personal details', 'warning');
            }
            currentStaffStep++;
        } else {
            submitStaffRegistration();
        }
        updateStaffModal();
    });

    document.getElementById('prevStaffStep')?.addEventListener('click', () => {
        if (currentStaffStep > 1) {
            currentStaffStep--;
            updateStaffModal();
        }
    });

    async function submitStaffRegistration() {
        const role = document.getElementById('staffRole').value;
        const fullName = document.getElementById('staffFullName').value;
        const phone = document.getElementById('staffPhone').value;
        const email = document.getElementById('staffEmail').value.trim().toLowerCase();
        const username = document.getElementById('staffUsername').value;
        const password = document.getElementById('staffPassword').value;
        const employeeID = document.getElementById('staffEmployeeID').value;

        try {
            utils.showNotification('Creating staff account...', 'info');

            const { data: sessionData } = await supabase.auth.getSession();
            const accessToken = sessionData?.session?.access_token;
            if (!accessToken) throw new Error('Session expired. Please sign in again.');

            const { SUPABASE_URL, SUPABASE_ANON_KEY } = await import('../js/supabase-config.js');
            const resp = await fetch(`${SUPABASE_URL}/functions/v1/admin-create-user`, {
                method: 'POST',
                headers: {
                    apikey: SUPABASE_ANON_KEY,
                    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
                    'x-authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    email,
                    password,
                    role,
                    full_name: fullName,
                    phone,
                    username,
                    employee_no: role === 'teacher' ? (employeeID || null) : null
                })
            });
            const created = await resp.json().catch(() => ({}));
            if (!resp.ok) throw new Error(created?.error || `Registration failed (${resp.status})`);

            utils.showNotification(`Staff account created successfully! ID: ${created.id}`, 'success');
            staffModal.classList.add('hidden');
            resetStaffForm();
            fetchUsers();
        } catch (err) {
            utils.showNotification(err.message, 'error');
        }
    }

    function resetStaffForm() {
        currentStaffStep = 1;
        document.getElementById('staffRole').value = '';
        document.getElementById('staffFullName').value = '';
        document.getElementById('staffPhone').value = '';
        document.getElementById('staffEmail').value = '';
        document.getElementById('staffUsername').value = '';
        document.getElementById('staffPassword').value = '';
        document.getElementById('staffEmployeeID').value = '';
        updateStaffModal();
    }

    // Modal Toggles
    document.getElementById('addStaffBtn')?.addEventListener('click', () => {
        resetStaffForm();
        document.getElementById('staffModal').classList.remove('hidden');
    });

    document.querySelectorAll('.close-staff-modal').forEach(btn => {
        btn.addEventListener('click', () => {
            document.getElementById('staffModal').classList.add('hidden');
        });
    });

    async function submitParentStudent() {
        const parentFullName = document.getElementById('parentFullName').value;
        const parentPhone = document.getElementById('parentPhone').value;
        const parentAddress = document.getElementById('parentAddress').value;
        const parentEmail = document.getElementById('parentEmail').value.trim().toLowerCase();
        const parentUsername = document.getElementById('parentUsername').value;
        const parentPassword = document.getElementById('parentPassword').value;
        const relationship = document.getElementById('parentRoleType').value;

        try {
            utils.showNotification('Registering parent and students...', 'info');

            const { data: sessionData } = await supabase.auth.getSession();
            const accessToken = sessionData?.session?.access_token;
            if (!accessToken) throw new Error('Session expired. Please sign in again.');

            const { SUPABASE_URL, SUPABASE_ANON_KEY } = await import('../js/supabase-config.js');
            const resp = await fetch(`${SUPABASE_URL}/functions/v1/admin-create-user`, {
                method: 'POST',
                headers: {
                    apikey: SUPABASE_ANON_KEY,
                    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
                    'x-authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    email: parentEmail,
                    password: parentPassword,
                    role: 'parent',
                    full_name: parentFullName,
                    phone: parentPhone,
                    username: parentUsername,
                    address: parentAddress
                })
            });
            const created = await resp.json().catch(() => ({}));
            if (!resp.ok) throw new Error(created?.error || `Registration failed (${resp.status})`);

            const parentId = created.id;

            // 3. Create Students and Link
            for (const s of state.tempStudents) {
                const photoUrl = await uploadPhoto(s.photo, 'students');
                const studentID = utils.generateStudentID(new Date().getFullYear(), s.lrn);

                const { error: sError } = await supabase.from('students').insert([{
                    id: studentID,
                    lrn: s.lrn,
                    full_name: s.name,
                    address: parentAddress,
                    grade_level: s.grade,
                    strand: s.strand,
                    photo_url: photoUrl,
                    current_status: 'out'
                }]);

                if (sError) {
                    console.error('Student creation error:', sError);
                    throw new Error(`Student registration failed (${s.name}): ${sError.message}`);
                }

                const { error: psError } = await supabase.from('parent_students').insert([{
                    parent_id: parentId,
                    student_id: studentID,
                    relationship: relationship
                }]);

                if (psError) {
                    console.error('Relationship link error:', psError);
                    throw new Error(`Linking student ${s.name} failed: ${psError.message}`);
                }

                const { error: qrError } = await supabase.from('qr_codes').insert([{
                    student_id: studentID,
                    qr_hash: studentID,
                    is_active: true,
                    created_by: (utils.getCurrentUser())?.id
                }]);

                if (qrError) {
                    console.error('QR code error:', qrError);
                    // Don't throw here, just log it as the student is already created
                    utils.showNotification(`Warning: QR code generation failed for ${s.name}`, 'warning');
                }
            }

            utils.showNotification(`Parent and ${state.tempStudents.length} students added successfully!`, 'success');
            document.getElementById('parentStudentModal').classList.add('hidden');
            state.tempStudents = [];
            fetchUsers();
        } catch (err) {
            console.error('Registration failed:', err);
            utils.showNotification(err.message || 'An unexpected error occurred', 'error');
        }
    }

    function updateModalStep() {
        const steps = [1, 2, 3, 4];
        steps.forEach(s => {
            const el = document.getElementById(`step${s}`);
            if (el) el.classList.add('hidden');
            
            const circles = document.querySelectorAll('.step-circle');
            if (circles[s-1]) {
                if (s < state.currentStep) {
                    circles[s-1].classList.replace('bg-violet-600', 'bg-green-500');
                    circles[s-1].classList.replace('bg-gray-200', 'bg-green-500');
                    circles[s-1].innerHTML = '<i data-lucide="check" class="w-4 h-4 text-white"></i>';
                } else if (s === state.currentStep) {
                    circles[s-1].classList.replace('bg-gray-200', 'bg-violet-600');
                    circles[s-1].classList.replace('bg-green-500', 'bg-violet-600');
                    circles[s-1].innerHTML = `<span class="text-white">${s}</span>`;
                } else {
                    circles[s-1].classList.add('bg-gray-200');
                    circles[s-1].classList.remove('bg-violet-600', 'bg-green-500');
                    circles[s-1].innerHTML = `<span class="text-gray-600">${s}</span>`;
                }
            }
        });
        
        document.getElementById(`step${state.currentStep}`)?.classList.remove('hidden');
        document.getElementById('prevStep')?.classList.toggle('hidden', state.currentStep === 1);
        const nextBtn = document.getElementById('nextStep');
        if (nextBtn) nextBtn.innerText = state.currentStep === 4 ? 'Save & Finish' : 'Next';
        
        const line = document.getElementById('step-line');
        if (line) line.style.width = `${((state.currentStep - 1) / 3) * 100}%`;
        
        if (window.lucide) window.lucide.createIcons();
    }

    function generateIDPreview() {
        const container = document.getElementById('previewCardsContainer');
        if (!container) return;
        
        const total = state.tempStudents.length;
        if (total === 0) {
            container.innerHTML = '<p class="text-gray-400 italic">No students to preview</p>';
            return;
        }
        
        const parentFullName = document.getElementById('parentFullName').value;
        const parentPhone = document.getElementById('parentPhone').value;
        const parentAddress = document.getElementById('parentAddress').value;

        container.innerHTML = state.tempStudents.map((s, index) => {
            const studentID = utils.generateStudentID(new Date().getFullYear(), s.lrn);
            const photoUrl = s.photo ? URL.createObjectURL(s.photo) : null;
            
            return `
                <div class="bg-white border border-gray-200 shadow-xl flex shrink-0 relative" style="width: 500px; height: 300px;">
                    <div class="absolute top-2 left-2 bg-violet-600 text-white text-[10px] px-2 py-0.5 rounded-full font-bold z-10">
                        Student ${index + 1}
                    </div>
                    <!-- Front -->
                    <div class="w-1/2 p-4 border-r border-dashed border-gray-300 flex flex-col items-center text-center">
                        <p class="text-[10px] font-bold text-violet-700 uppercase">Educare Colleges Inc</p>
                        <p class="text-[8px] text-gray-500">Purok 4 Irisan Baguio City</p>
                        <div class="w-24 h-24 bg-gray-100 rounded-full my-3 flex items-center justify-center border-2 border-violet-100 overflow-hidden">
                            ${photoUrl ? `<img src="${photoUrl}" class="w-full h-full object-cover">` : '<i data-lucide="user" class="text-gray-300 w-12 h-12"></i>'}
                        </div>
                        <p class="text-sm font-bold text-gray-900 leading-tight">${s.name}</p>
                        <p class="text-[8px] text-gray-500 mt-1">${parentAddress}</p>
                        <p class="text-[10px] font-bold text-violet-600 mt-2">Grade ${s.grade} ${s.strand || ''}</p>
                    </div>
                    <!-- Back -->
                    <div class="w-1/2 p-4 flex flex-col items-center justify-between">
                        <div id="qr-${index}" class="w-24 h-24 bg-white p-1"></div>
                        <div class="text-center">
                            <p class="text-[10px] font-mono text-gray-900 font-bold">${studentID}</p>
                            <p class="text-[8px] text-gray-500 mt-1">Guardian: ${parentFullName}</p>
                            <p class="text-[8px] text-gray-500">Contact: ${parentPhone}</p>
                        </div>
                        <p class="text-[6px] text-gray-400 mt-2">If found, please return to Educare Colleges Inc.</p>
                    </div>
                </div>
            `;
        }).join('');

        // Generate QRs for each card
        state.tempStudents.forEach((s, index) => {
            const studentID = utils.generateStudentID(new Date().getFullYear(), s.lrn);
            const qrEl = document.getElementById(`qr-${index}`);
            if (qrEl) {
                new QRCode(qrEl, {
                    text: studentID,
                    width: 96,
                    height: 96,
                    colorDark: "#000000",
                    colorLight: "#ffffff",
                    correctLevel: QRCode.Level ? QRCode.Level.H : 2
                });
            }
        });

        if (window.lucide) window.lucide.createIcons();
    }

    // CRUD Window functions
    window.editUser = async (id) => {
        const user = state.users.find(u => u.id === id);
        if (!user) return;

        state.editPhoto = null;
        document.getElementById('editUserID').value = user.id;
        document.getElementById('editFullName').value = user.full_name;
        document.getElementById('editPhone').value = user.phone || '';
        document.getElementById('editEmail').value = user.email || '';
        document.getElementById('editStatus').value = user.is_active.toString();
        
        // Reset photo preview
        const photoPreview = document.getElementById('editPhotoPreview');
        if (user.photo_url) {
            const { data } = supabase.storage.from('photos').getPublicUrl(user.photo_url);
            photoPreview.innerHTML = `<img src="${data.publicUrl}" class="w-full h-full object-cover">`;
        } else {
            photoPreview.innerHTML = '<i data-lucide="user" class="text-gray-300 w-12 h-12"></i>';
        }

        // Reset extra fields
        document.getElementById('parentExtraFields').classList.add('hidden');
        document.getElementById('teacherExtraFields').classList.add('hidden');
        document.getElementById('guardExtraFields').classList.add('hidden');
        document.getElementById('clinicExtraFields').classList.add('hidden');

        // Role-specific field loading
        if (user.role === 'parent') {
            document.getElementById('parentExtraFields').classList.remove('hidden');
            const { data: parent } = await supabase.from('parents').select('address').eq('id', id).single();
            document.getElementById('editAddress').value = parent?.address || '';
        } else if (user.role === 'teacher') {
            document.getElementById('teacherExtraFields').classList.remove('hidden');
            const { data: teacher } = await supabase.from('teachers').select('employee_no, is_gatekeeper').eq('id', id).single();
            document.getElementById('editEmployeeNo').value = teacher?.employee_no || '';
            document.getElementById('editIsGatekeeper').checked = teacher?.is_gatekeeper || false;
        } else if (user.role === 'guard') {
            document.getElementById('guardExtraFields').classList.remove('hidden');
            const { data: guard } = await supabase.from('guards').select('shift, assigned_gate').eq('id', id).single();
            document.getElementById('editShift').value = guard?.shift || 'Day';
            document.getElementById('editGate').value = guard?.assigned_gate || 'Main Gate';
        } else if (user.role === 'clinic') {
            document.getElementById('clinicExtraFields').classList.remove('hidden');
            const { data: clinic } = await supabase.from('clinic_staff').select('license_no, position').eq('id', id).single();
            document.getElementById('editLicense').value = clinic?.license_no || '';
            document.getElementById('editPosition').value = clinic?.position || 'School Nurse';
        }
        
        // Reset password fields
        document.getElementById('editPassword').value = '';
        document.getElementById('editConfirmPassword').value = '';

        document.getElementById('editUserModal').classList.remove('hidden');
        if (window.lucide) window.lucide.createIcons();
    };

    async function submitEditUser() {
        const id = document.getElementById('editUserID').value;
        const full_name = document.getElementById('editFullName').value;
        const phone = document.getElementById('editPhone').value;
        const email = document.getElementById('editEmail').value.trim().toLowerCase();
        const is_active = document.getElementById('editStatus').value === 'true';
        const password = document.getElementById('editPassword').value;
        const confirmPassword = document.getElementById('editConfirmPassword').value;
        
        const user = state.users.find(u => u.id === id);

        // Validation
        if (password && password !== confirmPassword) {
            return utils.showNotification('Passwords do not match!', 'error');
        }

        try {
            utils.showNotification('Updating profile...', 'info');

            const { data: sessionData } = await supabase.auth.getSession();
            const accessToken = sessionData?.session?.access_token;
            if (!accessToken) throw new Error('Session expired. Please sign in again.');
            
            let photoUrl = user.photo_url;
            if (state.editPhoto) {
                photoUrl = await uploadPhoto(state.editPhoto, user.role === 'parent' ? 'parents' : 'staff');
            }

            const { SUPABASE_URL, SUPABASE_ANON_KEY } = await import('../js/supabase-config.js');
            const resp = await fetch(`${SUPABASE_URL}/functions/v1/admin-update-user`, {
                method: 'POST',
                headers: {
                    apikey: SUPABASE_ANON_KEY,
                    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
                    'x-authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    user_id: id,
                    email,
                    password: password || undefined,
                    full_name,
                    phone,
                    is_active
                })
            });
            const updateResp = await resp.json().catch(() => ({}));
            if (!resp.ok) throw new Error(updateResp?.error || `Update failed (${resp.status})`);

            const { error: pError } = await supabase.from('profiles').update({ photo_url: photoUrl }).eq('id', id);
            if (pError) throw pError;

            // Log Audit
            await supabase.from('audit_logs').insert([{
                actor_id: (utils.getCurrentUser()).id,
                action: 'UPDATE_USER_PROFILE',
                target_table: 'profiles',
                target_id: id,
                details: { full_name, role: user.role }
            }]);

            // 2. Update Role-Specific Records
            if (user.role === 'parent') {
                const address = document.getElementById('editAddress').value;
                const { error: parentError } = await supabase.from('parents').update({ address }).eq('id', id);
                if (parentError) throw parentError;
            } else if (user.role === 'teacher') {
                const employee_no = document.getElementById('editEmployeeNo').value;
                const is_gatekeeper = document.getElementById('editIsGatekeeper').checked;
                const { error: teacherError } = await supabase.from('teachers').update({ employee_no, is_gatekeeper }).eq('id', id);
                if (teacherError) throw teacherError;
            } else if (user.role === 'guard') {
                const shift = document.getElementById('editShift').value;
                const assigned_gate = document.getElementById('editGate').value;
                const { error: guardError } = await supabase.from('guards').update({ shift, assigned_gate }).eq('id', id);
                if (guardError) throw guardError;
            } else if (user.role === 'clinic') {
                const license_no = document.getElementById('editLicense').value;
                const position = document.getElementById('editPosition').value;
                const { error: clinicError } = await supabase.from('clinic_staff').update({ license_no, position }).eq('id', id);
                if (clinicError) throw clinicError;
            }

            utils.showNotification('Profile updated successfully!', 'success');
            document.getElementById('editUserModal').classList.add('hidden');
            fetchUsers();
        } catch (err) {
            console.error('Update failed:', err);
            utils.showNotification(err.message, 'error');
        }
    }

    window.viewAssociatedStudents = async (parentId) => {
        try {
            const { data: students, error } = await supabase
                .from('parent_students')
                .select('students(*)')
                .eq('parent_id', parentId);

            if (error) throw error;

            if (!students || students.length === 0) {
                return utils.showNotification('No students linked to this parent', 'info');
            }

            // For now, if multiple, show first one's quick view
            // In a better UI, we'd show a list first
            viewStudentProfile(students[0].students);
        } catch (err) {
            utils.showNotification('Failed to load linked students', 'error');
        }
    };

    window.viewStudentProfile = async (student) => {
        const modal = document.getElementById('quickViewModal');
        
        // Basic Info
        document.getElementById('qvName').innerText = student.full_name;
        document.getElementById('qvLRN').innerText = `LRN: ${student.lrn}`;
        document.getElementById('qvClass').innerText = `Grade ${student.grade_level} ${student.strand || ''}`;
        
        // Photo
        const photoContainer = document.getElementById('qvPhoto');
        if (student.photo_url) {
            const { data } = supabase.storage.from('photos').getPublicUrl(student.photo_url);
            photoContainer.innerHTML = `<img src="${data.publicUrl}" class="w-full h-full object-cover">`;
        } else {
            photoContainer.innerHTML = '<i data-lucide="user" class="text-violet-400 w-10 h-10"></i>';
        }

        modal.classList.remove('hidden');
        if (window.lucide) window.lucide.createIcons();

        // Admin Override Logic (Test 5.1)
        const overrideBtn = document.getElementById('btnOverrideAtt');
        const overrideStatus = document.getElementById('overrideStatus');
        
        if (overrideBtn) {
            overrideBtn.onclick = async () => {
                const status = overrideStatus.value;
                if (!confirm(`Are you sure you want to OVERRIDE attendance for ${student.full_name} to ${status.toUpperCase()}? This will be logged.`)) return;

                try {
                    utils.showNotification('Applying override...', 'info');
                    
                    // 1. Insert new attendance row (Append-only)
                    const { error: attError } = await supabase.from('attendance').insert([{
                        student_id: student.id,
                        status: status,
                        method: 'manual',
                        recorded_by: (utils.getCurrentUser()).id,
                        remarks: `Admin Override: Set to ${status}`,
                        timestamp: new Date().toISOString(),
                        session: new Date().getHours() < 12 ? 'AM' : 'PM'
                    }]);

                    if (attError) throw attError;

                    // 2. Log Audit
                    await supabase.from('audit_logs').insert([{
                        actor_id: (utils.getCurrentUser()).id,
                        action: 'ADMIN_ATTENDANCE_OVERRIDE',
                        target_table: 'attendance',
                        target_id: student.id,
                        details: { student_name: student.full_name, new_status: status }
                    }]);

                    utils.showNotification('Attendance override successful!', 'success');
                    // Refresh modal content
                    window.viewStudentProfile(student);
                } catch (err) {
                    console.error('Override failed:', err);
                    utils.showNotification(err.message, 'error');
                }
            };
        }

        // Load stats
        try {
            const [attData, clinicData, parentData] = await Promise.all([
                supabase.from('attendance').select('*').eq('student_id', student.id).order('timestamp', { ascending: false }).limit(5),
                supabase.from('clinic_visits').select('*', { count: 'exact' }).eq('student_id', student.id),
                supabase.from('parent_students').select('parents(profiles(phone))').eq('student_id', student.id).single()
            ]);

            // Stats
            const totalAtt = await supabase.from('attendance').select('*', { count: 'exact', head: true }).eq('student_id', student.id);
            const presentAtt = await supabase.from('attendance').select('*', { count: 'exact', head: true }).eq('student_id', student.id).in('status', ['present', 'late']);
            
            const rate = totalAtt.count > 0 ? Math.round((presentAtt.count / totalAtt.count) * 100) : 100;
            document.getElementById('qvAttendance').innerText = `${rate}%`;
            document.getElementById('qvClinic').innerText = clinicData.count || 0;
            document.getElementById('qvPhone').innerText = parentData.data?.parents?.profiles?.phone || 'N/A';

            // Recent Attendance List
            const attList = document.getElementById('qvAttendanceList');
            if (attData.data?.length > 0) {
                attList.innerHTML = attData.data.map(a => `
                    <div class="flex items-center justify-between p-2 bg-white rounded-lg border border-gray-50">
                        <span class="text-xs font-medium text-gray-600">${utils.formatDate(a.timestamp)}</span>
                        <span class="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                            a.status === 'present' ? 'bg-green-100 text-green-700' :
                            a.status === 'late' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'
                        }">${a.status}</span>
                    </div>
                `).join('');
            } else {
                attList.innerHTML = '<p class="text-xs text-gray-400 italic">No attendance records yet</p>';
            }

        } catch (err) {
            console.error('Error loading profile stats:', err);
        }
    };
    window.deleteUser = async (id) => {
        if (!confirm('Are you sure you want to delete this user? This action cannot be undone.')) return;

        try {
            const { error } = await supabase.from('profiles').delete().eq('id', id);
            
            if (error) {
                if (error.code === '23503') {
                    if (confirm('This user has associated records (attendance, classes, etc.). Would you like to deactivate them instead?')) {
                        const { error: updError } = await supabase.from('profiles').update({ is_active: false }).eq('id', id);
                        if (updError) throw updError;
                        utils.showNotification('User deactivated', 'success');
                        
                        // Log Audit
                        await supabase.from('audit_logs').insert([{
                            actor_id: (utils.getCurrentUser()).id,
                            action: 'DEACTIVATE_USER',
                            target_table: 'profiles',
                            target_id: id
                        }]);
                    }
                } else {
                    throw error;
                }
            } else {
                utils.showNotification('User deleted successfully', 'success');
                // Log Audit
                await supabase.from('audit_logs').insert([{
                    actor_id: (utils.getCurrentUser()).id,
                    action: 'DELETE_USER',
                    target_table: 'profiles',
                    target_id: id
                }]);
            }
            
            fetchUsers();
        } catch (err) {
            utils.showNotification(err.message, 'error');
        }
    };
});

