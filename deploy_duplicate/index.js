// Server for ULI
// Run: node index.js
// Required modules
const dotenv = require('dotenv').config();                          // Environment variables
const express = require('express');                                 // Server
const sqlite3 = require('sqlite3').verbose();                       // Database
const { body, validationResult } = require('express-validator');    // Validation
const multer = require('multer');                                   // File upload
const passport = require('passport');                               // Authentication
const GoogleStrategy = require('passport-google-oauth20').Strategy; // Google OAuth
const session = require('express-session');                         // Session
const morgan = require('morgan');                                   // Logging

const upload = multer({ dest: 'uploads/' });
const app = express();
const PORT = 3000;

// Middlewares
app.use(express.json());
app.use(session({ secret: 'your-session-secret', resave: false, saveUninitialized: false }));
app.use(passport.initialize());
app.use(passport.session());
app.use(morgan('dev'));

// Testing
// http://localhost:3000/auth/google
// http://localhost:3000/install
// http://localhost:3000/files

// Create database
let db = new sqlite3.Database('./mydatabase.db', (err) => {
    if (err) { console.error(err.message); }
    console.log('Connected to the mydatabase database.');
});

db.run(`CREATE TABLE IF NOT EXISTS files (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name text NOT NULL,
    content text NOT NULL,
    userId INTEGER,
    FOREIGN KEY(userId) REFERENCES users(id)
)`, (err) => {
    if (err) {
        console.error(err.message);
    }
    console.log('Files table created successfully.');
});

passport.use(new GoogleStrategy({
    clientID: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    callbackURL: "/auth/google/callback"
}, function(accessToken, refreshToken, profile, cb) {
    db.get(`SELECT * FROM users WHERE googleId = ?`, [profile.id], function(err, user) { // Find the user in the database
        if (err) { return cb(err); }
        if (user) {
            return cb(null, user); // If the user exists, return the user
        } else {
            // If the user doesn't exist, create a new user
            db.run(`INSERT INTO users(email, googleId) VALUES(?, ?)`, [profile.emails[0].value, profile.id], function(err) {
                if (err) { return cb(err); }
                db.get(`SELECT * FROM users WHERE id = ?`, [this.lastID], function(err, newUser) { // Return the newly created user
                    if (err) {
                        return cb(err);
                    }
                    return cb(null, newUser);
                });
            });
        }
    });
}));

passport.serializeUser(function(user, done) {
    done(null, user.id);
});

passport.deserializeUser(function(id, done) {
    db.get(`SELECT * FROM users WHERE id = ?`, [id], function(err, row) {
        done(err, row);
    });
});

app.get('/',
    function(req, res) {
        res.send('Server is online');
});

app.get('/auth/google',
    passport.authenticate('google', { scope: ['profile', 'email'] }));

app.get('/auth/google/callback', 
    passport.authenticate('google', { failureRedirect: '/login' }),
    function(req, res) {
        res.redirect('/');
});

// Upload a file
app.post('/text', [
    body('text').isString().withMessage('Text must be a string'),
], (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const text = req.body.text;
    db.run(`INSERT INTO files(name, content) VALUES(?, ?)`, ['text', text], function(err) {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        return res.json({ message: 'Text inserted successfully' });
    });
});

// Get all files
app.get('/text/all', (req, res) => {
    db.all(`SELECT * FROM files`, [], (err, rows) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        return res.json({ rows });
    });
});

// Search for a file; this should send all json packets containing the search query
app.get('/text/search', (req, res) => {
    const fileName = req.query.name;
    db.all(`SELECT * FROM files WHERE name = ?`, [fileName], (err, rows) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        if (rows.length > 0) {
            return res.json({ rows });
        } else {
            return res.status(404).json({ message: 'No files found' });
        }
    });
});

// Returns the total number of files
app.get('/text/all', (req, res) => {
    db.all(`SELECT * FROM files`, [], (err, rows) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        return res.json({ totalFiles: rows.length, rows });
    });
});

app.listen(PORT, () => { console.log(`Server is running on port ${PORT}`); });