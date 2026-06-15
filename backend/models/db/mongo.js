// backend/db/mongo.js
const mongoose = require('mongoose');

const connectMongo = async () => {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.warn('MONGODB_URI is not defined in environment. MongoDB features will not function.');
    return;
  }

  const options = {
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
  };

  try {
    await mongoose.connect(uri, options);
    console.log('MongoDB successfully connected.');
  } catch (err) {
    console.error('MongoDB connection failed. Retrying in 5 seconds...', err.message);
    setTimeout(connectMongo, 5000);
  }
};

module.exports = {
  connectMongo,
};
