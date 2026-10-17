import type { FaceObservation } from './face-guidance';

/** Same face-region Laplacian variance as the server; no images leave memory. */
export function faceImageSharpness(canvas: HTMLCanvasElement, face: FaceObservation): number {
  const b = face.detection.box;
  const x = Math.max(0, Math.floor(b.x - b.width * .25));
  const y = Math.max(0, Math.floor(b.y - b.height * .25));
  const width = Math.min(canvas.width - x, Math.floor(b.x + b.width * 1.25) - x);
  const height = Math.min(canvas.height - y, Math.floor(b.y + b.height * 1.25) - y);
  const context = canvas.getContext('2d');
  if (!context || width < 3 || height < 3) return 0;
  return laplacianVariance(context.getImageData(x, y, width, height));
}

export function laplacianVariance({ data, width, height }: Pick<ImageData, 'data' | 'width' | 'height'>): number {
  if (width < 3 || height < 3) return 0;
  const gray = new Uint8Array(width * height);
  for (let i = 0; i < gray.length; i++) gray[i] = Math.round(.299 * data[i * 4] + .587 * data[i * 4 + 1] + .114 * data[i * 4 + 2]);
  let sum = 0, squares = 0, count = 0;
  for (let y = 1; y < height - 1; y++) for (let x = 1; x < width - 1; x++) {
    const i = y * width + x;
    const value = gray[i - 1] + gray[i + 1] + gray[i - width] + gray[i + width] - 4 * gray[i];
    sum += value; squares += value * value; count++;
  }
  return count ? squares / count - (sum / count) ** 2 : 0;
}
