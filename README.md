# Geed Hardwin — 2D Animation Studio

**Editor v1.7** · Trình biên tập hoạt hình 2D chạy trực tiếp trên trình duyệt.

## Công cụ hiện có

- Sân khấu 1280 × 720, tỷ lệ 16:9; bố cục tự co theo cửa sổ.
- Select, Rectangle, Circle, Text, Image, Pencil, Line và Audio.
- Nhập ảnh và âm thanh từ máy tính.
- Layer: chọn, kéo, ẩn/hiện, khóa/mở khóa, nhân bản, xóa, căn giữa và sắp xếp trước/sau.
- Chọn nhiều layer bằng Ctrl-click; nhóm, di chuyển cùng nhau, tách nhóm và xóa cả nhóm.
- MovieClip / Graphic Symbols: chuyển một hoặc nhiều layer đã animate thành MovieClip; mở Edit MovieClip để chỉnh sửa layer và keyframe trên timeline nội bộ; đặt độ dài clip; lồng symbol trong symbol; mỗi instance có tốc độ, phase offset, Loop / Once / Ping-pong và Single Frame.
- Graphic Symbol Frame Picker: chọn frame nội bộ của Symbol tại một frame trên timeline chính, tạo keyframe riêng để đổi hình miệng, mắt, tay hoặc tư thế; các Frame Picker keys có marker riêng trên timeline và được lưu trong project.
- Swap Symbol / Symbol Variants v1.7: thay Graphic Symbol của một instance mà vẫn giữ vị trí, tỷ lệ, góc xoay và các keyframe trên timeline; nhân bản định nghĩa Symbol thành một biến thể độc lập để tạo phiên bản nhân vật/biểu cảm mà không sửa bản gốc.
- Mask layer: chọn nhiều layer, dùng Rectangle/Circle/Pencil path làm mask cho các layer khác; có thể gỡ liên kết mask.
- Exposure Sheet / Cel Animation cơ bản: bảng ô hình theo từng layer, xem 48 frame mỗi trang; Insert Keyframe để tách exposure và tạo cel tiếp nối; Blank Keyframe để kết thúc exposure tại đầu phát; Hold +1 để kéo dài hình; Duplicate Cel để sao chép cel sang frame kế tiếp. Các thao tác được lưu trong project và hỗ trợ Undo/Redo.
- Chế độ Frame-by-frame: vẽ tại frame hiện tại; đối tượng mới được phơi sáng đúng một frame; có nút đi từng frame và Duplicate artwork → next frame để sao chép toàn bộ artwork đang hiện sang frame kế tiếp, giữ liên kết nhóm/mask và dữ liệu ảnh.
- Path point editor: kéo các điểm vector trực tiếp trên sân khấu.
- Vector Path Morph: nội suy các đường vector ở hai keyframe kể cả khi số điểm khác nhau; đường được lấy mẫu lại tối đa 96 điểm. Có thể đóng/mở path và tô màu vùng khép kín.
- Motion Tween: keyframe vị trí, kích thước, tỷ lệ, xoay, opacity, cỡ chữ, nét vẽ, hiệu ứng, âm lượng và điểm vector.
- Easing theo từng keyframe: Linear, Ease In/Out, Cubic, Sine, Smooth Step, Back, Bounce, Elastic và Hold/Step.
- **Camera Layer v1.3:** camera riêng theo từng cảnh; pan bằng kéo sân khấu, chỉnh zoom/rotation, đặt keyframe, xem keyframe trên timeline, điều hướng và xóa keyframe. Camera được áp dụng khi preview và render video.
- Motion path cong: điều chỉnh độ uốn đường đi và xem đường dẫn trực tiếp trên sân khấu.
- Hiệu ứng cơ bản: Brightness, Contrast, Saturation, Blur và Glow.
- Blend modes: Normal, Multiply, Screen, Overlay, Darken, Lighten, Color Dodge/Burn, Soft/Hard Light, Difference và Exclusion.
- In/Out frame để giới hạn thời gian xuất hiện của layer.
- Onion Skin xem bóng mờ frame trước/sau.
- Nhiều cảnh: tạo, đổi tên, nhân bản, xóa và xuất tuần tự toàn bộ cảnh.
- Track âm thanh theo cảnh, chỉnh điểm bắt đầu; keyframe âm lượng để tạo fade-in/fade-out.
- Undo/Redo, phím tắt và tự lưu trong trình duyệt.
- Save project / Open project bằng JSON; ảnh, âm thanh, camera keyframes và Symbol Library được lưu trong dự án.
- Xuất MP4 khi MediaRecorder của trình duyệt hỗ trợ; tự chọn WebM nếu MP4 không được hỗ trợ.

## Phím tắt

| Phím | Tác vụ |
|---|---|
| Ctrl+Z | Undo |
| Ctrl+Shift+Z hoặc Ctrl+Y | Redo |
| Delete / Backspace | Xóa đối tượng đang chọn |
| Space | Phát / tạm dừng |

## Những phần vẫn đang phát triển

Geed Hardwin v1.7 đã có nhiều công cụ cốt lõi nhưng chưa phải bản thay thế đầy đủ Adobe Animate hoặc Alight Motion. Các hạng mục lớn còn thiếu hoặc chưa đạt mức chuyên nghiệp gồm:

- Exposure Sheet v1.5 đã có ô hình, blank/hold/split/duplicate cel; vẫn cần hoàn thiện kéo chọn dải frame, copy/paste range, drawing layers chuyên dụng, onion skin màu theo phạm vi và thao tác nhiều frame cùng lúc.
- Shape Tween tương đương Adobe với shape hints/topology correspondence vẫn chưa có; Vector Path Morph hiện nội suy đường tự do bằng lấy mẫu lại, chưa morph trực tiếp mọi loại primitive.
- Symbol/MovieClip hiện có timeline nội bộ, nested playback, chỉnh sửa tại chỗ và Frame Picker; vẫn cần nâng cấp thư viện symbol chuyên sâu, tween lồng nhau, swap sets/trigger nâng cao và quản lý asset.
- Mask alpha/luma, mask lồng nhau và clipping groups nâng cao.
- Character rigging, bones, inverse kinematics và lip-sync.
- Camera keyframe hiện điều khiển pan/zoom/rotation cơ bản; chưa có nhiều camera, lens/focus hay parallax theo layer.
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
