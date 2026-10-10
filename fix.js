const fs = require('fs');

// 1. Fix server.js
let serverJs = fs.readFileSync('backend/server.js', 'utf8');

// Remove top-level puppeteer import
serverJs = serverJs.replace(/import puppeteer from 'puppeteer';\n/, '');

// Lazy load puppeteer
serverJs = serverJs.replace(
  "const browser = await puppeteer.launch({ headless: 'new' });",
  "const { default: puppeteer } = await import('puppeteer');\n      const browser = await puppeteer.launch({ headless: 'new' });"
);

// Add startup logs for Database
serverJs = serverJs.replace(
  "const db = new Database(dbPath);",
  "console.log('About to initialize database at:', dbPath);\nconst db = new Database(dbPath);\nconsole.log('Database initialized successfully.');"
);

// Add startup logs before app.listen
serverJs = serverJs.replace(
  "app.listen(PORT, () => {",
  "console.log('About to call app.listen on port:', PORT);\napp.listen(PORT, () => {"
);

fs.writeFileSync('backend/server.js', serverJs);
console.log('server.js updated');

// 2. Fix root package.json
let rootPkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));

// Change start script
if (rootPkg.scripts) {
  rootPkg.scripts.start = "npm run start --prefix backend";
}

// Remove frontend/backend packages from root
const removeDeps = [
  'puppeteer', '@google/genai', 'concurrently', 'react', 'react-dom', 'lucide-react',
  'express', 'cors', 'axios', 'cheerio', 'groq-sdk', 'better-sqlite3', 'robots-parser',
  'vite', '@vitejs/plugin-react'
];

if (rootPkg.dependencies) {
  removeDeps.forEach(dep => delete rootPkg.dependencies[dep]);
}
if (rootPkg.devDependencies) {
  removeDeps.forEach(dep => delete rootPkg.devDependencies[dep]);
}

fs.writeFileSync('package.json', JSON.stringify(rootPkg, null, 2));
console.log('package.json updated');

