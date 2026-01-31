// Supabase Configuration
const SUPABASE_URL = 'https://tkwjxmhnroqprmjfoaua.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRrd2p4bWhucm9xcHJtamZvYXVhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg5NzM1MzksImV4cCI6MjA4NDU0OTUzOX0.4kcq7jztHm_zvS1yMX1VjZAvMbxKgNHBqkiThotG3DM';

const { createClient } = supabase;
const _supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export default _supabase;
