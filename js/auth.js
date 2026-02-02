const supabase = window.supabaseClient;
const utils = window.utils;

document.addEventListener('DOMContentLoaded', async () => {
    const loginForm = document.getElementById('loginForm');
    const forgotBtn = document.getElementById('forgotPassword');
    const forgotModal = document.getElementById('forgotModal');
    const closeForgotBtn = document.getElementById('closeForgotModal');

    console.group('Auth Lifecycle: Page Load');
    try {
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) {
            console.error('Session recovery error:', sessionError);
            throw sessionError;
        }

        const user = sessionData?.session?.user;
        if (user) {
            console.log('Active session found for:', user.email);
            const { data: profile, error: profileError } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', user.id)
                .single();

            if (profileError) {
                console.warn('Session valid but profile retrieval failed (possible RLS):', profileError);
                localStorage.removeItem('educare_user');
                try {
                    await supabase.auth.signOut();
                } catch (e) {
                }
                throw profileError;
            }

            // Check if account is active
            if (profile.is_active === false) {
                console.warn('Account is inactive. Signing out.');
                await supabase.auth.signOut();
                localStorage.removeItem('educare_user');
                utils.showNotification('Your account has been deactivated. Please contact the administrator.', 'error');
                return;
            }

            localStorage.setItem('educare_user', JSON.stringify(profile));

            const dashboardMap = {
                admin: '/admin/admin-dashboard.html',
                teacher: '/teacher/teacher-dashboard.html',
                parent: '/parent/parent-dashboard.html',
                clinic: '/clinic/clinic-dashboard.html',
                guard: '/guard/guard-dashboard.html'
            };

            const redirectPath = dashboardMap[profile.role];
            if (redirectPath) {
                console.log('Redirecting to:', redirectPath);
                window.location.replace(redirectPath);
            }
        } else {
            console.log('No active session.');
        }
    } catch (err) {
        console.error('Auth boot error:', err);
        localStorage.removeItem('educare_user');
    } finally {
        console.groupEnd();
    }

    // Handle Login
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('email').value.trim().toLowerCase();
        const password = document.getElementById('password').value.trim();
        const submitBtn = loginForm.querySelector('button[type="submit"]');
        const originalBtnContent = submitBtn.innerHTML;

        console.group('Auth Flow: Login Attempt');
        console.log('Target Email:', email);

        try {
            // Loading state
            submitBtn.disabled = true;
            submitBtn.innerHTML = `
                <svg class="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span>Authenticating...</span>
            `;

            const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
                email,
                password
            });
            
            if (signInError) {
                console.error('Sign-in error:', signInError);
                // Audit log failed attempt
                await supabase.from('audit_logs').insert([{
                    action: 'login_failed',
                    target_table: 'profiles',
                    details: { email, reason: signInError.message }
                }]).catch(e => console.error('Failed to log audit:', e));

                if (signInError.message === 'Invalid login credentials' && email.endsWith('@educare.com')) {
                    throw new Error('Invalid login credentials. Use the seeded email domain: admin1@educare.edu (not @educare.com).');
                }
                throw signInError;
            }

            const user = signInData?.user;
            if (!user) throw new Error('Login failed: No user returned from Supabase');

            console.log('Auth success for UID:', user.id);
            utils.showNotification('Auth verified! Fetching profile...', 'info');

            // 2. Fetch Profile
            const { data: profile, error: profileError } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', user.id)
                .single();

            if (profileError) {
                console.error('Profile retrieval error:', profileError);
                if (profileError.code === 'PGRST116') {
                    throw new Error('Login successful, but no Profile found for this account. Did you run the seed script?');
                }
                throw profileError;
            }

            // 3. Check activity status
            if (profile.is_active === false) {
                console.warn('Login blocked: Account is inactive.');
                await supabase.auth.signOut();
                throw new Error('Your account has been deactivated. Please contact the administrator.');
            }

            if (!profile?.role) throw new Error('Profile found but Role is missing. Contact the administrator.');

            console.log('Profile retrieved. Role:', profile.role);
            utils.showNotification(`Role found: ${profile.role}. Redirecting...`, 'success');

            // 4. Log Success Audit (Non-blocking)
            supabase.from('audit_logs').insert([{
                actor_id: profile.id,
                action: 'login_success',
                target_table: 'profiles',
                target_id: profile.id,
                details: { email, role: profile.role }
            }]).catch(() => {});

            localStorage.setItem('educare_user', JSON.stringify(profile));

            setTimeout(() => {
                const dashboardMap = {
                    admin: '/admin/admin-dashboard.html',
                    teacher: '/teacher/teacher-dashboard.html',
                    parent: '/parent/parent-dashboard.html',
                    clinic: '/clinic/clinic-dashboard.html',
                    guard: '/guard/guard-dashboard.html'
                };

                const redirectPath = dashboardMap[profile.role];
                if (redirectPath) {
                    console.log('Navigating to:', redirectPath);
                    window.location.replace(redirectPath);
                } else {
                    utils.showNotification('Unauthorized role: ' + profile.role, 'error');
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = originalBtnContent;
                }
            }, 800);
        } catch (err) {
            console.error('Login process caught error:', err);
            let msg = err?.message || 'Login failed.';
            const code = err?.code;

            // Detect Adblocker/Privacy Extension interference
            if (msg.includes('Failed to fetch') || msg.includes('AbortError')) {
                msg = '⚠️ Connection Blocked: Your DuckDuckGo extension or Adblocker is stopping the login. Please disable it for this site or use Incognito mode.';
            } else if (code === '42501' || msg.toLowerCase().includes('policy') || msg.toLowerCase().includes('row level security')) {
                msg = 'Access Denied: Your profile is blocked by RLS. Please contact Admin.';
                try {
                    await supabase.auth.signOut();
                } catch (e) {
                }
                localStorage.removeItem('educare_user');
            } else if (msg.includes('rate limit')) {
                msg = 'Too many attempts. Please wait a few minutes before trying again.';
            }

            utils.showNotification(msg, 'error', 8000); // Show for longer to ensure they read it
            
            // Restore button
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalBtnContent;
        } finally {
            console.groupEnd();
        }
    });

    // Forgot Password Modal
    forgotBtn.addEventListener('click', () => {
        forgotModal.classList.remove('hidden');
    });

    closeForgotBtn.addEventListener('click', () => {
        forgotModal.classList.add('hidden');
    });

    // Handle Reset Request
    const submitResetBtn = document.getElementById('submitResetRequest');
    submitResetBtn?.addEventListener('click', async () => {
        const email = document.getElementById('resetEmail').value;
        if (!email) return utils.showNotification('Please enter your email', 'warning');

        try {
            const { error } = await supabase.auth.resetPasswordForEmail(email);
            if (error) throw error;

            utils.showNotification('Password reset email sent!', 'success');
            forgotModal.classList.add('hidden');
            document.getElementById('resetEmail').value = '';

        } catch (err) {
            utils.showNotification(err.message, 'error');
        }
    });

    // Close modal on backdrop click
    forgotModal.addEventListener('click', (e) => {
        if (e.target === forgotModal) {
            forgotModal.classList.add('hidden');
        }
    });
});
