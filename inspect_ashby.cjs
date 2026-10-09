const axios = require('axios');
async function run() {
  const res = await axios.get('https://api.ashbyhq.com/posting-api/job-board/notion');
  const job = res.data.jobs[0];
  console.log(Object.keys(job));
  console.log('Description length:', (job.descriptionHtml || job.description || '').length);
}
run();
