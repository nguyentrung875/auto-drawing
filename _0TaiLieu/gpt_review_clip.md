Tôi đã xem video. Đây là **video vẽ bảng kiểu “One Minute Draw”**, dài khoảng 12 giây, trong đó bàn tay + viên phấn di chuyển đúng theo nét vẽ, cuối cùng tạo thành một chú thỏ. Điểm quan trọng là **không phải AI tạo video thông thường**, mà bản chất là một bài toán **motion graphics + computer vision/geometry + compositing**.

![Image](https://images.openai.com/static-rsc-4/_MqLD_ibJ1f6mge06-wqRdQF2tFcHcl0tWexLTdZHj0h9AwizKSFpoo-uzJaad1mGRKELXWJ3v_GfLlRS-M_fjtLtaOPUFlkl5nWovooEJOESJrk6cB1kLrvY_fQl_TkdyvmVid3zAPrOIbem7vZ8RyFelUe_Z_DT2bGUwgl5DDB6BTKfPKwqRUUwD4XhIxQ?purpose=fullsize)

![Image](https://images.openai.com/static-rsc-4/wHgcqDlseXWprpgORmgs4eh53CUWVWZXJwLzqHA2isC0j14YEQ0YRE1c2QnXb9y1buT1y18dv-C2ykCk0G0x3lPPhmLdr0e1CHR1Srmv5pYobbMq6dMRv4d0RNCLdRODt-a8iw1c5x46QAbEvY2wP0GwCgEqFxn3rWHjBEr_-oT7Zx8VnXFT2iise_Q09c_i?purpose=fullsize)

![Image](https://images.openai.com/static-rsc-4/bskRRy8M2vxCCqPPTfn7Ols3QSQBZAsqKcDsHS0mHpy375Or6qG7xnBuA_VrNRY6Cveh91_8hwNsnLiyVAChpGxrnofQeTHtVEirtdAsrVu-7mHOXHPlqt6lcI5CpDdAX218rKWHxg6ACEqyvJR9YBXRdrAwAqqLMLjqyKRBYPui0AhuFGWFliYttL35dvaC?purpose=fullsize)

## 1. Độ khó thực sự nằm ở đâu?

Tôi chấm như sau:

| Thành phần                     |   Độ khó | Vì sao                               |
| ------------------------------ | -------: | ------------------------------------ |
| 🧠 Tạo ý tưởng/concept         |     2/10 | LLM làm rất tốt                      |
| ✏️ Chuyển hình thành nét vẽ    |     5/10 | Cần vector hóa + xác định thứ tự nét |
| 🧭 Xác định đường đi của phấn  | **7/10** | Phải có path chính xác               |
| 🎞️ Animate nét vẽ             |     4/10 | SVG/path animation khá dễ            |
| ✋ Tay cầm phấn                 | **9/10** | Đây là phần khó nhất                 |
| 🎯 Tay + đầu phấn bám đúng nét | **9/10** | Phải đồng bộ tọa độ theo path        |
| 🫥 Che/hiện nét phía sau tay   |     8/10 | Cần compositing/mask chính xác       |
| 🖍️ Texture phấn/bảng          |     5/10 | Có thể procedural                    |
| 🎥 Camera/zoom/shake           |     3/10 | Code được                            |
| 🔊 Sound effect                |     2/10 | Có thể dùng AI/audio library         |
| 📱 TikTok UI                   |     1/10 | Template                             |
| 🔄 Tạo hàng loạt               | **6/10** | Cần pipeline tự động                 |

### Tổng thể: khoảng **8/10**

Nhưng có một điểm cực kỳ quan trọng:

> **90% độ khó không nằm ở việc vẽ con thỏ. Nó nằm ở việc làm cho bàn tay thật + viên phấn trông như đang thực sự vẽ con thỏ.**

---

# 2. Nếu bỏ bàn tay thì bài toán rất dễ

Ví dụ hình con thỏ có thể biểu diễn thành:

```text
SVG
 ├── head
 ├── left_ear
 ├── right_ear
 ├── body
 ├── left_hand
 ├── right_hand
 ├── eyes
 └── carrot
```

Mỗi thành phần là một hoặc nhiều Bézier path:

```text
M0 → C1 → C2 → C3 → ...
```

Sau đó:

```text
stroke-dasharray
stroke-dashoffset
```

làm cho nét xuất hiện dần.

Ví dụ:

```text
      phấn
       ↓
───────●────────────
      ↑
    nét đã vẽ
```

Đầu phấn chỉ cần chạy theo:

```python
point = path.get_point_at_length(t)
```

là xong.

**Phần này tôi có thể thiết kế workflow rất chắc.**

---

# 3. Nhưng video mẫu có một yêu cầu khó hơn nhiều

Hãy nhìn đoạn này:

```text
             ✋
             │
             │ phấn
             ▼
        ─────●────
              \
               \
                )
```

Không phải chỉ cần:

> "cho bàn tay chạy từ A → B"

mà phải:

```text
DRAWING PATH
       │
       ├── position
       ├── tangent
       ├── rotation
       └── timing
              ↓
        HAND MOTION
              ↓
          COMPOSITE
```

Tức là tại **mọi frame**:

```text
phấn.position == drawing_path.position
```

và:

```text
hand.rotation ≈ path.tangent
```

Nếu lệch chỉ vài pixel:

```text
        ✋
         \
          ○ ← phấn

──────────────
       ↑
   nét thật nằm đây
```

người xem lập tức nhận ra:

> "Tay này đang giả vờ vẽ."

Đây chính là vấn đề mà các workflow AI video kiểu:

> Image → AI Video

rất dễ thất bại.

---

# 4. Tôi sẽ KHÔNG dùng AI video để tạo toàn bộ video

Đây là quyết định kiến trúc quan trọng nhất.

Tôi **không chọn**:

```text
Prompt
 ↓
AI Image
 ↓
Kling/Veo/Sora
 ↓
Video
```

vì AI video không đảm bảo:

```text
frame 1: nét A
frame 2: nét A
frame 3: nét A+B
frame 4: nét A+B
...
```

và đặc biệt:

```text
hand → chalk tip → exact path
```

không deterministic.

---

# 5. Workflow tôi đề xuất

Tôi sẽ xây theo kiểu:

```text
                 ┌──────────────┐
                 │      LLM     │
                 │ Story/Steps  │
                 └──────┬───────┘
                        ↓
                ┌──────────────┐
                │ Image/Vector │
                │ Generation   │
                └──────┬───────┘
                       ↓
                ┌──────────────┐
                │ SVG Parser   │
                │ + Path Plan  │
                └──────┬───────┘
                       ↓
             ┌─────────────────────┐
             │ Drawing Timeline    │
             │                     │
             │ path 1 → 0.8s       │
             │ path 2 → 1.2s       │
             │ path 3 → 0.7s       │
             └──────────┬──────────┘
                        ↓
              ┌──────────────────┐
              │ Hand Controller  │
              │                  │
              │ position         │
              │ rotation         │
              │ occlusion        │
              └────────┬─────────┘
                       ↓
              ┌──────────────────┐
              │ Compositor       │
              │                  │
              │ Chalkboard       │
              │ Drawing          │
              │ Hand             │
              │ Chalk dust       │
              │ Text             │
              └────────┬─────────┘
                       ↓
                    FFmpeg
                       ↓
                  TikTok MP4
```

---

# 6. Tôi sẽ chia hệ thống thành 4 engine

Đây là điểm tôi nghĩ sẽ giúp dự án của bạn dễ xây hơn rất nhiều.

### Engine 1 — Drawing Engine ✏️

Input:

```text
"Draw a bunny using two number 3s"
```

Output:

```json
{
  "strokes": [
    {
      "path": "...",
      "duration": 0.8
    },
    {
      "path": "...",
      "duration": 0.7
    }
  ]
}
```

Engine này **không biết bàn tay là gì**.

Nó chỉ biết:

> "Nét nào được vẽ trước, nét nào sau."

---

### Engine 2 — Hand Engine ✋

Input:

```text
drawing_path
```

Output:

```text
hand_position
hand_rotation
chalk_position
```

Ví dụ:

```python
for frame in timeline:

    p = path.point_at(frame.t)
    tangent = path.tangent_at(frame.t)

    hand.x = p.x
    hand.y = p.y

    hand.rotation = tangent.angle
```

Đây là **trái tim kỹ thuật** của hệ thống.

---

### Engine 3 — Style Engine 🖍️

Tạo:

```text
chalkboard texture
chalk texture
chalk dust
hand lighting
shadow
grain
```

Nhằm khiến output không giống SVG sạch sẽ.

Ví dụ:

```text
SVG
 ↓
chalk shader
 ↓
noise
 ↓
opacity variation
 ↓
blur
 ↓
chalk particles
```

---

### Engine 4 — Video Engine 🎬

Cuối cùng:

```text
Canvas
+
SVG
+
Hand
+
Text
+
SFX
+
Camera
      ↓
FFmpeg
      ↓
1080 × 1920
```

---

# 7. Phần bàn tay: tôi thấy có 3 hướng

### A — AI video

```text
AI generate hand
```

**Dễ prototype nhưng khó deterministic.**

Đánh giá:

**4/10**

Không phù hợp làm core engine.

---

### B — 2D hand asset + animation

Có một bộ bàn tay:

```text
hand_idle
hand_left
hand_right
hand_up
hand_down
```

Sau đó code transform:

```text
position
rotation
scale
```

Ưu điểm:

* rẻ
* deterministic
* nhanh
* dễ batch

Nhược điểm:

> dễ nhìn ra là animation.

Tôi đánh giá:

**7/10**

Cho MVP đây lại là hướng **rất đáng làm**.

---

### C — 3D hand + procedural animation

Ví dụ:

```text
Blender
   ↓
3D hand
   ↓
IK
   ↓
Chalk
   ↓
Path
   ↓
Camera
   ↓
Render
```

Khi đó:

```text
hand → chalk → drawing
```

được kiểm soát bằng geometry.

Ưu điểm:

**rất deterministic.**

Nhược:

* setup ban đầu khó
* cần rig
* lighting
* skin material
* fingers
* contact giữa ngón tay và phấn

Nhưng nếu mục tiêu của bạn là **video factory**, tôi đánh giá đây là hướng dài hạn tốt nhất.

---

# 8. Có một trick rất quan trọng

Không nhất thiết phải tạo **một bàn tay AI mới cho từng video**.

Ta có thể xây:

```text
                HAND LIBRARY
                     │
        ┌────────────┼────────────┐
        ↓            ↓            ↓
     Grip A        Grip B       Grip C
        │            │            │
        └────────────┼────────────┘
                     ↓
                Path Adapter
                     ↓
               New Drawing
```

Ví dụ chỉ cần một hand model:

```text
hand + chalk
```

Sau đó:

```text
bunny
cat
dog
car
house
flower
rocket
```

đều dùng được.

Đây chính là cách biến nó từ:

> "AI tạo một video"

thành:

> **"video generation engine".**

---

# 9. Khả năng tôi xây được workflow này?

Nếu định nghĩa "làm được" là:

### Level 1 — Có video tương tự

**95–98%**

Có thể tạo:

* bảng xanh
* bàn tay
* phấn
* nét vẽ
* text
* animation
* sound
* TikTok format.

---

### Level 2 — Nét vẽ chính xác

**95%+**

Nếu dùng:

```text
SVG/path
+
procedural animation
```

thì phần này không phải vấn đề lớn.

---

### Level 3 — Tay và phấn khớp với nét

**90–95%**

Nếu dùng:

```text
path-driven hand controller
```

thì hoàn toàn khả thi.

---

### Level 4 — Trông gần như video mẫu

**80–90%**

Phụ thuộc rất lớn vào:

* hand realism
* lighting
* chalk texture
* occlusion
* motion
* camera
* compositing.

---

### Level 5 — Người xem không nhận ra là generated

Tôi sẽ thận trọng hơn:

**70–85%**

Không phải vì drawing khó.

Mà vì **bàn tay người thật là thứ cực kỳ khó giả lập hoàn hảo**.

---

# 10. Nhưng nếu mục tiêu là xây Video Factory thì tôi đánh giá khác

Nếu mục tiêu của bạn là:

> nhập ý tưởng → hệ thống tự tạo 100/1000 video cùng style

thì tôi đánh giá khả năng xây thành **MVP thực tế: ~90%**.

Và khả năng tạo video **đủ tốt để test TikTok**:

> **~85–90%.**

Không cần đạt 100% giống video mẫu ngay từ đầu.

Thậm chí tôi sẽ cố tình **không giải quyết hand realism ở phase 1**.

---

# 11. Thứ tự tôi sẽ build

Nếu tôi là technical/product lead của dự án này, tôi sẽ đi:

```text
PHASE 1
SVG drawing
      ↓
Stroke animation
      ↓
FFmpeg
      ↓
Video
```

↓

```text
PHASE 2
Path → chalk position
      ↓
Hand asset
      ↓
Hand follows path
```

↓

```text
PHASE 3
Hand occlusion
      ↓
Chalk texture
      ↓
Board texture
      ↓
Dust
```

↓

```text
PHASE 4
LLM
 ↓
Idea
 ↓
Drawing plan
 ↓
SVG
 ↓
Animation
 ↓
Video
```

↓

```text
PHASE 5
Batch generation
 ↓
100 videos/day
```

↓

```text
PHASE 6
3D realistic hand
 ↓
Photorealistic final
```

**Không nên bắt đầu bằng AI video generation.**

---

## Kết luận

Điểm tôi đánh giá quan trọng nhất:

> **Video này nhìn có vẻ là AI video, nhưng thực ra phần khó nhất nên được giải bằng code chứ không phải AI.**

Kiến trúc tốt nhất là:

```text
AI = nghĩ + thiết kế
       ↓
Vector = xác định chính xác phải vẽ gì
       ↓
Code = quyết định vẽ ở đâu/khi nào
       ↓
Hand engine = quyết định tay/phấn đi thế nào
       ↓
Compositor = làm nó trông thật
       ↓
FFmpeg = đóng gói video
```

Với hướng này, **tôi tự tin khoảng 90% có thể thiết kế và triển khai một workflow tạo ra video cùng loại**, và khoảng **70–85% để đạt mức photorealistic rất khó phân biệt với footage thật**. Phần cần đầu tư R&D nhiều nhất là **Hand Engine**, không phải Drawing Engine.

1. Bạn muốn **giống chính xác video mẫu này**, hay chỉ cần cùng format “tay + phấn + bảng + vẽ từng bước”?
2. Bạn muốn workflow **100% local/free**, hay chấp nhận một vài API/model trả phí nếu chất lượng tăng mạnh?
3. Mục tiêu cuối cùng của bạn là **tạo 1 video**, hay xây hẳn **factory tự động tạo hàng trăm video TikTok/ngày**?
