import express from 'express';

export function createApp() {
  const app = express();
  app.use(express.json());
  app.get('/api/health', (req, res) => {
    res.status(200).json({ status: 'ok' });
  });
  return app;
}

const port = Number(process.env.PORT || 3000);
if (process.env.NODE_ENV !== 'test') {
  const app = createApp();
  app.listen(port, () => {
    console.log(`backend listening on ${port}`);
  });
}
