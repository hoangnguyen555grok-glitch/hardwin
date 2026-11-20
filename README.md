# Geed Hardwin — 2D Animation Studio

**Editor v1.27** · Trình biên tập hoạt hình 2D chạy trực tiếp trên trình duyệt.

## Công cụ hiện có

- Resource Library v1.27: thư viện ảnh và font riêng của project; ảnh có thể lưu làm tài nguyên rồi thêm lại vào bất kỳ cảnh nào; font TTF/OTF/WOFF/WOFF2 được nhúng vào project, nạp lại khi mở và chọn trực tiếp cho từng layer chữ. Không cho xóa font đang được layer sử dụng.
- Export v1.27: xuất frame hiện tại PNG/JPEG/WebP; chọn độ phân giải 50–200% và chất lượng; xuất PNG Sequence trong ZIP kèm manifest và nền trong suốt; xuất GIF động nhiều cảnh với FPS, bảng màu 3-3-2 và dithering tùy chất lượng; xuất video với FPS, bitrate theo chất lượng và chọn Auto/WebM/MP4 tùy khả năng MediaRecorder.


- AI Bridge v1.12: bảng điều khiển thử nghiệm bên trong editor, có bộ lệnh cục bộ giới hạn và API qua \`window["GeedHardwinBridge"]\` cho trạng thái dự án, danh sách layer, tạo hình tròn, tạo chuyển động theo keyframe, phát/dừng, chọn frame, xóa layer đang chọn và yêu cầu xuất video. Bảng này chưa kết nối ChatGPT hay mô hình AI; giao diện hiển thị rõ hai trạng thái chưa ghép nối.


- Màn hình khởi động không còn tạo sẵn layer demo “Accent circle”; công cụ Circle và các hình tròn do người dùng tự tạo vẫn hoạt động bình thường. Khi khôi phục autosave, chỉ layer demo cũ có ID `obj-2` và tên “Accent circle” được lọc bỏ.

- Sân khấu 1280 × 720, tỷ lệ 16:9; bố cục tự co theo cửa sổ.
- Select, Rectangle, Circle, Text, Image, Pencil, Line và Audio.
- Nhập ảnh và âm thanh từ máy tính.
- Layer: chọn, kéo, ẩn/hiện, khóa/mở khóa, nhân bản, xóa, căn giữa và sắp xếp trước/sau. Bảng thuộc tính có nút Delete layer ở đầu để xóa nhanh layer đang chọn; lớp chữ có thể chỉnh Size trực tiếp.
- Bone Rigging + multi-joint FABRIK IK v1.25: tạo xương gốc và nối chuỗi xương con; khi đổi Parent giữa hai xương, khớp con tự căn vào đầu xương cha và giữ góc xoay hiện có; có nút Reconnect joint để sửa liên kết. IK Move giải chuỗi từ 1 đến nhiều xương bằng FABRIK: giữ gốc cố định, bảo toàn chiều dài từng đoạn, lấy tư thế hiện tại làm tham chiếu để hạn chế lật khớp khi kéo và ghi keyframe cho toàn chuỗi tại frame hiện hành. Layer ảnh/chữ/vector/Symbol gắn vào xương hoặc lồng qua nhiều cấp cha-con sẽ kế thừa vị trí, xoay và tỷ lệ khi rig chuyển động. Xương chỉ là bộ điều khiển trong editor và không xuất hiện trong video/PNG; đây vẫn là cut-out rig, chưa có mesh deformation hoặc skin weights.
- Layer Parenting + Pivot Editor v1.9: gắn layer con vào layer cha; vị trí, xoay và tỷ lệ của cha được kế thừa theo thời gian; đổi cha giữ tư thế và keyframe mẫu; chỉnh pivot X/Y và giữ hình không nhảy khi đổi pivot; kéo/chọn và chỉnh điểm vector hiểu hệ tọa độ cha-con. Khi xóa cha, các layer con được chuyển lên cấp cha tiếp theo để bảo toàn vị trí. Khi đóng gói nhiều layer đã gắn cha-con thành MovieClip, hệ thống giữ cây phân cấp và quy đổi các layer gốc về tâm Symbol.
- Stage Transform Handles v1.9: kéo nút góc dưới-phải để thay đổi kích thước trực tiếp trên sân khấu; kéo nút phía trên để xoay layer quanh pivot hiện tại; thao tác tạo/cập nhật keyframe tại frame đang chọn và hỗ trợ layer có parent.
- Chọn nhiều layer bằng Ctrl-click; nhóm, di chuyển cùng nhau, tách nhóm và xóa cả nhóm.
- MovieClip / Graphic Symbols: chuyển một hoặc nhiều layer đã animate thành MovieClip; mở Edit MovieClip để chỉnh sửa layer và keyframe trên timeline nội bộ; đặt độ dài clip; lồng symbol trong symbol; mỗi instance có tốc độ, phase offset, Loop / Once / Ping-pong và Single Frame.
- Graphic Symbol Frame Picker: chọn frame nội bộ của Symbol tại một frame trên timeline chính, tạo keyframe riêng để đổi hình miệng, mắt, tay hoặc tư thế; các Frame Picker keys có marker riêng trên timeline và được lưu trong project.
- Swap Symbol / Symbol Variants v1.9: thay Graphic Symbol của một instance mà vẫn giữ vị trí, tỷ lệ, góc xoay và các keyframe trên timeline; nhân bản định nghĩa Symbol thành một biến thể độc lập để tạo phiên bản nhân vật/biểu cảm mà không sửa bản gốc.
- Advanced Mask v1.22: chọn nguồn mask và layer đích; Alpha Mask dùng độ trong suốt (hỗ trợ hình, chữ, ảnh và Symbol), Luma Mask dùng độ sáng trắng/đen/xám làm mức che; một layer có thể nhận nhiều mask theo stack để tạo mask lồng nhau; hỗ trợ gỡ stack, ngăn vòng tham chiếu và giữ tương thích maskId của project cũ.
- Exposure Sheet / Cel Animation: bảng ô hình theo từng layer, xem 48 frame mỗi trang; Insert Keyframe, Blank Keyframe, Hold +1, Duplicate Cel; kéo mép đầu/cuối của cel để rút ngắn hoặc kéo dài exposure theo từng frame; Shift-click chọn vùng chữ nhật nhiều layer và nhiều frame; Copy range / Paste range sao chép đồng thời nhiều layer, giữ trạng thái từng frame và không ghi đè cel nguồn. Thay đổi thời lượng cel được lưu trong project và hỗ trợ Undo/Redo. Work Area riêng theo từng cảnh cho phép đặt In/Out tại playhead, tô dấu vùng trong Exposure Sheet/Timeline và giới hạn preview playback theo vùng; Loop On lặp trong vùng, Loop Off dừng ở cuối vùng. Clear khôi phục toàn bộ timeline. Work Area tương thích ngược với project cũ và được lưu trong project.
- Chế độ Frame-by-frame: vẽ tại frame hiện tại; đối tượng mới được phơi sáng đúng một frame; có nút đi từng frame và Duplicate artwork → next frame để sao chép toàn bộ artwork đang hiện sang frame kế tiếp, giữ liên kết nhóm/mask và dữ liệu ảnh.
- Vector / Pen Tool v1.23: tạo path Bézier bằng thao tác click-kéo để đặt tay nắm; Edit path points cho phép kéo riêng anchor, tay nắm In/Out; chế độ Corner, Smooth và Symmetric điều khiển quan hệ hai tay nắm. Click trực tiếp lên đoạn cong để chèn anchor bằng phép chia Bézier de Casteljau, giữ nguyên hình dạng đường cong trước khi chỉnh sửa. Có thể thêm anchor trên đoạn dài nhất, xóa anchor đang chọn, nhập chính xác tọa độ anchor và offset từng tay nắm; đóng/mở path có thể đặt keyframe.
- Vector Path Morph: nội suy Bézier bằng lấy mẫu theo độ dài cung (tối đa 96 anchor), giữ hướng tiếp tuyến, tự căn điểm bắt đầu/chiều đi cho path đóng và đảo thứ tự path mở khi phù hợp; hỗ trợ hai keyframe có số anchor khác nhau và chuyển trạng thái open/closed theo keyframe. Chưa phải Shape Tween có shape hints/topology constraints như phần mềm chuyên dụng.
- Motion Tween: keyframe vị trí, kích thước, tỷ lệ, xoay, opacity, cỡ chữ, nét vẽ, hiệu ứng, âm lượng và điểm vector.
- Easing theo từng keyframe: Linear, Ease In/Out, Cubic, Sine, Smooth Step, Back, Bounce, Elastic và Hold/Step.
- **Camera & Parallax v1.26:** camera riêng theo từng cảnh; kéo sân khấu để pan, lăn chuột để zoom bám con trỏ, Shift + lăn chuột để xoay; chỉnh chính xác Pan X/Y, Zoom và Rotation trong Inspector. Nội suy zoom theo log-scale, góc xoay theo cung ngắn, easing tùy chọn cho từng camera keyframe. Camera keyframe được cập nhật khi pan/zoom/xoay và dùng chung trong preview, video và PNG sequence. Parallax 0–2 điều khiển mức phản hồi của từng layer với pan, zoom và rotation (0 cố định màn hình, 1 theo camera, 2 tăng chiều sâu); căn chỉnh lại transform của Mask giữa các layer có độ sâu khác nhau.
- Motion path cong: điều chỉnh độ uốn đường đi và xem đường dẫn trực tiếp trên sân khấu.
- Hiệu ứng cơ bản: Brightness, Contrast, Saturation, Blur và Glow.
- Blend modes: Normal, Multiply, Screen, Overlay, Darken, Lighten, Color Dodge/Burn, Soft/Hard Light, Difference và Exclusion.
- In/Out frame để giới hạn thời gian xuất hiện của layer.
- Advanced Onion Skin: bật/tắt bóng mờ; cấu hình độc lập số frame trước/sau (0–5), opacity riêng, màu phân biệt frame trước/sau và chế độ chỉ hiện layer đang chọn (bao gồm layer con). Onion Skin chỉ dùng khi preview, không xuất vào video/PNG.
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

- Exposure Sheet đã có chọn/copy/paste dải frame nhiều layer, kéo mép cel để đổi thời lượng và Advanced Onion Skin với số frame/opacity/màu trước-sau; vẫn cần drawing layers chuyên dụng và thao tác biên tập cel hàng loạt chuyên sâu hơn.
- Shape Tween tương đương Adobe với shape hints/topology correspondence và morph trực tiếp giữa primitive (rectangle/circle/polygon) vẫn chưa có; Vector Path Morph hiện là nội suy Bézier tự do có căn chỉnh topology cơ bản.
- Symbol/MovieClip hiện có timeline nội bộ, nested playback, chỉnh sửa tại chỗ và Frame Picker; vẫn cần nâng cấp thư viện symbol chuyên sâu, tween lồng nhau, swap sets/trigger nâng cao và quản lý asset.
- Mask đã có Alpha/Luma, nested mask stack và hỗ trợ nguồn ảnh/chữ/Symbol; các phần còn có thể phát triển thêm gồm feather/blur, invert mask và công cụ chỉnh vùng mask trực quan.
- Bone Rigging v1.25 đã hỗ trợ IK nhiều khớp bằng FABRIK, nối lại khớp và layer con lồng nhiều cấp; các phần rig chuyên sâu còn thiếu gồm mesh deformation, skin weights, giới hạn góc khớp có thể cấu hình và công cụ rig tự động.
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

Bản AI Bridge trong trình biên tập vẫn giữ bộ lệnh mẫu. Từ v1.29, bảng này có nút mở **Local AI Agent** chạy trên máy người dùng. Agent cục bộ ghép Browser Use (điều khiển Opera/CDP), LiteLLM (định tuyến và chuyển mô hình), LangGraph (quy trình có checkpoint) và SQLite (ký ức tác vụ cục bộ). Hướng dẫn cài đặt, bật gateway, cấu hình provider và giới hạn an toàn nằm tại [browser-agent/README.md](browser-agent/README.md). Đây là dịch vụ chạy trên máy cá nhân; không tự động kết nối với cuộc trò chuyện ChatGPT hoặc đám mây.


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


## Cập nhật v1.16

- **Pen Tool:** tạo vector path bằng các anchor point; kéo chuột khi đặt anchor để sinh cặp tay nắm Bézier đối xứng; click anchor đầu để đóng path hoặc double-click để kết thúc path mở.
- Path sử dụng cubic Bézier khi có handle; Edit path points hiển thị các tay nắm và cho phép kéo anchor. Handle offsets được giữ và nội suy qua keyframe.
- Schema project v19.


## Cập nhật v1.17

- **Layer Camera Parallax:** mỗi layer gốc có hệ số Parallax Depth từ 0 đến 2; 0 giữ layer gần cố định trên màn hình, 1 theo camera bình thường, lớn hơn 1 tạo chuyển động nhanh hơn camera. Giá trị có thể keyframe và được áp dụng cả khi preview lẫn render/export. Layer con kế thừa chuyển động từ parent để tránh lệch rig.
- Project schema v20.


## Cập nhật v1.18

- **Playback Loop Toggle:** nút Loop On/Off trên timeline. Loop On tiếp tục phát từ đầu sau frame cuối; Loop Off dừng chính xác tại frame cuối và giữ playhead ở đó. Thiết lập chỉ điều khiển phát lại, không thêm dữ liệu vào project.


## Cập nhật v1.20

- **Draggable Cel Exposure:** kéo mép trái/phải của cel trong Exposure Sheet để thay đổi frame bắt đầu/kết thúc; thao tác snap theo từng frame, giới hạn trong timeline và hỗ trợ Undo/Redo + autosave.
- **Advanced Onion Skin:** số frame trước/sau độc lập 0–5, opacity độc lập, màu phân biệt trước/sau và chế độ chỉ hiển thị layer được chọn; chỉ xuất hiện trong preview, không ảnh hưởng render/export.


## Cập nhật v1.21

- **Work Area / Playback Range:** đặt điểm In/Out theo playhead, hiển thị vùng làm việc trên Exposure Sheet và Timeline, phát preview giới hạn trong vùng, Loop On lặp lại từ In và Loop Off dừng tại Out.
- Work Area được lưu riêng theo từng scene, theo dõi khi đổi FPS/thời lượng timeline, hỗ trợ project cũ không có trường này; Clear dùng toàn bộ timeline. Không cắt bỏ hoặc thay đổi nội dung layer nằm ngoài Work Area và không giới hạn phạm vi Export.


## Cập nhật v1.22

- **Alpha Mask / Luma Mask:** alpha compositing giữ độ trong suốt của nguồn mask; luma mask dùng luminance (trắng che hoàn toàn, đen trong suốt, xám che một phần). Có thể dùng shape, path, text, image hoặc Symbol làm nguồn mask.
- **Nested Mask Stack:** mỗi target có thể xếp nhiều mask; một mask cũng có thể mang mask riêng. Inspector cho đổi Alpha/Luma từng mục, gỡ từng mask hoặc xóa cả stack. Hệ thống chặn chu trình tham chiếu; tham chiếu hỏng/thiếu được xử lý theo hướng fail-closed để layer đích không bất ngờ hiện nguyên hình.
- **Parent / Camera integration:** mask source tuân theo transform, opacity, visibility và thời lượng của cây Parent; parallax nguồn mask được tính tương đối với target để giữ đúng vị trí khi camera di chuyển.
- **Symbol / MovieClip compatibility:** khi đóng gói layer thành MovieClip, các mask dependency được đưa vào timeline nội bộ và giữ liên kết; mask stack cục bộ tiếp tục hoạt động trong Symbol/MovieClip. Duplicate scene, duplicate artwork và Exposure Sheet range paste remap mask references.
- Legacy `maskId` được phục hồi thành mask kiểu clip tương thích với project cũ. Luma readback có fallback an toàn về alpha khi canvas không thể đọc pixel.


## Cập nhật v1.23

- **Bézier editing:** kéo anchor giữ nguyên toàn bộ tay nắm; có thể kéo tay nắm In/Out riêng. Corner cho phép hai phía độc lập, Smooth giữ tiếp tuyến và độ dài tay nắm đối diện, Symmetric phản chiếu hai phía.
- **Anchor editing:** click đoạn path để chèn anchor bằng chia Bézier chính xác (de Casteljau); thêm anchor theo đoạn dài nhất, xóa anchor được chọn (giữ tối thiểu 2 điểm cho path mở / 3 điểm cho path đóng); chỉnh X/Y và In/Out offsets bằng số.
- **Curve-aware Morph:** resample theo độ dài cung của đường Bézier thay vì nối thẳng các anchor; closed paths tự căn pha điểm bắt đầu và chiều đi, open paths tự chọn chiều tương ứng; số điểm khác nhau được chuẩn hóa tối đa 96 anchor.
- **Animated path closure:** trạng thái Open/Closed được lưu cùng keyframe path để thay đổi hình dạng theo timeline. Project cũ tiếp tục tương thích vì `pathClosed` có giá trị mặc định từ `closed`.


## Cập nhật v1.28

- **Image Editor:** mở trình chỉnh sửa raster trực tiếp từ Inspector của một layer ảnh; không cần rời Geed Hardwin.
- **Crop Tool:** kéo vùng cắt tự do hoặc chọn tỷ lệ Original, 1:1, 4:3, 16:9 và 9:16; có Reset crop để quay lại toàn bộ ảnh trước khi áp dụng.
- **Pixel Eraser:** dùng cọ tròn để xóa pixel thành vùng trong suốt; có thể thay đổi kích thước cọ, Undo/Redo theo từng nét vẽ.
- **Preserve originals:** Apply tạo một tài nguyên ảnh đã chỉnh sửa mới trong Resource Library, giữ nguyên tài nguyên gốc; kích thước và vị trí layer được hiệu chỉnh theo vùng ảnh đã crop để giữ tâm hiển thị qua các keyframe.
- **Project persistence:** ảnh đã chỉnh sửa được lưu cùng dữ liệu dự án hiện tại và được khôi phục khi mở lại project.
- **Giới hạn hiện tại:** Eraser là xóa pixel thủ công, không phải AI inpainting. Xóa vật thể và tự tái tạo nền phía sau cần dịch vụ AI riêng, sẽ tích hợp ở giai đoạn sau.

## Cập nhật v1.29

- **Local AI Agent launcher:** AI Bridge có nút mở bảng điều khiển AI cục bộ tại `http://127.0.0.1:8765` sau khi người dùng cài và khởi chạy agent.
- **Browser automation foundation:** Browser Use điều khiển Opera qua CDP trên profile tách biệt; danh sách website được phép cấu hình trong `.env`.
- **Multi-model routing:** LiteLLM có các route cho Ollama, OpenAI, Anthropic và Gemini; cấu hình fallback chuyển tiếp khi provider gặp lỗi hoặc rate limit. Cloud routes chỉ dùng được sau khi người dùng tự thêm API key vào `.env`.
- **Stateful workflow:** LangGraph điều phối recall → browser task → persist và ghi checkpoint theo thread.
- **Local memory:** SQLite lưu tóm tắt các tác vụ hoàn thành, khôi phục ngữ cảnh trong cùng phiên và có nút xóa bộ nhớ cục bộ.
- **Safety gates:** thao tác xóa/gửi/đăng/mua/thanh toán và một số thay đổi tài khoản yêu cầu xác nhận; dịch vụ chỉ lắng nghe trên loopback. Không đưa API key, mật khẩu, cookie hoặc tunnel token vào GitHub.
- Vercel tiếp tục lưu trang biên tập tĩnh; browser runtime và model gateway chạy trên máy cục bộ vì một trang tĩnh trên đám mây không thể tự kết nối vào cổng CDP trên máy người dùng.
