# 🎓 HCMUTE EduQuiz - Ứng Dụng Web Trắc Nghiệm Đấu Trí Điểm Cộng

Hệ thống web trắc nghiệm tương tác thời gian thực (Real-time Quiz Web App) mang phong cách Kahoot hiện đại, chuẩn nhận diện **Trường Đại học Sư phạm Kỹ thuật TP.HCM (HCMUTE)** và học phần **Triết học Mác - Lênin (Mã HP: LLCT130105)**.

---

## 🌟 TÍNH NĂNG VƯỢT TRỘI SO VỚI KAHOOT

1. **Khóa đề thi an toàn (Lobby Protection)**:
   - Sinh viên điền Họ & tên, MSSV và chọn Avatar may mắn.
   - Giao diện câu hỏi được **KHÓA HOÀN TOÀN** ở phòng chờ.
   - Chỉ khi Admin / Chủ phòng bấm **"BẮT ĐẦU LÀM BÀI"**, toàn bộ câu hỏi mới được đồng loạt mở khóa trên màn hình tất cả sinh viên.
2. **Bộ 20 câu hỏi triết học phong phú**:
   - Trắc nghiệm A/B/C/D, Đúng/Sai, Ghép cặp, Suy luận sơ đồ & Đoán hình ảnh minh họa thực tế.
   - Thời gian từng câu được thiết lập linh hoạt theo độ khó (25s - 45s), tổng thời gian chuẩn 12 - 15 phút.
   - Điểm số tính theo độ chính xác và tốc độ phản xạ + chuỗi trả lời đúng liên tiếp (Streak 🔥).
3. **Tự động vinh danh TOP 20% sinh viên nhận điểm cộng**:
   - Sau khi kết thúc 20 câu, hệ thống tính toán chính xác số lượng và danh sách **20% bạn có điểm số cao nhất lớp** để nhận điểm cộng phát biểu / chuyên cần môn Triết.
   - Bục vinh danh Podium (Quán quân, Á quân, Hạng 3) kèm hiệu ứng pháo hoa Confetti và âm thanh vinh quang.
4. **Xuất báo cáo Excel chuyên nghiệp (.xlsx)**:
   - Tải về ngay lập tức với 3 Sheet định dạng chuẩn:
     * **Sheet 1**: Danh sách Top 20% đạt điểm cộng (Hạng, MSSV, Họ tên, Điểm, Số câu đúng, Xác nhận điểm cộng).
     * **Sheet 2**: Bảng xếp hạng toàn bộ lớp tham gia.
     * **Sheet 3**: Lịch sử chi tiết từng câu hỏi (Câu 1 -> 20: Đúng/Sai và thời gian trả lời của từng bạn).
5. **Cơ sở dữ liệu thật (Persistent Database JSON & REST API)**:
   - Lưu trữ tại `data/database.json`. Dễ dàng mở rộng cho các môn học khác (Kinh tế chính trị, Tư tưởng Hồ Chí Minh, Lịch sử Đảng, v.v.).
6. **Tương thích hoàn hảo mọi thiết bị**:
   - Giao diện cảm ứng siêu mượt trên điện thoại smartphone (iOS, Android).
   - Màn chiếu Projector dành riêng cho Host với biểu đồ cột phân bố đáp án của cả lớp và Top 5 thời gian thực.

---

## 🚀 HƯỚNG DẪN SỬ DỤNG TRỰC TIẾP TRÊN LỚP HỌC

### Cách 1: Chạy trực tiếp trên mạng Wi-Fi của lớp học (Nhanh nhất - Không cần cài đặt gì thêm)

1. Laptop của bạn kết nối vào Wi-Fi lớp học (hoặc bật Điểm phát sóng di động / Hotspot từ điện thoại).
2. Nhấp đúp vào file `START_QUIZ.bat` (hoặc mở terminal gõ `node server.js`).
3. Màn hình console sẽ hiện:
   * **Màn chiếu lớp học (Host)**: Mở trình duyệt vào `http://localhost:3000/host` (chiếu lên máy chiếu).
   * **Sinh viên tham gia**: Mở trình duyệt điện thoại và gõ địa chỉ IP hiển thị trên màn hình (Ví dụ: `http://192.168.1.21:3000`).
4. Khi cả lớp đã vào phòng chờ đông đủ, Chủ phòng bấm nút **"BẮT ĐẦU LÀM BÀI"**!

---

## 🌐 HƯỚNG DẪN DEPLOY LÊN INTERNET ĐỂ AI CŨNG VÀO ĐƯỢC (4G / 5G / MỌI MẠNG)

Nếu muốn có một đường link online công khai (ví dụ: `https://hcmute-triet-quiz.onrender.com`):

### Tùy chọn A: Dùng LocalTunnel / ngrok (Có link online trong 10 giây)

Mở cửa sổ dòng lệnh thứ hai và chạy:

```bash
npx localtunnel --port 3000
```

Bạn sẽ nhận được 1 link công khai dạng `https://happy-cat-12.loca.lt`, gửi link này cho cả lớp vào bằng 4G/Wi-Fi bình thường!

### Tùy chọn B: Deploy miễn phí 100% lên Render.com

1. Đăng ký tài khoản miễn phí tại [render.com](https://render.com).
2. Tạo Web Service mới -> Chọn repository Github của dự án.
3. Cấu hình:
   * **Environment**: `Node`
   * **Build Command**: `npm install`
   * **Start Command**: `node server.js`
4. Bấm **Deploy**. Sau 1-2 phút, bạn sẽ có domain miễn phí chạy 24/7!

---

## 📂 CẤU TRÚC THƯ MỤC DỰ ÁN

```
quiz-app/
├── START_QUIZ.bat         # File nhấp đúp chạy nhanh máy chủ trên Windows
├── server.js              # Server Node.js + Express + Socket.io + Excel Generator
├── package.json           # Danh sách thư viện (express, socket.io, xlsx, cors)
├── Procfile               # Cấu hình deploy đám mây (Render, Railway, Heroku)
├── data/
│   └── database.json      # Cơ sở dữ liệu thật lưu trữ môn học, 20 câu hỏi & lịch sử
└── public/
    ├── index.html         # Giao diện dành cho người chơi (Sinh viên)
    ├── host.html          # Giao diện dành cho chủ phòng (Máy chiếu giảng đường)
    ├── style.css          # Hệ thống giao diện HCMUTE & Kahoot mượt mà, responsive
    ├── app.js             # Logic xử lý thời gian thực của sinh viên
    ├── host.js            # Logic điều khiển màn chiếu, chuyển câu & bục vinh danh
    ├── utils.js           # Bộ phát âm thanh Web Audio sống động & pháo hoa Confetti
    └── images/            # Hình ảnh nhận diện HCMUTE & hình ảnh câu hỏi trắc nghiệm
```

---

*Thực hiện bởi Nhóm VI - Lớp Triết học Mác - Lênin (LLCT130105) - Trường ĐH Sư phạm Kỹ thuật TP.HCM (HCMUTE)*
