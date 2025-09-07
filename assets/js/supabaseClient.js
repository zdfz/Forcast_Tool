// Supabase JS via CDN must be included before this script
// Replace placeholders with your actual project values
const SUPABASE_URL = 'https://oemzbntgiqefjebqcqhe.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9lbXpibnRnaXFlZmplYnFjcWhlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYyODY1NzcsImV4cCI6MjA3MTg2MjU3N30.VwvDosuLK96_Eu4sg_-9KzJLyrXllqHJdmhnbWj5LSo';

// global client
const supa = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Riyadh timezone helper: format ISO date to DD/MM/YYYY, HH:mm (KSA)
function formatKSA(isoString) {
	try {
		const dtf = new Intl.DateTimeFormat('en-GB', {
			year: 'numeric', month: '2-digit', day: '2-digit',
			hour: '2-digit', minute: '2-digit',
			timeZone: 'Asia/Riyadh'
		});
		return dtf.format(new Date(isoString));
	} catch (e) {
		return isoString;
	}
}

window.supa = supa;
window.formatKSA = formatKSA;
