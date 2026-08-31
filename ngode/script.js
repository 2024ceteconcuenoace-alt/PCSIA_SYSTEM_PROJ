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
  usermgmt: "User Management"
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
    const matchQ = !q || (e.fullName + " " + e.position + " " + e.id + " " + (e.department || "")).toLowerCase().indexOf(q) !== -1;
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
      '<div class="emp-contact">' + (e.department || "—") + ' Department</div>' +
      '<div class="emp-contact">Hired ' + fmtDate(e.dateHired) + '</div>' +
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
      if (confirm("Remove this employee? Attendance and CA records will be kept.")) {
        employees = employees.filter(function (x) { return x.id !== id; });
        saveAll();
        renderEmployees(); renderDashboard();
      }
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
  e.preventDefault();
  const name = $("#empName").value.trim();
  const position = $("#empPosition").value.trim();
  const department = $("#empDepartment").value;
  const rate = parseFloat($("#empRate").value);
  const hired = $("#empHired").value || todayISO();
  if (!name || !position || !(rate > 0)) return;
  const num = employees.length ? Math.max.apply(null, employees.map(x => parseInt(x.id.split("-")[1]))) + 1 : 1;
  employees.push({
    id: "EMP-" + String(num).padStart(3, "0"),
    fullName: name, position: position, department: department, dailyRate: rate, dateHired: hired
  });
  saveAll();
  renderEmployees(); renderDashboard();
  e.target.reset();
  $("#empHired").value = todayISO();
  $("#empName").focus();
});

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

$("#btnGeneratePayroll").addEventListener("click", renderPayroll);
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
if (!employees || !attendance || !cashAdvances) {
  seedSampleData();
} else {
  // Backfill new fields for any older records
  employees.forEach(function (e, i) {
    if (!e.department) e.department = "Fabrication";
    if (!e.dateHired) e.dateHired = todayISO();
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
    { id: "USR-001", username: "admin",       email: "admin@joecon.com",       department: "Admin / HR",
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
  if (!u || u.password !== pass) return setLoginError("Invalid username/email or password.");
  if (u.status !== "Active")   return setLoginError("This account is Inactive. Contact the administrator.");
  if (isExpired(u))            return setLoginError("This account has expired on " + fmtDate(u.expiry) + ".");

  currentUser = u;
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
  e.preventDefault();
  const username = $("#uUsername").value.trim();
  const email = $("#uEmail").value.trim();
  const department = $("#uDepartment").value;
  const password = $("#uPassword").value;
  const status = $("#uStatus").value;
  if (!username || !email || !password) return;

  const dup = users.some(function (u) {
    return u.username.toLowerCase() === username.toLowerCase() || u.email.toLowerCase() === email.toLowerCase();
  });
  if (dup) return setFormMsg("#userFormMsg", "Username or email already exists.", false);

  const num = users.length ? Math.max.apply(null, users.map(function (u) { return parseInt(u.id.split("-")[1]); })) + 1 : 1;
  users.push({
    id: "USR-" + String(num).padStart(3, "0"),
    username: username, email: email, department: department,
    password: password, status: status,
    rights: ["read"], expiry: ""
  });
  saveUsers();
  renderUserTable();
  populateUserSelect();
  setFormMsg("#userFormMsg", "User " + username + " added (default: Read only). Assign access rights in Form 2.", true);
  e.target.reset();
  $("#uDepartment").value = "Admin / HR";
});

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
        const delBtn = (currentUser && currentUser.id === u.id)
          ? '<span class="note" style="margin:0;">Current user</span>'
          : '<button class="btn btn-outline btn-sm" data-del-user="' + u.id + '">Remove</button>';
        return "<tr>" +
          "<td><strong>" + u.id + "</strong></td>" +
          "<td>" + u.username + "</td>" +
          "<td>" + u.email + "</td>" +
          "<td>" + u.department + "</td>" +
          "<td>" + badges + "</td>" +
          "<td>" + exp + "</td>" +
          "<td><span class='status-pill " + (u.status === "Active" ? "active" : "inactive") + "'>" + u.status + "</span></td>" +
          '<td class="text-right">' + delBtn + "</td>" +
        "</tr>";
      }).join("")
    : '<tr><td colspan="8" class="empty">No users yet.</td></tr>';
}

document.addEventListener("click", function (e) {
  const id = e.target.dataset.delUser;
  if (!id) return;
  if (id === "USR-001") return alert("The default admin account cannot be removed.");
  if (!confirm("Remove this user account?")) return;
  users = users.filter(function (x) { return x.id !== id; });
  saveUsers();
  renderUserTable();
  populateUserSelect();
});

// ---------------- Auth init ----------------
(function initAuth() {
  if (!users || !users.length) {
    users = defaultUsers();
    saveUsers();
  }
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
