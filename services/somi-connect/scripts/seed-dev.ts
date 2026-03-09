/**
 * seed-dev.ts — Seeds the local dev database with test users.
 *
 * Usage:  npx tsx scripts/seed-dev.ts
 *
 * Creates:
 *   - admin@somi.dev    / Admin123!     (role: admin)
 *   - therapist@somi.dev / Therapist123! (role: therapist)
 *
 * Skips users that already exist (safe to re-run).
 */
import 'dotenv/config';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const MONGODB_URI = process.env['MONGODB_URI'] ?? 'mongodb://127.0.0.1:27017/somi-connect';
const SALT_ROUNDS = 12;

interface SeedUser {
  email: string;
  password: string;
  role: 'admin' | 'therapist' | 'client';
}

const USERS: SeedUser[] = [
  { email: 'admin@somi.dev', password: 'Admin123!', role: 'admin' },
  { email: 'therapist@somi.dev', password: 'Therapist123!', role: 'therapist' },
];

async function main() {
  await mongoose.connect(MONGODB_URI);
  console.log(`Connected to ${MONGODB_URI}`);

  const db = mongoose.connection.db!;
  const users = db.collection('users');

  for (const u of USERS) {
    const existing = await users.findOne({ email: u.email });
    if (existing) {
      console.log(`  SKIP  ${u.email} (already exists)`);
      continue;
    }
    const passwordHash = await bcrypt.hash(u.password, SALT_ROUNDS);
    await users.insertOne({
      email: u.email,
      passwordHash,
      role: u.role,
      status: 'active',
      mfaEnabled: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    console.log(`  CREATED  ${u.email}  (password: ${u.password})`);
  }

  await mongoose.disconnect();
  console.log('Done.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
