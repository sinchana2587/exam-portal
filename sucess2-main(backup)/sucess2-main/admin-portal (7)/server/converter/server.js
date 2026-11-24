import app from './app.js';
import { generateAllSampleDocuments } from './sampleGenerator.js';

const PORT = process.env.PORT || 5001;

if (!process.env.VERCEL) {
  app.listen(PORT, async () => {
    console.log(`================================================================`);
    console.log(` ProTick Smart Examination Document Converter Server`);
    console.log(` Institution: Maharaja Institute of Technology Mysore (MIT Mysore)`);
    console.log(` Web Portal: http://localhost:${PORT}`);
    console.log(` API Endpoint: http://localhost:${PORT}/api`);
    console.log(` Health Check: http://localhost:${PORT}/api/health`);
    console.log(`================================================================`);

    try {
      console.log('[Init] Pre-generating sample test documents...');
      await generateAllSampleDocuments();
      console.log('[Init] 10 sample test documents verified and ready.');
    } catch (err) {
      console.warn('[Init] Sample documents init warning:', err.message);
    }
  });
}

export default app;
