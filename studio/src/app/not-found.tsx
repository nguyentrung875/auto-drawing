import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center text-center p-4">
      <div>
        <h1 className="text-4xl font-bold text-white mb-2">404</h1>
        <p className="text-gray-400 mb-4">Trang không tồn tại</p>
        <Link href="/" className="text-indigo-400 hover:underline">
          ← Quay lại trang chủ
        </Link>
      </div>
    </div>
  );
}
