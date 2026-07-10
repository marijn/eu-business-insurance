import app from './app';
import { storage } from './storage';

const PORT = process.env.PORT || 3000;

storage.init().then(() => app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`API base: http://localhost:${PORT}/v1`);
})).catch((error) => {
  console.error('Failed to initialise storage:', error);
  process.exit(1);
});
