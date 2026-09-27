/* ================================================================
   Joecon's Employee Management System  (tiimi-inspired UI)
   Modules: Dashboard | Employees | Attendance | Cash Advance
            Payroll Processing | Reports
   Tech: Vanilla HTML / CSS / JavaScript
   Data: localStorage (browser storage) so records persist on reload
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
  }
};

// v2 keys: employee records now include department + dateHired
let employees = store.get("jems2_employees", null);
let attendance = store.get("jems2_attendance", null);
let cashAdvances = store.get("jems2_cashAdvances", null);

// Edit-mode trackers (null = adding a new record)
var editingEmpId = null, editingUserId = null;

// ---------------- Activity log ----------------
function logActivity(action) {
  const log = store.get("jems2_log", []);
  log.push({
    at: new Date().toISOString(),
    user: (typeof currentUser !== "undefined" && currentUser) ? currentUser.username : "system",
    action: action
  });
  store.set("jems2_log", log.slice(-300));          // keep the latest 300 entries
  if (typeof renderLog === "function") renderLog();
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
  usermgmt: "User Management", myportal: "My Portal"
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
let deptFilter = "";

function filteredEmployees() {
  return employees.filter(function (e) {
    const q = searchTerm.trim().toLowerCase();
    const matchQ = !q || (e.fullName + " " + e.position + " " + e.id + " " + (e.department || "") + " " + (e.email || "")).toLowerCase().indexOf(q) !== -1;
    const matchD = !deptFilter || e.department === deptFilter;
    return matchQ && matchD;
  });
}

function renderEmployees() {
  const list = filteredEmployees();
  $("#empCountTitle").innerHTML = employees.length + " Employees <span style='font-size:13px;color:#7c8a99;font-weight:600;'>" +
    (list.length !== employees.length ? "(" + list.length + " shown)" : "") + "</span>";

  const grid = $("#employeeGrid");
  if (!employees.length) {
    grid.innerHTML = '<div class="empty" style="grid-column:1/-1;">No employees yet. Add one using the form above.</div>';
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
        '<div><div class="k">Department</div><div class="v">' + (e.department || "—") + '</div></div>' +
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
      if (!can("write")) return alert("You need the 'Write' access right to remove employees.");
      if (confirm("Remove this employee? Attendance and CA records will be kept.")) {
        const gone = getEmp(id);
        employees = employees.filter(function (x) { return x.id !== id; });
        logActivity("Removed employee " + id + " (" + (gone ? gone.fullName : "") + ")");
        if (editingEmpId === id) cancelEmpEdit();
        saveAll();
        renderEmployees(); renderDashboard();
      }
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
  const data = {
    fullName: val("empName"),
    position: val("empPosition"),
    department: $("#empDepartment").value,
    dailyRate: parseFloat($("#empRate").value),
    dateHired: $("#empHired").value || todayISO(),
    email: val("empEmail"),
    phone: val("empPhone")
  };
  if (editingEmpId) {
    const emp = getEmp(editingEmpId);
    Object.assign(emp, data);
    logActivity("Updated employee " + emp.id + " (" + emp.fullName + ")");
  } else {
    const num = employees.length ? Math.max.apply(null, employees.map(x => parseInt(x.id.split("-")[1]))) + 1 : 1;
    data.id = "EMP-" + String(num).padStart(3, "0");
    employees.push(data);
    logActivity("Added employee " + data.id + " (" + data.fullName + ")");
  }
  saveAll();
  renderEmployees(); renderDashboard();
  cancelEmpEdit();
});

// ---- Edit employee: load record into the form ----
function startEmpEdit(id) {
  if (!can("write")) return alert("You need the 'Write' access right to edit employees.");
  const emp = getEmp(id);
  if (!emp) return;
  editingEmpId = id;
  go("employees");
  $("#empName").value = emp.fullName;
  $("#empPosition").value = emp.position;
  $("#empDepartment").value = emp.department;
  $("#empRate").value = emp.dailyRate;
  $("#empHired").value = emp.dateHired;
  $("#empEmail").value = emp.email || "";
  $("#empPhone").value = emp.phone || "";
  $("#empFormTitle").textContent = "Edit Employee — " + emp.id;
  $("#empSubmit").textContent = "Save Changes";
  $("#empCancel").hidden = false;
  clearValidation($("#employeeForm"));
  $("#employeeForm").closest(".card").scrollIntoView({ behavior: "smooth", block: "start" });
  $("#empName").focus();
}
function cancelEmpEdit() {
  editingEmpId = null;
  const f = $("#employeeForm");
  f.reset();
  $("#empHired").value = todayISO();
  $("#empFormTitle").textContent = "Add New Employee";
  $("#empSubmit").textContent = "Add Employee";
  $("#empCancel").hidden = true;
}
$("#empCancel").addEventListener("click", function () { cancelEmpEdit(); clearValidation($("#employeeForm")); });
$("#empPhone").addEventListener("input", function () { this.value = this.value.replace(/\D/g, "").slice(0, 11); });

// Search + department filter
$("#globalSearch").addEventListener("input", function () {
  searchTerm = this.value;
  if (searchTerm.trim()) go("employees");
  renderEmployees();
});
$("#deptFilter").addEventListener("change", function () {
  deptFilter = this.value;
  renderEmployees();
});

// FAB + New Hire button: jump to employees and focus the name field
function focusAddEmployee() {
  go("employees");
  $("#empName").focus();
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
  if (!empId) return alert("Please add and select an employee first.");
  const today = todayISO();
  if (attendance.some(function (a) { return a.empId === empId && a.date === today; }))
    return alert("This employee has already timed in today.");
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
  if (!empId) return alert("Please select an employee first.");
  const today = todayISO();
  const rec = attendance.find(function (a) { return a.empId === empId && a.date === today; });
  if (!rec) return alert("This employee has no time-in record for today.");
  if (rec.timeOut) return alert("This employee has already timed out today.");
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
    if (!e.department) e.department = "Fabrication";
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
  renderUserTable();
  applyPermissions();
  // non-admins must never land on the admin page
  if (!can("admin")) {
    const active = document.querySelector(".nav-link.active");
    if (active && active.dataset.section === "usermgmt") go("dashboard");
  }
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
  newMfaCode();
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
  if (!can("admin"))   missing.push("user management (Admin)");
  const banner = $("#permBanner");
  if (missing.length) {
    banner.hidden = false;
    banner.textContent = "Signed in as " + currentUser.username + ". Read-only access — you cannot " + missing.join(" or ") + ".";
  } else {
    banner.hidden = true;
  }
}

// ---------------- Form 1: Add User ----------------
function setFormMsg(id, msg, ok) {
  const el = $(id);
  el.textContent = msg;
  el.className = "form-msg " + (ok ? "ok" : "err");
}

$("#userForm").addEventListener("submit", function (e) {
  e.preventDefault();                          // only reached when validation passed
  const data = {
    fullName: val("uFullName"),
    username: val("uUsername"),
    email: val("uEmail"),
    department: $("#uDepartment").value,
    phone: val("uPhone"),
    status: $("#uStatus").value
  };
  const pw = $("#uPassword").value;
  if (editingUserId) {
    const u = users.find(function (x) { return x.id === editingUserId; });
    if (u.id === "USR-001" && data.status !== "Active") return setFormMsg("#userFormMsg", "The default admin account must stay Active.", false);
    Object.assign(u, data);
    if (pw) u.password = pw;                   // blank = keep current password
    logActivity("Updated user " + u.id + " (" + u.username + ")" + (pw ? " and reset password" : ""));
    setFormMsg("#userFormMsg", "User " + u.username + " updated.", true);
    if (currentUser && currentUser.id === u.id) populateUserMenu();
  } else {
    const num = users.length ? Math.max.apply(null, users.map(function (u) { return parseInt(u.id.split("-")[1]); })) + 1 : 1;
    data.id = "USR-" + String(num).padStart(3, "0");
    data.password = pw; data.rights = ["read"]; data.expiry = "";
    users.push(data);
    logActivity("Added user " + data.id + " (" + data.username + ")");
    setFormMsg("#userFormMsg", "User " + data.username + " added (default: Read only). Assign access rights in Form 2.", true);
  }
  saveUsers();
  renderUserTable();
  populateUserSelect();
  cancelUserEdit(true);
});

function startUserEdit(id) {
  const u = users.find(function (x) { return x.id === id; });
  if (!u) return;
  editingUserId = id;
  $("#uFullName").value = u.fullName || "";
  $("#uUsername").value = u.username;
  $("#uEmail").value = u.email;
  $("#uDepartment").value = u.department;
  $("#uPhone").value = u.phone || "";
  $("#uPassword").value = "";
  $("#uStatus").value = u.status;
  $("#userFormTitle").textContent = "Edit User — " + u.id;
  $("#uPasswordLabel").textContent = "New Password (leave blank to keep current)";
  $("#userSubmit").textContent = "Save Changes";
  $("#userCancel").hidden = false;
  clearValidation($("#userForm"));
  $("#userFormMsg").textContent = "";
  $("#userForm").closest(".card").scrollIntoView({ behavior: "smooth", block: "start" });
  $("#uFullName").focus();
}
function cancelUserEdit(keepMsg) {
  editingUserId = null;
  $("#userForm").reset();
  $("#userFormTitle").innerHTML = "Form 1 &mdash; Add User";
  $("#uPasswordLabel").textContent = "Initial Password";
  $("#userSubmit").textContent = "Add User";
  $("#userCancel").hidden = true;
  if (!keepMsg) $("#userFormMsg").textContent = "";
}
$("#userCancel").addEventListener("click", function () { cancelUserEdit(); clearValidation($("#userForm")); });

// ---------------- Form 2: Role & Access Assignment ----------------
function populateUserSelect() {
  $("#rUserId").innerHTML = users.map(function (u) {
    return '<option value="' + u.id + '">' + u.id + ' — ' + u.username + '</option>';
  }).join("");
  loadRoleForm();
}

function loadRoleForm() {
  const id = $("#rUserId").value;
  const u = users.find(function (x) { return x.id === id; });
  document.querySelectorAll(".acc-chk").forEach(function (c) { c.checked = !!(u && u.rights.indexOf(c.value) !== -1); });
  $("#rExpiry").value = u ? (u.expiry || "") : "";
}

$("#rUserId").addEventListener("change", loadRoleForm);

$("#roleForm").addEventListener("submit", function (e) {
  e.preventDefault();
  const id = $("#rUserId").value;
  const u = users.find(function (x) { return x.id === id; });
  if (!u) return;
  u.rights = Array.from(document.querySelectorAll(".acc-chk:checked")).map(function (c) { return c.value; });
  if (u.rights.indexOf("read") === -1) u.rights.unshift("read");
  u.expiry = $("#rExpiry").value;
  logActivity("Set access rights for " + u.username + ": " + u.rights.join(", ") + (u.expiry ? " (expires " + u.expiry + ")" : ""));
  saveUsers();
  renderUserTable();
  populateUserMenu && currentUser && currentUser.id === u.id && populateUserMenu();
  applyPermissions();
  setFormMsg("#roleFormMsg", "Access rights updated for " + u.username + ": " + u.rights.map(function (r) { return ACCESS_LABELS[r]; }).join(", ") + ".", true);
});

// ---------------- Users table ----------------
function renderUserTable() {
  $("#userTable").innerHTML = users.length
    ? users.map(function (u) {
        const badges = (u.rights.length ? u.rights : ["read"]).map(function (r) {
          return '<span class="perm-badge ' + r + '">' + ACCESS_LABELS[r] + "</span>";
        }).join("");
        const exp = isExpired(u)
          ? '<span class="status-pill inactive">Expired ' + fmtDate(u.expiry) + "</span>"
          : (u.expiry ? fmtDate(u.expiry) : "No expiry");
        const isMe = currentUser && currentUser.id === u.id;
        const delBtn =
          (u.status === "Pending" ? '<button class="btn btn-sm btn-green" data-approve-user="' + u.id + '">Approve</button> ' : "") +
          '<button class="btn btn-outline btn-sm" data-edit-user="' + u.id + '">Edit</button> ' +
          (isMe ? '<span class="note" style="margin:0;">(you)</span>'
                : '<button class="btn btn-outline btn-sm" data-del-user="' + u.id + '">Remove</button>');
        return "<tr>" +
          "<td><strong>" + u.id + "</strong></td>" +
          "<td>" + (u.fullName || "—") + "</td>" +
          "<td>" + u.username + "</td>" +
          "<td>" + u.email + "</td>" +
          "<td>" + u.department + "</td>" +
          "<td>" + badges + "</td>" +
          "<td>" + exp + "</td>" +
          "<td><span class='status-pill " + u.status.toLowerCase() + "'>" + u.status + "</span></td>" +
          '<td class="text-right">' + delBtn + "</td>" +
        "</tr>";
      }).join("")
    : '<tr><td colspan="9" class="empty">No users yet.</td></tr>';
  const pending = users.filter(function (u) { return u.status === "Pending"; }).length;
  $("#pendingCount").hidden = !pending;
  $("#pendingCount").textContent = pending + " pending approval";
}

document.addEventListener("click", function (e) {
  const approveId = e.target.dataset.approveUser;
  if (approveId) {
    const u = users.find(function (x) { return x.id === approveId; });
    u.status = "Active";
    saveUsers(); renderUserTable();
    logActivity("Approved registration of " + u.username);
    return;
  }
  if (e.target.dataset.editUser) return startUserEdit(e.target.dataset.editUser);
  const id = e.target.dataset.delUser;
  if (!id) return;
  if (id === "USR-001") return alert("The default admin account cannot be removed.");
  if (!confirm("Remove this user account?")) return;
  const gone = users.find(function (x) { return x.id === id; });
  users = users.filter(function (x) { return x.id !== id; });
  logActivity("Removed user " + id + " (" + (gone ? gone.username : "") + ")");
  if (editingUserId === id) cancelUserEdit();
  saveUsers();
  renderUserTable();
  populateUserSelect();
});

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
  renderUserTable();
  populateUserSelect();

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
  registerForm: {
    regName: function (v) {
      if (!v) return "Full name is required.";
      if (v.length < 3) return "Full name must be at least 3 characters.";
      if (!NAME_RE.test(v)) return "Use letters, spaces, periods, hyphens or apostrophes only.";
      return "";
    },
    regUsername: function (v) {
      if (!v) return "Username is required.";
      if (v.length < 4 || v.length > 20) return "Username must be 4–20 characters long.";
      if (/[A-Z]/.test(v)) return "Capital letters are not allowed. Use lowercase only (e.g. j.delacruz).";
      if (!USERNAME_RE.test(v)) return "Lowercase letters, numbers, dots or underscores only. No spaces.";
      if (users.some(function (u) { return u.username.toLowerCase() === v.toLowerCase(); })) return "This username is already taken.";
      return "";
    },
    regDepartment: function (v) { return v ? "" : "Please select your department."; },
    regPosition: function (v) { return v ? "" : "Please select your position / job title."; },
    regHired: function (v) {
      if (!v) return "Date hired is required.";
      if (v > todayISO()) return "Date hired cannot be a future date.";
      if (v < "1990-01-01") return "Date hired must be on or after Jan 1, 1990.";
      return "";
    },
    regEmail: function (v) { return checkGmail(v) || checkGmail(v, employees); },
    regPhone: function (v) {
      if (!v) return "Contact number is required.";
      if (!PHONE_RE.test(v)) return "Enter 11 digits starting with 09 (e.g. 09171234567).";
      if (employees.some(function (x) { return x.phone === v; })) return "This contact number is already used by another employee.";
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
      if (v !== document.getElementById("regPassword").value) return "Passwords do not match.";
      return "";
    },
    regTerms: function () {
      return document.getElementById("regTerms").checked ? "" : "Please tick the box to confirm your details.";
    }
  },

  loginForm: {
    loginUser: function (v) {
      if (!v) return "Username or email is required.";
      if (v.indexOf("@") !== -1) { const g = checkGmailFormat(v); if (g) return g; }
      if (v.length < 3) return "Username must be at least 3 characters.";
      return "";
    },
    loginPass: function (v) { return v ? "" : "Password must not be blank."; },
    loginMfa: function (v) {
      if (!v) return "Verification code is required.";
      if (!/^\d+$/.test(v)) return "The code must contain numbers only.";
      if (v.length !== 6) return "The code must be exactly 6 digits (" + v.length + "/6).";
      if (v !== currentMfa) return "Incorrect code. Enter the 6-digit code shown below.";
      return "";
    }
  },

  userForm: {
    uFullName: function (v) {
      if (!v) return "Full name cannot be empty.";
      if (v.length < 3) return "Full name must be at least 3 characters.";
      if (!NAME_RE.test(v)) return "Name may contain letters, spaces, periods, hyphens and apostrophes only.";
      return "";
    },
    uUsername: function (v) {
      if (!v) return "Username is required.";
      if (v.length < 4 || v.length > 20) return "Username must be 4–20 characters long.";
      if (/[A-Z]/.test(v)) return "Capital letters are not allowed. Use lowercase only (e.g. j.delacruz).";
      if (!USERNAME_RE.test(v)) return "Use only lowercase letters, numbers, dots (.) or underscores (_). No spaces.";
      if (users.some(function (u) { return u.id !== editingUserId && u.username.toLowerCase() === v.toLowerCase(); })) return "This username is already taken. Choose another.";
      return "";
    },
    uEmail: function (v) { return checkGmail(v, users, editingUserId); },
    uDepartment: function (v) { return v ? "" : "Please select a department from the list."; },
    uPhone: function (v) {
      if (!v) return "Contact number is required.";
      if (!/^\d+$/.test(v)) return "Contact number must contain digits only (no spaces or dashes).";
      if (!PHONE_RE.test(v)) return "Enter an 11-digit PH mobile number starting with 09 (e.g. 09171234567).";
      return "";
    },
    uPassword: function (v) {
      if (!v && editingUserId) return "";      // editing: blank keeps the current password
      if (!v) return "Initial password is required.";
      if (v.length < 8) return "Password must contain at least 8 characters (" + v.length + "/8).";
      if (!/[A-Za-z]/.test(v) || !/\d/.test(v)) return "Password must include at least one letter and one number.";
      return "";
    },
    uStatus: function (v) { return v ? "" : "Please select a status."; }
  },

  roleForm: {
    rUserId: function (v) { return v ? "" : "User ID must not be empty. Select a user."; },
    accessRights: function () {
      return document.querySelectorAll(".acc-chk:checked").length ? "" : "Select at least one access right.";
    },
    rExpiry: function (v) {
      if (v && v < todayISO()) return "Expiration date cannot be in the past. Pick today or a future date.";
      return "";
    }
  },

  employeeForm: {
    empName: function (v) {
      if (!v) return "Full name is required.";
      if (v.length < 3) return "Full name must be at least 3 characters.";
      if (!NAME_RE.test(v)) return "Name may contain letters, spaces, periods, hyphens and apostrophes only.";
      return "";
    },
    empPosition: function (v) {
      if (!v) return "Position / job title is required.";
      if (v.length < 2) return "Position must be at least 2 characters.";
      return "";
    },
    empDepartment: function (v) { return v ? "" : "Please select a department."; },
    empRate: function (v) {
      if (!v) return "Daily rate is required.";
      const n = Number(v);
      if (isNaN(n)) return "Daily rate must be a number.";
      if (n < 300 || n > 5000) return "Daily rate must be between ₱300 and ₱5,000.";
      return "";
    },
    empEmail: function (v) { return checkGmail(v, employees, editingEmpId); },
    empPhone: function (v) {
      if (!v) return "Contact number is required.";
      if (!PHONE_RE.test(v)) return "Enter an 11-digit PH mobile number starting with 09 (e.g. 09171234567).";
      if (employees.some(function (x) { return x.id !== editingEmpId && x.phone === v; })) return "This contact number is already used by another employee.";
      return "";
    },
    empHired: function (v) {
      if (!v) return "Date hired is required.";
      if (v > todayISO()) return "Date hired cannot be a future date.";
      if (v < "1990-01-01") return "Date hired must be on or after Jan 1, 1990.";
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
  if (id === "accessRights") return document.querySelector("#roleForm .checkbox-row");
  if (id === "regTerms") return document.getElementById("regTerms").closest(".remember");
  const el = document.getElementById(id);
  return el && el.closest(".pw-wrap") ? el.closest(".pw-wrap") : el;
}

function showFieldState(id, msg) {
  const target = fieldTarget(id);
  if (!target) return;
  const input = (id === "accessRights" || id === "regTerms") ? target : document.getElementById(id);
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
    const el = firstBad === "accessRights" ? document.querySelector(".acc-chk") : document.getElementById(firstBad);
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
    if (id === "accessRights") {
      document.querySelectorAll(".acc-chk").forEach(function (c) {
        c.addEventListener("change", function () { validateField(formId, id); });
      });
      return;
    }
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener("blur", function () { if (el.value !== "" || el.classList.contains("is-invalid")) validateField(formId, id); });
    el.addEventListener("input", function () { if (el.classList.contains("is-invalid") || el.classList.contains("is-valid")) validateField(formId, id); });
    el.addEventListener("change", function () { if (el.tagName === "SELECT" || el.type === "date") validateField(formId, id); });
  });
});

// 3) Input constraints that depend on today's date
$("#rExpiry").min = todayISO();
$("#empHired").max = todayISO();
$("#caDate").max = todayISO();
// Digits only in the phone box
$("#uPhone").addEventListener("input", function () { this.value = this.value.replace(/\D/g, "").slice(0, 11); });

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
   REGISTRATION PAGE
   ================================================================ */
function showAuthCard(which) {
  $("#loginCard").hidden = which !== "login";
  $("#registerCard").hidden = which !== "register";
  $("#loginScreen").scrollTop = 0;
}
$("#showRegister").addEventListener("click", function (e) { e.preventDefault(); showAuthCard("register"); $("#regName").focus(); });
$("#showLogin").addEventListener("click", function (e) { e.preventDefault(); showAuthCard("login"); });

$("#regPhone").addEventListener("input", function () { this.value = this.value.replace(/\D/g, "").slice(0, 11); });
$("#regTerms").addEventListener("change", function () { validateField("registerForm", "regTerms"); });

// Password strength meter
$("#regPassword").addEventListener("input", function () {
  const v = this.value; let score = 0;
  if (v.length >= 8) score++;
  if (/[A-Za-z]/.test(v) && /\d/.test(v)) score++;
  if (/[A-Z]/.test(v) && /[a-z]/.test(v)) score++;
  if (/[^A-Za-z0-9]/.test(v) || v.length >= 12) score++;
  const bar = $("#pwMeterBar");
  bar.style.width = (v ? score * 25 : 0) + "%";
  bar.className = ["", "weak", "fair", "good", "strong"][score];
  if ($("#regConfirm").value) validateField("registerForm", "regConfirm");
});

$("#registerForm").addEventListener("submit", function (e) {
  e.preventDefault();                       // only reached when validation passed
  // 1) Create the EMPLOYEE record (the applicant becomes a new employee right away)
  const empNum = employees.length ? Math.max.apply(null, employees.map(function (x) { return parseInt(x.id.split("-")[1]); })) + 1 : 1;
  const position = $("#regPosition").value;
  const emp = {
    id: "EMP-" + String(empNum).padStart(3, "0"),
    fullName: val("regName"),
    position: position,
    department: $("#regDepartment").value,
    dailyRate: DEFAULT_RATES[position] || 500,   // admin can adjust later in Employees > Edit
    dateHired: $("#regHired").value,
    email: val("regEmail"),
    phone: val("regPhone")
  };
  employees.push(emp);
  saveAll();

  // 2) Create the linked USER ACCOUNT so the employee can open My Portal
  const num = Math.max.apply(null, users.map(function (u) { return parseInt(u.id.split("-")[1]); })) + 1;
  const u = {
    id: "USR-" + String(num).padStart(3, "0"),
    fullName: emp.fullName,
    username: val("regUsername"),
    email: emp.email,
    department: emp.department,
    phone: emp.phone,
    password: $("#regPassword").value,
    status: "Active",
    rights: ["read"],               // employee access: My Portal only
    expiry: "",
    empId: emp.id
  };
  users.push(u);
  logActivity("New employee registered: " + emp.id + " " + emp.fullName + " (" + emp.position + ", " + emp.department + ")");
  saveUsers(); renderUserTable(); populateUserSelect();
  renderEmployees(); renderDashboard(); populateEmployeeOptions();

  e.target.reset(); clearValidation(e.target);
  $("#regHired").value = todayISO();
  $("#pwMeterBar").style.width = "0";
  showAuthCard("login");
  $("#loginUser").value = u.username;
  $("#loginPass").focus();
  const el = $("#loginError");
  el.textContent = "Registration successful! Welcome to Joecon's, " + emp.fullName.split(" ")[0] + ". You are now employee " + emp.id + ". Sign in to open your portal.";
  el.classList.add("show", "success");
});
$("#loginForm").addEventListener("submit", function () { $("#loginError").classList.remove("success"); }, true);


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
  alert("Your password has been updated.");
});

function renderLog() {
  const body = document.getElementById("logTable");
  if (!body) return;
  const log = store.get("jems2_log", []).slice().reverse().slice(0, 60);
  body.innerHTML = log.length
    ? log.map(function (l) {
        const d = new Date(l.at);
        return "<tr><td style='white-space:nowrap'>" + fmtDate(l.at.slice(0, 10)) + " " + fmtTime(d) + "</td>" +
               "<td><strong>" + l.user + "</strong></td><td>" + l.action + "</td></tr>";
      }).join("")
    : '<tr><td colspan="3" class="empty">No activity recorded yet.</td></tr>';
}
$("#btnClearLog").addEventListener("click", function () {
  if (!confirm("Clear the entire activity log?")) return;
  store.set("jems2_log", []);
  logActivity("Cleared the activity log");
});
renderLog();


// Live Gmail checking while typing (all Gmail fields)
["regEmail", "uEmail", "empEmail"].forEach(function (id) {
  const el = document.getElementById(id);
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
  if (sec === "usermgmt" && !can("admin")) return;
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
  if (!can("admin")) return alert("Only administrators can export a data backup.");
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

  if (can("admin")) {
    const pending = users.filter(function (u) { return u.status === "Pending"; });
    if (pending.length) list.push({ key: "pending-" + pending.map(function (u) { return u.id; }).join(","), type: "warn", go: "usermgmt",
      text: pending.length + " account" + (pending.length > 1 ? "s" : "") + " waiting for approval: " + pending.map(function (u) { return u.username; }).join(", ") });

    const soon = users.filter(function (u) {
      if (!u.expiry || isExpired(u)) return false;
      return (new Date(u.expiry) - new Date(today)) / 86400000 <= 7;
    });
    soon.forEach(function (u) { list.push({ key: "exp-" + u.id + u.expiry, type: "warn", go: "usermgmt", text: "Access for " + u.username + " expires on " + fmtDate(u.expiry) }); });
  }

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
    '<li><strong>Employees:</strong> add a worker with the form. Use the <b>&hellip;</b> menu on a card to edit, record attendance, add a cash advance, or remove.</li>' +
    '<li><strong>Attendance:</strong> select an employee and press <b>Time In</b> / <b>Time Out</b>. Arriving after 8:00 AM is marked late automatically.</li>' +
    '<li><strong>Cash Advance:</strong> record the amount and date; it is deducted in the payroll for that period.</li>' +
    '<li><strong>Payroll:</strong> pick the period and press <b>Generate Payroll</b>. Use <b>Print Report</b> for a paper copy.</li>' +
    '<li><strong>Reports:</strong> attendance and deduction summary for any date range.</li>' +
    '<li><strong>User Management</strong> (admin): add users, approve registrations, set access rights, and view the activity log.</li>' +
    '<li><strong>Top bar:</strong> search employees, <b>+</b> quick add, bell for notifications, avatar for password change and sign out.</li>' +
    '</ol>' +
    '<p class="note"><strong>Need more help?</strong> Contact the system administrator at <b>joeconsteelworks@gmail.com</b>.</p>');
});

// Refresh notifications whenever someone signs in
$("#loginForm").addEventListener("submit", function () { setTimeout(renderNotifications, 0); });


/* ================================================================
   LOGIN MFA (demo one-time code)
   A new 6-digit code is generated each time the login screen loads.
   In a real system it would be sent by SMS or email; here it is
   shown under the field so the validation can be demonstrated.
   ================================================================ */
var currentMfa = "";
function newMfaCode() {
  currentMfa = String(Math.floor(100000 + Math.random() * 900000));
  $("#mfaCode").textContent = currentMfa;
  $("#loginMfa").value = "";
}
newMfaCode();
$("#mfaNew").addEventListener("click", function (e) { e.preventDefault(); newMfaCode(); $("#loginMfa").focus(); });
$("#loginMfa").addEventListener("input", function () { this.value = this.value.replace(/\D/g, "").slice(0, 6); });

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
   EMPLOYEE REGISTRATION DEFAULTS
   ================================================================ */
var DEFAULT_RATES = { "Welder": 650, "Fabricator": 600, "Laborer": 500, "Foreman": 750, "Helper": 480, "HR Staff": 560, "Timekeeper / Staff": 550 };
$("#regHired").value = todayISO();
$("#regHired").max = todayISO();

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
  $("#pSub").textContent = emp.position + " · " + emp.department + " · Hired " + fmtDate(emp.dateHired) + " · Daily rate " + money(emp.dailyRate);

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
