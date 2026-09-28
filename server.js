// ============================================================
// JOECON EMS
// Node.js + Express + MySQL Backend
// ============================================================

const express = require("express");
const mysql = require("mysql2/promise");
const cors = require("cors");
const path = require("path");
require("dotenv").config();

const app = express();

const PORT = process.env.PORT || 3000;


// ============================================================
// MIDDLEWARE
// ============================================================

app.use(cors());

app.use(express.json());

app.use(
    express.urlencoded({
        extended: true
    })
);


// Serve frontend files from /ngode
app.use(
    express.static(path.join(__dirname, "ngode"))
);

app.use(
    "/images",
    express.static(path.join(__dirname, "images"))
);


// ============================================================
// MYSQL CONNECTION
// ============================================================

const db = mysql.createPool({

    host: process.env.DB_HOST,

    user: process.env.DB_USER,

    password: process.env.DB_PASSWORD,

    database: process.env.DB_NAME,

    port:
        Number(process.env.DB_PORT) ||
        3306,

    waitForConnections: true,

    connectionLimit: 10,

    queueLimit: 0

});


// ============================================================
// TEST MYSQL CONNECTION
// ============================================================

app.get("/api/test", async (req, res) => {

    try {

        const [rows] =
            await db.query(
                "SELECT 1 AS connected"
            );


        res.json({

            success: true,

            message:
                "Node.js is connected to MySQL.",

            database:
                process.env.DB_NAME,

            result:
                rows

        });

    } catch (error) {

        console.error(
            "MySQL connection error:",
            error
        );


        res.status(500).json({

            success: false,

            message:
                "Failed to connect to MySQL.",

            error:
                error.message

        });

    }

});


// ============================================================
// ============================================================
// EMPLOYEES
// ============================================================
// ============================================================


// ============================================================
// GET ALL EMPLOYEES
// ============================================================

app.get(
    "/api/employees",
    async (req, res) => {

        try {

            const [rows] =
                await db.query(`

                    SELECT
                        employee_id,
                        first_name,
                        middle_name,
                        last_name,
                        gender,
                        birthdate,
                        phone_number,
                        country,
                        region,
                        city_municipality,
                        barangay,
                        street_house_no,
                        postal_code,
                        position,
                        daily_rate,
                        date_hired,
                        email,
                        created_at,
                        updated_at

                    FROM employees

                    ORDER BY
                        employee_id ASC

                `);


            const employees =
                rows.map(employee => ({

                    id:
                        "EMP-" +
                        String(
                            employee.employee_id
                        ).padStart(3, "0"),


                    fullName:
                        [
                            employee.first_name,
                            employee.middle_name,
                            employee.last_name
                        ]
                            .filter(Boolean)
                            .join(" "),


                    firstName:
                        employee.first_name,


                    middleName:
                        employee.middle_name ||
                        "",


                    lastName:
                        employee.last_name,


                    gender:
                        employee.gender,


                    birthday:
                        employee.birthdate
                            ? formatDate(
                                employee.birthdate
                            )
                            : "",


                    address: {

                        street:
                            employee.street_house_no ||
                            "",

                        barangay:
                            employee.barangay ||
                            "",

                        city:
                            employee.city_municipality ||
                            "",

                        region:
                            employee.region ||
                            "",

                        postal:
                            employee.postal_code ||
                            "",

                        country:
                            employee.country ||
                            ""

                    },


                    position:
                        employee.position ||
                        "",


                    dailyRate:
                        Number(
                            employee.daily_rate ||
                            0
                        ),


                    dateHired:
                        employee.date_hired
                            ? formatDate(
                                employee.date_hired
                            )
                            : "",


                    email:
                        employee.email ||
                        "",


                    phone:
                        employee.phone_number ||
                        ""

                }));


            res.json(employees);


        } catch (error) {

            console.error(
                "GET employees error:",
                error
            );


            res.status(500).json({

                success: false,

                message:
                    error.message

            });

        }

    }
);


// ============================================================
// ADD EMPLOYEE
// ============================================================

app.post(
    "/api/employees",
    async (req, res) => {

        try {

            const employee =
                req.body || {};


            if (
                !employee.firstName ||
                !employee.lastName
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "First name and last name are required."

                });

            }


            const firstName =
                employee.firstName ??
                null;

            const middleName =
                employee.middleName ??
                null;

            const lastName =
                employee.lastName ??
                null;

            const gender =
                employee.gender ??
                "Other";

            const birthday =
                employee.birthday ??
                null;

            const phone =
                employee.phone ??
                null;


            const country =
                employee.address?.country ??
                null;

            const region =
                employee.address?.region ??
                null;

            const city =
                employee.address?.city ??
                null;

            const barangay =
                employee.address?.barangay ??
                null;

            const street =
                employee.address?.street ??
                null;

            const postal =
                employee.address?.postal ??
                null;


            const position =
                employee.position ??
                null;

            const dailyRate =
                Number(
                    employee.dailyRate ??
                    0
                );

            const dateHired =
                employee.dateHired ??
                null;

            const email =
                employee.email ??
                null;


            const [result] =
                await db.execute(

                    `

                    INSERT INTO employees (

                        first_name,
                        middle_name,
                        last_name,
                        gender,
                        birthdate,
                        phone_number,
                        country,
                        region,
                        city_municipality,
                        barangay,
                        street_house_no,
                        postal_code,
                        position,
                        daily_rate,
                        date_hired,
                        email

                    )

                    VALUES (
                        ?, ?, ?, ?, ?,
                        ?, ?, ?, ?, ?,
                        ?, ?, ?, ?, ?,
                        ?
                    )

                    `,

                    [

                        firstName,
                        middleName,
                        lastName,
                        gender,
                        birthday,
                        phone,
                        country,
                        region,
                        city,
                        barangay,
                        street,
                        postal,
                        position,
                        dailyRate,
                        dateHired,
                        email

                    ]

                );


            const employeeCode =
                "EMP-" +
                String(
                    result.insertId
                ).padStart(3, "0");


            res.status(201).json({

                success: true,

                message:
                    "Employee added successfully.",

                id:
                    employeeCode,

                employee_id:
                    result.insertId

            });


        } catch (error) {

            console.error(
                "POST employee error:",
                error
            );


            res.status(500).json({

                success: false,

                message:
                    error.message

            });

        }

    }
);


// ============================================================
// UPDATE EMPLOYEE
// ============================================================

app.put(
    "/api/employees/:id",
    async (req, res) => {

        try {

            const employeeCode =
                req.params.id;


            const employeeId =
                getNumericEmployeeId(
                    employeeCode
                );


            if (!employeeId) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Invalid employee ID."

                });

            }


            const employee =
                req.body || {};


            const firstName =
                employee.firstName ??
                null;

            const middleName =
                employee.middleName ??
                null;

            const lastName =
                employee.lastName ??
                null;

            const gender =
                employee.gender ??
                null;

            const birthday =
                employee.birthday ??
                null;

            const phone =
                employee.phone ??
                null;


            const country =
                employee.address?.country ??
                null;

            const region =
                employee.address?.region ??
                null;

            const city =
                employee.address?.city ??
                null;

            const barangay =
                employee.address?.barangay ??
                null;

            const street =
                employee.address?.street ??
                null;

            const postal =
                employee.address?.postal ??
                null;


            const position =
                employee.position ??
                null;

            const dailyRate =
                Number(
                    employee.dailyRate ??
                    0
                );

            const dateHired =
                employee.dateHired ??
                null;

            const email =
                employee.email ??
                null;


            const [result] =
                await db.execute(

                    `

                    UPDATE employees

                    SET

                        first_name = ?,
                        middle_name = ?,
                        last_name = ?,
                        gender = ?,
                        birthdate = ?,
                        phone_number = ?,
                        country = ?,
                        region = ?,
                        city_municipality = ?,
                        barangay = ?,
                        street_house_no = ?,
                        postal_code = ?,
                        position = ?,
                        daily_rate = ?,
                        date_hired = ?,
                        email = ?

                    WHERE employee_id = ?

                    `,

                    [

                        firstName,
                        middleName,
                        lastName,
                        gender,
                        birthday,
                        phone,
                        country,
                        region,
                        city,
                        barangay,
                        street,
                        postal,
                        position,
                        dailyRate,
                        dateHired,
                        email,
                        employeeId

                    ]

                );


            if (
                result.affectedRows === 0
            ) {

                return res.status(404).json({

                    success: false,

                    message:
                        "Employee not found."

                });

            }


            res.json({

                success: true,

                message:
                    "Employee updated successfully."

            });


        } catch (error) {

            console.error(
                "PUT employee error:",
                error
            );


            res.status(500).json({

                success: false,

                message:
                    error.message

            });

        }

    }
);


// ============================================================
// DELETE EMPLOYEE
// ============================================================

app.delete(
    "/api/employees/:id",
    async (req, res) => {

        try {

            const employeeCode =
                req.params.id;


            const employeeId =
                getNumericEmployeeId(
                    employeeCode
                );


            if (!employeeId) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Invalid employee ID."

                });

            }


            const [result] =
                await db.execute(

                    `

                    DELETE FROM employees

                    WHERE employee_id = ?

                    `,

                    [
                        employeeId
                    ]

                );


            if (
                result.affectedRows === 0
            ) {

                return res.status(404).json({

                    success: false,

                    message:
                        "Employee not found."

                });

            }


            res.json({

                success: true,

                message:
                    "Employee deleted successfully."

            });


        } catch (error) {

            console.error(
                "DELETE employee error:",
                error
            );


            res.status(500).json({

                success: false,

                message:
                    error.message

            });

        }

    }
);


// ============================================================
// ============================================================
// ATTENDANCE
// ============================================================
// ============================================================


// ============================================================
// GET ATTENDANCE
// ============================================================

app.get(
    "/api/attendance",
    async (req, res) => {

        try {

            const [rows] =
                await db.query(`

                    SELECT

                        attendance_id,
                        employee_id,
                        attendance_date,
                        time_in,
                        time_out,
                        status,
                        hours_worked,
                        late_minutes,
                        created_at

                    FROM attendance

                    ORDER BY
                        attendance_date DESC,
                        attendance_id DESC

                `);


            const attendance =
                rows.map(row => ({

                    id:
                        row.attendance_id,


                    empId:
                        "EMP-" +
                        String(
                            row.employee_id
                        ).padStart(3, "0"),


                    date:
                        formatDate(
                            row.attendance_date
                        ),


                    timeIn:
                        row.time_in
                            ? formatDateTime(
                                row.time_in
                            )
                            : null,


                    timeOut:
                        row.time_out
                            ? formatDateTime(
                                row.time_out
                            )
                            : null,


                    status:
                        row.status,


                    hoursWorked:
                        Number(
                            row.hours_worked ||
                            0
                        ),


                    lateMin:
                        Number(
                            row.late_minutes ||
                            0
                        )

                }));


            res.json(attendance);


        } catch (error) {

            console.error(
                "GET attendance error:",
                error
            );


            res.status(500).json({

                success: false,

                message:
                    error.message

            });

        }

    }
);


// ============================================================
// ADD / UPDATE ATTENDANCE
// ============================================================

app.post(
    "/api/attendance",
    async (req, res) => {

        try {

            const attendance =
                req.body || {};


            const employeeId =
                getNumericEmployeeId(
                    attendance.empId
                );


            if (!employeeId) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Invalid employee ID."

                });

            }


            const date =
                attendance.date ??
                null;


            if (!date) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Attendance date is required."

                });

            }


            const timeIn =
                normalizeDateTime(
                    attendance.timeIn
                );


            const timeOut =
                normalizeDateTime(
                    attendance.timeOut
                );


            const lateMin =
                toNumber(
                    attendance.lateMin,
                    0
                );


            let hoursWorked =
                toNumber(
                    attendance.hoursWorked,
                    0
                );


            let status =
                attendance.status ??
                "Present";


            // ------------------------------------------------
            // Calculate hours worked
            // ------------------------------------------------

            if (
                timeIn &&
                timeOut
            ) {

                const start =
                    new Date(
                        timeIn.replace(
                            " ",
                            "T"
                        )
                    );


                const end =
                    new Date(
                        timeOut.replace(
                            " ",
                            "T"
                        )
                    );


                if (
                    !Number.isNaN(
                        start.getTime()
                    ) &&
                    !Number.isNaN(
                        end.getTime()
                    )
                ) {

                    hoursWorked =
                        Math.max(
                            0,
                            (
                                end - start
                            ) /
                            3600000
                        );

                }

            }


            // ------------------------------------------------
            // Determine status
            // ------------------------------------------------

            if (!timeIn) {

                status =
                    "Absent";

            } else if (!timeOut) {

                status =
                    "Incomplete";

            } else if (
                lateMin > 0
            ) {

                status =
                    "Late";

            } else {

                status =
                    "Present";

            }


            // ------------------------------------------------
            // Check existing attendance
            // for employee + date
            // ------------------------------------------------

            const [existing] =
                await db.execute(

                    `

                    SELECT
                        attendance_id

                    FROM attendance

                    WHERE employee_id = ?

                    AND attendance_date = ?

                    LIMIT 1

                    `,

                    [
                        employeeId,
                        date
                    ]

                );


            // ------------------------------------------------
            // UPDATE
            // ------------------------------------------------

            if (
                existing.length > 0
            ) {

                const attendanceId =
                    existing[0]
                        .attendance_id;


                await db.execute(

                    `

                    UPDATE attendance

                    SET

                        time_in = ?,
                        time_out = ?,
                        status = ?,
                        hours_worked = ?,
                        late_minutes = ?

                    WHERE attendance_id = ?

                    `,

                    [

                        timeIn,
                        timeOut,
                        status,
                        hoursWorked,
                        lateMin,
                        attendanceId

                    ]

                );


                return res.json({

                    success: true,

                    message:
                        "Attendance updated successfully.",

                    attendance_id:
                        attendanceId

                });

            }


            // ------------------------------------------------
            // INSERT
            // ------------------------------------------------

            const [result] =
                await db.execute(

                    `

                    INSERT INTO attendance (

                        employee_id,
                        attendance_date,
                        time_in,
                        time_out,
                        status,
                        hours_worked,
                        late_minutes

                    )

                    VALUES (
                        ?, ?, ?, ?, ?, ?, ?
                    )

                    `,

                    [

                        employeeId,
                        date,
                        timeIn,
                        timeOut,
                        status,
                        hoursWorked,
                        lateMin

                    ]

                );


            res.status(201).json({

                success: true,

                message:
                    "Attendance recorded successfully.",

                attendance_id:
                    result.insertId

            });


        } catch (error) {

            console.error(
                "POST attendance error:",
                error
            );


            res.status(500).json({

                success: false,

                message:
                    error.message

            });

        }

    }
);


// ============================================================
// DELETE ATTENDANCE
// ============================================================

app.delete(
    "/api/attendance/:id",
    async (req, res) => {

        try {

            const id =
                Number(
                    req.params.id
                );


            if (!Number.isInteger(id)) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Invalid attendance ID."

                });

            }


            const [result] =
                await db.execute(

                    `

                    DELETE FROM attendance

                    WHERE attendance_id = ?

                    `,

                    [
                        id
                    ]

                );


            if (
                result.affectedRows === 0
            ) {

                return res.status(404).json({

                    success: false,

                    message:
                        "Attendance record not found."

                });

            }


            res.json({

                success: true,

                message:
                    "Attendance deleted successfully."

            });


        } catch (error) {

            console.error(
                "DELETE attendance error:",
                error
            );


            res.status(500).json({

                success: false,

                message:
                    error.message

            });

        }

    }
);


// ============================================================
// ============================================================
// CASH ADVANCE
// ============================================================
// ============================================================


// ============================================================
// GET CASH ADVANCES
// ============================================================

app.get(
    "/api/cash-advances",
    async (req, res) => {

        try {

            const [rows] =
                await db.query(`

                    SELECT

                        ca_id,
                        employee_id,
                        date_released,
                        amount,
                        purpose,
                        status,
                        created_at

                    FROM cash_advance

                    ORDER BY
                        date_released DESC,
                        ca_id DESC

                `);


            const cashAdvances =
                rows.map(row => ({

                    id:
                        row.ca_id,


                    empId:
                        "EMP-" +
                        String(
                            row.employee_id
                        ).padStart(3, "0"),


                    date:
                        formatDate(
                            row.date_released
                        ),


                    amount:
                        Number(
                            row.amount ||
                            0
                        ),


                    notes:
                        row.purpose ||
                        "",


                    status:
                        row.status

                }));


            res.json(
                cashAdvances
            );


        } catch (error) {

            console.error(
                "GET cash advances error:",
                error
            );


            res.status(500).json({

                success: false,

                message:
                    error.message

            });

        }

    }
);


// ============================================================
// ADD CASH ADVANCE
// ============================================================

app.post(
    "/api/cash-advances",
    async (req, res) => {

        try {

            const cash =
                req.body || {};


            const employeeId =
                getNumericEmployeeId(
                    cash.empId
                );


            if (!employeeId) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Invalid employee ID."

                });

            }


            const date =
                cash.date ??
                null;


            const amount =
                toNumber(
                    cash.amount,
                    0
                );


            const purpose =
                cash.notes ??
                cash.purpose ??
                null;


            const status =
                cash.status ??
                "For Deduction";


            if (!date) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Release date is required."

                });

            }


            if (
                amount <= 0
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Cash advance amount must be greater than zero."

                });

            }


            const [result] =
                await db.execute(

                    `

                    INSERT INTO cash_advance (

                        employee_id,
                        date_released,
                        amount,
                        purpose,
                        status

                    )

                    VALUES (
                        ?, ?, ?, ?, ?
                    )

                    `,

                    [

                        employeeId,
                        date,
                        amount,
                        purpose,
                        status

                    ]

                );


            res.status(201).json({

                success: true,

                message:
                    "Cash advance recorded successfully.",

                ca_id:
                    result.insertId

            });


        } catch (error) {

            console.error(
                "POST cash advance error:",
                error
            );


            res.status(500).json({

                success: false,

                message:
                    error.message

            });

        }

    }
);


// ============================================================
// UPDATE CASH ADVANCE
// ============================================================

app.put(
    "/api/cash-advances/:id",
    async (req, res) => {

        try {

            const id =
                Number(
                    req.params.id
                );


            if (!Number.isInteger(id)) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Invalid cash advance ID."

                });

            }


            const cash =
                req.body || {};


            const employeeId =
                getNumericEmployeeId(
                    cash.empId
                );


            const date =
                cash.date ??
                null;


            const amount =
                toNumber(
                    cash.amount,
                    0
                );


            const purpose =
                cash.notes ??
                cash.purpose ??
                null;


            const status =
                cash.status ??
                "For Deduction";


            if (!employeeId) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Invalid employee ID."

                });

            }


            const [result] =
                await db.execute(

                    `

                    UPDATE cash_advance

                    SET

                        employee_id = ?,
                        date_released = ?,
                        amount = ?,
                        purpose = ?,
                        status = ?

                    WHERE ca_id = ?

                    `,

                    [

                        employeeId,
                        date,
                        amount,
                        purpose,
                        status,
                        id

                    ]

                );


            if (
                result.affectedRows === 0
            ) {

                return res.status(404).json({

                    success: false,

                    message:
                        "Cash advance not found."

                });

            }


            res.json({

                success: true,

                message:
                    "Cash advance updated successfully."

            });


        } catch (error) {

            console.error(
                "PUT cash advance error:",
                error
            );


            res.status(500).json({

                success: false,

                message:
                    error.message

            });

        }

    }
);


// ============================================================
// UPDATE CASH ADVANCE STATUS
// ============================================================

app.put(
    "/api/cash-advances/:id/status",
    async (req, res) => {

        try {

            const id =
                Number(
                    req.params.id
                );


            const status =
                req.body?.status ??
                null;


            const allowedStatuses = [

                "For Deduction",

                "Paid",

                "Cancelled"

            ];


            if (
                !allowedStatuses.includes(
                    status
                )
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Invalid cash advance status."

                });

            }


            const [result] =
                await db.execute(

                    `

                    UPDATE cash_advance

                    SET status = ?

                    WHERE ca_id = ?

                    `,

                    [
                        status,
                        id
                    ]

                );


            if (
                result.affectedRows === 0
            ) {

                return res.status(404).json({

                    success: false,

                    message:
                        "Cash advance not found."

                });

            }


            res.json({

                success: true,

                message:
                    "Cash advance status updated."

            });


        } catch (error) {

            console.error(
                "UPDATE cash advance status error:",
                error
            );


            res.status(500).json({

                success: false,

                message:
                    error.message

            });

        }

    }
);


// ============================================================
// DELETE CASH ADVANCE
// ============================================================

app.delete(
    "/api/cash-advances/:id",
    async (req, res) => {

        try {

            const id =
                Number(
                    req.params.id
                );


            if (!Number.isInteger(id)) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Invalid cash advance ID."

                });

            }


            const [result] =
                await db.execute(

                    `

                    DELETE FROM cash_advance

                    WHERE ca_id = ?

                    `,

                    [
                        id
                    ]

                );


            if (
                result.affectedRows === 0
            ) {

                return res.status(404).json({

                    success: false,

                    message:
                        "Cash advance not found."

                });

            }


            res.json({

                success: true,

                message:
                    "Cash advance deleted successfully."

            });


        } catch (error) {

            console.error(
                "DELETE cash advance error:",
                error
            );


            res.status(500).json({

                success: false,

                message:
                    error.message

            });

        }

    }
);


// ============================================================
// ============================================================
// PAYROLL
// ============================================================
// ============================================================


// ============================================================
// GET PAYROLL
// ============================================================

app.get(
    "/api/payroll",
    async (req, res) => {

        try {

            const from =
                req.query.from ??
                null;

            const to =
                req.query.to ??
                null;


            if (!from || !to) {

                return res.status(400).json({

                    success: false,

                    message:
                        "from and to dates are required."

                });

            }


            const [employees] =
                await db.query(`

                    SELECT

                        employee_id,
                        first_name,
                        middle_name,
                        last_name,
                        position,
                        daily_rate

                    FROM employees

                    ORDER BY
                        employee_id ASC

                `);


            const payroll = [];


            for (
                const employee
                of employees
            ) {

                // --------------------------------------------
                // Attendance
                // --------------------------------------------

                const [attendanceRows] =
                    await db.execute(

                        `

                        SELECT

                            COUNT(
                                CASE
                                    WHEN time_in IS NOT NULL
                                    THEN 1
                                END
                            ) AS days_present,

                            COALESCE(
                                SUM(late_minutes),
                                0
                            ) AS late_minutes

                        FROM attendance

                        WHERE employee_id = ?

                        AND attendance_date
                            BETWEEN ? AND ?

                        AND time_in IS NOT NULL

                        `,

                        [

                            employee.employee_id,
                            from,
                            to

                        ]

                    );


                const daysPresent =
                    Number(
                        attendanceRows[0]
                            ?.days_present ||
                        0
                    );


                const lateMinutes =
                    Number(
                        attendanceRows[0]
                            ?.late_minutes ||
                        0
                    );


                // --------------------------------------------
                // Daily rate
                // --------------------------------------------

                const dailyRate =
                    Number(
                        employee.daily_rate ||
                        0
                    );


                // --------------------------------------------
                // Gross pay
                // --------------------------------------------

                const grossPay =
                    daysPresent *
                    dailyRate;


                // --------------------------------------------
                // Late deduction
                //
                // 8 working hours = 480 minutes
                // --------------------------------------------

                const lateDeduction =
                    lateMinutes *
                    (
                        dailyRate /
                        480
                    );


                // --------------------------------------------
                // Cash advance deduction
                // --------------------------------------------

                const [cashRows] =
                    await db.execute(

                        `

                        SELECT

                            COALESCE(
                                SUM(amount),
                                0
                            ) AS ca_deduction

                        FROM cash_advance

                        WHERE employee_id = ?

                        AND date_released
                            BETWEEN ? AND ?

                        AND status = 'For Deduction'

                        `,

                        [

                            employee.employee_id,
                            from,
                            to

                        ]

                    );


                const caDeduction =
                    Number(
                        cashRows[0]
                            ?.ca_deduction ||
                        0
                    );


                // --------------------------------------------
                // Net pay
                // --------------------------------------------

                const netPay =
                    grossPay -
                    lateDeduction -
                    caDeduction;


                payroll.push({

                    employeeId:

                        "EMP-" +
                        String(
                            employee.employee_id
                        ).padStart(3, "0"),


                    employee:

                        [

                            employee.first_name,

                            employee.middle_name,

                            employee.last_name

                        ]
                            .filter(Boolean)
                            .join(" "),


                    position:
                        employee.position ||
                        "",


                    daysPresent:
                        daysPresent,


                    lateMinutes:
                        lateMinutes,


                    grossPay:
                        roundMoney(
                            grossPay
                        ),


                    lateDeduction:
                        roundMoney(
                            lateDeduction
                        ),


                    caDeduction:
                        roundMoney(
                            caDeduction
                        ),


                    netPay:
                        roundMoney(
                            netPay
                        )

                });

            }


            res.json(
                payroll
            );


        } catch (error) {

            console.error(
                "GET payroll error:",
                error
            );


            res.status(500).json({

                success: false,

                message:
                    error.message

            });

        }

    }
);


// ============================================================
// ============================================================
// REPORTS
// ============================================================
// ============================================================


// ============================================================
// GET REPORTS
// ============================================================

app.get(
    "/api/reports",
    async (req, res) => {

        try {

            const from =
                req.query.from ??
                null;

            const to =
                req.query.to ??
                null;


            if (!from || !to) {

                return res.status(400).json({

                    success: false,

                    message:
                        "from and to dates are required."

                });

            }


            const [rows] =
                await db.execute(

                    `

                    SELECT

                        e.employee_id,

                        CONCAT_WS(
                            ' ',
                            e.first_name,
                            e.middle_name,
                            e.last_name
                        ) AS employee,


                        COUNT(
                            CASE
                                WHEN a.time_in IS NOT NULL
                                THEN 1
                            END
                        ) AS days_present,


                        COUNT(
                            CASE
                                WHEN a.late_minutes > 0
                                THEN 1
                            END
                        ) AS days_late,


                        COALESCE(
                            SUM(
                                a.late_minutes
                            ),
                            0
                        ) AS total_late_minutes,


                        COALESCE(
                            SUM(
                                a.hours_worked
                            ),
                            0
                        ) AS hours_worked,


                        COALESCE(

                            (

                                SELECT
                                    SUM(ca.amount)

                                FROM cash_advance ca

                                WHERE
                                    ca.employee_id =
                                    e.employee_id

                                AND
                                    ca.date_released
                                    BETWEEN ? AND ?

                            ),

                            0

                        ) AS cash_advances


                    FROM employees e


                    LEFT JOIN attendance a

                        ON
                            e.employee_id =
                            a.employee_id

                        AND
                            a.attendance_date
                            BETWEEN ? AND ?


                    GROUP BY

                        e.employee_id,
                        e.first_name,
                        e.middle_name,
                        e.last_name


                    ORDER BY
                        e.employee_id ASC

                    `,

                    [

                        from,
                        to,
                        from,
                        to

                    ]

                );


            const reports =
                rows.map(row => ({

                    employeeId:

                        "EMP-" +
                        String(
                            row.employee_id
                        ).padStart(3, "0"),


                    employee:
                        row.employee ||
                        "",


                    daysPresent:
                        Number(
                            row.days_present ||
                            0
                        ),


                    daysLate:
                        Number(
                            row.days_late ||
                            0
                        ),


                    totalLateMinutes:
                        Number(
                            row.total_late_minutes ||
                            0
                        ),


                    hoursWorked:
                        Number(
                            row.hours_worked ||
                            0
                        ),


                    cashAdvances:
                        Number(
                            row.cash_advances ||
                            0
                        )

                }));


            res.json(
                reports
            );


        } catch (error) {

            console.error(
                "GET reports error:",
                error
            );


            res.status(500).json({

                success: false,

                message:
                    error.message

            });

        }

    }
);


// ============================================================
// HELPER FUNCTIONS
// ============================================================


// Convert EMP-001 -> 1
function getNumericEmployeeId(
    employeeCode
) {

    if (!employeeCode) {
        return null;
    }


    const match =
        String(
            employeeCode
        ).match(
            /^EMP-(\d+)$/
        );


    if (!match) {
        return null;
    }


    const id =
        Number(
            match[1]
        );


    return Number.isInteger(id)
        ? id
        : null;

}


// ============================================================
// Convert undefined / null / invalid number safely
// ============================================================

function toNumber(
    value,
    fallback = 0
) {

    if (
        value === undefined ||
        value === null ||
        value === ""
    ) {

        return fallback;

    }


    const number =
        Number(value);


    return Number.isFinite(number)
        ? number
        : fallback;

}


// ============================================================
// Format DATE
// YYYY-MM-DD
// ============================================================

function formatDate(
    date
) {

    if (!date) {
        return "";
    }


    // mysql2 can return a Date object
    // depending on configuration.

    if (
        date instanceof Date
    ) {

        if (
            Number.isNaN(
                date.getTime()
            )
        ) {

            return "";

        }


        return (

            date.getFullYear() +

            "-" +

            String(
                date.getMonth() + 1
            ).padStart(2, "0") +

            "-" +

            String(
                date.getDate()
            ).padStart(2, "0")

        );

    }


    // If MySQL already returned YYYY-MM-DD
    const value =
        String(date);


    return value.substring(
        0,
        10
    );

}


// ============================================================
// Format DATETIME
// YYYY-MM-DDTHH:mm:ss
// ============================================================

function formatDateTime(
    date
) {

    if (!date) {
        return null;
    }


    if (
        date instanceof Date
    ) {

        if (
            Number.isNaN(
                date.getTime()
            )
        ) {

            return null;

        }


        return (

            date.getFullYear() +

            "-" +

            String(
                date.getMonth() + 1
            ).padStart(2, "0") +

            "-" +

            String(
                date.getDate()
            ).padStart(2, "0") +

            "T" +

            String(
                date.getHours()
            ).padStart(2, "0") +

            ":" +

            String(
                date.getMinutes()
            ).padStart(2, "0") +

            ":" +

            String(
                date.getSeconds()
            ).padStart(2, "0")

        );

    }


    return String(
        date
    )
        .replace(
            " ",
            "T"
        )
        .substring(
            0,
            19
        );

}


// ============================================================
// Normalize incoming DATETIME
// ============================================================

function normalizeDateTime(
    value
) {

    if (
        value === undefined ||
        value === null ||
        value === ""
    ) {

        return null;

    }


    const stringValue =
        String(value)
            .trim();


    if (!stringValue) {
        return null;
    }


    // Offset-bearing timestamps represent an instant; store its Manila wall time.
    if (
        /(?:Z|[+-]\d{2}:?\d{2})$/i.test(stringValue)
    ) {

        const instant = new Date(stringValue);

        if (!Number.isNaN(instant.getTime())) {

            const parts = new Intl.DateTimeFormat("en-CA", {
                timeZone: "Asia/Manila",
                year: "numeric",
                month: "2-digit",
                day: "2-digit",
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
                hourCycle: "h23"
            }).formatToParts(instant).reduce((result, part) => {
                if (part.type !== "literal") {
                    result[part.type] = part.value;
                }
                return result;
            }, {});

            return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second}`;

        }

    }


    // Convert:
    // 2026-09-28T08:30:00
    //
    // to:
    // 2026-09-28 08:30:00

    return stringValue
        .replace(
            "T",
            " "
        )
        .replace(
            "Z",
            ""
        )
        .substring(
            0,
            19
        );

}


// ============================================================
// Round money to 2 decimal places
// ============================================================

function roundMoney(
    value
) {

    return Number(
        Number(value || 0)
            .toFixed(2)
    );

}


// ============================================================
// FRONTEND ROUTE
// ============================================================

app.get(
    "/",
    (req, res) => {

        res.sendFile(
            __dirname +
            "/ngode/index.html"
        );

    }
);


// ============================================================
// START SERVER
// ============================================================

app.listen(
    PORT,
    () => {

        console.log(
            "======================================"
        );

        console.log(
            "JOECON EMS SERVER"
        );

        console.log(
            "======================================"
        );

        console.log(
            `Server running at http://localhost:${PORT}`
        );

        console.log(
            `MySQL database: ${process.env.DB_NAME}`
        );

        console.log(
            `API test: http://localhost:${PORT}/api/test`
        );

        console.log(
            `Employees: http://localhost:${PORT}/api/employees`
        );

        console.log(
            `Attendance: http://localhost:${PORT}/api/attendance`
        );

        console.log(
            `Cash Advances: http://localhost:${PORT}/api/cash-advances`
        );

        console.log(
            `Payroll: http://localhost:${PORT}/api/payroll`
        );

        console.log(
            `Reports: http://localhost:${PORT}/api/reports`
        );

    }
);