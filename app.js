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

// Create the private folder used to store profile pictures
const profilePictureDirectory = path.join(
    __dirname,
    'uploads',
    'profile-pictures'
);

if (!fs.existsSync(resumeDirectory)) {
    fs.mkdirSync(resumeDirectory, { recursive: true });
}

if (!fs.existsSync(profilePictureDirectory)) {
    fs.mkdirSync(profilePictureDirectory, {
        recursive: true
    });
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

// Set up Multer for JPG and PNG profile pictures
const profilePictureStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, profilePictureDirectory);
    },

    filename: (req, file, cb) => {
        const extension = path.extname(
            file.originalname
        ).toLowerCase();

        cb(
            null,
            Date.now()
                + '-student-'
                + req.session.user.id
                + extension
        );
    }
});

const uploadProfilePicture = multer({
    storage: profilePictureStorage,

    limits: {
        fileSize: 2 * 1024 * 1024
    },

    fileFilter: (req, file, cb) => {
        if (
            file.mimetype === 'image/jpeg'
            || file.mimetype === 'image/png'
        ) {
            cb(null, true);
        } else {
            cb(new Error(
                'Only JPG and PNG profile pictures are allowed'
            ));
        }
    }
});

// Display upload errors on the student profile page
const handleProfileResumeUpload = (req, res, next) => {
    uploadResume.single('resume')(req, res, (error) => {
        if (error) {
            const message = error.code === 'LIMIT_FILE_SIZE'
                ? 'Resume must not be larger than 5 MB'
                : error.message;

            req.flash('error', message);
            return res.redirect('/profile');
        }

        next();
    });
};

// Display profile-picture upload errors
const handleProfilePictureUpload = (req, res, next) => {
    uploadProfilePicture.single('profilePicture')(
        req,
        res,
        (error) => {
            if (error) {
                const message =
                    error.code === 'LIMIT_FILE_SIZE'
                        ? 'Profile picture must not be larger than 2 MB'
                        : error.message;

                req.flash('error', message);
                return res.redirect('/profile');
            }

            next();
        }
    );
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

// Prevent students from applying for a job that has been filled
const checkJobAvailable = (req, res, next) => {
    const jobId = req.params.id;
    const sql = `
        SELECT id
        FROM applications
        WHERE gig_id = ?
        AND status = 'accepted'
        LIMIT 1
    `;

    db.query(sql, [jobId], (error, results) => {
        if (error) {
            console.error('Database query error:', error);
            return res.send('Error checking job availability');
        }

        if (results.length > 0) {
            req.flash('error', 'This job is no longer available');
            return res.redirect('/joblist');
        }

        next();
    });
};

// Allow another attempt only after the latest application was rejected
const checkCanApplyAgain = (req, res, next) => {
    const studentId = req.session.user.id;
    const jobId = req.params.id;
    const sql = `
        SELECT status
        FROM applications
        WHERE student_id = ?
        AND gig_id = ?
        ORDER BY id DESC
        LIMIT 1
    `;

    db.query(sql, [studentId, jobId], (error, results) => {
        if (error) throw error;

        if (results.length === 0) {
            return next();
        }

        if (results[0].status === 'rejected') {
            return next();
        }

        if (results[0].status === 'pending') {
            req.flash(
                'error',
                'Your latest application for this job is still pending'
            );
        } else {
            req.flash(
                'error',
                'You have already been accepted for this job'
            );
        }

        res.redirect('/applicationList');
    });
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

// Display the logged-in student's profile
app.get('/profile', checkAuthenticated, checkStudent, (req, res) => {
    const studentId = req.session.user.id;
    const sql = `
        SELECT id, username, email, address, contact,
               resume_filename, profile_picture_filename
        FROM users
        WHERE id = ?
    `;

    db.query(sql, [studentId], (error, results) => {
        if (error) throw error;

        if (results.length === 0) {
            return res.status(404).send('User not found');
        }

        const profile = results[0];
        const resumeAvailable = profile.resume_filename
            && fs.existsSync(path.join(
                resumeDirectory,
                path.basename(profile.resume_filename)
            ));
        const profilePictureAvailable =
            profile.profile_picture_filename
            && fs.existsSync(path.join(
                profilePictureDirectory,
                path.basename(
                    profile.profile_picture_filename
                )
            ));

        res.render('profile', {
            profile,
            resumeAvailable,
            profilePictureAvailable,
            errors: req.flash('error'),
            messages: req.flash('success')
        });
    });
});

// Update the student's contact details and saved resume
app.post(
    '/profile',
    checkAuthenticated,
    checkStudent,
    handleProfileResumeUpload,
    (req, res) => {
        const studentId = req.session.user.id;
        const address = req.body.address;
        const contact = req.body.contact;

        if (!address || !contact) {
            if (req.file) {
                fs.unlink(req.file.path, () => {});
            }

            req.flash('error', 'Address and contact number are required');
            return res.redirect('/profile');
        }

        const selectSql = `
            SELECT resume_filename
            FROM users
            WHERE id = ?
        `;

        db.query(selectSql, [studentId], (selectError, results) => {
            if (selectError) {
                if (req.file) {
                    fs.unlink(req.file.path, () => {});
                }

                throw selectError;
            }

            if (results.length === 0) {
                if (req.file) {
                    fs.unlink(req.file.path, () => {});
                }

                return res.status(404).send('User not found');
            }

            const oldResume = results[0].resume_filename;
            const newResume = req.file
                ? req.file.filename
                : oldResume;
            const updateSql = `
                UPDATE users
                SET address = ?,
                    contact = ?,
                    resume_filename = ?
                WHERE id = ?
            `;

            db.query(
                updateSql,
                [address, contact, newResume, studentId],
                (updateError) => {
                    if (updateError) {
                        if (req.file) {
                            fs.unlink(req.file.path, () => {});
                        }

                        throw updateError;
                    }

                    // Remove only the old profile resume after replacement
                    if (req.file && oldResume) {
                        const oldResumePath = path.join(
                            resumeDirectory,
                            path.basename(oldResume)
                        );

                        fs.unlink(oldResumePath, () => {});
                    }

                    req.session.user.address = address;
                    req.session.user.contact = contact;
                    req.session.user.resume_filename = newResume;
                    req.flash('success', 'Profile updated successfully');
                    res.redirect('/profile');
                }
            );
        });
    }
);

// Upload or replace the student's profile picture
app.post(
    '/profile/picture',
    checkAuthenticated,
    checkStudent,
    handleProfilePictureUpload,
    (req, res) => {
        const studentId = req.session.user.id;

        if (!req.file) {
            req.flash(
                'error',
                'Please select a profile picture'
            );

            return res.redirect('/profile');
        }

        const selectSql = `
            SELECT profile_picture_filename
            FROM users
            WHERE id = ?
        `;

        db.query(
            selectSql,
            [studentId],
            (selectError, results) => {
                if (selectError) {
                    fs.unlink(req.file.path, () => {});
                    throw selectError;
                }

                if (results.length === 0) {
                    fs.unlink(req.file.path, () => {});
                    return res.status(404).send(
                        'User not found'
                    );
                }

                const oldPicture =
                    results[0].profile_picture_filename;
                const updateSql = `
                    UPDATE users
                    SET profile_picture_filename = ?
                    WHERE id = ?
                `;

                db.query(
                    updateSql,
                    [req.file.filename, studentId],
                    (updateError) => {
                        if (updateError) {
                            fs.unlink(
                                req.file.path,
                                () => {}
                            );

                            throw updateError;
                        }

                        // Remove the previous picture after replacement
                        if (oldPicture) {
                            const oldPicturePath =
                                path.join(
                                    profilePictureDirectory,
                                    path.basename(oldPicture)
                                );

                            fs.unlink(
                                oldPicturePath,
                                () => {}
                            );
                        }

                        req.session.user
                            .profile_picture_filename =
                                req.file.filename;

                        req.flash(
                            'success',
                            'Profile picture updated successfully'
                        );

                        res.redirect('/profile');
                    }
                );
            }
        );
    }
);

// Display a profile picture to its owner or an admin
app.get(
    '/profile-picture/:studentId',
    checkAuthenticated,
    (req, res) => {
        const studentId = parseInt(
            req.params.studentId
        );
        const isAdmin =
            req.session.user.role === 'admin';
        const isOwner =
            req.session.user.id === studentId;

        if (!isAdmin && !isOwner) {
            return res.status(403).send(
                'Access denied'
            );
        }

        const sql = `
            SELECT profile_picture_filename
            FROM users
            WHERE id = ?
        `;

        db.query(
            sql,
            [studentId],
            (error, results) => {
                if (error) throw error;

                if (
                    results.length === 0
                    || !results[0]
                        .profile_picture_filename
                ) {
                    return res.status(404).send(
                        'Profile picture not found'
                    );
                }

                const picturePath = path.join(
                    profilePictureDirectory,
                    path.basename(
                        results[0]
                            .profile_picture_filename
                    )
                );

                if (!fs.existsSync(picturePath)) {
                    return res.status(404).send(
                        'Profile picture not found'
                    );
                }

                res.sendFile(picturePath);
            }
        );
    }
);

// Download the logged-in student's saved profile resume
app.get('/profile/resume', checkAuthenticated, checkStudent, (req, res) => {
    const studentId = req.session.user.id;
    const sql = `
        SELECT resume_filename
        FROM users
        WHERE id = ?
    `;

    db.query(sql, [studentId], (error, results) => {
        if (error) throw error;

        if (results.length === 0 || !results[0].resume_filename) {
            req.flash('error', 'No profile resume has been uploaded');
            return res.redirect('/profile');
        }

        const resumePath = path.join(
            resumeDirectory,
            path.basename(results[0].resume_filename)
        );

        if (!fs.existsSync(resumePath)) {
            req.flash('error', 'Resume file not found. Please upload it again');
            return res.redirect('/profile');
        }

        res.download(resumePath);
    });
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
                   users.contact, users.profile_picture_filename,
                   gigs.title, gigs.company
            FROM applications
            JOIN users ON applications.student_id = users.id
            JOIN gigs ON applications.gig_id = gigs.id
            ORDER BY applications.applied_at DESC
        `;
    } else {
        // Student can only view their own applications
        sql = `
            SELECT applications.*, users.username,
                   users.profile_picture_filename,
                   gigs.title, gigs.company
            FROM applications
            JOIN users ON applications.student_id = users.id
            JOIN gigs ON applications.gig_id = gigs.id
            WHERE applications.student_id = ?
            ORDER BY applications.applied_at DESC
        `;

        values = [req.session.user.id];
    }

    db.query(sql, values, (error, results) => {
        if (error) throw error;

        // Check which applicants have a saved picture
        for (let i = 0; i < results.length; i++) {
            results[i].profilePictureAvailable =
                results[i].profile_picture_filename
                && fs.existsSync(path.join(
                    profilePictureDirectory,
                    path.basename(
                        results[i]
                            .profile_picture_filename
                    )
                ));

            results[i].attemptNumber = 1;
            results[i].isLatestAttempt = true;

            // Count older attempts and identify the latest attempt
            for (let j = 0; j < results.length; j++) {
                const sameApplication =
                    results[i].student_id
                    === results[j].student_id
                    && results[i].gig_id
                    === results[j].gig_id;

                if (
                    sameApplication
                    && results[j].id < results[i].id
                ) {
                    results[i].attemptNumber++;
                }

                if (
                    sameApplication
                    && results[j].id > results[i].id
                ) {
                    results[i].isLatestAttempt = false;
                }
            }
        }

        res.render('applicationList', {
            applications: results,
            errors: req.flash('error'),
            messages: req.flash('success')
        });
    });
});

// Display the logged-in student's saved jobs
app.get(
    '/bookmarks',
    checkAuthenticated,
    checkStudent,
    (req, res) => {
        const studentId = req.session.user.id;
        const sql = `
            SELECT bookmarks.id AS bookmark_id,
                   bookmarks.saved_at,
                   gigs.*,

                   EXISTS (
                       SELECT 1
                       FROM applications
                       WHERE applications.gig_id = gigs.id
                       AND applications.status = 'accepted'
                   ) AS unavailable

            FROM bookmarks
            JOIN gigs ON bookmarks.gig_id = gigs.id
            WHERE bookmarks.student_id = ?
            ORDER BY bookmarks.saved_at DESC
        `;

        db.query(sql, [studentId], (error, results) => {
            if (error) throw error;

            res.render('bookmarks', {
                savedJobs: results,
                errors: req.flash('error'),
                messages: req.flash('success')
            });
        });
    }
);

// Save a job to the student's bookmark page
app.post(
    '/bookmark/:jobId',
    checkAuthenticated,
    checkStudent,
    (req, res) => {
        const studentId = req.session.user.id;
        const jobId = req.params.jobId;
        let redirectUrl = '/joblist';

        if (req.body.returnPage === 'jobInfo') {
            redirectUrl = '/job/' + jobId;
        }

        const sql = `
            INSERT INTO bookmarks
            (student_id, gig_id)
            VALUES (?, ?)
        `;

        db.query(
            sql,
            [studentId, jobId],
            (error) => {
                if (error) {
                    if (error.code === 'ER_DUP_ENTRY') {
                        req.flash(
                            'error',
                            'This job is already saved'
                        );

                        return res.redirect(redirectUrl);
                    }

                    if (
                        error.code
                        === 'ER_NO_REFERENCED_ROW_2'
                    ) {
                        return res.status(404).send(
                            'Job not found'
                        );
                    }

                    throw error;
                }

                req.flash(
                    'success',
                    'Job saved successfully'
                );

                res.redirect(redirectUrl);
            }
        );
    }
);

// Remove a job from the student's bookmarks
app.post(
    '/bookmark/:jobId/delete',
    checkAuthenticated,
    checkStudent,
    (req, res) => {
        const studentId = req.session.user.id;
        const jobId = req.params.jobId;
        let redirectUrl = '/joblist';

        if (req.body.returnPage === 'jobInfo') {
            redirectUrl = '/job/' + jobId;
        }

        if (req.body.returnPage === 'bookmarks') {
            redirectUrl = '/bookmarks';
        }

        const sql = `
            DELETE FROM bookmarks
            WHERE student_id = ?
            AND gig_id = ?
        `;

        db.query(
            sql,
            [studentId, jobId],
            (error, result) => {
                if (error) throw error;

                if (result.affectedRows === 0) {
                    req.flash(
                        'error',
                        'Saved job not found'
                    );

                    return res.redirect(redirectUrl);
                }

                req.flash(
                    'success',
                    'Job removed from saved jobs'
                );

                res.redirect(redirectUrl);
            }
        );
    }
);

// Display jobs with search, filtering and sorting (Jun Yi)
app.get('/joblist', checkAuthenticated, (req, res) => {
    const search = req.query.search || '';
    const company = req.query.company || '';
    const category = req.query.category || '';
    const payRange = req.query.payRange || '';
    const sortBy = req.query.sortBy || '';

    let sql = 'SELECT * FROM gigs WHERE 1=1';
    const values = [];

    // Search using the job title
    if (search) {
        sql = sql + ' AND title LIKE ?';
        values.push('%' + search + '%');
    }

    // Filter using the selected company
    if (company) {
        sql = sql + ' AND company = ?';
        values.push(company);
    }

    // Filter using the selected category
    if (category) {
        sql = sql + ' AND category = ?';
        values.push(category);
    }

    // Filter using the selected pay range
    if (payRange === 'under15') {
        sql = sql + ' AND pay < 15';
    } else if (payRange === '15to20') {
        sql = sql
            + ' AND pay >= 15'
            + ' AND pay <= 20';
    } else if (payRange === 'above20') {
        sql = sql + ' AND pay > 20';
    }

    // Only allow sorting with these database columns
    const allowedColumns = [
        'company',
        'category',
        'pay',
        'location',
        'deadline'
    ];

    if (
        sortBy
        && allowedColumns.includes(sortBy)
    ) {
        sql = sql
            + ' ORDER BY '
            + sortBy
            + ' ASC';
    } else {
        sql = sql + ' ORDER BY deadline ASC';
    }

    // Retrieve jobs using Jun Yi's filters
    db.query(sql, values, (error, results) => {
        if (error) throw error;

        // Retrieve companies for the filter dropdown
        const companySql =
            'SELECT DISTINCT company FROM gigs';

        db.query(
            companySql,
            (companyError, companyResults) => {
                if (companyError) throw companyError;

                // Retrieve categories for the filter dropdown
                const categorySql =
                    'SELECT DISTINCT category FROM gigs';

                db.query(
                    categorySql,
                    (categoryError, categoryResults) => {
                        if (categoryError) {
                            throw categoryError;
                        }

                        const companyList = [];

                        for (
                            let i = 0;
                            i < companyResults.length;
                            i++
                        ) {
                            companyList.push(
                                companyResults[i].company
                            );
                        }

                        const categoryList = [];

                        for (
                            let i = 0;
                            i < categoryResults.length;
                            i++
                        ) {
                            if (
                                categoryResults[i].category
                            ) {
                                categoryList.push(
                                    categoryResults[i]
                                        .category
                                );
                            }
                        }

                        // Admins see every filtered job
                        if (
                            req.session.user.role
                            === 'admin'
                        ) {
                            return res.render(
                                'jobList',
                                {
                                    job: results,
                                    companyList,
                                    categoryList,
                                    search,
                                    company,
                                    category,
                                    payRange,
                                    sortBy,
                                    user: req.session.user,
                                    errors:
                                        req.flash('error'),
                                    messages:
                                        req.flash('success')
                                }
                            );
                        }

                        // Find jobs with an accepted application
                        const acceptedSql = `
                            SELECT DISTINCT gig_id
                            FROM applications
                            WHERE status = 'accepted'
                        `;

                        db.query(
                            acceptedSql,
                            (
                                acceptedError,
                                acceptedResults
                            ) => {
                                if (acceptedError) {
                                    throw acceptedError;
                                }

                                const availableJobs = [];

                                // Hide accepted jobs from students
                                for (
                                    let i = 0;
                                    i < results.length;
                                    i++
                                ) {
                                    let jobAccepted = false;

                                    for (
                                        let j = 0;
                                        j
                                            < acceptedResults
                                                .length;
                                        j++
                                    ) {
                                        if (
                                            results[i].id
                                            === acceptedResults[j]
                                                .gig_id
                                        ) {
                                            jobAccepted = true;
                                        }
                                    }

                                    if (!jobAccepted) {
                                        availableJobs.push(
                                            results[i]
                                        );
                                    }
                                }

                                const bookmarkSql = `
                                    SELECT gig_id
                                    FROM bookmarks
                                    WHERE student_id = ?
                                `;

                                db.query(
                                    bookmarkSql,
                                    [
                                        req.session.user.id
                                    ],
                                    (
                                        bookmarkError,
                                        bookmarkResults
                                    ) => {
                                        if (bookmarkError) {
                                            throw bookmarkError;
                                        }

                                        // Mark jobs saved by the student
                                        for (
                                            let i = 0;
                                            i
                                                < availableJobs
                                                    .length;
                                            i++
                                        ) {
                                            availableJobs[i]
                                                .isBookmarked =
                                                    false;

                                            for (
                                                let j = 0;
                                                j
                                                    < bookmarkResults
                                                        .length;
                                                j++
                                            ) {
                                                if (
                                                    availableJobs[i]
                                                        .id
                                                    === bookmarkResults[j]
                                                        .gig_id
                                                ) {
                                                    availableJobs[i]
                                                        .isBookmarked =
                                                            true;
                                                }
                                            }
                                        }

                                        res.render(
                                            'jobList',
                                            {
                                                job:
                                                    availableJobs,
                                                companyList,
                                                categoryList,
                                                search,
                                                company,
                                                category,
                                                payRange,
                                                sortBy,
                                                user:
                                                    req.session
                                                        .user,
                                                errors:
                                                    req.flash(
                                                        'error'
                                                    ),
                                                messages:
                                                    req.flash(
                                                        'success'
                                                    )
                                            }
                                        );
                                    }
                                );
                            }
                        );
                    }
                );
            }
        );
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
            const selectedJob = results[0];

            // Admins do not use student bookmarks
            if (req.session.user.role === 'admin') {
                return res.render('jobInfo', {
                    job: selectedJob,
                    user: req.session.user,
                    isBookmarked: false,
                    errors: req.flash('error'),
                    messages: req.flash('success')
                });
            }

            const bookmarkSql = `
                SELECT id
                FROM bookmarks
                WHERE student_id = ?
                AND gig_id = ?
                LIMIT 1
            `;

            db.query(
                bookmarkSql,
                [req.session.user.id, jobId],
                (bookmarkError, bookmarkResults) => {
                    if (bookmarkError) throw bookmarkError;

                    res.render('jobInfo', {
                        job: selectedJob,
                        user: req.session.user,
                        isBookmarked:
                            bookmarkResults.length > 0,
                        errors: req.flash('error'),
                        messages: req.flash('success')
                    });
                }
            );
        } else {
            res.status(404).send('Job not found');
        }
    });
});

// Display the selected job application form to a student
app.get(
    '/job/:id/apply',
    checkAuthenticated,
    checkStudent,
    checkJobAvailable,
    checkCanApplyAgain,
    (req, res) => {
        const studentId = req.session.user.id;
        const jobId = req.params.id;
        const resumeSql = `
            SELECT resume_filename
            FROM users
            WHERE id = ?
        `;

        db.query(resumeSql, [studentId], (resumeError, resumeResults) => {
            if (resumeError) throw resumeError;

            if (
                resumeResults.length === 0
                || !resumeResults[0].resume_filename
            ) {
                req.flash(
                    'error',
                    'Please upload a resume before applying for a job'
                );
                return res.redirect('/profile');
            }

            const resumePath = path.join(
                resumeDirectory,
                path.basename(resumeResults[0].resume_filename)
            );

            if (!fs.existsSync(resumePath)) {
                req.flash(
                    'error',
                    'Saved resume file is missing. Please upload it again'
                );
                return res.redirect('/profile');
            }

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
    }
);

// Submit a student's job application with a copy of the profile resume
app.post(
    '/job/:id/apply',
    checkAuthenticated,
    checkStudent,
    checkJobAvailable,
    checkCanApplyAgain,
    (req, res) => {
        const studentId = req.session.user.id;
        const jobId = req.params.id;
        const resumeSql = `
            SELECT resume_filename
            FROM users
            WHERE id = ?
        `;

        db.query(resumeSql, [studentId], (resumeError, resumeResults) => {
            if (resumeError) throw resumeError;

            if (
                resumeResults.length === 0
                || !resumeResults[0].resume_filename
            ) {
                req.flash(
                    'error',
                    'Please upload a resume before applying for a job'
                );
                return res.redirect('/profile');
            }

            const profileResumePath = path.join(
                resumeDirectory,
                path.basename(resumeResults[0].resume_filename)
            );

            if (!fs.existsSync(profileResumePath)) {
                req.flash(
                    'error',
                    'Saved resume file is missing. Please upload it again'
                );
                return res.redirect('/profile');
            }

            const applicationResume = Date.now()
                + '-student-' + studentId
                + '-job-' + jobId
                + '.pdf';
            const applicationResumePath = path.join(
                resumeDirectory,
                applicationResume
            );

            // Keep a separate resume copy for this application
            fs.copyFile(
                profileResumePath,
                applicationResumePath,
                (copyError) => {
                    if (copyError) throw copyError;

                    const sql = `
                        INSERT INTO applications
                        (student_id, gig_id, resume_filename)
                        SELECT ?, ?, ?
                        WHERE NOT EXISTS (
                            SELECT 1
                            FROM applications
                            WHERE student_id = ?
                            AND gig_id = ?
                            AND status IN ('pending', 'accepted')
                        )
                    `;

                    db.query(
                        sql,
                        [
                            studentId,
                            jobId,
                            applicationResume,
                            studentId,
                            jobId
                        ],
                        (error, result) => {
                            if (error) {
                                fs.unlink(applicationResumePath, () => {});

                                if (
                                    error.code
                                    === 'ER_NO_REFERENCED_ROW_2'
                                ) {
                                    return res.status(404).send(
                                        'Job not found'
                                    );
                                }

                                throw error;
                            }

                            if (result.affectedRows === 0) {
                                fs.unlink(applicationResumePath, () => {});
                                req.flash(
                                    'error',
                                    'You already have an active application for this job'
                                );
                                return res.redirect('/applicationList');
                            }

                            req.flash(
                                'success',
                                'Application submitted successfully'
                            );
                            res.redirect('/applicationList');
                        }
                    );
                }
            );
        });
    }
);

/*
 * The application details routes below continue using the copied
 * resume_filename stored on each application.
 */

// Display one application to its owner or an admin
app.get('/application/:id', checkAuthenticated, (req, res) => {
    const applicationId = req.params.id;
    const sql = `
        SELECT applications.*, users.username, users.email,
               users.contact, gigs.title, gigs.company,

               (
                   SELECT COUNT(*)
                   FROM applications AS older_attempts
                   WHERE older_attempts.student_id =
                         applications.student_id
                   AND older_attempts.gig_id =
                       applications.gig_id
                   AND older_attempts.id <= applications.id
               ) AS attemptNumber,

               applications.id = (
                   SELECT MAX(latest_attempt.id)
                   FROM applications AS latest_attempt
                   WHERE latest_attempt.student_id =
                         applications.student_id
                   AND latest_attempt.gig_id =
                       applications.gig_id
               ) AS isLatestAttempt

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

        const selectSql = `
            SELECT student_id, gig_id, status
            FROM applications
            WHERE id = ?
        `;

        db.query(
            selectSql,
            [applicationId],
            (selectError, results) => {
                if (selectError) throw selectError;

                if (results.length === 0) {
                    return res.status(404).send(
                        'Application not found'
                    );
                }

                const application = results[0];
                const latestSql = `
                    SELECT id
                    FROM applications
                    WHERE student_id = ?
                    AND gig_id = ?
                    ORDER BY id DESC
                    LIMIT 1
                `;

                db.query(
                    latestSql,
                    [
                        application.student_id,
                        application.gig_id
                    ],
                    (latestError, latestResults) => {
                        if (latestError) throw latestError;

                        const isLatest =
                            latestResults.length > 0
                            && latestResults[0].id
                            === parseInt(applicationId);

                        if (
                            !isLatest
                            || application.status !== 'pending'
                        ) {
                            req.flash(
                                'error',
                                'Only the latest pending attempt can be updated'
                            );
                            return res.redirect(
                                '/applicationList'
                            );
                        }

                        const updateSql = `
                            UPDATE applications
                            SET status = ?
                            WHERE id = ?
                            AND status = 'pending'
                        `;

                        db.query(
                            updateSql,
                            [status, applicationId],
                            (updateError, result) => {
                                if (updateError) {
                                    throw updateError;
                                }

                                if (result.affectedRows === 0) {
                                    req.flash(
                                        'error',
                                        'Application can no longer be updated'
                                    );
                                    return res.redirect(
                                        '/applicationList'
                                    );
                                }

                                req.flash(
                                    'success',
                                    'Application status updated'
                                );
                                res.redirect('/applicationList');
                            }
                        );
                    }
                );
            }
        );
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
