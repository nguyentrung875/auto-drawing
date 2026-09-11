// Deterministic generator for the 50 mock SKU files (products/p001..p050.json).
// Re-run with: node scripts/generate-products.mjs
import { writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, 'products');

// [productId, name, category, brand, price]
const CATALOG = [
  ['p001', 'Nước giặt 3.5kg', 'gia dụng', 'OMO', 189000],
  ['p002', 'Robot hút bụi X10', 'gia dụng', 'Xiaomi', 2490000],
  ['p003', 'Nồi chiên không dầu 5L', 'bếp', 'Lock&Lock', 1290000],
  ['p004', 'Máy xay sinh tố đa năng', 'bếp', 'Philips', 890000],
  ['p005', 'Bàn ủi hơi nước cầm tay', 'gia dụng', 'Panasonic', 450000],
  ['p006', 'Tai nghe không dây chống ồn', 'điện tử', 'Sony', 3990000],
  ['p007', 'Đồng hồ thông minh thể thao', 'điện tử', 'Garmin', 6900000],
  ['p008', 'Loa Bluetooth mini', 'điện tử', 'JBL', 990000],
  ['p009', 'Chuột không dây silent', 'điện tử', 'Logitech', 350000],
  ['p010', 'Bàn phím cơ RGB', 'điện tử', 'Corsair', 1890000],
  ['p011', 'Màn hình 27 inch 2K', 'điện tử', 'LG', 6500000],
  ['p012', 'Ổ cứng SSD 1TB', 'điện tử', 'Samsung', 2400000],
  ['p013', 'Sạc dự phòng 20000mAh', 'điện tử', 'Anker', 750000],
  ['p014', 'Cáp sạc nhanh Type-C', 'điện tử', 'Baseus', 150000],
  ['p015', 'Nồi cơm điện 1.8L', 'bếp', 'Cuckoo', 1490000],
  ['p016', 'Ấm siêu tốc 1.7L', 'bếp', 'Toshiba', 420000],
  ['p017', 'Chảo chống dính 28cm', 'bếp', 'Tefal', 560000],
  ['p018', 'Bộ nồi inox 5 món', 'bếp', 'Fivestar', 2890000],
  ['p019', 'Máy pha cà phê mini', 'bếp', 'Delonghi', 4500000],
  ['p020', 'Ly giữ nhiệt 500ml', 'gia dụng', 'LocknLock', 280000],
  ['p021', 'Bàn chải điện', 'sức khỏe', 'Oral-B', 1290000],
  ['p022', 'Máy massage cổ vai', 'sức khỏe', 'Beurer', 1900000],
  ['p023', 'Cân sức khỏe điện tử', 'sức khỏe', 'Omron', 590000],
  ['p024', 'Nhiệt kế hồng ngoại', 'sức khỏe', 'Microlife', 480000],
  ['p025', 'Đồng hồ bấm giờ tập gym', 'thể thao', 'Xiaomi', 320000],
  ['p026', 'Thảm yoga chống trượt', 'thể thao', 'Manduka', 750000],
  ['p027', 'Dây kháng lực 5 mức', 'thể thao', 'Theraband', 180000],
  ['p028', 'Găng tay tập gym', 'thể thao', 'Adidas', 390000],
  ['p029', 'Bóng đá size 5', 'thể thao', 'Nike', 620000],
  ['p030', 'Giày chạy bộ nữ', 'thời trang', 'Onitsuka', 3200000],
  ['p031', 'Áo khoác gió nam', 'thời trang', 'Uniqlo', 890000],
  ['p032', 'Balo chống nước 25L', 'thời trang', 'Herschel', 1750000],
  ['p033', 'Kính râm phân cực', 'thời trang', 'Ray-Ban', 2600000],
  ['p034', 'Đồng hồ đeo tay da', 'thời trang', 'Casio', 1450000],
  ['p035', 'Túi xách nữ mini', 'thời trang', 'Coach', 5500000],
  ['p036', 'Mũ lưỡi trai basic', 'thời trang', 'MLB', 480000],
  ['p037', 'Sữa tắm hương hoa', 'sắc đẹp', 'Dove', 160000],
  ['p038', 'Serum dưỡng ẩm 30ml', 'sắc đẹp', 'The Ordinary', 420000],
  ['p039', 'Son dưỡng có màu', 'sắc đẹp', 'Dior', 950000],
  ['p040', 'Nước hoa unisex 50ml', 'sắc đẹp', 'Jo Malone', 3900000],
  ['p041', 'Bỉm trẻ em size M (60 miếng)', 'mẹ & bé', 'Bobby', 330000],
  ['p042', 'Sữa bột trẻ em 900g', 'mẹ & bé', 'Nan', 720000],
  ['p043', 'Xe đẩy trẻ em gấp gọn', 'mẹ & bé', 'Seebaby', 2900000],
  ['p044', 'Ghế ăn dặm trẻ em', 'mẹ & bé', 'Mamago', 1100000],
  ['p045', 'Đồ chơi xếp hình 1000 mảnh', 'đồ chơi', 'LEGO', 1650000],
  ['p046', 'Mô hình xe điều khiển', 'đồ chơi', 'Hot Wheels', 480000],
  ['p047', 'Thú nhồi bông gấu 80cm', 'đồ chơi', 'Gund', 890000],
  ['p048', 'Ghế văn phòng công thái học', 'văn phòng', 'Ergo', 4200000],
  ['p049', 'Đèn bàn học chống cận', 'văn phòng', 'Philips', 540000],
  ['p050', 'Bàn đứng điều chỉnh độ cao', 'văn phòng', 'Flexispot', 6900000],
];

mkdirSync(outDir, { recursive: true });
for (const [productId, name, category, brand, price] of CATALOG) {
  const product = {
    productId,
    name,
    image: `assets/${productId}.webp`,
    price,
    currency: 'VND',
    source: 'mock',
    updatedAt: '2026-09-11T00:00:00Z',
    category,
    brand,
    affiliate_link: `https://shopee.vn/${productId}?aff=123`,
  };
  writeFileSync(
    path.join(outDir, `${productId}.json`),
    JSON.stringify(product, null, 2) + '\n',
    'utf8',
  );
}
console.log(`Wrote ${CATALOG.length} product files to ${outDir}`);
