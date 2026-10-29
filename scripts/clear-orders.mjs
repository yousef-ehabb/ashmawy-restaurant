/**
 * Ashmawy Restaurant - Clear Orders Script
 * Deletes all documents in the orders collection and resets idempotency records.
 * Can be run against the Firestore emulator or live Firestore.
 * 
 * Usage: npm run clear-orders
 */

import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs';
import path from 'path';

// Read .env if present to match current environment configuration
try {
  const envPath = path.resolve(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    for (const line of envContent.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const idx = trimmed.indexOf('=');
      if (idx !== -1) {
        const k = trimmed.slice(0, idx).trim();
        const v = trimmed.slice(idx + 1).trim();
        if (!process.env[k]) {
          process.env[k] = v;
        }
      }
    }
  }
} catch {}

const projectId = process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID || 'ashmawy-ordering';
const app = getApps().length === 0 ? initializeApp({ projectId }) : getApps()[0];
const db = getFirestore(app);
db.settings({ ignoreUndefinedProperties: true });

async function clearCollection(collectionName) {
  const snapshot = await db.collection(collectionName).get();
  if (snapshot.empty) {
    console.log(`ℹ Collection "${collectionName}" is already empty.`);
    return 0;
  }

  const docs = snapshot.docs;
  console.log(`Deleting ${docs.length} document(s) from "${collectionName}"...`);
  
  for (let i = 0; i < docs.length; i += 400) {
    const chunk = docs.slice(i, i + 400);
    const batch = db.batch();
    chunk.forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }

  return docs.length;
}

async function main() {
  const targetHost = process.env.FIRESTORE_EMULATOR_HOST ? `Emulator (${process.env.FIRESTORE_EMULATOR_HOST})` : 'Live Firestore';
  console.log(`\n🧹 Ashmawy Restaurant - Order Cleanup Tool`);
  console.log(`Target: ${targetHost} | Project: ${projectId}\n`);

  const deletedOrders = await clearCollection('orders');
  const deletedIdemp = await clearCollection('idempotency_records');

  // Reset sequential order counter back to initial starting point (1000)
  try {
    await db.collection('counters').doc('order_counter').set({
      current_number: 1000,
      reset_at: new Date().toISOString(),
    }, { merge: true });
    console.log(`✓ Order counter reset to #1000.`);
  } catch (err) {
    console.warn(`! Notice resetting counter: ${err.message}`);
  }

  console.log(`\n✅ Finished successfully!`);
  console.log(`   - Orders removed: ${deletedOrders}`);
  console.log(`   - Idempotency records cleared: ${deletedIdemp}\n`);
}

main().catch((err) => {
  console.error('Error during cleanup:', err);
  process.exit(1);
});

