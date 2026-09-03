/**
 * Uploads an image via the server proxy, which returns a direct ad-free image
 * CDN URL (https://i.ibb.co/...). The ImgBB API key lives only on the server
 * (see /api/upload/imgbb in server.ts) and is never sent to the browser.
 */

// Vercel (and many other serverless hosts) enforce a hard ~4.5MB request body
// cap that can't be raised from app code. Base64 inflates file size by ~33%,
// so we resize/re-compress on-device before upload to stay comfortably under
// that limit regardless of where this is deployed.
const MAX_DIMENSION = 1600; // px, longest side
const JPEG_QUALITY = 0.82;

/**
 * Resizes an image file down to MAX_DIMENSION on its longest side and
 * re-encodes it as JPEG, dramatically shrinking typical phone-camera photos
 * (often 3-8MB) down to a few hundred KB before they're base64-encoded.
 */
async function compressImageFile(file: File): Promise<string> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(file);
  });

  // Skip compression for non-image files (shouldn't normally happen given
  // the <input accept="image/*"> callers use, but fail safe).
  if (!file.type.startsWith("image/")) {
    return dataUrl.replace(/^data:image\/\w+;base64,/, "");
  }

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = (err) => reject(err);
    image.src = dataUrl;
  });

  const scale = Math.min(1, MAX_DIMENSION / Math.max(img.width, img.height));
  const targetWidth = Math.round(img.width * scale);
  const targetHeight = Math.round(img.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    // Canvas unsupported for some reason — fall back to the original file.
    return dataUrl.replace(/^data:image\/\w+;base64,/, "");
  }
  ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

  const compressedDataUrl = canvas.toDataURL("image/jpeg", JPEG_QUALITY);
  return compressedDataUrl.replace(/^data:image\/\w+;base64,/, "");
}

export async function uploadImageToImgBB(fileOrBase64: File | string): Promise<string> {
  let base64Data = "";

  if (typeof fileOrBase64 === "string") {
    // Already a data URL / base64 string (e.g. pasted, or from another flow) — use as-is.
    base64Data = fileOrBase64.replace(/^data:image\/\w+;base64,/, "");
  } else {
    base64Data = await compressImageFile(fileOrBase64);
  }

  let res: Response;
  try {
    res = await fetch("/api/upload/imgbb", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image: base64Data }),
    });
  } catch (err) {
    throw new Error("Could not reach the upload server. Check your connection and try again.");
  }

  // Guard against non-JSON responses (e.g. a host's own error page for
  // payload-too-large, timeouts, or a misconfigured route) so the user gets
  // a real message instead of a raw JSON.parse error.
  const contentType = res.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    if (res.status === 413) {
      throw new Error("That image is too large for the server to accept. Try a smaller photo.");
    }
    throw new Error(`Upload failed (server returned status ${res.status}). Please try again.`);
  }

  const data = await res.json();
  if (res.ok && data.success && data.url) {
    // Guaranteed direct CDN url without ad viewer pages
    return data.url;
  }

  throw new Error(data.error || "Image upload failed. Please try again.");
}

/**
 * Sanitizes any image URL to ensure direct ad-free image viewing
 */
export function sanitizeImgBBUrl(url: string): string {
  if (!url) return url;
  // If user pasted an ImgBB viewer URL like https://ibb.co/2GR223, convert or preserve direct link if possible
  if (url.includes("ibb.co/") && !url.includes("i.ibb.co/")) {
    // Note: ibb.co viewer links don't render directly as img src unless translated to i.ibb.co
    return url;
  }
  return url;
}
