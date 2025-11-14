/* ============================================
   SMART SCHOOL BUS ROUTING SYSTEM (Local UI)
   Dashboard Trend Charts (Fuel & Cost — 2025)
   ============================================ */

document.addEventListener("DOMContentLoaded", () => {
  // Labels for each month of 2025
  const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
  ];

  // Mock monthly data (example values in Liters & MAD)
  // You can later update these manually or load from data.js
  const fuelData = [420, 380, 440, 460, 430, 410, 390, 400, 450, 470, 440, 420];
  const costData = [3900, 3700, 4000, 4150, 3950, 3850, 3800, 3900, 4100, 4200, 4050, 3950];

  // ----------- Fuel Consumption Trend -----------
  const fuelCtx = document.getElementById("fuelChart");
  if (fuelCtx) {
    new Chart(fuelCtx, {
      type: "line",
      data: {
        labels: months,
        datasets: [
          {
            label: "Total Fuel Consumption (Liters)",
            data: fuelData,
            borderColor: "rgba(37, 99, 235, 1)",
            backgroundColor: "rgba(37, 99, 235, 0.1)",
            borderWidth: 2,
            tension: 0.3,
            pointRadius: 4,
            pointBackgroundColor: "rgba(37, 99, 235, 1)"
          }
        ]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { display: false },
          title: {
            display: true,
            text: "Monthly Fuel Consumption — 2025",
            font: { size: 16 }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            title: { display: true, text: "Liters" }
          },
          x: {
            title: { display: true, text: "Month" }
          }
        }
      }
    });
  }

  // ----------- Fuel Cost Trend -----------
  const costCtx = document.getElementById("costChart");
  if (costCtx) {
    new Chart(costCtx, {
      type: "line",
      data: {
        labels: months,
        datasets: [
          {
            label: "Total Fuel Cost (MAD)",
            data: costData,
            borderColor: "rgba(22, 163, 74, 1)",
            backgroundColor: "rgba(22, 163, 74, 0.1)",
            borderWidth: 2,
            tension: 0.3,
            pointRadius: 4,
            pointBackgroundColor: "rgba(22, 163, 74, 1)"
          }
        ]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { display: false },
          title: {
            display: true,
            text: "Monthly Fuel Cost — 2025",
            font: { size: 16 }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            title: { display: true, text: "MAD" }
          },
          x: {
            title: { display: true, text: "Month" }
          }
        }
      }
    });
  }
});
