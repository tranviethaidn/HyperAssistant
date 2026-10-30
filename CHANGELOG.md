# 📜 Lịch sử thay đổi (Changelog)

Toàn bộ các thay đổi, bản vá lỗi và nâng cấp hiệu năng của dự án **HyperAssistant (HyperTranslator)** được ghi nhận chi tiết tại đây.

---

## [1.1.0] - 2026-10-30

### 🐛 Vá lỗi quan trọng (Bug Fixes)
* **Nuốt phím `Esc` toàn cầu**: Sửa hàm `handleEscKey` trong `content.js` để chỉ can thiệp `preventDefault()` và `stopPropagation()` khi hộp thoại dịch đang mở. Trả lại sự kiện phím Esc nguyên vẹn cho mọi trang web (YouTube, Modal, Form...).
* **Lỗi hỏng chuỗi do ký tự `$`**: Sửa hàm `buildPrompt` trong `background.js` bằng cách sử dụng replacer function `() => ...` thay vì chuỗi trần. Khắc phục triệt để lỗi mất dữ liệu khi dịch văn bản chứa đơn vị tiền tệ (`$100`), biến lập trình (`$var`), hoặc cấu trúc JSON.
* **Hỗ trợ toàn bộ ngôn ngữ thế giới**: Cập nhật bộ lọc trong `scanAndTranslatePage` từ regex Latin hẹp sang Unicode Property Escapes `!/[\p{L}\p{N}]/u`. Cho phép dịch chính xác các trang web tiếng Nhật, Trung Quốc, Hàn Quốc, Nga, Ả Rập, Thái Lan, v.v.
* **Sửa nút đóng `✕` trên thanh tiến trình**: Nút `✕` trên thanh trạng thái dịch toàn trang giờ đây chỉ đóng thanh thông báo mà không tự ý khôi phục lại văn bản gốc (`restorePage()`).
* **Đồng bộ hóa cài đặt `uiLanguage`**: Hợp nhất lưu trữ `uiLanguage` vào `chrome.storage.sync` cùng với object `settings`. Context menu chuột phải giờ đây cập nhật ngôn ngữ ngay lập tức khi người dùng thay đổi thiết lập trong Options.
* **Bảo toàn giá trị `temperature = 0` và `topP = 0`**: Sửa biểu thức chuyển đổi số trong `settings.js`, cho phép người dùng thiết lập và lưu trữ giá trị `0` cho các tham số lấy mẫu (sampling parameters).
* **Vá lỗ hổng bảo mật XSS**: Thay thế việc gán `innerHTML` trực tiếp bằng `textContent` kết hợp CSS `white-space: pre-wrap; word-break: break-word;` cho cả `hoverBox` và `imageTranslateBox`.
* **Sửa lỗi kéo thả (Drag)**: Cho phép kéo thả hộp thoại dịch dễ dàng bằng chuột trái (button 0) mà không bị chặn bởi thẻ con.
* **Ngăn chặn chạy đa Iframe**: Lệnh Dịch toàn trang giờ đây chỉ kích hoạt trên khung chính (`window === window.top`), bỏ qua các iframe quảng cáo hoặc widget ẩn.
* **Dọn dẹp tệp rác**: Xóa liên kết tài nguyên không tồn tại `languages.css` trong `sidebar.html`.
* **Cập nhật danh sách Model Groq**: Loại bỏ các model đã bị Groq khai tử (`llama3-70b-8192`, `llama3-8b-8192`, `mixtral-8x7b-32768`), bổ sung các model ổn định mới nhất.
* **Sửa Live API WebSocket**: Chuyển đổi `responseModalities` sang `['TEXT']` thuần túy, loại bỏ việc tổng hợp âm thanh giọng nói không cần thiết cho tác vụ dịch văn bản.

---

### ⚡ Nâng cấp hiệu năng & Cập nhật Model mới
* **Hỗ trợ Model Gemini thế hệ mới nhất**:
  * Tích hợp **`gemini-3.5-flash-lite`** làm mô hình mặc định cho tốc độ suy luận nhanh nhất, tối ưu tiêu thụ token.
  * Tích hợp **`gemini-3.8-flash`** cho chế độ High Intelligence (độ thông minh cao, dịch chuẩn xác ngữ cảnh học thuật và văn phong chuyên sâu).
  * Giữ nguyên hỗ trợ `gemini-2.5-flash-lite` và chế độ nhập `custom` model.
* **Tăng tốc Dịch Toàn Trang 5x - 10x**: Chuyển model xử lý batch mặc định từ `gemma-3-27b-it` sang `gemini-2.5-flash-lite`.
* **Mở khóa Semaphore đơn luồng**: Nâng giới hạn Semaphore xử lý batch lên 3 luồng song song, đồng thời tách riêng luồng ưu tiên cao (Fast Lane) cho các thao tác Highlight Translate và Sidebar Translate (không bị xếp hàng chờ đợi).
* **Triệt tiêu Layout Thrashing**: Thêm bước kiểm tra nhanh `selection.toString().trim()` trên sự kiện `mouseup` để thoát ngay lập tức nếu không có vùng chọn, ngăn chặn việc duyệt cây DOM và đo đạc layout không cần thiết.
* **Cố định vị trí Tooltip khi Streaming**: Loại bỏ việc tính toán lại tọa độ trên từng chunk token nhận được, giúp giao diện ổn định, không bị giật nhảy vị trí khi văn bản dài ra.
* **Tích hợp `AbortController`**: Tự động ngắt kết nối mạng ngay lập tức khi người dùng đóng tooltip hoặc rời trang, tiết kiệm tối đa Token và băng thông.
* **Tích hợp In-Memory LRU Cache**: Lưu trữ 150 bản dịch gần nhất trong bộ nhớ Service Worker, trả kết quả ngay trong `0ms` đối với các từ/câu dịch lặp lại.

---

### 📚 Tài liệu & Project Context
* Khởi tạo tài liệu giới thiệu và hướng dẫn sử dụng chi tiết [`README.md`](README.md).
* Khởi tạo tài liệu kiến trúc kỹ thuật dành cho AI và lập trình viên [`PROJECT_CONTEXT.md`](PROJECT_CONTEXT.md).
* Chuẩn hóa tệp [` .gitignore`](.gitignore) cho dự án Chrome Extension.

---

## [1.0.0] - 2026-03-01
* Bản phát hành ban đầu của HyperAssistant với các tính năng:
  * Dịch bôi đen (Highlight Text Translate).
  * Tóm tắt bôi đen (Summarize Text).
  * Thanh dịch bên hông (SidePanel Sidebar Fast Translate).
  * Dịch hình ảnh (Image Translate).
  * Dịch toàn bộ trang web (Full Page Batch Translate).
  * Hỗ trợ Google Gemini API và Groq Cloud API qua chuẩn Server-Sent Events / Chunked Streaming.

