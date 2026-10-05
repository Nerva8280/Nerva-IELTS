# IELTS Coach

Web app + PWA (cài lên điện thoại) để tự học tiếng Anh/IELTS 20–30 phút mỗi ngày.

- **Kiểm tra trình độ**: ước lượng vốn từ bằng cách chọn từ đã biết (có từ giả để chống đoán), xếp level A1–C1.
- **4 lộ trình** (Nền tảng / IELTS 5.5 / IELTS 6.5 / Tăng tốc) với lịch trọng tâm theo ngày trong tuần; kế hoạch mỗi ngày gồm ôn từ (SRS), từ mới, bài trọng tâm, shadowing. Tự đề xuất lên level.
- **Nội dung**: 1.350 từ vựng (có IPA, ví dụ), 40 bài ngữ pháp, 20 bài Reading, 20 bài Listening, 24 đề Writing (có bài mẫu), 30 chủ đề Speaking, 30 bài shadowing, mock test mini.
- **Giọng đọc** Anh–Anh / Anh–Mỹ (Web Speech API), chỉnh tốc độ, giọng nam/nữ cho hội thoại.
- **Shadowing**: nghe từng câu, lặp, chậm, nói theo và được chấm từng từ (speech recognition), ghi âm để so sánh, chế độ tự động, tự dán đoạn văn bất kỳ.
- **Nhắc giờ học**: thông báo đẩy (PWA) và/hoặc thêm lịch lặp lại vào lịch điện thoại / Google Calendar.
- **Đăng nhập Google**; tiến độ lưu trên máy và đồng bộ lên Neon Postgres.

Nội dung nằm ở `src/content/data/*.json` (kiểu dữ liệu: `src/content/types.ts`).

## Chạy trên máy

```bash
npm install
cp .env.example .env.local   # điền các biến (có thể để trống để dùng thử)
npm run dev
```

Không có `NEXT_PUBLIC_GOOGLE_CLIENT_ID` thì app hiện nút "Dùng thử", dữ liệu chỉ lưu trên trình duyệt.

## Triển khai (miễn phí)

1. **Neon**: tạo database → lấy connection string → `DATABASE_URL`.
2. **Google OAuth**: Google Cloud Console → Credentials → *OAuth client ID* (Web application) → thêm domain Vercel vào *Authorized JavaScript origins* → `NEXT_PUBLIC_GOOGLE_CLIENT_ID`.
3. **VAPID**: `npx web-push generate-vapid-keys` → `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`.
4. `SESSION_SECRET`, `CRON_SECRET`: chuỗi ngẫu nhiên.
5. **Vercel**: import project, đặt các biến môi trường trên, deploy.
6. **cron-job.org**: tạo job mỗi 15 phút gọi `GET https://<domain>/api/cron/remind` với header `Authorization: Bearer <CRON_SECRET>`.

Trên iPhone, thông báo đẩy chỉ hoạt động khi đã "Thêm vào MH chính" (iOS 16.4+).
