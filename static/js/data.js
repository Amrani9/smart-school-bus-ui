/* ============================================
   SMART SCHOOL BUS ROUTING SYSTEM (Local UI)
   Mock Data for Offline Prototype
   ============================================ */

// ---------- DRIVER DATA ----------
const drivers = [
  {
    busNumber: 7,
    name: "Ahmed Idrissi",
    contact: "+212 6 87 23 45 10",
    fuelLiters: 23.5,
    costMAD: 220,
    punctuality: 4.5
  },
  {
    busNumber: 9,
    name: "Hassan El Alaoui",
    contact: "+212 6 45 32 11 20",
    fuelLiters: 25.2,
    costMAD: 240,
    punctuality: 4.2
  },
  {
    busNumber: 11,
    name: "Fatima Benali",
    contact: "+212 6 77 00 22 55",
    fuelLiters: 21.8,
    costMAD: 210,
    punctuality: 4.8
  }
];

// ---------- STUDENT DATA ----------
const students = [
  {
    id: "001",
    name: "Youssef Amrani",
    address: "Rue 32, Hay Mohammedia"
  },
  {
    id: "002",
    name: "Imane Talbi",
    address: "Quartier Californie, Casablanca"
  },
  {
    id: "003",
    name: "Omar Bouziane",
    address: "Ain Chok, Casablanca"
  },
  {
    id: "004",
    name: "Nadia Lamrani",
    address: "Hay Hassani, Casablanca"
  }
];

// ---------- SAMPLE ROUTE DATA (for simulation) ----------
const routes = [
  {
    id: "R001",
    driver: "Ahmed Idrissi",
    distanceKm: 45.3,
    fuelLiters: 12.8,
    costMAD: 120.0,
    stops: 18
  },
  {
    id: "R002",
    driver: "Hassan El Alaoui",
    distanceKm: 52.7,
    fuelLiters: 14.2,
    costMAD: 138.0,
    stops: 20
  }
];

/* ============================================================
   OPTIONAL IN-MEMORY LOGS (per-day inputs for drivers)
   - Used only on the front-end to accumulate daily entries.
   - Not persisted anywhere; reset when the page reloads.
   ============================================================ */

const dailyDriverLogs = {};

/**
 * Add one daily log entry for a driver, referenced by bus number.
 * This does NOT update table values by itself; pages are free to
 * use this helper in addition to their own UI updates.
 */
function addDailyDriverLog(busNumber, entry = {}) {
  const key = String(busNumber);
  if (!dailyDriverLogs[key]) {
    dailyDriverLogs[key] = [];
  }

  const safeEntry = {
    date: entry.date || new Date(),
    fuelLiters: typeof entry.fuelLiters === "number" ? entry.fuelLiters : 0,
    costMAD: typeof entry.costMAD === "number" ? entry.costMAD : 0,
    punctuality:
      typeof entry.punctuality === "number" ? entry.punctuality : null
  };

  dailyDriverLogs[key].push(safeEntry);
}

/* ============================================================
   DASHBOARD / ANALYTICS HELPERS
   These helpers are read-only; they never mutate the data.
   ============================================================ */

/**
 * Get drivers sorted by lowest total fuel consumption.
 * @param {number} limit - how many drivers to return (default 5)
 */
function getTopDriversByFuel(limit = 5) {
  return [...drivers]
    .filter(d => typeof d.fuelLiters === "number")
    .sort((a, b) => a.fuelLiters - b.fuelLiters)
    .slice(0, limit);
}

/**
 * Get drivers sorted by highest punctuality rating.
 * @param {number} limit - how many drivers to return (default 5)
 */
function getTopDriversByPunctuality(limit = 5) {
  return [...drivers]
    .filter(d => typeof d.punctuality === "number")
    .sort((a, b) => b.punctuality - a.punctuality)
    .slice(0, limit);
}

/**
 * Aggregate totals for the dashboard cards.
 * Returns an object with counts and totals based on current mock data.
 */
function getDashboardTotals() {
  const totalDrivers = Array.isArray(drivers) ? drivers.length : 0;
  const totalStudents = Array.isArray(students) ? students.length : 0;
  const totalRoutes = Array.isArray(routes) ? routes.length : 0;

  let totalPunct = 0;
  let totalFuelLiters = 0;
  let totalFuelMAD = 0;

  if (Array.isArray(drivers)) {
    drivers.forEach(d => {
      if (typeof d.punctuality === "number") {
        totalPunct += d.punctuality;
      }
      if (typeof d.fuelLiters === "number") {
        totalFuelLiters += d.fuelLiters;
      }
      if (typeof d.costMAD === "number") {
        totalFuelMAD += d.costMAD;
      }
    });
  }

  const avgPunctuality =
    totalDrivers > 0 ? totalPunct / totalDrivers : 0;

  // Represent punctuality (1–5) as an approximate on-time percentage.
  const onTimePercent = Math.round((avgPunctuality / 5) * 100);

  return {
    totalDrivers,
    totalStudents,
    totalRoutes,
    avgPunctuality,
    onTimePercent,
    totalFuelLiters,
    totalFuelMAD
  };
}

/* ============================================================
   OPTIONAL: DYNAMIC TABLE RENDER HELPERS
   (kept from original file for backwards compatibility)
   ============================================================ */

function populateTable(data, tableId, columns) {
  const table = document.getElementById(tableId);
  if (!table) return;

  const tbody = table.querySelector("tbody");
  tbody.innerHTML = "";

  data.forEach(item => {
    const row = document.createElement("tr");
    columns.forEach(col => {
      const cell = document.createElement("td");
      cell.textContent = item[col];
      row.appendChild(cell);
    });
    tbody.appendChild(row);
  });
}

// Example usage (uncomment if you want live rendering):
// document.addEventListener("DOMContentLoaded", () => {
//   if (document.getElementById("driverTable")) {
//     populateTable(drivers, "driverTable", [
//       "busNumber",
//       "name",
//       "contact",
//       "fuelLiters",
//       "costMAD",
//       "punctuality"
//     ]);
//   }
//   if (document.getElementById("studentTable")) {
//     populateTable(students, "studentTable", ["id", "name", "address"]);
//   }
// });
window.students = students;
window.drivers = drivers;
