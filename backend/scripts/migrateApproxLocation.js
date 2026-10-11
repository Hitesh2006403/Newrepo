require('dotenv').config();
const { connectDB, closeDB } = require('../src/config/db');
const User = require('../src/models/User');
const Donation = require('../src/models/Donation');
const RecipientRequirement = require('../src/models/RecipientRequirement');
const { computeApproxLocation } = require('../src/utils/geoUtils');

/**
 * Migration Script: Populate approxLocation and mapVisible across legacy records.
 *
 * Requirements:
 * - Supports --dry-run flag: reports counts without modifying database.
 * - Refuses production execution without --force flag.
 * - Idempotent: safe to run multiple times.
 * - Prints counts only (no PII or coordinates).
 */
const runMigration = async () => {
  const args = process.argv.slice(2);
  const isDryRun = args.includes('--dry-run');
  const isForce = args.includes('--force');

  if (process.env.NODE_ENV === 'production' && !isForce) {
    console.error(
      '[Geo Migration Error] Refusing to run in production without the --force flag.\nUsage: node scripts/migrateApproxLocation.js --force [--dry-run]'
    );
    process.exit(1);
  }

  console.log(`[Geo Migration] Mode: ${isDryRun ? 'DRY RUN (Read-Only)' : 'LIVE EXECUTION'}`);
  console.log(`[Geo Migration] Environment: ${process.env.NODE_ENV || 'development'}`);

  try {
    await connectDB();
    console.log('[Geo Migration] Database connection established.');

    // 1. USERS
    const totalUsers = await User.countDocuments({});
    const usersToUpdate = await User.find({
      $or: [
        { approxLocation: { $exists: false } },
        { 'approxLocation.coordinates': [0, 0] },
        { mapVisible: { $exists: false } },
      ],
    }).select('_id location approxLocation mapVisible').lean();

    console.log(`\n--- Users ---`);
    console.log(`Total users scanned: ${totalUsers}`);
    console.log(`Users needing migration: ${usersToUpdate.length}`);

    let usersUpdated = 0;
    if (!isDryRun && usersToUpdate.length > 0) {
      for (const u of usersToUpdate) {
        const approx = computeApproxLocation(u.location);
        const updateDoc = {};
        if (approx) updateDoc.approxLocation = approx;
        if (u.mapVisible === undefined) updateDoc.mapVisible = true;

        if (Object.keys(updateDoc).length > 0) {
          await User.updateOne({ _id: u._id }, { $set: updateDoc });
          usersUpdated++;
        }
      }
      console.log(`Users updated: ${usersUpdated}`);
    } else if (isDryRun) {
      console.log(`[Dry Run] Would update ${usersToUpdate.length} users.`);
    }

    // 2. DONATIONS
    const totalDonations = await Donation.countDocuments({});
    const donationsToUpdate = await Donation.find({
      $or: [
        { approxLocation: { $exists: false } },
        { 'approxLocation.coordinates': [0, 0] },
      ],
    }).select('_id location approxLocation').lean();

    console.log(`\n--- Donations ---`);
    console.log(`Total donations scanned: ${totalDonations}`);
    console.log(`Donations needing migration: ${donationsToUpdate.length}`);

    let donationsUpdated = 0;
    if (!isDryRun && donationsToUpdate.length > 0) {
      for (const d of donationsToUpdate) {
        const approx = computeApproxLocation(d.location);
        if (approx) {
          await Donation.updateOne({ _id: d._id }, { $set: { approxLocation: approx } });
          donationsUpdated++;
        }
      }
      console.log(`Donations updated: ${donationsUpdated}`);
    } else if (isDryRun) {
      console.log(`[Dry Run] Would update ${donationsToUpdate.length} donations.`);
    }

    // 3. RECIPIENT REQUIREMENTS
    const totalRequirements = await RecipientRequirement.countDocuments({});
    const requirementsToUpdate = await RecipientRequirement.find({
      $or: [
        { approxLocation: { $exists: false } },
        { 'approxLocation.coordinates': [0, 0] },
      ],
    }).select('_id location approxLocation').lean();

    console.log(`\n--- Recipient Requirements ---`);
    console.log(`Total requirements scanned: ${totalRequirements}`);
    console.log(`Requirements needing migration: ${requirementsToUpdate.length}`);

    let requirementsUpdated = 0;
    if (!isDryRun && requirementsToUpdate.length > 0) {
      for (const r of requirementsToUpdate) {
        const approx = computeApproxLocation(r.location);
        if (approx) {
          await RecipientRequirement.updateOne({ _id: r._id }, { $set: { approxLocation: approx } });
          requirementsUpdated++;
        }
      }
      console.log(`Requirements updated: ${requirementsUpdated}`);
    } else if (isDryRun) {
      console.log(`[Dry Run] Would update ${requirementsToUpdate.length} requirements.`);
    }

    console.log(`\n[Geo Migration Summary]`);
    console.log(`Result: SUCCESS (${isDryRun ? 'Dry Run - No database changes written' : 'Live migration applied'})`);
    console.log(`Users affected: ${isDryRun ? usersToUpdate.length : usersUpdated}`);
    console.log(`Donations affected: ${isDryRun ? donationsToUpdate.length : donationsUpdated}`);
    console.log(`Requirements affected: ${isDryRun ? requirementsToUpdate.length : requirementsUpdated}`);
  } catch (error) {
    console.error('[Geo Migration Fatal]', error.message);
    process.exit(1);
  } finally {
    await closeDB();
    console.log('[Geo Migration] Connection closed.');
  }
};

runMigration();
