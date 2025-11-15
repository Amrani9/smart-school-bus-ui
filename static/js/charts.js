/* ============================================================
   SMART SCHOOL BUS ROUTING SYSTEM — DASHBOARD CHARTS
   Clean, Neutral, Professional Theme (Teal + Gray)
   ============================================================ */

document.addEventListener("DOMContentLoaded", () => {

    /* ------------------------------
       SHARED SETTINGS
       ------------------------------ */
    const months = [
        "Jan", "Feb", "Mar", "Apr", "May", "Jun",
        "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
    ];

    // Same prototype values
    const fuelData = [420, 380, 440, 460, 430, 410, 390, 400, 450, 470, 440, 420];
    const costData = [3900, 3700, 4000, 4150, 3950, 3850, 3800, 3900, 4100, 4200, 4050, 3950];

    /* ------------------------------
       BASE CHART OPTIONS
       ------------------------------ */
    const baseOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { display: false },
            tooltip: {
                backgroundColor: "#333",
                titleColor: "#fff",
                bodyColor: "#eee",
                padding: 10,
                borderColor: "#444",
                borderWidth: 1,
            },
            title: {
                display: true,
                font: {
                    size: 15,
                    weight: "600",
                    family: "Segoe UI"
                },
                color: "#333",
                padding: { top: 10, bottom: 15 }
            }
        },
        scales: {
            y: {
                beginAtZero: true,
                grid: {
                    color: "#e2e2e2",
                    lineWidth: 1
                },
                ticks: {
                    color: "#555",
                    font: { family: "Segoe UI" }
                }
            },
            x: {
                grid: { display: false },
                ticks: {
                    color: "#555",
                    font: { family: "Segoe UI" }
                }
            }
        }
    };

    /* ============================================================
       FUEL CONSUMPTION CHART — TEAL THEME
       ============================================================ */
    const fuelCtx = document.getElementById("fuelChart");

    if (fuelCtx) {
        new Chart(fuelCtx, {
            type: "line",
            data: {
                labels: months,
                datasets: [
                    {
                        label: "Fuel Consumption",
                        data: fuelData,
                        borderColor: "#009688",
                        backgroundColor: "rgba(0, 150, 136, 0.12)",
                        borderWidth: 3,
                        tension: 0.35,
                        pointRadius: 4,
                        pointBackgroundColor: "#009688",
                        pointHoverRadius: 6,
                        pointHoverBackgroundColor: "#006d62",
                    }
                ]
            },
            options: {
                ...baseOptions,
                plugins: {
                    ...baseOptions.plugins,
                    title: {
                        ...baseOptions.plugins.title,
                        text: "Fuel Consumption (Liters) — Monthly Trend"
                    }
                }
            }
        });
    }

    /* ============================================================
       FUEL COST CHART — DARK GRAY THEME
       ============================================================ */
    const costCtx = document.getElementById("costChart");

    if (costCtx) {
        new Chart(costCtx, {
            type: "line",
            data: {
                labels: months,
                datasets: [
                    {
                        label: "Fuel Cost (MAD)",
                        data: costData,
                        borderColor: "#444444",
                        backgroundColor: "rgba(68, 68, 68, 0.12)",
                        borderWidth: 3,
                        tension: 0.35,
                        pointRadius: 4,
                        pointBackgroundColor: "#444444",
                        pointHoverRadius: 6,
                        pointHoverBackgroundColor: "#222222",
                    }
                ]
            },
            options: {
                ...baseOptions,
                plugins: {
                    ...baseOptions.plugins,
                    title: {
                        ...baseOptions.plugins.title,
                        text: "Fuel Cost (MAD) — Monthly Trend"
                    }
                }
            }
        });
    }

});
