import { GoogleGenAI } from '@google/genai';
import * as dotenv from 'dotenv';
dotenv.config();

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

async function listModels() {
  try {
    const response = await ai.models.list();
    // In @google/genai the syntax might be ai.models.listModels() or it might not exist.
    // Let's try ai.models.list()
    // Wait, the error said "Call ModelService.ListModels"
    // Let's just catch it.
    console.log(response);
  } catch (e) {
    console.error(e.message);
  }
}
listModels();
