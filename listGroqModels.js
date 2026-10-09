import Groq from 'groq-sdk';
import * as dotenv from 'dotenv';
dotenv.config();

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

async function listModels() {
  try {
    const response = await groq.models.list();
    console.log(response.data.map(m => m.id));
  } catch (e) {
    console.error(e.message);
  }
}
listModels();
