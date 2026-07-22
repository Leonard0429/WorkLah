const express = require('express');
const mysql = require('mysql2');
const session = require('express-session');
const flash = require('connect-flash')
const multer = require('multer')
const app = express();

// Specify the port for the server to listen on
const port = 3000;

//Set up multer for file uploads
const storage = multer.diskStorage({
    destination: (req,file,cb) => {
        cb(null, 'public/images');
    },
    filename:(req,file,cb) => {
        cb(null, file.originalname);
    }
});

const upload = multer({ storage: storage });


//Database
<<<<<<< HEAD
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
=======

>>>>>>> b5b9446 (Added job , applicant list and partial navbar)


// Set up view engine
app.set('view engine', 'ejs');
//  enable static files
app.use(express.static('public'));
// enable form processing
app.use(express.urlencoded({
    extended: false
}));

<<<<<<< HEAD
// Session Middleware(Xanthus)

app.use(session({
    secret: 'secret',
    resave: false,
    saveUninitialized: true,
    cookie: { maxAge: 1000 * 60 * 60 * 24 * 7 }
}));

app.use(flash());



const checkAuthenticated = (req, res, next) => {
    if (req.session.user) {
        return next();
    } else {
        req.flash('error', 'Please log in to view this resource');
        res.redirect('/login');
    }
};

const checkAdmin = (req, res, next) => {
    if (req.session.user.role === 'admin') {
        return next();
    } else {
        req.flash('error', 'Access denied');
        res.redirect('/dashboard');
    }
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
            res.redirect('/dashboard');
        } else {
            req.flash('error', 'Invalid email or password.');
            res.redirect('/login');
        }
    });
});

app.get('/dashboard', checkAuthenticated, (req, res) => {
    res.render('dashboard', { user: req.session.user });
});

app.get('/admin', checkAuthenticated, checkAdmin, (req, res) => {
    res.render('admin', { user: req.session.user });
});

app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/login');
});
=======
>>>>>>> b5b9446 (Added job , applicant list and partial navbar)

// In-memory data for applicants
let applicant = [
  { id: 1, name: 'Peter Tan', job_applied: 'Shopee - Data Analyst' },
  { id: 2, name: 'Mary Lim', job_applied: 'DBS - AI Engineer' },
  { id: 3, name: 'John Ho', job_applied: 'Micron - Software Developer' }
];


// In-memory data for applicants
let job = [
  { id: 1, job_title: 'Bank Analyst', company: 'DBS', date: '2026-08-15' },
  { id: 2, job_title: 'Mechanic', company: 'ST Engineering', date: '2026-08-15' },
  { id: 3, job_title: 'Waiter', company: 'Haidilao SG', date: '2026-08-15'}
];

// Define route (Leonard)

//index.ejs
app.get('/', function(req,res) {
    res.render('index');
})

// Routes for CRUD operations

// Route to retrieve and display all applicants
app.get('/applicantlist', function(req, res) {
    //render a view called "applicantlist" and pass the variable 'applicant' to the view for rendering
    res.render('applicantlist', { applicant });
});

// Route to get a specific applicant by ID
app.get('/applicant/:id', function(req, res) {
    // Extracting the 'id' parameter from the request parameters and converting it to an integer
    const applicantId = parseInt(req.params.id);
    // Searching for a applicant in the 'applicants' array with a matching 'id'
    const foundapplicant = applicant.find((applicant) => applicant.id === applicantId);

    // Checking if a applicant with the specified 'id' was found
    if (foundapplicant) {
        //If the applicant is found, render a view called "applicantInfo" and pass the variable 'applicants' to the view for rendering.
        res.render('applicantInfo', { applicant: foundapplicant });
    } else {
        res.status(404).send('Applicant not found');
    }
});

// Route to retrieve and display all job
app.get('/joblist', function(req, res) {
    //render a view called "joblist" and pass the variable 'applicant' to the view for rendering
    res.render('joblist', { job });
});

// Route to get a specific job by ID
app.get('/job/:id', function(req, res) {
    // Extracting the 'id' parameter from the request parameters and converting it to an integer
    const jobId = parseInt(req.params.id);
    // Searching for a job in the 'job' array with a matching 'id'
    const foundJob = job.find((job) => job.id === jobId);

    // Checking if a job with the specified 'id' was found
    if (foundJob) {
        //If the job is found, render a view called "jobInfo" and pass the variable 'job' to the view for rendering.
        res.render('jobInfo', { job: foundJob });
    } else {
        res.status(404).send('Job not found');
    }
});

// Route to home.ejs 
app.get('/home', function(req, res) {
    res.render('home');
});





// Start the server and listen on the specified port
app.listen(port, () => {
  // Log a message when the server is successfully started
  console.log(`Server is running at http://localhost:${port}`);
});