const express = require('express');
const dotenv = require('dotenv');
const connectDB = require('./config.ts');

dotenv.config();
connectDB();

const app = express();
app.use(express.json());

// Quick routes
app.use('/api/items', require('./routes/itemRoutes'));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on ${PORT}`));