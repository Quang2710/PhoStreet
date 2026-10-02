# Phở Loạn Phố

Game 3D nấu ăn co-op hỗn loạn (Three.js + Vite).

```bash
npm install
npm run dev       # chạy dev server, tự mở trình duyệt
npm run build     # build ra thư mục dist/
npm run preview   # chạy thử bản build
```

- `src/data.js` – nguyên liệu, món ăn, bản đồ các màn, câu thoại
- `src/game.js` – lõi game (vật lý, nấu nướng, sự kiện, tính điểm)
- `src/models.js` – mô hình 3D, `src/audio.js` – âm thanh WebAudio, `src/main.js` – menu/HUD
