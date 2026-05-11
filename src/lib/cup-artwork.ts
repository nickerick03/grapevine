const MAX_SVG_LENGTH = 200_000;

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

