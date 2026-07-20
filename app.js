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



// Set up view engine
app.set('view engine', 'ejs');
//  enable static files
app.use(express.static('public'));
// enable form processing
app.use(express.urlencoded({
    extended: false
}));


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
    const applicant = applicant.find((applicant) => applicant.id === applicantId);

    // Checking if a applicant with the specified 'id' was found
    if (applicant) {
        //If the applicant is found, render a view called "applicantInfo" and pass the variable 'applicants' to the view for rendering.
        res.render('applicantInfo', { applicant })
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
    // Searching for a applicant in the 'job' array with a matching 'id'
    const job = job.find((job) => job.id === jobId);

    // Checking if a applicant with the specified 'id' was found
    if (job) {
        //If the applicant is found, render a view called "applicantInfo" and pass the variable 'applicants' to the view for rendering.
        res.render('jobInfo', { job })
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