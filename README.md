# Không gian dùng chung

Ứng dụng Cloudflare Worker này kết hợp lịch trình tháng riêng theo tài khoản và cổng thông tin dùng chung.

## Cấu hình tài khoản

Tài khoản được quản lý thủ công bằng Worker secrets; không ghi thông tin đăng nhập vào mã nguồn.

1. Tạo `APP_USERS` dưới dạng JSON ánh xạ tên tài khoản tới mật khẩu. Có thể bổ sung tài khoản trong `APP_USERS_EXTRA` để không phải thay thế danh sách tài khoản hiện tại. Tên đăng nhập có thể dài tối đa 254 ký tự, bắt đầu bằng chữ hoặc số và chỉ gồm chữ ASCII, số, dấu chấm, gạch dưới, `@`, `+` hoặc `-`; không phân biệt chữ hoa/thường.
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

## Cơ sở dữ liệu và triển khai

Worker tiếp tục sử dụng D1 `db_duyvu`. Trước khi triển khai, áp dụng migration để tạo các bảng cần thiết (bao gồm lưu hồ sơ tài khoản, thông tin xác thực khi đổi mật khẩu và thùng rác của cổng thông tin):

```powershell
npm run db:migrate:remote
npm run deploy
```

Lịch của từng tài khoản được lưu trong bảng riêng có dạng `schedule_<sha256_tên_tài_khoản_viết_thường>`; bảng tự tạo khi tài khoản mở lịch lần đầu. Tên bảng được băm để tên đăng nhập (kể cả email) không thể tác động đến SQL. Cổng thông tin đọc và ghi vào bảng `entries` dùng chung. Các bản ghi lịch cũ trong `web_data` vẫn được giữ nguyên nhưng không thể tự gán cho một tài khoản; lịch từng tài khoản bắt đầu riêng sau khi bật đăng nhập.

Thông tin bị xóa trong cổng thông tin được chuyển vào thùng rác, có thể khôi phục trong vòng 30 ngày. Worker chạy tác vụ định kỳ mỗi giờ để xóa vĩnh viễn các mục đã quá hạn; không có thao tác làm trống thùng rác.

Thông tin cá nhân và mật khẩu đã đổi được lưu trong bảng `user_profiles`; mật khẩu lưu dưới dạng PBKDF2 hash có salt, không lưu văn bản thuần. Sau khi đổi mật khẩu, lần đăng nhập tiếp theo dùng mật khẩu mới thay cho mật khẩu khai báo trong `APP_USERS`.

Địa chỉ `icollector.duyvu2003dk.workers.dev` được cấu hình chuyển tiếp tạm thời sang `myweb.duyvu2003dk.workers.dev`. Cần triển khai thay đổi Worker chuyển tiếp trong dự án iCollector để địa chỉ cũ mở trang hợp nhất.
