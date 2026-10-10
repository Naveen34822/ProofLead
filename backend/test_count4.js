import axios from "axios";
async function run() {
  const res = await axios.get("https://api.ashbyhq.com/posting-api/job-board/supabase");
  let foundOriginal = 0;
  let foundStripped = 0;
  
  for (const job of res.data.jobs) {
      const html = (job.descriptionHtml || job.text || "");
      let cleanHtml = html.replace(/<br\s*\/?>/gi, "\n").replace(/<\/?p>/gi, "\n");
      cleanHtml = cleanHtml.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
      
      const hasOriginal = /\bpostgres(ql)?\b/i.test(cleanHtml);
      if(hasOriginal) foundOriginal++;
      
      let stripped = cleanHtml.replace("About Supabase Supabase is the Postgres development platform, built by developers for developers. We provide a complete backend solution including Database, Auth, Storage, Edge Functions, Realtime, and Vector Search. All services are deeply integrated and designed for growth.", " ");
      stripped = stripped.replace("Supabase is the Postgres development platform, built for developers by developers. We provide a complete backend solution including Database, Auth, Storage, Edge Functions, Realtime, and Vector Search. All services are deeply integrated and designed for growth.", " ");
      stripped = stripped.replace("Supabase is the Postgres development platform, built by developers for developers. We provide a complete backend solution including Database, Auth, Storage, Edge Functions, Realtime, and Vector Search. All services are deeply integrated and designed for growth.", " ");
      
      const hasStripped = /\bpostgres(ql)?\b/i.test(stripped);
      if(hasStripped) foundStripped++;
  }
  console.log("Original:", foundOriginal, "Stripped manually:", foundStripped);
}
run();
