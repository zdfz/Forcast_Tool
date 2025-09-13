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

// Track the currently editing row for the edit modal
let currentEditingRow = null;

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

// Format date to KSA time format
function formatKSA(dateString) {
	if (!dateString) return 'N/A';
	
	const date = new Date(dateString);
	if (isNaN(date.getTime())) return 'N/A';
	
	// Format to KSA time (UTC+3)
	const options = { 
		year: 'numeric', 
		month: 'short', 
		day: 'numeric',
		hour: '2-digit',
		minute: '2-digit',
		timeZone: 'Asia/Riyadh'
	};
	
	return new Intl.DateTimeFormat('en-US', options).format(date);
}

function getWeekInfo(dateString) {
	if (!dateString) return 'N/A';
	
	const date = new Date(dateString);
	if (isNaN(date.getTime())) return 'N/A';
	
	// ISO 8601 week calculation
	const year = date.getFullYear();
	const month = date.getMonth();
	const day = date.getDate();
	
	// Create date object for calculation
	const targetDate = new Date(year, month, day);
	
	// Find Thursday of this week (ISO week belongs to year of Thursday)
	const dayOfWeek = (targetDate.getDay() + 6) % 7; // Monday = 0, Sunday = 6
	const thursday = new Date(targetDate);
	thursday.setDate(targetDate.getDate() - dayOfWeek + 3);
	
	// Find first Thursday of the year
	const yearStart = new Date(thursday.getFullYear(), 0, 1);
	const firstThursday = new Date(yearStart);
	const firstThursdayDay = (yearStart.getDay() + 6) % 7;
	firstThursday.setDate(1 + (3 - firstThursdayDay + 7) % 7);
	
	// Calculate week number
	const weekNumber = Math.floor((thursday - firstThursday) / (7 * 24 * 60 * 60 * 1000)) + 1;
	
	// Get Monday of the week
	const monday = new Date(targetDate);
	monday.setDate(targetDate.getDate() - dayOfWeek);
	
	// Get Sunday of the week
	const sunday = new Date(monday);
	sunday.setDate(monday.getDate() + 6);
	
	// Format dates
	const formatDate = (d) => {
		const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
		return `${months[d.getMonth()]} ${d.getDate()}`;
	};
	
	return `Week ${weekNumber}<br><small>${formatDate(monday)} - ${formatDate(sunday)}</small>`;
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
	let hbCount = 0, intCount = 0, parCount = 0;
	const totalItems = items.length;
	
	items.forEach(item => {
		if (item.service_mix) {
			const serviceArray = item.service_mix.split(',').map(s => s.trim());
			if (serviceArray.includes('hb')) hbCount++;
			if (serviceArray.includes('international')) intCount++;
			if (serviceArray.includes('parcel')) parCount++;
		}
	});
	
	const avgHB = totalItems > 0 ? (hbCount / totalItems) * 100 : 0;
	const avgInt = totalItems > 0 ? (intCount / totalItems) * 100 : 0;
	const avgPar = totalItems > 0 ? (parCount / totalItems) * 100 : 0;
	
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
        
        // Format dates
        const formatDate = (dateStr) => {
            if (!dateStr) return 'N/A';
            const date = new Date(dateStr);
            return date instanceof Date && !isNaN(date) ? date.toISOString().split('T')[0] : 'N/A';
        };
        
        // Format created_at date
        const createdAt = row.created_at ? formatKSA(row.created_at) : 'N/A';
        
        const productType = row.service_type 
            ? row.service_type.charAt(0).toUpperCase() + row.service_type.slice(1).toLowerCase()
            : 'Not set';
            
        const inboundFreq = row.inbound_frequency 
            ? row.inbound_frequency.charAt(0).toUpperCase() + row.inbound_frequency.slice(1).toLowerCase()
            : 'Not set';
        
        // Format SKU notes
        const skuNotes = row.seasonality_skus_notes || 'No SKU notes provided';
        
        // Format special bundles
        let bundlesDisplay = 'N/A';
        if (row.special_bundles || row.special_bundles_notes) {
            const bundleParts = [];
            
            // Add structured bundle data if exists
            if (row.special_bundles) {
                try {
                    const bundles = JSON.parse(row.special_bundles);
                    if (Array.isArray(bundles) && bundles.length > 0) {
                        const bundleItems = bundles.map(b => 
                            `${b.name || 'Unnamed'}${b.details ? ': ' + b.details : ''}`
                        );
                        bundleParts.push(...bundleItems);
                    }
                } catch (e) {
                    console.error('Error parsing bundles:', e);
                    bundleParts.push('Error parsing bundle data');
                }
            }
            
            // Add bundle notes if they exist
            if (row.special_bundles_notes) {
                bundleParts.push(`Notes: ${row.special_bundles_notes}`);
            }
            
            bundlesDisplay = bundleParts.join('\n');
        }
        
        // Format service mix
        const serviceMixDisplay = row.service_mix || 'Not specified';
        
        // Calculate weighted COD/PPD percentages from service sections
        let weightedCodPercent = 0;
        let weightedPpdPercent = 0;
        let totalWeightedShipments = 0;
        
        // Process service details to get weighted COD/PPD percentages
        const serviceList = row.service_mix ? row.service_mix.split(',').map(s => s.trim()) : [];
        serviceList.forEach(service => {
            let serviceDetails = null;
            let serviceWeeklyShipments = 0;
            let codPercent = 0;
            let ppdPercent = 0;
            
            // Get service details based on service type
            if (service === 'hb' && row.hb_details) {
                try {
                    serviceDetails = JSON.parse(row.hb_details);
                    serviceWeeklyShipments = parseFloat(serviceDetails.weekly_shipments) || 0;
                    codPercent = parseFloat(serviceDetails.cod_percent) || 0;
                    ppdPercent = parseFloat(serviceDetails.ppd_percent) || 0;
                } catch (e) {
                    console.error('Error parsing hb_details:', e);
                }
            } else if (service === 'international' && row.international_details) {
                try {
                    serviceDetails = JSON.parse(row.international_details);
                    serviceWeeklyShipments = parseFloat(serviceDetails.weekly_shipments) || 0;
                    codPercent = parseFloat(serviceDetails.cod_percent) || 0;
                    ppdPercent = parseFloat(serviceDetails.ppd_percent) || 0;
                } catch (e) {
                    console.error('Error parsing international_details:', e);
                }
            } else if (service === 'parcel' && row.parcel_details) {
                try {
                    serviceDetails = JSON.parse(row.parcel_details);
                    serviceWeeklyShipments = parseFloat(serviceDetails.weekly_shipments) || 0;
                    codPercent = parseFloat(serviceDetails.cod_percent) || 0;
                    ppdPercent = parseFloat(serviceDetails.ppd_percent) || 0;
                } catch (e) {
                    console.error('Error parsing parcel_details:', e);
                }
            }
            
            // Add to weighted totals
            if (serviceWeeklyShipments > 0) {
                weightedCodPercent += codPercent * serviceWeeklyShipments;
                weightedPpdPercent += ppdPercent * serviceWeeklyShipments;
                totalWeightedShipments += serviceWeeklyShipments;
            }
        });
        
        // Calculate final weighted percentages
        const finalCodPercent = totalWeightedShipments > 0 ? 
            Math.round((weightedCodPercent / totalWeightedShipments) * 10) / 10 : 
            parseFloat(row.cod_percent) || 0;
            
        const finalPpdPercent = totalWeightedShipments > 0 ? 
            Math.round((weightedPpdPercent / totalWeightedShipments) * 10) / 10 : 
            parseFloat(row.ppd_percent) || 0;
        
        // Create main row
        tr.innerHTML = `
            <td>${createdAt}</td>
            <td>${row.company_name || 'N/A'}</td>
            <td>${productType}</td>
            <td>${row.weekly_shipments ?? 'N/A'}</td>
            <td>${row.weekly_units_outbound ?? 'N/A'}</td>
            <td>${row.weekly_units_inbound ?? 'N/A'}</td>
            <td>${formatDate(row.forecast_start_date)}</td>
            <td>${formatDate(row.forecast_end_date)}</td>
            <td>${inboundFreq}</td>
            <td>${row.avg_units_per_shipment ?? 'N/A'}</td>
            <td>${finalCodPercent}%</td>
            <td>${finalPpdPercent}%</td>
            <td>
                <div class="d-flex align-items-center">
                    <span>${serviceMixDisplay}</span>
                    <button class="btn btn-sm btn-link p-0 ms-2 toggle-service-details" data-id="${row.id}">
                        <i class="bi bi-chevron-down"></i>
                    </button>
                </div>
            </td>
            <td title="${bundlesDisplay}" style="white-space: pre-line;">
                ${bundlesDisplay.length > 100 ? bundlesDisplay.substring(0, 97) + '...' : bundlesDisplay}
            </td>
            <td title="${row.seasonality_skus_notes || ''}">
                ${row.seasonality_skus_notes ? (row.seasonality_skus_notes.length > 30 ? 
                    row.seasonality_skus_notes.substring(0, 27) + '...' : 
                    row.seasonality_skus_notes) : 'N/A'}
            </td>
            <td>
                <button class="btn btn-sm btn-outline-primary me-1" data-action="edit" data-id="${row.id}">Edit</button>
                <button class="btn btn-sm btn-outline-danger" data-action="delete" data-id="${row.id}">Delete</button>
            </td>`;
        
        tbody.appendChild(tr);
        
        // Create service details row (initially hidden)
        const detailsRow = document.createElement('tr');
        detailsRow.className = 'service-details-row d-none';
        detailsRow.dataset.parentId = row.id;
        
        // Create service details content
        let detailsContent = '';
        const serviceItems = row.service_mix ? row.service_mix.split(',').map(s => s.trim()) : [];
        
        if (serviceItems.length === 0) {
            detailsContent = '<div class="alert alert-info m-2">No service mix details available.</div>';
        } else {
            detailsContent = '<div class="d-flex flex-wrap p-2">';
            
            // Process each service type
            serviceItems.forEach(service => {
                let serviceDetails = null;
                let serviceTitle = '';
                let detailsField = '';
                
                // Get service details based on service type
                if (service === 'hb') {
                    serviceTitle = 'Heavy & Bulky';
                    detailsField = 'hb_details';
                } else if (service === 'international') {
                    serviceTitle = 'International';
                    detailsField = 'international_details';
                } else if (service === 'parcel') {
                    serviceTitle = 'Parcel';
                    detailsField = 'parcel_details';
                }
                
                // Try to parse the service details
                if (row[detailsField]) {
                    try {
                        serviceDetails = JSON.parse(row[detailsField]);
                    } catch (e) {
                        console.error(`Error parsing ${detailsField}:`, e);
                        // Add fallback for parsing errors
                        serviceDetails = { error: `Could not parse service details` };
                    }
                }
                
                detailsContent += `<div class="card m-2" style="min-width: 250px; max-width: 300px;">
                    <div class="card-header py-1 px-2 bg-light">${serviceTitle}</div>
                    <div class="card-body p-2">`;
                
                if (serviceDetails) {
                    // Check if there was an error parsing the details
                    if (serviceDetails.error) {
                        detailsContent += `<div class="alert alert-warning py-1 px-2 mb-0">${serviceDetails.error}</div>`;
                    } else {
                        detailsContent += '<table class="table table-sm mb-0">';
                        
                        // Add specific details
                        if (serviceDetails.weekly_shipments) {
                            detailsContent += `<tr><td class="fw-bold">Weekly Shipments</td><td>${serviceDetails.weekly_shipments}</td></tr>`;
                        }
                        if (serviceDetails.cod_percent) {
                            detailsContent += `<tr><td class="fw-bold">COD %</td><td>${serviceDetails.cod_percent}%</td></tr>`;
                        }
                        if (serviceDetails.ppd_percent) {
                            detailsContent += `<tr><td class="fw-bold">PPD %</td><td>${serviceDetails.ppd_percent}%</td></tr>`;
                        }
                        
                        // Add any other details that might be present
                        Object.entries(serviceDetails).forEach(([key, value]) => {
                            if (!['weekly_shipments', 'cod_percent', 'ppd_percent', 'error'].includes(key) && value) {
                                // Format the key for display
                                const formattedKey = key
                                    .split('_')
                                    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                                    .join(' ');
                                detailsContent += `<tr><td class="fw-bold">${formattedKey}</td><td>${value}</td></tr>`;
                            }
                        });
                        
                        detailsContent += '</table>';
                    }
                } else {
                    detailsContent += '<div class="alert alert-warning py-1 px-2 mb-0">No details available</div>';
                }
                
                detailsContent += '</div></div>';
            });
            
            detailsContent += '</div>';
        }
        
        // Create a cell that spans all columns
        detailsRow.innerHTML = `<td colspan="16">${detailsContent}</td>`;
        
        // Add the details row after the main row
        tbody.appendChild(detailsRow);
    });
    
    // Add resize handles after table is rendered
    addResizeHandles();
}

function addResizeHandles() {
	// Wait for table to be fully rendered
	setTimeout(() => {
		const headers = document.querySelectorAll('#submissionsTable thead th');
		console.log('Adding resize handles to', headers.length, 'headers');
		
		headers.forEach((header, index) => {
			// Skip the last column (Actions) as it doesn't need resizing
			if (index < headers.length - 1) {
				// Remove existing resize handle if any
				const existingHandle = header.querySelector('.resize-handle');
				if (existingHandle) {
					existingHandle.remove();
				}
				
				// Add new resize handle
				const resizeHandle = document.createElement('div');
				resizeHandle.className = 'resize-handle';
				resizeHandle.title = 'Drag to resize column';
				header.style.position = 'relative'; // Ensure parent is positioned
				header.appendChild(resizeHandle);
				
				console.log('Added resize handle to column', index);
				
				// Add resize functionality
				let isResizing = false;
				let startX = 0;
				let startWidth = 0;
				
				resizeHandle.addEventListener('mousedown', (e) => {
					console.log('Resize started for column', index);
					isResizing = true;
					startX = e.clientX;
					startWidth = parseInt(document.defaultView.getComputedStyle(header).width, 10);
					document.addEventListener('mousemove', handleMouseMove);
					document.addEventListener('mouseup', handleMouseUp);
					document.body.style.cursor = 'col-resize';
					e.preventDefault();
					e.stopPropagation();
				});
				
				function handleMouseMove(e) {
					if (!isResizing) return;
					const width = startWidth + e.clientX - startX;
					if (width > 50) { // Minimum width
						header.style.width = width + 'px';
					}
				}
				
				function handleMouseUp() {
					console.log('Resize ended for column', index);
					isResizing = false;
					document.removeEventListener('mousemove', handleMouseMove);
					document.removeEventListener('mouseup', handleMouseUp);
					document.body.style.cursor = '';
				}
			}
		});
	}, 100);
}

async function loadData() {
	try {
		// Show loading state
		document.getElementById('dashboardTitle').textContent = 'Loading data...';
		
		// Test connection to Supabase
		const { data, error } = await window.supa
			.from('submissions')
			.select('*')
			.order('created_at', { ascending: false })
			.limit(1); // Just fetch one record to test the connection
			
		if (error) {
			console.error('Supabase error:', error);
			throw new Error(`Database error: ${error.message}`);
		}
		
		if (!data) {
			throw new Error('No data received from the server');
		}
		
		// If we got this far, connection is good - fetch all data
		const { data: allData, error: fetchError } = await window.supa
			.from('submissions')
			.select('*')
			.order('created_at', { ascending: false });
			
		if (fetchError) {
			console.error('Error fetching all data:', fetchError);
			throw new Error(`Error loading submissions: ${fetchError.message}`);
		}
		
		state.allSubmissions = allData || [];
		populateFilterOptions();
		applyFilter();
		refreshTitle();
		buildCharts();
		renderTable();
		
	} catch (err) {
		console.error('Error in loadData:', err);
		
		// Show detailed error message
		const errorMessage = `Failed to load data: ${err.message || 'Unknown error'}.\n\n` +
			'Please check the following:\n' +
			'1. Your internet connection\n' +
			'2. Supabase project status at https://app.supabase.com/\n' +
			'3. Browser console for detailed error messages (press F12)';
			
		alert(errorMessage);
		
		// Update UI to show error state
		const dashboardTitle = document.getElementById('dashboardTitle');
		if (dashboardTitle) {
			dashboardTitle.innerHTML = 'Error Loading Data <small class="text-danger">(Check console for details)</small>';
		}
	} finally {
		// Ensure loading state is cleared
		const loadingElement = document.getElementById('loadingIndicator');
		if (loadingElement) {
			loadingElement.style.display = 'none';
		}
	}
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

function setupFilters() {
	populateFilterOptions();
	handleFilterChange();
}

function setupActions() {
	setupCrudHandlers();
	
	// Add event listener for toggle service details button
	document.addEventListener('click', (e) => {
		const toggleBtn = e.target.closest('.toggle-service-details');
		if (!toggleBtn) return;
		
		const id = toggleBtn.dataset.id;
		if (!id) return;
		
		// Find the details row
		const detailsRow = document.querySelector(`.service-details-row[data-parent-id="${id}"]`);
		if (!detailsRow) return;
		
		// Toggle visibility
		detailsRow.classList.toggle('d-none');
		
		// Toggle icon
		const icon = toggleBtn.querySelector('i');
		if (icon) {
			if (detailsRow.classList.contains('d-none')) {
				icon.classList.remove('bi-chevron-up');
				icon.classList.add('bi-chevron-down');
			} else {
				icon.classList.remove('bi-chevron-down');
				icon.classList.add('bi-chevron-up');
			}
		}
	});
}

function updateBundlesEmptyState() {
	const bundlesList = document.getElementById('edit_bundles_list');
	const noBundlesMessage = document.getElementById('no_bundles_message');
	if (bundlesList && noBundlesMessage) {
		const hasBundles = bundlesList.children.length > 0;
		noBundlesMessage.classList.toggle('d-none', hasBundles);
	}
}

function addBundleItem(name = '', details = '') {
	const bundleId = 'bundle-' + Math.random().toString(36).substr(2, 9);
	const bundleItem = document.createElement('div');
	bundleItem.className = 'bundle-item';
	bundleItem.id = bundleId;
	
	bundleItem.innerHTML = `
		<div class="row g-2 align-items-center">
			<div class="col-md-5">
				<div class="input-group input-group-sm">
					<span class="input-group-text"><i class="bi bi-tag"></i></span>
					<input type="text" class="form-control form-control-sm bundle-name" 
						   value="${name.replace(/"/g, '&quot;')}" 
						   placeholder="Bundle name"
						   data-bs-toggle="tooltip" 
						   title="Enter bundle name">
				</div>
			</div>
			<div class="col-md-5">
				<div class="input-group input-group-sm">
					<span class="input-group-text"><i class="bi bi-card-text"></i></span>
					<input type="text" class="form-control form-control-sm bundle-details" 
						   value="${details.replace(/"/g, '&quot;')}" 
						   placeholder="Description or SKUs"
						   data-bs-toggle="tooltip" 
						   title="Enter bundle description or SKU list">
				</div>
			</div>
			<div class="col-md-2 d-flex justify-content-end">
				<button type="button" class="btn btn-sm btn-outline-danger remove-bundle" 
						data-bs-toggle="tooltip" 
						title="Remove bundle">
					<i class="bi bi-trash"></i>
				</button>
			</div>
		</div>
	`;
	
	const bundlesList = document.getElementById('edit_bundles_list');
	if (bundlesList) {
		bundlesList.appendChild(bundleItem);
		
		// Initialize tooltips for the new elements
		const tooltipTriggerList = [].slice.call(bundleItem.querySelectorAll('[data-bs-toggle="tooltip"]'));
		tooltipTriggerList.map(function (tooltipTriggerEl) {
			return new bootstrap.Tooltip(tooltipTriggerEl);
		});
		
		// Set focus to the name field
		const nameInput = bundleItem.querySelector('.bundle-name');
		if (nameInput) nameInput.focus();
		
		updateBundlesEmptyState();
	}
	
	return bundleItem;
}

function setupCrudHandlers() {
	// Use event delegation on the table body to avoid conflicts with resize handles
	document.addEventListener('click', async (e) => {
		// Check if click is on a button within the submissions table
		const btn = e.target.closest('button[data-action]');
		if (btn) {
			// Handle table actions (existing code)
			const table = btn.closest('#submissionsTable');
			if (!table) return;
			
			const id = btn.getAttribute('data-id');
			const action = btn.getAttribute('data-action');
			const row = state.allSubmissions.find(r => r.id === id);
			if (!row) return;
			
			if (action === 'delete') {
				if (!confirm('Delete this submission?')) return;
				const { error } = await window.supa.from('submissions').delete().eq('id', id);
				if (error) return alert('Delete error: ' + error.message);
				state.allSubmissions = state.allSubmissions.filter(s => s.id !== id);
				applyFilter(); buildCharts(); renderTable();
				return;
			}
			
			if (action === 'edit') {
				// Set the current editing row and open the modal
				currentEditingRow = row;
				openEditModal(row);
			}
			
			if (action === 'view-service-mix') {
				// Find the submission data
				const submission = state.filtered.find(row => row.id === id);
				if (!submission) return;
				
				// Get the modal elements
				const modal = document.getElementById('serviceMixModal');
				const modalTitle = modal.querySelector('.modal-title');
				const modalBody = modal.querySelector('.modal-body');
				
				// Set the modal title
				modalTitle.textContent = `Service Mix Details - ${submission.company_name || 'Unknown Company'}`;
				
				// Clear previous content
				modalBody.innerHTML = '';
				
				// Get service types from service_mix
				let serviceTypes = submission.service_mix ? submission.service_mix.split(',').map(s => s.trim()) : [];
				
				if (serviceTypes.length === 0) {
					modalBody.innerHTML = '<div class="alert alert-info">No service mix details available.</div>';
				} else {
					// Create a container for the service details
					const serviceDetailsContainer = document.createElement('div');
					serviceDetailsContainer.className = 'service-details-container';
					
					// Process each service type
					serviceTypes.forEach(service => {
						let serviceDetails = null;
						let serviceTitle = '';
						let detailsField = '';
						
						// Get service details based on service type
						if (service === 'hb') {
							serviceTitle = 'Heavy & Bulky';
							detailsField = 'hb_details';
						} else if (service === 'international') {
							serviceTitle = 'International';
							detailsField = 'international_details';
						} else if (service === 'parcel') {
							serviceTitle = 'Parcel';
							detailsField = 'parcel_details';
						}
						
						// Try to parse the service details
						if (submission[detailsField]) {
							try {
								serviceDetails = JSON.parse(submission[detailsField]);
							} catch (e) {
								console.error(`Error parsing ${detailsField}:`, e);
							}
						}
						
						// Create a card for this service
						const serviceCard = document.createElement('div');
						serviceCard.className = 'card mb-3';
						
						// Create card header
						const cardHeader = document.createElement('div');
						cardHeader.className = 'card-header';
						cardHeader.textContent = serviceTitle;
						
						// Create card body
						const cardBody = document.createElement('div');
						cardBody.className = 'card-body';
						
						if (serviceDetails) {
							// Create a table for the details
							const table = document.createElement('table');
							table.className = 'table table-sm';
							
							// Add table body
							const tbody = document.createElement('tbody');
							
							// Add rows for each detail
							const addRow = (label, value) => {
								const tr = document.createElement('tr');
								const tdLabel = document.createElement('td');
								tdLabel.className = 'fw-bold';
								tdLabel.textContent = label;
								const tdValue = document.createElement('td');
								tdValue.textContent = value;
								tr.appendChild(tdLabel);
								tr.appendChild(tdValue);
								tbody.appendChild(tr);
							};
							
							// Add specific details
							if (serviceDetails.weekly_shipments) {
								addRow('Weekly Shipments', serviceDetails.weekly_shipments);
							}
							if (serviceDetails.cod_percent) {
								addRow('COD %', serviceDetails.cod_percent + '%');
							}
							if (serviceDetails.ppd_percent) {
								addRow('PPD %', serviceDetails.ppd_percent + '%');
							}
							
							// Add any other details that might be present
							Object.entries(serviceDetails).forEach(([key, value]) => {
								if (!['weekly_shipments', 'cod_percent', 'ppd_percent'].includes(key) && value) {
									// Format the key for display
									const formattedKey = key
										.split('_')
										.map(word => word.charAt(0).toUpperCase() + word.slice(1))
										.join(' ');
									addRow(formattedKey, value);
								}
							});
							
							table.appendChild(tbody);
							cardBody.appendChild(table);
						} else {
							cardBody.innerHTML = '<div class="alert alert-warning">No details available for this service.</div>';
						}
						
						// Assemble the card
						serviceCard.appendChild(cardHeader);
						serviceCard.appendChild(cardBody);
						
						// Add the card to the container
						serviceDetailsContainer.appendChild(serviceCard);
					});
					
					// Add the container to the modal body
					modalBody.appendChild(serviceDetailsContainer);
				}
				
				// Show the modal
				const bsModal = new bootstrap.Modal(modal);
				bsModal.show();
			}
		}
		
		// Handle Save Changes button
		if (e.target.id === 'saveCustomerChanges') {
			e.preventDefault();
			await saveCustomerChanges();
		}
		
		// Handle Add Bundle button
		if (e.target.id === 'add_bundle_btn' || e.target.closest('#add_bundle_btn')) {
			e.preventDefault();
			addBundleItem();
		}
		
		// Handle Remove Bundle button
		if (e.target.classList.contains('remove-bundle') || e.target.closest('.remove-bundle')) {
			e.preventDefault();
			const removeBtn = e.target.classList.contains('remove-bundle') ? e.target : e.target.closest('.remove-bundle');
			const bundleItem = removeBtn.closest('.bundle-item');
			if (bundleItem) {
				bundleItem.style.opacity = '0';
				bundleItem.style.transition = 'opacity 0.2s ease-in-out';
				setTimeout(() => {
					bundleItem.remove();
					updateBundlesEmptyState();
				}, 200);
			}
		}
		
		// Handle service option checkbox clicks to show/hide details
		if (e.target.name === 'edit_service_mix' || e.target.closest('input[name="edit_service_mix"]')) {
			const checkbox = e.target.name === 'edit_service_mix' ? e.target : e.target.closest('input[name="edit_service_mix"]');
			const serviceOption = checkbox.closest('.service-option-with-details');
			const serviceDetails = serviceOption.querySelector('.service-details');
			
			if (checkbox.checked) {
				// Show service details
				serviceDetails.classList.remove('d-none');
				serviceOption.classList.add('active');
			} else {
				// Hide service details
				serviceDetails.classList.add('d-none');
				serviceOption.classList.remove('active');
			}
		}
		
		// Handle service type change to show/hide SKU and bundles containers
		if (e.target.id === 'edit_service_type') {
			const skuContainer = document.getElementById('edit_skus_container');
			const bundlesContainer = document.getElementById('edit_bundles_container');
			const isFulfillment = e.target.value === 'fulfillment' || e.target.value === 'fulfillment-and-last-mile';
			
			if (skuContainer) skuContainer.style.display = isFulfillment ? 'block' : 'none';
			if (bundlesContainer) bundlesContainer.style.display = isFulfillment ? 'block' : 'none';
			
			// Update empty state when toggling visibility
			if (isFulfillment) {
				updateBundlesEmptyState();
			}
		}
		
		// Handle pickup frequency change to setup time slots
		if (e.target.id.endsWith('_pickup_frequency')) {
			const serviceType = e.target.id.split('_pickup_frequency')[0].replace('edit_', '');
			const timeSlotContainerId = `edit_${serviceType}_time_slot_container`;
			setupTimeSlots(timeSlotContainerId, [], e.target.value);
		}
	});
}

// Function to setup time slots based on pickup frequency
function setupTimeSlots(containerId, existingSlots = [], frequency = '') {
	const container = document.getElementById(containerId);
	if (!container) return;
	
	// Clear existing time slots
	container.innerHTML = '';
	
	// Create time slots based on frequency
	if (frequency === 'once') {
		// Single time slot for once a day
		container.innerHTML = `
			<div class="col-12">
				<input type="time" class="form-control time-slot-input" id="${containerId}_slot1" placeholder="Select time">
			</div>
		`;
	} else if (frequency === 'twice') {
		// Two time slots for twice a day
		container.innerHTML = `
			<div class="col-md-6">
				<input type="time" class="form-control time-slot-input" id="${containerId}_slot1" placeholder="Morning slot">
			</div>
			<div class="col-md-6">
				<input type="time" class="form-control time-slot-input" id="${containerId}_slot2" placeholder="Afternoon slot">
			</div>
		`;
	} else {
		// Default message when no frequency is selected
		container.innerHTML = `
			<div class="col-12">
				<div class="text-muted small">Please select a pickup frequency first</div>
			</div>
		`;
	}
	
	// Set existing values if available
	if (existingSlots && Array.isArray(existingSlots)) {
		existingSlots.forEach((slot, index) => {
			const slotInput = document.getElementById(`${containerId}_slot${index + 1}`);
			if (slotInput && slot) {
				slotInput.value = slot;
			}
		});
	}
}

// Function to open the edit modal and populate it with row data
function openEditModal(row) {
	// Helper function to safely set value
	const setValue = (id, value) => {
		const element = document.getElementById(id);
		if (element) element.value = value || '';
	};

	// Helper function to safely set checked state
	const setChecked = (id, isChecked) => {
		const element = document.getElementById(id);
		if (element) element.checked = isChecked;
	};

	// Set form field values
	setValue('edit_company_name', row.company_name);
	setValue('edit_service_type', row.service_type);
	setValue('edit_weekly_shipments', row.weekly_shipments);
	setValue('edit_weekly_units_outbound', row.weekly_units_outbound);
	setValue('edit_weekly_units_inbound', row.weekly_units_inbound);
	setValue('edit_inbound_frequency', row.inbound_frequency);
	setValue('edit_avg_units_per_shipment', row.avg_units_per_shipment);
	setValue('edit_cod_percent', row.cod_percent);
	setValue('edit_ppd_percent', row.ppd_percent);
	setValue('edit_forecast_start_date', row.forecast_start_date);
	setValue('edit_forecast_end_date', row.forecast_end_date);

	// Set notes fields if they exist
	setValue('edit_seasonality_skus_notes', row.seasonality_skus_notes || '');
	
	// Set service mix checkboxes and load service details if available
	const serviceMix = (row.service_mix || '').split(',');
	
	// Heavy & Bulky
	setChecked('edit_service_hb', serviceMix.includes('hb'));
	if (row.hb_details) {
		try {
			const hbDetails = JSON.parse(row.hb_details);
			setValue('edit_hb_start_date', hbDetails.start_date || '');
			setValue('edit_hb_end_date', hbDetails.end_date || '');
			setValue('edit_hb_pickup_frequency', hbDetails.pickup_frequency || '');
			setValue('edit_hb_city', hbDetails.city || '');
			setValue('edit_hb_district', hbDetails.district || '');
			setValue('edit_hb_weekly_shipments', hbDetails.weekly_shipments || '');
			setValue('edit_hb_cod_percent', hbDetails.cod_percent || '');
			setValue('edit_hb_ppd_percent', hbDetails.ppd_percent || '');
			
			// Setup time slots
			if (hbDetails.pickup_frequency) {
				setupTimeSlots('edit_hb_time_slot_container', hbDetails.timeSlots || [], hbDetails.pickup_frequency);
			}
			
			// Show service details if checked
			if (serviceMix.includes('hb')) {
				const serviceDetails = document.getElementById('edit_hb_service_section');
				if (serviceDetails) {
					serviceDetails.classList.remove('d-none');
					const serviceOption = serviceDetails.closest('.service-option-with-details');
					if (serviceOption) serviceOption.classList.add('active');
				}
			}
		} catch (e) {
			console.error('Error parsing hb_details:', e);
		}
	}
	
	// International
	setChecked('edit_service_international', serviceMix.includes('international'));
	if (row.international_details) {
		try {
			const intDetails = JSON.parse(row.international_details);
			setValue('edit_international_start_date', intDetails.start_date || '');
			setValue('edit_international_end_date', intDetails.end_date || '');
			setValue('edit_international_pickup_frequency', intDetails.pickup_frequency || '');
			setValue('edit_international_city', intDetails.city || '');
			setValue('edit_international_district', intDetails.district || '');
			setValue('edit_international_weekly_shipments', intDetails.weekly_shipments || '');
			setValue('edit_international_cod_percent', intDetails.cod_percent || '');
			setValue('edit_international_ppd_percent', intDetails.ppd_percent || '');
			
			// Setup time slots
			if (intDetails.pickup_frequency) {
				setupTimeSlots('edit_international_time_slot_container', intDetails.timeSlots || [], intDetails.pickup_frequency);
			}
			
			// Show service details if checked
			if (serviceMix.includes('international')) {
				const serviceDetails = document.getElementById('edit_international_service_section');
				if (serviceDetails) {
					serviceDetails.classList.remove('d-none');
					const serviceOption = serviceDetails.closest('.service-option-with-details');
					if (serviceOption) serviceOption.classList.add('active');
				}
			}
		} catch (e) {
			console.error('Error parsing international_details:', e);
		}
	}
	
	// Parcel
	setChecked('edit_service_parcel', serviceMix.includes('parcel'));
	if (row.parcel_details) {
		try {
			const parcelDetails = JSON.parse(row.parcel_details);
			setValue('edit_parcel_start_date', parcelDetails.start_date || '');
			setValue('edit_parcel_end_date', parcelDetails.end_date || '');
			setValue('edit_parcel_pickup_frequency', parcelDetails.pickup_frequency || '');
			setValue('edit_parcel_city', parcelDetails.city || '');
			setValue('edit_parcel_district', parcelDetails.district || '');
			setValue('edit_parcel_weekly_shipments', parcelDetails.weekly_shipments || '');
			setValue('edit_parcel_cod_percent', parcelDetails.cod_percent || '');
			setValue('edit_parcel_ppd_percent', parcelDetails.ppd_percent || '');
			
			// Setup time slots
			if (parcelDetails.pickup_frequency) {
				setupTimeSlots('edit_parcel_time_slot_container', parcelDetails.timeSlots || [], parcelDetails.pickup_frequency);
			}
			
			// Show service details if checked
			if (serviceMix.includes('parcel')) {
				const serviceDetails = document.getElementById('edit_parcel_service_section');
				if (serviceDetails) {
					serviceDetails.classList.remove('d-none');
					const serviceOption = serviceDetails.closest('.service-option-with-details');
					if (serviceOption) serviceOption.classList.add('active');
				}
			}
		} catch (e) {
			console.error('Error parsing parcel_details:', e);
		}
	}
	
	// Handle special bundles
	if (row.special_bundles && row.special_bundles !== 'null' && row.special_bundles !== '') {
		try {
			const bundles = JSON.parse(row.special_bundles);
			if (Array.isArray(bundles)) {
				bundles.forEach(bundle => {
					addBundleItem(bundle.name || '', bundle.details || '');
				});
			}
		} catch (e) {
			console.error('Error parsing bundles:', e);
		}
	} else {
		updateBundlesEmptyState();
	}
	
	// Show modal
	const modalElement = document.getElementById('editCustomerModal');
	if (modalElement) {
		const modal = new bootstrap.Modal(modalElement);
		modal.show();
	}
}

async function saveCustomerChanges() {
	console.log('saveCustomerChanges called');
	
	if (!currentEditingRow) {
		console.log('No currentEditingRow found');
		return;
	}
	
	console.log('Current editing row:', currentEditingRow);
	
	if (!validateForm()) {
		console.log('Form validation failed');
		return;
	}
	
	console.log('Form validation passed');
	
	// Helper function to safely get element value
	const getElementValue = (id, defaultValue = '') => {
		const element = document.getElementById(id);
		if (!element) {
			console.warn(`Element with id '${id}' not found`);
			return defaultValue;
		}
		return element.value || defaultValue;
	};
	
	// Collect bundle data from the form
	const collectBundleData = () => {
		const bundlesList = document.getElementById('edit_bundles_list');
		if (!bundlesList) return [];
		
		const bundles = [];
		const bundleItems = bundlesList.querySelectorAll('.bundle-item');
		console.log('Found bundle items:', bundleItems.length);
		bundleItems.forEach(item => {
			const nameInput = item.querySelector('.bundle-name');
			const detailsInput = item.querySelector('.bundle-details');
			if (nameInput && detailsInput) {
				const name = nameInput.value.trim();
				const details = detailsInput.value.trim();
				console.log('Bundle item:', { name, details });
				if (name || details) { // Only add if there's some content
					bundles.push({ name, details });
				}
			}
		});
		console.log('Collected bundles:', bundles);
		return bundles;
	};
	
	// Collect service details data
	const collectServiceDetails = (serviceType) => {
		const prefix = `edit_${serviceType}`;
		const checkbox = document.getElementById(`${prefix}_service_${serviceType}`);
		
		if (!checkbox || !checkbox.checked) return null;
		
		// Collect time slots
		const timeSlots = [];
		const slotInputs = document.querySelectorAll(`[id^="${prefix}_time_slot_container_slot"]`);
		slotInputs.forEach(input => {
			if (input.value) {
				timeSlots.push(input.value);
			}
		});
		
		return {
			start_date: getElementValue(`${prefix}_start_date`, ''),
			end_date: getElementValue(`${prefix}_end_date`, ''),
			pickup_frequency: getElementValue(`${prefix}_pickup_frequency`, ''),
			timeSlots: timeSlots,
			city: getElementValue(`${prefix}_city`, ''),
			district: getElementValue(`${prefix}_district`, ''),
			weekly_shipments: getElementValue(`${prefix}_weekly_shipments`, ''),
			cod_percent: getElementValue(`${prefix}_cod_percent`, ''),
			ppd_percent: getElementValue(`${prefix}_ppd_percent`, ''),
			notes: getElementValue(`${prefix}_notes`, '')
		};
	};
	
	// Prepare update data
	const updated = {
		company_name: getElementValue('edit_company_name'),
		contact_name: getElementValue('edit_contact_name'),
		contact_email: getElementValue('edit_contact_email'),
		contact_phone: getElementValue('edit_contact_phone'),
		service_type: getElementValue('edit_service_type'),
		inbound_frequency: getElementValue('edit_inbound_frequency'),
		weekly_shipments: parseFloat(getElementValue('edit_weekly_shipments')) || 0,
		avg_units_per_shipment: parseFloat(getElementValue('edit_avg_units')) || 0,
		cod_percent: parseFloat(getElementValue('edit_cod_percent')) || 0,
		ppd_percent: parseFloat(getElementValue('edit_ppd_percent')) || 0,
		service_mix: Array.from(document.querySelectorAll('input[name="edit_service_mix"]:checked')).map(cb => cb.value).join(','),
		forecast_start_date: getElementValue('edit_forecast_start_date'),
		forecast_end_date: getElementValue('edit_forecast_end_date'),
		seasonality_skus_notes: getElementValue('edit_seasonality_skus_notes').trim(),
		special_bundles: JSON.stringify(collectBundleData()),
		special_bundles_notes: getElementValue('edit_bundles_notes', ''),
		// Add service details
		hb_details: JSON.stringify(collectServiceDetails('hb')),
		international_details: JSON.stringify(collectServiceDetails('international')),
		parcel_details: JSON.stringify(collectServiceDetails('parcel'))
	};
	
	console.log('Update data:', updated);
	
	// Get the save button and store its original text
	const saveButton = document.getElementById('saveCustomerChanges');
	const originalButtonText = saveButton ? saveButton.textContent : 'Save Changes';
	
	// Set button to loading state if it exists
	if (saveButton) {
		saveButton.textContent = 'Saving...';
		saveButton.disabled = true;
	}
	
	try {
		// Update in database
		const { error } = await window.supa
			.from('customer_forecasts')
			.update(updated)
			.eq('id', currentEditingRow.id);
		
		if (error) {
			console.error('Supabase error:', error);
			throw error;
		}
		
		console.log('Database update successful');
		
		// Update local state
		const idx = state.allSubmissions.findIndex(s => s.id === currentEditingRow.id);
		if (idx >= 0) {
			state.allSubmissions[idx] = { ...state.allSubmissions[idx], ...updated };
			console.log('Local state updated');
		}
		
		// Refresh UI
		applyFilter();
		buildCharts();
		renderTable();
		console.log('UI refreshed');
		
		// Close modal
		bootstrap.Modal.getInstance(document.getElementById('editCustomerModal')).hide();
		currentEditingRow = null;
		// Show success message
		alert('Customer record updated successfully!');
	} catch (error) {
		console.error('Error saving customer changes:', error);
		alert(`Error updating customer record: ${error.message || 'Unknown error'}`);
		
		// Reset button state on error
		if (saveButton) {
			saveButton.textContent = originalButtonText;
			saveButton.disabled = false;
		}
		return;
	}
	
	// Reset button state (in case the function continues after try/catch)
	if (saveButton) {
		saveButton.textContent = originalButtonText;
		saveButton.disabled = false;
	}
}

function validateForm() {
	let isValid = true;
	const errors = [];
	
	// Validate COD + PPD = 100%
	const cod = parseFloat(document.getElementById('edit_cod_percent').value) || 0;
	const ppd = parseFloat(document.getElementById('edit_ppd_percent').value) || 0;
	if (Math.abs(cod + ppd - 100) > 0.01) {
		errors.push('COD + PPD must equal 100%');
		isValid = false;
	}
	
	// Validate Service Mix - at least one option selected
	const serviceMixChecked = document.querySelectorAll('input[name="edit_service_mix"]:checked');
	if (serviceMixChecked.length === 0) {
		errors.push('Please select at least one service mix option');
		isValid = false;
	}
	
	// Validate service details if checked
	serviceMixChecked.forEach(checkbox => {
		const serviceType = checkbox.value;
		const prefix = `edit_${serviceType}`;
		
		// Check required fields for each selected service
		const serviceCheckbox = document.getElementById(`${prefix}_service_${serviceType}`);
		if (serviceCheckbox && serviceCheckbox.checked) {
			// Add any specific validation for this service type if needed
		}
	});
	
	// Display errors if any
	if (!isValid) {
		alert('Please fix the following errors:\n' + errors.join('\n'));
	}
	
	return isValid;
}

async function setupExport() {
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

// Handle filter changes
function handleFilterChange() {
    const filterSelect = document.getElementById('customerFilter');
    if (!filterSelect) return;
    
    filterSelect.addEventListener('change', () => {
        state.filterCompany = filterSelect.value;
        applyFilter();
        refreshTitle();
        buildCharts();
        renderTable();
    });
}

// Setup filters
function setupFilters() {
    handleFilterChange();
}

// Initialize
window.addEventListener('DOMContentLoaded', async () => {
	await loadData();
	setupFilters();
	setupActions();
	setupExport();
}); // Close event listener
