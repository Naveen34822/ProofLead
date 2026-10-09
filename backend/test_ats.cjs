const cheerio = require('cheerio');
const axios = require('axios');
axios.get('https://notion.so/careers', { headers: { 'User-Agent': 'ProofLeadBot/1.0 (+https://github.com/caprae/prooflead)' }}).then(res => {
  const $ = cheerio.load(res.data);
  $('a').each((_, el) => {
    const href = $(el).attr('href') || '';
    if (href.includes('ashbyhq.com/')) {
      console.log('HREF:', href);
    }
  });
}).catch(console.error);
