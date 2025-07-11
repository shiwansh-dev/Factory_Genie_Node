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

// GET with flexible filters, sorting, limits
app.get('/get-data', async (req, res) => {
    try {
        const { collection, limit, sortBy, sortOrder = 'asc', ...rawFilters } = req.query;

        if (!collection) {
            return res.status(400).json({ success: false, message: "Missing required 'collection' parameter." });
        }

        // Dynamic model creation
        const DynamicModel = mongoose.models[collection] ||
            mongoose.model(collection, new mongoose.Schema({}, { strict: false }), collection);

        const parsedLimit = limit ? parseInt(limit) : 50;

        // Sort object
        let sortObj = {};
        if (sortBy) {
            sortObj[sortBy] = sortOrder.toLowerCase() === 'desc' ? -1 : 1;
        }

        // Filter object with support for multiple values and type conversion
        let filterObj = {};
        for (let key in rawFilters) {
            if (['collection', 'limit', 'sortBy', 'sortOrder'].includes(key)) continue;

            if (key.endsWith('__exists')) {
                const field = key.split('__')[0];
                filterObj[field] = { $exists: rawFilters[key] === 'true' };
            } else {
                const values = rawFilters[key].split(',');
                const converted = values.map(val => {
                    if (!isNaN(val)) return Number(val);
                    if (val === 'true') return true;
                    if (val === 'false') return false;
                    return val;
                });
                filterObj[key] = converted.length === 1 ? converted[0] : { $in: converted };
            }
        }

        const results = await DynamicModel.find(filterObj).sort(sortObj).limit(parsedLimit);
        res.json({ success: true, data: results });

    } catch (error) {
        console.error('Error in /get-data:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// PUT endpoint to update any document by ID
app.put('/update-document', async (req, res) => {
    try {
        const { collection, id } = req.query;
        const updateData = req.body;

        if (!collection || !id) {
            return res.status(400).json({ success: false, message: "Missing 'collection' or 'id' in query." });
        }

        const DynamicModel = mongoose.models[collection] ||
            mongoose.model(collection, new mongoose.Schema({}, { strict: false }), collection);

        const updatedDoc = await DynamicModel.findByIdAndUpdate(id, updateData, { new: true });

        if (!updatedDoc) {
            return res.status(404).json({ success: false, message: "Document not found." });
        }

        res.json({ success: true, data: updatedDoc });

    } catch (error) {
        console.error('Error in /update-document:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// DELETE endpoint to remove any document by ID
app.delete('/delete-document', async (req, res) => {
    try {
        const { collection, id } = req.query;

        if (!collection || !id) {
            return res.status(400).json({ success: false, message: "Missing 'collection' or 'id' in query." });
        }

        const DynamicModel = mongoose.models[collection] ||
            mongoose.model(collection, new mongoose.Schema({}, { strict: false }), collection);

        const deletedDoc = await DynamicModel.findByIdAndDelete(id);

        if (!deletedDoc) {
            return res.status(404).json({ success: false, message: "Document not found." });
        }

        res.json({ success: true, message: "Document deleted successfully." });

    } catch (error) {
        console.error('Error in /delete-document:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Start Server
app.listen(PORT, () => {
    console.log(`🚀 Server running at http://localhost:${PORT}`);
});
