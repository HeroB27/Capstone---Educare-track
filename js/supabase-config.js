// EDUCARE TRACK - GLOBAL SUPABASE CONFIG
// This file sets up the Supabase client globally so it works without module imports
window.SUPABASE_URL = 'https://tkwjxmhnroqprmjfoaua.supabase.co';
window.SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRrd2p4bWhucm9xcHJtamZvYXVhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg5NzM1MzksImV4cCI6MjA4NDU0OTUzOX0.4kcq7jztHm_zvS1yMX1VjZAvMbxKgNHBqkiThotG3DM';

if (window.supabase && window.supabase.createClient) {
    window.supabaseClient = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
    console.log('Supabase Global Client Initialized');
} else {
    console.error('Supabase library not found! Check your CDN link.');
}
