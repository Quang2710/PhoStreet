import { defineConfig } from 'vite';

export default defineConfig({
  // đường dẫn tương đối để thư mục dist/ có thể đặt ở bất kỳ đâu (itch.io, GitHub Pages...)
  base: './',
  server: { open: true },
  build: { chunkSizeWarningLimit: 1000 },
});
