import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, 'data', 'leads.db');
const seedPath = path.join(__dirname, 'seed', 'leads.json');

if (!fs.existsSync(dbPath)) {
  console.log('No DB found.');
  process.exit(0);
}

const db = new Database(dbPath);
const leads = db.prepare('SELECT domain, data FROM leads').all();

const out = leads.map(r => ({
  domain: r.domain,
  data: JSON.parse(r.data)
}));

fs.writeFileSync(seedPath, JSON.stringify(out, null, 2));
console.log(`Exported ${out.length} leads to ${seedPath}`);
