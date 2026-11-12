# Geed Hardwin — 2D Animation Studio

**Editor v1.0** · Trình biên tập hoạt hình 2D chạy trực tiếp trên trình duyệt.

## Công cụ hiện có

- Sân khấu 1280 × 720, tỷ lệ 16:9; bố cục tự co theo cửa sổ.
- Select, Rectangle, Circle, Text, Image, Pencil, Line và Audio.
- Nhập ảnh và âm thanh từ máy tính.
- Layer: chọn, kéo, ẩn/hiện, khóa/mở khóa, nhân bản, xóa, căn giữa và sắp xếp trước/sau.
- Chọn nhiều layer bằng Ctrl-click; nhóm, di chuyển cùng nhau, tách nhóm và xóa cả nhóm.
- Graphic Symbols: chuyển một hoặc nhiều layer thành symbol, lưu vào thư viện dự án, chèn nhiều instance và biến đổi instance độc lập; các layer bên trong giữ keyframe gốc.
- Mask layer: chọn nhiều layer, dùng layer đầu tiên (Rectangle/Circle/Pencil path) làm mask cho các layer còn lại; có thể gỡ liên kết mask.
- Chế độ Frame-by-frame: vẽ tại frame hiện tại; các đối tượng mới được phơi sáng đúng một frame. Có nút đi từng frame.
- Path point editor: chọn đường Pencil/Line và kéo các điểm vector trực tiếp trên sân khấu.
- Path Tween: nội suy điểm giữa hai keyframe khi hai keyframe có cùng số lượng điểm; dùng để biến dạng các đường vector vẽ tay.
- Inspector: vị trí, kích thước, tỷ lệ, xoay, opacity, màu sắc, chữ và nét vẽ.
- Timeline 12, 24, 30 hoặc 60 FPS; thời lượng 1–120 giây.
- Keyframe cho vị trí, kích thước, tỷ lệ, xoay, opacity, cỡ chữ, độ dày nét, độ sáng, tương phản, bão hòa, blur, glow, âm lượng audio và tọa độ các điểm vector.
- Easing theo từng keyframe: Linear, Ease In/Out, Cubic, Sine, Smooth Step, Back, Bounce, Elastic và Hold/Step.
- Motion path cong: điều chỉnh độ uốn đường đi và xem đường dẫn trực tiếp trên sân khấu.
- Hiệu ứng cơ bản: Brightness, Contrast, Saturation, Blur và Glow.
- Blend modes: Normal, Multiply, Screen, Overlay, Darken, Lighten, Color Dodge/Burn, Soft/Hard Light, Difference và Exclusion.
- In/Out frame để giới hạn thời gian xuất hiện của layer.
- Onion Skin xem bóng mờ frame trước/sau.
- Nhiều cảnh: tạo, đổi tên, nhân bản, xóa và xuất tuần tự toàn bộ cảnh.
- Track âm thanh theo cảnh, chỉnh điểm bắt đầu; keyframe âm lượng để tạo fade-in/fade-out.
- Undo/Redo, phím tắt và tự lưu trong trình duyệt.
- Save project / Open project bằng JSON; ảnh, âm thanh và Symbol Library được lưu trong dự án.
- Xuất MP4 khi MediaRecorder của trình duyệt hỗ trợ; tự chọn WebM nếu MP4 không được hỗ trợ.

## Phím tắt

| Phím | Tác vụ |
|---|---|
| Ctrl+Z | Undo |
| Ctrl+Shift+Z hoặc Ctrl+Y | Redo |
| Delete / Backspace | Xóa đối tượng đang chọn |
| Space | Phát / tạm dừng |

## Những phần vẫn đang phát triển

Geed Hardwin v1.0 chưa phải bản thay thế đầy đủ Adobe Animate hoặc Alight Motion. Các hạng mục lớn còn thiếu hoặc chưa đạt mức chuyên nghiệp gồm:

- Cel-based frame-by-frame exposure sheet và drawing layers chuyên dụng; v1.0 dùng các đối tượng phơi sáng một frame.
- Shape Tween hoàn chỉnh giữa các vector shape có topology khác nhau; Path Tween hiện chỉ nội suy hai đường có cùng số lượng điểm.
- Symbol/MovieClip có timeline nội bộ độc lập, nested playback và chỉnh sửa symbol tại chỗ.
- Mask alpha/luma, mask lồng nhau và clipping groups nâng cao.
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
