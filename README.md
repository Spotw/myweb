# Không gian dùng chung

Ứng dụng Cloudflare Worker này kết hợp lịch trình tháng riêng theo tài khoản và cổng thông tin dùng chung.

## Cấu hình tài khoản

Tài khoản ban đầu được cấu hình bằng Worker secrets; các tài khoản tạo từ giao diện được lưu trong D1 dưới dạng mật khẩu PBKDF2 hash có salt.

1. Tạo `APP_USERS` dưới dạng JSON ánh xạ tên tài khoản tới mật khẩu. Có thể bổ sung tài khoản trong `APP_USERS_EXTRA` hoặc các secret có tên bắt đầu bằng `APP_USERS_EXTRA_` để không phải thay thế danh sách tài khoản hiện tại. Mỗi secret là một JSON object ánh xạ tên tài khoản tới mật khẩu. Tên đăng nhập có thể dài tối đa 254 ký tự, bắt đầu bằng chữ hoặc số và chỉ gồm chữ ASCII, số, dấu chấm, gạch dưới, `@`, `+` hoặc `-`; không phân biệt chữ hoa/thường.
   Ví dụ định dạng (hãy thay bằng thông tin thật của bạn):

   ```json
   {"ten_tai_khoan":"mat_khau_rieng"}
   ```

2. Tạo `AUTH_SECRET` là một chuỗi ngẫu nhiên bí mật tối thiểu 32 ký tự.
3. Đặt secrets cho môi trường production:

   ```powershell
   npx wrangler secret put APP_USERS
   npx wrangler secret put AUTH_SECRET
   ```

   Mỗi lệnh sẽ yêu cầu nhập giá trị bí mật. Có thể tạo secret ngẫu nhiên bằng `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"`.

Khi chạy local, đặt hai giá trị này trong `.dev.vars` (không commit file đó):

```text
APP_USERS={"ten_tai_khoan":"mat_khau_rieng"}
AUTH_SECRET=chuoi_ngau_nhien_bi_mat_toi_thieu_32_ky_tu
```

Đăng nhập tạo cookie `HttpOnly`, `SameSite=Strict`, hết hạn sau 7 ngày. Các API lịch và cổng thông tin đều yêu cầu phiên đăng nhập.

Tài khoản `duyvu@pvdv` được phép tạo tài khoản đăng nhập trong cửa sổ cài đặt tài khoản. Quyền này được kiểm tra ở Worker, không chỉ ẩn/hiện nút trên giao diện. Người tạo nhập tên đăng nhập, nickname tùy chọn và mật khẩu (tối thiểu 8 ký tự); tên đăng nhập không phân biệt chữ hoa/thường. Áp dụng migration `0005_create_user_accounts.sql` cho D1 trước khi sử dụng tính năng này.

Nickname được lưu trong cột `nickname` của bảng `user_profiles` hiện có, được thêm bằng [migration 0009](./migrations/0009_add_profile_nickname.sql); không tạo bảng mới. Áp dụng migration trước khi triển khai phiên bản có nickname. Tất cả tài khoản có thể đổi nickname tại **Cài đặt tài khoản → Hồ sơ**, tối đa 50 ký tự. Để trống sẽ hiển thị tên đăng nhập. Nickname không thay đổi tên đăng nhập hay quyền hạn. Khi tạo tài khoản, thông tin tài khoản và nickname được ghi trong cùng giao dịch.

## Cơ sở dữ liệu và triển khai

Worker tiếp tục sử dụng D1 `db_duyvu`. Trước khi triển khai, áp dụng migration để tạo các bảng cần thiết (bao gồm thông tin xác thực khi đổi mật khẩu, thùng rác và metadata tệp đính kèm của cổng thông tin):

```powershell
npm run db:migrate:remote
npm run deploy
```

Lịch của từng tài khoản được lưu trong bảng riêng có dạng `schedule_<sha256_tên_tài_khoản_viết_thường>`; bảng tự tạo khi tài khoản mở lịch lần đầu. Tên bảng được băm để tên đăng nhập (kể cả email) không thể tác động đến SQL. Cổng thông tin đọc và ghi vào bảng `entries` dùng chung. Các bản ghi lịch cũ trong `web_data` vẫn được giữ nguyên nhưng không thể tự gán cho một tài khoản; lịch từng tài khoản bắt đầu riêng sau khi bật đăng nhập.

Tệp của cổng thông tin được lưu trong R2 bucket `databasedv` thông qua binding `ENTRY_FILES`; tên tệp, kích thước và metadata vẫn lưu trong D1. Không cần cấu hình S3 access key trong ứng dụng. Mỗi tài khoản đăng nhập được upload tối đa 500 MB (500.000.000 byte) mỗi năm dương lịch UTC; hạn mức tính tổng byte của các lần upload hoàn tất, không được hoàn lại khi thay thế hoặc xóa tệp. Upload chia thành các phần để hỗ trợ tệp lớn, và phiên tải dở được dọn định kỳ.

Thông tin bị xóa trong cổng thông tin được chuyển vào thùng rác, có thể khôi phục trong vòng 30 ngày. Worker kiểm tra lịch nhắc mỗi phút và dọn các mục đã quá hạn mỗi giờ; không có thao tác làm trống thùng rác.

Mật khẩu đã đổi của tài khoản cấu hình được lưu trong bảng `user_profiles` dưới dạng PBKDF2 hash có salt, không lưu văn bản thuần. Sau khi đổi mật khẩu, lần đăng nhập tiếp theo dùng mật khẩu mới thay cho mật khẩu khai báo trong `APP_USERS`.

Địa chỉ `icollector.duyvu2003dk.workers.dev` được cấu hình chuyển tiếp tạm thời sang `myweb.duyvu2003dk.workers.dev`. Cần triển khai thay đổi Worker chuyển tiếp trong dự án iCollector để địa chỉ cũ mở trang hợp nhất.

## Dọn tệp tạm Windows

Tiện ích Windows độc lập nằm trong `tools/TempCleaner.ps1`; trang web/Cloudflare Worker không thể truy cập hoặc xóa tệp trên máy tính của bạn.

- Nhấp đúp `tools/Start-TempCleaner.cmd` để mở giao diện.
- Chọn tuổi tệp tối thiểu rồi bấm **Quét trước** để xem ước tính. **Dọn ngay** sẽ quét lại và yêu cầu xác nhận.
- Có thể bật lịch chạy Chủ nhật hằng tuần (giờ mặc định 10:00, chỉnh được trong giao diện); lịch chạy trong phiên người dùng đã đăng nhập. Dùng **Tắt lịch** để gỡ lịch.
- Mặc định chỉ xét tệp cũ hơn 14 ngày. Phạm vi gồm cache `Cache`, `Code Cache`, `GPUCache` của Chrome/Edge trong các hồ sơ `Default` và `Profile *`, log chẩn đoán Word/Excel/PowerPoint trong Temp, log Claude và tệp trong `%LOCALAPPDATA%\Temp`.
- Tệp cài đặt/lưu trữ `.msi`, `.msp`, `.cab`, `.vsix`, `.exe`, `.zip`, `.iso`, `.msix`, `.appx`, `.appxbundle`, `.7z` được giữ lại. Cache trình duyệt và log ứng dụng sẽ được bỏ qua khi ứng dụng tương ứng đang chạy; tệp bị khóa hoặc lỗi quyền cũng không bị ép xóa.
- Không đụng đến lịch sử, cookie, mật khẩu, dấu trang, tài liệu, dữ liệu Claude ngoài log, hay cache Office có thể chứa nội dung chưa lưu. Lần chạy theo lịch gần nhất được ghi đè trong `%LOCALAPPDATA%\TempCleaner\last-run.txt`.

Có thể chỉ quét từ PowerShell mà không mở giao diện hoặc xóa tệp:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\tools\TempCleaner.ps1 -ScanOnly -Days 14
```

## Nhắc lịch qua Zalo Bot

Bot gửi nhắc từng công việc chưa hoàn thành trước giờ bắt đầu 5 phút, và có thể gửi thêm một bản tóm tắt hằng ngày theo giờ người dùng chọn (múi giờ `Asia/Ho_Chi_Minh`). Tài khoản không thể nhận tin cho đến khi chủ tài khoản đăng nhập ứng dụng, tạo mã liên kết trong **Cài đặt tài khoản → Nhắc Zalo**, rồi gửi lệnh `/start <mã>` trong cuộc trò chuyện riêng với bot. Mã chỉ dùng một lần và hết hạn sau 10 phút. Không thể liên kết cùng một cuộc trò chuyện với nhiều tài khoản lịch.

Quản trị viên cấu hình hai secrets cho Cloudflare Worker và triển khai migration mới:

```powershell
npx.cmd wrangler secret put ZALO_BOT_TOKEN
npx.cmd wrangler secret put ZALO_WEBHOOK_SECRET
npm.cmd run db:migrate:remote
npm.cmd run deploy
```

Khi chạy local, đặt hai giá trị này trong `.dev.vars` (không commit file đó):

```text
ZALO_BOT_TOKEN=token_bot_cua_ban
ZALO_WEBHOOK_SECRET=chuoi_bi_mat_tu_8_den_256_ky_tu
```

`ZALO_WEBHOOK_SECRET` phải dài từ 8 đến 256 ký tự. Sau khi triển khai, quản trị viên đăng nhập, mở **Cài đặt tài khoản → Nhắc Zalo** và chọn **Thiết lập webhook**; Worker sẽ đăng ký webhook HTTPS trên tên miền đang mở và kiểm tra phản hồi. Chỉ tài khoản `duyvu@pvdv` được phép thực hiện thao tác này. Không gửi token/secret vào chat hoặc lưu trong mã frontend.

Người dùng có thể bật/tắt từng loại nhắc, đặt giờ gửi bản tóm tắt hoặc ngắt liên kết trong cùng mục cài đặt. Bot chỉ gửi tin nhắn sau khi người dùng chủ động liên kết; công việc đã hoàn thành sẽ không được nhắc. Cron của Worker chạy mỗi phút nên thời gian gửi có độ chính xác trong khoảng một phút.

## Góc cắm hoa

Thẻ **Cắm hoa** nằm trong thanh điều hướng của website sau khi đăng nhập. Nội dung 3D chỉ tải khi mở thẻ, từ [public/flower-studio](./public/flower-studio/), được đóng gói cùng static assets của Cloudflare. Không cần thêm dependency hoặc thay đổi cơ sở dữ liệu.

Mỗi tài khoản nhận đúng **36 cành hoa/lá ngẫu nhiên mỗi ngày**, đặt lại lúc **00:00 giờ Việt Nam (UTC+7)**. API xác thực `GET /api/flowers/daily` lấy tài khoản từ phiên đăng nhập và ngày từ máy chủ. Danh sách bốc bằng HMAC-SHA256 với `AUTH_SECRET`, tài khoản, ngày và phiên bản thuật toán, nên giữ nguyên trong ngày giữa các lần tải lại và thiết bị, không cần bảng dữ liệu mới. Không nhận ngày, tên tài khoản hoặc hạn mức do trình duyệt gửi lên. Giữ `AUTH_SECRET` và phiên bản thuật toán ổn định để giữ nguyên lượt cấp trong ngày.

Trong bảng hoa, mỗi loại hiển thị số còn dùng được/số được cấp; tăng, giảm và gợi ý phối hoa đều giới hạn theo danh sách hôm nay. Cành bỏ khỏi bình được dùng lại trong ngày; không cộng dồn sang ngày tiếp theo. Khi qua nửa đêm hoặc quay lại trang sau thời gian nghỉ, ứng dụng kiểm tra máy chủ và thay lượt cấp khi sang ngày mới. Khi không tải được lượt cấp, việc chỉnh hoa bị khóa và có nút thử lại. Kiểu bình, màu bình và cảnh quan vẫn dùng được. Bình hoa được lưu cục bộ bằng khóa riêng theo tài khoản và ngày; dữ liệu lưu chung của demo cũ không được dùng làm nguồn cấp hoa.

Bản tích hợp bỏ phần tiêu đề/giới thiệu của demo, dùng khung cửa xanh trầm và giữ các nút chỉnh hoa, đổi bình, đổi cảnh. Bảng chỉnh hoa mặc định ẩn. Lựa chọn được lưu trong trình duyệt theo origin của website. Bản demo riêng tại [demos/flower-studio](./demos/flower-studio/) vẫn được giữ để tham khảo; khi sửa tính năng đã tích hợp, chỉnh bản trong public/flower-studio.

Chạy website bằng `npm.cmd run dev`, mở http://127.0.0.1:8787 rồi chọn **Cắm hoa**. Các file ảnh trong module là ảnh người dùng cung cấp; thư viện Three.js kèm giấy phép MIT trong thư mục vendor của module.
