/** Local Face API is used for camera guidance only. The server verifies enrollment. */
export interface FaceObservation {
  detection: { score: number; box: { x: number; y: number; width: number; height: number } };
  landmarks: { positions: { x: number; y: number }[] };
}
interface FaceApi {
  nets: { tinyFaceDetector: { loadFromUri: (url: string) => Promise<void> }; faceLandmark68TinyNet: { loadFromUri: (url: string) => Promise<void> } };
  TinyFaceDetectorOptions: new (options: { inputSize: number; scoreThreshold: number }) => unknown;
  detectAllFaces: (video: HTMLVideoElement | HTMLCanvasElement, options: unknown) => { withFaceLandmarks: (tiny: boolean) => Promise<FaceObservation[]> };
}
declare global { interface Window { faceapi?: FaceApi } }
let loaded: Promise<FaceApi> | undefined;
export function loadFaceGuidance(): Promise<FaceApi> {
  if (!loaded) loaded = (async () => {
    if (!window.faceapi) await new Promise<void>((resolve, reject) => {
      const script = document.createElement('script'); script.src = '/vendor/face-api/face-api.js'; script.async = true;
      const timer = setTimeout(() => { script.remove(); reject(new Error('Face models unavailable')); }, 30_000);
      script.onload = () => { clearTimeout(timer); resolve(); };
      script.onerror = () => { clearTimeout(timer); script.remove(); reject(new Error('Face models unavailable')); };
      document.head.appendChild(script);
    });
    const api = window.faceapi;
    if (!api) throw new Error('Face API unavailable');
    await Promise.all([api.nets.tinyFaceDetector.loadFromUri('/vendor/face-api/models'), api.nets.faceLandmark68TinyNet.loadFromUri('/vendor/face-api/models')]);
    return api;
  })().catch(error => { loaded = undefined; throw error; });
  return loaded;
}
export async function observeFace(video: HTMLVideoElement | HTMLCanvasElement): Promise<FaceObservation[]> {
  const api = await loadFaceGuidance();
  // Webcam frames are often softer and darker than enrollment images. A
  // slightly larger input and a lower confidence threshold prevent a visible
  // face from flickering into "no face" while the browser is still focusing.
  return api.detectAllFaces(video, new api.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: .45 })).withFaceLandmarks(true);
}
/** Match the server's frontal-face detector; movement is lateral, not a profile turn. */
export function capturePosition(faces: FaceObservation[], width: number, height: number, origin?: number): ReturnType<typeof facePose> {
  const facing = facePose(faces, width, height);
  if (facing !== 'center') return facing === 'left' || facing === 'right' ? 'position' : facing;
  const box = faces[0].detection.box;
  const center = (box.x + box.width / 2) / width;
  if (origin === undefined) return Math.abs(center - .5) <= .12 ? 'center' : 'position';
  const shift = center - origin;
  // Preview is mirrored: moving to the user's left increases the raw image X.
  if (shift >= .035 && shift <= .10) return 'left';
  if (shift <= -.035 && shift >= -.10) return 'right';
  return Math.abs(shift) < .035 ? 'center' : 'position';
}
export function facePose(faces: FaceObservation[], width: number, height: number): 'center' | 'left' | 'right' | 'none' | 'multiple' | 'position' {
  if (!faces.length) return 'none';
  if (faces.length !== 1) return 'multiple';
  const { detection, landmarks } = faces[0], b = detection.box, p = landmarks.positions;
  if (detection.score < .45 || b.width < width * .18 || b.width > width * .85 || b.x < 0 || b.y < 0 || b.x + b.width > width || b.y + b.height > height || p.length < 68) return 'position';
  const span = Math.abs(p[45].x - p[36].x);
  if (span < 10) return 'position';
  const yaw = (p[30].x - (p[36].x + p[45].x) / 2) / span;
  // A small head turn is enough for enrollment. The previous .20 threshold
  // required an exaggerated pose and made the flow feel stuck on laptops.
  return yaw > .10 ? 'left' : yaw < -.10 ? 'right' : Math.abs(yaw) < .07 ? 'center' : 'position';
}
