// ===========================================================
// script.js
// Global behaviour shared by all pages
// ===========================================================

// Simple navigation helper
function goToPage(page) {
  window.location.href = page;
}

// Simple logout for prototype
function logout() {
  localStorage.removeItem("isLoggedIn");
  window.location.href = "index.html";
}

// ===========================================================
// LOGIN PAGE
// ===========================================================
function initLoginPage() {
  const form = document.getElementById("loginForm");
  if (!form) return;

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    const username = document.getElementById("username").value.trim();
    const password = document.getElementById("password").value.trim();

    // Very simple demo credentials
    if (username === "manager" && password === "admin123") {
      localStorage.setItem("isLoggedIn", "true");
      window.location.href = "dashboard.html";
    } else {
      alert("Incorrect credentials. Use manager / admin123 for the demo.");
    }
  });
}

// ===========================================================
// DASHBOARD PAGE
// ===========================================================
function initDashboardPage() {
  const totalDriversEl = document.getElementById("totalDrivers");
  if (!totalDriversEl || typeof drivers === "undefined") return;

  const totalStudentsEl = document.getElementById("totalStudents");
  const activeRoutesEl = document.getElementById("activeRoutes");
  const onTimeRateEl = document.getElementById("onTimeRate");

  // Basic stats from data.js
  totalDriversEl.textContent = drivers.length.toString();
  totalStudentsEl.textContent = students.length.toString();
  activeRoutesEl.textContent = dashboardStats.activeRoutes.toString();
  onTimeRateEl.textContent = dashboardStats.onTimeRate.toString() + "%";
}

// ===========================================================
// DRIVERS PAGE
// ===========================================================
function initDriversPage() {
  const tableBody = document.getElementById("driversTableBody");
  if (!tableBody || typeof drivers === "undefined") return;

  tableBody.innerHTML = "";
  drivers.forEach((driver) => {
    const tr = document.createElement("tr");
    tr.dataset.driverId = String(driver.id);
    tr.innerHTML = `
      <td>${driver.name}</td>
      <td>${driver.busId}</td>
      <td>${driver.route}</td>
      <td>${driver.status}</td>
      <td>${driver.rating.toFixed(1)} / 5</td>
    `;
    tr.addEventListener("click", () => showDriverDetails(driver.id));
    tableBody.appendChild(tr);
  });

  // Preselect first driver
  if (drivers.length > 0) {
    showDriverDetails(drivers[0].id);
  }
}

function showDriverDetails(driverId) {
  const driver = drivers.find((d) => d.id === driverId);
  if (!driver) return;

  const nameEl = document.getElementById("driverDetailName");
  const routeEl = document.getElementById("driverDetailRoute");
  const busEl = document.getElementById("driverDetailBus");
  const ratingEl = document.getElementById("driverDetailRating");
  const statusEl = document.getElementById("driverDetailStatus");
  const summaryEl = document.getElementById("driverDetailSummary");

  if (!nameEl || !routeEl || !busEl || !ratingEl || !statusEl || !summaryEl) {
    return;
  }

  nameEl.textContent = driver.name;
  routeEl.textContent = `Route ${driver.routeLabel} — ${driver.route}`;
  busEl.textContent = `${driver.busId} (${driver.busCapacity} seats)`;
  ratingEl.textContent = `${driver.rating.toFixed(1)} / 5 over ${
    driver.completedTrips
  } trips`;
  statusEl.textContent = driver.status;

  summaryEl.innerHTML = "";
  driver.summary.forEach((line) => {
    const li = document.createElement("li");
    li.textContent = line;
    summaryEl.appendChild(li);
  });
}

// ===========================================================
// STUDENTS PAGE
// ===========================================================
function initStudentsPage() {
  const tableBody = document.getElementById("studentsTableBody");
  const addForm = document.getElementById("addStudentForm");

  if (!tableBody || typeof students === "undefined") return;

  function renderStudents() {
    tableBody.innerHTML = "";
    students.forEach((student) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${student.name}</td>
        <td>${student.grade}</td>
        <td>${student.stop}</td>
        <td>${student.busId}</td>
      `;
      tableBody.appendChild(tr);
    });
  }

  renderStudents();

  if (addForm) {
    addForm.addEventListener("submit", function (e) {
      e.preventDefault();
      const name = document.getElementById("studentName").value.trim();
      const grade = document.getElementById("studentGrade").value.trim();
      const stop = document.getElementById("studentStop").value.trim();
      const busId = document.getElementById("studentBus").value.trim();

      if (!name || !grade || !stop || !busId) {
        alert("Please fill in all fields before adding a student.");
        return;
      }

      const newStudent = {
        id: students.length + 1,
        name,
        grade,
        stop,
        busId,
      };
      students.push(newStudent);
      renderStudents();

      addForm.reset();
      alert("Student added to the prototype list (not saved on server).");
    });
  }
}

// ===========================================================
// CALCULATOR / ROUTE PLANNER PAGE
// ===========================================================

let routeMap = null;
let routeLayers = [];

function initCalculatorPage() {
  const mapElement = document.getElementById("map");
  const form = document.getElementById("routeForm");
  const studentSelect = document.getElementById("studentSelect");

  if (!mapElement || !form) return;

  // Populate student dropdown if data is available
  if (studentSelect && typeof students !== "undefined") {
    students.forEach((s) => {
      const option = document.createElement("option");
      option.value = String(s.id);
      option.textContent = `${s.name} — ${s.stop} (${s.busId})`;
      studentSelect.appendChild(option);
    });
  }

  // Initialize Leaflet map if library is loaded
  if (typeof L !== "undefined") {
    const center = [33.5731, -7.5898]; // Casablanca center
    routeMap = L.map("map").setView(center, 12);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap contributors",
      maxZoom: 19,
    }).addTo(routeMap);

    // Simple marker for the city center
    L.circleMarker(center, {
      radius: 5,
    }).addTo(routeMap);
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    const start = document.getElementById("startLocation").value.trim();
    const end = document.getElementById("endLocation").value.trim();

    let selectedStudent = null;
    if (
      studentSelect &&
      studentSelect.value &&
      typeof students !== "undefined"
    ) {
      const id = parseInt(studentSelect.value, 10);
      selectedStudent = students.find((s) => s.id === id) || null;
    }

    generateSampleRoutes(start, end, selectedStudent);
  });
}

function generateSampleRoutes(start, end, student) {
  const reportContainer = document.getElementById("routeReport");
  const tag = document.getElementById("routeReportTag");
  if (!reportContainer || !tag) return;

  // Define three fake routes with different characteristics
  const baseName = student ? student.name : "Generic passenger";
  const destinationName = end || "School";

  const routes = [
    {
      id: "A",
      label: "Fastest route",
      color: "#2563eb",
      duration: 32, // minutes
      distance: 14.2, // km
      stops: 9,
      score: "Fastest overall travel time",
    },
    {
      id: "B",
      label: "Balanced / reliable",
      color: "#0f766e",
      duration: 36,
      distance: 13.5,
      stops: 11,
      score: "Most reliable, fewer congestion hotspots",
    },
    {
      id: "C",
      label: "Scenic / fewer turns",
      color: "#f97316",
      duration: 40,
      distance: 15.8,
      stops: 8,
      score: "More direct, fewer tight turns near schools",
    },
  ];

  // Clear previous polylines on map
  if (routeMap && routeLayers.length) {
    routeLayers.forEach((layer) => routeMap.removeLayer(layer));
    routeLayers = [];
  }

  // Build simple polyline geometries inside Casablanca
  if (routeMap && typeof L !== "undefined") {
    const depot = [33.5884, -7.6286]; // near Maarif / city center

    routes.forEach((route, index) => {
      // Slightly different path for each route
      const mid1 = [33.59 + index * 0.01, -7.63 + index * 0.015];
      const mid2 = [33.57 - index * 0.008, -7.60 + index * 0.008];
      const school = [33.595, -7.70]; // fake school location towards Ain Diab

      const polyline = L.polyline([depot, mid1, mid2, school], {
        color: route.color,
        weight: 4,
        opacity: 0.8,
      }).addTo(routeMap);

      routeLayers.push(polyline);
    });

    // Fit view to all sample routes
    const group = L.featureGroup(routeLayers);
    routeMap.fitBounds(group.getBounds().pad(0.3));
  }

  // Build HTML report
  const recommended = routes[1]; // Balanced route B
  tag.textContent = `Recommended: Route ${recommended.id}`;

  const personLabel = student
    ? `${baseName} (stop: ${student.stop})`
    : "Generic student pickup";

  let html = `
    <p style="font-size:0.9rem;" class="text-muted">
      The system generated three <strong>illustrative routes</strong> inside Casablanca
      from <strong>${start || "depot"}</strong> to
      <strong>${destinationName}</strong> for <strong>${personLabel}</strong>.
      These values are fictive and meant only to demonstrate the interface.
    </p>
    <div class="stack-y">
  `;

  routes.forEach((r) => {
    html += `
      <div class="card" style="padding:0.9rem 1rem;">
        <div style="display:flex; justify-content:space-between; align-items:center; gap:0.75rem;">
          <div>
            <div style="font-weight:600; font-size:0.95rem;">
              Route ${r.id} &mdash; ${r.label}
            </div>
            <div style="font-size:0.8rem; color:#6b7280;">
              ${r.score}
            </div>
          </div>
          <span class="badge" style="border-color:${r.color};">
            ~${r.duration} min &middot; ${r.distance.toFixed(1)} km
          </span>
        </div>
        <ul class="route-summary-list">
          <li>Estimated travel time: <strong>${r.duration} minutes</strong></li>
          <li>Number of stops served: <strong>${r.stops}</strong></li>
          <li>Starting from shared depot near Maarif and ending close to the school zone.</li>
        </ul>
      </div>
    `;
  });

  html += `</div>`;

  reportContainer.innerHTML = html;
}

// ===========================================================
// MAIN ENTRY POINT
// ===========================================================

document.addEventListener("DOMContentLoaded", function () {
  initLoginPage();
  initDashboardPage();
  initDriversPage();
  initStudentsPage();
  initCalculatorPage();
});
