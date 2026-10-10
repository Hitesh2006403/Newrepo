require('dotenv').config();
const { connectDB, closeDB } = require('../src/config/db');
const mongoose = require('mongoose');
const Review = require('../src/models/Review');
const DeliveryTask = require('../src/models/DeliveryTask');
const Donation = require('../src/models/Donation');
const User = require('../src/models/User');
const RecipientRequirement = require('../src/models/RecipientRequirement');
const Notification = require('../src/models/Notification');
const HandoverToken = require('../src/models/HandoverToken');
const AuditLog = require('../src/models/AuditLog');

const seedMissingData = async () => {
  try {
    await connectDB();
    console.log('[Atlas Verify] Connected to MongoDB Atlas cluster shareaplatecluster.wrzyw1e.mongodb.net');

    // 1. Seed Reviews if empty
    const reviewCount = await Review.countDocuments();
    console.log(`[Atlas Verify] Current Review count: ${reviewCount}`);
    if (reviewCount === 0) {
      console.log('[Atlas Seed] Seeding initial verified reviews into Atlas...');
      await Review.insertMany([
        {
          donationId: 'don-105',
          donorName: 'Grand Hyatt Banquet & Bistro',
          recipientName: 'Mother Teresa Home for Aged',
          authorRole: 'recipient',
          rating: 5,
          foodName: 'Catered Wedding Dinner: Biryani, Dal Makhani & Roti',
          comment: 'Extremely high quality food, hot and delicious. Fed 150 elderly residents seamlessly. Blessings to the culinary team for zero wastage!',
          tags: ['Fresh & Hot', 'Punctual Handover', 'Hygienically Packed'],
          verifiedRescue: true,
        },
        {
          donationId: 'don-102',
          donorName: 'Artisan Sourdough & Bakery Guild',
          recipientName: 'Asha Bhavan Community Kitchen',
          authorRole: 'recipient',
          rating: 5,
          foodName: 'Fresh Baked Multigrain Loaves, Brioche & Croissants',
          comment: 'Wonderful bakery rescue! Packaged cleanly with clear allergen notices. Children and volunteers loved the fresh brioche buns.',
          tags: ['Sealed Packaging', 'Accurate Labeling', 'Quick Response'],
          verifiedRescue: true,
        },
        {
          donationId: 'don-103',
          donorName: 'Infosys Food Court 4',
          recipientName: 'Grace Hope Children Shelter',
          authorRole: 'recipient',
          rating: 4.8,
          foodName: 'Nutritious South Indian Meal: Sambar, Rice & Poriyal',
          comment: 'Great quantity and well-balanced nutrition. Handover rider Vikram was very polite and handled the insulated hot box safely.',
          tags: ['Nutritious Meals', 'Safe Transit', 'Polite Rider'],
          verifiedRescue: true,
        },
      ]);
      console.log('[Atlas Seed] Successfully inserted initial reviews.');
    }

    // 2. Seed DeliveryTasks if empty
    const deliveryTaskCount = await DeliveryTask.countDocuments();
    console.log(`[Atlas Verify] Current DeliveryTask count: ${deliveryTaskCount}`);
    if (deliveryTaskCount === 0) {
      console.log('[Atlas Seed] Seeding delivery fleet tasks into Atlas...');
      await DeliveryTask.insertMany([
        {
          donationId: 'don-103',
          deliveryAgentId: 'user-delivery-1',
          foodName: 'Nutritious South Indian Meal: Sambar, Rice, Poriyal & Curd',
          quantity: '120 servings',
          foodType: 'cooked_meals',
          storageCondition: 'heated (Thermal Insulated)',
          urgencyLevel: 'URGENT',
          pickup: {
            location: 'Infosys Food Court 4, Dock B, Electronic City',
            donorName: 'Infosys Food Court 4',
            donorPhone: '+91 97711 22334',
            deadline: new Date(Date.now() + 1.5 * 60 * 60 * 1000),
          },
          dropoff: {
            location: 'Grace Hope Children Shelter, 14 Sunshine Cross',
            recipientName: 'Grace Hope Children Shelter (Sister Teresa)',
            recipientPhone: '+91 91234 56789',
            deadline: new Date(Date.now() + 2.5 * 60 * 60 * 1000),
          },
          currentMilestone: 'ASSIGNED',
          distanceTotalKm: 5.8,
          estimatedMinutes: 28,
          qrRequiredToken: 'SAP-QR-DON-103-SECURE-8831',
          vehicleSuggestion: 'Thermal container insulated bag required',
          safetyChecklistCompleted: false,
        },
        {
          donationId: 'don-101',
          deliveryAgentId: 'user-delivery-1',
          foodName: 'Executive Buffet: Basmati Rice & Paneer Butter Masala',
          quantity: '35 servings (Partial claim)',
          foodType: 'cooked_meals',
          storageCondition: 'heated',
          urgencyLevel: 'HIGH',
          pickup: {
            location: 'Hyatt Regency Service Bay, MG Road',
            donorName: 'Chef Marco Rossi',
            donorPhone: '+91 98765 43210',
            deadline: new Date(Date.now() + 1.8 * 60 * 60 * 1000),
          },
          dropoff: {
            location: 'Grace Hope Children Shelter, 14 Sunshine Cross',
            recipientName: 'Grace Hope Children Shelter',
            recipientPhone: '+91 91234 56789',
            deadline: new Date(Date.now() + 2.3 * 60 * 60 * 1000),
          },
          currentMilestone: 'EN_ROUTE_PICKUP',
          distanceTotalKm: 2.2,
          estimatedMinutes: 12,
          qrRequiredToken: 'SAP-QR-DON-101-SECURE-9921',
          vehicleSuggestion: 'Hot box or two insulated delivery crates',
          safetyChecklistCompleted: false,
        },
      ]);
      console.log('[Atlas Seed] Successfully inserted delivery fleet tasks.');
    }

    // 3. Inspect all collections and counts in MongoDB Atlas
    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log('\n=============================================================================');
    console.log('       MONGODB ATLAS COLLECTIONS AUDIT (share_a_plate DATABASE)');
    console.log('=============================================================================');
    for (const col of collections) {
      const count = await mongoose.connection.db.collection(col.name).countDocuments();
      console.log(` • Collection: [${col.name.padEnd(24)}] Document Count: ${count}`);
    }
    console.log('=============================================================================\n');

    await closeDB();
    process.exit(0);
  } catch (error) {
    console.error('[Atlas Seed Error]', error);
    await closeDB();
    process.exit(1);
  }
};

seedMissingData();
