# Geed Hardwin — 2D Animation Studio

**Prototype v0.1** · Ứng dụng thử nghiệm hoạt hình 2D chạy trực tiếp trong trình duyệt.

Geed Hardwin là bộ dựng hoạt hình 2D ban đầu, lấy cảm hứng từ quy trình làm việc trên timeline của Adobe Animate. Mục tiêu trước mắt là xây vững sân khấu, layer, keyframe và chuyển động; âm thanh sẽ được phát triển ở giai đoạn sau.

## Chạy thử

Không cần cài đặt, máy chủ hay API key:

1. Mở `index.html` bằng Chrome hoặc Edge.
2. Bắt đầu thêm đối tượng trên sân khấu và tạo keyframe.
3. Dùng nút phát để xem trước hoạt cảnh.

## Chức năng hiện có

- Sân khấu 16:9, kích thước 1280 × 720.
- Thêm hình chữ nhật, hình tròn, chữ và hình ảnh từ máy tính.
- Chọn, kéo thả và quản lý các đối tượng theo layer.
- Điều chỉnh vị trí, tỷ lệ, góc xoay và độ mờ.
- Timeline 24 FPS, thời lượng mẫu 5 giây.
- Tạo keyframe và nội suy tuyến tính giữa các keyframe.
- Phát, dừng và kéo thanh thời gian.
- Tạo nhiều cảnh.
- Lưu thông tin dự án dạng JSON.
- Xuất video xem thử WebM bằng MediaRecorder của trình duyệt.

## Giới hạn của v0.1

Đây là bản thử nghiệm đầu tiên, chưa phải sản phẩm thay thế đầy đủ Adobe Animate.

- Tệp JSON lưu dữ liệu đối tượng và tham chiếu hình ảnh; chưa đóng gói toàn bộ dữ liệu ảnh vào tệp dự án.
- Xuất video hiện là WebM, chưa phải MP4.
- Chưa có âm thanh, đồng bộ miệng, rigging nhân vật, vẽ từng khung hình, easing nâng cao, undo/redo hoặc đồng bộ dự án lên máy chủ.
- Hình ảnh thương hiệu hiện đang được tham chiếu từ URL bên ngoài; cần thay bằng tệp logo gốc do chủ dự án cung cấp để bảo đảm ổn định lâu dài.

## Hướng phát triển gần nhất

1. Hoàn thiện Timeline: chọn và kéo keyframe, thay đổi thời lượng cảnh.
2. Bổ sung easing cho chuyển động.
3. Cải thiện lưu/mở dự án và đóng gói hình ảnh nhập vào.
4. Kiểm tra xuất video ổn định hơn.

## Trạng thái và giấy phép

Dự án đang ở giai đoạn prototype. Repository được công khai để minh bạch quá trình phát triển; **chưa gắn giấy phép mã nguồn**. Việc nhìn thấy hoặc tải mã nguồn công khai không tự động cấp quyền sao chép, phân phối lại hoặc khai thác thương mại. Chủ dự án sẽ công bố giấy phép sau khi quyết định chính sách dành cho cộng đồng.

---

**Geed Hardwin** · Xây dựng từng bước, ưu tiên sản phẩm chạy được và hữu ích.
