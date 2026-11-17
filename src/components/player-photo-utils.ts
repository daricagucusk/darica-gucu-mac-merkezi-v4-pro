// Oyuncu fotoğrafı: yüklemeden önce istemcide küçültme (en fazla 600 px kenar) ve JPEG'e çevirme.
export const MAX_PHOTO_EDGE = 600;
export const PHOTO_LIMIT_BYTES = Math.floor(1.5 * 1024 * 1024);

/** En uzun kenarı max'ı aşmayacak şekilde oranı koruyarak küçültür; küçük görsel büyütülmez. */
export function fitWithin(width: number, height: number, max = MAX_PHOTO_EDGE): { width: number; height: number } {
  if (!(width > 0) || !(height > 0)) return { width: 0, height: 0 };
  const scale = Math.min(1, max / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

const QUALITIES = [0.85, 0.75, 0.65, 0.5];

function toBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
}

/** Dosyayı 600 px sınırına küçültüp JPEG 0.85 (gerekirse daha düşük) üretir; 1,5 MB altına iner. */
export async function resizePhotoToJpeg(file: File): Promise<Blob> {
  if (!file.type.startsWith('image/')) throw new Error('Yalnız görsel dosyası seçilebilir.');
  const url = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Seçilen fotoğraf okunamadı.'));
      img.src = url;
    });
    const size = fitWithin(image.naturalWidth, image.naturalHeight);
    if (size.width === 0) throw new Error('Seçilen fotoğraf okunamadı.');
    const canvas = document.createElement('canvas');
    canvas.width = size.width;
    canvas.height = size.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Fotoğraf işlenemedi.');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, size.width, size.height); // saydam PNG'de siyah zemin olmasın
    ctx.drawImage(image, 0, 0, size.width, size.height);
    for (const quality of QUALITIES) {
      const blob = await toBlob(canvas, quality);
      if (blob && blob.size <= PHOTO_LIMIT_BYTES) return blob;
    }
    throw new Error('Fotoğraf 1,5 MB altına indirilemedi.');
  } finally {
    URL.revokeObjectURL(url);
  }
}
