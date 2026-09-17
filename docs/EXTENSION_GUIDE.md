# Hướng dẫn Mở rộng Hệ thống (Extension Guide)

Tài liệu này hướng dẫn chi tiết cách lập trình viên mở rộng các tính năng của **auto-drawing (Universal AI Game Video Engine)**: từ việc bổ sung Game Mechanic mới, thêm sản phẩm, tùy biến giọng đọc AI, hiệu ứng âm thanh đến thay đổi giao diện đồ hoạ.

---

## 1. Hướng dẫn Thêm một Game Mechanic Mới

Quy trình chuẩn gồm 5 bước chặt chẽ để đảm bảo tuân thủ kiến trúc Clean Architecture và vượt qua kiểm tra tĩnh (Static Typing & Linter):

### Ví dụ Thực tế: Thêm Game `g10_mystery_box` (Hộp Quà Bí Ẩn)
*Luật chơi:* Hệ thống đưa ra 3 hộp quà bí ẩn (mỗi hộp ẩn giấu 1 sản phẩm). Người chơi phải đoán xem "Hộp quà nào có giá trị cao nhất?".

---

### Bước 1: Khai báo DSL Game trong `src/definitions/`
Tạo file mới: `src/definitions/g10_mystery_box.ts`

```typescript
import type { GameDefinitionDSL } from '../challenge/types';
import { gameDefinitionSchema } from '../challenge/types';

export const g10Definition: GameDefinitionDSL = {
  id: 'g10_mystery_box',
  family: 'mystery_choice',
  name: 'Hộp Quà Bí Ẩn',
  targetDuration: 30.0,
  inputs: {
    countPerRound: 3, // Cần 3 sản phẩm mỗi vòng
    requiredFields: ['productId', 'name', 'price', 'image'],
  },
  rounds: [
    {
      round: 1,
      type: 'confidence_builder',
      targetDifficulty: 0.3,
      timerSeconds: 5.0,
      hookText: 'Chọn nhanh: Hộp quà nào có giá trị cao nhất?',
    },
    {
      round: 2,
      type: 'tension_creator',
      targetDifficulty: 0.6,
      timerSeconds: 5.0,
      hookText: 'Vòng 2: Khoảng cách giá cực sít sao!',
    },
    {
      round: 3,
      type: 'wtf_reveal',
      targetDifficulty: 0.9,
      timerSeconds: 6.0,
      hookText: 'Vòng cuối: Món đồ nhỏ bé này sẽ làm bạn sốc!',
    },
  ],
  presentation: {
    layout: 'all_in_one_comparison',
    actionButtons: ['HỘP A', 'HỘP B', 'HỘP C'],
  },
};

// Đảm bảo DSL hợp lệ với Zod schema ngay khi import
gameDefinitionSchema.parse(g10Definition);
```

---

### Bước 2: Bổ sung Logic Curation trong `src/challenge/ChallengeCurator.ts`

Trong phương thức `curate()` của `ChallengeCurator`, thêm nhánh xử lý cho `dsl.id === 'g10_mystery_box'` để tính toán câu hỏi, danh sách lựa chọn và đáp án đúng:

```typescript
// Trong ChallengeCurator.ts:
else if (dsl.id === 'g10_mystery_box') {
  // Tìm sản phẩm có giá cao nhất trong 3 sản phẩm
  const maxPrice = Math.max(...selectedProducts.map((p) => p.price));
  const winningProduct = selectedProducts.find((p) => p.price === maxPrice)!;

  choices = selectedProducts.map((product, idx) => {
    const boxId = String.fromCharCode(65 + idx); // 'A', 'B', 'C'
    return {
      id: boxId,
      label: `HỘP ${boxId}`,
      isCorrect: product.productId === winningProduct.productId,
      value: product.price,
    };
  });

  const correctChoice = choices.find((c) => c.isCorrect)!;
  correctAnswer = correctChoice.id;
  question = 'HỘP QUÀ NÀO ĐẮT TIỀN NHẤT?';
  revealText = `HỘP ${correctChoice.id} ĐẮT NHẤT: ${winningProduct.name.toUpperCase()} (${NumericEngine.formatVND(winningProduct.price)})!`;
}
```

*Lưu ý quan trọng:* Luôn gán `mechanic: 'mystery_box'` cho mỗi vòng chơi trong `ChallengeCurator` để tầng render nhận diện trực tiếp mà không cần phân tích chuỗi text (stringly-typed).

---

### Bước 3: Định nghĩa Giao diện hiển thị trong `src/render/scenePainter.ts`

Trong hàm `drawMultiRoundProducts()`, bổ sung khối xử lý giao diện cho `round.mechanic === 'mystery_box'`:

```typescript
if (round.mechanic === 'mystery_box') {
  // Ở phase 'play': Vẽ 3 hộp quà đóng kín mang nhãn HỘP A, HỘP B, HỘP C
  // Ở phase 'reveal': Mở nắp hộp quà và vẽ ảnh sản phẩm thật cùng giá tiền thực tế
  const cardWidth = 300;
  const cardHeight = 420;
  const startX = 60;
  const gap = 30;

  round.products.forEach((product, i) => {
    const cardX = startX + i * (cardWidth + gap);
    const cardY = 560;

    if (phase === 'play') {
      // Vẽ hộp quà bí ẩn với dấu hỏi màu neon
      drawMysteryBoxGraphic(canvas, cardX, cardY, cardWidth, cardHeight, `HỘP ${String.fromCharCode(65 + i)}`);
    } else {
      // Vẽ sản phẩm thật đã được nạp qua RenderAssetCache
      const img = assetCache?.getImage(product.image, rootDir);
      drawRevealedProductCard(canvas, cardX, cardY, cardWidth, cardHeight, product, img);
    }
  });
}
```

---

### Bước 4: Đăng ký Alias Mechanic trong `src/cli/render.ts`

Trong file `src/cli/render.ts`, thêm `mystery_box` vào danh sách `KNOWN_MECHANICS` và ánh xạ tên gọi:

```typescript
const MECHANIC_DEFINITIONS: Record<string, GameDefinitionDSL> = {
  // ... các mechanics hiện có
  mystery_box: g10Definition,
  g10_mystery_box: g10Definition,
};
```

---

### Bước 5: Viết Unit Tests Kiểm định

Tạo test case mới trong `test/challenge/all-mechanics-curator.test.ts`:

```typescript
it('curates mystery_box correctly with 3 choices and correct winning product', () => {
  const curator = new ChallengeCurator();
  const challenge = curator.curate(g10Definition, mockCatalog, 12345);

  expect(challenge.rounds).toHaveLength(3);
  challenge.rounds.forEach((round) => {
    expect(round.mechanic).toBe('mystery_box');
    expect(round.choices).toHaveLength(3);
    const correctChoices = round.choices.filter((c) => c.isCorrect);
    expect(correctChoices).toHaveLength(1);
  });
});
```

Chạy kiểm tra:
```bash
npx vitest run test/challenge/all-mechanics-curator.test.ts
npm run verify
```

---

## 2. Thêm Sản Phẩm Mới vào Kho Dữ liệu (`products/`)

Mỗi sản phẩm là một file JSON độc lập được lưu trữ trong thư mục `products/` (ví dụ: `products/p051.json`):

```json
{
  "productId": "p051",
  "name": "Nồi chiên không dầu Philips HD9200 4.1L",
  "image": "assets/images/p051.png",
  "price": 1490000,
  "originalPrice": 2290000,
  "currency": "VND",
  "source": "shopee",
  "updatedAt": "2026-09-16T00:00:00Z",
  "category": "gia dụng",
  "brand": "Philips",
  "affiliate_link": "https://shope.ee/p051_deal",
  "sizeCategory": "medium",
  "perceivedValue": "mid_range",
  "discountPercent": 34.9
}
```

### Quy chuẩn Ảnh Sản phẩm (`image`):
- **Định dạng**: PNG bắt buộc (hỗ trợ nền trong suốt hoặc nền trắng sạch).
- **Độ phân giải chuẩn**: `512 × 512` px hoặc `720 × 720` px.
- **Tỉ lệ**: Vuông 1:1, sản phẩm được căn chính giữa khung hình, chừa lề (padding) tối thiểu 8% để không bị cắt xén khi vẽ card.
- **Đường dẫn**: Đặt file ảnh tại `assets/images/p051.png`.

---

## 3. Tùy biến Giọng đọc AI & Âm thanh (Audio Customization)

### 3.1. Đổi Giọng đọc Microsoft Azure Neural
Trong file `src/audio/EdgeTtsEngine.ts`, bạn có thể chỉ định các profile giọng đọc tiếng Việt:

```typescript
const VIETNAMESE_VOICES = {
  male_north: 'vi-VN-NamMinhNeural',     // Nam miền Bắc: Mạnh mẽ, dứt khoát
  female_north: 'vi-VN-HoaiMyNeural',   // Nữ miền Bắc: Tươi vui, truyền cảm
};
```

Tùy chỉnh tốc độ và cao độ khi khởi tạo:
```typescript
const tts = new EdgeTtsEngine({
  voice: 'vi-VN-NamMinhNeural',
  rate: '+10%',   // Nói nhanh hơn 10% để tạo độ giật gân, khẩn trương
  pitch: '+0Hz',
  volume: '+5%',
});
```

### 3.2. Thay đổi Nhạc nền (BGM) & SFX
Hệ thống sử dụng các file âm thanh chuẩn WAV PCM Mono/Stereo 44.1kHz:
- **Nhạc nền căng thẳng (Tension BGM)**: Đặt file `tension_02.wav` vào `assets/audio/music/`.
- **Tiếng đếm ngược (Tick SFX)**: Thay thế `assets/audio/sfx/tick.wav`.
- **Tiếng lật mở kết quả (Reveal SFX)**: Thay thế `assets/audio/sfx/reveal.wav`.

---

## 4. Tùy biến Giao diện & Bảng Màu (UI Theming)

Hệ thống giao diện được kiến trúc tập trung, tách biệt hoàn toàn giữa logic kịch bản và phong cách hiển thị, định vị tại:
- `src/core/theme/types.ts`: Định nghĩa interface `VisualTheme`, `ThemeColors`, `ThemeTypography`, `ThemeGeometry`.
- `src/core/theme/themes.ts`: Danh mục `BUILTIN_THEMES` và hàm tiện ích `getTheme()`, `resolveTheme()`.

Mặc định, hệ thống kích hoạt theme **`hay_chon_gia_dung`** (Sân Khấu Hãy Chọn Giá Đúng).

---

### 4.1. Hợp đồng Thiết kế cho Tệp Khán giả Nội trợ & Gameshow

Khác với phong cách dark theme / cyberpunk dễ gây mỏi mắt trên thiết bị di động, bộ 5 UI Templates mới tuân thủ nghiêm ngặt **Homemaker High-Contrast Contract**:

1. **Card sản phẩm nền trắng tuyệt đối (`cardBackground: '#ffffff'`)**:
   - Đảm bảo ảnh sản phẩm (PNG) hiển thị trung thực màu sắc gốc, không bị ám sắc tố từ nền video.
   - Đổ bóng mềm sâu (`cardShadow: '0 20px 35px rgba(...)'`) tạo chiều sâu thị giác nổi khối 3D.
2. **Độ tương phản chữ tối đa (`textPrimary: '#0f172a'` hoặc `'#1c1917'`)**:
   - Tên sản phẩm, giá tiền và thông tin khuyến mãi sử dụng màu đen than/xanh đen đậm, font chữ to đậm, giúp các bà nội trợ và người lớn tuổi đọc lướt dễ dàng trong 3–5 giây đếm ngược.
3. **Bo góc mềm mại & Viền rực rỡ (`geometry`)**:
   - `cardBorderRadius`: `24px` đến `32px` tạo cảm giác thân thiện, hiện đại.
   - `cardBorderWidth`: `3px` đến `4px` với viền màu nổi bật (vàng kim, đỏ, cam, xanh ngọc).

---

### 4.2. Danh mục 5 UI Templates Sáng & Trực quan

| Mã Theme (`id`) | Tên Giao diện | Nền Gradient | Viền & Điểm nhấn | Đặc trưng Thị giác |
| :--- | :--- | :--- | :--- | :--- |
| **`hay_chon_gia_dung`** *(Mặc định)* | Sân Khấu Hãy Chọn Giá Đúng | Xanh dương hoàng gia `['#1e3a8a', '#2563eb']` | Viền vàng kim `#fbbf24`, Countdown `#f59e0b` | Hiệu ứng đèn sân khấu spotlight, phong cách đài truyền hình VTV3. |
| **`sieu_thi_gia_dinh`** | Bách Hóa & Siêu Thị Gia Đình | Xanh lá tươi mát `['#15803d', '#22c55e']` | Viền đỏ nổi `#ef4444`, Accent vàng chanh `#facc15` | Cảm giác quầy kệ siêu thị, tươi sạch, tiêu dùng thiết yếu. |
| **`bep_am_noi_tro`** | Gian Bếp Ấm Cúng & Nội Trợ | Cam kem pastel `['#fff7ed', '#fed7aa']` | Viền cam ấm `#ea580c`, Chữ `#1c1917`, Bo góc `32px` | Nền sáng ấm cúng, cực kỳ gần gũi với đồ gia dụng, nấu nướng. |
| **`gio_vang_san_deal`** | Đại Hội Giờ Vàng Săn Deal | Đỏ cam rực lửa `['#dc2626', '#ea580c']` | Viền vàng cam `#f59e0b`, Glow `16px`, Spotlight | Giục giã, kích thích cảm xúc sợ bỏ lỡ cơ hội (FOMO) săn sale. |
| **`tap_hoa_vui_ve`** | Tiệm Tạp Hóa Bình Dân | Vàng chanh tươi `['#fef08a', '#facc15']` | Viền xanh teal `#0f766e`, Accent `#0f766e` | Vui vẻ, gần gũi như tiệm tạp hóa đầu ngõ khu phố. |

*(Ngoài ra hệ thống vẫn duy trì 4 theme phong cách khác: `tv_game_show`, `clean_shopping`, `cyber_arcade`, `street_quiz`)*

---

### 4.3. Cấu trúc Dữ liệu `VisualTheme`

```typescript
export interface VisualTheme {
  id: VisualThemeId;
  name: string;
  colors: {
    backgroundGradient: [string, string]; // Gradient nền video 9:16
    stageOverlay?: 'grid' | 'spotlight' | 'scanline' | 'none';
    cardBackground: string;               // Khuyến nghị: '#ffffff'
    cardBorder: string;                   // Màu viền thẻ sản phẩm
    cardShadow: string;                   // Chuỗi CSS box-shadow
    accent: string;                       // Màu nhấn chính (Huy hiệu, Button)
    textPrimary: string;                  // Màu chữ chính (Tên sản phẩm, giá)
    textSecondary: string;                // Màu chữ phụ (Mô tả, ghi chú)
    countdownRing: string;                // Màu vòng tròn/thanh đếm ngược
    revealBannerSuccess: string;          // Màu banner chúc mừng khi đúng
    revealBannerWarning: string;          // Màu banner cảnh báo khi sai
  };
  typography: {
    fontFamilyHeadline: string;           // Font tiêu đề câu hỏi (Be Vietnam Pro / Inter)
    fontFamilyBody: string;               // Font nội dung (Inter)
    fontFamilyPrice: string;              // Font số tiền (Montserrat / Inter)
    textTransformHeadline: 'uppercase' | 'none';
  };
  geometry: {
    cardBorderRadius: number;             // Bo góc thẻ (px)
    cardBorderWidth: number;              // Độ dày viền thẻ (px)
    glowIntensity: number;                // Cường độ phát sáng neon (0 - 20)
  };
  assets: {
    bgmTrack: string;                     // Đường dẫn nhạc nền mặc định
    correctSfx: string;                   // Âm thanh khi trả lời đúng
    wrongSfx: string;                     // Âm thanh khi trả lời sai
    countdownSfx: string;                 // Âm thanh đếm ngược
  };
}
```

---

### 4.4. Hướng dẫn Thêm một Theme Mới

Giả sử bạn muốn tạo theme **`cho_tet_que` (Chợ Tết Quê Hương)**:

#### Bước 1: Mở rộng Type trong `src/core/theme/types.ts`
```typescript
export type VisualThemeId =
  | 'tv_game_show'
  | 'clean_shopping'
  | 'cyber_arcade'
  | 'street_quiz'
  | 'hay_chon_gia_dung'
  | 'sieu_thi_gia_dinh'
  | 'bep_am_noi_tro'
  | 'gio_vang_san_deal'
  | 'tap_hoa_vui_ve'
  | 'cho_tet_que'; // <-- Thêm ID mới
```

#### Bước 2: Đăng ký Theme vào `BUILTIN_THEMES` trong `src/core/theme/themes.ts`
```typescript
export const BUILTIN_THEMES: Record<string, VisualTheme> = {
  // ... các theme hiện tại
  cho_tet_que: {
    id: 'cho_tet_que',
    name: 'Chợ Tết Quê Hương',
    colors: {
      backgroundGradient: ['#b91c1c', '#7f1d1d'],
      stageOverlay: 'spotlight',
      cardBackground: '#ffffff',
      cardBorder: '#f59e0b',
      cardShadow: '0 20px 35px rgba(185, 28, 28, 0.4)',
      accent: '#facc15',
      textPrimary: '#0f172a',
      textSecondary: '#475569',
      countdownRing: '#f59e0b',
      revealBannerSuccess: '#16a34a',
      revealBannerWarning: '#dc2626',
    },
    typography: {
      fontFamilyHeadline: 'Be Vietnam Pro',
      fontFamilyBody: 'Inter',
      fontFamilyPrice: 'Montserrat',
      textTransformHeadline: 'uppercase',
    },
    geometry: {
      cardBorderRadius: 28,
      cardBorderWidth: 4,
      glowIntensity: 12,
    },
    assets: {
      bgmTrack: 'audio/bgm/gameshow_suspense.mp3',
      correctSfx: 'audio/sfx/win_chime.wav',
      wrongSfx: 'audio/sfx/buzzer_wrong.wav',
      countdownSfx: 'audio/sfx/ticking_tension.wav',
    },
  },
};
```

#### Bước 3: Sử dụng Theme
- **Qua dòng lệnh CLI**:
  ```bash
  node bin/game.js render --mode multi --mechanic hi_lo --theme cho_tet_que --rounds 3
  ```
- **Qua TypeScript code**:
  ```typescript
  import { resolveTheme } from '../core/theme';

  // Tự động resolve hoặc fallback an toàn về hay_chon_gia_dung nếu không tìm thấy
  const theme = resolveTheme('cho_tet_que');
  ```

#### Bước 4: Viết Test Kiểm tra
Thêm test case vào `test/core/theme/all-new-themes.test.ts` để đảm bảo theme mới đã đăng ký đầy đủ màu sắc và vượt qua kiểm thử:
```bash
npx vitest run test/core/theme/all-new-themes.test.ts
```

---

## 5. Quy chuẩn Đóng gói & Kiểm tra Chất lượng

Mọi tính năng mới mở rộng phải vượt qua bộ kiểm tra toàn diện trước khi đưa lên nhánh chính:

```bash
# 1. Kiểm tra static type
npm run build

# 2. Kiểm tra linter
npm run lint

# 3. Chạy toàn bộ test suites
npm test

# 4. Chạy xác minh tổng hợp (One-command verify)
npm run verify
```
