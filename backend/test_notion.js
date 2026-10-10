import axios from "axios";
async function run() {
  const res = await axios.get("https://api.ashbyhq.com/posting-api/job-board/notion");
  
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
    
  for (const p of boilerplateParas) {
     if (p.includes("Notinos")) console.log("Found:", p);
  }
}
run();
