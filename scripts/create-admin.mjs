/**
 * Ashmawy Restaurant - Create / Verify Admin User Script
 * Usage: npm run create-admin [email] [password]
 */

import { initializeApp, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

const projectId = process.env.FIREBASE_PROJECT_ID || 'ashmawy-ordering';
const app = getApps().length === 0 ? initializeApp({ projectId }) : getApps()[0];
const auth = getAuth(app);
const db = getFirestore(app);

const email = process.argv[2] || 'admin@ashmawy.com';
const password = process.argv[3] || 'Admin@123456';

async function main() {
  console.log(`Setting up admin user for: ${email}...`);

  let userRecord;
  try {
    userRecord = await auth.getUserByEmail(email);
    console.log(`✓ Found user record with UID: ${userRecord.uid}`);
    if (password) {
      await auth.updateUser(userRecord.uid, { password, emailVerified: true });
      console.log(`✓ Password and email verification updated.`);
    }
  } catch (err) {
    if (err.code === 'auth/user-not-found') {
      userRecord = await auth.createUser({
        email,
        password,
        emailVerified: true,
      });
      console.log(`✓ Created new user with UID: ${userRecord.uid}`);
    } else {
      throw err;
    }
  }

  // Set admin custom claims
  await auth.setCustomUserClaims(userRecord.uid, { role: 'admin' });
  console.log(`✓ Custom user claims set: { role: 'admin' }`);

  // Update admins collection in Firestore
  try {
    await db.collection('admins').doc(userRecord.uid).set(
      {
        uid: userRecord.uid,
        email,
        role: 'admin',
        is_active: true,
        updated_at: new Date().toISOString(),
      },
      { merge: true }
    );
    console.log(`✓ Firestore admins document updated.`);
  } catch (dbErr) {
    console.warn(`! Firestore update notice: ${dbErr.message}`);
  }

  console.log(`\n🎉 Admin account ready to use:`);
  console.log(`   Email:    ${email}`);
  console.log(`   Password: ${password}\n`);
}

main().catch((err) => {
  console.error('Error creating admin:', err.message);
  process.exit(1);
});

