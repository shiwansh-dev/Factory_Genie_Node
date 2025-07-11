require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB Connection
const mongoURI = process.env.MONGODB_URI;
mongoose.connect(mongoURI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => console.log('✅ MongoDB connected'))
  .catch(err => console.error('❌ MongoDB connection error:', err));

// Home Route
app.get('/', (req, res) => {
    res.send('🚀 API is running. Use /get-data?collection=your_collection to query.');
});

// Flexible GET route
app.get('/get-data', async (req, res) => {
    try {
        const { collection, limit, sortBy, sortOrder = 'asc', ...rawFilters } = req.query;

        if (!collection) {
            return res.status(400).json({ success: false, message: "Missing required 'collection' parameter." });
        }

        // Use or define model dynamically
        const DynamicModel = mongoose.models[collection] ||
            mongoose.model(collection, new mongoose.Schema({}, { strict: false }), collection);

        const parsedLimit = limit ? parseInt(limit) : 50;

        // Build sort object
        let sortObj = {};
        if (sortBy) {
            sortObj[sortBy] = sortOrder.toLowerCase() === 'desc' ? -1 : 1;
        }

        // Build filter object with type conversion + exists support
        let filterObj = {};
        for (let key in rawFilters) {
            if (['collection', 'limit', 'sortBy', 'sortOrder'].includes(key)) continue;

            if (key.endsWith('__exists')) {
                const field = key.split('__')[0];
                filterObj[field] = { $exists: rawFilters[key] === 'true' };
            } else {
                let value = rawFilters[key];
                if (!isNaN(value)) value = Number(value);
                else if (value === 'true') value = true;
                else if (value === 'false') value = false;

                filterObj[key] = value;
            }
        }

        const results = await DynamicModel.find(filterObj)
                                          .sort(sortObj)
                                          .limit(parsedLimit);

        res.json({ data: results });

    } catch (error) {
        console.error('Error in /get-data:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Start Server
app.listen(PORT, () => {
    console.log(`🚀 Server running at http://localhost:${PORT}`);
});
