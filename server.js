const express = require('express');
const { MongoClient, ObjectId } = require('mongodb');
const cors = require('cors');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '50mb' })); // Increased limit for base64 images

// Add request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', message: 'Server is running' });
});

// MongoDB Atlas Connection
const uri = process.env.MONGODB_URI;
const client = new MongoClient(uri);
let isConnected = false;

// Connect to MongoDB
async function connectToMongoDB() {
  try {
    await client.connect();
    isConnected = true;
    console.log('Connected to MongoDB Atlas');
  } catch (error) {
    isConnected = false;
    console.error('Error connecting to MongoDB:', error);
  }
}

// API status endpoint
app.get('/api/status', async (req, res) => {
  res.status(200).json({
    server: 'running',
    mongodb: isConnected ? 'connected' : 'disconnected',
    environment: process.env.NODE_ENV || 'development'
  });
});

// API Routes
app.post('/api/qrcodes', async (req, res) => {
  try {
    const { contactInfo, qrCodeImage } = req.body;
    
    const database = client.db('primegate');
    const qrCodesCollection = database.collection('qrcodes');
    
    // Insert the QR code data
    const result = await qrCodesCollection.insertOne({
      contactInfo,
      qrCodeImage,
      createdAt: new Date()
    });
    
    res.status(201).json({ 
      success: true, 
      id: result.insertedId,
      message: 'QR code saved successfully' 
    });
  } catch (error) {
    console.error('Error saving QR code:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to save QR code' 
    });
  }
});

// Get all QR codes
app.get('/api/qrcodes', async (req, res) => {
  try {
    const database = client.db('primegate');
    const qrCodesCollection = database.collection('qrcodes');
    
    const qrCodes = await qrCodesCollection.find({}).toArray();
    
    // Remove the image data to reduce response size
    const sanitizedQrCodes = qrCodes.map(code => ({
      _id: code._id,
      contactInfo: code.contactInfo,
      createdAt: code.createdAt
    }));
    
    res.status(200).json(sanitizedQrCodes);
  } catch (error) {
    console.error('Error fetching QR codes:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch QR codes' 
    });
  }
});

// Get a specific QR code by ID
app.get('/api/qrcodes/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const database = client.db('primegate');
    const qrCodesCollection = database.collection('qrcodes');
    
    const qrCode = await qrCodesCollection.findOne({ _id: new ObjectId(id) });
    
    if (!qrCode) {
      return res.status(404).json({ 
        success: false, 
        message: 'QR code not found' 
      });
    }
    
    res.status(200).json(qrCode);
  } catch (error) {
    console.error('Error fetching QR code:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch QR code' 
    });
  }
});

// Start the server
app.listen(port, async () => {
  await connectToMongoDB();
  console.log(`Server running on port ${port}`);
});
