import * as cheerio from 'cheerio';

async function checkAndFetch(url, limit) {
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'ProofLeadBot/1.0 (+https://github.com/caprae/prooflead)' }});
    if (!res.ok) return { text: '' };
    const html = await res.text();
    const $ = cheerio.load(html);
    $('nav, footer, script, style, noscript, svg, img, iframe, meta').remove();
    const text = $('body').text().replace(/\s+/g, ' ').trim().slice(0, limit);
    return { text, length: text.length };
  } catch (e) {
    return { text: '' };
  }
}

async function run() {
  const [homeReq, aboutReq, careersReq] = await Promise.all([
    checkAndFetch('https://notion.so', 6000),
    checkAndFetch('https://notion.so/about', 3000),
    checkAndFetch('https://notion.so/careers', 3000)
  ]);
  
  console.log("=== HOME ===");
  console.log("Length:", homeReq.length);
  console.log(homeReq.text.slice(0, 1500));
  
  console.log("\n=== ABOUT ===");
  console.log("Length:", aboutReq.length);
  console.log(aboutReq.text.slice(0, 1500));
  
  console.log("\n=== CAREERS ===");
  console.log("Length:", careersReq.length);
  console.log(careersReq.text.slice(0, 1500));
}
run();
