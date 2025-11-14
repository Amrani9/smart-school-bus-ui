/* ============================================
   SMART SCHOOL BUS ROUTING SYSTEM (Local UI)
   Shared Script for All Pages
   ============================================ */

// --------------- LOGIN LOGIC ----------------
document.addEventListener("DOMContentLoaded", () => {
    const loginForm = document.getElementById("loginForm");

    if (loginForm) {
        loginForm.addEventListener("submit", (e) => {
            e.preventDefault();
            const username = document.getElementById("username").value.trim();
            const password = document.getElementById("password").value.trim();

            if (username === "manager" && password === "admin123") {
                alert("✅ Login successful! Redirecting to Dashboard...");
                goToPage("dashboard.html");
            } else {
                alert("❌ Incorrect username or password.");
            }
        });
    }

    const driverForm = document.getElementById("addDriverForm");
    if (driverForm) {
        driverForm.addEventListener("submit", (e) => {
            e.preventDefault();
            alert("✅ New driver added (simulation only).");
            driverForm.reset();
        });
    }

    const studentForm = document.getElementById("addStudentForm");
    if (studentForm) {
        studentForm.addEventListener("submit", (e) => {
            e.preventDefault();
            alert("✅ New student added (simulation only).");
            studentForm.reset();
        });
    }
});

// --------------- NAVIGATION HELPERS ----------------
function goToPage(page) {
    window.location.href = page;
}

function logout() {
    const confirmLogout = confirm("Are you sure you want to log out?");
    if (confirmLogout) {
        window.location.href = "index.html";
    }
}

// --------------- ROUTE CALCULATOR SIMULATION ----------------
function computeRoute() {
    const summaryBox = document.getElementById("routeSummary");
    const busesUsed = document.getElementById("busesUsed");
    const totalDistance = document.getElementById("totalDistance");
    const fuelUsed = document.getElementById("fuelUsed");
    const fuelCost = document.getElementById("fuelCost");

    if (!summaryBox) return;

    // Fake computation with random numbers
    const buses = Math.floor(Math.random() * 5) + 3; // 3–7 buses
    const distance = (Math.random() * 120 + 50).toFixed(1); // 50–170 km
    const fuel = (distance * 0.12).toFixed(1); // ~12L/100km
    const cost = (fuel * 10.2).toFixed(1); // assuming 10.2 MAD/L

    busesUsed.textContent = buses;
    totalDistance.textContent = distance;
    fuelUsed.textContent = fuel;
    fuelCost.textContent = cost;

    summaryBox.classList.remove("hidden");
    alert("✅ Route computation complete (demo data displayed).");
}

function downloadReport() {
    alert("📄 Report downloaded successfully (simulation only).");
}
