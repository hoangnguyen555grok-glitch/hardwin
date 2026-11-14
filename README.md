# Geed Hardwin — 2D Animation Studio

**Editor v1.15** · Trình biên tập hoạt hình 2D chạy trực tiếp trên trình duyệt.

## Công cụ hiện có

- AI Bridge v1.12: bảng điều khiển thử nghiệm bên trong editor, có bộ lệnh cục bộ giới hạn và API qua \`window["GeedHardwinBridge"]\` cho trạng thái dự án, danh sách layer, tạo hình tròn, tạo chuyển động theo keyframe, phát/dừng, chọn frame, xóa layer đang chọn và yêu cầu xuất video. Bảng này chưa kết nối ChatGPT hay mô hình AI; giao diện hiển thị rõ hai trạng thái chưa ghép nối.


- Màn hình khởi động không còn tạo sẵn layer demo “Accent circle”; công cụ Circle và các hình tròn do người dùng tự tạo vẫn hoạt động bình thường. Khi khôi phục autosave, chỉ layer demo cũ có ID `obj-2` và tên “Accent circle” được lọc bỏ.

- Sân khấu 1280 × 720, tỷ lệ 16:9; bố cục tự co theo cửa sổ.
- Select, Rectangle, Circle, Text, Image, Pencil, Line và Audio.
- Nhập ảnh và âm thanh từ máy tính.
- Layer: chọn, kéo, ẩn/hiện, khóa/mở khóa, nhân bản, xóa, căn giữa và sắp xếp trước/sau.
- Bone Rigging + two-bone IK v1.15: tạo xương gốc bằng kéo trên sân khấu; chọn xương rồi kéo từ đầu xương để tạo xương con có liên kết parent; dùng IK Move và kéo đầu chuỗi để giải nghịch động học cho chuỗi hai xương; có thể gắn layer hình vào xương bằng Parent. Xương chỉ là điều khiển trong editor và không xuất hiện trong video/PNG. Đây là cut-out rig cơ bản, chưa có mesh deformation, skin weights hoặc IK nhiều khớp.
- Layer Parenting + Pivot Editor v1.9: gắn layer con vào layer cha; vị trí, xoay và tỷ lệ của cha được kế thừa theo thời gian; đổi cha giữ tư thế và keyframe mẫu; chỉnh pivot X/Y và giữ hình không nhảy khi đổi pivot; kéo/chọn và chỉnh điểm vector hiểu hệ tọa độ cha-con. Khi xóa cha, các layer con được chuyển lên cấp cha tiếp theo để bảo toàn vị trí. Khi đóng gói nhiều layer đã gắn cha-con thành MovieClip, hệ thống giữ cây phân cấp và quy đổi các layer gốc về tâm Symbol.
- Stage Transform Handles v1.9: kéo nút góc dưới-phải để thay đổi kích thước trực tiếp trên sân khấu; kéo nút phía trên để xoay layer quanh pivot hiện tại; thao tác tạo/cập nhật keyframe tại frame đang chọn và hỗ trợ layer có parent.
- Chọn nhiều layer bằng Ctrl-click; nhóm, di chuyển cùng nhau, tách nhóm và xóa cả nhóm.
- MovieClip / Graphic Symbols: chuyển một hoặc nhiều layer đã animate thành MovieClip; mở Edit MovieClip để chỉnh sửa layer và keyframe trên timeline nội bộ; đặt độ dài clip; lồng symbol trong symbol; mỗi instance có tốc độ, phase offset, Loop / Once / Ping-pong và Single Frame.
- Graphic Symbol Frame Picker: chọn frame nội bộ của Symbol tại một frame trên timeline chính, tạo keyframe riêng để đổi hình miệng, mắt, tay hoặc tư thế; các Frame Picker keys có marker riêng trên timeline và được lưu trong project.
- Swap Symbol / Symbol Variants v1.9: thay Graphic Symbol của một instance mà vẫn giữ vị trí, tỷ lệ, góc xoay và các keyframe trên timeline; nhân bản định nghĩa Symbol thành một biến thể độc lập để tạo phiên bản nhân vật/biểu cảm mà không sửa bản gốc.
- Mask layer: chọn nhiều layer, dùng Rectangle/Circle/Pencil path làm mask cho các layer khác; có thể gỡ liên kết mask.
- Exposure Sheet / Cel Animation: bảng ô hình theo từng layer, xem 48 frame mỗi trang; Insert Keyframe, Blank Keyframe, Hold +1, Duplicate Cel; Shift-click chọn dải frame liên tục trên cùng layer; Copy range / Paste range tạo bản layer mới, giữ trạng thái từng frame và không ghi đè cel nguồn. Các thao tác được lưu trong project và hỗ trợ Undo/Redo.
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
- Xuất MP4 khi MediaRecorder của trình duyệt hỗ trợ; tự chọn WebM nếu MP4 không được hỗ trợ. Xuất PNG sequence nền trong suốt thành ZIP cho toàn bộ cảnh, kèm manifest FPS/kích thước; giới hạn 2.400 frame và 512 MB để bảo vệ bộ nhớ trình duyệt. Video và PNG dùng chế độ render sạch, không kèm lưới, đường safe-area, onion skin hay tay nắm chọn.

## Phím tắt

| Phím | Tác vụ |
|---|---|
| Ctrl+Z | Undo |
| Ctrl+Shift+Z hoặc Ctrl+Y | Redo |
| Delete / Backspace | Xóa đối tượng đang chọn |
| Space | Phát / tạm dừng |

## Những phần vẫn đang phát triển

Geed Hardwin v1.9 đã có nhiều công cụ cốt lõi nhưng chưa phải bản thay thế đầy đủ Adobe Animate hoặc Alight Motion. Các hạng mục lớn còn thiếu hoặc chưa đạt mức chuyên nghiệp gồm:

- Exposure Sheet đã có chọn/copy/paste dải frame trên một layer; vẫn cần drawing layers chuyên dụng, onion skin màu theo phạm vi, thao tác nhiều layer/dải cùng lúc và kéo giãn exposure bằng chuột.
- Shape Tween tương đương Adobe với shape hints/topology correspondence vẫn chưa có; Vector Path Morph hiện nội suy đường tự do bằng lấy mẫu lại, chưa morph trực tiếp mọi loại primitive.
- Symbol/MovieClip hiện có timeline nội bộ, nested playback, chỉnh sửa tại chỗ và Frame Picker; vẫn cần nâng cấp thư viện symbol chuyên sâu, tween lồng nhau, swap sets/trigger nâng cao và quản lý asset.
- Mask alpha/luma, mask lồng nhau và clipping groups nâng cao.
- Bone Rigging + IK hai xương đã có; vẫn còn thiếu mesh deformation, skin weights, IK nhiều khớp, constraints và công cụ rig tự động.
- Layer Parenting + Pivot Editor đã có nền tảng phân cấp; vẫn cần thêm công cụ rig chuyên sâu.
- Camera keyframe hiện điều khiển pan/zoom/rotation cơ bản; chưa có nhiều camera, lens/focus hay parallax theo layer.
- GIF và preset render nâng cao; PNG sequence ZIP đã có ở v1.13 nhưng vẫn cần kiểm thử tương tác trên nhiều trình duyệt và tối ưu luồng xuất cho dự án rất dài.
- Đồng bộ dự án cloud, cộng tác và quản lý font/tài nguyên nâng cao.

## Lưu ý

- Tự lưu gắn với trình duyệt hiện tại. Dùng Save project để sao lưu hoặc chuyển dự án sang máy khác.
- MP4 tùy thuộc codec mà trình duyệt cung cấp; nếu không có hỗ trợ MP4, ứng dụng xuất WebM.
- Đây là mã nguồn do Geed Hardwin phát triển độc lập, không chứa mã hay tài sản độc quyền của Adobe hoặc Alight Motion.

## Mã nguồn và giấy phép

Repository công khai để theo dõi tiến độ. Chưa gắn giấy phép mã nguồn; việc xem mã nguồn công khai không tự cấp quyền sao chép, phân phối lại hoặc khai thác thương mại.

---

**Geed Hardwin** · Built for creating 2D animation in the browser.

## Cập nhật v1.10

- **Polygon & Star vector tools (v1.10):** vẽ trực tiếp trên Stage bằng thao tác kéo để tạo lục giác và ngôi sao 5 cánh dạng vector path khép kín, có fill/stroke, chỉnh sửa được bằng Edit path points và hỗ trợ keyframe/morph theo nền tảng path hiện có.


## AI và điều khiển trình duyệt

Bản AI Bridge nằm trong Geed Hardwin v1.12. Bộ công cụ cục bộ cho hai hướng kết nối (MCP để ghép với trợ lý ChatGPT sau khi có endpoint được bảo vệ; chatbot riêng dùng Browser Use + Ollama để thao tác Opera qua CDP) được ghi tại [browser-agent/README.md](browser-agent/README.md). Đây mới là bộ khung thử nghiệm; README nêu rõ các bước chạy, yêu cầu và những phần chưa được kết nối/xác minh.


## Cập nhật v1.13

- **Clean Export:** video render không còn đưa lưới căn chỉnh, đường safe-area, onion skin, đường motion guide hoặc tay nắm chọn vào hình xuất.
- **Transparent PNG Sequence:** xuất mọi frame của mọi cảnh thành ZIP; mỗi cảnh có thư mục riêng, tên frame tuần tự và file `manifest.json` chứa FPS, kích thước, thời lượng và tên cảnh.
- Giới hạn an toàn 2.400 frame / 512 MB mỗi lần xuất; cần kiểm thử thực tế trên trình duyệt để xác nhận thời gian và mức sử dụng bộ nhớ ở các dự án lớn.


## Cập nhật v1.14

- **Exposure Sheet Range Editing:** Shift-click để chọn đoạn frame liên tục trong cùng một layer; Copy range ghi nhận trạng thái từng frame; Paste range tạo layer/cel mới tại frame hiện tại, giữ ảnh và dữ liệu symbol, đồng thời không ghi đè bản nguồn.
- Dải copy phải nằm trong vùng exposure đang hiển thị của layer; bản dán phải nằm trọn trong timeline hiện tại.


## Cập nhật v1.15

- **Bone Rigging:** tạo xương gốc và các xương con liên kết theo parent hierarchy; layer hình có thể được gắn vào xương để tạo cut-out character rig.
- **Two-bone IK:** kéo đầu xương cuối để giải vị trí khớp khuỷu theo độ dài hai xương; mục tiêu ngoài tầm với được giới hạn ở khoảng với tối đa/tối thiểu.
- Xương là control layer, không hiển thị trong video hoặc PNG render.
- Chưa có skin weights, mesh deformation, solver nhiều khớp hay constraints nâng cao.
