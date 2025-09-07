function renderNavbar(active) {
	return `
	<nav class="navbar navbar-expand-lg">
		<div class="container">
			<a class="navbar-brand" href="index.html" style="color: var(--primary--main);">Forecast</a>
			<button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarsExample" aria-controls="navbarsExample" aria-expanded="false" aria-label="Toggle navigation">
				<span class="navbar-toggler-icon"></span>
			</button>
			<div class="collapse navbar-collapse" id="navbarsExample">
				<ul class="navbar-nav me-auto mb-2 mb-lg-0">
					<li class="nav-item"><a class="nav-link ${active==='home'?'active':''}" href="index.html">Home</a></li>
					<li class="nav-item"><a class="nav-link ${active==='dashboard'?'active':''}" href="admin-dashboard.html">Admin Dashboard</a></li>
				</ul>
				<div class="d-flex">
					<a class="btn btn-outline-secondary" id="logoutBtn" href="#">Logout</a>
				</div>
			</div>
		</div>
	</nav>`;
}

function mountNavbar(active) {
	const container = document.getElementById('navbar-container');
	if (!container) return;
	container.innerHTML = renderNavbar(active);
	const logoutBtn = document.getElementById('logoutBtn');
	if (logoutBtn) {
		logoutBtn.addEventListener('click', async (e) => {
			e.preventDefault();
			try {
				await window.supa.auth.signOut();
			} catch (err) {}
			window.location.href = 'login.html';
		});
	}
}

window.mountNavbar = mountNavbar;
