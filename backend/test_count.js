import axios from "axios";
async function run() {
  const res = await axios.get("https://api.ashbyhq.com/posting-api/job-board/supabase");
  let found = 0;
  for (const job of res.data.jobs) {
    if(!job.descriptionHtml) continue;
    let clean = job.descriptionHtml.replace(/<[^>]+>/g, " ");
    
    // Remove the boilerplate
    const intro = "Supabase is the Postgres development platform, built by developers for developers. We provide a complete backend solution including Database, Auth, Storage, Edge Functions, Realtime, and Vector Search. All services are deeply integrated and designed for growth.";
    clean = clean.replace(intro, " ");
    
    if(/\bpostgres\b/i.test(clean) || /\bpostgresql\b/i.test(clean)) {
       const match = clean.match(/\b(postgres(ql)?)\b/i);
       const idx = match.index;
       console.log(clean.substring(Math.max(0, idx - 40), idx + 40).replace(/\n/g, " ").trim());
       found++;
    }
  }
  console.log("Total roles with Postgres (outside intro):", found);
}
run();
