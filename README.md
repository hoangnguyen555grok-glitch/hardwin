# Geed Hardwin — 2D Animation Studio

**Editor v0.6** · Trình biên tập hoạt hình 2D chạy trực tiếp trên trình duyệt.

## Công cụ hiện có

- Sân khấu 1280 × 720, tỷ lệ 16:9; bố cục tự co theo cửa sổ.
- Select, Rectangle, Circle, Text, Image, Pencil và Line.
- Nhập ảnh và âm thanh từ máy tính.
- Layer: chọn, kéo, ẩn/hiện, khóa/mở khóa, nhân bản, xóa, căn giữa và sắp xếp trước/sau.
- Inspector: vị trí, kích thước, tỷ lệ, xoay, opacity, màu sắc, chữ và nét vẽ.
- Timeline 12, 24, 30 hoặc 60 FPS; thời lượng 1–120 giây.
- Keyframe biến đổi cho từng đối tượng; kéo thả keyframe trên timeline.
- Easing theo từng keyframe: Linear, Ease In/Out, Cubic, Sine, Smooth Step, Back, Bounce, Elastic và Hold/Step.
- Motion path cong: điều chỉnh độ uốn đường đi và xem đường dẫn trực tiếp trên sân khấu.
- Hiệu ứng cơ bản: Brightness, Contrast, Saturation, Blur và Glow.
- In/Out frame để giới hạn thời gian xuất hiện của layer.
- Onion Skin xem bóng mờ frame trước/sau.
- Nhiều cảnh: tạo, đổi tên, nhân bản, xóa và xuất tuần tự toàn bộ cảnh.
- Track âm thanh theo cảnh, chỉnh điểm bắt đầu và âm lượng; đưa audio vào bản xuất khi trình duyệt hỗ trợ capture audio.
- Undo/Redo, phím tắt và tự lưu trong trình duyệt.
- Save project / Open project bằng JSON; ảnh và âm thanh nhập vào được nhúng trong dự án.
- Xuất MP4 khi MediaRecorder của trình duyệt hỗ trợ; tự chọn WebM nếu MP4 không được hỗ trợ.

## Phím tắt

| Phím | Tác vụ |
|---|---|
| Ctrl+Z | Undo |
| Ctrl+Shift+Z hoặc Ctrl+Y | Redo |
| Delete / Backspace | Xóa đối tượng đang chọn |
| Space | Phát / tạm dừng |

## Những phần vẫn đang phát triển

Geed Hardwin v0.6 chưa phải bản thay thế đầy đủ Adobe Animate hoặc Alight Motion. Các hạng mục lớn còn thiếu hoặc chưa đạt mức chuyên nghiệp gồm:

- Frame-by-frame animation với cel/layer exposure đầy đủ.
- Shape Tween và Motion Tween theo từng thuộc tính với graph editor.
- Symbol / Graphic / MovieClip lồng nhau và thư viện tài sản tái sử dụng.
- Group transform, mask nâng cao, blend modes và hệ thống hiệu ứng mở rộng.
- Character rigging, bones, inverse kinematics và lip-sync.
- Camera layer, parallax và điều khiển camera theo keyframe.
- Xuất PNG sequence/GIF chuyên nghiệp, quản lý codec và preset render.
- Đồng bộ dự án cloud, cộng tác và quản lý font/tài nguyên nâng cao.

## Lưu ý

- Tự lưu gắn với trình duyệt hiện tại. Dùng Save project để sao lưu hoặc chuyển dự án sang máy khác.
- MP4 tùy thuộc codec mà trình duyệt cung cấp; nếu không có hỗ trợ MP4, ứng dụng xuất WebM.
- Đây là mã nguồn do Geed Hardwin phát triển độc lập, không chứa mã hay tài sản độc quyền của Adobe hoặc Alight Motion.

## Mã nguồn và giấy phép

Repository công khai để theo dõi tiến độ. Chưa gắn giấy phép mã nguồn; việc xem mã nguồn công khai không tự cấp quyền sao chép, phân phối lại hoặc khai thác thương mại.

---

**Geed Hardwin** · Built for creating 2D animation in the browser.
