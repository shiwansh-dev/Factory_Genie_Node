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
// In your server.js file, update the /get-data endpoint:
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
        
        // ADD .lean() to ensure _id is included as plain JavaScript object
        const results = await DynamicModel.find(filterObj)
            .sort(sortObj)
            .limit(parsedLimit)
            .lean(); // This is the key addition!
        
        // Log to verify _id is present
        console.log('Sample result with _id:', results[0]);
        
        res.json({ success: true, data: results });
    } catch (error) {
        console.error('Error in /get-data:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// PUT endpoint to update any document by ID
// PUT endpoint to update any document by ID - handles both ObjectId and String IDs
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

        // Create dynamic model with strict: false to allow any fields
        const DynamicModel = mongoose.models[collection] || 
            mongoose.model(collection, new mongoose.Schema({}, { 
                strict: false,
                _id: false  // Don't auto-generate _id, use existing ones
            }), collection);

        // Use findOneAndUpdate instead of findByIdAndUpdate to handle string IDs
        const updatedDoc = await DynamicModel.findOneAndUpdate(
            { _id: id }, // Search by exact _id value (works with strings)
            { $set: updateData },
            { 
                new: true,      // Return updated document
                upsert: false,  // Don't create if not found
                runValidators: false // Skip validation for dynamic schema
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
        
        // Handle specific MongoDB errors
        if (error.name === 'CastError') {
            return res.status(400).json({
                success: false,
                error: `Invalid ID format: ${error.message}`
            });
        }
        
        if (error.name === 'ValidationError') {
            return res.status(400).json({
                success: false,
                error: `Validation failed: ${error.message}`
            });
        }
        
        res.status(500).json({ 
            success: false, 
            error: error.message,
            type: error.name 
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
