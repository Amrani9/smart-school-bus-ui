/* ============================================
   SMART SCHOOL BUS ROUTING SYSTEM (Local UI)
   Toast Notifications, Helpers (ui.js)
   ============================================ */

// Ensure toast container exists
function ensureToastContainer() {
  let container = document.getElementById("toast-container");
  if (!container) {
    container = document.createElement("div");
    container.id = "toast-container";
    document.body.appendChild(container);
  }
  return container;
}

/**
 * Display a toast notification.
 * type = success | error | info
 */
function showMessage(message, type = "info", timeout = 2600) {
  const container = ensureToastContainer();

  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.textContent = message;

  container.appendChild(toast);

  // Slide in
  setTimeout(() => toast.classList.add("toast-show"), 30);

  // Auto remove
  setTimeout(() => {
    toast.classList.remove("toast-show");
    toast.classList.add("toast-hide");

    setTimeout(() => toast.remove(), 500);
  }, timeout);
}

/**
 * Toggle visibility of any element
 */
function toggleElement(selector, show) {
  const el = document.querySelector(selector);
  if (!el) return;
  el.classList.toggle("hidden", !show);
}

/**
 * Fill dropdown helper
 */
function fillDropdown(selector, items) {
  const select = document.querySelector(selector);
  if (!select) return;

  select.innerHTML = "";
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
 * Optional override for alert()
 */
window.alert = function (msg) {
  showMessage(msg, "info");
};
