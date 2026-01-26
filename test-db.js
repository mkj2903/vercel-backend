const mongoose = require('mongoose');
require('dotenv').config();

const MONGODB_URI = 'mongodb+srv://mohitjangra:mohitjangra@tv-merch-cluster.lqjsd3a.mongodb.net/tv-merch';

console.log('🔄 Testing connection to: tv-merch database');

async function test() {
  try {
    // Try to connect
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB Atlas!');
    
    // List databases
    const adminDb = mongoose.connection.db.admin();
    const databases = await adminDb.listDatabases();
    
    console.log('\n📊 Available databases:');
    databases.databases.forEach(db => {
      console.log(`   - ${db.name} (${db.sizeOnDisk} bytes)`);
    });
    
    // Try to use tv-merch database
    const db = mongoose.connection.useDb('tv-merch');
    console.log(`\n🎯 Using database: ${db.databaseName}`);
    
    // Create a test collection
    await db.createCollection('test');
    console.log('✅ Created test collection');
    
    // Insert a test document
    await db.collection('test').insertOne({ 
      message: 'Database connection successful!',
      timestamp: new Date() 
    });
    console.log('✅ Inserted test document');
    
    // Count documents
    const count = await db.collection('test').countDocuments();
    console.log(`📄 Test collection has ${count} documents`);
    
    await mongoose.disconnect();
    console.log('\n✅ All tests passed! Database is working.');
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    
    if (error.message.includes('Authentication failed')) {
      console.log('\n🔑 Authentication failed. Check:');
      console.log('   1. Username and password');
      console.log('   2. User permissions in MongoDB Atlas');
    } else if (error.message.includes('bad auth')) {
      console.log('\n🔐 Bad auth. User may not have access to database.');
    } else if (error.message.includes('database not found')) {
      console.log('\n📁 Database not found. Please create "tv-merch" database in MongoDB Atlas.');
    }
  }
}

test();