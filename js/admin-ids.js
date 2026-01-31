import supabase from './supabase-config.js';
import { utils } from './utils.js';

document.addEventListener('DOMContentLoaded', async () => {
    // Check access
    utils.checkAccess(['admin']);

    // Render Layout
    utils.renderAdminLayout('ids');

    const searchInput = document.getElementById('studentSearch');
    const resultsGrid = document.getElementById('resultsGrid');
    const previewModal = document.getElementById('idPreviewModal');
    const closeBtns = document.querySelectorAll('.close-preview-modal');
    const printBtn = document.getElementById('printIDBtn');

    // Handle search query parameter
    const urlParams = new URLSearchParams(window.location.search);
    const searchQuery = urlParams.get('search');
    if (searchQuery) {
        searchInput.value = searchQuery;
        searchStudents(searchQuery);
    }

    // Search debounce
    let timeout = null;
    searchInput?.addEventListener('input', (e) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => {
            searchStudents(e.target.value);
        }, 300);
    });

    closeBtns.forEach(btn => btn.addEventListener('click', () => {
        previewModal.classList.add('hidden');
    }));

    printBtn?.addEventListener('click', () => {
        window.print();
    });

    document.getElementById('reissueQRBtn')?.addEventListener('click', async () => {
        const studentId = document.getElementById('previewID').innerText;
        if (!confirm('Are you sure you want to REISSUE the QR code for this student? The old QR code will be deactivated.')) return;

        try {
            utils.showNotification('Reissuing QR...', 'info');
            
            // 1. Deactivate old QRs
            await supabase.from('qr_codes').update({ is_active: false }).eq('student_id', studentId);

            // 2. Create new QR entry
            // In this simplified system, the hash is the ID, but in a real one it would be random.
            // We'll just create a new active record.
            const { error } = await supabase.from('qr_codes').insert([{
                student_id: studentId,
                qr_hash: studentId, // Keeping it simple as per existing logic
                is_active: true
            }]);

            if (error) throw error;

            // 3. Log Audit
            await supabase.from('audit_logs').insert([{
                actor_id: (utils.getCurrentUser()).id,
                action: 'REISSUE_QR',
                target_table: 'qr_codes',
                target_id: studentId,
                details: { timestamp: new Date().toISOString() }
            }]);

            utils.showNotification('QR Code reissued successfully!', 'success');
            previewModal.classList.add('hidden');
        } catch (err) {
            console.error('Reissue error:', err);
            utils.showNotification(err.message, 'error');
        }
    });

    async function searchStudents(query) {
        if (!query || query.length < 2) {
            resultsGrid.innerHTML = `
                <div class="col-span-full py-20 text-center text-gray-400">
                    <i data-lucide="user-search" class="w-12 h-12 mx-auto mb-4 opacity-20"></i>
                    <p>Enter a student name or LRN to find records</p>
                </div>
            `;
            if (window.lucide) window.lucide.createIcons();
            return;
        }

        try {
            const { data, error } = await supabase
                .from('students')
                .select('*, parents(profiles(full_name, phone))')
                .or(`full_name.ilike.%${query}%,lrn.ilike.%${query}%`)
                .limit(20);

            if (error) throw error;
            renderResults(data);
        } catch (err) {
            console.error('Error searching students:', err);
            utils.showNotification('Search failed', 'error');
        }
    }

    function renderResults(students) {
        if (!resultsGrid) return;

        if (students.length === 0) {
            resultsGrid.innerHTML = `
                <div class="col-span-full py-20 text-center text-gray-400">
                    <i data-lucide="frown" class="w-12 h-12 mx-auto mb-4 opacity-20"></i>
                    <p>No students found matching "${searchInput.value}"</p>
                </div>
            `;
        } else {
            resultsGrid.innerHTML = students.map(s => {
                let photoHtml = `<div class="w-12 h-12 rounded-full bg-violet-100 flex items-center justify-center text-violet-600 font-bold">${s.full_name[0]}</div>`;
                if (s.photo_url) {
                    const { data: publicUrl } = supabase.storage.from('photos').getPublicUrl(s.photo_url);
                    photoHtml = `<img src="${publicUrl.publicUrl}" class="w-12 h-12 rounded-full object-cover" onerror="this.onerror=null; this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(s.full_name)}&background=EDE9FE&color=7C3AED'">`;
                }

                return `
                <div class="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-all">
                    <div class="flex items-center space-x-4 mb-6">
                        ${photoHtml}
                        <div>
                            <h4 class="font-bold text-gray-900">${s.full_name}</h4>
                            <p class="text-xs text-gray-500">LRN: ${s.lrn}</p>
                        </div>
                    </div>
                    
                    <div class="space-y-3 mb-6">
                        <div class="flex justify-between text-sm">
                            <span class="text-gray-500">Grade:</span>
                            <span class="font-bold text-gray-900">${s.grade_level} ${(s.grade_level === '11' || s.grade_level === '12') && s.strand ? s.strand : ''}</span>
                        </div>
                        <div class="flex justify-between text-sm">
                            <span class="text-gray-500">Student ID:</span>
                            <span class="font-mono font-bold text-violet-600">${s.id}</span>
                        </div>
                    </div>

                    <button onclick="previewID('${s.id}')" class="w-full py-3 bg-violet-50 text-violet-600 font-bold rounded-xl hover:bg-violet-100 transition-all flex items-center justify-center space-x-2">
                        <i data-lucide="eye" class="w-4 h-4"></i>
                        <span>Preview ID Card</span>
                    </button>
                </div>
            `;}).join('');
        }
        if (window.lucide) window.lucide.createIcons();
    }

    window.previewID = async (id) => {
        try {
            const [studentRes, settingsRes] = await Promise.all([
                supabase.from('students').select('*, parent_students(parents(profiles(full_name, phone)))').eq('id', id).single(),
                supabase.from('system_settings').select('*').eq('key', 'school_branding').single()
            ]);

            if (studentRes.error) throw studentRes.error;
            const s = studentRes.data;
            const branding = settingsRes.data?.value || { name: 'EDUCare COLLEGES INC', address: 'Purok 4 Irisan Baguio City' };

            const parentInfo = s.parent_students?.[0]?.parents?.profiles || { full_name: 'N/A', phone: 'N/A' };

            // Apply Branding
            const schoolNameEl = document.querySelector('#idCardPreview .text-violet-700');
            const schoolAddrEl = document.querySelector('#idCardPreview .text-gray-500');
            if (schoolNameEl) schoolNameEl.innerText = branding.name;
            if (schoolAddrEl) schoolAddrEl.innerText = branding.address;

            document.getElementById('previewName').innerText = s.full_name;
            document.getElementById('previewAddress').innerText = s.address || branding.address;
            const isSeniorHigh = s.grade_level === '11' || s.grade_level === '12';
            document.getElementById('previewClass').innerText = `Grade ${s.grade_level} ${isSeniorHigh && s.strand ? s.strand : ''}`;
            document.getElementById('previewID').innerText = s.id;
            document.getElementById('previewParent').innerText = `Guardian: ${parentInfo.full_name}`;
            document.getElementById('previewPhone').innerText = `Contact: ${parentInfo.phone}`;

            // Handle Photo
            const photoContainer = document.getElementById('previewPhotoContainer');
            if (photoContainer) {
                if (s.photo_url) {
                    const { data: publicUrl } = supabase.storage.from('photos').getPublicUrl(s.photo_url);
                    console.log('Loading ID Photo:', publicUrl.publicUrl);
                    photoContainer.innerHTML = `<img src="${publicUrl.publicUrl}" class="w-full h-full object-cover" onerror="this.onerror=null; this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(s.full_name)}&background=F3F4F6&color=D1D5DB'">`;
                } else {
                    photoContainer.innerHTML = '<i data-lucide="user" class="text-gray-300 w-16 h-16"></i>';
                    if (window.lucide) window.lucide.createIcons();
                }
            }

            const qrContainer = document.getElementById('previewQR');
            if (qrContainer) {
                qrContainer.innerHTML = '';
                new QRCode(qrContainer, {
                    text: s.id,
                    width: 112,
                    height: 112,
                    colorDark: "#000000",
                    colorLight: "#ffffff",
                    correctLevel: QRCode.CorrectLevel.H
                });
            }

            previewModal.classList.remove('hidden');
        } catch (err) {
            console.error('Error fetching student details:', err);
            utils.showNotification('Failed to load ID preview', 'error');
        }
    };
});
