/* ============================================
   SMART SCHOOL BUS ROUTING SYSTEM (Local UI)
   UI Helper Utilities (ui.js)
   ============================================ */

/**
 * Display a small notification message on screen.
 * type = "success" | "error" | "info"
 */
function showMessage(message, type = "info", timeout = 2500) {
  // Remove existing message if any
  const existing = document.querySelector(".ui-message");
  if (existing) existing.remove();

  const msg = document.createElement("div");
  msg.className = `ui-message ${type}`;
  msg.textContent = message;

  document.body.appendChild(msg);

  setTimeout(() => {
    msg.classList.add("fade-out");
    setTimeout(() => msg.remove(), 500);
  }, timeout);
}

/**
 * Toggle visibility of a DOM element.
 * @param {string} selector - element selector
 * @param {boolean} show - true = show, false = hide
 */
function toggleElement(selector, show) {
  const el = document.querySelector(selector);
  if (!el) return;
  el.classList.toggle("hidden", !show);
}

/**
 * Fill a dropdown (<select>) with provided items.
 * @param {string} selector - select element selector
 * @param {Array} items - array of values or objects with {label, value}
 */
function fillDropdown(selector, items) {
  const select = document.querySelector(selector);
  if (!select) return;

  select.innerHTML = ""; // clear
  const defaultOpt = document.createElement("option");
  defaultOpt.textContent = "Select Option";
  defaultOpt.value = "";
  select.appendChild(defaultOpt);

  items.forEach((it) => {
    const opt = document.createElement("option");
    if (typeof it === "string") {
      opt.textContent = it;
      opt.value = it;
    } else {
      opt.textContent = it.label;
      opt.value = it.value;
    }
    select.appendChild(opt);
  });
}

/**
 * Load drivers into the calculator dropdown (if page contains it)
 */
document.addEventListener("DOMContentLoaded", () => {
  const assignSelect = document.getElementById("assignDriver");
  if (assignSelect && typeof drivers !== "undefined") {
    fillDropdown(
      "#assignDriver",
      drivers.map((d) => d.name)
    );
  }
});

/**
 * Optional: nicer alerts replacing native window.alert()
 * Use showMessage("text", "success"|"error"|"info")
 */
window.alert = function (msg) {
  showMessage(msg, "info");
};
