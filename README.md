# Thùng rác thông minh

## Backend YOLO và giao diện cảm biến

Backend nhận 5 ảnh từ ESP32 tại `POST /predict`, chạy YOLO bằng model `back_end/model/best.pt`, lưu ảnh gốc/ảnh đã đánh dấu và kết quả, phục vụ giao diện web, và chuyển tiếp số đo cảm biến từ ESP32 tại `GET /api/bins`. Trang Tổng quan hỏi `/api/latest` định kỳ và cập nhật ảnh/kết quả sau mỗi batch xử lý xong.

### Mở web và tự khởi động server trên Windows

1. Cài Python 3 và đảm bảo lệnh `py` có trong PATH.
2. Nhấp đúp `start_smart_bin.bat`. Lần đầu chạy, file này tạo môi trường Python và cài requirements; sau đó nó mở backend và trình duyệt.
3. Mở `http://127.0.0.1:5000/tong-quan.html` nếu trình duyệt chưa tự mở.

Backend chạy trong cửa sổ console riêng. Để xem số đo cảm biến, kiểm tra `ESP32_BINS_URL` ở đầu file batch hoặc đặt biến môi trường trước khi chạy, ví dụ:

   ```powershell
   $env:ESP32_BINS_URL = "http://192.168.1.31/bins"
   .\start_smart_bin.bat
   ```

### Chạy backend thủ công

   ```powershell
   cd back_end
   py -m venv .venv
   .\.venv\Scripts\Activate.ps1
   pip install -r requirements.txt
   py app.py
   ```

Backend lắng nghe ở cổng 5000. Endpoint kiểm tra là `http://localhost:5000/health`.

Trong `firmware_ESP32/main.cpp`, điền Wi-Fi SSID/mật khẩu, địa chỉ IP tĩnh phù hợp với mạng và IP laptop trong `API_URL`. Laptop và ESP32 phải cùng mạng; nạp firmware lên ESP32. Server cần được chạy trước khi ESP32 gửi ảnh.

Frontend gọi `/api/bins` mỗi 2 giây. Backend proxy dữ liệu từ ESP32 để trình duyệt và ESP32 không cần chia sẻ CORS. Firmware trả về tên ngăn (`giay`, `nhua`, `kim_loai`), trạng thái cảm biến, khoảng cách mm và phần trăm đầy.

## Lưu ý

- Chỉnh `BIN_EMPTY_DISTANCE_MM` trong firmware theo chiều cao thực tế từng ngăn để phần trăm đầy chính xác.
- ESP32 hiện phải khởi tạo thành công VL53L0X để các số đo có giá trị; nếu chưa, giao diện sẽ hiện trạng thái cảm biến lỗi/chưa có số đo.
- Ảnh tải lên và log dự đoán được lưu trong `back_end/uploads/` và không cần đưa vào Git.
