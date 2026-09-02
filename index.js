const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const fs = require('fs');
const dotenv = require('dotenv');
dotenv.config();

const app = express();

app.use(cors());
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));

if (!fs.existsSync('uploads')) fs.mkdirSync('uploads');
app.use('/uploads', express.static('uploads'));

app.use('/api/auth', require('./routes/auth'));
app.use('/api/mines', require('./routes/mine'));
app.use('/api/users', require('./routes/user'));
app.use('/api/compliances', require('./routes/compliance'));
app.use('/api/alertlogs', require('./routes/alertLog'));

app.get('/', (req, res) => res.send('CompliTrack API running'));

// 404
app.use((req, res) => res.status(404).json({ message: 'Route not found' }));

// error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ message: err.message || 'Server error' });
});

const PORT = process.env.PORT || 5000;

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log('MongoDB connected');
    require('./utils/scheduler');
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  })
  .catch((err) => console.error('MongoDB error:', err.message));
