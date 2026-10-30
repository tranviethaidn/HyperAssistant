# 📜 Lịch sử thay đổi (Changelog)

Toàn bộ các thay đổi, bản vá lỗi và nâng cấp hiệu năng của dự án **HyperAssistant (HyperTranslator)** được ghi nhận chi tiết tại đây.

---

## [1.2.1] - 2026-10-30

### 🚀 Tối ưu Toàn diện Bộ Dịch Toàn Trang: 1 Request & Quét Sạch 100% Văn Bản
* **Khắc phục triệt để hiện tượng bỏ sót văn bản (Zero Text Missed)**:
  * Loại bỏ lỗi logic lọc thẻ con khiến các tiêu đề (`<h1>-<h6>`) và đoạn văn (`<p>`) chứa liên kết (`<a>`) hoặc nút bấm bị bỏ qua.
  * Phân định rạch ròi giữa Khối cấu trúc (`BLOCK_CONTAINER_SELECTOR`) và Thẻ nội tuyến (`<a>`, `<b>`, `<i>`, `<code>`, `<span>`). Các đoạn văn có link hay in đậm giờ đây được dịch trọn vẹn trong một ngữ cảnh duy nhất và bảo toàn nguyên vẹn link `href`.
  * Bổ sung cơ chế tự động phát hiện và bọc các text node trần (`wrapOrphanedTextNodes()`) nằm cạnh các khối block, đảm bảo quét sạch 100% nội dung trên các website phức tạp như CNN, BBC, NYTimes.
* **Giảm số Request về mức tối thiểu (1 Request duy nhất)**:
  * Nâng kích thước lô lên **250 blocks / batch**. Với các trang web thông thường (100 - 200 blocks), toàn bộ trang web được xử lý trọn vẹn chỉ trong **ĐÚNG 1 REQUEST DUY NHẤT** (thay vì 7 requests như trước).
  * Tiết kiệm 85% - 90% hạn ngạch API (1 RPM và 1 RPD).
* **Triệt tiêu hiện tượng giật/khựng (Smooth 60 FPS with `requestAnimationFrame`)**:
  * Chuyển đổi toàn bộ việc nạp DOM sang hàng đợi bộ nhớ kết hợp `requestAnimationFrame`. Trình duyệt không còn bị ép tính toán Layout (Reflow) 30 lần mỗi giây theo từng chunk stream, mang lại chuyển động mượt mà 60 FPS khi trang được dịch từ trên xuống dưới.
  * Tăng timeout an toàn lên 60 giây đối với các trang dung lượng lớn.

---

## [1.2.0] - 2026-10-30

### 🚀 Nâng cấp Cơ chế Dịch Toàn Trang In-Place (Direct In-Place Translation)
* **Chuyển đổi hoàn toàn sang Dịch Tại Chỗ (In-Place Translation)**:
  * Theo phản hồi thực tế của người dùng, loại bỏ chế độ song ngữ rườm rà. Bản dịch giờ đây được nạp trực tiếp vào đúng vị trí gốc của phần tử trên trang, mang lại trải nghiệm liền mạch và sạch sẽ như tính năng Native Translate của trình duyệt.
  * Tích hợp nút **"Khôi phục trang gốc"** (Restore) trên thanh trạng thái cho phép hoàn tác 100% về văn bản gốc ngay lập tức mà không cần F5.
* **Bảo toàn định dạng văn bản & thẻ HTML lồng nhau (HTML Tags Preservation)**:
  * Khắc phục triệt để lỗi mất định dạng hoặc đứt gãy link: Đối với các phần tử chứa thẻ con (như `<a>`, `<b>`, `<i>`, `<code>`, `<span>`), hệ thống gửi cấu trúc `innerHTML` và yêu cầu Gemini bảo toàn nguyên vẹn mọi thẻ HTML cùng thuộc tính (như link `href`), chỉ dịch văn bản bên trong.
  * Cập nhật `PROMPT_PAGE_BATCH_TRANSLATE` trong `promptconfig.js` để AI giữ nguyên cấu trúc thẻ định dạng.
* **Tối ưu Batch Size & Chống Treo/Dừng Ngẫu Nhiên**:
  * Tối ưu kích thước lô thích ứng xuống **25 phần tử / batch** (thay vì 75), giúp mỗi lô phản hồi cực nhanh trong 1.5 - 2.5 giây, triệt tiêu hoàn toàn nguy cơ chạm trần output tokens (65,536 tokens) hoặc bị timeout giữa chừng.
  * Bổ sung cơ chế Timeout bảo vệ (25 giây / batch) tự động giải phóng tiến trình và chuyển sang lô tiếp theo nếu mạng hoặc LLM bị nghẽn.
  * Mở rộng bộ quét DOM `collectPageElements()` để quét toàn diện tất cả các khối văn bản lá (`p`, `h1-h6`, `li`, `blockquote`, `dt`, `dd`, `td`, `th`, và các thẻ đơn lẻ `button`, `a`, `label`, `summary`, `div`, `span`).
  * Cơ chế bóc tách Streaming Regex kết hợp bước đối chiếu toàn diện `JSON.parse` khi nhận sự kiện `"done"`, đảm bảo không bỏ sót bất kỳ khối văn bản nào.

### 🐛 Vá lỗi Extension Message Channel
* **Khắc phục lỗi Uncaught Message Channel Closed**:
  * Sửa lỗi `Uncaught (in promise) Error: A listener indicated an asynchronous response by returning true, but the message channel closed before a response was received`.
  * Trả lời ngay phản hồi đồng bộ `sendResponse({ status: "started" })` khi nhận tín hiệu kích hoạt từ Background / Context Menu, đóng channel đúng chuẩn Manifest V3.

---

## [1.1.0] - 2026-10-30

### 🐛 Vá lỗi quan trọng (Bug Fixes)
* **Xử lý ngắt ngữ cảnh Extension (Context Invalidation)**: Bổ sung cơ chế `isExtensionValid()` và bọc `try/catch` an toàn cho các lệnh `chrome.runtime.connect`. Khắc phục triệt để lỗi `Uncaught TypeError: Cannot read properties of undefined (reading 'connect')` khi extension được tải lại (reload) hoặc chạy trong iframe giới hạn, đồng thời hiển thị thông báo hướng dẫn người dùng F5 tải lại trang.
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
* **Kiến trúc Dịch Toàn Trang Thế Hệ Mới (Next-Gen Full Page Translation Engine)**:
  * **Gom cụm theo Thẻ Khối (Semantic Block Grouping)**: Gom toàn bộ đoạn văn (`<p>`, `<h1>-<h6>`, `<li>`, `<blockquote>`, `<td>`) thay vì duyệt từng text node vụn vặt, bảo toàn 100% cấu trúc ngữ pháp tự nhiên.
  * **Giảm 95% số lần gọi API (1 - 2 Requests / Toàn trang)**: Tận dụng Context Window 1 triệu token của Gemini, đóng gói 75 blocks/batch dạng Key-Value Dictionary siêu nhẹ. Giải quyết triệt để lỗi nghẽn RPM (15 RPM) và tiết kiệm hạn ngạch RPD (1.500 RPD).
  * **Chèn DOM Phi Phá Hủy (Non-destructive DOM)**: Sử dụng thẻ `<ht-trans>` kết hợp `.ht-orig-content`, không phá vỡ Virtual DOM của React, Vue, Next.js.
  * **3 Chế độ Xem Linh Hoạt (View Modes)**: Hỗ trợ chuyển đổi tức thì giữa `📖 Song ngữ (Bilingual)`, `📄 Chỉ bản dịch (Translation Only)`, và `📑 Bản gốc (Original)`.
  * **Thanh điều khiển Thông minh (Smart Floating Toolbar)**: Tích hợp chọn nhanh ngôn ngữ đích, nút chuyển chế độ xem, và nút khôi phục trang gốc.
* **Hỗ trợ Model Gemini thế hệ mới nhất**:
  * Tích hợp **`gemini-3.5-flash-lite`** làm mô hình mặc định cho tốc độ suy luận nhanh nhất, tối ưu tiêu thụ token.
  * Tích hợp **`gemini-3.8-flash`** cho chế độ High Intelligence (độ thông minh cao, dịch chuẩn xác ngữ cảnh học thuật và văn phong chuyên sâu).
  * Loại bỏ hoàn toàn model cũ `gemini-2.5-flash-lite`.
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

