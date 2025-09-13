// Supabase JS via CDN must be included before this script
// Replace placeholders with your actual project values
const SUPABASE_URL = 'https://oemzbntgiqefjebqcqhe.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9lbXpibnRnaXFlZmplYnFjcWhlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYyODY1NzcsImV4cCI6MjA3MTg2MjU3N30.VwvDosuLK96_Eu4sg_-9KzJLyrXllqHJdmhnbWj5LSo';

// Check if Supabase is loaded
if (typeof supabase === 'undefined') {
    console.error('Supabase client not found. Make sure to include the Supabase JS library before this script.');
}

// Initialize Supabase client with error handling
let supa;
try {
    supa = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: {
            autoRefreshToken: true,
            persistSession: true,
            detectSessionInUrl: true
        }
    });
    console.log('Supabase client initialized successfully');
} catch (error) {
    console.error('Failed to initialize Supabase client:', error);
    throw new Error(`Supabase initialization failed: ${error.message}`);
}

// Riyadh timezone helper: format ISO date to DD/MM/YYYY, HH:mm (KSA)
function formatKSA(isoString) {
    if (!isoString) return 'N/A';
    
    try {
        const date = new Date(isoString);
        if (isNaN(date.getTime())) return 'Invalid Date';
        
        const options = {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            timeZone: 'Asia/Riyadh'
        };
        
        return new Intl.DateTimeFormat('en-GB', options).format(date);
    } catch (e) {
        console.error('Error formatting date:', e);
        return 'Invalid Date';
    }
}

// Make available globally
window.supa = supa;
window.formatKSA = formatKSA;

// Test connection
async function testConnection() {
    try {
        const { data, error } = await supa.auth.getSession();
        if (error) throw error;
        console.log('Supabase connection test successful');
        return true;
    } catch (error) {
        console.error('Supabase connection test failed:', error);
        return false;
    }
}

// Export for testing
window.testSupabaseConnection = testConnection;
