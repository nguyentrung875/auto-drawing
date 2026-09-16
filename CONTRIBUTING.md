# Hướng dẫn Đóng góp (Contribution Guide)

Chào mừng bạn tham gia phát triển dự án **auto-drawing (Universal AI Game Video Engine)**! Dự án hướng tới xây dựng một hệ thống mã nguồn mở local-first mạnh mẽ, bền bỉ và chuẩn mực cho việc tự động hoá video ngắn giải trí và tiếp thị liên kết.

---

## 1. Nguyên tắc & Triết lý Lập trình

Mọi đóng góp vào codebase cần tuân thủ 4 nguyên tắc kỹ thuật cốt lõi:

1. **Zero Data Invention**:
   - Renderer và Presentation layer chỉ là các phép chiếu đồ hoạ thuần túy (pure projection).
   - Không tự ý bịa đặt giá tiền fallback, không đoán mò đáp án, không chèn dữ liệu không có căn cứ từ catalog.
2. **Determinism (Tính Tất định)**:
   - Cùng một bộ tham số đầu vào `(dsl, catalog, seed, options)` phải luôn cho ra kết quả bit-for-bit chính xác giữa các lần chạy.
3. **Clean Architecture & Bounded Contexts**:
   - Tuân thủ quy tắc phụ thuộc 1 chiều: `queue -> validator -> challenge -> {scene, audio} -> render -> observability`.
   - Bị kiểm soát tự động bởi ESLint rule `import/no-restricted-paths`.
4. **Fail-Fast**:
   - Khi phát hiện dữ liệu thiếu hoặc logic game không hợp lệ, hệ thống phải dừng lại ngay lập tức với mã lỗi cụ thể (`E_*`), không chạy tiếp trong trạng thái lỗi ngầm.

---

## 2. Thiết lập Môi trường Phát triển

1. **Yêu cầu Bắt buộc**:
   - Node.js phiên bản `>= 22.12.0`.
   - FFmpeg được cài đặt sẵn trên máy và có trong `PATH`.
2. **Cài đặt dependencies**:
   ```bash
   npm install
   npm --prefix studio install
   ```
3. **Khởi tạo tài nguyên mẫu**:
   ```bash
   npm run assets:generate
   ```
4. **Kiểm tra trạng thái hệ thống**:
   ```bash
   npm run verify
   ```

---

## 3. Quy chuẩn Mã nguồn (Coding Standards)

- **TypeScript Strict Mode**:
  - Không sử dụng kiểu `any` tùy tiện. Sử dụng `unknown` kết hợp type narrowing hoặc Zod schemas.
  - Mọi hàm công khai (public methods / exported functions) phải có định kiểu rõ ràng cho tham số và giá trị trả về.
- **Không dùng Stringly-Typed Checks**:
  - Tránh kiểm tra chuỗi câu hỏi như `round.question.includes('che')` để suy đoán mechanic.
  - Sử dụng trường định danh rõ ràng như `round.mechanic` hoặc `dsl.id`.
- **Tối ưu Hiệu năng Render**:
  - Mọi thao tác nạp ảnh PNG trong vòng lặp render khung hình bắt buộc phải đi qua `RenderAssetCache`.
  - Tuyệt đối không đọc lại đĩa I/O liên tục cho cùng một hình ảnh qua hàng trăm frames.
- **Xử lý Đường dẫn (Paths)**:
  - Luôn sử dụng `path.resolve(rootDir, ...)` để đảm bảo tương thích đa nền tảng (Windows, macOS, Linux). Không dùng phép cộng chuỗi `rootDir + '/' + ...`.

---

## 4. Kiểm thử & Đảm bảo Chất lượng (Testing & QA)

Dự án sử dụng **Vitest** làm framework kiểm thử chính. Mọi pull request cần bổ sung test case tương ứng:

- **Unit tests**: Đặt trong `test/<domain>/` (ví dụ: `test/challenge/`, `test/render/`).
- **Studio API tests**: Đặt trong `studio/test/api/`.
- **Lệnh chạy kiểm tra một lần**:
  ```bash
  npm test
  ```
- **Lệnh chạy chế độ quan sát (Watch mode)**:
  ```bash
  npm run test:watch
  ```
- **Lệnh kiểm tra toàn diện trước khi commit (Pre-commit Verify)**:
  ```bash
  npm run verify
  ```
  *(Lệnh này tự động thực thi `tsc --noEmit` + `eslint src` + `vitest run`). Bắt buộc 100% xanh.*

---

## 5. Quy chuẩn Commit Message (Conventional Commits)

Chúng tôi sử dụng chuẩn **Conventional Commits**:

- `feat:` Thêm tính năng mới (ví dụ: thêm mechanic mới, thêm engine âm thanh).
- `fix:` Sửa lỗi (ví dụ: sửa toạ độ vẽ thẻ, sửa lỗi compile).
- `perf:` Cải thiện hiệu năng (ví dụ: tối ưu hoá `RenderAssetCache`, giảm thời gian mux video).
- `refactor:` Tái cấu trúc mã nguồn không làm thay đổi tính năng bên ngoài.
- `docs:` Thêm hoặc cập nhật tài liệu.
- `test:` Thêm hoặc chỉnh sửa test cases.
- `chore:` Các thay đổi cấu hình dự án, nâng cấp dependencies.

*Ví dụ:*
```bash
git commit -m "feat(challenge): add g10 mystery box game definition and curation logic"
git commit -m "fix(render): prevent text overlap in product name when length exceeds 40 chars"
```

---

## 6. Danh mục Kiểm tra Pull Request (PR Checklist)

Trước khi gửi Pull Request hoặc yêu cầu review:
- [ ] Mã nguồn đã chạy `npm run verify` thành công không có bất kỳ cảnh báo/lỗi nào.
- [ ] Không có file tạm (`temp/`, `queue/`, `export/*.mp4`) nào bị commit vào git.
- [ ] Đã viết unit test cho các hàm hoặc mechanic mới thêm vào.
- [ ] Đã cập nhật tài liệu trong `docs/` nếu có thay đổi về architecture, CLI flags hoặc schema.
