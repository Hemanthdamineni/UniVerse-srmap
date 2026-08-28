import { useEffect, useState } from "react";

// Canvas auto-crop: trim right-side whitespace from the ERP captcha bitmap so
// the image chip hugs the characters instead of reserving a wide blank area.
// Falls back to the raw source whenever the canvas path is unavailable.
export function useAutoCroppedCaptcha(captchaBase64: string) {
  const [displaySrc, setDisplaySrc] = useState("");

  useEffect(() => {
    if (!captchaBase64) { setDisplaySrc(""); return; }
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) { setDisplaySrc(captchaBase64); return; }
      ctx.drawImage(img, 0, 0);
      const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
      // scan right-to-left to find last column with non-background content
      let rightBound = img.width;
      outer: for (let x = img.width - 1; x >= Math.floor(img.width * 0.25); x--) {
        for (let y = 0; y < img.height; y++) {
          const i = (y * img.width + x) * 4;
          const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
          if (a > 30 && (r < 230 || g < 230 || b < 230)) {
            rightBound = x + 14; // 14px right padding
            break outer;
          }
        }
      }
      rightBound = Math.min(rightBound, img.width);
      const cropped = document.createElement("canvas");
      cropped.width = rightBound;
      cropped.height = img.height;
      const ctx2 = cropped.getContext("2d");
      if (!ctx2) { setDisplaySrc(captchaBase64); return; }
      ctx2.drawImage(img, 0, 0);
      setDisplaySrc(cropped.toDataURL());
    };
    img.onerror = () => setDisplaySrc(captchaBase64);
    img.src = captchaBase64;
  }, [captchaBase64]);

  return displaySrc;
}
