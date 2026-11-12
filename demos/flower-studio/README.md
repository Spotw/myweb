# Hiên nhà — Flower Studio

Demo Three.js độc lập, không được liên kết hay tích hợp vào website chính và không thay đổi Worker, API hoặc dữ liệu hiện có.

## Chạy demo

Tại thư mục gốc dự án:

```powershell
node demos/flower-studio/serve.mjs
```

Mở http://127.0.0.1:4175. Server chỉ lắng nghe trên máy của bạn và chỉ phục vụ thư mục demo. Dừng bằng Ctrl+C. Có thể phục vụ thư mục này bằng bất kỳ HTTP static server nào; không mở trực tiếp bằng `file://` vì trình duyệt hạn chế ES modules.

## Tính năng

- Bảng chỉnh hoa mặc định ẩn, mở bằng nút ba gạch ở góc trên bên phải. Bảng nổi không làm đổi kích thước cảnh 3D; đóng bằng dấu ×, phím Escape hoặc bấm vùng bên ngoài. Nút đổi bình và đổi cảnh nằm ngay dưới nút ba gạch, luôn dùng được khi bảng hoa đang đóng. Trên điện thoại, ba nút thu gọn thành biểu tượng có nhãn hỗ trợ tiếp cận.

- Khung cảnh 3D trên bàn gỗ bên cửa sổ, ánh sáng và bóng đổ. Camera trực giao cố định nhìn chính diện, trục nhìn vuông góc 90° với tường sau; không phải góc nhìn từ trên xuống.
- Có 13 loại hoa và 3 loại lá, gồm mao lương, linh lan và hồng chùm. Lily có cánh nhọn, nhị, đốm hồng và nụ; tulip có cúp cánh khép; cẩm tú cầu có cụm hoa nhỏ; ping pong có nhiều cánh nhỏ trên mặt cầu; cẩm chướng có cánh diềm; mõm sói có chùm hoa hai môi và nụ trên ngọn. Đây là mô hình 3D cách điệu dựa trên ảnh tham khảo.
- Mao lương có dáng tròn khum, nhiều lớp cánh rộng màu trắng kem ôm nhau, mép cánh cong mềm và tâm kem nhạt theo ảnh tham khảo; linh lan có cành cong và chuông trắng rủ, miệng chuông mở; hồng chùm có nhiều bông và nụ trên một cành. Số lượng điều chỉnh là số cành, không phải số bông.
- Đóa mao lương có đường kính bằng 68% phiên bản ban đầu. Hồng dùng ít cánh lớn dạng chén ôm tâm cuộn; cẩm chướng có cánh xòe lệch, mép diềm lượn và đài hẹp; cẩm tú cầu là cụm vòm gồm các bông nhỏ bốn cánh tròn. Hình minh họa trong danh sách cũng phân biệt các dáng này.
- Tăng/giảm từng cành, tối đa 40 cành tổng cộng. Lọc hoa/lá, 8 mẫu phối hoa, bỏ hết, 4 màu bình. Tulip, ping pong và mõm sói có các sắc hoa xen kẽ tự động.
- Lưu lựa chọn trong localStorage và xuất PNG của khung cảnh 3D.
- Bố cục desktop/mobile; thông báo lỗi khi WebGL không khả dụng. Render khi thay đổi để tránh chạy vòng lặp hoạt ảnh không cần thiết.
- Ngoài cửa sổ là đại dương với trời chuyển màu, đường chân trời, gợn nước, mây và phản chiếu. Mặt trời đi từ trái sang phải trong chu kỳ minh họa 06:00–18:00; ban đêm hiện trăng và sao. Ánh sáng trong phòng thay đổi đồng bộ, vẫn đủ sáng để cắm hoa.
- Khung cửa, bệ cửa và rèm không tạo hoặc nhận bóng đổ. Bình hoa và các vật khác vẫn có bóng theo ánh sáng của cảnh.
- Nút **Đổi kiểu bình** chuyển tuần tự giữa 4 mẫu: gốm cổ điển, sọc đứng, bình bầu và bình có quai. Cùng cao độ miệng bình, giữ nguyên cành hoa và màu gốm; hình học của mẫu cũ được giải phóng khi đổi.
- Nút **Đổi cảnh ngoài cửa sổ** chuyển giữa biển theo giờ và 7 cảnh ảnh: vườn hoa, thành phố ven biển, rừng đêm, thế giới dưới nước, hồ hoàng hôn, núi tuyết và hồ hoa, hiên nhà trong vườn. Các ảnh trong [assets](./assets/) do người dùng cung cấp. Ảnh được cắt vừa ô cửa, giữ nguyên tỉ lệ gốc; cùng một mặt phẳng cảnh quan và cùng khung cửa được giữ nguyên khi chuyển. Riêng Rừng đêm có bố cục đặt Totoro và chiếc ô trọn trong ô kính dưới bên trái, mở rộng nền trời và cây ở mép để không cắt nhân vật hoặc kéo méo ảnh. Cảnh ảnh dùng sắc độ tối hơn vào ban đêm; nội dung, mặt trời trong ảnh tĩnh không chuyển động như cảnh biển được vẽ bằng mã.
- Kiểu bình và cảnh quan được lưu cùng số cành, màu bình trong localStorage. Khi tải ảnh, nút đổi cảnh tạm khóa để tránh bấm chồng; lỗi tải không làm mất cảnh hiện có và có thông báo để thử lại.
- Đồng bộ theo giờ và múi giờ của thiết bị, cập nhật mỗi 30 giây và khi quay lại trang. Không cần cấp vị trí hoặc gọi API. Giờ mọc/lặn là minh họa cố định, không phải tính toán thiên văn theo địa điểm hay mùa. Nhãn ở góc dưới hiển thị thời điểm và giờ hiện tại.

Three.js 0.170.0 được lưu tại [vendor/three.module.js](./vendor/three.module.js), giấy phép MIT tại [vendor/THREE-LICENSE.txt](./vendor/THREE-LICENSE.txt). Không cần npm install. Google Fonts là tùy chọn; khi không có mạng, giao diện dùng font hệ thống. Toàn bộ hình học và thumbnail được tạo bằng mã, không tải mô hình/ảnh bên ngoài.
