export type ProfileImageKind = "avatar" | "header";

export interface CropAreaPixels {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CompressedImageResult {
  blob: Blob;
  dataUrl: string;
  width: number;
  height: number;
  sizeBytes: number;
  originalSizeBytes: number;
  qualityUsed: number;
}

const MAX_TARGET_BYTES = 200 * 1024; // 200 KB

const IMAGE_CONSTRAINTS: Record<
  ProfileImageKind,
  { maxWidth: number; maxHeight: number; aspectCrop?: number }
> = {
  avatar: {
    maxWidth: 300,
    maxHeight: 300,
    aspectCrop: 1,
  },
  header: {
    maxWidth: 1600,
    maxHeight: 500,
  },
};

function loadImageFromSrc(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () =>
      reject(new Error("Não foi possível ler a imagem selecionada."));
    img.src = src;
  });
}

function loadImageElement(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Não foi possível ler a imagem selecionada."));
    };
    img.src = objectUrl;
  });
}

function canvasToWebpBlob(
  canvas: HTMLCanvasElement,
  quality: number
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(
            new Error(
              "Seu navegador não conseguiu converter a imagem para WebP."
            )
          );
          return;
        }
        resolve(blob);
      },
      "image/webp",
      quality
    );
  });
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
      } else {
        reject(new Error("Falha ao gerar pré-visualização da imagem."));
      }
    };
    reader.onerror = () =>
      reject(new Error("Erro ao ler o arquivo comprimido."));
    reader.readAsDataURL(blob);
  });
}

async function encodeCanvasUnderLimit(
  canvas: HTMLCanvasElement,
  originalSizeBytes: number
): Promise<CompressedImageResult> {
  let targetWidth = canvas.width;
  let targetHeight = canvas.height;

  const qualitySteps = [0.82, 0.74, 0.66, 0.58, 0.48, 0.4];
  let bestBlob: Blob | null = null;
  let qualityUsed = 0.82;

  for (const q of qualitySteps) {
    const candidate = await canvasToWebpBlob(canvas, q);
    bestBlob = candidate;
    qualityUsed = q;
    if (candidate.size <= MAX_TARGET_BYTES) {
      break;
    }
  }

  if (bestBlob && bestBlob.size > MAX_TARGET_BYTES) {
    const smallerCanvas = document.createElement("canvas");
    smallerCanvas.width = Math.max(1, Math.round(targetWidth * 0.8));
    smallerCanvas.height = Math.max(1, Math.round(targetHeight * 0.8));
    const smallerCtx = smallerCanvas.getContext("2d");
    if (smallerCtx) {
      smallerCtx.imageSmoothingEnabled = true;
      smallerCtx.imageSmoothingQuality = "high";
      smallerCtx.drawImage(
        canvas,
        0,
        0,
        smallerCanvas.width,
        smallerCanvas.height
      );
      bestBlob = await canvasToWebpBlob(smallerCanvas, 0.68);
      targetWidth = smallerCanvas.width;
      targetHeight = smallerCanvas.height;
      qualityUsed = 0.68;
    }
  }

  if (!bestBlob) {
    throw new Error("Não foi possível comprimir a imagem.");
  }

  const dataUrl = await blobToDataUrl(bestBlob);

  return {
    blob: bestBlob,
    dataUrl,
    width: targetWidth,
    height: targetHeight,
    sizeBytes: bestBlob.size,
    originalSizeBytes,
    qualityUsed,
  };
}

/**
 * Recorta a área exata selecionada pelo usuário no modal interativo,
 * redimensiona dentro do limite (Avatar 300x300, Header 1600x500) e comprime para WebP (< 200KB).
 */
export async function compressCroppedProfileImage(
  imageSrc: string,
  croppedAreaPixels: CropAreaPixels,
  kind: ProfileImageKind,
  originalSizeBytes = 0
): Promise<CompressedImageResult> {
  const img = await loadImageFromSrc(imageSrc);
  const { maxWidth, maxHeight } = IMAGE_CONSTRAINTS[kind];

  const sx = Math.max(0, Math.round(croppedAreaPixels.x));
  const sy = Math.max(0, Math.round(croppedAreaPixels.y));
  const sw = Math.max(1, Math.round(croppedAreaPixels.width));
  const sh = Math.max(1, Math.round(croppedAreaPixels.height));

  const scale = Math.min(1, maxWidth / sw, maxHeight / sh);
  const targetWidth = Math.max(1, Math.round(sw * scale));
  const targetHeight = Math.max(1, Math.round(sh * scale));

  const canvas = document.createElement("canvas");
  canvas.width = targetWidth;
  canvas.height = targetHeight;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Contexto 2D do Canvas indisponível neste navegador.");
  }

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, targetWidth, targetHeight);

  return encodeCanvasUnderLimit(canvas, originalSizeBytes);
}

/**
 * Compressão direta sem modal (mantida por compatibilidade).
 */
export async function compressProfileImage(
  file: File,
  kind: ProfileImageKind
): Promise<CompressedImageResult> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Selecione um arquivo de imagem válido (JPG, PNG ou WebP).");
  }

  const img = await loadImageElement(file);
  const { maxWidth, maxHeight, aspectCrop } = IMAGE_CONSTRAINTS[kind];

  let sx = 0;
  let sy = 0;
  let sw = img.naturalWidth;
  let sh = img.naturalHeight;
  let targetWidth = sw;
  let targetHeight = sh;

  if (aspectCrop) {
    const side = Math.min(sw, sh);
    sx = Math.floor((sw - side) / 2);
    sy = Math.floor((sh - side) / 2);
    sw = side;
    sh = side;

    const finalSide = Math.min(side, maxWidth, maxHeight);
    targetWidth = finalSide;
    targetHeight = finalSide;
  } else {
    const currentRatio = sw / sh;
    if (currentRatio < 2.4) {
      const desiredHeight = Math.round(sw / 3.2);
      if (desiredHeight < sh) {
        sy = Math.floor((sh - desiredHeight) / 2);
        sh = desiredHeight;
      }
    }

    const scale = Math.min(1, maxWidth / sw, maxHeight / sh);
    targetWidth = Math.max(1, Math.round(sw * scale));
    targetHeight = Math.max(1, Math.round(sh * scale));
  }

  const canvas = document.createElement("canvas");
  canvas.width = targetWidth;
  canvas.height = targetHeight;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Contexto 2D do Canvas indisponível neste navegador.");
  }

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, targetWidth, targetHeight);

  return encodeCanvasUnderLimit(canvas, file.size);
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  return `${(kb / 1024).toFixed(2)} MB`;
}
