// Shared Utility Functions (Global Version)
window.utils = {
    // Show notification toast
    showNotification: (message, type = 'info', duration = 3000) => {
        const toast = document.createElement('div');
        toast.className = `fixed bottom-4 right-4 p-4 rounded-lg shadow-lg text-white transform transition-all duration-300 translate-y-0 z-50 ${
            type === 'success' ? 'bg-green-500' : 
            type === 'error' ? 'bg-red-500' : 
            type === 'warning' ? 'bg-yellow-500' : 'bg-blue-500'
        }`;
        toast.innerText = message;
        document.body.appendChild(toast);
        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    },

    // Format date
    formatDate: (date) => {
        return new Date(date).toLocaleDateString('en-PH', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    },

    // Format time
    formatTime: (date) => {
        return new Date(date).toLocaleTimeString('en-PH', {
            hour: '2-digit',
            minute: '2-digit'
        });
    },

    // Get current user from local storage
    getCurrentUser: () => {
        const user = localStorage.getItem('educare_user');
        return user ? JSON.parse(user) : null;
    },

    loadCurrentUser: async () => {

        const cached = window.utils.getCurrentUser();
        if (cached?.id && cached?.role) {
            const { data: sessionData } = await window.supabaseClient.auth.getSession();
            if (!sessionData?.session) {
                localStorage.removeItem('educare_user');
                return null;
            }
            return cached;
        }

        const { data: userData } = await window.supabaseClient.auth.getUser();
        const authUser = userData?.user;
        if (!authUser) return null;

        const { data: profile, error } = await window.supabaseClient
            .from('profiles')
            .select('*')
            .eq('id', authUser.id)
            .single();

        if (error) throw error;
        if (!profile) return null;

        localStorage.setItem('educare_user', JSON.stringify(profile));
        return profile;
    },

    // Logout
    logout: async () => {
        localStorage.removeItem('educare_user');
        try {
            await window.supabaseClient.auth.signOut();
        } catch (err) {
        }
        window.location.replace('/index.html');
    },
    
    isSchoolDay: async (gradeLevel = null) => {
        try {
            const today = new Date().toISOString().split('T')[0];
            let { data, error } = await window.supabaseClient
                .from('school_calendar')
                .select('*');
            if (!error && Array.isArray(data)) {
                let rows = data.filter(e => {
                    const s = e.start_date || e.event_date;
                    const ed = e.end_date || e.event_date;
                    const t = e.type || '';
                    return s && ed && s <= today && ed >= today && ['holiday', 'suspension'].includes(t);
                });
                if (gradeLevel) {
                    rows = rows.filter(e => {
                        const scope = e.grade_scope || '';
                        return !scope || scope === 'all' || scope === gradeLevel;
                    });
                }
                if (rows.length > 0) return false;
            }
            const { data: legacy } = await window.supabaseClient
                .from('school_calendar')
                .select('*')
                .eq('event_date', today);
            let legacyRows = Array.isArray(legacy) ? legacy : [];
            legacyRows = legacyRows.filter(e => {
                const d = (e.description || '').toLowerCase();
                const t = (e.type || '').toLowerCase() || d;
                if (!/holiday|suspension/.test(t)) return false;
                if (!gradeLevel) return true;
                const scope = (e.grade_scope || '').toLowerCase() || d;
                if (scope.includes('all')) return true;
                const gl = String(gradeLevel).toLowerCase();
                return scope.includes(gl) || scope.includes(`grade ${gl}`);
            });
            return legacyRows.length === 0;
        } catch (err) {
            return true;
        }
    },

    // Role-based redirect check
    checkAccess: async (allowedRoles) => {
        try {
            const user = await utils.loadCurrentUser();
            if (!user) {
                window.location.replace('/index.html');
                return null;
            }

            // Check activity status
            if (user.is_active === false) {
                console.warn('Access blocked: Account is inactive.');
                localStorage.removeItem('educare_user');
                await window.supabaseClient.auth.signOut().catch(() => {});
                window.location.replace('/index.html');
                return null;
            }

            if (!allowedRoles.includes(user.role)) {
                console.warn('Access blocked: Unauthorized role.', user.role);
                window.location.replace('/index.html');
                return null;
            }
            return user;
        } catch (err) {
            console.error('Access check failed:', err);
            localStorage.removeItem('educare_user');
            window.location.replace('/index.html');
            return null;
        }
    },

    // Generate Student ID
    generateStudentID: (year, LRN) => {
        const cleanLRN = LRN.toString().replace(/\D/g, '');
        const last4 = cleanLRN.slice(-4);
        const randomStr = Math.random().toString(36).substring(2, 6).toUpperCase();
        return `EDU-${year}-${last4}-${randomStr}`;
    },

    // Generate Secure QR Hash
    generateQRHash: () => {
        return crypto.randomUUID();
    },

    // Generate User ID for Staff
    generateStaffID: (role, year, phone) => {
        const prefix = role === 'admin' ? 'ADM' : 
                       role === 'teacher' ? 'TCH' : 
                       role === 'clinic' ? 'CLC' : 'GRD';
        const last4Phone = phone.toString().replace(/\D/g, '').slice(-4);
        const randomStr = Math.random().toString(36).substring(2, 6).toUpperCase();
        return `${prefix}-${year}-${last4Phone}-${randomStr}`;
    },

    // Render Admin Layout
    renderAdminLayout: (activeSection) => {
        const sidebar = document.getElementById('sidebar');
        const mainHeader = document.querySelector('main header');
        const user = utils.getCurrentUser();

        if (sidebar) {
            sidebar.innerHTML = `
                <div class="p-6 flex flex-col h-full">
                    <div class="flex items-center space-x-3 mb-8">
                        <div class="bg-violet-100 p-2 rounded-lg">
                            <i data-lucide="graduation-cap" class="text-violet-600 w-6 h-6"></i>
                        </div>
                        <span class="text-xl font-bold text-gray-900 tracking-tight">EDUCARE<span class="text-violet-600">TRACK</span></span>
                    </div>

                    <nav class="space-y-1 flex-1 overflow-y-auto">
                        <a href="admin-dashboard.html" class="nav-link w-full flex items-center space-x-3 px-4 py-3 rounded-xl ${activeSection === 'dashboard' ? 'bg-violet-50 text-violet-600 font-bold' : 'text-gray-600 hover:bg-gray-50 font-medium'} transition-all">
                            <i data-lucide="layout-dashboard" class="w-5 h-5"></i>
                            <span>Dashboard</span>
                        </a>
                        <a href="admin-users.html" class="nav-link w-full flex items-center space-x-3 px-4 py-3 rounded-xl ${activeSection === 'users' ? 'bg-violet-50 text-violet-600 font-bold' : 'text-gray-600 hover:bg-gray-50 font-medium'} transition-all">
                            <i data-lucide="users" class="w-5 h-5"></i>
                            <span>User Management</span>
                        </a>
                        <a href="admin-classes.html" class="nav-link w-full flex items-center space-x-3 px-4 py-3 rounded-xl ${activeSection === 'classes' ? 'bg-violet-50 text-violet-600 font-bold' : 'text-gray-600 hover:bg-gray-50 font-medium'} transition-all">
                            <i data-lucide="book-open" class="w-5 h-5"></i>
                            <span>Class Management</span>
                        </a>
                        <a href="admin-analytics.html" class="nav-link w-full flex items-center space-x-3 px-4 py-3 rounded-xl ${activeSection === 'analytics' ? 'bg-violet-50 text-violet-600 font-bold' : 'text-gray-600 hover:bg-gray-50 font-medium'} transition-all">
                            <i data-lucide="bar-chart-3" class="w-5 h-5"></i>
                            <span>Data Analytics</span>
                        </a>
                        <a href="admin-announcements.html" class="nav-link w-full flex items-center space-x-3 px-4 py-3 rounded-xl ${activeSection === 'announcements' ? 'bg-violet-50 text-violet-600 font-bold' : 'text-gray-600 hover:bg-gray-50 font-medium'} transition-all">
                            <i data-lucide="megaphone" class="w-5 h-5"></i>
                            <span>Announcements</span>
                        </a>
                        <a href="admin-ids.html" class="nav-link w-full flex items-center space-x-3 px-4 py-3 rounded-xl ${activeSection === 'ids' ? 'bg-violet-50 text-violet-600 font-bold' : 'text-gray-600 hover:bg-gray-50 font-medium'} transition-all">
                            <i data-lucide="id-card" class="w-5 h-5"></i>
                            <span>ID Management</span>
                        </a>
                        <a href="admin-calendar.html" class="nav-link w-full flex items-center space-x-3 px-4 py-3 rounded-xl ${activeSection === 'calendar' ? 'bg-violet-50 text-violet-600 font-bold' : 'text-gray-600 hover:bg-gray-50 font-medium'} transition-all">
                            <i data-lucide="calendar" class="w-5 h-5"></i>
                            <span>School Calendar</span>
                        </a>
                        <a href="admin-settings.html" class="nav-link w-full flex items-center space-x-3 px-4 py-3 rounded-xl ${activeSection === 'settings' ? 'bg-violet-50 text-violet-600 font-bold' : 'text-gray-600 hover:bg-gray-50 font-medium'} transition-all">
                            <i data-lucide="settings" class="w-5 h-5"></i>
                            <span>Tap Settings</span>
                        </a>
                    </nav>

                    <div class="pt-6 border-t border-gray-100">
                        <button id="logoutBtn" class="w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-red-600 hover:bg-red-50 transition-all font-bold">
                            <i data-lucide="log-out" class="w-5 h-5"></i>
                            <span>Logout</span>
                        </button>
                    </div>
                </div>
            `;
            document.getElementById('logoutBtn')?.addEventListener('click', utils.logout);
        }

        if (mainHeader) {
            mainHeader.innerHTML = `
                <div>
                    <h2 id="sectionTitle" class="text-2xl font-black text-gray-900 tracking-tight">${activeSection.charAt(0).toUpperCase() + activeSection.slice(1)}</h2>
                    <p id="sectionSubtitle" class="text-gray-500 font-medium">Welcome back, Administrator</p>
                </div>
                <div class="flex items-center space-x-4">
                    <button class="relative p-2 text-gray-400 hover:text-gray-600 bg-white rounded-full border border-gray-200 shadow-sm transition-all hover:shadow-md">
                        <i data-lucide="bell" class="w-6 h-6"></i>
                        <span class="absolute top-0 right-0 w-3 h-3 bg-red-500 rounded-full border-2 border-white"></span>
                    </button>
                    <div class="flex items-center space-x-3 bg-white p-2 rounded-full border border-gray-200 shadow-sm pr-4 hover:shadow-md transition-all cursor-pointer">
                        <div class="w-10 h-10 bg-violet-100 rounded-full flex items-center justify-center text-violet-600 font-black">
                            ${user ? user.full_name[0] : 'A'}
                        </div>
                        <div>
                            <p class="text-sm font-black text-gray-900 leading-none">${user ? user.full_name : 'Admin'}</p>
                            <p class="text-[10px] text-gray-500 font-bold uppercase tracking-widest mt-1">Super User</p>
                        </div>
                    </div>
                </div>
            `;
        }

        if (window.lucide) {
            window.lucide.createIcons();
        }
    },

    // Render Teacher Layout
    renderTeacherLayout: (activeSection) => {
        const sidebar = document.getElementById('sidebar');
        const mainHeader = document.querySelector('main header');
        const user = utils.getCurrentUser();

        if (sidebar) {
            sidebar.innerHTML = `
                <div class="p-6 flex flex-col h-full">
                    <div class="flex items-center space-x-3 mb-8">
                        <div class="bg-blue-100 p-2 rounded-lg">
                            <i data-lucide="book-open" class="text-blue-600 w-6 h-6"></i>
                        </div>
                        <span class="text-xl font-bold text-gray-900 tracking-tight">EDUCARE<span class="text-blue-600">TRACK</span></span>
                    </div>

                    <nav class="space-y-1 flex-1 overflow-y-auto">
                        <a href="teacher-dashboard.html" class="nav-link w-full flex items-center space-x-3 px-4 py-3 rounded-xl ${activeSection === 'dashboard' ? 'bg-blue-50 text-blue-600 font-bold' : 'text-gray-600 hover:bg-gray-50 font-medium'} transition-all">
                            <i data-lucide="layout-dashboard" class="w-5 h-5"></i>
                            <span>Dashboard</span>
                        </a>
                        <a href="teacher-homeroom.html" class="nav-link w-full flex items-center space-x-3 px-4 py-3 rounded-xl ${activeSection === 'homeroom' ? 'bg-blue-50 text-blue-600 font-bold' : 'text-gray-600 hover:bg-gray-50 font-medium'} transition-all">
                            <i data-lucide="home" class="w-5 h-5"></i>
                            <span>Homeroom</span>
                        </a>
                        <a href="teacher-attendance.html" class="nav-link w-full flex items-center space-x-3 px-4 py-3 rounded-xl ${activeSection === 'attendance' ? 'bg-blue-50 text-blue-600 font-bold' : 'text-gray-600 hover:bg-gray-50 font-medium'} transition-all">
                            <i data-lucide="check-square" class="w-5 h-5"></i>
                            <span>Roll Call</span>
                        </a>
                        <a href="teacher-excuse.html" class="nav-link w-full flex items-center space-x-3 px-4 py-3 rounded-xl ${activeSection === 'excuse' ? 'bg-blue-50 text-blue-600 font-bold' : 'text-gray-600 hover:bg-gray-50 font-medium'} transition-all">
                            <i data-lucide="file-text" class="w-5 h-5"></i>
                            <span>Excuse Letters</span>
                        </a>
                        <a href="teacher-clinic.html" class="nav-link w-full flex items-center space-x-3 px-4 py-3 rounded-xl ${activeSection === 'clinic' ? 'bg-blue-50 text-blue-600 font-bold' : 'text-gray-600 hover:bg-gray-50 font-medium'} transition-all">
                            <i data-lucide="stethoscope" class="w-5 h-5"></i>
                            <span>Clinic Passes</span>
                        </a>
                        <a href="teacher-announcements.html" class="nav-link w-full flex items-center space-x-3 px-4 py-3 rounded-xl ${activeSection === 'announcements' ? 'bg-blue-50 text-blue-600 font-bold' : 'text-gray-600 hover:bg-gray-50 font-medium'} transition-all">
                            <i data-lucide="megaphone" class="w-5 h-5"></i>
                            <span>Announcements</span>
                        </a>
                        <a href="teacher-gatekeeper.html" class="nav-link w-full flex items-center space-x-3 px-4 py-3 rounded-xl ${activeSection === 'gatekeeper' ? 'bg-blue-50 text-blue-600 font-bold' : 'text-gray-600 hover:bg-gray-50 font-medium'} transition-all">
                            <i data-lucide="shield-check" class="w-5 h-5"></i>
                            <span>Gatekeeper Mode</span>
                        </a>
                    </nav>

                    <div class="pt-6 border-t border-gray-100">
                        <button id="logoutBtn" class="w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-red-600 hover:bg-red-50 transition-all font-bold">
                            <i data-lucide="log-out" class="w-5 h-5"></i>
                            <span>Logout</span>
                        </button>
                    </div>
                </div>
            `;
            document.getElementById('logoutBtn')?.addEventListener('click', utils.logout);
        }

        if (mainHeader) {
            mainHeader.innerHTML = `
                <div>
                    <h2 id="sectionTitle" class="text-2xl font-black text-gray-900 tracking-tight">${activeSection.charAt(0).toUpperCase() + activeSection.slice(1)}</h2>
                    <p id="sectionSubtitle" class="text-gray-500 font-medium">Welcome back, ${user ? user.full_name : 'Teacher'}</p>
                </div>
                <div class="flex items-center space-x-4">
                    <div class="flex items-center space-x-3 bg-white p-2 rounded-full border border-gray-200 shadow-sm pr-4 hover:shadow-md transition-all cursor-pointer">
                        <div class="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-black">
                            ${user ? user.full_name[0] : 'T'}
                        </div>
                        <div>
                            <p class="text-sm font-black text-gray-900 leading-none">${user ? user.full_name : 'Teacher'}</p>
                            <p id="headerRole" class="text-[10px] text-gray-500 font-bold uppercase tracking-widest mt-1">Faculty Member</p>
                        </div>
                    </div>
                </div>
            `;
        }

        if (window.lucide) {
            window.lucide.createIcons();
        }
    },

    // Render Parent Layout
    renderParentLayout: (activeSection) => {
        const sidebar = document.getElementById('sidebar');
        const mainHeader = document.querySelector('main header');
        const user = utils.getCurrentUser();

        if (sidebar) {
            sidebar.innerHTML = `
                <div class="p-6 flex flex-col h-full">
                    <div class="flex items-center space-x-3 mb-8">
                        <div class="bg-green-100 p-2 rounded-lg">
                            <i data-lucide="graduation-cap" class="text-green-600 w-6 h-6"></i>
                        </div>
                        <span class="text-xl font-black text-gray-900 tracking-tight">EDUCARE<span class="text-green-600">TRACK</span></span>
                    </div>

                    <nav class="space-y-1 flex-1 overflow-y-auto">
                        <a href="parent-dashboard.html" class="nav-link w-full flex items-center space-x-3 px-4 py-3 rounded-xl ${activeSection === 'dashboard' ? 'bg-green-50 text-green-600 font-black' : 'text-gray-600 hover:bg-gray-50 font-bold'} transition-all">
                            <i data-lucide="layout-dashboard" class="w-5 h-5"></i>
                            <span>Dashboard</span>
                        </a>
                        <a href="parent-excuse.html" class="nav-link w-full flex items-center space-x-3 px-4 py-3 rounded-xl ${activeSection === 'excuse' ? 'bg-green-50 text-green-600 font-black' : 'text-gray-600 hover:bg-gray-50 font-bold'} transition-all">
                            <i data-lucide="file-text" class="w-5 h-5"></i>
                            <span>Excuse Letters</span>
                        </a>
                    </nav>

                    <div class="pt-6 border-t border-gray-100">
                        <button id="logoutBtn" class="w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-red-600 hover:bg-red-50 transition-all font-bold">
                            <i data-lucide="log-out" class="w-5 h-5"></i>
                            <span>Logout</span>
                        </button>
                    </div>
                </div>
            `;
            document.getElementById('logoutBtn')?.addEventListener('click', utils.logout);
        }

        if (mainHeader) {
            mainHeader.innerHTML = `
                <div>
                    <h2 id="sectionTitle" class="text-3xl font-black text-gray-900 tracking-tight">${activeSection.charAt(0).toUpperCase() + activeSection.slice(1)}</h2>
                    <p id="sectionSubtitle" class="text-gray-500 font-bold uppercase tracking-widest text-[10px] mt-1">Hello, ${user ? user.full_name : 'Parent'}</p>
                </div>
                <div class="flex items-center space-x-4">
                    <div class="flex items-center space-x-3 bg-white p-2 rounded-full border border-gray-200 shadow-sm pr-4 hover:shadow-md transition-all cursor-pointer">
                        <div class="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center text-green-600 font-black">
                            ${user ? user.full_name[0] : 'P'}
                        </div>
                        <div>
                            <p class="text-sm font-black text-gray-900 leading-none">${user ? user.full_name : 'Parent'}</p>
                            <p class="text-[10px] text-gray-500 font-bold uppercase tracking-widest mt-1">Student Guardian</p>
                        </div>
                    </div>
                </div>
            `;
        }
        if (window.lucide) window.lucide.createIcons();
    },

    // Render Guard Layout
    renderGuardLayout: (activeSection) => {
        const sidebar = document.getElementById('sidebar');
        const mainHeader = document.querySelector('main header');
        const user = utils.getCurrentUser();

        if (sidebar) {
            sidebar.innerHTML = `
                <div class="p-6 flex flex-col h-full">
                    <div class="flex items-center space-x-3 mb-8">
                        <div class="bg-yellow-100 p-2 rounded-lg">
                            <i data-lucide="shield-check" class="text-yellow-600 w-6 h-6"></i>
                        </div>
                        <span class="text-xl font-black text-gray-900 tracking-tight">EDUCARE<span class="text-yellow-600">TRACK</span></span>
                    </div>

                    <nav class="space-y-1 flex-1 overflow-y-auto">
                        <a href="guard-dashboard.html" class="nav-link w-full flex items-center space-x-3 px-4 py-3 rounded-xl ${activeSection === 'dashboard' ? 'bg-yellow-50 text-yellow-600 font-black' : 'text-gray-600 hover:bg-gray-50 font-bold'} transition-all">
                            <i data-lucide="qr-code" class="w-5 h-5"></i>
                            <span>Scanner Terminal</span>
                        </a>
                    </nav>

                    <div class="pt-6 border-t border-gray-100">
                        <button id="logoutBtn" class="w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-red-600 hover:bg-red-50 transition-all font-bold">
                            <i data-lucide="log-out" class="w-5 h-5"></i>
                            <span>Logout</span>
                        </button>
                    </div>
                </div>
            `;
            document.getElementById('logoutBtn')?.addEventListener('click', utils.logout);
        }

        if (mainHeader) {
            mainHeader.innerHTML = `
                <div>
                    <h2 id="sectionTitle" class="text-3xl font-black text-gray-900 tracking-tight">${activeSection.charAt(0).toUpperCase() + activeSection.slice(1)}</h2>
                    <p id="sectionSubtitle" class="text-gray-500 font-bold uppercase tracking-widest text-[10px] mt-1">Duty status: Active</p>
                </div>
                <div class="flex items-center space-x-4">
                    <div class="flex items-center space-x-3 bg-white p-2 rounded-full border border-gray-200 shadow-sm pr-4 hover:shadow-md transition-all cursor-pointer">
                        <div class="w-10 h-10 bg-yellow-100 rounded-full flex items-center justify-center text-yellow-600 font-black">
                            ${user ? user.full_name[0] : 'G'}
                        </div>
                        <div>
                            <p class="text-sm font-black text-gray-900 leading-none">${user ? user.full_name : 'Guard'}</p>
                            <p class="text-[10px] text-gray-500 font-bold uppercase tracking-widest mt-1">Security Staff</p>
                        </div>
                    </div>
                </div>
            `;
        }
        if (window.lucide) window.lucide.createIcons();
    },

    // Render Clinic Layout
    renderClinicLayout: (activeSection) => {
        const sidebar = document.getElementById('sidebar');
        const mainHeader = document.querySelector('main header');
        const user = utils.getCurrentUser();

        if (sidebar) {
            sidebar.innerHTML = `
                <div class="p-6 flex flex-col h-full">
                    <div class="flex items-center space-x-3 mb-8">
                        <div class="bg-red-100 p-2 rounded-lg">
                            <i data-lucide="cross" class="text-red-600 w-6 h-6"></i>
                        </div>
                        <span class="text-xl font-black text-gray-900 tracking-tight">EDUCARE<span class="text-red-600">CLINIC</span></span>
                    </div>

                    <nav class="space-y-1 flex-1 overflow-y-auto">
                        <a href="clinic-dashboard.html" class="nav-link w-full flex items-center space-x-3 px-4 py-3 rounded-xl ${activeSection === 'dashboard' ? 'bg-red-50 text-red-600 font-black' : 'text-gray-600 hover:bg-gray-50 font-bold'} transition-all">
                            <i data-lucide="layout-dashboard" class="w-5 h-5"></i>
                            <span>Dashboard</span>
                        </a>
                        <a href="clinic-approval.html" class="nav-link w-full flex items-center space-x-3 px-4 py-3 rounded-xl ${activeSection === 'approval' ? 'bg-red-50 text-red-600 font-black' : 'text-gray-600 hover:bg-gray-50 font-bold'} transition-all">
                            <i data-lucide="check-square" class="w-5 h-5"></i>
                            <span>Pass Approvals</span>
                        </a>
                        <a href="clinic-checkin.html" class="nav-link w-full flex items-center space-x-3 px-4 py-3 rounded-xl ${activeSection === 'checkin' ? 'bg-red-50 text-red-600 font-black' : 'text-gray-600 hover:bg-gray-50 font-bold'} transition-all">
                            <i data-lucide="qr-code" class="w-5 h-5"></i>
                            <span>QR Check-in</span>
                        </a>
                        <a href="clinic-findings.html" class="nav-link w-full flex items-center space-x-3 px-4 py-3 rounded-xl ${activeSection === 'findings' ? 'bg-red-50 text-red-600 font-black' : 'text-gray-600 hover:bg-gray-50 font-bold'} transition-all">
                            <i data-lucide="stethoscope" class="w-5 h-5"></i>
                            <span>Nurse Findings</span>
                        </a>
                    </nav>

                    <div class="pt-6 border-t border-gray-100">
                        <button id="logoutBtn" class="w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-red-600 hover:bg-red-50 transition-all font-bold">
                            <i data-lucide="log-out" class="w-5 h-5"></i>
                            <span>Logout</span>
                        </button>
                    </div>
                </div>
            `;
            document.getElementById('logoutBtn')?.addEventListener('click', utils.logout);
        }

        if (mainHeader) {
            mainHeader.innerHTML = `
                <div>
                    <h2 id="sectionTitle" class="text-3xl font-black text-gray-900 tracking-tight">${activeSection.charAt(0).toUpperCase() + activeSection.slice(1)}</h2>
                    <p id="sectionSubtitle" class="text-gray-500 font-bold uppercase tracking-widest text-[10px] mt-1">Medical staff on duty</p>
                </div>
                <div class="flex items-center space-x-4">
                    <div class="flex items-center space-x-3 bg-white p-2 rounded-full border border-gray-200 shadow-sm pr-4 hover:shadow-md transition-all cursor-pointer">
                        <div class="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center text-red-600 font-black">
                            ${user ? user.full_name[0] : 'C'}
                        </div>
                        <div>
                            <p class="text-sm font-black text-gray-900 leading-none">${user ? user.full_name : 'Staff'}</p>
                            <p class="text-[10px] text-gray-500 font-bold uppercase tracking-widest mt-1">Nurse / Clinic Staff</p>
                        </div>
                    </div>
                </div>
            `;
        }
        if (window.lucide) window.lucide.createIcons();
    },

    // Initialize Offline Monitoring
    initOfflineMonitoring: () => {
        const banner = document.createElement('div');
        banner.id = 'offline-banner';
        banner.innerHTML = `
            <div class="flex items-center justify-center space-x-2">
                <i data-lucide="wifi-off" class="w-4 h-4"></i>
                <span>You are currently offline. Scans will be queued and synced when connection returns.</span>
            </div>
        `;
        document.body.appendChild(banner);
        if (window.lucide) window.lucide.createIcons();

        const updateStatus = () => {
            if (navigator.onLine) {
                document.body.classList.remove('is-offline');
                utils.showNotification('You are back online! Syncing data...', 'success');
                window.dispatchEvent(new CustomEvent('sync-required'));
            } else {
                document.body.classList.add('is-offline');
                utils.showNotification('Working in offline mode.', 'warning');
            }
        };

        window.addEventListener('online', updateStatus);
        window.addEventListener('offline', updateStatus);
        
        // Initial check
        if (!navigator.onLine) updateStatus();
    }
};
