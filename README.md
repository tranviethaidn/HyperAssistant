# 🚀 HyperAssistant (HyperTranslator)

> **Fast & accurate AI language assistant** — Tiện ích mở rộng Google Chrome (Manifest V3) hỗ trợ dịch thuật và tóm tắt văn bản thông minh, tức thì, bảo mật và hoàn toàn miễn phí, được tăng tốc bởi **Google Gemini API** và **Groq Cloud**.

---

## 🌟 Tính năng nổi bật

### 1. 📝 Highlight Translate & Summarize (Dịch & Tóm tắt bôi đen)
* Khi bạn bôi đen bất kỳ đoạn văn bản nào trên trang web, icon HyperAssistant sẽ xuất hiện mượt mà ngay cạnh con trỏ chuột.
* Hỗ trợ 2 chế độ nhanh:
  * **Dịch thuật (Translate)**: Dịch văn bản sang ngôn ngữ đích được cấu hình với sắc thái tự nhiên.
  * **Tóm tắt (Summarize)**: Rút gọn các ý chính thành dạng danh sách gạch đầu dòng ngắn gọn, dễ nắm bắt.
* Kết quả hiển thị dạng **hộp thoại nổi (Hover Box)** hỗ trợ **Streaming thời gian thực**, có thể kéo thả di chuyển linh hoạt trên màn hình.

### 2. ⚡ Fast Translate Sidebar (Thanh dịch nhanh SidePanel)
* Mở thanh bên tiện lợi chỉ bằng một phím tắt hoặc một click vào biểu tượng extension.
* Cho phép chọn ngôn ngữ đích, gõ văn bản và nhận kết quả tức thì.
* Hỗ trợ phím tắt `Enter` để dịch, click để sao chép kết quả nhanh vào clipboard.

### 3. 🖼️ Image OCR Translate (Dịch văn bản trong hình ảnh)
* Nhấp chuột phải vào bất kỳ hình ảnh nào trên web và chọn **"Image Translate"**.
* Sử dụng mô hình đa thể thức (Multimodal AI) của Gemini để trích xuất văn bản từ hình ảnh và dịch trực tiếp sang ngôn ngữ mong muốn.

### 4. 🌐 Full Page Batch Translate (Dịch toàn bộ trang web)
* Quét và dịch toàn bộ nội dung của trang web đang xem thông qua Context Menu **"Translate Full Page"**.
* Thuật toán **Gom cụm thông minh (Intelligent Batching)** kết hợp **Xử lý song song (Concurrency)** giúp dịch hàng trăm đoạn văn bản chỉ trong vài giây.
* Thanh trạng thái hiển thị phần trăm tiến trình thời gian thực, có nút **"Restore Original"** để khôi phục lại trang gốc bất cứ lúc nào.

### 5. 🎭 Tùy chỉnh sắc thái cảm xúc (Emotion Styles)
* Hỗ trợ lựa chọn giọng điệu dịch phù hợp với ngữ cảnh:
  * 💬 **Conversation**: Thân thiện, tự nhiên, văn phong giao tiếp hàng ngày.
  * 😐 **Serious**: Nghiêm túc, chuẩn mực, phù hợp báo cáo, tài liệu học thuật.
  * 😂 **Humorous**: Hài hước, dí dỏm.
  * 🤐 **Vulgar / Furious / Touching**: Các phong cách biểu đạt đặc thù.

---

## 🛠️ Hướng dẫn cài đặt trên trình duyệt

Extension chạy trên mọi trình duyệt nhân Chromium (Google Chrome, Microsoft Edge, Brave, Cốc Cốc, Opera,...):

1. **Tải mã nguồn**:
   ```bash
   git clone https://github.com/tranviethaidn/HyperAssistant.git
   ```
2. Mở trình duyệt và truy cập vào trang quản lý tiện ích:
   * **Chrome**: `chrome://extensions`
   * **Edge**: `edge://extensions`
   * **Brave**: `brave://extensions`
3. Bật công tắc **"Developer mode"** (Chế độ dành cho nhà phát triển) ở góc trên bên phải.
4. Nhấn nút **"Load unpacked"** (Tải tiện ích đã giải nén) và chọn thư mục `HyperTranslator` vừa tải về.
5. Ghim (Pin) biểu tượng HyperAssistant lên thanh công cụ của trình duyệt để sử dụng thuận tiện.

---

## 🔑 Hướng dẫn cấu hình API Key

HyperAssistant kết nối trực tiếp từ trình duyệt của bạn tới API của nhà cung cấp thông qua khóa API cá nhân, đảm bảo tính riêng tư và bảo mật tuyệt đối:

### Cách 1: Sử dụng Google Gemini API (Miễn phí)
1. Truy cập [Google AI Studio](https://aistudio.google.com/app/apikey).
2. Đăng nhập tài khoản Google và nhấn **"Create API Key"**.
3. Mở trang Cài đặt của HyperAssistant (chuột phải vào icon -> **Options**).
4. Dán API Key vào ô **Google AI API Key** và nhấn **"Save Settings"**.

### Cách 2: Sử dụng Groq Cloud (Tốc độ suy luận siêu tốc)
1. Truy cập [Groq Console](https://console.groq.com/keys).
2. Tạo API Key miễn phí.
3. Trong trang Cài đặt của extension, chọn nhà cung cấp **Groq**, dán Groq API Key và lưu cài đặt.

---

## 🤖 Các mô hình AI được hỗ trợ

| Nhà cung cấp | Mô hình khuyên dùng | Đặc điểm |
| :--- | :--- | :--- |
| **Google Gemini** | `gemini-3.5-flash-lite` *(Mặc định)* | Tốc độ cực nhanh, nhẹ, miễn phí, mô hình thế hệ mới tối ưu dịch thuật |
| **Google Gemini** | `gemini-3.8-flash` | Trí tuệ cao vượt trội, dịch ngữ cảnh phức tạp và chuyên sâu |
| **Google Gemini** | `custom` | Tự do nhập bất kỳ Model ID nào từ Google AI Studio |
| **Groq Cloud** | `llama-3.3-70b-versatile` | Chất lượng dịch ngữ nghĩa cao, tốc độ suy luận mili-giây |
| **Groq Cloud** | `llama-3.1-8b-instant` | Phản hồi siêu tốc cho văn bản ngắn |

---

## ⌨️ Phím tắt & Thao tác nhanh

* `Alt + T` (Mac: `Option + T`): Mở nhanh Sidebar HyperAssistant.
* `Enter` (trong Sidebar): Gửi yêu cầu dịch ngay lập tức (`Shift + Enter` để xuống dòng).
* `Click vào ô kết quả` (trong Sidebar): Tự động sao chép toàn bộ văn bản dịch vào Clipboard.
* `Esc`: Đóng nhanh hộp thoại dịch nổi hoặc hộp dịch ảnh đang mở.
* `Kéo thả (Drag)`: Nhấn giữ chuột trái vào hộp thoại dịch để di chuyển đến vị trí mong muốn trên màn hình.

---

## 🛡️ Quyền hạn & Bảo mật (Privacy & Security)

HyperAssistant tuân thủ tiêu chuẩn nghiêm ngặt của Chrome Extensions Manifest V3:
* **Không thu thập dữ liệu người dùng**: Khóa API và lịch sử cài đặt được lưu trữ cục bộ trong trình duyệt của bạn (`chrome.storage.sync` / `chrome.storage.local`).
* **Không qua máy chủ trung gian (Zero-Telemetry)**: Các yêu cầu dịch được gửi trực tiếp từ máy của bạn đến máy chủ của Google/Groq.
* **Content Security Policy (CSP)**: Chặn việc thực thi mã từ xa, bảo vệ người dùng trước các cuộc tấn công injection.

---

## 👨‍💻 Tác giả & Đóng góp

* **Tác giả**: [tranviethaidn](https://github.com/tranviethaidn)
* **Repository**: [https://github.com/tranviethaidn/HyperAssistant](https://github.com/tranviethaidn/HyperAssistant)
* Mọi đóng góp (Pull Request, Bug Report, Feature Request) đều được hoan nghênh nồng nhiệt!

