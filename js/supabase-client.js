// Supabase Client Configuration
// IMPORTANT: Replace these with your actual Supabase credentials
// Get these from: Supabase Dashboard > Settings > API
const SUPABASE_URL = 'https://ihfterjqmkqgicexheyv.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImloZnRlcmpxbWtxZ2ljZXhoZXl2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ5MTQyNDYsImV4cCI6MjA4MDQ5MDI0Nn0.VOy7vR6Bp-Hss6WBoovsBv0F8Xfj3zsWc7Pz-F3ydjA';

// Initialize Supabase client only if not already initialized
if (!window.supabaseClient) {
    try {
        if (typeof window.supabase !== 'undefined' && window.supabase.createClient) {
            window.supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        } else {
            console.error('Supabase library not loaded. Make sure @supabase/supabase-js is included before this script.');
            alert('Supabase library not found. Please check your script includes.');
        }
    } catch (error) {
        console.error('Error initializing Supabase client:', error);
        alert('Supabase configuration error. Please check your credentials in js/supabase-client.js');
    }
}

