/* ================================================================
   BOOT: ask the Node/MySQL backend for the data BEFORE the app
   reads it. If the server is down the app still runs from the
   browser mirror (see api.js).
   ================================================================ */
(async function bootEMS() {
  if (window.EMS_API) {
    try { await window.EMS_API.init(); }
    catch (e) { console.warn("[EMS] Starting from browser storage only."); }
  }
/* ================================================================
   Joecon's Employee Management System  (tiimi-inspired UI)
   Modules: Dashboard | Employees | Attendance | Cash Advance
            Payroll Processing | Reports
   Tech: Vanilla HTML / CSS / JavaScript  +  Node/Express API  +  MySQL
   Data: MySQL is the source of truth (via api.js + server.js).
         The browser keeps a local mirror so the UI stays instant.
   ================================================================ */

// ---------------- Storage layer (safe: falls back to memory) ----------------
const store = {
  get(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) { return fallback; }
  },
  set(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) {}
    try { if (window.EMS_API) window.EMS_API.save(key, value); } catch (e) {}   // mirror this collection to MySQL
  }
};

// v2 keys: employee records now include department + dateHired
let employees = store.get("jems2_employees", null);
let attendance = store.get("jems2_attendance", null);
let cashAdvances = store.get("jems2_cashAdvances", null);

// Edit-mode trackers (null = adding a new record)
var editingEmpId = null;

// ---------------- Activity log ----------------
function logActivity(action) {
  const log = store.get("jems2_log", []);
  log.push({
    at: new Date().toISOString(),
    user: (typeof currentUser !== "undefined" && currentUser) ? currentUser.username : "system",
    action: action
  });
  store.set("jems2_log", log.slice(-300));          // keep the latest 300 entries
}

// ---------------- Utility helpers ----------------
const money = n => "₱" + (Number(n) || 0).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const $ = sel => document.querySelector(sel);

function todayISO() {
  const d = new Date();
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}
function fmtDate(iso) {
  if (!iso) return "—";
  const p = iso.split("-");
  return p[2] + "/" + p[1] + "/" + p[0]; // DD/MM/YYYY
}
function longDate(d) {
  const days = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
  const months = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  return days[d.getDay()] + ", " + months[d.getMonth()] + " " + d.getDate() + ", " + d.getFullYear();
}
function fmtTime(dt) {
  const t = dt ? new Date(dt) : new Date();
  let h = t.getHours(), m = t.getMinutes(), s = t.getSeconds();
  const ap = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return String(h).padStart(2,"0") + ":" + String(m).padStart(2,"0") + ":" + String(s).padStart(2,"0") + " " + ap;
}
function getEmp(id) { return employees.find(e => e.id === id); }

function initials(name) {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] || "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}
const AVATAR_COLORS = ["#0f766e", "#2563eb", "#db2777", "#d97706", "#7c3aed", "#0891b2", "#dc2626", "#4d7c0f"];
function avatarColor(name) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function populateEmployeeOptions() {
  const opts = employees.map(e => '<option value="' + e.id + '">' + e.fullName + ' — ' + e.position + '</option>').join("");
  $("#attEmp").innerHTML = employees.length ? opts : '<option value="">— No employees yet —</option>';
  $("#caEmp").innerHTML = employees.length ? opts : '<option value="">— No employees yet —</option>';
}

// ---------------- Sample data on first run ----------------
function seedSampleData() {
  employees = [
    { id: "EMP-001", fullName: "Juan Dela Cruz",    position: "Welder",             department: "Welding",     dailyRate: 650, dateHired: "2021-03-17" },
    { id: "EMP-002", fullName: "Pedro Santos",      position: "Fabricator",         department: "Fabrication", dailyRate: 600, dateHired: "2021-06-02" },
    { id: "EMP-003", fullName: "Ramon Reyes",       position: "Laborer",            department: "Construction",dailyRate: 500, dateHired: "2022-01-10" },
    { id: "EMP-004", fullName: "Maria Gonzaga",     position: "Timekeeper / Staff", department: "Admin / HR",  dailyRate: 550, dateHired: "2021-09-22" },
    { id: "EMP-005", fullName: "Arturo Villanueva", position: "Welder",             department: "Welding",     dailyRate: 680, dateHired: "2022-04-05" },
    { id: "EMP-006", fullName: "Eduardo Lim",       position: "Foreman",            department: "Construction",dailyRate: 750, dateHired: "2020-11-15" },
    { id: "EMP-007", fullName: "Fernando Cruz",     position: "Fabricator",         department: "Fabrication", dailyRate: 620, dateHired: "2023-02-08" },
    { id: "EMP-008", fullName: "Liza Mendoza",      position: "HR Staff",           department: "Admin / HR",  dailyRate: 560, dateHired: "2023-07-01" }
  ];

  attendance = [];
  const now = new Date();
  const sampleIns  = ["07:35", "07:48", "08:05", "08:22", "07:59", "07:42", "08:12", "07:55"];
  const sampleOuts = ["17:02", "17:30", "17:15", "16:58", "18:05", "17:20", "17:45", "17:00"];
  for (let dayOffset = 6; dayOffset >= 1; dayOffset--) {
    const d = new Date(now);
    d.setDate(d.getDate() - dayOffset);
    const iso = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
    if (d.getDay() === 0) continue; // no work on Sundays
    employees.forEach(function (emp, i) {
      if (Math.random() < 0.1) return; // ~10% absent
      const inT  = sampleIns[(i + dayOffset) % sampleIns.length];
      const outT = sampleOuts[(i + dayOffset) % sampleOuts.length];
      const parts = inT.split(":").map(Number);
      const lateMin = Math.max(0, (parts[0] * 60 + parts[1]) - (8 * 60));
      attendance.push({ empId: emp.id, date: iso, timeIn: iso + "T" + inT + ":00", timeOut: iso + "T" + outT + ":00", lateMin: lateMin });
    });
  }

  cashAdvances = [
    { id: 1, empId: "EMP-001", date: todayISO(), amount: 1500, notes: "Medical assistance" },
    { id: 2, empId: "EMP-003", date: todayISO(), amount: 1000, notes: "Emergency allowance" }
  ];

  saveAll();
}

function saveAll() {
  store.set("jems2_employees", employees);
  store.set("jems2_attendance", attendance);
  store.set("jems2_cashAdvances", cashAdvances);
}

// ---------------- Navigation ----------------
const titles = {
  dashboard: "Dashboard", employees: "Employees", attendance: "Attendance / Timekeeping",
  cashadvance: "Cash Advance Tracking", payroll: "Payroll Processing", reports: "Reports",
  myportal: "My Portal"
};

function go(section) {
  document.querySelectorAll(".nav-link").forEach(function (a) {
    a.classList.toggle("active", a.dataset.section === section);
  });
  document.querySelectorAll(".section").forEach(function (s) {
    s.classList.toggle("active", s.id === "section-" + section);
  });
  if (section === "payroll") renderPayroll();
  if (section === "reports") renderReport();
  if (section === "myportal" && typeof renderPortal === "function") renderPortal();
  closeAllMenus();
}

document.querySelectorAll(".nav-link").forEach(function (a) {
  a.addEventListener("click", function () { go(a.dataset.section); });
});

// Dashboard quick actions
document.querySelectorAll("[data-goto]").forEach(function (b) {
  b.addEventListener("click", function () { go(b.dataset.goto); });
});

// ================= MODULE 1: DASHBOARD =================
function renderDashboard() {
  const today = todayISO();
  const todays = attendance.filter(function (a) { return a.date === today; });
  const present = new Set(todays.map(function (a) { return a.empId; })).size;
  const late = todays.filter(function (a) { return a.lateMin > 0; }).length;
  const monthCA = cashAdvances
    .filter(function (c) { return c.date.slice(0, 7) === today.slice(0, 7); })
    .reduce(function (s, c) { return s + c.amount; }, 0);

  $("#statEmployees").textContent = employees.length;
  $("#statPresent").textContent = present;
  $("#statLate").textContent = late;
  $("#statCA").textContent = money(monthCA);

  $("#dashAttendance").innerHTML = todays.length
    ? todays.map(function (a) {
        const emp = getEmp(a.empId);
        return '<tr><td>' + (emp ? emp.fullName : "—") + '</td>' +
          '<td>' + fmtTime(a.timeIn) + '</td>' +
          '<td>' + (a.timeOut ? fmtTime(a.timeOut) : "—") + '</td>' +
          '<td><span class="badge ' + (a.lateMin > 0 ? "badge-late" : "badge-ontime") + '">' +
          (a.lateMin > 0 ? "Late " + a.lateMin + " min" : "On time") + '</span></td></tr>';
      }).join("")
    : '<tr><td colspan="4" class="empty">No attendance records today yet.</td></tr>';

  $("#dashCA").innerHTML = cashAdvances.length
    ? cashAdvances.slice(-5).reverse().map(function (c) {
        const emp = getEmp(c.empId);
        return '<tr><td>' + c.date + '</td><td>' + (emp ? emp.fullName : "—") +
          '</td><td class="text-right">' + money(c.amount) + '</td></tr>';
      }).join("")
    : '<tr><td colspan="3" class="empty">No cash advances recorded.</td></tr>';
}

// ================= MODULE 2: EMPLOYEES (tiimi-style cards) =================
let searchTerm = "";
let posFilter = "";

function filteredEmployees() {
  return employees.filter(function (e) {
    const q = searchTerm.trim().toLowerCase();
    const matchQ = !q || (e.fullName + " " + e.position + " " + e.id + " " + (e.email || "")).toLowerCase().indexOf(q) !== -1;
    const matchD = !posFilter || e.position === posFilter;
    return matchQ && matchD;
  });
}

function renderEmployees() {
  const list = filteredEmployees();
  $("#empCountTitle").innerHTML = employees.length + (employees.length === 1 ? " Employee " : " Employees ") + "<span style='font-size:13px;color:#7c8a99;font-weight:600;'>" +
    (list.length !== employees.length ? "(" + list.length + " shown)" : "") + "</span>";

  const grid = $("#employeeGrid");
  if (!employees.length) {
    grid.innerHTML = '<div class="empty" style="grid-column:1/-1;">No employees yet. New employees register from the login screen (&ldquo;Register here&rdquo;), or use the + button in the top bar.</div>';
    populateEmployeeOptions();
    return;
  }
  if (!list.length) {
    grid.innerHTML = '<div class="empty" style="grid-column:1/-1;">No employees match your search/filter.</div>';
    populateEmployeeOptions();
    return;
  }

  grid.innerHTML = list.map(function (e) {
    return '<div class="emp-card">' +
      '<div class="emp-card-top">' +
        '<span class="status-badge active">Active</span>' +
        '<div class="card-menu-wrap">' +
          '<button class="card-menu-btn" data-menu="' + e.id + '" title="More options">⋯</button>' +
          '<div class="card-menu" id="menu-' + e.id + '">' +
            '<button data-menu-act="edit" data-id="' + e.id + '">Edit Details</button>' +
            '<button data-menu-act="attendance" data-id="' + e.id + '">Record Attendance</button>' +
            '<button data-menu-act="cashadvance" data-id="' + e.id + '">New Cash Advance</button>' +
            '<button data-menu-act="delete" data-id="' + e.id + '" class="danger">Remove Employee</button>' +
          '</div>' +
        '</div>' +
      '</div>' +
      '<div class="emp-avatar" style="background:' + avatarColor(e.fullName) + '">' + initials(e.fullName) + '</div>' +
      '<div class="emp-name">' + e.fullName + '</div>' +
      '<div class="emp-position">' + e.position + '</div>' +
      '<div class="emp-info-grid">' +
        '<div><div class="k">Birthday</div><div class="v">' + (e.birthday ? fmtDate(e.birthday) : "—") + '</div></div>' +
        '<div><div class="k">Date Hired</div><div class="v">' + fmtDate(e.dateHired) + '</div></div>' +
        '<div><div class="k">Employee ID</div><div class="v">' + e.id + '</div></div>' +
        '<div><div class="k">Position</div><div class="v">' + e.position + '</div></div>' +
      '</div>' +
      '<div class="emp-contact">' + (e.email || "—") + '</div>' +
      '<div class="emp-contact">' + (e.phone || "—") + '</div>' +
      '<span class="emp-rate-badge">Daily Rate: ' + money(e.dailyRate) + '</span>' +
    '</div>';
  }).join("");

  populateEmployeeOptions();
}

function closeAllMenus() {
  document.querySelectorAll(".card-menu.open").forEach(function (m) { m.classList.remove("open"); });
}

document.addEventListener("click", function (ev) {
  // Toggle the ⋯ menus
  const menuBtn = ev.target.closest("[data-menu]");
  if (menuBtn) {
    const id = menuBtn.dataset.menu;
    const menu = document.getElementById("menu-" + id);
    const wasOpen = menu.classList.contains("open");
    closeAllMenus();
    if (!wasOpen) menu.classList.add("open");
    return;
  }
  // Menu actions
  const actBtn = ev.target.closest("[data-menu-act]");
  if (actBtn) {
    const id = actBtn.dataset.id;
    const act = actBtn.dataset.menuAct;
    closeAllMenus();
    if (act === "delete") {
      if (!can("write")) return alertDialog("Not allowed", "You need the 'Write' access right to remove employees.", "warn");
      confirmDialog("Remove employee?", "Remove this employee? Attendance and CA records will be kept.", "Remove", true).then(function (yes) {
        if (!yes) return;
        const gone = getEmp(id);
        employees = employees.filter(function (x) { return x.id !== id; });
        const portals = users.filter(function (u) { return u.empId === id; });
        if (portals.length) {
          users = users.filter(function (u) { return u.empId !== id; });
          saveUsers();
          logActivity("Removed My Portal login of " + (gone ? gone.fullName : id));
        }
        logActivity("Removed employee " + id + " (" + (gone ? gone.fullName : "") + ")");
        if (editingEmpId === id) cancelEmpEdit();
        saveAll();
        renderEmployees(); renderDashboard();
      });
    } else if (act === "edit") {
      startEmpEdit(id);
    } else if (act === "attendance") {
      go("attendance");
      $("#attEmp").value = id;
    } else if (act === "cashadvance") {
      go("cashadvance");
      $("#caEmp").value = id;
    }
    return;
  }
  closeAllMenus();
});

$("#employeeForm").addEventListener("submit", function (e) {
  e.preventDefault();                          // only reached when validation passed
  const first = val("empFirst"), middle = val("empMiddle"), last = val("empLast");
  const fullName = (first + " " + (middle ? middle + " " : "") + last).replace(/\s+/g, " ").trim();
  const data = {
    fullName: fullName,
    firstName: first, middleName: middle, lastName: last,
    gender: $("#empGender").value,
    birthday: $("#empBday").value,
    address: {
      street: val("empStreet"),
      barangay: val("empBarangay"),
      city: $("#empCity").value,
      region: $("#empRegion").value,
      postal: val("empPostal"),
      country: $("#empCountry").value
    },
    position: $("#empPosition").value,
    dailyRate: parseFloat($("#empRate").value),
    dateHired: $("#empHired").value || todayISO(),
    email: val("empEmail"),
    phone: "0" + val("empPhone")                 // +63 9xx xxx xxxx is stored as 09xxxxxxxxx
  };
  if (editingEmpId) {
    const emp = getEmp(editingEmpId);
    Object.assign(emp, data);
    logActivity("Updated employee " + emp.id + " (" + emp.fullName + ")");
  } else {
    const num = employees.length ? Math.max.apply(null, employees.map(x => parseInt(x.id.split("-")[1]))) + 1 : 1;
    data.id = "EMP-" + String(num).padStart(3, "0");
    employees.push(data);
    logActivity("Added employee " + data.id + " (" + data.fullName + ", " + data.position + ")");
  }
  saveAll();
  renderEmployees(); renderDashboard();
  const wasEdit = !!editingEmpId;
  const targetId = editingEmpId || data.id;
  const doneMsg = wasEdit ? ("Employee " + targetId + " updated.") : ("Employee " + data.id + " added.");
  // Portal login (create / update / remove) is part of the same save
  applyPortalLogin(data, targetId).then(function (note) {
    closeEmpModal();
    emsToast(doneMsg + (note ? " " + note : ""));
  });
});

/* Give the employee a My Portal login (or update/remove the one they have).
   Employees with a login get rights ["read"] and are linked by empId, so the
   app shows them ONLY their own My Portal. */
function applyPortalLogin(data, empId) {
  const username = val("empUsername");
  const pw = $("#empPortalPassword").value;
  const linked = users.find(function (u) { return u.empId === empId; });

  if (username) {
    if (linked) {
      linked.fullName = data.fullName;
      linked.username = username;
      linked.email = data.email;
      linked.phone = data.phone;
      if (pw) linked.password = pw;                 // blank = keep the current password
      saveUsers();
      logActivity("Updated My Portal login for " + data.fullName + " (" + username + ")" + (pw ? " and reset password" : ""));
      return Promise.resolve("Portal login updated.");
    }
    const num = users.length ? Math.max.apply(null, users.map(function (u) { return parseInt(u.id.split("-")[1]); })) + 1 : 1;
    users.push({
      id: "USR-" + String(num).padStart(3, "0"),
      fullName: data.fullName,
      username: username,
      email: data.email,
      phone: data.phone,
      password: pw,
      status: "Active",
      rights: ["read"],                             // portal-only access
      expiry: "",
      empId: empId
    });
    saveUsers();
    logActivity("Created My Portal login for " + data.fullName + " (" + username + ")");
    return Promise.resolve("Portal login created \u2014 the employee can now sign in.");
  }

  if (!linked) return Promise.resolve("");
  return confirmDialog("Remove portal login?", "Clear the My Portal login for " + data.fullName +
    " (" + linked.username + ")? They will no longer be able to sign in.", "Remove login", true)
    .then(function (yes) {
      if (!yes) return "";
      users = users.filter(function (u) { return u.id !== linked.id; });
      saveUsers();
      logActivity("Removed My Portal login of " + data.fullName);
      return "Portal login removed.";
    });
}

/* ================================================================
   FLOATING FORM WINDOWS  (Add / Edit employee and user accounts)
   ================================================================ */
function showModal(sel) {
  const bd = $(sel);
  bd.hidden = false;
  document.body.classList.add("modal-open");
  requestAnimationFrame(function () { bd.classList.add("open"); });
}
function hideModal(sel) {
  const bd = $(sel);
  bd.classList.remove("open");
  document.body.classList.remove("modal-open");
  setTimeout(function () { bd.hidden = true; }, 180);
}
function emsToast(msg, kind) {
  let t = $("#toastBox");
  if (!t) { t = document.createElement("div"); t.id = "toastBox"; document.body.appendChild(t); }
  t.textContent = msg;
  t.className = (kind === "err" ? "err " : "") + "show";
  clearTimeout(emsToast._t);
  emsToast._t = setTimeout(function () { t.className = ""; }, 2800);
}
document.addEventListener("keydown", function (e) {
  if (e.key !== "Escape") return;
  if (!$("#regModal").hidden) closeRegModal();
  else if (!$("#empModal").hidden) closeEmpModal();
});

// ---- Employee window: reset / fill / open / close ----
function resetEmpForm() {
  const f = $("#employeeForm");
  f.reset();
  resetAddressCascade();
  $("#empRate").dataset.auto = "";
  $("#empPwLabel").textContent = "Password";
  $("#empPwHint").textContent = "Letters and numbers, at least 8 characters.";
  $("#empHired").value = todayISO();
  $("#empFormTitle").textContent = "Add New Employee";
  $("#empSubmit").textContent = "Add Employee";
  clearValidation(f);
}
function cancelEmpEdit() {
  editingEmpId = null;
  resetEmpForm();
}
// Older records only had a full name — split it into the composite name parts
function fillEmpForm(emp) {
  let first = emp.firstName, middle = emp.middleName, last = emp.lastName;
  if (!first && !last) {
    const parts = String(emp.fullName || "").split(/\s+/);
    first = parts.shift() || "";
    last = parts.length ? parts.pop() : "";
    middle = parts.join(" ");
  }
  $("#empFirst").value = first || "";
  $("#empMiddle").value = middle || "";
  $("#empLast").value = last || "";
  $("#empGender").value = emp.gender || "";
  $("#empBday").value = emp.birthday || "";
  $("#empPhone").value = String(emp.phone || "").replace(/^0+(?=9)/, "");
  // Restore the saved address into the cascade (country -> region -> city -> barangay + postal)
  resetAddressCascade();
  const a = emp.address || {};
  if (a.country) {
    $("#empCountry").value = a.country;
    if (a.country === "Philippines") {
      fillSelect($("#empRegion"), Object.keys(PH_ADDRESS), "Select a region / state");
      $("#empRegion").disabled = false;
      if (a.region) {
        $("#empRegion").value = a.region;
        fillSelect($("#empCity"), Object.keys(PH_ADDRESS[a.region] || {}), "Select a city / municipality");
        $("#empCity").disabled = false;
        if (a.city) {
          $("#empCity").value = a.city;
          $("#empBarangay").disabled = false;
          $("#empBarangay").placeholder = "e.g. Barangay 8, Purok 2";
        }
      }
    }
  }
  $("#empBarangay").value = a.barangay || "";
  $("#empStreet").value = a.street || "";
  $("#empPostal").value = a.postal || "";
  $("#empPosition").value = emp.position || "";
  $("#empRate").value = emp.dailyRate;
  $("#empRate").dataset.auto = DEFAULT_RATES[emp.position] || "";
  $("#empHired").value = emp.dateHired;
  $("#empEmail").value = emp.email || "";
  // portal login (if this employee already has one)
  const linkedLogin = users.find(function (u) { return u.empId === emp.id; });
  $("#empUsername").value = linkedLogin ? linkedLogin.username : "";
  $("#empPortalPassword").value = "";
  $("#empPwLabel").textContent = linkedLogin ? "New Password (leave blank to keep current)" : "Password";
  $("#empPwHint").textContent = linkedLogin
    ? "This employee can sign in as \u201c" + linkedLogin.username + "\u201d. Leave blank to keep the current password."
    : "Letters and numbers, at least 8 characters.";
}
function openEmpModal(mode, id) {
  resetEmpForm();                       // always start from a clean sheet
  if (mode === "edit") {
    const emp = getEmp(id);
    if (!emp) return;
    editingEmpId = id;
    fillEmpForm(emp);
    $("#empFormTitle").textContent = "Edit Employee — " + emp.id;
    $("#empSubmit").textContent = "Save Changes";
  } else {
    editingEmpId = null;
  }
  showModal("#empModal");
  setTimeout(function () { $("#empFirst").focus(); }, 200);
}
function closeEmpModal() {
  hideModal("#empModal");
  cancelEmpEdit();
}
function startEmpEdit(id) {
  if (!can("write")) return alertDialog("Not allowed", "You need the 'Write' access right to edit employees.", "warn");
  openEmpModal("edit", id);
}
$("#empCancel").addEventListener("click", closeEmpModal);
// typing/clearing the username changes whether a password is required
$("#empUsername").addEventListener("input", function () { validateField("employeeForm", "empPortalPassword"); });
$("#empUsername").addEventListener("change", function () { validateField("employeeForm", "empPortalPassword"); });
$("#empModalX").addEventListener("click", closeEmpModal);
$("#empPhone").addEventListener("input", function () { this.value = this.value.replace(/\D/g, "").replace(/^0+(?=9)/, "").slice(0, 10); });

// Search + department filter
$("#globalSearch").addEventListener("input", function () {
  searchTerm = this.value;
  if (searchTerm.trim()) go("employees");
  renderEmployees();
});
$("#posFilter").addEventListener("change", function () {
  posFilter = this.value;
  renderEmployees();
});

// FAB + Add Employee button: open the registration window
function focusAddEmployee() {
  go("employees");
  openEmpModal("add");
}
$("#fabAdd").addEventListener("click", focusAddEmployee);
document.querySelectorAll("[data-focus-add]").forEach(function (b) {
  b.addEventListener("click", focusAddEmployee);
});

// ================= MODULE 3: ATTENDANCE =================
function statusMsg(text) {
  $("#attStatus").textContent = text;
  setTimeout(function () { $("#attStatus").textContent = ""; }, 4000);
}

function renderAttendance() {
  const today = todayISO();
  const rows = attendance.filter(function (a) { return a.date === today; });
  $("#attendanceTable").innerHTML = rows.length
    ? rows.map(function (a) {
        const emp = getEmp(a.empId);
        const hrs = a.timeOut ? (Math.abs(new Date(a.timeOut) - new Date(a.timeIn)) / 3600000).toFixed(2) : "—";
        return '<tr><td>' + (emp ? emp.fullName : "—") + '</td>' +
          '<td>' + fmtTime(a.timeIn) + '</td>' +
          '<td>' + (a.timeOut ? fmtTime(a.timeOut) : "—") + '</td>' +
          '<td><span class="badge ' + (a.lateMin > 0 ? "badge-late" : "badge-ontime") + '">' +
          (a.lateMin > 0 ? "Late " + a.lateMin + " min" : "On time") + '</span></td>' +
          '<td class="text-right">' + (hrs === "—" ? "—" : hrs + " hrs") + '</td></tr>';
      }).join("")
    : '<tr><td colspan="5" class="empty">No time-in records for today yet.</td></tr>';
  populateEmployeeOptions();
}

$("#btnTimeIn").addEventListener("click", function () {
  const empId = $("#attEmp").value;
  if (!empId) return alertDialog("No employee selected", "Please add and select an employee first.");
  const today = todayISO();
  if (attendance.some(function (a) { return a.empId === empId && a.date === today; }))
    return alertDialog("Already timed in", "This employee has already timed in today.", "warn");
  const now = new Date();
  const minutes = now.getHours() * 60 + now.getMinutes();
  const lateMin = Math.max(0, minutes - (8 * 60)); // schedule starts 8:00 AM
  attendance.push({ empId: empId, date: today, timeIn: now.toISOString(), timeOut: null, lateMin: lateMin });
  saveAll();
  renderAttendance(); renderDashboard();
  logActivity("Time in: " + getEmp(empId).fullName + (lateMin ? " (late " + lateMin + " min)" : ""));
  statusMsg("Time in recorded at " + fmtTime(now) + (lateMin ? " — marked late (" + lateMin + " min)" : " — on time") + ".");
});

$("#btnTimeOut").addEventListener("click", function () {
  const empId = $("#attEmp").value;
  if (!empId) return alertDialog("No employee selected", "Please select an employee first.");
  const today = todayISO();
  const rec = attendance.find(function (a) { return a.empId === empId && a.date === today; });
  if (!rec) return alertDialog("No time-in record", "This employee has no time-in record for today.");
  if (rec.timeOut) return alertDialog("Already timed out", "This employee has already timed out today.", "warn");
  rec.timeOut = new Date().toISOString();
  saveAll();
  renderAttendance(); renderDashboard();
  logActivity("Time out: " + getEmp(empId).fullName);
  statusMsg("Time out recorded at " + fmtTime(rec.timeOut) + ".");
});

// ================= MODULE 4: CASH ADVANCE =================
function renderCashAdvances() {
  $("#caTable").innerHTML = cashAdvances.length
    ? cashAdvances.slice().reverse().map(function (c) {
        const emp = getEmp(c.empId);
        return '<tr><td><strong>CA-' + String(c.id).padStart(4, "0") + '</strong></td>' +
          '<td>' + c.date + '</td><td>' + (emp ? emp.fullName : "—") + '</td>' +
          '<td class="text-right">' + money(c.amount) + '</td>' +
          '<td>' + (c.notes || "—") + '</td>' +
          '<td><span class="badge badge-pending">For deduction</span></td></tr>';
      }).join("")
    : '<tr><td colspan="6" class="empty">No cash advances recorded yet.</td></tr>';
  populateEmployeeOptions();
}

$("#caForm").addEventListener("submit", function (e) {
  e.preventDefault();
  const empId = $("#caEmp").value;
  const amount = parseFloat($("#caAmount").value);
  const date = $("#caDate").value;
  const notes = $("#caNotes").value.trim();
  if (!empId || !(amount > 0) || !date) return;
  const id = cashAdvances.length ? Math.max.apply(null, cashAdvances.map(function (c) { return c.id; })) + 1 : 1;
  cashAdvances.push({ id: id, empId: empId, amount: amount, date: date, notes: notes });
  logActivity("Recorded cash advance CA-" + String(id).padStart(4, "0") + " of " + money(amount) + " for " + getEmp(empId).fullName);
  saveAll();
  renderCashAdvances(); renderDashboard();
  e.target.reset();
  $("#caDate").value = todayISO();
});

// ================= MODULE 5: PAYROLL PROCESSING =================
function computePayrollRows(from, to) {
  return employees.map(function (emp) {
    const days = attendance.filter(function (a) {
      return a.empId === emp.id && a.date >= from && a.date <= to && a.timeIn;
    });
    const daysPresent = days.length;
    const lateMin = days.reduce(function (s, a) { return s + (a.lateMin || 0); }, 0);
    const gross = daysPresent * emp.dailyRate;
    const lateDed = lateMin * (emp.dailyRate / 480); // rate per working minute (8 hrs)
    const caDed = cashAdvances
      .filter(function (c) { return c.empId === emp.id && c.date >= from && c.date <= to; })
      .reduce(function (s, c) { return s + c.amount; }, 0);
    return { emp: emp, daysPresent: daysPresent, lateMin: lateMin, gross: gross, lateDed: lateDed, caDed: caDed, net: gross - lateDed - caDed };
  });
}

function renderPayroll() {
  const rows = computePayrollRows($("#payFrom").value, $("#payTo").value);
  $("#payrollBody").innerHTML = rows.length
    ? rows.map(function (r) {
        return '<tr><td><strong>' + r.emp.fullName + '</strong></td>' +
          '<td>' + r.emp.position + '</td>' +
          '<td class="text-right">' + r.daysPresent + '</td>' +
          '<td class="text-right">' + r.lateMin + '</td>' +
          '<td class="text-right">' + money(r.gross) + '</td>' +
          '<td class="text-right">' + money(r.lateDed) + '</td>' +
          '<td class="text-right">' + money(r.caDed) + '</td>' +
          '<td class="text-right"><strong>' + money(r.net) + '</strong></td></tr>';
      }).join("")
    : '<tr><td colspan="8" class="empty">No employees yet.</td></tr>';

  const totals = rows.reduce(function (t, r) {
    return { gross: t.gross + r.gross, late: t.late + r.lateDed, ca: t.ca + r.caDed, net: t.net + r.net };
  }, { gross: 0, late: 0, ca: 0, net: 0 });

  $("#payrollFoot").innerHTML =
    '<tr><td colspan="4">TOTALS — ' + employees.length + ' employees</td>' +
    '<td class="text-right">' + money(totals.gross) + '</td>' +
    '<td class="text-right">' + money(totals.late) + '</td>' +
    '<td class="text-right">' + money(totals.ca) + '</td>' +
    '<td class="text-right">' + money(totals.net) + '</td></tr>';
}

$("#btnGeneratePayroll").addEventListener("click", function () {
  renderPayroll();
  logActivity("Generated payroll for " + $("#payFrom").value + " to " + $("#payTo").value);
});
$("#btnPrintPayroll").addEventListener("click", function () { renderPayroll(); window.print(); });

// ================= MODULE 6: REPORTS =================
function renderReport() {
  const from = $("#repFrom").value, to = $("#repTo").value;
  const rows = employees.map(function (emp) {
    const days = attendance.filter(function (a) {
      return a.empId === emp.id && a.date >= from && a.date <= to && a.timeIn;
    });
    const hoursWorked = days.reduce(function (s, a) {
      if (!a.timeOut) return s;
      return s + Math.abs(new Date(a.timeOut) - new Date(a.timeIn)) / 3600000;
    }, 0);
    const lateMin = days.reduce(function (s, a) { return s + (a.lateMin || 0); }, 0);
    const ca = cashAdvances
      .filter(function (c) { return c.empId === emp.id && c.date >= from && c.date <= to; })
      .reduce(function (s, c) { return s + c.amount; }, 0);
    return {
      name: emp.fullName,
      present: days.length,
      daysLate: days.filter(function (a) { return a.lateMin > 0; }).length,
      lateMin: lateMin,
      hours: hoursWorked,
      ca: ca
    };
  });

  $("#reportBody").innerHTML = rows.length
    ? rows.map(function (r) {
        return '<tr><td><strong>' + r.name + '</strong></td>' +
          '<td class="text-right">' + r.present + '</td>' +
          '<td class="text-right">' + r.daysLate + '</td>' +
          '<td class="text-right">' + r.lateMin + '</td>' +
          '<td class="text-right">' + r.hours.toFixed(2) + '</td>' +
          '<td class="text-right">' + money(r.ca) + '</td></tr>';
      }).join("")
    : '<tr><td colspan="6" class="empty">No employees yet.</td></tr>';
}

$("#btnGenerateReport").addEventListener("click", renderReport);
$("#btnPrintReport").addEventListener("click", function () { renderReport(); window.print(); });

// ---------------- Init ----------------
if (!employees || !attendance || !cashAdvances) seedSampleData();
{
  // Backfill newer fields (department, date hired, Gmail, contact no.) for any records
  employees.forEach(function (e, i) {
    if (!e.dateHired) e.dateHired = todayISO();
    if (!e.email) e.email = e.fullName.toLowerCase().replace(/[^a-z]/g, "") + ".joecon@gmail.com";
    if (!e.phone) e.phone = "0917" + String(1000000 + parseInt(e.id.split("-")[1]) * 111111).slice(-7);
  });
  saveAll();
}

const now = new Date();
const firstOfMonth = now.getFullYear() + "-" + String(now.getMonth() + 1).padStart(2, "0") + "-01";
$("#attDateLabel").textContent = longDate(now);
$("#payFrom").value = $("#repFrom").value = firstOfMonth;
$("#payTo").value = $("#repTo").value = todayISO();
$("#caDate").value = todayISO();
$("#empHired").value = todayISO();

renderDashboard();
renderEmployees();
renderAttendance();
renderCashAdvances();
renderPayroll();
renderReport();
populateEmployeeOptions();

/* ================================================================
   AUTHENTICATION & USER MANAGEMENT  (Forms 1, 2, 3)
   ================================================================ */

let users = store.get("jems2_users", null);
let currentUser = null;

function defaultUsers() {
  return [
    { id: "USR-001", fullName: "System Administrator", username: "admin",       email: "joeconsteelworks@gmail.com", department: "Admin / HR",
      password: "admin123", status: "Active", rights: ["read", "write", "execute", "admin"], expiry: "" }
  ];
}
function saveUsers() { store.set("jems2_users", users); }

const ACCESS_LABELS = { read: "Read", write: "Write", execute: "Execute", admin: "Admin" };

function can(perm) {
  if (!currentUser) return false;
  return currentUser.rights.indexOf(perm) !== -1;
}
function isExpired(u) {
  return u.expiry && u.expiry < todayISO();
}

// ---------------- Login screen / app gate ----------------
function showLogin() {
  $("#loginScreen").classList.add("open");
  $("#loginError").classList.remove("show");
}
function showApp() {
  $("#loginScreen").classList.remove("open");
  populateUserMenu();
  applyPermissions();
}

function setLoginError(msg) {
  const el = $("#loginError");
  el.textContent = msg;
  el.classList.toggle("show", !!msg);
}

$("#loginForm").addEventListener("submit", function (e) {
  e.preventDefault();
  const id = $("#loginUser").value.trim().toLowerCase();
  const pass = $("#loginPass").value;
  const u = users.find(function (x) {
    return x.username.toLowerCase() === id || x.email.toLowerCase() === id;
  });
  if (!u || u.password !== pass) {
    logActivity("Failed sign-in attempt for \"" + id + "\"");
    return setLoginError("Invalid username/email or password.");
  }
  if (u.status === "Pending")  return setLoginError("Your account is waiting for administrator approval. Please try again later.");
  if (u.status !== "Active")   return setLoginError("This account is Inactive. Contact the administrator.");
  if (isExpired(u))            return setLoginError("This account has expired on " + fmtDate(u.expiry) + ".");

  currentUser = u;
  logActivity("Signed in");
  store.set("jems2_session", { id: u.id });
  try {
    if ($("#rememberMe").checked) localStorage.setItem("jems2_remember", u.id);
    else localStorage.removeItem("jems2_remember");
  } catch (err) {}
  $("#loginPass").value = "";
  setLoginError("");
  showApp();
});

// Show/Hide password toggles
document.querySelectorAll(".pw-toggle").forEach(function (btn) {
  btn.addEventListener("click", function () {
    const targetId = btn.dataset.toggle;
    const input = targetId ? document.getElementById(targetId)
                           : btn.closest(".pw-wrap").querySelector("input");
    if (!input) return;
    const show = input.type === "password";
    input.type = show ? "text" : "password";
    btn.textContent = show ? "Hide" : "Show";
  });
});

// ---------------- Top-bar user menu & logout ----------------
function populateUserMenu() {
  if (!currentUser) return;
  $("#umName").textContent = currentUser.username;
  $("#umSub").textContent = currentUser.department + " · " + currentUser.email;
  $("#umBadges").innerHTML = currentUser.rights.map(function (r) {
    return '<span class="perm-badge ' + r + '">' + ACCESS_LABELS[r] + '</span>';
  }).join("");
  $("#topAvatar").textContent = initials(currentUser.username.replace(/[._-]/g, " ")) || "U";
}

$("#userMenuBtn").addEventListener("click", function (e) {
  e.stopPropagation();
  $("#userMenu").classList.toggle("open");
});
$("#btnLogout").addEventListener("click", function () {
  logActivity("Signed out");
  currentUser = null;
  store.set("jems2_session", null);
  $("#userMenu").classList.remove("open");
  showLogin();
});
document.addEventListener("click", function (e) {
  if (!e.target.closest(".usermenu-wrap")) $("#userMenu").classList.remove("open");
});

// ---------------- Permission gating ----------------
function applyPermissions() {
  // admin-only nav items
  document.querySelectorAll("[data-admin-only]").forEach(function (el) {
    el.style.display = can("admin") ? "" : "none";
  });

  // buttons that require a specific right
  document.querySelectorAll("[data-need]").forEach(function (btn) {
    const ok = can(btn.dataset.need);
    btn.disabled = !ok;
    if (!ok) btn.title = "Requires '" + ACCESS_LABELS[btn.dataset.need] + "' access right";
    else btn.removeAttribute("title");
  });

  const missing = [];
  if (!can("write"))   missing.push("add records (Write)");
  if (!can("execute")) missing.push("time-in/out & payroll (Execute)");
  const banner = $("#permBanner");
  if (missing.length) {
    banner.hidden = false;
    banner.textContent = "Signed in as " + currentUser.username + ". Read-only access — you cannot " + missing.join(" or ") + ".";
  } else {
    banner.hidden = true;
  }
}

// ---------------- Auth init ----------------
(function initAuth() {
  if (!users || !users.length) {
    users = defaultUsers();
  }
  users.forEach(function (u) {                 // migrate older records
    if (u.email === "admin@joecon.com") u.email = "joeconsteelworks@gmail.com";
    u.username = u.username.toLowerCase();
    u.email = u.email.toLowerCase();
  });
  saveUsers();

  // restore session (Remember me keeps the same session id)
  const session = store.get("jems2_session", null);
  if (session && session.id) {
    const u = users.find(function (x) { return x.id === session.id; });
    if (u && u.status === "Active" && !isExpired(u)) {
      currentUser = u;
      showApp();
      return;
    }
  }
  showLogin();
})();


/* ================================================================
   TASK 6 — CLIENT-SIDE DATA INPUT VALIDATION
   Runs BEFORE each form's save handler (capture phase). If any field
   is invalid, the submission is blocked and errors are shown.
   ================================================================ */

const EMAIL_RE    = /^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/;
const NAME_RE     = /^[A-Za-zÑñ .'-]+$/;
const USERNAME_RE = /^[a-z0-9._]+$/;
const PHONE_RE    = /^09\d{9}$/;

function val(id) { const el = document.getElementById(id); return el ? el.value.trim() : ""; }

/* Strict Gmail check — shared by Register and Add User forms.
   Rules follow Google's own Gmail username requirements. */
const GMAIL_TYPOS = ["gmial.com","gmai.com","gmal.com","gamil.com","gnail.com","gmaill.com","gmail.co","gmail.con","gmail.cm","gmail.om","gmail.comm","gmail.net","gmail.org","gmail.ph","gmail.com.ph","googlemail.com"];
function checkGmailFormat(v) {
  if (!v) return "Email address is required.";
  if (/\s/.test(v)) return "Email address must not contain spaces.";
  if (/[A-Z]/.test(v)) return "Capital letters are not allowed. Use lowercase only (e.g. juandelacruz@gmail.com).";
  if ((v.match(/@/g) || []).length > 1) return "An email address can only have one @ symbol.";
  if (v.indexOf("@") === -1) return "Missing @gmail.com. Example: juandelacruz@gmail.com";
  if (/\+/.test(v)) return "Plus (+) aliases are not allowed. Use your main Gmail address.";
  if (/@.+\.gmail\.com$/.test(v)) return "Subdomains are not allowed. The address must end exactly in @gmail.com";
  if (/@gmail\.com.+$/.test(v)) return "Nothing may come after @gmail.com.";
  const parts = v.split("@");
  if (parts.length !== 2 || !parts[0] || !parts[1]) return "Enter a complete Gmail address, e.g. juandelacruz@gmail.com";
  const name = parts[0], domain = parts[1].toLowerCase();
  if (domain !== "gmail.com") {
    if (GMAIL_TYPOS.indexOf(domain) !== -1) return "Did you mean @gmail.com? \"@" + parts[1] + "\" is not a valid Gmail domain.";
    return "Only Gmail addresses are accepted. The address must end in @gmail.com";
  }
  if (!/^[a-z0-9.]+$/.test(name)) return "Gmail usernames may only contain lowercase letters, numbers and periods (no _ - + or symbols).";
  if (name.replace(/\./g, "").length < 6) return "The Gmail username must have at least 6 letters or numbers.";
  if (name.length > 30) return "The Gmail username must be 30 characters or less.";
  if (/^\./.test(name) || /\.$/.test(name)) return "The Gmail username cannot start or end with a period.";
  if (/\.\./.test(name)) return "The Gmail username cannot have two periods in a row.";
  if (/^[0-9.]+$/.test(name)) return "The Gmail username cannot be numbers only; it must include letters.";
  return "";
}
// Gmail ignores dots, so juan.cruz@gmail.com and juancruz@gmail.com are the same inbox
function gmailKey(e) { e = (e || "").toLowerCase(); return e.split("@")[0].replace(/\./g, "") + "@" + e.split("@")[1]; }
function checkGmail(v, list, selfId) {
  const fmt = checkGmailFormat(v);
  if (fmt) return fmt;
  list = list || users;
  if (list.some(function (r) { return r.id !== selfId && gmailKey(r.email) === gmailKey(v); }))
    return "This Gmail address is already registered.";
  return "";
}

// Each rule returns an error message ("" = valid)
const RULES = {
  loginForm: {
    loginUser: function (v) {
      if (!v) return "Username or email is required.";
      if (v.indexOf("@") !== -1) { const g = checkGmailFormat(v); if (g) return g; }
      if (v.length < 3) return "Username must be at least 3 characters.";
      return "";
    },
    loginPass: function (v) { return v ? "" : "Password must not be blank."; }
  },

  registerForm: {
    regFirst: function (v) {
      if (!v) return "First name is required.";
      if (v.length < 2) return "First name must be at least 2 characters.";
      if (!NAME_RE.test(v)) return "Use letters, spaces, periods, hyphens or apostrophes only.";
      return "";
    },
    regLast: function (v) {
      if (!v) return "Last name is required.";
      if (v.length < 2) return "Last name must be at least 2 characters.";
      if (!NAME_RE.test(v)) return "Use letters, spaces, periods, hyphens or apostrophes only.";
      return "";
    },
    regMiddle: function (v) {
      if (v && !NAME_RE.test(v)) return "Use letters, spaces, periods, hyphens or apostrophes only.";
      return "";
    },
    regGender: function (v) { return v ? "" : "Please select a gender."; },
    regBday: function (v) {
      if (!v) return "Birthday is required.";
      if (v > todayISO()) return "Birthday cannot be in the future.";
      if (v < "1940-01-01") return "Please enter a valid birthday.";
      const age = (Date.now() - new Date(v + "T00:00:00").getTime()) / 31557600000;
      if (age < 18) return "Employees must be at least 18 years old.";
      if (age > 75) return "Please double-check the birthday entered.";
      return "";
    },
    regPhone: function (v) {
      if (!v) return "Phone number is required.";
      if (!/^9\d{9}$/.test(v)) return "Enter 10 digits starting with 9 (e.g. 9175550182) \u2014 +63 is already prefixed.";
      if (employees.some(function (x) { return x.phone === "0" + v; })) return "This contact number is already registered.";
      return "";
    },
    regCountry: function (v) { return v ? "" : "Please select your country."; },
    regRegion: function (v) { return v ? "" : "Please select your region / state."; },
    regCity: function (v) { return v ? "" : "Please select your city / municipality."; },
    regBarangay: function (v) {
      if (!v) return "Barangay is required.";
      if (v.length < 2) return "Barangay must be at least 2 characters.";
      return "";
    },
    regStreet: function (v) {
      if (!v) return "Street / house no. is required.";
      if (v.length < 5) return "Please enter a more complete street address.";
      return "";
    },
    regPostal: function (v) {
      if (!v) return "Postal code is required.";
      if (!/^\d{4}$/.test(v)) return "Postal code must be 4 digits (e.g. 9506).";
      return "";
    },
    regPosition: function (v) { return v ? "" : "Please select your position / job title."; },
    regEmail: function (v) { return checkGmail(v) || checkGmail(v, employees); },
    regUsername: function (v) {
      if (!v) return "Username is required.";
      if (v.length < 4 || v.length > 20) return "Username must be 4\u201320 characters long.";
      if (/[A-Z]/.test(v)) return "Capital letters are not allowed. Use lowercase only (e.g. j.delacruz).";
      if (!USERNAME_RE.test(v)) return "Use only lowercase letters, numbers, dots (.) or underscores (_). No spaces.";
      if (users.some(function (u) { return u.username.toLowerCase() === v.toLowerCase(); })) return "This username is already taken. Choose another.";
      return "";
    },
    regPassword: function (v) {
      if (!v) return "Password is required.";
      if (v.length < 8) return "Password must contain at least 8 characters (" + v.length + "/8).";
      if (!/[A-Za-z]/.test(v) || !/\d/.test(v)) return "Password must include at least one letter and one number.";
      return "";
    },
    regConfirm: function (v) {
      if (!v) return "Please confirm your password.";
      if (v !== $("#regPassword").value) return "Passwords do not match.";
      return "";
    },
    regTerms: function () {
      return $("#regTerms").checked ? "" : "Please tick the box to confirm your details.";
    }
  },

  employeeForm: {
    empFirst: function (v) {
      if (!v) return "First name is required.";
      if (v.length < 2) return "First name must be at least 2 characters.";
      if (!NAME_RE.test(v)) return "Use letters, spaces, periods, hyphens or apostrophes only.";
      return "";
    },
    empLast: function (v) {
      if (!v) return "Last name is required.";
      if (v.length < 2) return "Last name must be at least 2 characters.";
      if (!NAME_RE.test(v)) return "Use letters, spaces, periods, hyphens or apostrophes only.";
      return "";
    },
    empMiddle: function (v) {
      if (v && !NAME_RE.test(v)) return "Use letters, spaces, periods, hyphens or apostrophes only.";
      return "";
    },
    empGender: function (v) { return v ? "" : "Please select a gender."; },
    empBday: function (v) {
      if (!v) return "Birthday is required.";
      if (v > todayISO()) return "Birthday cannot be in the future.";
      if (v < "1940-01-01") return "Please enter a valid birthday.";
      const age = (Date.now() - new Date(v + "T00:00:00").getTime()) / 31557600000;
      if (age < 18) return "Employees must be at least 18 years old.";
      if (age > 75) return "Please double-check the birthday entered.";
      return "";
    },
    empPhone: function (v) {
      if (!v) return "Phone number is required.";
      if (!/^9\d{9}$/.test(v)) return "Enter 10 digits starting with 9 (e.g. 9175550182) \u2014 +63 is already prefixed.";
      if (employees.some(function (x) { return x.id !== editingEmpId && x.phone === "0" + v; })) return "This contact number is already used by another employee.";
      return "";
    },
    empCountry: function (v) { return v ? "" : "Please select a country."; },
    empRegion: function (v) { return v ? "" : "Please select a region / state."; },
    empCity: function (v) { return v ? "" : "Please select a city / municipality."; },
    empBarangay: function (v) {
      if (!v) return "Barangay is required.";
      if (v.length < 2) return "Barangay must be at least 2 characters.";
      return "";
    },
    empStreet: function (v) {
      if (!v) return "Street / house no. is required.";
      if (v.length < 5) return "Please enter a more complete street address.";
      return "";
    },
    empPostal: function (v) {
      if (!v) return "Postal code is required.";
      if (!/^\d{4}$/.test(v)) return "Postal code must be 4 digits (e.g. 9506).";
      return "";
    },
    empPosition: function (v) { return v ? "" : "Please select a position."; },
    empRate: function (v) {
      if (!v) return "Daily rate is required.";
      const n = Number(v);
      if (isNaN(n)) return "Daily rate must be a number.";
      if (n < 300 || n > 5000) return "Daily rate must be between \u20b1300 and \u20b15,000.";
      return "";
    },
    empHired: function (v) {
      if (!v) return "Date hired is required.";
      if (v > todayISO()) return "Date hired cannot be a future date.";
      if (v < "1990-01-01") return "Date hired must be on or after Jan 1, 1990.";
      return "";
    },
    empEmail: function (v) { return checkGmail(v, employees, editingEmpId); },
    empUsername: function (v) {
      if (!v) return "";                              // optional: no login for this employee
      if (v.length < 4 || v.length > 20) return "Username must be 4\u201320 characters long.";
      if (/[A-Z]/.test(v)) return "Capital letters are not allowed. Use lowercase only (e.g. b.magbanua).";
      if (!USERNAME_RE.test(v)) return "Use only lowercase letters, numbers, dots (.) or underscores (_). No spaces.";
      const linked = editingEmpId ? users.find(function (u) { return u.empId === editingEmpId; }) : null;
      if (users.some(function (u) { return u.username.toLowerCase() === v.toLowerCase() && (!linked || u.id !== linked.id); }))
        return "This username is already taken. Choose another.";
      return "";
    },
    empPortalPassword: function (v) {
      const linked = editingEmpId ? users.find(function (u) { return u.empId === editingEmpId; }) : null;
      const wantsLogin = ($("#empUsername") ? $("#empUsername").value : "").trim() !== "";
      if (!wantsLogin) return v ? "Add a username above, or leave the password blank." : "";
      if (!v) return linked ? "" : "Password is required to create the portal login.";
      if (v.length < 8) return "Password must contain at least 8 characters (" + v.length + "/8).";
      if (!/[A-Za-z]/.test(v) || !/\d/.test(v)) return "Password must include at least one letter and one number.";
      return "";
    }
  },

  cpForm: {
    cpCurrent: function (v) {
      if (!v) return "Enter your current password.";
      if (currentUser && v !== currentUser.password) return "Current password is incorrect.";
      return "";
    },
    cpNew: function (v) {
      if (!v) return "Enter a new password.";
      if (v.length < 8) return "Password must contain at least 8 characters (" + v.length + "/8).";
      if (!/[A-Za-z]/.test(v) || !/\d/.test(v)) return "Password must include at least one letter and one number.";
      if (currentUser && v === currentUser.password) return "New password must be different from the current one.";
      return "";
    },
    cpConfirm: function (v) {
      if (!v) return "Please confirm your new password.";
      if (v !== document.getElementById("cpNew").value) return "Passwords do not match.";
      return "";
    }
  },

  caForm: {
    caEmp: function (v) { return v ? "" : "Select an employee."; },
    caAmount: function (v) {
      if (!v) return "Amount is required.";
      const n = Number(v);
      if (isNaN(n) || n <= 0) return "Amount must be a positive number.";
      if (n < 100) return "Minimum cash advance is ₱100.";
      if (n > 50000) return "Maximum cash advance is ₱50,000.";
      return "";
    },
    caDate: function (v) {
      if (!v) return "Date is required.";
      if (v > todayISO()) return "Cash advance date cannot be in the future.";
      return "";
    },
    caNotes: function (v) { return v.length > 100 ? "Notes must be 100 characters or less." : ""; }
  }
};

// Where to place the message / which element to highlight
function fieldTarget(id) {
  if (id === "regTerms") return document.getElementById("regTerms").closest(".remember");
  const el = document.getElementById(id);
  if (!el) return null;
  return el.closest(".pw-wrap") || el.closest(".phone-group") || el;
}

function showFieldState(id, msg) {
  const target = fieldTarget(id);
  if (!target) return;
  const input = (id === "regTerms") ? target : document.getElementById(id);
  let err = target.parentNode.querySelector('.field-error[data-for="' + id + '"]');
  if (!err) {
    err = document.createElement("small");
    err.className = "field-error";
    err.dataset.for = id;
    target.insertAdjacentElement("afterend", err);
  }
  err.textContent = msg;
  input.classList.toggle("is-invalid", !!msg);
  input.classList.toggle("is-valid", !msg);
  if (input.setAttribute) input.setAttribute("aria-invalid", msg ? "true" : "false");
}

function validateField(formId, id) {
  const rule = RULES[formId][id];
  const msg = rule(val(id));
  showFieldState(id, msg);
  return !msg;
}

function validateForm(form) {
  const rules = RULES[form.id];
  if (!rules) return true;
  let firstBad = null;
  Object.keys(rules).forEach(function (id) {
    if (!validateField(form.id, id) && !firstBad) firstBad = id;
  });
  if (firstBad) {
    const el = document.getElementById(firstBad);
    if (el) el.focus();
  }
  return !firstBad;
}

function clearValidation(form) {
  form.querySelectorAll(".is-invalid, .is-valid").forEach(function (el) { el.classList.remove("is-invalid", "is-valid"); });
  form.querySelectorAll(".field-error").forEach(function (el) { el.textContent = ""; });
  const sum = form.querySelector(".form-summary");
  if (sum) sum.remove();
}

function showSummary(form, ok) {
  let sum = form.querySelector(".form-summary");
  if (!sum) {
    sum = document.createElement("div");
    sum.className = "form-summary";
    form.insertBefore(sum, form.firstChild);
  }
  const count = form.querySelectorAll(".is-invalid").length;
  sum.className = "form-summary " + (ok ? "ok" : "err");
  sum.textContent = ok
    ? "All fields are valid. Record saved successfully."
    : "Please correct the " + count + " highlighted field" + (count > 1 ? "s" : "") + " below before submitting.";
  if (ok) setTimeout(function () { if (sum.parentNode) sum.remove(); }, 3000);
}

// 1) Block submission when invalid (capture phase = runs before save handlers)
document.addEventListener("submit", function (e) {
  const form = e.target;
  if (!RULES[form.id]) return;
  if (!validateForm(form)) {
    e.preventDefault();
    e.stopPropagation();          // save handler never runs
    showSummary(form, false);
    if (form.id === "loginForm") setLoginError("Please fill in the required fields correctly.");
  } else if (form.id !== "loginForm" && form.id !== "msgForm") {
    // let save handler run, then confirm success
    setTimeout(function () {
      const hadError = form.parentNode.querySelector(".form-msg.err") && form.parentNode.querySelector(".form-msg.err").textContent;
      if (!hadError) { clearValidation(form); showSummary(form, true); }
    }, 0);
  }
}, true);

// 2) Live feedback: validate on blur, re-check while typing once a field was flagged
Object.keys(RULES).forEach(function (formId) {
  Object.keys(RULES[formId]).forEach(function (id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener("blur", function () { if (el.value !== "" || el.classList.contains("is-invalid")) validateField(formId, id); });
    el.addEventListener("input", function () { if (el.classList.contains("is-invalid") || el.classList.contains("is-valid")) validateField(formId, id); });
    el.addEventListener("change", function () { if (el.tagName === "SELECT" || el.type === "date") validateField(formId, id); });
  });
});

// 3) Input constraints that depend on today's date
$("#empHired").max = todayISO();
$("#caDate").max = todayISO();

// Pre-create empty message slots so the layout doesn't shift when an error appears
Object.keys(RULES).forEach(function (formId) {
  Object.keys(RULES[formId]).forEach(function (id) {
    const t = fieldTarget(id);
    if (t && !t.parentNode.querySelector('.field-error[data-for="' + id + '"]')) {
      const s = document.createElement("small");
      s.className = "field-error"; s.dataset.for = id;
      t.insertAdjacentElement("afterend", s);
    }
  });
});



/* ================================================================
   EMPLOYEE SELF-REGISTRATION  (opened from the login screen)
   Creates BOTH the employee record and their My Portal login.
   Employees sign in with rights ["read"] and see only My Portal.
   ================================================================ */
function openRegModal() {
  $("#registerForm").reset();
  clearValidation($("#registerForm"));
  $("#regPwBar").style.width = "0";
  $("#regPwBar").className = "";
  resetRegCascade();
  $("#regCountry").value = "";
  $("#regBday").max = todayISO();
  showModal("#regModal");
  setTimeout(function () { $("#regFirst").focus(); }, 200);
}
function closeRegModal() { hideModal("#regModal"); }
$("#showRegister").addEventListener("click", function (e) { e.preventDefault(); openRegModal(); });
$("#regToLogin").addEventListener("click", function (e) { e.preventDefault(); closeRegModal(); });
$("#regCancel").addEventListener("click", closeRegModal);
$("#regModalX").addEventListener("click", closeRegModal);

// +63 phone box
$("#regPhone").addEventListener("input", function () {
  this.value = this.value.replace(/\D/g, "").replace(/^0+(?=9)/, "").slice(0, 10);
});

/* ---- address cascade: Country -> Region -> City/Municipality -> Barangay + postal ---- */
function resetRegCityLevel() {
  const city = $("#regCity"), bgy = $("#regBarangay");
  fillSelect(city, [], "Select a region first"); city.disabled = true;
  bgy.value = ""; bgy.disabled = true; bgy.placeholder = "Select a city first";
  $("#regPostal").value = "";
}
function resetRegCascade() {
  const region = $("#regRegion");
  fillSelect(region, [], "Select a country first"); region.disabled = true;
  resetRegCityLevel();
}
$("#regCountry").addEventListener("change", function () {
  const region = $("#regRegion");
  if (this.value === "Philippines") {
    fillSelect(region, Object.keys(PH_ADDRESS), "Select a region / state");
    region.disabled = false;
  } else {
    resetRegCascade();
  }
  resetRegCityLevel();
});
$("#regRegion").addEventListener("change", function () {
  const city = $("#regCity"), bgy = $("#regBarangay");
  fillSelect(city, Object.keys(PH_ADDRESS[this.value] || {}), "Select a city / municipality");
  city.disabled = false;
  bgy.value = ""; bgy.disabled = true; bgy.placeholder = "Select a city first";
  $("#regPostal").value = "";
});
$("#regCity").addEventListener("change", function () {
  const bgy = $("#regBarangay");
  bgy.disabled = false;
  bgy.placeholder = "e.g. Barangay 8, Purok 2";
  $("#regPostal").value = (PH_ADDRESS[$("#regRegion").value] || {})[this.value] || "";
});

// password strength meter + live re-check of the confirmation
$("#regPassword").addEventListener("input", function () {
  const v = this.value; let score = 0;
  if (v.length >= 8) score++;
  if (/[A-Za-z]/.test(v) && /\d/.test(v)) score++;
  if (/[A-Z]/.test(v) && /[a-z]/.test(v)) score++;
  if (/[^A-Za-z0-9]/.test(v) || v.length >= 12) score++;
  const bar = $("#regPwBar");
  bar.style.width = (v ? score * 25 : 0) + "%";
  bar.className = ["", "weak", "fair", "good", "strong"][score];
  if ($("#regConfirm").value) validateField("registerForm", "regConfirm");
});
$("#regTerms").addEventListener("change", function () { validateField("registerForm", "regTerms"); });

// ---- submit: create the employee record + their portal login ----
$("#registerForm").addEventListener("submit", function (e) {
  e.preventDefault();                          // only reached when validation passed
  const first = val("regFirst"), middle = val("regMiddle"), last = val("regLast");
  const fullName = (first + " " + (middle ? middle + " " : "") + last).replace(/\s+/g, " ").trim();
  const position = $("#regPosition").value;
  const username = val("regUsername").toLowerCase();

  // 1) the employee record
  const empNum = employees.length ? Math.max.apply(null, employees.map(function (x) { return parseInt(x.id.split("-")[1]); })) + 1 : 1;
  const emp = {
    id: "EMP-" + String(empNum).padStart(3, "0"),
    fullName: fullName,
    firstName: first, middleName: middle, lastName: last,
    gender: $("#regGender").value,
    birthday: $("#regBday").value,
    address: {
      street: val("regStreet"),
      barangay: val("regBarangay"),
      city: $("#regCity").value,
      region: $("#regRegion").value,
      postal: val("regPostal"),
      country: $("#regCountry").value
    },
    position: position,
    dailyRate: DEFAULT_RATES[position] || 500,   // admin can adjust later in Edit Details
    dateHired: todayISO(),
    email: val("regEmail"),
    phone: "0" + val("regPhone")                 // stored as 09xxxxxxxxx
  };
  employees.push(emp);
  saveAll();

  // 2) their My Portal login
  const num = users.length ? Math.max.apply(null, users.map(function (u) { return parseInt(u.id.split("-")[1]); })) + 1 : 1;
  users.push({
    id: "USR-" + String(num).padStart(3, "0"),
    fullName: fullName,
    username: username,
    email: emp.email,
    phone: emp.phone,
    password: $("#regPassword").value,
    status: "Active",
    rights: ["read"],                          // portal-only access
    expiry: "",
    empId: emp.id
  });
  saveUsers();
  logActivity("New employee registered: " + emp.id + " " + fullName + " (" + position + ") as " + username);

  renderEmployees(); renderDashboard(); populateEmployeeOptions();
  closeRegModal();

  // 3) send them to the sign-in form, pre-filled
  e.target.reset();
  clearValidation(e.target);
  $("#regPwBar").style.width = "0";
  $("#regPwBar").className = "";
  resetRegCascade();
  showAuthCard("login");
  $("#loginUser").value = username;
  $("#loginPass").value = "";
  $("#loginPass").focus();
  const el = $("#loginError");
  el.textContent = "Registration successful! Welcome, " + first + " \u2014 you are now " + emp.id +
                   ". Sign in to open your My Portal.";
  el.classList.add("show", "success");
  emsToast("Registered " + emp.id + " \u2014 portal login " + username + " created.");
});
$("#loginForm").addEventListener("submit", function () { $("#loginError").classList.remove("success"); }, true);

/* ---- switching between the sign-in card and the register window ---- */
function showAuthCard(which) {
  $("#loginCard").hidden = which !== "login";
  $("#loginScreen").scrollTop = 0;
}

/* ================================================================
   EMPLOYEE FORM — composite address cascade
   Country -> Region / State -> City/Municipality -> Barangay + postal code
   ================================================================ */
/* ---- Composite address cascade: Country -> Region -> City/Municipality -> Barangay + postal code ---- */
var PH_ADDRESS = {
  "Metro Manila (NCR)": { "Manila": "1000", "Quezon City": "1100", "Makati City": "1200", "Taguig City": "1630", "Pasig City": "1600", "Caloocan City": "1400", "Pasay City": "1300", "Parañaque City": "1700", "Las Piñas City": "1740", "Muntinlupa City": "1770", "Marikina City": "1800", "San Juan City": "1500", "Valenzuela City": "1440", "Malabon City": "1470", "Navotas City": "1485", "Pateros": "1620" },
  "Cordillera (CAR)": { "Baguio City": "2600", "La Trinidad": "2601", "Tabuk City": "3800", "Banaue": "3601", "Bontoc": "2616", "Lagawe": "3600" },
  "Ilocos (Region I)": { "San Fernando (La Union)": "2500", "Vigan City": "2700", "Laoag City": "2900", "Dagupan City": "2400", "Alaminos City": "2404", "San Carlos City (Pangasinan)": "2420" },
  "Cagayan Valley (Region II)": { "Tuguegarao City": "3500", "Ilagan City": "3300", "Cauayan City": "3305", "Santiago City": "3311", "Bayombong": "3700" },
  "Central Luzon (Region III)": { "San Fernando (Pampanga)": "2000", "Angeles City": "2009", "Olongapo City": "2200", "Tarlac City": "2300", "Cabanatuan City": "3100", "Balanga City": "2100", "Malolos City": "3000", "San Jose del Monte City": "3023" },
  "CALABARZON (Region IV-A)": { "Antipolo City": "1870", "San Pablo City": "4000", "Calamba City": "4030", "Batangas City": "4200", "Lipa City": "4217", "Lucena City": "4301", "Trece Martires City": "4109", "Imus": "4103", "Dasmariñas City": "4114", "Tagaytay City": "4120" },
  "MIMAROPA (Region IV-B)": { "Puerto Princesa City": "5300", "Calapan City": "5200", "Roxas (Oriental Mindoro)": "5212", "Boac": "4900", "Coron": "5316" },
  "Bicol (Region V)": { "Naga City": "4400", "Legazpi City": "4500", "Iriga City": "4431", "Tabaco City": "4511", "Sorsogon City": "4700", "Masbate City": "5400" },
  "Western Visayas (Region VI)": { "Iloilo City": "5000", "Bacolod City": "6100", "Roxas City": "5800", "Kalibo": "5600", "Passi City": "5802", "San Jose de Buenavista": "5700" },
  "Central Visayas (Region VII)": { "Cebu City": "6000", "Mandaue City": "6014", "Lapu-Lapu City": "6015", "Toledo City": "6038", "Tagbilaran City": "6300", "Dumaguete City": "6200" },
  "Eastern Visayas (Region VIII)": { "Tacloban City": "6500", "Ormoc City": "6541", "Catbalogan City": "6700", "Calbayog City": "6710", "Borongan City": "6800" },
  "Zamboanga Peninsula (Region IX)": { "Zamboanga City": "7000", "Pagadian City": "7016", "Dipolog City": "7100", "Dapitan City": "7101", "Isabela City": "7300" },
  "Northern Mindanao (Region X)": { "Cagayan de Oro City": "9000", "Iligan City": "9200", "Malaybalay City": "8700", "Valencia City": "8709", "Ozamiz City": "7200" },
  "Davao (Region XI)": { "Davao City": "8000", "Tagum City": "8100", "Panabo City": "8105", "Digos City": "8002", "Mati City": "8200" },
  "SOCCSKSARGEN (Region XII)": { "Koronadal City": "9506", "General Santos City": "9500", "Alabel": "9501", "Polomolok": "9504", "Kidapawan City": "9400", "Tacurong City": "9806", "Isulan": "9805" },
  "Caraga (Region XIII)": { "Butuan City": "8600", "Cabadbaran City": "8605", "Surigao City": "8400", "Bislig City": "8311", "Tandag City": "8300" },
  "BARMM": { "Cotabato City": "9600", "Lamitan City": "7302", "Bongao": "7503", "Jolo": "7400" }
};

function fillSelect(sel, items, placeholder) {
  sel.innerHTML = "";
  const ph = document.createElement("option");
  ph.value = ""; ph.textContent = placeholder; ph.disabled = true; ph.selected = true;
  sel.appendChild(ph);
  items.forEach(function (name) {
    const o = document.createElement("option");
    o.value = name; o.textContent = name;
    sel.appendChild(o);
  });
}
function resetCityLevel() {
  const city = $("#empCity"), bgy = $("#empBarangay");
  fillSelect(city, [], "Select a region first"); city.disabled = true;
  bgy.value = ""; bgy.disabled = true; bgy.placeholder = "Select a city first";
  $("#empPostal").value = "";
}
function resetAddressCascade() {
  const region = $("#empRegion");
  fillSelect(region, [], "Select a country first"); region.disabled = true;
  resetCityLevel();
}
$("#empCountry").addEventListener("change", function () {
  const region = $("#empRegion");
  if (this.value === "Philippines") {
    fillSelect(region, Object.keys(PH_ADDRESS), "Select a region / state");
    region.disabled = false;
  } else {
    resetAddressCascade();
  }
  resetCityLevel();
});
$("#empRegion").addEventListener("change", function () {
  const city = $("#empCity"), bgy = $("#empBarangay");
  fillSelect(city, Object.keys(PH_ADDRESS[this.value] || {}), "Select a city / municipality");
  city.disabled = false;
  bgy.value = ""; bgy.disabled = true; bgy.placeholder = "Select a city first";
  $("#empPostal").value = "";
});
$("#empCity").addEventListener("change", function () {
  const bgy = $("#empBarangay");
  bgy.disabled = false;
  bgy.placeholder = "e.g. Barangay 8, Purok 2";
  $("#empPostal").value = (PH_ADDRESS[$("#empRegion").value] || {})[this.value] || "";
});
$("#loginForm").addEventListener("submit", function () { $("#loginError").classList.remove("success"); }, true);


/* ================================================================
   FLOATING DIALOG WINDOW — in-app replacement for alert() / confirm()
   floatDialog(opts) -> Promise<boolean>
     opts: { title, message, kind: "warn"|"info"|"ok", choice: bool,
             okLabel, danger: bool }
   ================================================================ */
const FLOAT_ICONS = {
  warn: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>',
  info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>',
  ok:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg>'
};
let floatResolve = null;
function floatDialog(opts) {
  opts = opts || {};
  const bd = $("#floatBackdrop"), okBtn = $("#floatOk"), cancelBtn = $("#floatCancel");
  if (floatResolve) floatResolve(false);            // a dialog was already open: dismiss it
  $("#floatTitle").textContent = opts.title || (opts.choice ? "Are you sure?" : "Notice");
  $("#floatMsg").textContent = opts.message || "";
  const kind = opts.kind || (opts.choice ? "warn" : "info");
  const ic = $("#floatIcon");
  ic.className = "confirm-ic " + kind;
  ic.innerHTML = FLOAT_ICONS[kind] || FLOAT_ICONS.info;
  okBtn.textContent = opts.okLabel || "OK";
  okBtn.className = "btn" + (opts.danger ? " btn-red" : "");
  cancelBtn.hidden = !opts.choice;
  bd.hidden = false;
  requestAnimationFrame(function () { bd.classList.add("open"); });
  return new Promise(function (resolve) {
    floatResolve = function (result) {
      floatResolve = null;
      bd.classList.remove("open");
      setTimeout(function () { bd.hidden = true; }, 180);
      okBtn.removeEventListener("click", onOk);
      cancelBtn.removeEventListener("click", onCancel);
      bd.removeEventListener("click", onBackdrop);
      document.removeEventListener("keydown", onKey);
      resolve(result);
    };
    function onOk() { floatResolve(true); }
    function onCancel() { floatResolve(false); }
    function onBackdrop(e) { if (e.target === bd) floatResolve(!opts.choice); }
    function onKey(e) { if (e.key === "Escape") floatResolve(!opts.choice); }
    okBtn.addEventListener("click", onOk);
    cancelBtn.addEventListener("click", onCancel);
    bd.addEventListener("click", onBackdrop);
    document.addEventListener("keydown", onKey);
    (opts.choice ? cancelBtn : okBtn).focus();      // danger-safe default focus
  });
}
function alertDialog(title, message, kind) {
  return floatDialog({ title: title, message: message, kind: kind || "info", choice: false });
}
function confirmDialog(title, message, okLabel, danger) {
  return floatDialog({ title: title, message: message, okLabel: okLabel, danger: danger, kind: "warn", choice: true });
}

/* ================================================================
   CHANGE PASSWORD  +  ACTIVITY LOG
   ================================================================ */
function openPwModal() {
  $("#userMenu").classList.remove("open");
  $("#cpForm").reset(); clearValidation($("#cpForm"));
  $("#pwModal").hidden = false;
  $("#cpCurrent").focus();
}
function closePwModal() { $("#pwModal").hidden = true; }
$("#btnChangePw").addEventListener("click", openPwModal);
$("#cpCancel").addEventListener("click", closePwModal);
$("#pwModal").addEventListener("click", function (e) { if (e.target === this) closePwModal(); });
document.addEventListener("keydown", function (e) { if (e.key === "Escape" && !$("#pwModal").hidden) closePwModal(); });

$("#cpForm").addEventListener("submit", function (e) {
  e.preventDefault();                          // only reached when validation passed
  currentUser.password = $("#cpNew").value;
  saveUsers();
  logActivity("Changed own password");
  closePwModal();
  alertDialog("Password updated", "Your password has been updated.", "ok");
});




// Live Gmail checking while typing (all Gmail fields)
["empEmail"].forEach(function (id) {
  const el = document.getElementById(id);
  if (!el) return;
  const formId = el.form.id;
  el.addEventListener("input", function () {
    if (el.value.indexOf("@") !== -1 || el.value.length >= 6) validateField(formId, id);
  });
});


/* ================================================================
   TOP BAR MENUS: live clock, company menu, notifications, help
   ================================================================ */

// ---------- Live clock ----------
function tickClock() { $("#clock").textContent = fmtTime(); }
tickClock();
setInterval(tickClock, 1000);

// ---------- Dropdown helper (only one open at a time) ----------
function closeDropdowns(except) {
  document.querySelectorAll(".dropdown.open").forEach(function (d) { if (d !== except) d.classList.remove("open"); });
}
function toggleDropdown(menu) {
  const willOpen = !menu.classList.contains("open");
  closeDropdowns();
  $("#userMenu").classList.remove("open");
  if (willOpen) menu.classList.add("open");
}
document.addEventListener("click", function (e) {
  if (!e.target.closest(".org-wrap, .notif-wrap")) closeDropdowns();
  if (e.target.closest("#userMenuBtn")) closeDropdowns();
});
document.addEventListener("keydown", function (e) {
  if (e.key !== "Escape") return;
  closeDropdowns();
  $("#userMenu").classList.remove("open");
  if (!$("#infoModal").hidden) closeInfo();
});

// Any element with data-go="section" navigates there
document.addEventListener("click", function (e) {
  const g = e.target.closest("[data-go]");
  if (!g) return;
  const sec = g.dataset.go;
  go(sec);
  closeDropdowns();
});

// ---------- Company menu ----------
$("#orgBtn").addEventListener("click", function (e) { e.stopPropagation(); toggleDropdown($("#orgMenu")); });

$("#btnAbout").addEventListener("click", function () {
  closeDropdowns();
  openInfo("About Joecon's Steel Works",
    '<p><strong>Joecon\'s Steel Works</strong> is a steel fabrication and construction company. ' +
    'This Employee Management System (HRIS + TPS) automates:</p>' +
    '<ul><li>Employee records (with Gmail and contact number)</li>' +
    '<li>Daily time in / time out, with automatic late marking after 8:00 AM</li>' +
    '<li>Cash advance tracking and automatic payroll deductions</li>' +
    '<li>Payroll: Gross = days present &times; daily rate; minus late and cash-advance deductions</li>' +
    '<li>Printable attendance and payroll reports</li>' +
    '<li>User accounts with roles, access rights, approval and an activity log</li></ul>' +
    '<p class="note">Records: ' + employees.length + ' employees &middot; ' + attendance.length +
    ' attendance entries &middot; ' + cashAdvances.length + ' cash advances &middot; ' + users.length + ' user accounts</p>');
});

// Export all data as a JSON backup file
$("#btnExport").addEventListener("click", function () {
  closeDropdowns();
  if (!can("admin")) return alertDialog("Not allowed", "Only administrators can export a data backup.", "warn");
  const data = {
    exportedAt: new Date().toISOString(),
    employees: employees, attendance: attendance, cashAdvances: cashAdvances,
    users: users.map(function (u) { const c = Object.assign({}, u); delete c.password; return c; }),
    activityLog: store.get("jems2_log", [])
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "joecon-ems-backup-" + todayISO() + ".json";
  document.body.appendChild(a); a.click(); a.remove();
  logActivity("Exported a data backup");
});

// ---------- Notifications ----------
function buildNotifications() {
  const list = [];
  const today = todayISO();
  const isWorkday = new Date().getDay() !== 0;

  const todays = attendance.filter(function (a) { return a.date === today; });
  const lates = todays.filter(function (a) { return a.lateMin > 0; });
  if (lates.length) list.push({ key: "late-" + today + "-" + lates.length, type: "bad", go: "attendance",
    text: lates.length + " employee" + (lates.length > 1 ? "s were" : " was") + " late today: " +
      lates.map(function (a) { const e = getEmp(a.empId); return e ? e.fullName.split(" ")[0] + " (" + a.lateMin + " min)" : ""; }).join(", ") });

  if (isWorkday && new Date().getHours() >= 9) {
    const missing = employees.filter(function (e) { return !todays.some(function (a) { return a.empId === e.id; }); });
    if (missing.length) list.push({ key: "missing-" + today + "-" + missing.length, type: "info", go: "attendance",
      text: missing.length + " employee" + (missing.length > 1 ? "s have" : " has") + " not timed in today" });
  }

  const noOut = todays.filter(function (a) { return !a.timeOut; });
  if (noOut.length && new Date().getHours() >= 17) list.push({ key: "noout-" + today + "-" + noOut.length, type: "info", go: "attendance",
    text: noOut.length + " employee" + (noOut.length > 1 ? "s have" : " has") + " not timed out yet" });

  const monthCA = cashAdvances.filter(function (c) { return c.date.slice(0, 7) === today.slice(0, 7); });
  if (monthCA.length) list.push({ key: "ca-" + today.slice(0, 7) + "-" + monthCA.length, type: "info", go: "cashadvance",
    text: monthCA.length + " cash advance" + (monthCA.length > 1 ? "s" : "") + " this month (" +
      money(monthCA.reduce(function (s, c) { return s + c.amount; }, 0)) + ") will be deducted in payroll" });

  return list;
}

function readKeys() { return store.get("jems2_notif_read", []); }

function renderNotifications() {
  if (!currentUser) return;
  const list = buildNotifications();
  const read = readKeys();
  const unread = list.filter(function (n) { return read.indexOf(n.key) === -1; }).length;
  $("#notifCount").hidden = !unread;
  $("#notifCount").textContent = unread > 9 ? "9+" : unread;
  $("#notifList").innerHTML = list.length
    ? list.map(function (n) {
        const isNew = read.indexOf(n.key) === -1;
        return '<button class="notif-item ' + n.type + (isNew ? " unread" : "") + '" data-go="' + n.go + '" data-key="' + n.key + '">' +
               '<span class="notif-dot"></span><span>' + n.text + '</span></button>';
      }).join("")
    : '<div class="empty">You\'re all caught up.</div>';
}

$("#notifBtn").addEventListener("click", function (e) {
  e.stopPropagation();
  renderNotifications();
  toggleDropdown($("#notifPanel"));
});
$("#notifList").addEventListener("click", function (e) {
  const item = e.target.closest(".notif-item");
  if (!item) return;
  const read = readKeys();
  if (read.indexOf(item.dataset.key) === -1) { read.push(item.dataset.key); store.set("jems2_notif_read", read.slice(-200)); }
  renderNotifications();
});
$("#notifReadAll").addEventListener("click", function (e) {
  e.stopPropagation();
  const read = readKeys().concat(buildNotifications().map(function (n) { return n.key; }));
  store.set("jems2_notif_read", read.slice(-200));
  renderNotifications();
});
setInterval(renderNotifications, 5000);   // keep the badge up to date
renderNotifications();

// ---------- Help / info modal ----------
function openInfo(title, html) {
  $("#infoTitle").textContent = title;
  $("#infoBody").innerHTML = html;
  $("#infoModal").hidden = false;
}
function closeInfo() { $("#infoModal").hidden = true; }
$("#infoClose").addEventListener("click", closeInfo);
$("#infoModal").addEventListener("click", function (e) { if (e.target === this) closeInfo(); });

$("#btnHelp").addEventListener("click", function () {
  openInfo("User Guide",
    '<ol class="guide">' +
    '<li><strong>Employees:</strong> use the <b>+ Add Employee</b> button to register a worker in a floating form. The <b>&hellip;</b> menu on a card edits, records attendance, adds a cash advance, or removes.</li>' +
    '<li><strong>Attendance:</strong> select an employee and press <b>Time In</b> / <b>Time Out</b>. Arriving after 8:00 AM is marked late automatically.</li>' +
    '<li><strong>Cash Advance:</strong> record the amount and date; it is deducted in the payroll for that period.</li>' +
    '<li><strong>Payroll:</strong> pick the period and press <b>Generate Payroll</b>. Use <b>Print Report</b> for a paper copy.</li>' +
    '<li><strong>Reports:</strong> attendance and deduction summary for any date range.</li>' +
    '<li><strong>Account:</strong> use the avatar menu (top right) to change your password or sign out.</li>' +
    '<li><strong>Top bar:</strong> search employees, <b>+</b> quick add, bell for notifications, avatar for password change and sign out.</li>' +
    '</ol>' +
    '<p class="note"><strong>Need more help?</strong> Contact the system administrator at <b>joeconsteelworks@gmail.com</b>.</p>');
});

// Refresh notifications whenever someone signs in
$("#loginForm").addEventListener("submit", function () { setTimeout(renderNotifications, 0); });


// Older saved accounts: the default admin gets a full name
users.forEach(function (u) { if (u.id === "USR-001" && !u.fullName) u.fullName = "System Administrator"; });
saveUsers();

/* ================================================================
   EXTRA CLICKABLE ITEMS
   - Dashboard stat cards open their module
   - Sidebar logo returns to the Dashboard
   - Sidebar links work with the keyboard (Tab + Enter)
   ================================================================ */
(function () {
  const cardTargets = ["employees", "attendance", "attendance", "cashadvance"];
  document.querySelectorAll(".stat-card").forEach(function (card, i) {
    card.dataset.go = cardTargets[i];
    card.classList.add("clickable");
    card.title = "Open " + titles[cardTargets[i]];
  });
  const brand = document.querySelector(".sidebar .brand");
  brand.dataset.go = "dashboard";
  brand.classList.add("clickable");
  brand.title = "Go to Dashboard";

  document.querySelectorAll(".nav-link, .stat-card, .sidebar .brand").forEach(function (el) {
    el.setAttribute("tabindex", "0");
    el.setAttribute("role", "button");
    el.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); el.click(); }
    });
  });
})();


/* ================================================================
   EMPLOYEE FORM DEFAULTS + POSITION -> DAILY RATE SUGGESTION
   ================================================================ */
var DEFAULT_RATES = { "Welder": 650, "Fabricator": 600, "Laborer": 500, "Foreman": 750, "Helper": 480, "HR Staff": 560, "Timekeeper / Staff": 550 };
$("#empHired").value = todayISO();
$("#empHired").max = todayISO();
$("#empBday").max = todayISO();

// Choosing a position suggests its standard daily rate (a custom rate is never overwritten)
$("#empPosition").addEventListener("change", function () {
  const rate = $("#empRate");
  const prev = rate.dataset.auto || "";
  const next = DEFAULT_RATES[this.value] || "";
  if (next && (!rate.value || rate.value === prev)) { rate.value = next; rate.dataset.auto = next; }
});

/* ================================================================
   EMPLOYEE MODE
   Staff (Write / Execute / Admin) see the whole system.
   Regular employees (Read only) see ONLY their own portal.
   ================================================================ */
function isStaff() { return can("write") || can("execute") || can("admin"); }

const _baseApplyPermissions = applyPermissions;
applyPermissions = function () {
  _baseApplyPermissions();
  const staff = isStaff();
  document.querySelectorAll(".nav-link").forEach(function (a) {
    if (a.dataset.section !== "myportal" && !a.hasAttribute("data-admin-only")) a.style.display = staff ? "" : "none";
  });
  document.querySelectorAll("[data-staff-only]").forEach(function (el) { el.style.display = staff ? "" : "none"; });
  document.querySelector(".search-box").style.visibility = staff ? "" : "hidden";
  $("#fabAdd").style.display = staff ? "" : "none";
  document.querySelector(".notif-wrap").style.display = staff ? "" : "none";
  $("#portalMsgBtn").hidden = can("admin");
  if (!staff) {
    $("#permBanner").hidden = false;
    $("#permBanner").textContent = "Welcome, " + (currentUser.fullName || currentUser.username) + ". This is your employee portal. Use the message icon to contact the admin privately.";
    go("myportal");
  }
  renderMsgBadge();
};

const _baseGo = go;
go = function (section) {
  if (currentUser && !isStaff() && section !== "myportal") section = "myportal";
  _baseGo(section);
};

/* ================================================================
   MY PORTAL — individual attendance, payroll and CA status
   ================================================================ */
function portalEmployee() {
  if (!currentUser) return null;
  if (currentUser.empId) return getEmp(currentUser.empId) || null;
  if (can("admin")) return getEmp($("#portalEmp").value) || employees[0] || null;
  return null;
}

function renderPortal() {
  if (!currentUser) return;
  const adminPreview = !currentUser.empId && can("admin");
  $("#portalPicker").hidden = !adminPreview;
  if (adminPreview) {
    const keep = $("#portalEmp").value;
    $("#portalEmp").innerHTML = employees.map(function (e) { return '<option value="' + e.id + '">' + e.id + " — " + e.fullName + "</option>"; }).join("");
    if (keep && getEmp(keep)) $("#portalEmp").value = keep;
  }
  const emp = portalEmployee();
  $("#portalEmpty").hidden = !!emp;
  $("#portalBody").hidden = !emp;
  if (!emp) return;

  if (!$("#pFrom").value) $("#pFrom").value = firstOfMonth;
  if (!$("#pTo").value) $("#pTo").value = todayISO();
  const from = $("#pFrom").value, to = $("#pTo").value;

  $("#pAvatar").textContent = initials(emp.fullName);
  $("#pAvatar").style.background = avatarColor(emp.fullName);
  $("#pName").textContent = emp.fullName + " (" + emp.id + ")";
  $("#pSub").textContent = emp.position + " · Hired " + fmtDate(emp.dateHired) + " · Daily rate " + money(emp.dailyRate)
    + (emp.address && emp.address.city ? " · " + (emp.address.barangay ? emp.address.barangay + ", " : "") + emp.address.city : "");

  const pay = computePayrollRows(from, to).find(function (r) { return r.emp.id === emp.id; });
  $("#pDays").textContent = pay.daysPresent;
  $("#pLate").textContent = pay.lateMin;
  $("#pCA").textContent = money(pay.caDed);
  $("#pNet").textContent = money(pay.net);
  $("#pPayroll").innerHTML =
    "<tr><td>Days present</td><td class='text-right'>" + pay.daysPresent + " × " + money(emp.dailyRate) + "</td></tr>" +
    "<tr><td>Gross pay</td><td class='text-right'>" + money(pay.gross) + "</td></tr>" +
    "<tr><td>Less: late deduction (" + pay.lateMin + " min)</td><td class='text-right'>− " + money(pay.lateDed) + "</td></tr>" +
    "<tr><td>Less: cash advances</td><td class='text-right'>− " + money(pay.caDed) + "</td></tr>" +
    "<tr class='portal-net'><td><strong>Net pay</strong></td><td class='text-right'><strong>" + money(pay.net) + "</strong></td></tr>";

  const att = attendance.filter(function (a) { return a.empId === emp.id && a.date >= from && a.date <= to; })
    .sort(function (a, b) { return a.date < b.date ? 1 : -1; });
  $("#pAttendance").innerHTML = att.length ? att.map(function (a) {
    return "<tr><td>" + fmtDate(a.date) + "</td><td>" + fmtTime(a.timeIn) + "</td><td>" + (a.timeOut ? fmtTime(a.timeOut) : "—") + "</td>" +
      '<td><span class="badge ' + (a.lateMin > 0 ? "badge-late" : "badge-ontime") + '">' + (a.lateMin > 0 ? "Late " + a.lateMin + " min" : "On time") + "</span></td></tr>";
  }).join("") : '<tr><td colspan="4" class="empty">No attendance records in this period.</td></tr>';

  const cas = cashAdvances.filter(function (c) { return c.empId === emp.id; }).slice().reverse();
  $("#pCATable").innerHTML = cas.length ? cas.map(function (c) {
    return "<tr><td>CA-" + String(c.id).padStart(4, "0") + "</td><td>" + fmtDate(c.date) + "</td><td>" + (c.notes || "—") + "</td><td class='text-right'>" + money(c.amount) + "</td></tr>";
  }).join("") : '<tr><td colspan="4" class="empty">No cash advances.</td></tr>';
}
$("#portalEmp").addEventListener("change", renderPortal);
$("#pFrom").addEventListener("change", renderPortal);
$("#pTo").addEventListener("change", renderPortal);

/* ================================================================
   PRIVATE MESSAGES (employee <-> admin)
   Stored in localStorage as { id, from, to, text, at, read }.
   "to: admin" means the message goes to the admin inbox.
   ================================================================ */
function getMsgs() { return store.get("jems2_messages", []); }
function saveMsgs(m) { store.set("jems2_messages", m); }
var msgPeer = null;   // admin: which user's conversation is open

function userName(id) { const u = users.find(function (x) { return x.id === id; }); return u ? (u.fullName || u.username) : id; }

function unreadCount() {
  if (!currentUser) return 0;
  return getMsgs().filter(function (m) {
    return !m.read && (can("admin") ? m.to === "admin" : m.to === currentUser.id);
  }).length;
}
function renderMsgBadge() {
  const n = unreadCount();
  $("#msgCount").hidden = !n;
  $("#msgCount").textContent = n > 9 ? "9+" : n;
}

function threadWith(userId) {
  return getMsgs().filter(function (m) {
    return (m.from === userId && m.to === "admin") || (m.to === userId);
  });
}

function renderMsgModal() {
  const admin = can("admin");
  $("#msgList").hidden = !admin;
  let thread = [];
  if (admin) {
    const peers = [];
    getMsgs().forEach(function (m) {
      const peer = m.to === "admin" ? m.from : m.to;
      if (peers.indexOf(peer) === -1) peers.push(peer);
    });
    if (!msgPeer && peers.length) msgPeer = peers[peers.length - 1];
    $("#msgList").innerHTML = peers.length ? peers.slice().reverse().map(function (id) {
      const unread = getMsgs().filter(function (m) { return m.from === id && m.to === "admin" && !m.read; }).length;
      return '<button type="button" class="msg-peer' + (id === msgPeer ? " active" : "") + '" data-peer="' + id + '">' +
        "<strong>" + userName(id) + "</strong>" + (unread ? '<span class="msg-unread">' + unread + "</span>" : "") + "</button>";
    }).join("") : '<div class="empty">No messages yet.</div>';
    $("#msgTitle").textContent = msgPeer ? "Conversation with " + userName(msgPeer) : "Employee Messages";
    thread = msgPeer ? threadWith(msgPeer) : [];
    $("#msgForm").hidden = !msgPeer;
  } else {
    $("#msgTitle").textContent = "Private message to the Admin";
    thread = threadWith(currentUser.id);
    $("#msgForm").hidden = false;
  }

  // mark as read
  const all = getMsgs(); let changed = false;
  all.forEach(function (m) {
    if (!m.read && ((admin && m.to === "admin" && m.from === msgPeer) || (!admin && m.to === currentUser.id))) { m.read = true; changed = true; }
  });
  if (changed) saveMsgs(all);

  $("#msgThread").innerHTML = thread.length ? thread.map(function (m) {
    const mine = admin ? m.to !== "admin" : m.from === currentUser.id;
    const who = mine ? "You" : (admin ? userName(m.from) : "Admin");
    return '<div class="bubble ' + (mine ? "mine" : "theirs") + '"><div class="bubble-text"></div>' +
      '<div class="bubble-meta">' + who + " · " + fmtDate(m.at.slice(0, 10)) + " " + fmtTime(m.at) + "</div></div>";
  }).join("") : '<div class="empty">' + (admin ? "Select a conversation." : "No messages yet. Write to the admin below — only the admin can read this.") + "</div>";
  // insert text safely (no HTML from users)
  const bubbles = $("#msgThread").querySelectorAll(".bubble-text");
  thread.forEach(function (m, i) { if (bubbles[i]) bubbles[i].textContent = m.text; });
  $("#msgThread").scrollTop = $("#msgThread").scrollHeight;
  renderMsgBadge();
}

function openMessages() {
  if (!currentUser) return;
  closeDropdowns(); $("#userMenu").classList.remove("open");
  $("#msgForm").reset(); clearValidation($("#msgForm")); $("#msgCounter").textContent = "0 / 500";
  $("#msgModal").hidden = false;
  renderMsgModal();
  $("#msgText").focus();
}
function closeMessages() { $("#msgModal").hidden = true; }
$("#msgBtn").addEventListener("click", openMessages);
$("#portalMsgBtn").addEventListener("click", openMessages);
$("#msgClose").addEventListener("click", closeMessages);
$("#msgModal").addEventListener("click", function (e) { if (e.target === this) closeMessages(); });
document.addEventListener("keydown", function (e) { if (e.key === "Escape" && !$("#msgModal").hidden) closeMessages(); });
$("#msgList").addEventListener("click", function (e) {
  const b = e.target.closest("[data-peer]");
  if (!b) return;
  msgPeer = b.dataset.peer;
  renderMsgModal();
});
$("#msgText").addEventListener("input", function () { $("#msgCounter").textContent = this.value.length + " / 500"; });

// Validation rule for the message form (uses the same Task 6 engine)
RULES.msgForm = {
  msgText: function (v) {
    if (!v) return "Message cannot be empty.";
    if (v.length < 2) return "Message is too short.";
    if (v.length > 500) return "Message must be 500 characters or less.";
    return "";
  }
};
$("#msgText").addEventListener("input", function () { if (this.classList.contains("is-invalid")) validateField("msgForm", "msgText"); });

$("#msgForm").addEventListener("submit", function (e) {
  e.preventDefault();                          // only reached when validation passed
  const admin = can("admin");
  const all = getMsgs();
  all.push({
    id: Date.now(),
    from: currentUser.id,
    to: admin ? msgPeer : "admin",
    text: val("msgText"),
    at: new Date().toISOString(),
    read: false
  });
  saveMsgs(all);
  logActivity(admin ? "Replied to " + userName(msgPeer) : "Sent a private message to the admin");
  $("#msgForm").reset(); clearValidation($("#msgForm")); $("#msgCounter").textContent = "0 / 500";
  renderMsgModal();
});
setInterval(renderMsgBadge, 4000);

// Re-apply now (the session may already have been restored earlier in this file)
if (currentUser) { applyPermissions(); if (!isStaff()) renderPortal(); }
/* ---------- console/debug helpers (window.EMS.x in DevTools) ---------- */
window.EMS = {
  alertDialog: alertDialog, confirmDialog: confirmDialog, floatDialog: floatDialog,
  openEmpModal: openEmpModal, startEmpEdit: startEmpEdit, closeEmpModal: closeEmpModal,
  go: go, saveAll: saveAll, renderNotifications: renderNotifications, state: function () {
    return { employees: employees, attendance: attendance, cashAdvances: cashAdvances,
             users: users, log: store.get("jems2_log", []) };
  }
};
})();
