/* ============================================================
   JOECON EMS API
   Frontend (Live Server or Express) -> Node/Express -> MySQL
   ============================================================ */
(function () {
  "use strict";

  // When the frontend is opened with VS Code Live Server, the API is
  // still served by Node/Express on port 3000. When the frontend is
  // served by Express itself, the same origin is used automatically.
  const API_BASE =
    window.location.port === "3000"
      ? "/api"
      : "http://localhost:3000/api";

  async function request(endpoint, options = {}) {
    const config = {
      method: options.method || "GET",
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {})
      }
    };

    if (options.body !== undefined) {
      config.body = JSON.stringify(options.body);
    }

    const response = await fetch(API_BASE + endpoint, config);
    let data;

    try {
      data = await response.json();
    } catch (_) {
      data = { success: false, message: "Invalid server response." };
    }

    if (!response.ok) {
      throw new Error(data.message || `Request failed (${response.status})`);
    }

    return data;
  }

  function localSet(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (_) {}
  }

  async function testConnection() { return request("/test"); }

  // ---------------- Employees ----------------
  async function getEmployees() { return request("/employees"); }
  async function addEmployee(employee) {
    return request("/employees", { method: "POST", body: employee });
  }
  async function updateEmployee(id, employee) {
    return request(`/employees/${encodeURIComponent(id)}`, { method: "PUT", body: employee });
  }
  async function deleteEmployee(id) {
    return request(`/employees/${encodeURIComponent(id)}`, { method: "DELETE" });
  }

  // ---------------- Attendance ----------------
  async function getAttendance() { return request("/attendance"); }
  async function addAttendance(record) {
    return request("/attendance", { method: "POST", body: record });
  }
  async function deleteAttendance(id) {
    return request(`/attendance/${encodeURIComponent(id)}`, { method: "DELETE" });
  }

  // ---------------- Cash Advance ----------------
  async function getCashAdvances() { return request("/cash-advances"); }
  async function addCashAdvance(record) {
    return request("/cash-advances", { method: "POST", body: record });
  }
  async function updateCashAdvance(id, record) {
    return request(`/cash-advances/${encodeURIComponent(id)}`, { method: "PUT", body: record });
  }
  async function updateCashAdvanceStatus(id, status) {
    return request(`/cash-advances/${encodeURIComponent(id)}/status`, {
      method: "PUT", body: { status }
    });
  }
  async function deleteCashAdvance(id) {
    return request(`/cash-advances/${encodeURIComponent(id)}`, { method: "DELETE" });
  }

  // ---------------- Payroll / Reports ----------------
  async function getPayroll(from, to) {
    return request(`/payroll?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`);
  }
  async function getReports(from, to) {
    return request(`/reports?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`);
  }

  async function syncEmployees(list) {
    const dbRows = await getEmployees();
    const dbMap = new Map(dbRows.map(x => [x.id, x]));
    const localMap = new Map(list.filter(x => x && x.id).map(x => [x.id, x]));

    for (const employee of list) {
      if (!employee || !employee.id) continue;
      if (dbMap.has(employee.id)) {
        await updateEmployee(employee.id, employee);
      } else {
        const result = await addEmployee(employee);
        if (result.id && result.id !== employee.id) {
          const oldId = employee.id;
          employee.id = result.id;
          employee.fullName = employee.fullName ||
            [employee.firstName, employee.middleName, employee.lastName].filter(Boolean).join(" ");
          // Update local attendance/CA references after the database assigned ID.
          try {
            const att = JSON.parse(localStorage.getItem("jems2_attendance") || "[]");
            att.forEach(a => { if (a.empId === oldId) a.empId = result.id; });
            localSet("jems2_attendance", att);
            const ca = JSON.parse(localStorage.getItem("jems2_cashAdvances") || "[]");
            ca.forEach(c => { if (c.empId === oldId) c.empId = result.id; });
            localSet("jems2_cashAdvances", ca);
          } catch (_) {}
        }
      }
    }

    // Delete records that were removed from the browser collection.
    for (const row of dbRows) {
      if (!localMap.has(row.id)) {
        await deleteEmployee(row.id);
      }
    }

    localSet("jems2_employees", list);
  }

  async function syncAttendance(list) {
    const dbRows = await getAttendance();
    const dbKeys = new Set(dbRows.map(x => `${x.empId}|${x.date}`));

    for (const row of list) {
      if (!row || !row.empId || !row.date) continue;
      await addAttendance({
        empId: row.empId,
        date: row.date,
        timeIn: row.timeIn || null,
        timeOut: row.timeOut || null,
        lateMin: Number(row.lateMin || 0),
        hoursWorked: Number(row.hoursWorked || 0),
        status: row.status || "Present"
      });
      dbKeys.delete(`${row.empId}|${row.date}`);
    }

    // Only delete database rows that are no longer in the local collection.
    for (const row of dbRows) {
      if (dbKeys.has(`${row.empId}|${row.date}`)) {
        await deleteAttendance(row.id);
      }
    }

    localSet("jems2_attendance", list);
  }

  async function syncCashAdvances(list) {
    const dbRows = await getCashAdvances();
    const dbMap = new Map(dbRows.map(x => [String(x.id), x]));
    const localIds = new Set();

    for (const row of list) {
      if (!row || !row.empId || !row.date) continue;
      const id = String(row.id);
      if (dbMap.has(id)) {
        await updateCashAdvance(row.id, {
          empId: row.empId, date: row.date, amount: Number(row.amount || 0),
          notes: row.notes || "", status: row.status || "For Deduction"
        });
        localIds.add(id);
      } else {
        const result = await addCashAdvance({
          empId: row.empId, date: row.date, amount: Number(row.amount || 0),
          notes: row.notes || "", status: row.status || "For Deduction"
        });
        if (result.ca_id !== undefined) row.id = result.ca_id;
        localIds.add(String(row.id));
      }
    }

    for (const row of dbRows) {
      if (!localIds.has(String(row.id))) await deleteCashAdvance(row.id);
    }

    localSet("jems2_cashAdvances", list);
  }

  async function init() {
    const result = await testConnection();
    console.log("[EMS API] Connected to MySQL:", result.database);

    const [employees, attendance, cashAdvances] = await Promise.all([
      getEmployees(), getAttendance(), getCashAdvances()
    ]);

    localSet("jems2_employees", employees);
    localSet("jems2_attendance", attendance);
    localSet("jems2_cashAdvances", cashAdvances);

    return { employees, attendance, cashAdvances };
  }

  // Existing script.js calls this after every saveAll(). Queue the
  // synchronizations so the three saveAll() calls cannot race each other.
  let syncQueue = Promise.resolve();

  function save(key, value) {
    localSet(key, value);
    syncQueue = syncQueue.then(async function () {
      if (key === "jems2_employees") await syncEmployees(value);
      else if (key === "jems2_attendance") await syncAttendance(value);
      else if (key === "jems2_cashAdvances") await syncCashAdvances(value);
    }).catch(function (error) {
      console.error(`[EMS API] Failed to save ${key}:`, error);
      // The browser mirror remains available even if MySQL is temporarily down.
    });
    return syncQueue;
  }

  window.EMS_API = {
    init, save, testConnection,
    getEmployees, addEmployee, updateEmployee, deleteEmployee,
    getAttendance, addAttendance, deleteAttendance,
    getCashAdvances, addCashAdvance, updateCashAdvance,
    updateCashAdvanceStatus, deleteCashAdvance,
    getPayroll, getReports
  };

  console.log("[EMS API] api.js loaded. API:", API_BASE);
})();
