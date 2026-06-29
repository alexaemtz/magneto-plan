/**
 * Seed script — inserta modelos de auto y asesores en Firestore.
 * Uso:
 *   node --env-file=.env.local scripts/seed.mjs
 *
 * Requiere las variables NEXT_PUBLIC_FIREBASE_* en .env.local
 * y las credenciales SEED_EMAIL / SEED_PASSWORD (o las pide interactivo).
 */

import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, collection, addDoc, getDocs, serverTimestamp } from 'firebase/firestore';
import { createInterface } from 'readline';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const data = JSON.parse(readFileSync(join(__dirname, 'seed-data.json'), 'utf-8'));

const firebaseConfig = {
  apiKey:            process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain:        process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId:         process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket:     process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId:             process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

function ask(question, hidden = false) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  if (hidden) process.stdout.write(question);
  return new Promise((resolve) => {
    if (hidden) {
      let input = '';
      process.stdin.setRawMode(true);
      process.stdin.resume();
      process.stdin.setEncoding('utf8');
      process.stdin.on('data', function handler(ch) {
        if (ch === '\r' || ch === '\n') {
          process.stdin.setRawMode(false);
          process.stdin.pause();
          process.stdin.removeListener('data', handler);
          process.stdout.write('\n');
          rl.close();
          resolve(input);
        } else if (ch === '') {
          process.exit();
        } else if (ch === '') {
          input = input.slice(0, -1);
        } else {
          input += ch;
        }
      });
    } else {
      rl.question(question, (answer) => { rl.close(); resolve(answer); });
    }
  });
}

async function seedCollection(db, colName, items, keyField = 'name') {
  const snap = await getDocs(collection(db, colName));
  const existing = new Set(snap.docs.map((d) => d.data()[keyField]));
  let added = 0;
  for (const item of items) {
    const name = typeof item === 'string' ? item : item[keyField];
    if (existing.has(name)) continue;
    const doc = typeof item === 'string'
      ? { name, active: true, createdAt: serverTimestamp() }
      : { ...item, createdAt: serverTimestamp() };
    await addDoc(collection(db, colName), doc);
    added++;
    process.stdout.write(`  + ${name}\n`);
  }
  const skipped = items.length - added;
  console.log(`  → ${added} agregados, ${skipped} ya existían.\n`);
  return added;
}

async function main() {
  if (!firebaseConfig.apiKey) {
    console.error('ERROR: No se encontraron las variables NEXT_PUBLIC_FIREBASE_*.');
    console.error('Ejecuta con: node --env-file=.env.local scripts/seed.mjs');
    process.exit(1);
  }

  const email    = process.env.SEED_EMAIL    ?? await ask('Email: ');
  const password = process.env.SEED_PASSWORD ?? await ask('Contraseña: ', true);

  console.log('\nConectando con Firebase...');
  const app  = initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const db   = getFirestore(app);

  try {
    await signInWithEmailAndPassword(auth, email, password);
    console.log('Autenticado ✓\n');
  } catch (err) {
    console.error('Error de autenticación:', err.message);
    process.exit(1);
  }

  console.log(`Modelos de auto (${data.carModels.length}):`);
  await seedCollection(db, 'carModels', data.carModels);

  if (data.advisors.length > 0) {
    console.log(`Asesores (${data.advisors.length}):`);
    await seedCollection(db, 'advisors', data.advisors);
  } else {
    console.log('Asesores: ninguno en seed-data.json, agrégarlos desde Configuración.\n');
  }

  console.log('¡Seed completado!');
  process.exit(0);
}

main().catch((err) => {
  console.error('Error inesperado:', err.message);
  process.exit(1);
});
