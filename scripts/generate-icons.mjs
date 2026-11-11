// Sinh toàn bộ icon / màn hình khởi động / favicon từ một file gốc: assets/brand/mark.svg
// Chạy: npm run icons   (sau khi sửa mark.svg)
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const root = path.resolve(import.meta.dirname, '..');
const out = (p) => path.join(root, p);

const GREEN_FROM = '#2E9A5E';
const GREEN_TO = '#4DBA7E';
const GREEN_TEXT = '#1F7A45';

// Lấy phần vẽ bên trong mark.svg (bỏ thẻ <svg> ngoài và chú thích)
const raw = fs.readFileSync(out('assets/brand/mark.svg'), 'utf8').replace(/<!--[\s\S]*?-->/g, '');
const inner = raw.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');

const gradient = `<linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${GREEN_FROM}"/><stop offset="1" stop-color="${GREEN_TO}"/></linearGradient>`;

/** Ghép SVG: nền (tuỳ chọn) + biểu tượng thu phóng quanh tâm */
function compose({ background = 'none', radius = 0, scale = 1, color = '#fff' }) {
  const mark = inner.replace(/fill="#fff"/g, `fill="${color}"`).replace('<rect width="1024" height="1024" fill="' + color + '"/>', '<rect width="1024" height="1024" fill="#fff"/>');
  const bg =
    background === 'gradient'
      ? `<rect width="1024" height="1024" rx="${radius}" fill="url(#bg)"/>`
      : background === 'none'
        ? ''
        : `<rect width="1024" height="1024" rx="${radius}" fill="${background}"/>`;
  const t = (1 - scale) * 512;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024"><defs>${gradient}</defs>${bg}<g transform="translate(${t} ${t}) scale(${scale})">${mark}</g></svg>`;
}

async function png(svg, file, size = 1024) {
  await sharp(Buffer.from(svg)).resize(size, size).png().toFile(out(file));
  console.log('  ✓', file, `${size}px`);
}

console.log('Sinh icon từ assets/brand/mark.svg');

// App mobile
await png(compose({ background: 'gradient', scale: 0.92 }), 'apps/mobile/assets/images/icon.png');
// Android adaptive: nền + hình (thu nhỏ vào vùng an toàn 66%) + bản đơn sắc (Android 13 "themed icons")
await png(compose({ background: 'gradient' }).replace(/<g[\s\S]*<\/g>/, ''), 'apps/mobile/assets/images/android-icon-background.png');
await png(compose({ scale: 0.64 }), 'apps/mobile/assets/images/android-icon-foreground.png');
await png(compose({ scale: 0.64 }), 'apps/mobile/assets/images/android-icon-monochrome.png');
// Màn hình khởi động: biểu tượng trắng trên nền xanh (màu nền đặt trong app.json)
await png(compose({}), 'apps/mobile/assets/images/splash-icon.png');
// Logo dùng trong app (màu xanh, trên nền trắng)
await png(compose({ color: GREEN_TEXT }), 'apps/mobile/assets/images/logo-mark.png', 512);
// Favicon bản web của app
await png(compose({ background: 'gradient', radius: 224, scale: 0.9 }), 'apps/mobile/assets/images/favicon.png', 96);

// Trang admin
fs.writeFileSync(out('apps/admin/public/favicon.svg'), compose({ background: 'gradient', radius: 224, scale: 0.9 }));
console.log('  ✓ apps/admin/public/favicon.svg');
await png(compose({ background: 'gradient', radius: 224, scale: 0.9 }), 'apps/admin/public/apple-touch-icon.png', 180);
fs.writeFileSync(out('apps/admin/src/assets-logo.svg'), compose({ color: GREEN_TEXT }));
console.log('  ✓ apps/admin/src/assets-logo.svg');

// Bản xem trước cho README / tài liệu
await png(compose({ background: 'gradient', radius: 224, scale: 0.92 }), 'assets/brand/icon-preview.png', 512);
console.log('Xong.');
