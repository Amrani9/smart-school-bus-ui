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

// ---------- OPTIONAL: DYNAMIC TABLE RENDER HELPERS ----------
function populateTable(data, tableId, columns) {
  const table = document.getElementById(tableId);
  if (!table) return;

  const tbody = table.querySelector("tbody");
  tbody.innerHTML = "";

  data.forEach((item) => {
    const row = document.createElement("tr");
    columns.forEach((col) => {
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
