import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Optional simple token protection: set PROXY_TOKEN in Vercel env and the client must send
  const expected = process.env.PROXY_TOKEN;
  if (expected) {
    const auth = req.headers.authorization || '';
    if (!auth.startsWith('Bearer ') || auth.split(' ')[1] !== expected) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }

  const { message } = req.body || {};
  if (!message) return res.status(400).json({ error: 'Missing message' });

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: message,
    });
    const text = response?.text ?? response?.output ?? JSON.stringify(response);
    res.json({ reply: text });
  } catch (err) {
    console.error('Gemini error', err);
    res.status(500).json({ error: err?.message ?? String(err) });
  }
}
