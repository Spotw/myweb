# Không gian dùng chung

Ứng dụng Cloudflare Worker này kết hợp lịch trình tháng riêng theo tài khoản và cổng thông tin dùng chung.

## Cấu hình tài khoản

Tài khoản được quản lý thủ công bằng hai Worker secrets; không ghi thông tin đăng nhập vào mã nguồn.

1. Tạo `APP_USERS` dưới dạng JSON ánh xạ tên tài khoản tới mật khẩu. Tên tài khoản chỉ gồm chữ ASCII, số hoặc dấu gạch dưới, dài 1–32 ký tự và không phân biệt chữ hoa/thường.
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

Worker tiếp tục sử dụng D1 `db_duyvu`. Trước khi triển khai, áp dụng migration để tạo `entries` nếu bảng chưa tồn tại:

```powershell
npm run db:migrate:remote
npm run deploy
```

Lịch của từng tài khoản được lưu trong bảng riêng có dạng `schedule_<tên_tài_khoản>`; bảng tự tạo khi tài khoản mở lịch lần đầu. Cổng thông tin đọc và ghi vào bảng `entries` dùng chung. Các bản ghi lịch cũ trong `web_data` vẫn được giữ nguyên nhưng không thể tự gán cho một tài khoản; lịch từng tài khoản bắt đầu riêng sau khi bật đăng nhập.

Địa chỉ `icollector.duyvu2003dk.workers.dev` được cấu hình chuyển tiếp tạm thời sang `myweb.duyvu2003dk.workers.dev`. Cần triển khai thay đổi Worker chuyển tiếp trong dự án iCollector để địa chỉ cũ mở trang hợp nhất.
