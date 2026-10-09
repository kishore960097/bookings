require('dotenv').config();
const { DatabaseSync } = require('node:sqlite');
const fs = require('fs');
const path = require('path');
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

const serviceAccountPath = 'C:\\projects\\QGo\\qqoo-b335e-firebase-adminsdk-fbsvc-c5f8bf3001.json';
let app;
if (fs.existsSync(serviceAccountPath)) {
  const serviceAccount = require(serviceAccountPath);
  app = initializeApp({ credential: cert(serviceAccount) });
} else {
  app = initializeApp({ projectId: process.env.VITE_FIREBASE_PROJECT_ID || 'qqoo-b335e' });
}

const firestore = getFirestore(app);

async function migrate() {
  const dataDir = path.join(process.cwd(), '.data');
  const dbFile = path.join(dataDir, 'qgo.db');
  
  if (!fs.existsSync(dbFile)) {
    console.log('No SQLite DB found to migrate.');
    return;
  }

  const sqlite = new DatabaseSync(dbFile);
  const tables = sqlite.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
  
  for (const tableRow of tables) {
    const tableName = tableRow.name;
    if (tableName === 'sqlite_sequence') continue;
    
    console.log(`Migrating table: ${tableName}...`);
    const rows = sqlite.prepare(`SELECT key, value FROM ${tableName}`).all();
    
    const batchSize = 400;
    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = firestore.batch();
      const chunk = rows.slice(i, i + batchSize);
      
      for (const row of chunk) {
        let valueObj;
        try {
          valueObj = JSON.parse(row.value);
        } catch(e) {
          continue;
        }
        const docRef = firestore.collection(tableName).doc(row.key);
        batch.set(docRef, valueObj);
      }
      
      await batch.commit();
      console.log(`  Committed ${chunk.length} rows to ${tableName}.`);
    }
  }
  
  console.log('Migration complete!');
}

migrate().catch(console.error);
