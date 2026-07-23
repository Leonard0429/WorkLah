const express = require('express');
const mysql = require('mysql2');
const session = require('express-session');
const flash = require('connect-flash')
const multer = require('multer')
const fs = require('fs');
const path = require('path');
const app = express();

// Specify the port for the server to listen on
const port = 3000;

// Create the private folder used to store uploaded resumes
const resumeDirectory = path.join(__dirname, 'uploads', 'resumes');

if (!fs.existsSync(resumeDirectory)) {
    fs.mkdirSync(resumeDirectory, { recursive: true });
}

// Set up multer for PDF resume uploads
const resumeStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, resumeDirectory);
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + '-' + file.originalname);
    }
});

const uploadResume = multer({
    storage: resumeStorage,
    limits: {
        fileSize: 5 * 1024 * 1024
    },
    fileFilter: (req, file, cb) => {
        if (file.mimetype === 'application/pdf') {
            cb(null, true);
        } else {
            cb(new Error('Only PDF resume files are allowed'));
        }
    }
});

// Display upload errors on the selected job application form
const handleResumeUpload = (req, res, next) => {
    uploadResume.single('resume')(req, res, (error) => {
        if (error) {
            const message = error.code === 'LIMIT_FILE_SIZE'
                ? 'Resume must not be larger than 5 MB'
                : error.message;

            req.flash('error', message);
            return res.redirect('/job/' + req.params.id + '/apply');
        }

        next();
    });
};


//Database
const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'RP738964$',
    database: 'c237_worklah',
    ssl: {
        rejectUnauthorized: false
    }
});

db.connect((err) => {
    if (err) {
        throw err;
    }
    console.log('Connected to database');
});


// Set up view engine
app.set('view engine', 'ejs');
//  enable static files
app.use(express.static('public'));
// enable form processing
app.use(express.urlencoded({
    extended: false
}));

// Session Middleware(Xanthus)

app.use(session({
    secret: 'secret',
    resave: false,
    saveUninitialized: true,
    cookie: { maxAge: 1000 * 60 * 60 * 24 * 7 }
}));

app.use(flash());

// Make the logged-in user available to every EJS page
app.use((req, res, next) => {
    res.locals.user = req.session.user || null;
    next();
});

const checkAuthenticated = (req, res, next) => {
    if (req.session.user) {
        return next();
    } else {
        req.flash('error', 'Please log in to view this resource');
        res.redirect('/login');
    }
};

const checkAdmin = (req, res, next) => {
    if (req.session.user && req.session.user.role === 'admin') {
        return next();
    } else {
        req.flash('error', 'Access denied');
        res.redirect('/joblist');
    }
};

// Ensure only students can submit or delete applications
const checkStudent = (req, res, next) => {
    if (req.session.user && req.session.user.role === 'student') {
        return next();
    }

    req.flash('error', 'Only students can perform this action');
    res.redirect('/joblist');
};

//index route
app.get('/', (req, res) => {
    res.render('index', { user: req.session.user, messages: req.flash('success') });
});

//Routes for registration and login(Xanthus)

app.get('/register', (req, res) => {
    res.render('register', { messages: req.flash('error'), formData: req.flash('formData')[0] });
});

const validateRegistration = (req, res, next) => {
    const { username, email, password, address, contact } = req.body;

    if (!username || !email || !password || !address || !contact) {
        return res.status(400).send('All fields are required.');
    }
    if (password.length < 6) {
        req.flash('error', 'Password should be at least 6 or more characters long');
        req.flash('formData', req.body);
        return res.redirect('/register');
    }
    next();
};

app.post('/register', validateRegistration, (req, res) => {
    const { username, email, password, address, contact, role } = req.body;

    const sql = 'INSERT INTO users (username, email, password, address, contact, role) VALUES (?, ?, SHA1(?), ?, ?, ?)';
    db.query(sql, [username, email, password, address, contact, role], (err, result) => {
        if (err) throw err;
        req.flash('success', 'Registration successful! Please log in.');
        res.redirect('/login');
    });
});

app.get('/login', (req, res) => {
    res.render('login', {
        messages: req.flash('success'),
        errors: req.flash('error')
    });
});

app.post('/login', (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        req.flash('error', 'All fields are required.');
        return res.redirect('/login');
    }

    const sql = 'SELECT * FROM users WHERE email = ? AND password = SHA1(?)';
    db.query(sql, [email, password], (err, results) => {
        if (err) throw err;

        if (results.length > 0) {
            req.session.user = results[0];
            req.flash('success', 'Login successful!');
            if (req.session.user.role === 'admin') {
                res.redirect('/admin');
            } else {
                res.redirect('/joblist');
            }
        } else {
            req.flash('error', 'Invalid email or password.');
            res.redirect('/login');
        }
    });
});

app.get('/admin', checkAuthenticated, checkAdmin, (req, res) => {
    res.render('admin', { user: req.session.user });
});

app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/login');
});

// Define route (Leonard)

// Routes for CRUD operations

// Display applications based on the logged-in user's role
app.get('/applicationList', checkAuthenticated, (req, res) => {
    let sql;
    let values = [];

    if (req.session.user.role === 'admin') {
        // Admin can view applications from every student
        sql = `
            SELECT applications.*, users.username, users.email,
                   users.contact, gigs.title, gigs.company
            FROM applications
            JOIN users ON applications.student_id = users.id
            JOIN gigs ON applications.gig_id = gigs.id
            ORDER BY applications.applied_at DESC
        `;
    } else {
        // Student can only view their own applications
        sql = `
            SELECT applications.*, gigs.title, gigs.company
            FROM applications
            JOIN gigs ON applications.gig_id = gigs.id
            WHERE applications.student_id = ?
            ORDER BY applications.applied_at DESC
        `;

        values = [req.session.user.id];
    }

    db.query(sql, values, (error, results) => {
        if (error) throw error;

        res.render('applicationList', {
            applications: results,
            errors: req.flash('error'),
            messages: req.flash('success')
        });
    });
});

// Display all jobs from the database
app.get('/joblist', checkAuthenticated, (req, res) => {
    const sql = 'SELECT * FROM gigs ORDER BY deadline ASC';

    db.query(sql, (error, results) => {
        if (error) throw error;

        // Pass the database results to the job list page
        res.render('jobList', {
            job: results,
            user: req.session.user,
            errors: req.flash('error'),
            messages: req.flash('success')
        });
    });
});

// Display one job from the database
app.get('/job/:id', checkAuthenticated, (req, res) => {
    const jobId = req.params.id;
    const sql = 'SELECT * FROM gigs WHERE id = ?';

    // Use a placeholder to safely provide the selected job ID
    db.query(sql, [jobId], (error, results) => {
        if (error) throw error;

        if (results.length > 0) {
            res.render('jobInfo', {
                job: results[0],
                user: req.session.user
            });
        } else {
            res.status(404).send('Job not found');
        }
    });
});

// Display the selected job application form to a student
app.get('/job/:id/apply', checkAuthenticated, checkStudent, (req, res) => {
    const jobId = req.params.id;
    const sql = 'SELECT * FROM gigs WHERE id = ?';

    db.query(sql, [jobId], (error, results) => {
        if (error) throw error;

        if (results.length > 0) {
            res.render('applyJob', {
                job: results[0],
                errors: req.flash('error')
            });
        } else {
            res.status(404).send('Job not found');
        }
    });
});

// Submit a student's job application and PDF resume
app.post(
    '/job/:id/apply',
    checkAuthenticated,
    checkStudent,
    handleResumeUpload,
    (req, res) => {
        const studentId = req.session.user.id;
        const jobId = req.params.id;

        if (!req.file) {
            req.flash('error', 'Please upload your resume');
            return res.redirect('/job/' + jobId + '/apply');
        }

        const sql = `
            INSERT INTO applications (student_id, gig_id, resume_filename)
            VALUES (?, ?, ?)
        `;

        db.query(sql, [studentId, jobId, req.file.filename], (error, result) => {
            if (error) {
                // Remove the uploaded file when the application is not saved
                fs.unlink(req.file.path, () => {});

                if (error.code === 'ER_DUP_ENTRY') {
                    req.flash('error', 'You have already applied for this job');
                    return res.redirect('/job/' + jobId + '/apply');
                }

                if (error.code === 'ER_NO_REFERENCED_ROW_2') {
                    return res.status(404).send('Job not found');
                }

                throw error;
            }

            req.flash('success', 'Application submitted successfully');
            res.redirect('/applicationList');
        });
    }
);

// Display one application to its owner or an admin
app.get('/application/:id', checkAuthenticated, (req, res) => {
    const applicationId = req.params.id;
    const sql = `
        SELECT applications.*, users.username, users.email,
               users.contact, gigs.title, gigs.company
        FROM applications
        JOIN users ON applications.student_id = users.id
        JOIN gigs ON applications.gig_id = gigs.id
        WHERE applications.id = ?
    `;

    db.query(sql, [applicationId], (error, results) => {
        if (error) throw error;

        if (results.length === 0) {
            return res.status(404).send('Application not found');
        }

        const application = results[0];
        const isAdmin = req.session.user.role === 'admin';
        const isOwner = application.student_id === req.session.user.id;

        if (!isAdmin && !isOwner) {
            req.flash('error', 'Access denied');
            return res.redirect('/applicationList');
        }

        res.render('applicationInfo', {
            application,
            errors: req.flash('error'),
            messages: req.flash('success')
        });
    });
});

// Download a resume when the user is the owner or an admin
app.get('/application/:id/resume', checkAuthenticated, (req, res) => {
    const applicationId = req.params.id;
    const sql = 'SELECT * FROM applications WHERE id = ?';

    db.query(sql, [applicationId], (error, results) => {
        if (error) throw error;

        if (results.length === 0) {
            return res.status(404).send('Application not found');
        }

        const application = results[0];
        const isAdmin = req.session.user.role === 'admin';
        const isOwner = application.student_id === req.session.user.id;

        if (!isAdmin && !isOwner) {
            req.flash('error', 'Access denied');
            return res.redirect('/applicationList');
        }

        const resumePath = path.join(
            resumeDirectory,
            application.resume_filename
        );

        res.download(resumePath);
    });
});

// Delete a student's own pending application
app.post(
    '/application/:id/delete',
    checkAuthenticated,
    checkStudent,
    (req, res) => {
        const applicationId = req.params.id;
        const studentId = req.session.user.id;
        const selectSql = `
            SELECT *
            FROM applications
            WHERE id = ?
            AND student_id = ?
            AND status = 'pending'
        `;

        db.query(
            selectSql,
            [applicationId, studentId],
            (selectError, results) => {
                if (selectError) throw selectError;

                if (results.length === 0) {
                    req.flash(
                        'error',
                        'Application not found or can no longer be deleted'
                    );
                    return res.redirect('/applicationList');
                }

                const application = results[0];
                const deleteSql = 'DELETE FROM applications WHERE id = ?';

                db.query(deleteSql, [applicationId], (deleteError) => {
                    if (deleteError) throw deleteError;

                    const resumePath = path.join(
                        resumeDirectory,
                        application.resume_filename
                    );

                    fs.unlink(resumePath, () => {});
                    req.flash('success', 'Application deleted successfully');
                    res.redirect('/applicationList');
                });
            }
        );
    }
);

// Allow an admin to update only an application's status
app.post(
    '/application/:id/status',
    checkAuthenticated,
    checkAdmin,
    (req, res) => {
        const applicationId = req.params.id;
        const status = req.body.status;
        const allowedStatuses = ['pending', 'accepted', 'rejected'];

        if (!allowedStatuses.includes(status)) {
            req.flash('error', 'Invalid application status');
            return res.redirect('/applicationList');
        }

        const sql = 'UPDATE applications SET status = ? WHERE id = ?';

        db.query(sql, [status, applicationId], (error, result) => {
            if (error) throw error;

            if (result.affectedRows === 0) {
                return res.status(404).send('Application not found');
            }

            req.flash('success', 'Application status updated');
            res.redirect('/applicationList');
        });
    }
);

// Display the Add Job form to an admin (Bryan)
app.get('/addjob', checkAuthenticated, checkAdmin, (req, res) => {
    res.render('addJob', {
        user: req.session.user,
        errors: req.flash('error')
    });
});

// Add a new job to the database (Bryan)
app.post('/addjob', checkAuthenticated, checkAdmin, (req, res) => {
    const {
        title,
        company,
        description,
        category,
        pay,
        location,
        deadline
    } = req.body;

    // Ensure the required job information was entered
    if (!title || !company || !description || !category || !pay || !deadline) {
        req.flash('error', 'Please complete all required job fields');
        return res.redirect('/addjob');
    }

    const sql = `
        INSERT INTO gigs
        (title, company, description, category, pay,
         location, deadline, posted_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const values = [
        title,
        company,
        description,
        category,
        pay,
        location || null,
        deadline,
        req.session.user.id
    ];

    db.query(sql, values, (error, result) => {
        if (error) throw error;

        req.flash('success', 'Job added successfully');
        res.redirect('/joblist');
    });
});

// Display the selected job in the edit form (Nissi)
app.get('/job/:id/edit', checkAuthenticated, checkAdmin, (req, res) => {
    const jobId = req.params.id;
    const sql = `
        SELECT *,
               DATE_FORMAT(deadline, '%Y-%m-%d') AS deadline
        FROM gigs
        WHERE id = ?
    `;

    db.query(sql, [jobId], (error, results) => {
        if (error) throw error;

        if (results.length > 0) {
            res.render('editJob', {
                job: results[0],
                user: req.session.user,
                errors: req.flash('error')
            });
        } else {
            res.status(404).send('Job not found');
        }
    });
});

// Update the selected job in the database (Nissi)
app.post('/job/:id/edit', checkAuthenticated, checkAdmin, (req, res) => {
    const jobId = req.params.id;
    const {
        title,
        company,
        description,
        category,
        pay,
        location,
        deadline
    } = req.body;

    // Ensure the required job information was entered
    if (!title || !company || !description || !category || !pay || !deadline) {
        req.flash('error', 'Please complete all required job fields');
        return res.redirect('/job/' + jobId + '/edit');
    }

    const sql = `
        UPDATE gigs
        SET title = ?,
            company = ?,
            description = ?,
            category = ?,
            pay = ?,
            location = ?,
            deadline = ?
        WHERE id = ?
    `;

    const values = [
        title,
        company,
        description,
        category,
        pay,
        location || null,
        deadline,
        jobId
    ];

    db.query(sql, values, (error, result) => {
        if (error) throw error;

        if (result.affectedRows === 0) {
            return res.status(404).send('Job not found');
        }

        req.flash('success', 'Job updated successfully');
        res.redirect('/joblist');
    });
});

// Delete a selected job from the database (Jomond)
app.post('/deletejob/:id', checkAuthenticated, checkAdmin, (req, res) => {
    const jobId = req.params.id;
    const sql = 'DELETE FROM gigs WHERE id = ?';

    db.query(sql, [jobId], (error, result) => {
        if (error) {
            // A job with applications should not be deleted
            if (error.code === 'ER_ROW_IS_REFERENCED_2') {
                req.flash(
                    'error',
                    'This job cannot be deleted because students have applied for it'
                );
                return res.redirect('/joblist');
            }

            throw error;
        }

        if (result.affectedRows === 0) {
            return res.status(404).send('Job not found');
        }

        req.flash('success', 'Job deleted successfully');
        res.redirect('/joblist');
    });
});

// Start the server and listen on the specified port
app.listen(port, () => {
  // Log a message when the server is successfully started
  console.log(`Server is running at http://localhost:${port}`);
});
