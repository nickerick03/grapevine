const MAX_SVG_LENGTH = 200_000;

export const CUP_ARTWORK_ALLOWED_MIME_TYPES = [
  "image/svg+xml",
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/gif",
  "image/avif",
  "image/bmp",
] as const;

export const CUP_ARTWORK_ACCEPT_ATTRIBUTE = CUP_ARTWORK_ALLOWED_MIME_TYPES.join(",");
export const MAX_CUP_ARTWORK_UPLOAD_BYTES = 4 * 1024 * 1024;
export const MAX_CUP_ARTWORK_DATA_URL_CHARS = 6_000_000;
export const MAX_CUP_DESCRIPTION_LENGTH = 800;

const CUP_ARTWORK_DATA_URL_PATTERN = /^data:image\/(svg\+xml|png|jpe?g|webp|gif|avif|bmp);base64,[a-z0-9+/=]+$/i;

const BLOCKED_PATTERNS = [
  /<\s*script/i,
  /on[a-z]+\s*=/i,
  /javascript\s*:/i,
  /<\s*foreignObject/i,
  /data\s*:\s*text\/html/i,
];

export function sanitizeCupSvgMarkup(input: string): string {
  const svg = input.trim();

  if (!svg) {
    throw new Error("Cup SVG is required.");
  }

  if (svg.length > MAX_SVG_LENGTH) {
    throw new Error("Cup SVG is too large.");
  }

  if (!/<\s*svg/i.test(svg)) {
    throw new Error("Cup artwork must be a valid SVG.");
  }

  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(svg)) {
      throw new Error("Cup SVG contains disallowed content.");
    }
  }

  return svg;
}

export function svgMarkupToDataUri(svgMarkup: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgMarkup)}`;
}

export function svgMarkupToBase64DataUri(svgMarkup: string): string {
  const utf8 = new TextEncoder().encode(svgMarkup);
  let binary = "";
  utf8.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  const encoded = btoa(binary);
  return `data:image/svg+xml;base64,${encoded}`;
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      if (!result) {
        reject(new Error("Could not read image file."));
        return;
      }
      resolve(result);
    };
    reader.onerror = () => reject(new Error("Could not read image file."));
    reader.readAsDataURL(file);
  });
}

export function isSvgFile(file: File): boolean {
  const type = file.type.toLowerCase();
  if (type === "image/svg+xml") {
    return true;
  }
  return file.name.toLowerCase().endsWith(".svg");
}

export function validateCupArtworkFile(file: File): string | null {
  if (file.size <= 0) {
    return "Uploaded image is empty.";
  }

  if (file.size > MAX_CUP_ARTWORK_UPLOAD_BYTES) {
    return "Cup artwork is too large. Please upload an image under 4 MB.";
  }

  if (!file.type) {
    return null;
  }

  const normalized = file.type.toLowerCase();
  if (!CUP_ARTWORK_ALLOWED_MIME_TYPES.includes(normalized as (typeof CUP_ARTWORK_ALLOWED_MIME_TYPES)[number])) {
    return "Unsupported file type. Please upload SVG, PNG, JPG, JPEG, WebP, GIF, AVIF, or BMP.";
  }

  return null;
}

export function validateCupArtworkDataUrl(dataUrl: string): string | null {
  const trimmed = dataUrl.trim();
  if (!trimmed) {
    return "Cup artwork is required.";
  }

  if (trimmed.length > MAX_CUP_ARTWORK_DATA_URL_CHARS) {
    return "Cup artwork is too large. Please upload a smaller image.";
  }

  if (!CUP_ARTWORK_DATA_URL_PATTERN.test(trimmed)) {
    return "Cup artwork must be a supported data:image payload.";
  }

  return null;
}

export async function toCupArtworkPayload(file: File): Promise<{ artworkUrl: string; svgMarkup: string | null }> {
  const validationError = validateCupArtworkFile(file);
  if (validationError) {
    throw new Error(validationError);
  }

  if (isSvgFile(file)) {
    const rawSvg = await file.text();
    const sanitized = sanitizeCupSvgMarkup(rawSvg);
    const artworkUrl = svgMarkupToBase64DataUri(sanitized);
    const dataUrlError = validateCupArtworkDataUrl(artworkUrl);
    if (dataUrlError) {
      throw new Error(dataUrlError);
    }
    return { artworkUrl, svgMarkup: sanitized };
  }

  const artworkUrl = await readFileAsDataUrl(file);
  const dataUrlError = validateCupArtworkDataUrl(artworkUrl);
  if (dataUrlError) {
    throw new Error(dataUrlError);
  }
  return { artworkUrl, svgMarkup: null };
}

export function resolveCupArtworkUrl(input: {
  artworkUrl?: string | null;
  svgMarkup?: string | null;
}): string | null {
  const artwork = input.artworkUrl?.trim();
  if (artwork) {
    return artwork;
  }

  const svgMarkup = input.svgMarkup?.trim();
  if (!svgMarkup) {
    return null;
  }

  try {
    return svgMarkupToBase64DataUri(sanitizeCupSvgMarkup(svgMarkup));
  } catch {
    return null;
  }
}
