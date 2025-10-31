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
	return (Number(sub.weekly_shipments) || 0) * 4 * 10;
}

function sumMonthlyShipments(items) {
	return items.reduce((acc, s) => acc + ((Number(s.weekly_shipments) || 0) * 4), 0);
}

function average(arr) {
	if (!arr.length) return 0;
	return arr.reduce((a, b) => a + b, 0) / arr.length;
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
	const companies = Array.from(new Set(state.allSubmissions.map(s => s.company_name))).sort();
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

// Helper functions for enhanced charts
function calculatePreviousMonthShipments(items) {
	// Calculate shipments from previous month based on created_at dates
	const now = new Date();
	const previousMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
	const currentMonth = new Date(now.getFullYear(), now.getMonth(), 1);

	return items
		.filter(item => {
			const createdDate = new Date(item.created_at);
			return createdDate >= previousMonth && createdDate < currentMonth;
		})
		.reduce((acc, item) => acc + (item.weekly_shipments || 0), 0);
}

function calculatePreviousMonthInvoice(items) {
	const now = new Date();
	const previousMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
	const currentMonth = new Date(now.getFullYear(), now.getMonth(), 1);

	return items
		.filter(item => {
			const createdDate = new Date(item.created_at);
			return createdDate >= previousMonth && createdDate < currentMonth;
		})
		.reduce((acc, item) => acc + calculateInvoiceValue(item), 0);
}

function filterTableByPeriod(period) {
	// This function will be implemented to filter the table based on time period
	console.log(`Filtering table by period: ${period}`);
	// For now, just show a toast
	showToast(`Filtering by ${period} month data`, 'info');
}

function filterTableByServiceType(serviceType) {
	// This function will filter the table based on service type
	console.log(`Filtering table by service type: ${serviceType}`);
	showToast(`Filtering by ${serviceType} service`, 'info');
}

// Chart calculation helper functions
function calculateTrendData(items) {
	const months = [];
	const shipments = [];
	const revenue = [];

	// Generate last 6 months of data
	for (let i = 5; i >= 0; i--) {
		const date = new Date();
		date.setMonth(date.getMonth() - i);
		const monthKey = date.toISOString().substring(0, 7);
		months.push(date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }));

		// Calculate data for this month
		const monthItems = items.filter(item => {
			const itemDate = new Date(item.created_at);
			return itemDate.toISOString().substring(0, 7) === monthKey;
		});

		const monthShipments = monthItems.reduce((acc, item) => acc + (item.weekly_shipments || 0), 0);
		const monthRevenue = monthItems.reduce((acc, item) => acc + calculateInvoiceValue(item), 0);

		shipments.push(monthShipments);
		revenue.push(monthRevenue);
	}

	return { labels: months, shipments, revenue };
}

function calculateTopCustomersByInvoice(items) {
	const customerData = {};

	items.forEach(item => {
		const customer = item.company_name || 'Unknown';
		if (!customerData[customer]) {
			customerData[customer] = 0;
		}
		customerData[customer] += calculateInvoiceValue(item);
	});

	const sorted = Object.entries(customerData)
		.sort(([, a], [, b]) => b - a)
		.slice(0, 5);

	return {
		labels: sorted.map(([name]) => name),
		data: sorted.map(([, value]) => value)
	};
}

function calculateRevenueByService(items) {
	const serviceData = {
		'Heavy & Bulky': 0,
		'International': 0,
		'Parcel': 0
	};

	items.forEach(item => {
		const revenue = calculateInvoiceValue(item);
		if (item.service_mix) {
			const services = item.service_mix.split(',').map(s => s.trim());
			if (services.includes('hb')) serviceData['Heavy & Bulky'] += revenue;
			if (services.includes('international')) serviceData['International'] += revenue;
			if (services.includes('parcel')) serviceData['Parcel'] += revenue;
		}
	});

	return {
		labels: Object.keys(serviceData),
		data: Object.values(serviceData)
	};
}

function calculateServiceTypeDistribution(items) {
	const serviceTypes = {};

	// Debug: Log all service types found
	const allServiceTypes = items.map(item => item.service_type).filter(Boolean);
	console.log('All service types found:', [...new Set(allServiceTypes)]);

	items.forEach(item => {
		const serviceType = item.service_type || 'Unknown';
		serviceTypes[serviceType] = (serviceTypes[serviceType] || 0) + 1;
	});

	console.log('Service type distribution:', serviceTypes);

	// Sort by count (descending) for better visualization
	const sortedEntries = Object.entries(serviceTypes).sort((a, b) => b[1] - a[1]);

	const labels = sortedEntries.map(([key]) => key);
	const data = sortedEntries.map(([, value]) => value);

	return { labels, data };
}

function calculateStatusDistribution(items) {
	const statusCounts = {
		'Active': 0,
		'On Hold': 0,
		'Inactive': 0
	};

	items.forEach(item => {
		const status = item.status || 'active';
		if (status === 'active') statusCounts['Active']++;
		else if (status === 'on_hold') statusCounts['On Hold']++;
		else if (status === 'inactive') statusCounts['Inactive']++;
	});

	return {
		labels: Object.keys(statusCounts),
		data: Object.values(statusCounts)
	};
}

function calculateStatusTrend(items) {
	const months = [];
	const active = [];
	const onHold = [];
	const inactive = [];

	// Generate last 6 months
	for (let i = 5; i >= 0; i--) {
		const date = new Date();
		date.setMonth(date.getMonth() - i);
		months.push(date.toLocaleDateString('en-US', { month: 'short' }));

		// Calculate status counts for this month
		const monthItems = items.filter(item => {
			const itemDate = new Date(item.created_at);
			return itemDate.getMonth() === date.getMonth() && itemDate.getFullYear() === date.getFullYear();
		});

		const monthActive = monthItems.filter(item => (item.status || 'active') === 'active').length;
		const monthOnHold = monthItems.filter(item => item.status === 'on_hold').length;
		const monthInactive = monthItems.filter(item => item.status === 'inactive').length;

		active.push(monthActive);
		onHold.push(monthOnHold);
		inactive.push(monthInactive);
	}

	return { labels: months, active, onHold, inactive };
}

function calculateStatusRevenue(items) {
	const statusRevenue = {
		'Active': 0,
		'On Hold': 0,
		'Inactive': 0
	};

	items.forEach(item => {
		const revenue = calculateInvoiceValue(item);
		const status = item.status || 'active';
		if (status === 'active') statusRevenue['Active'] += revenue;
		else if (status === 'on_hold') statusRevenue['On Hold'] += revenue;
		else if (status === 'inactive') statusRevenue['Inactive'] += revenue;
	});

	return {
		labels: Object.keys(statusRevenue),
		data: Object.values(statusRevenue)
	};
}

function calculateStatusByService(items) {
	const serviceTypes = ['Fulfillment', 'Last Mile', 'Fulfillment and Last Mile'];
	const statusCounts = {
		'Fulfillment': { active: 0, onHold: 0, inactive: 0 },
		'Last Mile': { active: 0, onHold: 0, inactive: 0 },
		'Fulfillment and Last Mile': { active: 0, onHold: 0, inactive: 0 }
	};

	items.forEach(item => {
		const serviceType = item.service_type || 'Fulfillment';
		const status = item.status || 'active';

		if (statusCounts[serviceType]) {
			if (status === 'active') statusCounts[serviceType].active++;
			else if (status === 'on_hold') statusCounts[serviceType].onHold++;
			else if (status === 'inactive') statusCounts[serviceType].inactive++;
		}
	});

	return {
		labels: serviceTypes,
		active: serviceTypes.map(type => statusCounts[type].active),
		onHold: serviceTypes.map(type => statusCounts[type].onHold),
		inactive: serviceTypes.map(type => statusCounts[type].inactive)
	};
}

function buildCharts(retryCount = 0) {
	const items = state.filtered;
	const ctxShip = document.getElementById('chartShipments');
	const ctxInv = document.getElementById('chartInvoice');
	const ctxSvc = document.getElementById('chartService');
	const ctxCod = document.getElementById('chartCod');

	// Check if the charts tab is currently active first
	const chartsTab = document.getElementById('charts');
	const isChartsTabActive = chartsTab && chartsTab.classList.contains('show') && !chartsTab.classList.contains('d-none');

	if (!isChartsTabActive) {
		console.log('Charts tab not active. Skipping chart build.');
		return;
	}

	// Check if canvas elements exist and are visible
	if (!ctxShip || !ctxInv || !ctxSvc || !ctxCod) {
		if (retryCount < 3) {
			console.warn(`Chart canvas elements not found. Retrying in 100ms... (attempt ${retryCount + 1}/3)`);
			setTimeout(() => {
				buildCharts(retryCount + 1);
			}, 100);
		} else {
			console.error('Chart canvas elements not found after 3 retries. Giving up.');
		}
		return;
	}

	// Note: We intentionally hide canvas elements for the card display, so we don't need to check visibility

	// Destroy existing charts
	Object.keys(state.charts).forEach(key => {
		if (state.charts[key]) {
			state.charts[key].destroy();
			state.charts[key] = null;
		}
	});

	// Chart 1: Monthly Shipments Card
	const monthlyShip = sumMonthlyShipments(items);
	console.log('Building charts with', items.length, 'items. Monthly shipments:', monthlyShip);

	// Check if canvas exists before proceeding
	if (ctxShip && ctxShip.parentElement) {
		const cardBody = ctxShip.parentElement;

		// Hide the canvas
		ctxShip.style.display = 'none';

		// Create or update card content
		let cardContent = cardBody.querySelector('.chart-card-content');
		if (!cardContent) {
			cardContent = document.createElement('div');
			cardContent.className = 'chart-card-content';
			cardBody.appendChild(cardContent);
		}

		cardContent.innerHTML = `
			<div class="d-flex flex-column align-items-center justify-content-center h-100 text-center p-4">
				<div class="display-4 fw-bold mb-3" style="color: #1f6a4a;">${monthlyShip.toLocaleString()}</div>
				<div class="text-muted fs-5 mb-4">Total Monthly Shipments</div>
				<div>
					<i class="bi bi-truck fs-1" style="color: #1f6a4a;"></i>
				</div>
			</div>
		`;

		// Show the card body
		cardBody.style.display = 'block';
	} else {
		console.warn('Chart canvas not found: chartShipments');
	}

	// Chart 2: Invoice Value Card
	const invoiceTotal = items.reduce((acc, s) => acc + calculateInvoiceValue(s), 0);

	// Check if canvas exists before proceeding
	if (ctxInv && ctxInv.parentElement) {
		const cardBody2 = ctxInv.parentElement;

		// Hide the canvas
		ctxInv.style.display = 'none';

		// Create or update card content
		let cardContent2 = cardBody2.querySelector('.chart-card-content');
		if (!cardContent2) {
			cardContent2 = document.createElement('div');
			cardContent2.className = 'chart-card-content';
			cardBody2.appendChild(cardContent2);
		}

		cardContent2.innerHTML = `
			<div class="d-flex flex-column align-items-center justify-content-center h-100 text-center p-4">
				<div class="display-4 fw-bold text-warning mb-3">${invoiceTotal.toLocaleString()}</div>
				<div class="text-muted fs-5 mb-4">Total Invoice Value (SAR)</div>
				<div>
					<i class="bi bi-currency-exchange fs-1 text-warning"></i>
				</div>
			</div>
		`;

		// Show the card body
		cardBody2.style.display = 'block';
	} else {
		console.warn('Chart canvas not found: chartInvoice');
	}

	// Chart 3: Enhanced Service Mix with Better Data
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

	state.charts.service = new Chart(ctxSvc, {
		type: 'doughnut',
		data: {
			labels: ['Heavy & Bulky', 'International', 'Parcel'],
			datasets: [{
				data: [avgHB, avgInt, avgPar],
				backgroundColor: [
					'rgba(31, 106, 74, 0.8)',
					'rgba(46, 158, 110, 0.8)',
					'rgba(215, 228, 222, 0.8)'
				],
				borderColor: [
					'rgba(31, 106, 74, 1)',
					'rgba(46, 158, 110, 1)',
					'rgba(215, 228, 222, 1)'
				],
				borderWidth: 3,
				hoverOffset: 10
			}]
		},
		options: {
			responsive: true,
			maintainAspectRatio: true,
			aspectRatio: 1.5,
			plugins: {
				legend: {
					position: 'bottom',
					labels: {
						usePointStyle: true,
						padding: 20,
						font: { size: 12, weight: 'bold' },
						generateLabels: function (chart) {
							const data = chart.data;
							if (data.labels.length && data.datasets.length) {
								return data.labels.map((label, i) => {
									const value = data.datasets[0].data[i];
									return {
										text: `${label}: ${value.toFixed(1)}%`,
										fillStyle: data.datasets[0].backgroundColor[i],
										strokeStyle: data.datasets[0].borderColor[i],
										lineWidth: data.datasets[0].borderWidth,
										pointStyle: 'circle'
									};
								});
							}
							return [];
						}
					}
				},
				tooltip: {
					backgroundColor: 'rgba(0, 0, 0, 0.8)',
					titleColor: 'white',
					bodyColor: 'white',
					borderColor: '#1f6a4a',
					borderWidth: 2,
					cornerRadius: 8,
					callbacks: {
						label: function (context) {
							const value = context.parsed;
							const total = context.dataset.data.reduce((a, b) => a + b, 0);
							const percentage = ((value / total) * 100).toFixed(1);
							return `${context.label}: ${value.toFixed(1)}% (${percentage}% of total)`;
						}
					}
				}
			},
			animation: {
				duration: 1000,
				easing: 'easeInOutQuart'
			},
			onClick: (event, elements) => {
				if (elements.length > 0) {
					const serviceType = ['hb', 'international', 'parcel'][elements[0].index];
					filterTableByServiceType(serviceType);
				}
			}
		}
	});

	// Chart 4: Enhanced COD/PPD with Better Styling
	let totalCOD = 0;
	let totalPPD = 0;
	let validEntries = 0;

	items.forEach(item => {
		// Check each service type for COD/PPD percentages
		const serviceTypes = ['hb_details', 'international_details', 'parcel_details'];

		serviceTypes.forEach(serviceType => {
			if (item[serviceType]) {
				try {
					const details = JSON.parse(item[serviceType]);
					if (details && typeof details === 'object') {
						const cod = parseFloat(details.cod_percent) || 0;
						const ppd = parseFloat(details.ppd_percent) || 0;

						if (cod > 0 || ppd > 0) {
							totalCOD += cod;
							totalPPD += ppd;
							validEntries++;
						}
					}
				} catch (e) {
					console.warn(`Error parsing ${serviceType}:`, e);
				}
			}
		});
	});

	const avgCOD = validEntries > 0 ? totalCOD / validEntries : 0;
	const avgPPD = validEntries > 0 ? totalPPD / validEntries : 0;

	state.charts.cod = new Chart(ctxCod, {
		type: 'doughnut',
		data: {
			labels: ['Cash on Delivery', 'Prepaid'],
			datasets: [{
				data: [avgCOD, avgPPD],
				backgroundColor: [
					'rgba(255, 157, 24, 0.8)',
					'rgba(255, 216, 163, 0.8)'
				],
				borderColor: [
					'rgba(255, 157, 24, 1)',
					'rgba(255, 216, 163, 1)'
				],
				borderWidth: 3,
				hoverOffset: 10
			}]
		},
		options: {
			responsive: true,
			maintainAspectRatio: true,
			aspectRatio: 1.5,
			plugins: {
				legend: {
					position: 'bottom',
					labels: {
						usePointStyle: true,
						padding: 20,
						font: { size: 12, weight: 'bold' },
						generateLabels: function (chart) {
							const data = chart.data;
							if (data.labels.length && data.datasets.length) {
								return data.labels.map((label, i) => {
									const value = data.datasets[0].data[i];
									return {
										text: `${label}: ${value.toFixed(1)}%`,
										fillStyle: data.datasets[0].backgroundColor[i],
										strokeStyle: data.datasets[0].borderColor[i],
										lineWidth: data.datasets[0].borderWidth,
										pointStyle: 'circle'
									};
								});
							}
							return [];
						}
					}
				},
				tooltip: {
					backgroundColor: 'rgba(0, 0, 0, 0.8)',
					titleColor: 'white',
					bodyColor: 'white',
					borderColor: '#ff9d18',
					borderWidth: 2,
					cornerRadius: 8,
					callbacks: {
						label: function (context) {
							const value = context.parsed;
							return `${context.label}: ${value.toFixed(1)}%`;
						}
					}
				}
			},
			animation: {
				duration: 1000,
				easing: 'easeInOutQuart'
			}
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

		// Create main row
		tr.innerHTML = `
            <td>${createdAt}</td>
            <td>${row.company_name || 'N/A'}</td>
            <td>${row.employee_name || 'N/A'}</td>
            <td>${row.employee_email || 'N/A'}</td>
            <td>${productType}</td>
            <td>${row.weekly_shipments ?? 'N/A'}</td>
            <td>${row.weekly_units_outbound ?? 'N/A'}</td>
            <td>${row.weekly_units_inbound ?? 'N/A'}</td>
            <td>${formatDate(row.forecast_start_date)}</td>
            <td>${formatDate(row.forecast_end_date)}</td>
            <td>${inboundFreq}</td>
            <td>${row.avg_units_per_shipment ?? 'N/A'}</td>
            <td>
                <div class="service-mix-cell">
                <div class="d-flex align-items-center">
                    <span>${serviceMixDisplay}</span>
                    <button class="btn btn-sm btn-link p-0 ms-2 toggle-service-details" data-id="${row.id}">
                        <i class="bi bi-chevron-down"></i>
                    </button>
                    </div>
                    <div class="service-details-inline d-none" id="service-details-${row.id}">
                        <!-- Service details will be populated here -->
                    </div>
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
                ${row.forecast_file_name ?
				`<div class="file-management">
                        <div class="d-flex align-items-center gap-2">
                            <i class="bi bi-file-earmark-excel text-success"></i>
                            <span class="file-name" title="${row.forecast_file_name}">${row.forecast_file_name.length > 20 ? row.forecast_file_name.substring(0, 17) + '...' : row.forecast_file_name}</span>
                        </div>
                        <div class="file-actions mt-1">
                            <button class="btn btn-sm btn-outline-primary me-1" onclick="downloadFile('${row.forecast_file_path}', '${row.forecast_file_name}')" title="Download">
                                <i class="bi bi-download"></i>
                            </button>
                            <button class="btn btn-sm btn-outline-warning me-1" onclick="renameFile('${row.id}', '${row.forecast_file_name}')" title="Rename">
                                <i class="bi bi-pencil"></i>
                            </button>
                            <button class="btn btn-sm btn-outline-danger" onclick="deleteFile('${row.id}', '${row.forecast_file_path}')" title="Delete">
                                <i class="bi bi-trash"></i>
                            </button>
                        </div>
                    </div>` :
				'<span class="text-muted">No file</span>'
			}
            </td>
            <td>
                ${row.status ?
				`<select class="form-select form-select-sm status-select" data-id="${row.id}" style="min-width: 120px;">
                        <option value="active" ${row.status === 'active' ? 'selected' : ''}>Active</option>
                        <option value="on_hold" ${row.status === 'on_hold' ? 'selected' : ''}>On Hold</option>
                        <option value="inactive" ${row.status === 'inactive' ? 'selected' : ''}>Inactive</option>
                    </select>` :
				'<span class="text-muted">N/A</span>'
			}
            </td>
            <td>
                <div class="action-buttons d-flex gap-2">
                    <button class="btn btn-sm btn-primary action-btn edit-btn" data-action="edit" data-id="${row.id}" title="Edit submission">
                        <i class="bi bi-pencil-square me-1"></i>
                        <span>Edit</span>
                    </button>
                    <button class="btn btn-sm btn-danger action-btn delete-btn" data-action="delete" data-id="${row.id}" title="Delete submission">
                        <i class="bi bi-trash3 me-1"></i>
                        <span>Delete</span>
                    </button>
                </div>
            </td>`;

		tbody.appendChild(tr);

		// Populate service details inline within the service mix cell
		const serviceDetailsContainer = document.getElementById(`service-details-${row.id}`);
		if (serviceDetailsContainer) {
			let detailsContent = '';
			const serviceItems = row.service_mix ? row.service_mix.split(',').map(s => s.trim()) : [];

			if (serviceItems.length === 0) {
				detailsContent = '<div class="alert alert-info m-2">No service mix details available.</div>';
			} else {
				detailsContent = '<div class="d-flex flex-wrap" style="gap: 20px; justify-content: flex-start; align-items: stretch;">';

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

					detailsContent += `<div class="card">
                        <div class="card-header">${serviceTitle}</div>
                        <div class="card-body">`;

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
								detailsContent += `<tr><td class="fw-bold">Cash on Delivery %</td><td>${serviceDetails.cod_percent}%</td></tr>`;
							}
							if (serviceDetails.ppd_percent) {
								detailsContent += `<tr><td class="fw-bold">Pre Paid %</td><td>${serviceDetails.ppd_percent}%</td></tr>`;
							}

							// Handle time slots specifically
							if (serviceDetails.timeSlots && Array.isArray(serviceDetails.timeSlots) && serviceDetails.timeSlots.length > 0) {
								const timeSlotLabels = serviceDetails.timeSlots.map(slot => {
									const timeMap = {
										'morning': '7:00 AM - 9:00 AM',
										'noon': '11:00 AM - 1:00 PM',
										'afternoon': '1:00 PM - 2:00 PM',
										'evening': '2:00 PM - 4:00 PM'
									};
									return timeMap[slot] || slot;
								});
								detailsContent += `<tr><td class="fw-bold">Time Slots</td><td>${timeSlotLabels.join(', ')}</td></tr>`;
							}

							// Add any other details that might be present
							Object.entries(serviceDetails).forEach(([key, value]) => {
								if (!['weekly_shipments', 'cod_percent', 'ppd_percent', 'timeSlots', 'error'].includes(key) && value) {
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

			serviceDetailsContainer.innerHTML = detailsContent;
		}
	});

	// Add resize handles after table is rendered
	addResizeHandles();

	// Apply initial status styling to status selects
	setTimeout(() => {
		document.querySelectorAll('.status-select').forEach(select => {
			applyStatusStyling(select, select.value);
		});
	}, 100);
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
		buildCharts(0);
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
				buildCharts(0);
				renderTable();
			})
			.on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'submissions' }, payload => {
				const idx = state.allSubmissions.findIndex(s => s.id === payload.new.id);
				if (idx >= 0) state.allSubmissions[idx] = payload.new;
				applyFilter();
				buildCharts(0);
				renderTable();
			})
			.on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'submissions' }, payload => {
				state.allSubmissions = state.allSubmissions.filter(s => s.id !== payload.old.id);
				applyFilter();
				buildCharts(0);
				renderTable();
			})
			.subscribe();
	} catch (e) {
		console.warn('Realtime unavailable', e);
	}
}

function handleFilterChange() {
	const select = document.getElementById('customerFilter');
	if (select) {
		select.addEventListener('change', function () {
			console.log('Filter changed to:', this.value);
			state.filterCompany = this.value;
			applyFilter();
			console.log('Filtered data length:', state.filtered.length);
			console.log('Sample filtered item:', state.filtered[0]);
			refreshTitle();

			// Check if we're on the Charts tab before rebuilding charts
			const chartsTab = document.getElementById('charts');
			const chartsTabButton = document.querySelector('[data-bs-target="#charts"]');
			const isChartsTabActive = chartsTab && chartsTab.classList.contains('show') && !chartsTab.classList.contains('d-none') &&
				chartsTabButton && chartsTabButton.classList.contains('active');

			if (isChartsTabActive) {
				console.log('Charts tab is active, rebuilding charts...');
				// Add a small delay to ensure DOM is ready
				setTimeout(() => {
					buildCharts(0);
					buildAnalyticsCharts();
					buildStatusCharts();
				}, 50);
			} else {
				console.log('Charts tab not active, skipping chart rebuild');
			}

			renderTable();
		});
	}

	// Build additional charts for analytics and status views
	buildAnalyticsCharts();
	buildStatusCharts();
}

function buildAnalyticsCharts() {
	const items = state.filtered;

	// Destroy existing analytics charts
	const analyticsCharts = ['trend', 'topCustomersByInvoice', 'revenueByService', 'serviceTypeDistribution'];
	analyticsCharts.forEach(chartKey => {
		if (state.charts[chartKey]) {
			state.charts[chartKey].destroy();
			state.charts[chartKey] = null;
		}
	});

	// Chart: Shipments Trend Over Time
	const trendData = calculateTrendData(items);
	const ctxTrend = document.getElementById('chartTrend');
	if (ctxTrend) {
		state.charts.trend = new Chart(ctxTrend, {
			type: 'line',
			data: {
				labels: trendData.labels,
				datasets: [{
					label: 'Monthly Shipments',
					data: trendData.shipments,
					borderColor: '#1f6a4a',
					backgroundColor: 'rgba(31, 106, 74, 0.1)',
					borderWidth: 3,
					fill: true,
					tension: 0.4
				}, {
					label: 'Revenue (SAR)',
					data: trendData.revenue,
					borderColor: '#ff9d18',
					backgroundColor: 'rgba(255, 157, 24, 0.1)',
					borderWidth: 3,
					fill: true,
					tension: 0.4,
					yAxisID: 'y1'
				}]
			},
			options: {
				responsive: true,
				maintainAspectRatio: true,
				aspectRatio: 2.5,
				plugins: {
					legend: {
						position: 'top',
						labels: {
							usePointStyle: true,
							padding: 20
						}
					},
					tooltip: {
						mode: 'index',
						intersect: false,
						backgroundColor: 'rgba(0, 0, 0, 0.8)',
						titleColor: 'white',
						bodyColor: 'white'
					}
				},
				scales: {
					y: {
						type: 'linear',
						display: true,
						position: 'left',
						title: {
							display: true,
							text: 'Shipments'
						}
					},
					y1: {
						type: 'linear',
						display: true,
						position: 'right',
						title: {
							display: true,
							text: 'Revenue (SAR)'
						},
						grid: {
							drawOnChartArea: false,
						}
					}
				}
			}
		});
	}

	// Chart: Top Customer by Invoice
	const topCustomersByInvoice = calculateTopCustomersByInvoice(items);
	const ctxTopCustomersByInvoice = document.getElementById('chartTopCustomersByInvoice');
	if (ctxTopCustomersByInvoice) {
		state.charts.topCustomersByInvoice = new Chart(ctxTopCustomersByInvoice, {
			type: 'doughnut',
			data: {
				labels: topCustomersByInvoice.labels,
				datasets: [{
					data: topCustomersByInvoice.data,
					backgroundColor: [
						'#1f6a4a',
						'#ff9d18',
						'#dc3545',
						'#6f42c1',
						'#20c997'
					],
					borderColor: '#ffffff',
					borderWidth: 3,
					hoverOffset: 10
				}]
			},
			options: {
				responsive: true,
				maintainAspectRatio: true,
				aspectRatio: 1,
				plugins: {
					legend: {
						position: 'bottom',
						labels: {
							usePointStyle: true,
							padding: 15,
							font: {
								size: 12,
								weight: '500'
							}
						}
					},
					tooltip: {
						backgroundColor: 'rgba(0, 0, 0, 0.8)',
						titleColor: '#ffffff',
						bodyColor: '#ffffff',
						borderColor: '#1f6a4a',
						borderWidth: 1,
						callbacks: {
							label: function (context) {
								const total = context.dataset.data.reduce((a, b) => a + b, 0);
								const percentage = ((context.parsed / total) * 100).toFixed(1);
								return `${context.label}: ${context.parsed.toLocaleString()} SAR (${percentage}%)`;
							}
						}
					}
				},
				cutout: '60%'
			}
		});
	}

	// Chart: Revenue by Service Type
	const revenueByService = calculateRevenueByService(items);
	const ctxRevenueByService = document.getElementById('chartRevenueByService');
	if (ctxRevenueByService) {
		state.charts.revenueByService = new Chart(ctxRevenueByService, {
			type: 'bar',
			data: {
				labels: revenueByService.labels,
				datasets: [{
					label: 'Revenue (SAR)',
					data: revenueByService.data,
					backgroundColor: [
						'rgba(31, 106, 74, 0.8)',
						'rgba(46, 158, 110, 0.8)',
						'rgba(215, 228, 222, 0.8)'
					],
					borderColor: [
						'rgba(31, 106, 74, 1)',
						'rgba(46, 158, 110, 1)',
						'rgba(215, 228, 222, 1)'
					],
					borderWidth: 2,
					borderRadius: 8
				}]
			},
			options: {
				responsive: true,
				maintainAspectRatio: true,
				aspectRatio: 1.5,
				plugins: {
					legend: {
						display: false
					}
				},
				scales: {
					y: {
						beginAtZero: true,
						ticks: {
							callback: function (value) {
								return value.toLocaleString() + ' SAR';
							}
						}
					}
				}
			}
		});
	}

	// Chart: Service Type Distribution
	const serviceTypeData = calculateServiceTypeDistribution(items);
	const ctxServiceTypeDistribution = document.getElementById('chartServiceTypeDistribution');
	if (ctxServiceTypeDistribution) {
		state.charts.serviceTypeDistribution = new Chart(ctxServiceTypeDistribution, {
			type: 'doughnut',
			data: {
				labels: serviceTypeData.labels,
				datasets: [{
					data: serviceTypeData.data,
					backgroundColor: [
						'#1f6a4a',
						'#ff9d18',
						'#dc3545',
						'#6f42c1',
						'#20c997'
					],
					borderColor: '#ffffff',
					borderWidth: 3,
					hoverOffset: 10
				}]
			},
			options: {
				responsive: true,
				maintainAspectRatio: true,
				aspectRatio: 1.5,
				plugins: {
					legend: {
						position: 'bottom',
						labels: {
							padding: 20,
							usePointStyle: true,
							font: {
								size: 12,
								weight: '500'
							}
						}
					},
					tooltip: {
						backgroundColor: 'rgba(0, 0, 0, 0.8)',
						titleColor: '#ffffff',
						bodyColor: '#ffffff',
						borderColor: '#1f6a4a',
						borderWidth: 1,
						callbacks: {
							label: function (context) {
								const total = context.dataset.data.reduce((a, b) => a + b, 0);
								const percentage = ((context.parsed / total) * 100).toFixed(1);
								return `${context.label}: ${context.parsed} (${percentage}%)`;
							}
						}
					}
				},
				cutout: '60%'
			}
		});
	}
}

function buildStatusCharts() {
	const items = state.filtered;

	// Destroy existing status charts
	const statusCharts = ['status', 'statusTrend', 'statusRevenue', 'statusByService'];
	statusCharts.forEach(chartKey => {
		if (state.charts[chartKey]) {
			state.charts[chartKey].destroy();
			state.charts[chartKey] = null;
		}
	});

	// Chart: Status Distribution
	const statusData = calculateStatusDistribution(items);
	const ctxStatus = document.getElementById('chartStatus');
	if (ctxStatus) {
		state.charts.status = new Chart(ctxStatus, {
			type: 'doughnut',
			data: {
				labels: statusData.labels,
				datasets: [{
					data: statusData.data,
					backgroundColor: [
						'rgba(40, 167, 69, 0.8)',   // Active - Green
						'rgba(255, 193, 7, 0.8)',   // On Hold - Yellow
						'rgba(220, 53, 69, 0.8)'    // Inactive - Red
					],
					borderColor: [
						'rgba(40, 167, 69, 1)',
						'rgba(255, 193, 7, 1)',
						'rgba(220, 53, 69, 1)'
					],
					borderWidth: 3
				}]
			},
			options: {
				responsive: true,
				maintainAspectRatio: true,
				aspectRatio: 1,
				plugins: {
					legend: {
						position: 'bottom',
						labels: {
							usePointStyle: true,
							padding: 15
						}
					}
				}
			}
		});
	}

	// Chart: Status Trends Over Time
	const statusTrendData = calculateStatusTrend(items);
	const ctxStatusTrend = document.getElementById('chartStatusTrend');
	if (ctxStatusTrend) {
		state.charts.statusTrend = new Chart(ctxStatusTrend, {
			type: 'line',
			data: {
				labels: statusTrendData.labels,
				datasets: [{
					label: 'Active',
					data: statusTrendData.active,
					borderColor: 'rgba(40, 167, 69, 1)',
					backgroundColor: 'rgba(40, 167, 69, 0.1)',
					borderWidth: 3,
					fill: false
				}, {
					label: 'On Hold',
					data: statusTrendData.onHold,
					borderColor: 'rgba(255, 193, 7, 1)',
					backgroundColor: 'rgba(255, 193, 7, 0.1)',
					borderWidth: 3,
					fill: false
				}, {
					label: 'Inactive',
					data: statusTrendData.inactive,
					borderColor: 'rgba(220, 53, 69, 1)',
					backgroundColor: 'rgba(220, 53, 69, 0.1)',
					borderWidth: 3,
					fill: false
				}]
			},
			options: {
				responsive: true,
				maintainAspectRatio: true,
				aspectRatio: 2,
				plugins: {
					legend: {
						position: 'top',
						labels: {
							usePointStyle: true,
							padding: 20
						}
					}
				},
				scales: {
					y: {
						beginAtZero: true,
						title: {
							display: true,
							text: 'Number of Submissions'
						}
					}
				}
			}
		});
	}

	// Chart: Active vs Inactive Revenue
	const statusRevenueData = calculateStatusRevenue(items);
	const ctxStatusRevenue = document.getElementById('chartStatusRevenue');
	if (ctxStatusRevenue) {
		state.charts.statusRevenue = new Chart(ctxStatusRevenue, {
			type: 'bar',
			data: {
				labels: statusRevenueData.labels,
				datasets: [{
					label: 'Revenue (SAR)',
					data: statusRevenueData.data,
					backgroundColor: [
						'rgba(40, 167, 69, 0.8)',
						'rgba(255, 193, 7, 0.8)',
						'rgba(220, 53, 69, 0.8)'
					],
					borderColor: [
						'rgba(40, 167, 69, 1)',
						'rgba(255, 193, 7, 1)',
						'rgba(220, 53, 69, 1)'
					],
					borderWidth: 2,
					borderRadius: 8
				}]
			},
			options: {
				responsive: true,
				maintainAspectRatio: true,
				aspectRatio: 1.5,
				plugins: {
					legend: {
						display: false
					}
				},
				scales: {
					y: {
						beginAtZero: true,
						ticks: {
							callback: function (value) {
								return value.toLocaleString() + ' SAR';
							}
						}
					}
				}
			}
		});
	}

	// Chart: Status by Service Type
	const statusByServiceData = calculateStatusByService(items);
	const ctxStatusByService = document.getElementById('chartStatusByService');
	if (ctxStatusByService) {
		state.charts.statusByService = new Chart(ctxStatusByService, {
			type: 'bar',
			data: {
				labels: statusByServiceData.labels,
				datasets: [{
					label: 'Active',
					data: statusByServiceData.active,
					backgroundColor: 'rgba(40, 167, 69, 0.8)'
				}, {
					label: 'On Hold',
					data: statusByServiceData.onHold,
					backgroundColor: 'rgba(255, 193, 7, 0.8)'
				}, {
					label: 'Inactive',
					data: statusByServiceData.inactive,
					backgroundColor: 'rgba(220, 53, 69, 0.8)'
				}]
			},
			options: {
				responsive: true,
				maintainAspectRatio: true,
				aspectRatio: 1.5,
				plugins: {
					legend: {
						position: 'top',
						labels: {
							usePointStyle: true,
							padding: 15
						}
					}
				},
				scales: {
					y: {
						beginAtZero: true,
						stacked: true
					},
					x: {
						stacked: true
					}
				}
			}
		});
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

		// Find the inline details container
		const detailsContainer = document.getElementById(`service-details-${id}`);
		if (!detailsContainer) return;

		// Check if this container is currently visible
		const isCurrentlyVisible = !detailsContainer.classList.contains('d-none');

		// Close all other service details first
		closeAllServiceDetails();

		// If the clicked one was not visible, show it
		if (!isCurrentlyVisible) {
			detailsContainer.classList.remove('d-none');

			// Update button icon
			const icon = toggleBtn.querySelector('i');
			if (icon) {
				icon.classList.remove('bi-chevron-down');
				icon.classList.add('bi-chevron-up');
			}

			// Adjust position to prevent overflow with a small delay to ensure rendering
			setTimeout(() => {
				adjustDropdownPosition(detailsContainer);
			}, 10);
		}
	});

	// Function to close all service details
	function closeAllServiceDetails() {
		const allDetails = document.querySelectorAll('.service-details-inline');
		const allButtons = document.querySelectorAll('.toggle-service-details');

		allDetails.forEach(container => {
			container.classList.add('d-none');
		});

		allButtons.forEach(button => {
			const icon = button.querySelector('i');
			if (icon) {
				icon.classList.remove('bi-chevron-up');
				icon.classList.add('bi-chevron-down');
			}
		});
	}

	// Function to adjust dropdown position to prevent overflow
	function adjustDropdownPosition(dropdown) {
		const rect = dropdown.getBoundingClientRect();
		const viewportHeight = window.innerHeight;
		const viewportWidth = window.innerWidth;

		// Get the data tab container to respect its boundaries
		const dataTab = document.getElementById('data');
		const dataTabRect = dataTab ? dataTab.getBoundingClientRect() : null;

		// Reset any previous positioning
		dropdown.style.top = '';
		dropdown.style.left = '';
		dropdown.style.right = '';
		dropdown.style.maxHeight = '';
		dropdown.style.bottom = '';
		dropdown.style.marginTop = '';
		dropdown.style.marginBottom = '';

		// Check if dropdown goes beyond bottom of viewport or data tab
		const bottomBoundary = dataTabRect ? dataTabRect.bottom : viewportHeight;
		if (rect.bottom > bottomBoundary - 20) {
			// Position above the trigger element only if there's enough space
			const triggerElement = dropdown.previousElementSibling;
			const triggerRect = triggerElement ? triggerElement.getBoundingClientRect() : null;

			if (triggerRect && triggerRect.top > 200) {
				// Enough space above, position above
				dropdown.style.top = 'auto';
				dropdown.style.bottom = '100%';
				dropdown.style.marginTop = '0';
				dropdown.style.marginBottom = '8px';
			} else {
				// Not enough space above, keep below but limit height
				dropdown.style.maxHeight = `${Math.max(200, bottomBoundary - rect.top - 20)}px`;
				dropdown.style.overflowY = 'auto';
			}
		}

		// Check if dropdown goes beyond right edge of viewport or data tab
		const rightBoundary = dataTabRect ? dataTabRect.right : viewportWidth;
		if (rect.right > rightBoundary - 20) {
			dropdown.style.left = 'auto';
			dropdown.style.right = '0';
		}

		// Check if dropdown goes beyond left edge of viewport or data tab
		const leftBoundary = dataTabRect ? dataTabRect.left : 0;
		if (rect.left < leftBoundary + 20) {
			dropdown.style.left = '0';
			dropdown.style.right = 'auto';
		}

		// Ensure dropdown is visible and not too high
		const finalRect = dropdown.getBoundingClientRect();
		if (finalRect.top < 50) {
			// If too high, position it lower
			dropdown.style.top = '100%';
			dropdown.style.bottom = 'auto';
			dropdown.style.marginTop = '8px';
			dropdown.style.marginBottom = '0';
		}
	}

	// Add window resize listener to adjust dropdown positions
	window.addEventListener('resize', () => {
		const visibleDropdowns = document.querySelectorAll('.service-details-inline:not(.d-none)');
		visibleDropdowns.forEach(dropdown => {
			adjustDropdownPosition(dropdown);
		});
	});

	// Add click outside listener to close service details
	document.addEventListener('click', (e) => {
		// Check if click is outside service details and toggle buttons
		if (!e.target.closest('.service-details-inline') && !e.target.closest('.toggle-service-details')) {
			closeAllServiceDetails();
		}
	});


	// Add event listener for status dropdown changes
	document.addEventListener('change', async (e) => {
		if (e.target.classList.contains('status-select') && e.target.dataset.id) {
			const id = e.target.dataset.id;
			const newStatus = e.target.value;

			if (!id || !newStatus) return;

			try {
				// Update in database
				const { error } = await window.supa
					.from('submissions')
					.update({ status: newStatus })
					.eq('id', id);

				if (error) {
					console.error('Error updating status:', error);
					showToast('Error updating status', 'error');
					// Revert the select value
					e.target.value = state.allSubmissions.find(s => s.id === id)?.status || 'active';
					return;
				}

				// Update local state
				const submission = state.allSubmissions.find(s => s.id === id);
				if (submission) {
					submission.status = newStatus;
				}

				// Apply color styling based on status
				applyStatusStyling(e.target, newStatus);

				showToast('Status updated successfully', 'success');

			} catch (error) {
				console.error('Error updating status:', error);
				showToast('Error updating status', 'error');
				// Revert the select value
				e.target.value = state.allSubmissions.find(s => s.id === id)?.status || 'active';
			}
		}
	});

	// Chart view switching
	document.querySelectorAll('[data-chart-view]').forEach(btn => {
		btn.addEventListener('click', function () {
			const view = this.dataset.chartView;

			// Update button states
			document.querySelectorAll('[data-chart-view]').forEach(b => b.classList.remove('active'));
			this.classList.add('active');

			// Show/hide chart sections
			document.querySelectorAll('.chart-section').forEach(section => section.classList.add('d-none'));
			const targetSection = document.getElementById(`${view}-charts`);
			if (targetSection) {
				targetSection.classList.remove('d-none');
				console.log('Showing chart section:', view);
			} else {
				console.warn('Chart section not found:', `${view}-charts`);
			}

			// Update chart data
			buildCharts(0);
			buildAnalyticsCharts();
			buildStatusCharts();
		});
	});

	// Tab switching - rebuild charts when switching to Charts tab
	document.querySelectorAll('[data-bs-toggle="tab"]').forEach(tab => {
		tab.addEventListener('shown.bs.tab', function (e) {
			if (e.target.getAttribute('href') === '#charts') {
				console.log('Switched to Charts tab, rebuilding charts...');
				buildCharts(0);
				buildAnalyticsCharts();
				buildStatusCharts();
			}
		});
	});

}

// Function to apply status styling
function applyStatusStyling(selectElement, status) {
	// Remove existing status classes
	selectElement.classList.remove('status-active', 'status-on-hold', 'status-inactive');

	// Add appropriate class and styling
	switch (status) {
		case 'active':
			selectElement.classList.add('status-active');
			selectElement.style.backgroundColor = '#d4edda';
			selectElement.style.borderColor = '#28a745';
			selectElement.style.color = '#155724';
			break;
		case 'on_hold':
			selectElement.classList.add('status-on-hold');
			selectElement.style.backgroundColor = '#fff3cd';
			selectElement.style.borderColor = '#ffc107';
			selectElement.style.color = '#856404';
			break;
		case 'inactive':
			selectElement.classList.add('status-inactive');
			selectElement.style.backgroundColor = '#f8d7da';
			selectElement.style.borderColor = '#dc3545';
			selectElement.style.color = '#721c24';
			break;
	}
}

function filterChartsByTimeRange(timeRange) {
	// This function will filter charts based on time range
	console.log(`Filtering charts by time range: ${timeRange}`);
	showToast(`Filtering charts by ${timeRange}`, 'info');

	// Rebuild charts with filtered data
	buildCharts(0);
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
				applyFilter(); buildCharts(0); renderTable();
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
								addRow('Cash on Delivery %', serviceDetails.cod_percent + '%');
							}
							if (serviceDetails.ppd_percent) {
								addRow('Pre Paid %', serviceDetails.ppd_percent + '%');
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

		// Handle service type change to show/hide SKU, bundles, and service mix containers
		if (e.target.id === 'edit_service_type') {
			const skuContainer = document.getElementById('edit_skus_container');
			const bundlesContainer = document.getElementById('edit_bundles_container');
			const serviceMixContainer = document.querySelector('[data-bs-target="#editServiceMix"]')?.closest('.form-section');
			const isFulfillment = e.target.value === 'fulfillment' || e.target.value === 'fulfillment-and-last-mile';
			const isLastMile = e.target.value.includes('last-mile');

			if (skuContainer) skuContainer.style.display = isFulfillment ? 'block' : 'none';
			if (bundlesContainer) bundlesContainer.style.display = isFulfillment ? 'block' : 'none';
			if (serviceMixContainer) serviceMixContainer.style.display = isLastMile ? 'block' : 'none';

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

// Function to convert text time values to proper HTML time format
function convertTimeTextToFormat(timeText) {
	if (!timeText) return '';

	// If it's already in HH:MM format, return as is
	if (/^\d{2}:\d{2}$/.test(timeText)) {
		return timeText;
	}

	// Convert common text values to time format
	const timeMap = {
		'morning': '09:00',
		'noon': '12:00',
		'afternoon': '15:00',
		'evening': '18:00',
		'night': '21:00',
		'early morning': '06:00',
		'late morning': '11:00',
		'late afternoon': '17:00',
		'late evening': '20:00'
	};

	return timeMap[timeText.toLowerCase()] || '';
}

// Function to convert HTML time format back to text for storage
function convertTimeFormatToText(timeFormat) {
	if (!timeFormat) return '';

	// If it's not in HH:MM format, return as is
	if (!/^\d{2}:\d{2}$/.test(timeFormat)) {
		return timeFormat;
	}

	// Convert time format back to text
	const timeMap = {
		'09:00': 'morning',
		'12:00': 'noon',
		'15:00': 'afternoon',
		'18:00': 'evening',
		'21:00': 'night',
		'06:00': 'early morning',
		'11:00': 'late morning',
		'17:00': 'late afternoon',
		'20:00': 'late evening'
	};

	return timeMap[timeFormat] || timeFormat;
}

// Function to setup time slots based on pickup frequency (matching customer.html style)
function setupTimeSlots(containerId, existingSlots = [], frequency = '') {
	const container = document.getElementById(containerId);
	if (!container) return;

	// Clear existing time slots
	container.innerHTML = '';

	// Define time slots (matching customer.html)
	const timeSlots = [
		{ value: 'morning', label: '7:00 AM - 9:00 AM' },
		{ value: 'noon', label: '11:00 AM - 1:00 PM' },
		{ value: 'afternoon', label: '1:00 PM - 2:00 PM' },
		{ value: 'evening', label: '2:00 PM - 4:00 PM' }
	];

	// Create time slots based on frequency
	if (frequency === 'once') {
		// Single time slot for once a day
		const col = document.createElement('div');
		col.className = 'col-12';

		const select = document.createElement('select');
		select.className = 'form-select';
		select.id = `${containerId}_slot1`;
		select.name = `${containerId}_slot1`;

		// Add default option
		const defaultOption = document.createElement('option');
		defaultOption.value = '';
		defaultOption.textContent = 'Select time slot';
		select.appendChild(defaultOption);

		// Add time slot options
		timeSlots.forEach(slot => {
			const option = document.createElement('option');
			option.value = slot.value;
			option.textContent = slot.label;
			select.appendChild(option);
		});

		col.appendChild(select);
		container.appendChild(col);

	} else if (frequency === 'twice') {
		// Two time slots for twice a day
		// First pickup
		const morningCol = document.createElement('div');
		morningCol.className = 'col-md-6';

		const morningLabel = document.createElement('label');
		morningLabel.className = 'form-label small';
		morningLabel.textContent = 'First Pickup';
		morningCol.appendChild(morningLabel);

		const morningSelect = document.createElement('select');
		morningSelect.className = 'form-select';
		morningSelect.id = `${containerId}_slot1`;
		morningSelect.name = `${containerId}_slot1`;

		// Add default option
		const morningDefaultOption = document.createElement('option');
		morningDefaultOption.value = '';
		morningDefaultOption.textContent = 'Select time slot';
		morningSelect.appendChild(morningDefaultOption);

		// Add time slot options
		timeSlots.forEach(slot => {
			const option = document.createElement('option');
			option.value = slot.value;
			option.textContent = slot.label;
			morningSelect.appendChild(option);
		});

		morningCol.appendChild(morningSelect);
		container.appendChild(morningCol);

		// Second pickup
		const afternoonCol = document.createElement('div');
		afternoonCol.className = 'col-md-6';

		const afternoonLabel = document.createElement('label');
		afternoonLabel.className = 'form-label small';
		afternoonLabel.textContent = 'Second Pickup';
		afternoonCol.appendChild(afternoonLabel);

		const afternoonSelect = document.createElement('select');
		afternoonSelect.className = 'form-select';
		afternoonSelect.id = `${containerId}_slot2`;
		afternoonSelect.name = `${containerId}_slot2`;

		// Add default option
		const afternoonDefaultOption = document.createElement('option');
		afternoonDefaultOption.value = '';
		afternoonDefaultOption.textContent = 'Select time slot';
		afternoonSelect.appendChild(afternoonDefaultOption);

		// Add time slot options
		timeSlots.forEach(slot => {
			const option = document.createElement('option');
			option.value = slot.value;
			option.textContent = slot.label;
			afternoonSelect.appendChild(option);
		});

		afternoonCol.appendChild(afternoonSelect);
		container.appendChild(afternoonCol);

		// Add validation to ensure different time slots are selected
		morningSelect.addEventListener('change', function () {
			validateTimeSlots(morningSelect, afternoonSelect);
		});

		afternoonSelect.addEventListener('change', function () {
			validateTimeSlots(morningSelect, afternoonSelect);
		});

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
		console.log('Setting existing time slots:', existingSlots);
		existingSlots.forEach((slot, index) => {
			const slotSelect = document.getElementById(`${containerId}_slot${index + 1}`);
			console.log(`Looking for slot select: ${containerId}_slot${index + 1}`, slotSelect);
			if (slotSelect && slot) {
				// Convert time format back to text for selection
				const timeValue = convertTimeFormatToText(slot);
				console.log(`Setting slot ${index + 1} to:`, slot, '->', timeValue);
				slotSelect.value = timeValue;
			}
		});
	} else {
		console.log('No existing slots or not an array:', existingSlots);
	}
}

// Validate that two different time slots are selected (matching customer.html)
function validateTimeSlots(slot1, slot2) {
	if (slot1.value && slot2.value && slot1.value === slot2.value) {
		// If both slots are the same, show warning
		slot2.classList.add('is-invalid');
		// You can add a toast notification here if needed
		console.warn('Please select two different time slots');
	} else {
		// Clear warning
		slot2.classList.remove('is-invalid');
	}
}

// Function to open the edit modal and populate it with row data
function openEditModal(row) {
	// Helper function to safely set value
	const setValue = (id, value) => {
		const element = document.getElementById(id);
		if (element) {
			// Handle date inputs specially
			if (element.type === 'date' && value) {
				// Convert date to YYYY-MM-DD format for HTML date inputs
				const date = new Date(value);
				if (date instanceof Date && !isNaN(date)) {
					element.value = date.toISOString().split('T')[0];
				} else {
					element.value = value;
				}
			} else {
				element.value = value || '';
			}
		}
	};

	// Helper function to safely set checked state
	const setChecked = (id, isChecked) => {
		const element = document.getElementById(id);
		if (element) element.checked = isChecked;
	};

	// Set form field values
	setValue('edit_company_name', row.company_name);
	setValue('edit_employee_name', row.employee_name);
	setValue('edit_employee_email', row.employee_email);
	setValue('edit_service_type', row.service_type);
	setValue('edit_weekly_shipments', row.weekly_shipments);
	setValue('edit_weekly_units_outbound', row.weekly_units_outbound);
	setValue('edit_weekly_units_inbound', row.weekly_units_inbound);
	setValue('edit_inbound_frequency', row.inbound_frequency);
	setValue('edit_avg_units', row.avg_units_per_shipment);
	setValue('edit_forecast_start_date', row.forecast_start_date);
	setValue('edit_forecast_end_date', row.forecast_end_date);

	// Show/hide sections based on service type
	const isFulfillment = row.service_type === 'fulfillment' || row.service_type === 'fulfillment-and-last-mile';
	const isLastMile = row.service_type && row.service_type.includes('last-mile');

	// Handle SKU and bundles containers
	const skuContainer = document.getElementById('edit_skus_container');
	const bundlesContainer = document.getElementById('edit_bundles_container');
	if (skuContainer) skuContainer.style.display = isFulfillment ? 'block' : 'none';
	if (bundlesContainer) bundlesContainer.style.display = isFulfillment ? 'block' : 'none';

	// Handle service mix container
	const serviceMixContainer = document.querySelector('[data-bs-target="#editServiceMix"]')?.closest('.form-section');
	if (serviceMixContainer) serviceMixContainer.style.display = isLastMile ? 'block' : 'none';

	// Set notes fields if they exist
	setValue('edit_seasonality_skus_notes', row.seasonality_skus_notes || '');

	// Set service mix checkboxes and load service details if available
	const serviceMix = (row.service_mix || '').split(',');

	// Heavy & Bulky
	setChecked('edit_service_hb', serviceMix.includes('hb'));
	if (row.hb_details) {
		try {
			const hbDetails = JSON.parse(row.hb_details);
			// Add null check for hbDetails
			if (hbDetails && typeof hbDetails === 'object') {
				setValue('edit_hb_pickup_frequency', hbDetails.pickup_frequency || '');
				setValue('edit_hb_city', hbDetails.city || '');
				setValue('edit_hb_district', hbDetails.district || '');
				setValue('edit_hb_weekly_shipments', hbDetails.weekly_shipments || '');
				setValue('edit_hb_cod_percent', hbDetails.cod_percent || '');
				setValue('edit_hb_ppd_percent', hbDetails.ppd_percent || '');

				// Setup time slots
				if (hbDetails.pickup_frequency) {
					console.log('Setting up HB time slots:', hbDetails.timeSlots, 'Frequency:', hbDetails.pickup_frequency);
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
			// Add null check for intDetails
			if (intDetails && typeof intDetails === 'object') {
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
			// Add null check for parcelDetails
			if (parcelDetails && typeof parcelDetails === 'object') {
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
		const checkbox = document.getElementById(`edit_service_${serviceType}`);

		console.log(`🔧 collectServiceDetails(${serviceType}):`, {
			prefix,
			checkbox: checkbox ? checkbox.checked : 'not found',
			checkboxId: `edit_service_${serviceType}`
		});

		if (!checkbox || !checkbox.checked) return null;

		// Collect time slots
		const timeSlots = [];
		const slotSelects = document.querySelectorAll(`[id^="${prefix}_time_slot_container_slot"]`);
		slotSelects.forEach(select => {
			if (select.value) {
				// Store the selected time slot value directly
				timeSlots.push(select.value);
			}
		});

		const serviceData = {
			pickup_frequency: getElementValue(`${prefix}_pickup_frequency`, ''),
			timeSlots: timeSlots,
			city: getElementValue(`${prefix}_city`, ''),
			district: getElementValue(`${prefix}_district`, ''),
			weekly_shipments: getElementValue(`${prefix}_weekly_shipments`, ''),
			cod_percent: getElementValue(`${prefix}_cod_percent`, ''),
			ppd_percent: getElementValue(`${prefix}_ppd_percent`, ''),
			notes: getElementValue(`${prefix}_notes`, '')
		};

		console.log(`🔧 collectServiceDetails(${serviceType}) result:`, serviceData);
		return serviceData;
	};

	// Prepare update data - only include columns that exist in the submissions table
	const updated = {
		company_name: getElementValue('edit_company_name'),
		employee_name: getElementValue('edit_employee_name'),
		employee_email: getElementValue('edit_employee_email'),
		service_type: getElementValue('edit_service_type'),
		inbound_frequency: getElementValue('edit_inbound_frequency'),
		weekly_shipments: parseFloat(getElementValue('edit_weekly_shipments')) || 0,
		weekly_units_outbound: parseFloat(getElementValue('edit_weekly_units_outbound')) || 0,
		weekly_units_inbound: parseFloat(getElementValue('edit_weekly_units_inbound')) || 0,
		avg_units_per_shipment: parseFloat(getElementValue('edit_avg_units')) || 0,
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
	console.log('🔧 Service details being saved:', {
		hb_details: updated.hb_details,
		international_details: updated.international_details,
		parcel_details: updated.parcel_details
	});

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
			.from('submissions')
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
		buildCharts(0);
		renderTable();
		console.log('UI refreshed');

		// Close modal
		bootstrap.Modal.getInstance(document.getElementById('editCustomerModal')).hide();
		currentEditingRow = null;
		// Show success message
		showToast('Customer record updated successfully!', 'success');
	} catch (error) {
		console.error('Error saving customer changes:', error);
		showToast(`Error updating customer record: ${error.message || 'Unknown error'}`, 'error');

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

	// Validate COD + PPD = 100% (only if elements exist)
	const codElement = document.getElementById('edit_cod_percent');
	const ppdElement = document.getElementById('edit_ppd_percent');
	if (codElement && ppdElement) {
		const cod = parseFloat(codElement.value) || 0;
		const ppd = parseFloat(ppdElement.value) || 0;
		if (Math.abs(cod + ppd - 100) > 0.01) {
			errors.push('COD + PPD must equal 100%');
			isValid = false;
		}
	}

	// Validate Service Mix - only required for last-mile products
	const selectedServiceType = document.querySelector('input[name="edit_service_type"]:checked');
	if (selectedServiceType && selectedServiceType.value.includes('last-mile')) {
		const serviceMixChecked = document.querySelectorAll('input[name="edit_service_mix"]:checked');
		if (serviceMixChecked.length === 0) {
			errors.push('Please select at least one service mix option');
			isValid = false;
		}
	}

	// Validate service details if checked (only for last-mile products)
	if (selectedServiceType && selectedServiceType.value.includes('last-mile')) {
		const serviceMixChecked = document.querySelectorAll('input[name="edit_service_mix"]:checked');
		serviceMixChecked.forEach(checkbox => {
			const serviceType = checkbox.value;
			const prefix = `edit_${serviceType}`;

			// Check required fields for each selected service
			const serviceCheckbox = document.getElementById(`${prefix}_service_${serviceType}`);
			if (serviceCheckbox && serviceCheckbox.checked) {
				// Add any specific validation for this service type if needed
			}
		});
	}

	// Display errors if any
	if (!isValid) {
		alert('Please fix the following errors:\n' + errors.join('\n'));
	}

	return isValid;
}

// Excel download function
function downloadAsExcel() {
	try {
		// Get the current filtered data
		const dataToExport = state.filtered || [];

		if (dataToExport.length === 0) {
			showToast('No data available to export', 'warning');
			return;
		}

		// Prepare data for Excel
		const excelData = dataToExport.map((row, index) => {
			// Parse service details if they exist
			let hbDetails = '';
			let internationalDetails = '';
			let parcelDetails = '';

			try {
				if (row.hb_details && row.hb_details.trim() !== '') {
					const hb = JSON.parse(row.hb_details);
					if (hb && typeof hb === 'object') {
						hbDetails = `Frequency: ${hb.pickup_frequency || 'N/A'}, City: ${hb.city || 'N/A'}, Time: ${hb.timeSlots ? hb.timeSlots.join(', ') : 'N/A'}`;
					}
				}
			} catch (e) {
				// Leave empty if parse error
			}

			try {
				if (row.international_details && row.international_details.trim() !== '') {
					const int = JSON.parse(row.international_details);
					if (int && typeof int === 'object') {
						internationalDetails = `Frequency: ${int.pickup_frequency || 'N/A'}, City: ${int.city || 'N/A'}, Time: ${int.timeSlots ? int.timeSlots.join(', ') : 'N/A'}`;
					}
				}
			} catch (e) {
				// Leave empty if parse error
			}

			try {
				if (row.parcel_details && row.parcel_details.trim() !== '') {
					const parcel = JSON.parse(row.parcel_details);
					if (parcel && typeof parcel === 'object') {
						parcelDetails = `Frequency: ${parcel.pickup_frequency || 'N/A'}, City: ${parcel.city || 'N/A'}, Time: ${parcel.timeSlots ? parcel.timeSlots.join(', ') : 'N/A'}`;
					}
				}
			} catch (e) {
				// Leave empty if parse error
			}

			return {
				'#': index + 1,
				'Company Name': row.company_name || '',
				'Employee Name': row.employee_name || '',
				'Employee Email': row.employee_email || '',
				'Service Type': row.service_type || '',
				'Inbound Frequency': row.inbound_frequency || '',
				'Weekly Shipments': row.weekly_shipments || 0,
				'Weekly Units Outbound': row.weekly_units_outbound || 0,
				'Weekly Units Inbound': row.weekly_units_inbound || 0,
				'Average Units per Shipment': row.avg_units_per_shipment || 0,
				'Forecast Start Date': row.forecast_start_date || '',
				'Forecast End Date': row.forecast_end_date || '',
				'Service Mix': row.service_mix || '',
				'Special Bundles': row.special_bundles || '',
				'Seasonality SKUs Notes': row.seasonality_skus_notes || '',
				'Special Bundles Notes': row.special_bundles_notes || '',
				'COD %': row.cod_percent || 0,
				'PPD %': row.ppd_percent || 0,
				'Heavy & Bulky Details': hbDetails,
				'International Details': internationalDetails,
				'Parcel Details': parcelDetails,
				'Forecast File Name': row.forecast_file_name || '',
				'Forecast File Size (bytes)': row.forecast_file_size || '',
				'Forecast File Path': row.forecast_file_path || '',
				'Forecast File URL': row.forecast_file_url || '',
				'Created At': row.created_at ? new Date(row.created_at).toLocaleString() : '',
				'Status': row.status === 'on_hold' ? 'On Hold' : row.status === 'inactive' ? 'Inactive' : 'Active'
			};
		});

		// Create workbook
		const wb = XLSX.utils.book_new();

		// Create worksheet
		const ws = XLSX.utils.json_to_sheet(excelData);

		// Set column widths
		const colWidths = [
			{ wch: 5 },   // #
			{ wch: 20 },  // Company Name
			{ wch: 15 },  // Service Type
			{ wch: 15 },  // Inbound Frequency
			{ wch: 15 },  // Weekly Shipments
			{ wch: 18 },  // Weekly Units Outbound
			{ wch: 18 },  // Weekly Units Inbound
			{ wch: 20 },  // Average Units per Shipment
			{ wch: 15 },  // Forecast Start Date
			{ wch: 15 },  // Forecast End Date
			{ wch: 15 },  // Service Mix
			{ wch: 15 },  // Special Bundles
			{ wch: 25 },  // Seasonality SKUs Notes
			{ wch: 25 },  // Special Bundles Notes
			{ wch: 10 },  // COD %
			{ wch: 10 },  // PPD %
			{ wch: 30 },  // Heavy & Bulky Details
			{ wch: 30 },  // International Details
			{ wch: 30 },  // Parcel Details
			{ wch: 20 },  // Created At
			{ wch: 10 }   // Status
		];
		ws['!cols'] = colWidths;

		// Add worksheet to workbook
		XLSX.utils.book_append_sheet(wb, ws, 'Forecast Data');

		// Generate filename
		const filterName = state.filterCompany === 'ALL' ? 'All_Customers' : state.filterCompany.replace(/[^a-z0-9_-]/gi, '_');
		const timestamp = new Date().toISOString().split('T')[0];
		const filename = `Forecast_Data_${filterName}_${timestamp}.xlsx`;

		// Download file
		XLSX.writeFile(wb, filename);

		showToast('Excel file downloaded successfully!', 'success');

	} catch (error) {
		console.error('Excel export error:', error);
		showToast('Error generating Excel file. Please try again.', 'error');
	}
}

// Setup Excel download
function setupExcelDownload() {
	document.getElementById('downloadExcelBtn').addEventListener('click', downloadAsExcel);
}

// Initialize
window.addEventListener('DOMContentLoaded', async () => {
	await loadData();
	setupFilters();
	setupActions();
	setupExcelDownload();
}); // Close event listener

// Toast notification function
function showToast(message, type = 'info') {
	// Remove existing toast if any
	const existingToast = document.querySelector('.custom-toast');
	if (existingToast) {
		existingToast.remove();
	}

	// Create toast element
	const toast = document.createElement('div');
	toast.className = `custom-toast toast-${type}`;

	// Set icon based on type
	let icon = '';
	switch (type) {
		case 'success': icon = '<i class="bi bi-check-circle-fill"></i>'; break;
		case 'warning': icon = '<i class="bi bi-exclamation-triangle-fill"></i>'; break;
		case 'error': icon = '<i class="bi bi-x-circle-fill"></i>'; break;
		default: icon = '<i class="bi bi-info-circle-fill"></i>'; break;
	}

	toast.innerHTML = `
		<div class="toast-content">
			<div class="toast-icon">${icon}</div>
			<div class="toast-message">${message}</div>
			<button class="toast-close" onclick="this.parentElement.parentElement.remove()">
				<i class="bi bi-x"></i>
			</button>
		</div>
	`;

	// Add to page
	document.body.appendChild(toast);

	// Show with animation
	setTimeout(() => toast.classList.add('show'), 100);

	// Auto remove after 5 seconds
	setTimeout(() => {
		if (toast.parentElement) {
			toast.classList.remove('show');
			setTimeout(() => toast.remove(), 300);
		}
	}, 5000);
}
// File Management Functions
async function downloadFile(filePath, fileName) {
	if (!filePath) {
		showToast('No file path available', 'error');
		return;
	}

	try {
		const { data, error } = await window.supa.storage
			.from('forecast-files')
			.download(filePath);

		if (error) {
			console.error('Download error:', error);
			showToast(`Download failed: ${error.message}`, 'error');
			return;
		}

		// Create download link
		const url = URL.createObjectURL(data);
		const a = document.createElement('a');
		a.href = url;
		a.download = fileName;
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
		URL.revokeObjectURL(url);

		showToast('File downloaded successfully', 'success');
	} catch (error) {
		console.error('Download error:', error);
		showToast(`Download failed: ${error.message}`, 'error');
	}
}

async function renameFile(submissionId, currentFileName) {
	const newFileName = prompt('Enter new file name:', currentFileName);
	if (!newFileName || newFileName === currentFileName) {
		return;
	}

	// Ensure .xlsx extension
	const finalFileName = newFileName.endsWith('.xlsx') ? newFileName : newFileName + '.xlsx';

	try {
		const { error } = await window.supa
			.from('submissions')
			.update({ forecast_file_name: finalFileName })
			.eq('id', submissionId);

		if (error) {
			console.error('Rename error:', error);
			showToast(`Rename failed: ${error.message}`, 'error');
			return;
		}

		showToast('File renamed successfully', 'success');
		loadData(); // Refresh the table
	} catch (error) {
		console.error('Rename error:', error);
		showToast(`Rename failed: ${error.message}`, 'error');
	}
}

async function deleteFile(submissionId, filePath) {
	if (!confirm('Are you sure you want to delete this file? This action cannot be undone.')) {
		return;
	}

	try {
		// Delete from storage
		if (filePath) {
			const { error: storageError } = await window.supa.storage
				.from('forecast-files')
				.remove([filePath]);

			if (storageError) {
				console.error('Storage deletion error:', storageError);
				// Continue with database update even if storage deletion fails
			}
		}

		// Update database to remove file references
		const { error } = await window.supa
			.from('submissions')
			.update({
				forecast_file_name: null,
				forecast_file_size: null,
				forecast_file_path: null,
				forecast_file_url: null
			})
			.eq('id', submissionId);

		if (error) {
			console.error('Database update error:', error);
			showToast(`File deletion failed: ${error.message}`, 'error');
			return;
		}

		showToast('File deleted successfully', 'success');
		loadData(); // Refresh the table
	} catch (error) {
		console.error('Delete error:', error);
		showToast(`File deletion failed: ${error.message}`, 'error');
	}
}

// Make functions globally available
window.downloadFile = downloadFile;
window.renameFile = renameFile;
window.deleteFile = deleteFile;
