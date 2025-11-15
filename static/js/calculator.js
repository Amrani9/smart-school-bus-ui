// static/js/calculator.js
/* ============================================================
   SMART SCHOOL BUS ROUTING – Route Calculator (fixed version)
   Implements:
   - Removal of schoolPlace field
   - Hides hybrid slider unless Hybrid objective selected
   - Adds green success toast on driver assignment
   - Layout & ID compatibility with updated calculator.html
   ============================================================ */

(function () {
  "use strict";

  // -----------------------------
  // GLOBAL STATE
  // -----------------------------
  const state = {
    map: null,
    schoolMarker: null,
    schoolLatLng: null,
    manualStops: [],
    extraStudents: [],
    excludedIds: new Set(),
    lastOptimization: null,
    directionsService: null,
    activeRenderers: [],
    geocoder: null,
    studentCoordsByKey: new Map()
  };

  const dom = {};

  if (typeof window.showMessage !== "function") {
    window.showMessage = function (msg, type = "info") {
      alert(msg);
    };
  }

  // -----------------------------
  // CACHE DOM
  // -----------------------------
  function cacheDom() {
    dom.studentsTableBody = document.getElementById("studentsTableBody");

    dom.inlineStudentName = document.getElementById("inlineStudentName");
    dom.inlineStudentAddress = document.getElementById("inlineStudentAddress");
    dom.inlineAddBtn = document.getElementById("inlineAddBtn");

    dom.busCount = document.getElementById("busCount");
    dom.seatsPerBus = document.getElementById("seatsPerBus");
    dom.departureTime = document.getElementById("departureTime");
    dom.maxSpeedKmh = document.getElementById("maxSpeedKmh");
    dom.fuelConsumption = document.getElementById("fuelConsumption");

    dom.objectiveRadios = document.querySelectorAll('input[name="objective"]');
    dom.hybridRow = document.getElementById("hybridRow");
    dom.weightDuration = document.getElementById("weightDuration");
    dom.weightVal = document.getElementById("weightVal");
    dom.weightValDist = document.getElementById("weightValDist");

    dom.schoolName = document.getElementById("schoolName");

    dom.computeRouteBtn = document.getElementById("computeRouteBtn");
    dom.summaryBox = document.getElementById("summaryBox");
    dom.routesContainer = document.getElementById("routesContainer");
  }

  // -----------------------------
  // MAP INITIALIZATION
  // -----------------------------
  function initMap() {
    const defaultCenter = { lat: 33.5724, lng: -7.6570 };

    state.map = new google.maps.Map(document.getElementById("map"), {
      center: defaultCenter,
      zoom: 12,
      streetViewControl: false,
    });

    state.geocoder = new google.maps.Geocoder();

    state.map.addListener("click", (e) => {
      const domEvt = e.domEvent || {};
      if (domEvt.ctrlKey || domEvt.metaKey) {
        addManualStop(e.latLng);
      } else {
        setSchoolLocation(e.latLng, "Map click");
      }
    });

    setSchoolLocation(defaultCenter, "Default center");
  }

  function setSchoolLocation(latLng, nameFrom) {
    const pos = latLng instanceof google.maps.LatLng
      ? latLng
      : new google.maps.LatLng(latLng.lat, latLng.lng);

    if (!state.schoolMarker) {
      state.schoolMarker = new google.maps.Marker({
        map: state.map,
        position: pos,
        title: "School / Depot",
        icon: { url: "https://maps.google.com/mapfiles/ms/icons/yellow-dot.png" }
      });
    } else {
      state.schoolMarker.setPosition(pos);
    }

    state.schoolLatLng = { lat: pos.lat(), lng: pos.lng() };

    if (!dom.schoolName.value) {
      dom.schoolName.value = nameFrom;
    }
  }

  function addManualStop(latLng) {
    const pos = latLng instanceof google.maps.LatLng
      ? latLng
      : new google.maps.LatLng(latLng.lat, latLng.lng);

    const id = `M${state.manualStops.length + 1}`;
    state.manualStops.push({
      id,
      name: `Manual stop ${state.manualStops.length + 1}`,
      lat: pos.lat(),
      lng: pos.lng()
    });

    new google.maps.Marker({
      map: state.map,
      position: pos,
      title: id,
      icon: { url: "https://maps.google.com/mapfiles/ms/icons/green-dot.png" }
    });

    showMessage("Manual stop added to route candidates (CTRL+click).", "info");
  }

  // -----------------------------
  // GOOGLE AUTOCOMPLETE
  // -----------------------------
  function initPlacesAutocomplete() {
    if (!google.maps.places) return;

    const nameInput = dom.schoolName;
    if (nameInput) {
      const ac = new google.maps.places.Autocomplete(nameInput, {
        fields: ["name", "geometry", "formatted_address"]
      });
      ac.addListener("place_changed", () => {
        const place = ac.getPlace();
        if (place && place.geometry) {
          const loc = place.geometry.location;
          setSchoolLocation(loc, place.name || "");
        }
      });
    }

    if (dom.inlineStudentAddress) {
      const ac = new google.maps.places.Autocomplete(dom.inlineStudentAddress, {
        fields: ["geometry", "formatted_address", "name"]
      });
      ac.addListener("place_changed", () => {
        dom.inlineStudentAddress._lastPlace = ac.getPlace() || null;
      });
    }
  }

  // -----------------------------
  // STUDENT TABLE
  // -----------------------------
  function getAllStudents() {
    return [...window.students, ...state.extraStudents];
  }

  function renderStudentsTable() {
    const tbody = dom.studentsTableBody;
    tbody.innerHTML = "";

    const all = getAllStudents();

    all.forEach((s) => {
      const row = document.createElement("tr");

      row.innerHTML = `
          <td>${s.id}</td>
          <td>${s.name}</td>
          <td>${s.address}</td>
      `;

      const tdRoute = document.createElement("td");
      const btn = document.createElement("button");
      btn.className = "btn btn-secondary btn-sm";
      btn.textContent = state.excludedIds.has(s.id)
        ? "Add to route"
        : "Remove";

      btn.onclick = () => {
        if (state.excludedIds.has(s.id)) state.excludedIds.delete(s.id);
        else state.excludedIds.add(s.id);

        renderStudentsTable();
      };

      tdRoute.appendChild(btn);
      row.appendChild(tdRoute);

      tbody.appendChild(row);
    });
  }

  function handleAddInlineStudent() {
    const name = dom.inlineStudentName.value.trim();
    const addr = dom.inlineStudentAddress.value.trim();

    if (!name) return showMessage("Please enter a student name.", "error");
    if (!addr) return showMessage("Enter an address or Google Maps link.", "error");

    const id = `X${String(state.extraStudents.length + 1).padStart(3, "0")}`;

    const s = { id, name, address: addr };

    const last = dom.inlineStudentAddress._lastPlace;
    if (last && last.geometry) {
      const loc = last.geometry.location;
      s.lat = loc.lat();
      s.lng = loc.lng();
    }

    state.extraStudents.push(s);
    state.excludedIds.delete(id);

    dom.inlineStudentName.value = "";
    dom.inlineStudentAddress.value = "";
    dom.inlineStudentAddress._lastPlace = null;

    renderStudentsTable();
  }

  // -----------------------------
  // OBJECTIVE UI + HYBRID SLIDER
  // -----------------------------
  function getSelectedObjective() {
    let val = "time";
    dom.objectiveRadios.forEach((r) => {
      if (r.checked) val = r.value;
    });
    return val;
  }

  function setupObjectiveUI() {
    dom.objectiveRadios.forEach((r) =>
      r.addEventListener("change", () => {
        const v = getSelectedObjective();
        dom.hybridRow.hidden = v !== "hybrid";
      })
    );

    dom.weightDuration.addEventListener("input", () => {
      const w = parseFloat(dom.weightDuration.value || "0.7");
      dom.weightVal.textContent = w.toFixed(2);
      dom.weightValDist.textContent = (1 - w).toFixed(2);
    });
  }

  // -----------------------------
  // GEOCODING
  // -----------------------------
  function geocodeAddress(address) {
    return new Promise((resolve, reject) => {
      state.geocoder.geocode({ address }, (results, status) => {
        if (status === "OK" && results[0]) {
          const loc = results[0].geometry.location;
          resolve({ lat: loc.lat(), lng: loc.lng(), formatted: results[0].formatted_address });
        } else reject("Geocoding failed: " + status);
      });
    });
  }

  async function ensureSchoolCoords() {
    if (state.schoolLatLng) return state.schoolLatLng;

    const address = dom.schoolName.value.trim();
    if (!address) throw new Error("Please type/select the school name.");

    if (state.studentCoordsByKey.has("school:" + address)) {
      state.schoolLatLng = state.studentCoordsByKey.get("school:" + address);
      return state.schoolLatLng;
    }

    const res = await geocodeAddress(address);
    const loc = { lat: res.lat, lng: res.lng };
    state.studentCoordsByKey.set("school:" + address, loc);
    state.schoolLatLng = loc;

    return loc;
  }

  async function collectStudentsForPayload() {
    const all = getAllStudents();
    const active = all.filter((s) => !state.excludedIds.has(s.id));

    if (active.length === 0 && state.manualStops.length === 0) {
      throw new Error("No students selected.");
    }

    const out = [];

    for (const s of active) {
      if (typeof s.lat === "number" && typeof s.lng === "number") {
        out.push(s);
        continue;
      }

      const key = s.address;
      let cached = state.studentCoordsByKey.get(key);

      if (!cached) {
        try {
          const res = await geocodeAddress(s.address);
          cached = { lat: res.lat, lng: res.lng };
          state.studentCoordsByKey.set(key, cached);
        } catch {
          if (/^https?:\/\//i.test(s.address)) {
            out.push({ id: s.id, name: s.name, address: s.address, mapsLink: s.address });
            continue;
          }
          throw new Error(`Could not geocode: ${s.name}`);
        }
      }

      out.push({
        id: s.id,
        name: s.name,
        address: s.address,
        lat: cached.lat,
        lng: cached.lng
      });
    }

    state.manualStops.forEach((m) => {
      out.push({
        id: m.id,
        name: m.name,
        lat: m.lat,
        lng: m.lng,
        address: "(manual stop)"
      });
    });

    return out;
  }

  // -----------------------------
  // COMPUTE ROUTE (CALL BACKEND)
  // -----------------------------
  async function handleComputeRoute() {
    try {
      dom.computeRouteBtn.disabled = true;
      dom.computeRouteBtn.textContent = "Computing...";

      dom.routesContainer.innerHTML = "";
      dom.summaryBox.innerHTML = `<h3>Summary</h3><p class="text-muted">Computing routes...</p>`;

      clearExistingRoutesOnMap();

      const school = await ensureSchoolCoords();
      const students = await collectStudentsForPayload();

      const obj = getSelectedObjective();
      let objective = obj === "hybrid" ? "hybrid" : obj;

      const payload = {
        school: {
          name: dom.schoolName.value.trim(),
          lat: school.lat,
          lng: school.lng
        },
        students,
        busCount: parseInt(dom.busCount.value || "1"),
        busCapacity: parseInt(dom.seatsPerBus.value || "10"),
        departureTime: dom.departureTime.value || null,
        maxSpeedKmh: parseFloat(dom.maxSpeedKmh.value || "60"),
        fuelConsumptionLper100: parseFloat(dom.fuelConsumption.value || "6.0"),
        objective
      };

      if (objective === "hybrid") {
        payload.weightDuration = parseFloat(dom.weightDuration.value);
      }

      const resp = await fetch("/optimize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!resp.ok) {
        showMessage("Failed to compute routes.", "error");
        return;
      }

      const result = await resp.json();

      state.lastOptimization = {
        payload,
        result,
        assignments: {}
      };

      window.lastOptimization = state.lastOptimization;

      renderSummary(result.summary);
      renderRoutes(result.routes);
      drawRoutesOnMap(result.routes);

      showMessage("Routes computed successfully.", "success");
    } catch (err) {
      console.error(err);
      showMessage(err.message || "Error computing routes.", "error");
    } finally {
      dom.computeRouteBtn.disabled = false;
      dom.computeRouteBtn.textContent = "Compute route";
    }
  }

  // -----------------------------
  // SUMMARY / ROUTES RENDERING
  // -----------------------------
  function renderSummary(summary) {
    if (!summary) {
      dom.summaryBox.innerHTML = "<h3>Summary</h3><p>No data.</p>";
      return;
    }

    const obj =
      summary.objective === "distance"
        ? "Distance"
        : summary.objective === "hybrid"
        ? "Hybrid"
        : "Time";

    let hybridText = "";
    if (summary.objective === "hybrid") {
      const w = parseFloat(summary.weightDuration).toFixed(2);
      hybridText = `<p class="text-subtle" style="font-size:12px;">Hybrid weights – Time: <strong>${w}</strong> / Distance: <strong>${(1 - w).toFixed(2)}</strong></p>`;
    }

    dom.summaryBox.innerHTML = `
      <h3>Summary</h3>
      <p class="text-muted">Objective: <strong>${obj}</strong></p>

      <div class="grid-two">
        <div>
          <div>Total students: <strong>${summary.totalStudents}</strong></div>
          <div>Buses used: <strong>${summary.busesUsed}/${summary.busCount}</strong></div>
          <div>Avg distance: <strong>${summary.avgDistanceKm.toFixed(2)} km</strong></div>
        </div>
        <div>
          <div>Avg duration: <strong>${summary.avgDurationMin.toFixed(1)} min</strong></div>
          <div>Total fuel: <strong>${summary.totalFuelLiters.toFixed(2)} L</strong></div>
          <div>Max speed: <strong>${summary.maxSpeedKmh} km/h</strong></div>
        </div>
      </div>

      <p class="text-subtle" style="font-size:12px;margin-top:6px;">
        Departure: <strong>${summary.departureTime}</strong>
      </p>

      ${hybridText}
    `;
  }

  function renderRoutes(routes) {
    const container = dom.routesContainer;
    container.innerHTML = "";

    if (!routes || routes.length === 0) {
      container.innerHTML = "<p class='text-muted'>No routes generated.</p>";
      return;
    }

    const driverList = window.drivers || [];

    routes.forEach((route, idx) => {
      const card = document.createElement("div");
      card.className = "card";

      // HEADER
      const header = document.createElement("div");
      header.style.display = "flex";
      header.style.justifyContent = "space-between";
      header.style.alignItems = "center";

      const title = document.createElement("h3");
      title.textContent = `Bus #${route.busId || idx + 1}`;
      header.appendChild(title);

      // DRIVER SELECT
      const assignWrap = document.createElement("div");
      assignWrap.style.display = "flex";
      assignWrap.style.alignItems = "center";
      assignWrap.style.gap = "6px";

      const label = document.createElement("span");
      label.textContent = "Driver:";
      label.style.fontSize = "12px";
      assignWrap.appendChild(label);

      const select = document.createElement("select");
      select.dataset.routeIndex = String(idx);

      const optNone = document.createElement("option");
      optNone.value = "";
      optNone.textContent = "Unassigned";
      select.appendChild(optNone);

      driverList.forEach((d) => {
        const opt = document.createElement("option");
        opt.value = String(d.busNumber);
        opt.textContent = `Bus ${d.busNumber} — ${d.name}`;
        select.appendChild(opt);
      });

      // SUCCESS TOAST WHEN ASSIGNING DRIVER
      select.addEventListener("change", () => {
        const v = select.value || null;
        if (state.lastOptimization) {
          state.lastOptimization.assignments[idx] = v;
        }
        showMessage("Driver successfully assigned to this route!", "success");
      });

      assignWrap.appendChild(select);
      header.appendChild(assignWrap);
      card.appendChild(header);

      // METRICS
      const metrics = document.createElement("div");
      metrics.style.fontSize = "13px";
      metrics.style.marginTop = "8px";

      metrics.innerHTML = `
        <div>Distance: <strong>${route.totalDistanceKm.toFixed(2)} km</strong></div>
        <div>Duration: <strong>${route.totalDurationMin.toFixed(1)} min</strong></div>
        <div>Fuel: <strong>${route.fuelLiters.toFixed(2)} L</strong></div>
        <div>Seats used: <strong>${route.usedSeats}/${route.capacity}</strong></div>
      `;

      card.appendChild(metrics);

      // STOPS
      const stopsTitle = document.createElement("h4");
      stopsTitle.textContent = "Stops (in order)";
      stopsTitle.style.marginTop = "10px";
      stopsTitle.style.fontSize = "13px";
      card.appendChild(stopsTitle);

      const ol = document.createElement("ol");
      ol.style.fontSize = "13px";
      ol.style.marginLeft = "16px";

      route.stops.forEach((s, i) => {
        const li = document.createElement("li");
        li.textContent = `${i + 1}. ${s.name} (${s.lat.toFixed(4)}, ${s.lng.toFixed(4)})`;
        ol.appendChild(li);
      });

      card.appendChild(ol);

      // DOWNLOAD PDF
      const actions = document.createElement("div");
      actions.style.marginTop = "12px";

      const pdfBtn = document.createElement("button");
      pdfBtn.className = "btn btn-secondary btn-sm";
      pdfBtn.textContent = "Download PDF";
      pdfBtn.onclick = () => downloadRoutePdf(idx);

      actions.appendChild(pdfBtn);
      card.appendChild(actions);

      container.appendChild(card);
    });
  }

  // -----------------------------
  // MAP ROUTES DRAWING
  // -----------------------------
  function clearExistingRoutesOnMap() {
    state.activeRenderers.forEach((r) => r.setMap(null));
    state.activeRenderers = [];
  }

  function drawRoutesOnMap(routes) {
    if (!state.map || !routes) return;

    if (!state.directionsService) {
      state.directionsService = new google.maps.DirectionsService();
    }

    clearExistingRoutesOnMap();

    const colors = ["#2563eb", "#10b981", "#f97316", "#a855f7", "#ef4444"];

    routes.forEach((route, idx) => {
      const stops = route.stops;
      if (!stops || stops.length < 2) return;

      const origin = new google.maps.LatLng(stops[0].lat, stops[0].lng);
      const destination = new google.maps.LatLng(stops[stops.length - 1].lat, stops[stops.length - 1].lng);

      const waypoints =
        stops.length > 2
          ? stops.slice(1, -1).map((s) => ({
              location: { lat: s.lat, lng: s.lng },
              stopover: true
            }))
          : [];

      const renderer = new google.maps.DirectionsRenderer({
        map: state.map,
        suppressMarkers: false,
        polylineOptions: {
          strokeColor: colors[idx % colors.length],
          strokeWeight: 4
        }
      });

      state.directionsService.route(
        {
          origin,
          destination,
          waypoints,
          travelMode: "DRIVING"
        },
        (result, status) => {
          if (status === "OK") renderer.setDirections(result);
          else console.warn("Directions failed:", status);
        }
      );

      state.activeRenderers.push(renderer);
    });
  }

  // -----------------------------
  // PDF EXPORT
  // -----------------------------
  function downloadRoutePdf(routeIndex) {
    const opt = state.lastOptimization;
    if (!opt || !opt.result || !opt.result.routes) {
      return showMessage("Compute a route first.", "error");
    }

    const routes = opt.result.routes;
    const summary = opt.result.summary;
    const assignments = opt.assignments;
    const route = routes[routeIndex];

    if (!window.jspdf || !window.jspdf.jsPDF) {
      return showMessage("jsPDF is not loaded.", "error");
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    const driverBus = assignments[routeIndex] || null;
    let driverText = "Unassigned";

    if (driverBus && Array.isArray(window.drivers)) {
      const d = window.drivers.find((dr) => String(dr.busNumber) === String(driverBus));
      if (d) driverText = `Bus ${d.busNumber} — ${d.name}`;
      else driverText = `Bus ${driverBus}`;
    }

    let y = 14;
    doc.setFontSize(16);
    doc.text(`Bus Route #${route.busId || routeIndex + 1}`, 14, y);
    y += 8;

    doc.setFontSize(11);
    doc.text(`School: ${opt.payload.school.name}`, 14, y);
    y += 6;
    doc.text(`Driver: ${driverText}`, 14, y);
    y += 6;
    doc.text(
      `Objective: ${summary.objective} (buses used: ${summary.busesUsed})`,
      14,
      y
    );
    y += 6;
    doc.text(
      `Distance: ${route.totalDistanceKm.toFixed(2)} km | Duration: ${route.totalDurationMin.toFixed(1)} min | Fuel: ${route.fuelLiters.toFixed(2)} L`,
      14,
      y
    );
    y += 8;

    doc.text("Stops:", 14, y);
    y += 6;

    route.stops.forEach((s, i) => {
      doc.text(`${i + 1}. ${s.name} (${s.lat.toFixed(4)}, ${s.lng.toFixed(4)})`, 16, y);
      y += 5;
      if (y > 280) {
        doc.addPage();
        y = 14;
      }
    });

    doc.save(`route_bus_${route.busId || routeIndex + 1}.pdf`);
  }

  // -----------------------------
  // INITIALIZATION
  // -----------------------------
  function attachHandlers() {
    if (dom.inlineAddBtn) dom.inlineAddBtn.onclick = handleAddInlineStudent;
    if (dom.computeRouteBtn) dom.computeRouteBtn.onclick = handleComputeRoute;
  }

  function initRoutePlanner() {
    cacheDom();
    initMap();
    initPlacesAutocomplete();
    setupObjectiveUI();
    renderStudentsTable();
    attachHandlers();
  }

  window.initRoutePlanner = initRoutePlanner;
  window.downloadRoutePdf = downloadRoutePdf;
})();
