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

        // Create schema that allows string _id for collections like shiftwise_data
        let schema;
        if (collection === 'shiftwise_data') {
            schema = new mongoose.Schema({}, { 
                strict: false,
                _id: false  // Disable automatic _id
            });
            schema.add({ _id: String }); // Explicitly set _id as String
        } else {
            schema = new mongoose.Schema({}, { strict: false });
        }

        // Dynamic model creation
        const DynamicModel = mongoose.models[collection] ||
            mongoose.model(collection, schema, collection);

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

        const results = await DynamicModel.find(filterObj).sort(sortObj).limit(parsedLimit).lean();
        res.json({ success: true, data: results });
    } catch (error) {
        console.error('Error in /get-data:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// PUT endpoint to update any document by ID - FIXED for string IDs
app.put('/update-document', async (req, res) => {
    try {
        const { collection, id } = req.query;
        let updateData = req.body;

        if (!collection || !id) {
            return res.status(400).json({ 
                success: false, 
                message: "Missing 'collection' or 'id' in query." 
            });
        }

        console.log(`Updating document with ID: ${id} in collection: ${collection}`);
        console.log('Update data:', JSON.stringify(updateData, null, 2));

        // Flatten nested objects for dot-notation updates
        const flattenObject = (obj, prefix = '') => {
            return Object.keys(obj).reduce((acc, key) => {
                const value = obj[key];
                const newKey = prefix ? `${prefix}.${key}` : key;
                if (value && typeof value === 'object' && !Array.isArray(value)) {
                    Object.assign(acc, flattenObject(value, newKey));
                } else {
                    acc[newKey] = value;
                }
                return acc;
            }, {});
        };

        updateData = flattenObject(updateData);
        console.log('Flattened update data:', JSON.stringify(updateData, null, 2));

        // Create schema that handles string _id for shiftwise_data collection
        let schema;
        if (collection === 'shiftwise_data') {
            schema = new mongoose.Schema({}, { 
                strict: false,
                _id: false  // Disable automatic _id
            });
            schema.add({ _id: String }); // Explicitly set _id as String
        } else {
            schema = new mongoose.Schema({}, { strict: false });
        }

        const DynamicModel = mongoose.models[collection] ||
            mongoose.model(collection, schema, collection);

        // Use findOneAndUpdate to avoid ObjectId casting
        const updatedDoc = await DynamicModel.findOneAndUpdate(
            { _id: id }, // This will work with string IDs now
            { $set: updateData },
            { 
                new: true,
                runValidators: false,
                strict: false
            }
        );

        if (!updatedDoc) {
            console.error(`Document with ID ${id} not found in collection ${collection}`);
            return res.status(404).json({ 
                success: false, 
                message: "Document not found." 
            });
        }

        console.log(`Successfully updated document: ${updatedDoc._id}`);
        res.json({ 
            success: true, 
            data: updatedDoc,
            message: "Document updated successfully"
        });

    } catch (error) {
        console.error('Error in /update-document:', error);
        console.error('Error stack:', error.stack);
        
        // Handle specific errors
        if (error.name === 'CastError') {
            return res.status(400).json({
                success: false,
                error: `ID casting failed: ${error.message}. Make sure the ID format is correct.`
            });
        }
        
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

// DELETE endpoint to remove any document by ID
app.delete('/delete-document', async (req, res) => {
    try {
        const { collection, id } = req.query;
        if (!collection || !id) {
            return res.status(400).json({ success: false, message: "Missing 'collection' or 'id' in query." });
        }

        // Use same schema logic as update
        let schema;
        if (collection === 'shiftwise_data') {
            schema = new mongoose.Schema({}, { 
                strict: false,
                _id: false
            });
            schema.add({ _id: String });
        } else {
            schema = new mongoose.Schema({}, { strict: false });
        }

        const DynamicModel = mongoose.models[collection] ||
            mongoose.model(collection, schema, collection);

        const deletedDoc = await DynamicModel.findOneAndDelete({ _id: id });

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
