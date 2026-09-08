# Bộ ảnh test — nguồn gốc & phân loại

Bộ 11 ảnh dùng để đo accuracy của Vision LLM ở 2 chế độ `concept` và `geometry`.
Mỗi ảnh đi kèm một file `<tên>.truth.json` ghi ground truth do người gán thủ công.

## ⚠️ Bản quyền

Các ảnh dưới đây thuộc bản quyền của tác giả/website tương ứng. Chúng được đưa vào
repo **chỉ để làm dữ liệu đánh giá kỹ thuật nội bộ** (đo độ chính xác của Vision LLM),
với số lượng nhỏ và không nhằm mục đích phân phối lại.

**KHÔNG** dùng geometry trích xuất từ những ảnh này để sản xuất video thương mại.
Đây chính là một trong các lý do PRD nên ưu tiên chế độ `concept` (tham chiếu ý tưởng)
thay vì `geometry` (sao chép nét vẽ) — xem mục "Lưu ý bản quyền" trong README.md.

Nếu chủ sở hữu yêu cầu gỡ bỏ, xoá file tương ứng và thay bằng ảnh tự vẽ.

## Phân loại

Bộ ảnh được chọn có chủ đích để **không** dễ dãi: 4/11 ảnh là trường hợp mà model
**phải từ chối** (`is_step_tutorial: false`). Nếu chỉ toàn ảnh đẹp thì cả hai chế độ
đều pass và thí nghiệm không nói lên điều gì.

| File | Nhóm | Hook | Steps | Nguồn |
|---|---|---|:---:|---|
| `easy_cat_number20.png` | easy | number 20 | 4 | drawingtutorials101.com |
| `easy_giraffe_number1.png` | easy | number 1 | 4 | drawingtutorials101.com |
| `easy_giraffe_letterG.jpg` | easy | letter G | 5 | Pinterest (ảnh chụp tay) |
| `medium_rabbit_7steps.jpg` | medium | — (oval) | 7 | howtodrawforkids.com |
| `medium_rabbit_8steps.jpg` | medium | — (circle+oval) | 8 | Pinterest |
| `medium_bird_number78.jpg` | medium | number 7 + 8 | 6 | drawinghowtodraw.com |
| `medium_dinosaur_faces.jpg` | medium | — | **0** ❌ | Pinterest |
| `hard_cat_singlestep.png` | hard | number 20 | **0** ❌ | drawingtutorials101.com |
| `hard_dog_bg.webp` | hard | — | **0** ❌ | draweasyfun.com |
| `negative_rabbit_finished.png` | negative | — | **0** ❌ | wedrawanimals.com |
| `negative_dog_anatomy.jpg` | negative | — | **0** ❌ | clipstudio.net |

### Vì sao 5 ảnh có `step_count: 0`

| File | Lý do phải từ chối |
|---|---|
| `medium_dinosaur_faces` | Bảng **variation** mắt/miệng, không phải tiến trình từng bước |
| `hard_cat_singlestep` | Chỉ 1 panel lẻ tách khỏi tutorial gốc |
| `hard_dog_bg` | Ảnh kết quả có background, không có panel |
| `negative_rabbit_finished` | Hình hoàn thiện đơn lẻ |
| `negative_dog_anatomy` | Sơ đồ giải phẫu/tỷ lệ, không phải hướng dẫn vẽ |

Với các ảnh này, `scoring.py` chấm **100 điểm nếu model từ chối đúng** (`true_negative`)
và **0 điểm nếu model vẫn parse bừa** (`false_positive`).

### Ảnh đáng chú ý

`easy_cat_number20` và `easy_giraffe_number1` là **đúng format vàng** của dự án:
lưới panel rõ ràng, hook là chữ số, nét mới ở mỗi bước được tô màu khác với nét cũ.
Nếu Vision LLM không đọc tốt được hai ảnh này thì khó kỳ vọng ở ảnh nào khác.

`medium_bird_number78` là ca khó có chủ đích: layout lộn xộn, chú thích chen ngang
("Sideways Letter V", "Don't draw the dotted line"), và bị cắt ở "MORE STEPS BELOW"
— tức ảnh **không chứa đủ** toàn bộ tiến trình.

## Thay bằng ảnh của bạn

Ground truth do người gán, nên nếu đổi ảnh thì phải cập nhật `.truth.json` tương ứng:

```json
{
  "step_count": 6,
  "subject_name": "rabbit",
  "hook_shape": "number 3",
  "is_step_tutorial": true,
  "difficulty": "easy",
  "note": "mô tả ngắn"
}
```

Trường `is_step_tutorial` là bắt buộc để rubric phân biệt được true/false negative.
