import express from 'express';
import cors from 'cors';
import { GoogleGenerativeAI } from '@google/generative-ai';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';

dotenv.config();

const currentFilename = typeof import.meta?.url === 'string' ? fileURLToPath(import.meta.url) : (typeof __filename !== 'undefined' ? __filename : '');
const currentDirname = currentFilename ? path.dirname(currentFilename) : process.cwd();

async function startServer() {
  const app = express();
  app.use(cors());
  app.use(express.json());

  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

  app.post('/api/analyze-ticket', async (req, res) => {
    try {
      const { message } = req.body;
      if (!message) return res.status(400).json({ error: 'Message is required' });

      const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

      const prompt = `
        You are an IT Support AI. Analyze the following message from an employee and determine if it is a support request.
        If it is a support request, respond with a JSON object containing:
        {
          "is_support_request": true,
          "title": "Short descriptive title",
          "category": "IT Support" | "HR" | "Facility" | "General",
          "priority": "Low" | "Medium" | "High" | "Urgent",
          "description": "Cleaned up description of the problem"
        }
        If it is NOT a support request (just general greeting or talk), respond with:
        { "is_support_request": false }

        Message: "${message}"
        Response:`;

      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text().trim();
      
      // Clean JSON response (sometimes Gemini adds ```json ... ```)
      const jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();
      
      try {
        const parsed = JSON.parse(jsonStr);
        res.json(parsed);
      } catch (e) {
        console.error('Failed to parse Gemini response:', text);
        res.json({ is_support_request: false });
      }
    } catch (error: any) {
      console.error('Error analyzing ticket:', error);
      res.status(500).json({ error: 'Failed to analyze ticket' });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Serve frontend in production
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const PORT = Number(process.env.PORT) || 3000;
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
