# Chính sách An toàn Tiếp thị Liên kết (Affiliate Safety Policy)

Tài liệu này quy định các tiêu chuẩn kỹ thuật, chính sách bảo vệ dữ liệu và cơ chế chống vi phạm thuật toán nền tảng (TikTok, YouTube Shorts, Meta Reels, Shopee Video) được tích hợp trong **auto-drawing (Universal AI Game Video Engine)**.

---

## 1. Bối cảnh & Rủi ro Vận hành Kênh Affiliate Tự động

Khi sản xuất và đăng tải video ngắn thương mại điện tử với tần suất lớn (50–100 video/ngày), các kênh tự động thường đối mặt với 3 nguy cơ lớn:

1. **Bị bóp tương tác (Shadowban) hoặc cấm kênh do in link thô lên video**:
   - Thuật toán thị giác máy tính (OCR) của TikTok và Meta liên tục quét chữ trong video. Nếu phát hiện chuỗi URL thô (`https://shope.ee/...`, `vt.tiktok.com/...`) hoặc mã QR dẫn ra nền tảng đối thủ, video sẽ bị bóp phân phối 0 view hoặc vi phạm chính sách cộng đồng (Spam / Redirect Traffic).
2. **Khiếu nại sai lệch thông tin ("Data Hallucination / Invention")**:
   - Giá tiền sản phẩm hiển thị sai so với giá bán thực tế, gây hiểu lầm cho người tiêu dùng và làm giảm uy tín kênh.
3. **Mất chuyển đổi do UI nền tảng che khuất nội dung quan trọng**:
   - Tên sản phẩm hoặc giá bán bị che bởi nút thả tim, khung bình luận hoặc thanh âm thanh quay tròn.

---

## 2. Nguyên tắc Cốt lõi: "Zero Data Invention"

Trong toàn bộ pipeline kết xuất của `auto-drawing`:
- **Không tự bịa giá fallback**: Tuyệt đối không sử dụng các hằng số giá mặc định (như `500000`, `189000`...) khi SKU thiếu dữ liệu giá. Nếu giá sản phẩm không hợp lệ (`price <= 0` hoặc không tìm thấy trong danh mục), pipeline lập tức **Fail-Fast** với mã lỗi rõ ràng (`E_PRICE_SOURCE_INVALID`).
- **Không tự đoán đáp án trong Renderer**: Tầng đồ hoạ (`scenePainter.ts`) chỉ thực hiện nhiệm vụ vẽ (Pure Projection). Đáp án đúng (`correctAnswer`) và kết quả lật mở (`revealText`) bắt buộc phải được tính toán và xác thực tại tầng `challenge` (`ChallengeCurator.ts`) và `validator`.

---

## 3. Cơ chế Quét Điểm ảnh Phòng vệ (Pixel-Scan Guard)

Hệ thống tích hợp mô-đun quét an toàn độc lập `src/render/pixelScan.ts`:

### Cách thức Hoạt động:
1. **Kiểm soát Tầng Vẽ (Paint-time Isolation)**:
   - Các trường `affiliate_link` trong đối tượng `Product` bị cô lập hoàn toàn khỏi danh sách thuộc tính được chuyển giao cho các hàm vẽ canvas (`drawProductCard`, `drawCyberpunkShowcase`...).
2. **Kiểm tra Chuỗi Văn bản Xuất ra (String Filter)**:
   - Trình render text vector (`TextRenderer`) chặn tất cả các chuỗi có định dạng `http://`, `https://`, `shope.ee`, `s.lazada`, `tiktok.com` hoặc có chứa tham số tiếp thị `?aff=`, `?ref=`.
3. **Mã Lỗi Phòng vệ `E_AFFILIATE_BURNED_IN`**:
   - Nếu trong quá trình render xuất hiện bất kỳ dấu hiệu nào của link affiliate bị in lên frame ảnh, hệ thống sẽ ngắt ngay tiến trình render và xóa sạch thư mục tạm thời để ngăn video lỗi bị xuất bản.

---

## 4. Chuẩn Tệp Tin Kèm Theo: `*.caption.json`

Mỗi video MP4 khi hoàn thành luôn được xuất kèm theo một file metadata JSON có cùng tên (ví dụ: `g1_hi_lo_839271.caption.json`):

### Cấu trúc Schema Tiêu chuẩn:
```json
{
  "jobId": "job_1726482190_839271",
  "gameId": "g1_hi_lo",
  "seed": 839271,
  "videoFile": "g1_hi_lo_839271.mp4",
  "caption": "Món B CAO HƠN hay THẤP HƠN món A? Xem hết để biết ai là bậc thầy mua sắm! 🛒✨",
  "hashtags": [
    "#dovui",
    "#guesstheprice",
    "#muasamthongminh",
    "#reviewgiadung",
    "#tiktokshop"
  ],
  "products": [
    {
      "productId": "p001",
      "name": "Nước giặt OMO 3.5kg",
      "price": 189000,
      "affiliateLink": "https://shopee.vn/p001?aff=123"
    },
    {
      "productId": "p002",
      "name": "Nồi chiên không dầu Philips",
      "price": 1490000,
      "affiliateLink": "https://shopee.vn/p002?aff=123"
    }
  ],
  "pinnedComment": "👉 Link săn sale chính hãng cho các món đồ trong video tại đây:\n1. Nước giặt OMO: https://shopee.vn/p001?aff=123\n2. Nồi chiên Philips: https://shopee.vn/p002?aff=123\n(Mã giảm giá độc quyền có hạn!)"
}
```

---

## 5. Tích hợp với Bot Đăng Video Tự động (Auto-Poster Bots)

File `*.caption.json` được thiết kế sẵn để kết nối trực tiếp với các công cụ tự động hóa xuất bản:

### Kịch bản Đăng Tải An toàn Khuyến nghị:
1. **Tiêu đề & Caption**: Sử dụng trường `caption` kết hợp với `hashtags` đưa vào phần mô tả video.
2. **Link Tiếp thị Liên kết (Affiliate Links)**:
   - **Cách 1 (Khuyến nghị cho TikTok)**: Bot tự động tạo bình luận đầu tiên ngay sau khi video được tải lên với nội dung lấy từ trường `pinnedComment`, sau đó ghim bình luận này lên đầu trang.
   - **Cách 2 (TikTok Shop Showcase)**: Gắn trực tiếp thẻ giỏ hàng vàng thông qua mã SKU `productId`.
   - **Cách 3 (YouTube Shorts)**: Đặt link affiliate vào phần mô tả video và ghim bình luận.

---

## 6. Vùng An Toàn Nền Tảng (Mobile Safe Zone 9:16)

Khung hình có độ phân giải chuẩn **1080 × 1920** (tỉ lệ 9:16). Để nội dung không bị che khuất:

```
0px ───────────────────────────────────────── (Mép trên màn hình)
     [KHU VỰC NGUY HIỂM - Nền tảng: Search, Live, Tab Following/For You]
360px ───────────────────────────────────────── [BẮT ĐẦU VÙNG AN TOÀN]
     
     HUD Series & Tên Game (y: 120px)
     Khung Câu Hỏi Trung Tâm (y: 220px)
     
     Khu Vực Trưng Bày Sản Phẩm (y: 480px - 1180px)
     
     Bộ Nút Bấm Lựa Chọn & Giá Tiền (y: 1200px - 1520px)
     Thanh Đếm Ngược Pill Timer / Banner Reveal (y: 1540px)
     
1580px ──────────────────────────────────────── [KẾT THÚC VÙNG AN TOÀN]
     [KHU VỰC NGUY HIỂM - Nền tảng: Caption 4 dòng, Đĩa nhạc quay, Nút Shop]
1920px ──────────────────────────────────────── (Đáy màn hình)
```

- **Mép phải (`x > 920px`)**: Không bố trí thông tin quan trọng vì bị che bởi cột nút (Avatar, Tim, Bình luận, Bookmark, Nút Share).
- **Hệ thống tự động canh chỉnh**: Hàm `drawMultiRoundProducts()` và `drawChoiceDeck()` đã được cấu hình toạ độ chuẩn hoá để luôn nằm trọn trong vùng từ `y = 360px` đến `y = 1560px`.
