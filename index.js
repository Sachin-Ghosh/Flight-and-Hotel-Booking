var express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
var app = express();

require('dotenv').config(); // Load environment variables from .env file

// Import the cron job module
require('./cronJob');

// Import route files
const authRoutes = require('./routes/authRoutes');
const flightRoutes = require('./routes/flightRoutes');



const authenticateToken = require('./middleware/authMiddleware');

// Connecting to database
const connectDB = require('./config/db');
connectDB();

// // Ensure uploads directory exists
// const uploadsDir = path.join(__dirname, 'uploads');

// if (!fs.existsSync(uploadsDir)) {
//     fs.mkdirSync(uploadsDir, { recursive: true });
//     // console.log('Uploads directory created:', uploadsDir);
// } else {
//     console.log('Uploads directory already exists:', uploadsDir);
// }

// Middleware 
app.use(cors({ origin: '*', credentials: true }));
const bodyParser = require('body-parser');
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// Routes
app.use('/api/users', authRoutes);
app.use('/api/flights', flightRoutes);


//admin
// app.use('/api/admin', adminRoutes);


// Serve static files from the uploads directory
// app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.get('/', function(req, res) {
   res.send("Hello world!");
});

const port = process.env.PORT || 4545;

app.listen(port, "0.0.0.0", () => {
    console.log(`Server is running on http://localhost:${port}`);
});