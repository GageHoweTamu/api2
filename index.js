// Mac: brew services start postgresql

const { Pool } = require('pg'); // Postgres client library
const dotenv = require('dotenv').config(); // Environment variables
const express = require('express');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const session = require('express-session');
const morgan = require('morgan');
const multer = require('multer');
const { body, validationResult } = require('express-validator');

const upload = multer({ dest: 'uploads/' });
const app = express();
const PORT = 3001;

// Middlewares
app.use(express.json());
app.use(session({ secret: process.env.SESSION_SECRET, resave: false, saveUninitialized: false }));
app.use(passport.initialize());
app.use(passport.session());
app.use(morgan('dev'));

// Connect to Postgres
const pool = new Pool({
  user: process.env.POSTGRES_USER,
  host: process.env.POSTGRES_HOST,
  database: process.env.POSTGRES_DB,
  password: process.env.POSTGRES_PASSWORD,
  port: process.env.POSTGRES_PORT,
});

pool.query('SELECT NOW();')
  .then(() => console.log('Connected to PostgreSQL'))
  .catch(err => console.error('Error connecting to PostgreSQL:', err));

// Create tables (consider a migration tool for larger projects)
(async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS files (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        content TEXT NOT NULL,
        userId INTEGER REFERENCES users(id)
      );
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email TEXT UNIQUE,
        googleId TEXT UNIQUE
      );
    `);
    console.log('Tables created successfully.');
  } catch (error) {
    console.error(error.message);
  }
})();

// Google Authentication with Passport
passport.use(new GoogleStrategy({
  clientID: process.env.CLIENT_ID,
  clientSecret: process.env.CLIENT_SECRET,
  callbackURL: "/auth/google/callback"
},
function(accessToken, refreshToken, profile, cb) {
  // Find or create the user
  pool.query('SELECT * FROM users WHERE googleId = $1', [profile.id])
    .then(result => {
      if (result.rows.length > 0) {
        return cb(null, result.rows[0]);
      } else {
        return pool.query('INSERT INTO users(email, googleId) VALUES($1, $2) RETURNING *', [profile.emails[0].value, profile.id]);
      }
    })
    .then(result => cb(null, result.rows[0]))
    .catch(error => cb(error));
}));

passport.serializeUser((user, done) => done(null, user.id));

passport.deserializeUser((id, done) =>
  pool.query('SELECT * FROM users WHERE id = $1', [id])
    .then(result => done(null, result.rows[0]))
    .catch(error => done(error))
);

// Server Routes
app.get('/', (req, res) => res.send('Server is online'));

app.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

app.get('/auth/google/callback', 
  passport.authenticate('google', { failureRedirect: '/login' }),
  (req, res) => res.redirect('/')
);

// Text Uploads (consider adding validation for file type/size)
// Text Uploads (consider adding validation for file type/size)
app.post('/text', [
    body('text').isString().withMessage('Text must be a string'),
  ], (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    const text = req.body.text;
    pool.query('INSERT INTO files(name, content) VALUES($1, $2)', ['text', text])
      .then(() => res.json({ message: 'Text inserted successfully' }))
      .catch(error => res.status(500).json({ error: error.message })); // Handle database errors
  });

// Get all text files
app.get('/text/all', (req, res) => {
  pool.query('SELECT * FROM files')
    .then(result => res.json({ files: result.rows }))
    .catch(error => res.status(500).json({ error: error.message })); // Handle database errors
});

// Get total number of files
app.get('/text/count', (req, res) => {
  pool.query('SELECT COUNT(*) AS totalFiles FROM files')
    .then(result => res.json({ totalFiles: result.rows[0].totalFiles }))
    .catch(error => res.status(500).json({ error: error.message })); // Handle database errors
});

// Search for files (consider using a search library for complex queries)
app.get('/text/search', (req, res) => {
  const fileName = req.query.name;
  pool.query('SELECT * FROM files WHERE name LIKE $1', [`%${fileName}%`])
    .then(result => {
      if (result.rows.length > 0) {
        return res.json({ files: result.rows });
      } else {
        return res.status(404).json({ message: 'No files found' });
      }
    })
    .catch(error => res.status(500).json({ error: error.message })); // Handle database errors
});



app.listen(PORT, () => console.log(`Server is running on port ${PORT}`));
