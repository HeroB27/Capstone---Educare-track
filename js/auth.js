import supabase from './supabase-config.js';
import { utils } from './utils.js';

document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');
    const forgotBtn = document.getElementById('forgotPassword');
    const forgotModal = document.getElementById('forgotModal');
    const closeForgotBtn = document.getElementById('closeForgotModal');

    // Handle Login
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;

        try {
            // Query profiles table for matching username and password
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('username', username)
                .eq('password', password)
                .single();

            if (error) throw new Error('Invalid username or password');

            if (data) {
                // Store user info in local storage
                localStorage.setItem('educare_user', JSON.stringify(data));
                
                // Success message
                utils.showNotification('Login successful! Redirecting...', 'success');

                // Role-based redirection
                setTimeout(() => {
                    switch (data.role) {
                        case 'admin':
                            window.location.href = 'pages/admin-dashboard.html';
                            break;
                        case 'teacher':
                            window.location.href = 'pages/teacher-dashboard.html';
                            break;
                        case 'parent':
                            window.location.href = 'pages/parent-dashboard.html';
                            break;
                        case 'guard':
                            window.location.href = 'pages/guard-dashboard.html';
                            break;
                        case 'clinic':
                            window.location.href = 'pages/clinic-dashboard.html';
                            break;
                        default:
                            utils.showNotification('Unauthorized role', 'error');
                    }
                }, 1000);
            }
        } catch (err) {
            utils.showNotification(err.message, 'error');
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
        const username = document.getElementById('resetUsername').value;
        if (!username) return utils.showNotification('Please enter your username', 'warning');

        try {
            // Verify if user exists
            const { data: user, error: userError } = await supabase
                .from('profiles')
                .select('id, full_name, role')
                .eq('username', username)
                .single();

            if (userError) throw new Error('User not found');

            // Send notification to admin
            const { error: notifError } = await supabase.from('notifications').insert([{
                title: 'Password Reset Request',
                message: `${user.full_name} (${user.role}) is requesting a password reset.`,
                type: 'admin',
                user_id: user.id
            }]);

            if (notifError) throw notifError;

            utils.showNotification('Reset request sent to Administrator!', 'success');
            forgotModal.classList.add('hidden');
            document.getElementById('resetUsername').value = '';

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
