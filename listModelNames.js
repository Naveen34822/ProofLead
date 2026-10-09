import { GoogleGenAI } from '@google/genai';
import * as dotenv from 'dotenv';
dotenv.config();

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

async function listModels() {
  try {
    const response = await ai.models.list();
    const names = [];
    for await (const m of response) {
      names.push(m.name);
    }
    console.log("All model names:");
    console.log(names);
  } catch (e) {
    console.error(e.message);
  }
}
listModels();
