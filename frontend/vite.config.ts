import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

try {
  const sourceDir = path.resolve(__dirname, 'public/assets/sound');
  const targetDir = path.resolve(__dirname, 'public/sounds');
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }
  const mapping = {
    'move.mp3': 'move.mp3',
    'capture.mp3': 'capture.mp3',
    'castling.mp3': 'castle.mp3',
    'check.mp3': 'check.mp3',
    'checkmate.mp3': 'checkmate.mp3',
    'promote.mp3': 'promote.mp3',
    'castling.mp3': 'game-start.mp3',
    'checkmate.mp3': 'game-end.mp3',
    'checkmate.mp3': 'win.mp3',
    'incorrect-move.mp3': 'lose.mp3',
    'castling.mp3': 'draw.mp3',
    'move.mp3': 'notification.mp3',
    'move.mp3': 'premove.mp3',
    'incorrect-move.mp3': 'illegal.mp3',
    'check.mp3': 'low-time.mp3',
    'promote.mp3': 'puzzle-correct.mp3',
    'incorrect-move.mp3': 'puzzle-incorrect.mp3',
    'castling.mp3': 'puzzle-complete.mp3',
  };
  for (const [srcName, destName] of Object.entries(mapping)) {
    const srcPath = path.join(sourceDir, srcName);
    const destPath = path.join(targetDir, destName);
    if (fs.existsSync(srcPath)) {
      fs.copyFileSync(srcPath, destPath);
    }
  }
  console.log("✅ Chess sound assets successfully copied/mapped to frontend/public/sounds/");
} catch (err) {
  console.error("❌ Failed to copy sound assets:", err);
}

// https://vite.dev/config/
export default defineConfig({
  base: '/',
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/react/') || id.includes('node_modules/react-dom/') || id.includes('node_modules/scheduler/')) {
            return 'vendor-react';
          }
          if (id.includes('node_modules/recharts/')) {
            return 'vendor-charts';
          }
          if (id.includes('node_modules/lucide-react/')) {
            return 'vendor-icons';
          }
        },
      },
    },
    chunkSizeWarningLimit: 600,
  },
})
