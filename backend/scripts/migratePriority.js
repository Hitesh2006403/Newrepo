require('dotenv').config();
const mongoose = require('mongoose');
const { connectDB, closeDB } = require('../src/config/db');
const Donation = require('../src/models/Donation');
const RecipientRequirement = require('../src/models/RecipientRequirement');
const DeliveryTask = require('../src/models/DeliveryTask');
const { PRIORITY, PRIORITY_WEIGHTS } = require('../src/constants/priority');

/**
 * Migration Script: Populate user-chosen priority & priorityWeight across legacy records.
 *
 * Requirements:
 * - Supports --dry-run flag: reports counts of records that would be updated without modifying data.
 * - Refuses to run if NODE_ENV === 'production' unless --force flag is passed.
 * - Idempotent: safe to run multiple times without corrupting or duplicating data.
 * - Prints counts only (no PII or secrets).
 */
const runMigration = async () => {
  const args = process.argv.slice(2);
  const isDryRun = args.includes('--dry-run');
  const isForce = args.includes('--force');

  if (process.env.NODE_ENV === 'production' && !isForce) {
    console.error(
      '[Migration Error] Refusing to run in production without the --force flag.\nUsage: node scripts/migratePriority.js --force [--dry-run]'
    );
    process.exit(1);
  }

  console.log(`[Migration] Mode: ${isDryRun ? 'DRY RUN (Read-Only)' : 'LIVE EXECUTION'}`);
  console.log(`[Migration] Environment: ${process.env.NODE_ENV || 'development'}`);

  try {
    await connectDB();
    console.log('[Migration] Database connection established.');

    // -------------------------------------------------------------------------
    // 1. DONATIONS MIGRATION
    // -------------------------------------------------------------------------
    const totalDonations = await Donation.countDocuments({});
    
    // Legacy donations without priority or with missing/incorrect priorityWeight
    const donationsToUpdate = await Donation.find({
      $or: [
        { priority: { $exists: false } },
        { priority: { $nin: Object.values(PRIORITY) } },
        { priorityWeight: { $exists: false } },
      ],
    }).select('_id priority priorityWeight');

    console.log(`\n--- Donations ---`);
    console.log(`Total donations scanned: ${totalDonations}`);
    console.log(`Donations needing migration: ${donationsToUpdate.length}`);

    let donationsUpdatedCount = 0;
    if (!isDryRun && donationsToUpdate.length > 0) {
      for (const d of donationsToUpdate) {
        const resolvedPriority = Object.values(PRIORITY).includes(d.priority) ? d.priority : PRIORITY.MEDIUM;
        const resolvedWeight = PRIORITY_WEIGHTS[resolvedPriority] || 2;
        await Donation.updateOne(
          { _id: d._id },
          {
            $set: {
              priority: resolvedPriority,
              priorityWeight: resolvedWeight,
            },
          }
        );
        donationsUpdatedCount++;
      }
      console.log(`Donations updated: ${donationsUpdatedCount}`);
    } else if (isDryRun) {
      console.log(`[Dry Run] Would update ${donationsToUpdate.length} donations.`);
    }

    // -------------------------------------------------------------------------
    // 2. RECIPIENT REQUIREMENTS MIGRATION
    // -------------------------------------------------------------------------
    const totalRequirements = await RecipientRequirement.countDocuments({});

    const requirementsToUpdate = await RecipientRequirement.find({
      $or: [
        { priority: { $exists: false } },
        { priority: { $nin: Object.values(PRIORITY) } },
        { priorityWeight: { $exists: false } },
      ],
    }).select('_id urgency priority priorityWeight');

    console.log(`\n--- Recipient Requirements ---`);
    console.log(`Total requirements scanned: ${totalRequirements}`);
    console.log(`Requirements needing migration: ${requirementsToUpdate.length}`);

    let requirementsUpdatedCount = 0;
    if (!isDryRun && requirementsToUpdate.length > 0) {
      for (const r of requirementsToUpdate) {
        // Map legacy urgency to priority
        let resolvedPriority = PRIORITY.MEDIUM;
        if (r.urgency === 'CRITICAL' || r.urgency === 'HIGH') {
          resolvedPriority = PRIORITY.HIGH;
        } else if (r.urgency === 'LOW') {
          resolvedPriority = PRIORITY.LOW;
        } else if (r.urgency === 'MEDIUM') {
          resolvedPriority = PRIORITY.MEDIUM;
        } else if (Object.values(PRIORITY).includes(r.priority)) {
          resolvedPriority = r.priority;
        }

        const resolvedWeight = PRIORITY_WEIGHTS[resolvedPriority] || 2;
        await RecipientRequirement.updateOne(
          { _id: r._id },
          {
            $set: {
              priority: resolvedPriority,
              priorityWeight: resolvedWeight,
              urgency: resolvedPriority,
            },
          }
        );
        requirementsUpdatedCount++;
      }
      console.log(`Requirements updated: ${requirementsUpdatedCount}`);
    } else if (isDryRun) {
      console.log(`[Dry Run] Would update ${requirementsToUpdate.length} recipient requirements.`);
    }

    // -------------------------------------------------------------------------
    // 3. DELIVERY TASKS MIGRATION
    // -------------------------------------------------------------------------
    const totalDeliveryTasks = await DeliveryTask.countDocuments({});
    const deliveryTasksToUpdate = await DeliveryTask.find({
      $or: [
        { priority: { $exists: false } },
        { priorityWeight: { $exists: false } },
      ],
    }).select('_id priority priorityWeight donationId');

    console.log(`\n--- Delivery Tasks ---`);
    console.log(`Total delivery tasks scanned: ${totalDeliveryTasks}`);
    console.log(`Delivery tasks needing migration: ${deliveryTasksToUpdate.length}`);

    let deliveryTasksUpdatedCount = 0;
    if (!isDryRun && deliveryTasksToUpdate.length > 0) {
      for (const dt of deliveryTasksToUpdate) {
        let donation = null;
        if (dt.donationId && mongoose.Types.ObjectId.isValid(dt.donationId)) {
          donation = await Donation.findById(dt.donationId).select('priority').lean();
        }
        const resolvedPriority = donation?.priority || PRIORITY.MEDIUM;
        const resolvedWeight = PRIORITY_WEIGHTS[resolvedPriority] || 2;
        await DeliveryTask.updateOne(
          { _id: dt._id },
          {
            $set: {
              priority: resolvedPriority,
              priorityWeight: resolvedWeight,
            },
          }
        );
        deliveryTasksUpdatedCount++;
      }
      console.log(`Delivery tasks updated: ${deliveryTasksUpdatedCount}`);
    } else if (isDryRun) {
      console.log(`[Dry Run] Would update ${deliveryTasksToUpdate.length} delivery tasks.`);
    }

    console.log(`\n[Migration Summary]`);
    console.log(`Result: SUCCESS (${isDryRun ? 'Dry Run - No database changes written' : 'Live migration applied'})`);
    console.log(`Donations affected: ${isDryRun ? donationsToUpdate.length : donationsUpdatedCount}`);
    console.log(`Requirements affected: ${isDryRun ? requirementsToUpdate.length : requirementsUpdatedCount}`);
    console.log(`Delivery tasks affected: ${isDryRun ? deliveryTasksToUpdate.length : deliveryTasksUpdatedCount}`);

  } catch (error) {
    console.error('[Migration Fatal]', error.message);
    process.exit(1);
  } finally {
    await closeDB();
    console.log('[Migration] Connection closed.');
  }
};

runMigration();
