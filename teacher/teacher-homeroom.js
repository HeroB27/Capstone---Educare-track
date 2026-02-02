const supabase = window.supabaseClient;
const utils = window.utils;

document.addEventListener('DOMContentLoaded', async () => {
    await utils.checkAccess(['teacher', 'admin']);
    utils.renderTeacherLayout('homeroom');

    const state = {
        user: utils.getCurrentUser(),
        homeroomClass: null,
        students: [],
        filteredStudents: []
    };

    // Initial Data Fetch
    await fetchHomeroomData();

    // Event Listeners
    document.getElementById('studentSearch')?.addEventListener('input', handleSearch);
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('bg-blue-600', 'text-white'));
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.add('text-gray-500'));
            e.target.classList.remove('text-gray-500');
            e.target.classList.add('bg-blue-600', 'text-white');
            handleFilter(e.target.dataset.filter);
        });
    });

    async function fetchHomeroomData() {
        try {
            // 1. Get Homeroom Class
            const { data: teacher } = await supabase
                .from('teachers')
                .select('classes(*)')
                .eq('id', state.user.id)
                .single();

            state.homeroomClass = teacher?.classes?.[0];
            if (!state.homeroomClass) {
                document.getElementById('studentGrid').innerHTML = '<p class="col-span-full text-center py-20 text-gray-400 italic">No homeroom class assigned to your account.</p>';
                return;
            }

            // 2. Get Students
            const { data: students } = await supabase
                .from('students')
                .select('*')
                .eq('class_id', state.homeroomClass.id)
                .order('full_name');

            state.students = students || [];
            state.filteredStudents = [...state.students];
            renderStudentGrid();

        } catch (err) {
            console.error('Homeroom fetch error:', err);
            utils.showNotification('Failed to load homeroom data', 'error');
        }
    }

    function renderStudentGrid() {
        const grid = document.getElementById('studentGrid');
        if (state.filteredStudents.length === 0) {
            grid.innerHTML = '<p class="col-span-full text-center py-20 text-gray-400">No students match your search/filter.</p>';
            return;
        }

        grid.innerHTML = state.filteredStudents.map(s => `
            <div onclick="openStudentProfile('${s.id}')" class="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all cursor-pointer group">
                <div class="flex items-center space-x-4 mb-4">
                    <div class="w-12 h-12 rounded-xl bg-gray-50 flex items-center justify-center border border-gray-100 overflow-hidden">
                        ${s.photo_url ? `<img src="${supabase.storage.from('photos').getPublicUrl(s.photo_url).data.publicUrl}" class="w-full h-full object-cover">` : `<i data-lucide="user" class="text-gray-300 w-6 h-6"></i>`}
                    </div>
                    <div>
                        <h4 class="font-bold text-gray-900 group-hover:text-blue-600 transition-all">${s.full_name}</h4>
                        <p class="text-[10px] text-gray-400 font-mono tracking-widest">${s.lrn}</p>
                    </div>
                </div>
                <div class="flex justify-between items-center pt-4 border-t border-gray-50">
                    <span class="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        s.current_status === 'present' ? 'bg-green-100 text-green-700' :
                        s.current_status === 'late' ? 'bg-yellow-100 text-yellow-700' : 
                        s.current_status === 'excused' ? 'bg-indigo-100 text-indigo-700' :
                        s.current_status === 'clinic' ? 'bg-rose-100 text-rose-700' : 'bg-red-100 text-red-700'
                    }">${s.current_status === 'present' ? 'In School' : s.current_status}</span>
                    <button class="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all">
                        <i data-lucide="chevron-right" class="w-4 h-4"></i>
                    </button>
                </div>
            </div>
        `).join('');
        if (window.lucide) window.lucide.createIcons();
    }

    function handleSearch(e) {
        const query = e.target.value.toLowerCase();
        state.filteredStudents = state.students.filter(s => 
            s.full_name.toLowerCase().includes(query) || 
            s.lrn.includes(query)
        );
        renderStudentGrid();
    }

    function handleFilter(filter) {
        if (filter === 'all') {
            state.filteredStudents = [...state.students];
        } else if (filter === 'present') {
            state.filteredStudents = state.students.filter(s => s.current_status === 'present');
        } else {
            state.filteredStudents = state.students.filter(s => s.current_status === filter);
        }
        renderStudentGrid();
    }

    window.openStudentProfile = async (id) => {
        const student = state.students.find(s => s.id === id);
        if (!student) return;

        const modal = document.getElementById('studentProfileModal');
        
        // Basic Info
        document.getElementById('profName').innerText = student.full_name;
        document.getElementById('profLRN').innerText = `LRN: ${student.lrn}`;
        document.getElementById('profClass').innerText = `Grade ${student.grade_level} ${student.strand || ''}`;
        
        const statusEl = document.getElementById('profStatus');
        statusEl.innerText = student.current_status === 'present' ? 'In School' : student.current_status;
        statusEl.className = `inline-block px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest mb-2 ${
            student.current_status === 'present' ? 'bg-green-100 text-green-700' :
            student.current_status === 'late' ? 'bg-yellow-100 text-yellow-700' : 
            student.current_status === 'excused' ? 'bg-indigo-100 text-indigo-700' :
            student.current_status === 'clinic' ? 'bg-rose-100 text-rose-700' : 'bg-red-100 text-red-700'
        }`;

        // Photo
        const photoContainer = document.getElementById('profPhoto');
        if (student.photo_url) {
            const { data } = supabase.storage.from('photos').getPublicUrl(student.photo_url);
            photoContainer.innerHTML = `<img src="${data.publicUrl}" class="w-full h-full rounded-[1.25rem] object-cover border-2 border-white">`;
        } else {
            photoContainer.innerHTML = '<div class="w-full h-full rounded-[1.25rem] bg-gray-100 flex items-center justify-center border-2 border-white overflow-hidden"><i data-lucide="user" class="text-gray-300 w-12 h-12"></i></div>';
        }

        modal.classList.remove('hidden');
        if (window.lucide) window.lucide.createIcons();

        // Load Stats & Parent Info
        try {
            const [attData, clinicData, parentData] = await Promise.all([
                supabase.from('attendance').select('status', { count: 'exact' }).eq('student_id', student.id),
                supabase.from('clinic_visits').select('*', { count: 'exact' }).eq('student_id', student.id),
                supabase.from('parent_students').select('parents(profiles(full_name, phone))').eq('student_id', student.id).single()
            ]);

            // Calculate Rate
            const total = attData.count || 0;
            const lateCount = (await supabase.from('attendance').select('*', { count: 'exact', head: true }).eq('student_id', student.id).eq('status', 'late')).count;
            const presentCount = (await supabase.from('attendance').select('*', { count: 'exact', head: true }).eq('student_id', student.id).eq('status', 'present')).count;
            
            const rate = total > 0 ? Math.round(((presentCount + lateCount) / total) * 100) : 100;
            
            document.getElementById('profAttRate').innerText = `${rate}%`;
            document.getElementById('profClinicCount').innerText = clinicData.count || 0;
            document.getElementById('profLateCount').innerText = lateCount || 0;

            const parent = parentData.data?.parents?.profiles;
            document.getElementById('profParentName').innerText = parent?.full_name || 'No Parent Linked';
            document.getElementById('profParentPhone').innerText = parent?.phone || 'No phone number';
            document.getElementById('profCallBtn').href = parent?.phone ? `tel:${parent.phone}` : '#';

        } catch (err) {
            console.error('Profile stats error:', err);
        }
    };

    const modal = document.getElementById('studentProfileModal');
    document.querySelectorAll('.close-modal').forEach(btn => btn.addEventListener('click', () => modal.classList.add('hidden')));
});
