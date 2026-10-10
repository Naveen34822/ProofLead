import axios from "axios";
async function run() {
  const res = await axios.get("https://api.ashbyhq.com/posting-api/job-board/supabase");
  let totalWithPostgres = 0;
  let totalOutsideIntro = 0;
  let strippedTotal = 0;
  
  const jobsList = res.data?.jobs || [];
  
  const paragraphCounts = {};
  for (const job of jobsList) {
    const html = (job.descriptionHtml || job.text || "");
    let cleanHtml = html.replace(/<br\s*\/?>/gi, "\n").replace(/<\/?p>/gi, "\n");
    cleanHtml = cleanHtml.replace(/<[^>]+>/g, " ");
    const paras = cleanHtml.split(/\n/).map(p => p.trim().replace(/\s+/g, " ")).filter(p => p.length > 50);
    for (const p of paras) {
      paragraphCounts[p] = (paragraphCounts[p] || 0) + 1;
    }
  }
  const boilerplateParas = Object.entries(paragraphCounts)
    .filter(([p, count]) => count > jobsList.length * 0.5)
    .map(([p]) => p);
    
  let contexts = [];
  
  for (const job of jobsList) {
    const title = (job.title || job.text || "").toLowerCase();
    let department = "";
    if (job.categories && job.categories.team) department = job.categories.team;
    else if (job.departments && job.departments[0] && job.departments[0].name) department = job.departments[0].name;
    else if (job.department) department = job.department;
    department = department.toLowerCase();
    
    const isEngRole = title.includes("engineer") || title.includes("developer") || title.includes("data") || title.includes("product") ||
                      department.includes("engineer") || department.includes("data") || department.includes("product");
                      
    if (isEngRole) {
      const html = (job.descriptionHtml || job.text || "");
      let cleanHtml = html.replace(/<br\s*\/?>/gi, "\n").replace(/<\/?p>/gi, "\n");
      cleanHtml = cleanHtml.replace(/<[^>]+>/g, " ");
      let textRaw = cleanHtml;
      let textRawStripped = cleanHtml.replace(/\s+/g, " ");
      
      const hasPostgresOriginal = /\bpostgres(ql)?\b/i.test(textRaw);
      if(hasPostgresOriginal) totalWithPostgres++;
      
      if (boilerplateParas.length > 0) {
        const jobParas = cleanHtml.split(/\n/).map(p => p.trim().replace(/\s+/g, " "));
        for (const p of jobParas) {
          if (boilerplateParas.includes(p)) {
             const pLower = p.toLowerCase();
             const isCompanyIntro = pLower.includes("about") || pLower.includes("who we are") || pLower.includes("note on ai") || pLower.includes("notinos") || pLower.includes("equal opportunity") || pLower.includes("once a year") || pLower.includes("our goal") || pLower.includes("we care about");
             if (isCompanyIntro) {
                 textRawStripped = textRawStripped.replace(p, " ");
                 strippedTotal++;
             }
          }
        }
      }
      
      const hasPostgresStripped = /\bpostgres(ql)?\b/i.test(textRawStripped);
      if(hasPostgresStripped) {
         totalOutsideIntro++;
         if (contexts.length < 5) {
            const match = textRawStripped.match(/\b(postgres(ql)?)\b/i);
            const idx = match.index;
            contexts.push(textRawStripped.substring(Math.max(0, idx - 40), idx + 40).trim());
         }
      }
    }
  }
  console.log("Total Eng Roles with Postgres (original):", totalWithPostgres);
  console.log("Total Eng Roles with Postgres (after stripping intro):", totalOutsideIntro);
  console.log("Paragraphs stripped total:", strippedTotal);
  console.log("Contexts:");
  contexts.forEach(c => console.log("- " + c.replace(/\n/g, " ")));
}
run();
