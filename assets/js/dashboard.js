// Auth guard using Supabase session
(async function guard() {
	try {
		const { data: { session } } = await window.supa.auth.getSession();
		if (!session) {
			// redirect to login if not authenticated
			window.location.href = 'login.html';
		}
	} catch (e) {
		// if API not reachable, just redirect
		window.location.href = 'login.html';
	}
})();

const state = {
	allSubmissions: [],
	filtered: [],
	filterCompany: 'ALL',
	charts: {
		shipments: null,
		invoice: null,
		service: null,
		cod: null
	}
};

function calculateInvoiceValue(sub) {
	console.log('Placeholder formula used.');
	return (Number(sub.weekly_shipments)||0) * 4 * 10;
}

function sumMonthlyShipments(items) {
	return items.reduce((acc, s) => acc + ((Number(s.weekly_shipments)||0) * 4), 0);
}

function average(arr) {
	if (!arr.length) return 0;
	return arr.reduce((a,b)=>a+b,0)/arr.length;
}

function applyFilter() {
	if (state.filterCompany === 'ALL') {
		state.filtered = [...state.allSubmissions];
		return;
	}
	state.filtered = state.allSubmissions.filter(s => s.company_name === state.filterCompany);
}

function populateFilterOptions() {
	const select = document.getElementById('customerFilter');
	const companies = Array.from(new Set(state.allSubmissions.map(s=>s.company_name))).sort();
	select.innerHTML = '';
	const allOpt = document.createElement('option');
	allOpt.value = 'ALL'; allOpt.textContent = 'All Customers';
	select.appendChild(allOpt);
	companies.forEach(c => {
		const o = document.createElement('option'); o.value = c; o.textContent = c; select.appendChild(o);
	});
	select.value = state.filterCompany;
}

function refreshTitle() {
	const title = document.getElementById('dashboardTitle');
	title.textContent = state.filterCompany === 'ALL' ? 'Global Forecast Dashboard' : `Forecast for ${state.filterCompany}`;
}

function buildCharts() {
	const items = state.filtered;
	const ctxShip = document.getElementById('chartShipments');
	const ctxInv = document.getElementById('chartInvoice');
	const ctxSvc = document.getElementById('chartService');
	const ctxCod = document.getElementById('chartCod');

	// Debug: Log data
	console.log('Building charts with items:', items.length);
	console.log('Sample item:', items[0]);

	// Destroy existing
	['shipments','invoice','service','cod'].forEach(k=>{ if (state.charts[k]) { state.charts[k].destroy(); state.charts[k]=null; } });

	// Chart 1: Shipments (bar). Current vs placeholder previous month
	const monthlyShip = sumMonthlyShipments(items);
	console.log('Monthly shipments:', monthlyShip);
	state.charts.shipments = new Chart(ctxShip, {
		type: 'bar',
		data: { labels: ['Previous Month','Current Month'], datasets: [{ label: 'Shipments', data: [Math.round(monthlyShip*0.9), monthlyShip], backgroundColor: ['#d7e4de', '#1f6a4a'] }] },
		options: { 
			responsive: true, 
			maintainAspectRatio: true,
			aspectRatio: 2,
			plugins: { legend: { display: false } },
			animation: { duration: 0 }
		}
	});

	// Chart 2: Invoice placeholder (bar)
	const invoiceTotal = items.reduce((acc, s)=> acc + calculateInvoiceValue(s), 0);
	console.log('Invoice total:', invoiceTotal);
	state.charts.invoice = new Chart(ctxInv, {
		type: 'bar',
		data: { labels: ['Previous Month','Current Month'], datasets: [{ label: 'Invoice', data: [Math.round(invoiceTotal*0.95), invoiceTotal], backgroundColor: ['#ffd8a3', '#ff9d18'] }] },
		options: { 
			responsive: true, 
			maintainAspectRatio: true,
			aspectRatio: 2,
			plugins: { legend: { display: false } },
			animation: { duration: 0 }
		}
	});

	// Chart 3: Average Service Mix (doughnut)
	const avgHB = average(items.map(s=>Number(s.service_hb_percent)||0));
	const avgInt = average(items.map(s=>Number(s.service_int_percent)||0));
	const avgPar = average(items.map(s=>Number(s.service_parcel_percent)||0));
	console.log('Service mix averages:', { avgHB, avgInt, avgPar });
	state.charts.service = new Chart(ctxSvc, {
		type: 'doughnut',
		data: { labels: ['H&B','Int','Parcel'], datasets: [{ data: [avgHB, avgInt, avgPar], backgroundColor: ['#1f6a4a','#2e9e6e','#d7e4de'] }] },
		options: { 
			responsive: true, 
			maintainAspectRatio: true,
			aspectRatio: 1.5,
			animation: { duration: 0 }
		}
	});

	// Chart 4: Average COD/PPD (doughnut)
	const avgCOD = average(items.map(s=>Number(s.cod_percent)||0));
	const avgPPD = 100 - avgCOD;
	console.log('COD/PPD averages:', { avgCOD, avgPPD });
	state.charts.cod = new Chart(ctxCod, {
		type: 'doughnut',
		data: { labels: ['COD','PPD'], datasets: [{ data: [avgCOD, avgPPD], backgroundColor: ['#ff9d18','#ffd8a3'] }] },
		options: { 
			responsive: true, 
			maintainAspectRatio: true,
			aspectRatio: 1.5,
			animation: { duration: 0 }
		}
	});
}

function renderTable() {
	const tbody = document.querySelector('#submissionsTable tbody');
	tbody.innerHTML = '';
	state.filtered.forEach(row => {
		const tr = document.createElement('tr');
		tr.innerHTML = `
			<td>${window.formatKSA(row.created_at)}</td>
			<td>${row.company_name||''}</td>
			<td>${row.weekly_shipments||0}</td>
			<td>${row.weekly_units_outbound||0}</td>
			<td>${row.weekly_units_inbound||0}</td>
			<td>${row.cod_percent||0}</td>
			<td>${row.cod_percent_expected_increase||0}</td>
			<td>${row.tier1_percent||0}</td>
			<td>${row.tier2_percent||0}</td>
			<td>${row.tier3_percent||0}</td>
			<td>${row.service_hb_percent||0}</td>
			<td>${row.service_int_percent||0}</td>
			<td>${row.service_parcel_percent||0}</td>
			<td>${(row.seasonality_skus_notes||'').replace(/</g,'&lt;')}</td>
			<td>
				<button class="btn btn-sm btn-outline-primary me-1" data-action="edit" data-id="${row.id}">Edit</button>
				<button class="btn btn-sm btn-outline-danger" data-action="delete" data-id="${row.id}">Delete</button>
			</td>`;
		tbody.appendChild(tr);
	});
}

async function loadData() {
	const { data, error } = await window.supa
		.from('submissions')
		.select('*')
		.order('created_at', { ascending: false });
	if (error) {
		alert('Error loading data: ' + error.message);
		return;
	}
	state.allSubmissions = data || [];
	populateFilterOptions();
	applyFilter();
	refreshTitle();
	buildCharts();
	renderTable();
}

function handleFilterChange() {
	const sel = document.getElementById('customerFilter');
	sel.addEventListener('change', () => {
		state.filterCompany = sel.value;
		applyFilter();
		refreshTitle();
		buildCharts();
		renderTable();
	});
}

function setupRealtime() {
	try {
		window.supa
			.channel('submissions-changes')
			.on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'submissions' }, payload => {
				state.allSubmissions.unshift(payload.new);
				populateFilterOptions();
				applyFilter();
				refreshTitle();
				buildCharts();
				renderTable();
			})
			.on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'submissions' }, payload => {
				const idx = state.allSubmissions.findIndex(s=>s.id===payload.new.id);
				if (idx>=0) state.allSubmissions[idx] = payload.new;
				applyFilter();
				buildCharts();
				renderTable();
			})
			.on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'submissions' }, payload => {
				state.allSubmissions = state.allSubmissions.filter(s=>s.id!==payload.old.id);
				applyFilter();
				buildCharts();
				renderTable();
			})
			.subscribe();
	} catch (e) {
		console.warn('Realtime unavailable', e);
	}
}

function setupCrudHandlers() {
	document.querySelector('#submissionsTable').addEventListener('click', async (e) => {
		const btn = e.target.closest('button');
		if (!btn) return;
		const id = btn.getAttribute('data-id');
		const action = btn.getAttribute('data-action');
		const row = state.allSubmissions.find(r=>r.id===id);
		if (!row) return;

		if (action === 'delete') {
			if (!confirm('Delete this submission?')) return;
			const { error } = await window.supa.from('submissions').delete().eq('id', id);
			if (error) return alert('Delete error: ' + error.message);
			// local state updated by realtime handler too, but ensure immediate feedback
			state.allSubmissions = state.allSubmissions.filter(s=>s.id!==id);
			applyFilter(); buildCharts(); renderTable();
			return;
		}

		if (action === 'edit') {
			// Simple prompt-based editing
			const updated = { ...row };
			function numPrompt(label, cur) {
				const v = prompt(label, String(cur ?? ''));
				if (v===null) return null; // cancel
				const n = Number(v);
				if (isNaN(n)) { alert('Invalid number'); return null; }
				return n;
			}
			const company = prompt('Company Name', row.company_name || ''); if (company===null) return;
			updated.company_name = company.trim();
			const ws = numPrompt('Weekly Shipments', row.weekly_shipments); if (ws===null) return; updated.weekly_shipments = ws;
			const wout = numPrompt('Weekly Units Outbound', row.weekly_units_outbound); if (wout===null) return; updated.weekly_units_outbound = wout;
			const win = numPrompt('Weekly Units Inbound', row.weekly_units_inbound); if (win===null) return; updated.weekly_units_inbound = win;
			const cod = numPrompt('COD % (0-100)', row.cod_percent); if (cod===null) return; if (cod<0||cod>100) return alert('COD must be 0-100'); updated.cod_percent = cod;
			const codInc = numPrompt('Expected Increase in COD Value %', row.cod_percent_expected_increase); if (codInc===null) return; updated.cod_percent_expected_increase = codInc;
			const t1 = numPrompt('Tier 1 %', row.tier1_percent); if (t1===null) return;
			const t2 = numPrompt('Tier 2 %', row.tier2_percent); if (t2===null) return;
			const t3 = numPrompt('Tier 3 %', row.tier3_percent); if (t3===null) return;
			if (t1 + t2 + t3 !== 100) return alert('Tier split must sum to 100');
			updated.tier1_percent = t1; updated.tier2_percent = t2; updated.tier3_percent = t3;
			const s1 = numPrompt('Service H&B %', row.service_hb_percent); if (s1===null) return;
			const s2 = numPrompt('Service Int %', row.service_int_percent); if (s2===null) return;
			const s3 = numPrompt('Service Parcel %', row.service_parcel_percent); if (s3===null) return;
			if (s1 + s2 + s3 !== 100) return alert('Service mix must sum to 100');
			updated.service_hb_percent = s1; updated.service_int_percent = s2; updated.service_parcel_percent = s3;
			const notes = prompt('Notes', row.seasonality_skus_notes || ''); if (notes===null) return; updated.seasonality_skus_notes = notes;

			const { error } = await window.supa.from('submissions').update(updated).eq('id', id);
			if (error) return alert('Update error: ' + error.message);
			const idx = state.allSubmissions.findIndex(s=>s.id===id);
			if (idx>=0) state.allSubmissions[idx] = { ...state.allSubmissions[idx], ...updated };
			applyFilter(); buildCharts(); renderTable();
		}
	});
}

function setupExport() {
	document.getElementById('downloadPdfBtn').addEventListener('click', async () => {
		const name = state.filterCompany === 'ALL' ? 'All' : state.filterCompany.replace(/[^a-z0-9_-]/gi,'_');
		
		// Show loading state
		const btn = document.getElementById('downloadPdfBtn');
		const originalText = btn.textContent;
		btn.textContent = 'Generating PDF...';
		btn.disabled = true;
		
		try {
			// Create a simple PDF with basic structure
			const pdfContainer = document.createElement('div');
			pdfContainer.style.width = '100%';
			pdfContainer.style.backgroundColor = '#ffffff';
			pdfContainer.style.padding = '20px';
			pdfContainer.style.fontFamily = 'Arial, sans-serif';
			pdfContainer.style.minHeight = '297mm'; // A4 height
			pdfContainer.style.width = '420mm'; // A4 landscape width
			
			// Add title
			const title = document.createElement('h1');
			title.textContent = state.filterCompany === 'ALL' ? 'Global Forecast Dashboard' : `Forecast for ${state.filterCompany}`;
			title.style.textAlign = 'center';
			title.style.marginBottom = '40px';
			title.style.color = '#1f6a4a';
			title.style.fontSize = '28px';
			title.style.fontWeight = 'bold';
			pdfContainer.appendChild(title);
			
			// Add date
			const date = document.createElement('p');
			date.textContent = `Generated on: ${new Date().toLocaleDateString('en-US', { 
				year: 'numeric', 
				month: 'long', 
				day: 'numeric',
				hour: '2-digit',
				minute: '2-digit'
			})}`;
			date.style.textAlign = 'center';
			date.style.marginBottom = '30px';
			date.style.color = '#666';
			date.style.fontSize = '14px';
			pdfContainer.appendChild(date);
			
			// Add charts grid
			const chartsGrid = document.createElement('div');
			chartsGrid.style.display = 'grid';
			chartsGrid.style.gridTemplateColumns = '1fr 1fr';
			chartsGrid.style.gap = '30px';
			chartsGrid.style.marginBottom = '30px';
			
			// Chart titles and descriptions
			const chartData = [
				{
					title: 'Total Expected Monthly Shipments',
					description: 'Comparison of previous month vs current month shipments',
					color: '#1f6a4a'
				},
				{
					title: 'Total Expected Monthly Invoice Value',
					description: 'Projected invoice values for the forecast period',
					color: '#ff9d18'
				},
				{
					title: 'Average Service Mix',
					description: 'Distribution of H&B, International, and Parcel services',
					color: '#1f6a4a'
				},
				{
					title: 'Average COD/PPD Split',
					description: 'Cash on Delivery vs Prepaid payment distribution',
					color: '#ff9d18'
				}
			];
			
			// Create chart placeholders
			chartData.forEach((chart, index) => {
				const chartCard = document.createElement('div');
				chartCard.style.border = '2px solid #ddd';
				chartCard.style.borderRadius = '12px';
				chartCard.style.padding = '25px';
				chartCard.style.backgroundColor = '#f8f9fa';
				chartCard.style.minHeight = '200px';
				chartCard.style.display = 'flex';
				chartCard.style.flexDirection = 'column';
				chartCard.style.justifyContent = 'center';
				chartCard.style.alignItems = 'center';
				chartCard.style.textAlign = 'center';
				
				// Add title
				const chartTitle = document.createElement('h3');
				chartTitle.textContent = chart.title;
				chartTitle.style.marginBottom = '15px';
				chartTitle.style.color = chart.color;
				chartTitle.style.fontSize = '18px';
				chartTitle.style.fontWeight = 'bold';
				chartCard.appendChild(chartTitle);
				
				// Add description
				const chartDesc = document.createElement('p');
				chartDesc.textContent = chart.description;
				chartDesc.style.marginBottom = '20px';
				chartDesc.style.color = '#666';
				chartDesc.style.fontSize = '14px';
				chartCard.appendChild(chartDesc);
				
				// Add placeholder text
				const placeholder = document.createElement('div');
				placeholder.style.padding = '20px';
				placeholder.style.backgroundColor = '#e9ecef';
				placeholder.style.borderRadius = '8px';
				placeholder.style.width = '100%';
				placeholder.style.maxWidth = '150px';
				
				if (index < 2) {
					// Bar chart placeholder
					placeholder.innerHTML = `
						<div style="display: flex; justify-content: space-around; align-items: end; height: 80px;">
							<div style="width: 30px; background: #d7e4de; height: 60px; border-radius: 4px;"></div>
							<div style="width: 30px; background: ${chart.color}; height: 80px; border-radius: 4px;"></div>
						</div>
						<div style="display: flex; justify-content: space-around; margin-top: 10px; font-size: 12px; color: #666;">
							<span>Previous</span>
							<span>Current</span>
						</div>
					`;
				} else {
					// Doughnut chart placeholder
					placeholder.innerHTML = `
						<div style="width: 80px; height: 80px; border-radius: 50%; background: conic-gradient(${chart.color} 0deg, #e9ecef 0deg); margin: 0 auto;"></div>
						<div style="margin-top: 10px; font-size: 12px; color: #666;">Chart Data</div>
					`;
				}
				
				chartCard.appendChild(placeholder);
				chartsGrid.appendChild(chartCard);
			});
			
			pdfContainer.appendChild(chartsGrid);
			
			// Add footer
			const footer = document.createElement('div');
			footer.style.marginTop = '40px';
			footer.style.paddingTop = '20px';
			footer.style.borderTop = '1px solid #ddd';
			footer.style.textAlign = 'center';
			footer.style.color = '#666';
			footer.style.fontSize = '12px';
			footer.textContent = 'Peak Days Forecast Dashboard - Generated Report';
			pdfContainer.appendChild(footer);
			
			// Temporarily add to document
			document.body.appendChild(pdfContainer);
			pdfContainer.style.position = 'absolute';
			pdfContainer.style.left = '-9999px';
			pdfContainer.style.top = '0';
			
			await html2pdf()
				.set({
					filename: `Forecast_Report_${name}.pdf`,
					margin: [15, 15, 15, 15],
					image: { type: 'jpeg', quality: 0.95 },
					html2canvas: { 
						scale: 1.5,
						useCORS: true,
						allowTaint: true,
						backgroundColor: '#ffffff'
					},
					jsPDF: { 
						unit: 'mm', 
						format: 'a4', 
						orientation: 'landscape'
					}
				})
				.from(pdfContainer)
				.save();
			
			// Clean up
			document.body.removeChild(pdfContainer);
		} catch (error) {
			console.error('PDF generation error:', error);
			alert('Error generating PDF. Please try again.');
		} finally {
			// Restore button state
			btn.textContent = originalText;
			btn.disabled = false;
		}
	});
}

// Initialize
(async function init() {
	await loadData();
	handleFilterChange();
	setupRealtime();
	setupCrudHandlers();
	setupExport();
})();
