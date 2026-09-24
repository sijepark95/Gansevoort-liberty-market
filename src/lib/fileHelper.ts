/**
 * Helper utilities for optimizing, reading, and downloading invoice documents and receipts.
 */

export interface ProcessedFile {
  dataUrl: string;
  mimeType: string;
  size: number;
  fileName: string;
}

/**
 * Reads a File object and processes it for cloud storage.
 * Compresses images automatically to preserve sharp visual readability
 * while keeping base64 payload under 150-250KB for fast, reliable Firestore storage.
 */
export async function processInvoiceFile(file: File): Promise<ProcessedFile> {
  const isImage = file.type.startsWith("image/") || /\.(jpg|jpeg|png|webp|gif)$/i.test(file.name);
  
  if (isImage) {
    try {
      const compressedDataUrl = await compressImage(file, 1400, 0.78);
      // Calculate approximate byte size from data URL
      const base64Part = compressedDataUrl.split(",")[1] || "";
      const approxBytes = Math.round((base64Part.length * 3) / 4);
      return {
        dataUrl: compressedDataUrl,
        mimeType: "image/jpeg",
        size: approxBytes,
        fileName: file.name
      };
    } catch (e) {
      console.warn("Failed to compress image, falling back to standard read", e);
    }
  }

  // For PDFs, text, or fallback
  const rawDataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });

  return {
    dataUrl: rawDataUrl,
    mimeType: file.type || "application/octet-stream",
    size: file.size,
    fileName: file.name
  };
}

/**
 * Resizes and compresses an image file using an HTML5 canvas.
 */
function compressImage(file: File, maxDimension = 1400, quality = 0.78): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (readerEvent) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Unable to obtain 2D canvas context"));
          return;
        }

        // Draw white background in case source has transparency
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, width, height);

        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL("image/jpeg", quality);
        resolve(dataUrl);
      };
      img.onerror = () => reject(new Error("Failed to load image element for compression"));
      img.src = readerEvent.target?.result as string;
    };
    reader.onerror = () => reject(new Error("Failed to read image file"));
    reader.readAsDataURL(file);
  });
}

/**
 * Triggers a browser download for a base64 Data URL or remote URL.
 */
export function downloadFile(url: string, filename: string) {
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Formats byte size into human readable string.
 */
export function formatFileSize(bytes?: number): string {
  if (!bytes || bytes <= 0) return "0 KB";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/**
 * Checks if a mime type or filename represents an image.
 */
export function isImageFile(mimeType?: string, fileName?: string): boolean {
  if (mimeType && mimeType.startsWith("image/")) return true;
  if (fileName && /\.(jpg|jpeg|png|webp|gif|bmp|svg)$/i.test(fileName)) return true;
  return false;
}

/**
 * Checks if a mime type or filename represents a PDF.
 */
export function isPdfFile(mimeType?: string, fileName?: string): boolean {
  if (mimeType === "application/pdf") return true;
  if (fileName && /\.pdf$/i.test(fileName)) return true;
  return false;
}

/**
 * Creates a clean, vector SVG invoice preview data URL for demo or preview purposes.
 */
export function createDemoInvoiceSvg(vendor: string, invoiceNumber: string, date: string, items: Array<{ name: string; quantity: number; totalPrice: number }>): string {
  const total = items.reduce((acc, i) => acc + (i.totalPrice || 0), 0);
  const rows = items.slice(0, 6).map((item, idx) => `
    <g transform="translate(40, ${280 + idx * 36})">
      <text x="10" y="20" font-family="system-ui, -apple-system, sans-serif" font-size="13" font-weight="500" fill="#1e293b">${item.name.replace(/&/g, '&amp;')}</text>
      <text x="360" y="20" font-family="monospace" font-size="13" fill="#475569" text-anchor="middle">${item.quantity} case</text>
      <text x="500" y="20" font-family="monospace" font-size="13" font-weight="600" fill="#0f172a" text-anchor="end">$${item.totalPrice.toFixed(2)}</text>
      <line x1="0" y1="32" x2="520" y2="32" stroke="#f1f5f9" stroke-width="1"/>
    </g>
  `).join("");

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="780" viewBox="0 0 600 780" fill="#ffffff">
    <rect width="600" height="780" fill="#ffffff" stroke="#e2e8f0" stroke-width="2" rx="12"/>
    <rect x="30" y="30" width="540" height="90" rx="10" fill="#ecfdf5" stroke="#a7f3d0"/>
    <text x="55" y="70" font-family="system-ui, -apple-system, sans-serif" font-size="22" font-weight="800" fill="#065f46">${vendor.replace(/&/g, '&amp;')}</text>
    <text x="55" y="96" font-family="system-ui, -apple-system, sans-serif" font-size="12" font-weight="600" fill="#059669" letter-spacing="0.5">AUTHENTIC VENDOR INVOICE &amp; DELIVERY RECEIPT</text>
    <text x="545" y="66" font-family="monospace" font-size="13" font-weight="700" fill="#1e293b" text-anchor="end">INV #${invoiceNumber}</text>
    <text x="545" y="90" font-family="system-ui, -apple-system, sans-serif" font-size="12" fill="#64748b" text-anchor="end">${date}</text>
    
    <rect x="40" y="145" width="520" height="75" rx="8" fill="#f8fafc" stroke="#e2e8f0"/>
    <text x="55" y="170" font-family="system-ui, -apple-system, sans-serif" font-size="11" font-weight="700" fill="#64748b" text-transform="uppercase">Billed Account</text>
    <text x="55" y="195" font-family="system-ui, -apple-system, sans-serif" font-size="13" font-weight="600" fill="#1e293b">Commercial Kitchen Receiving Desk</text>
    <text x="360" y="170" font-family="system-ui, -apple-system, sans-serif" font-size="11" font-weight="700" fill="#64748b" text-transform="uppercase">Fulfillment Status</text>
    <text x="360" y="195" font-family="system-ui, -apple-system, sans-serif" font-size="13" font-weight="600" fill="#059669">✓ Received &amp; Inspected</text>

    <!-- Table Header -->
    <rect x="40" y="240" width="520" height="34" rx="6" fill="#f1f5f9"/>
    <text x="50" y="262" font-family="system-ui, -apple-system, sans-serif" font-size="11" font-weight="700" fill="#475569" letter-spacing="0.5">LINE ITEM DESCRIPTION</text>
    <text x="360" y="262" font-family="system-ui, -apple-system, sans-serif" font-size="11" font-weight="700" fill="#475569" text-anchor="middle" letter-spacing="0.5">QUANTITY</text>
    <text x="540" y="262" font-family="system-ui, -apple-system, sans-serif" font-size="11" font-weight="700" fill="#475569" text-anchor="end" letter-spacing="0.5">EXTENDED AMOUNT</text>

    <!-- Rows -->
    ${rows}

    <!-- Summary Box -->
    <rect x="340" y="530" width="220" height="85" rx="8" fill="#f8fafc" stroke="#e2e8f0"/>
    <text x="355" y="560" font-family="system-ui, -apple-system, sans-serif" font-size="12" fill="#64748b">Subtotal</text>
    <text x="545" y="560" font-family="monospace" font-size="12" fill="#334155" text-anchor="end">$${total.toFixed(2)}</text>
    <line x1="355" y1="575" x2="545" y2="575" stroke="#e2e8f0" stroke-width="1"/>
    <text x="355" y="600" font-family="system-ui, -apple-system, sans-serif" font-size="13" font-weight="800" fill="#0f172a">Total Due</text>
    <text x="545" y="600" font-family="monospace" font-size="14" font-weight="800" fill="#059669" text-anchor="end">$${total.toFixed(2)}</text>

    <!-- Footer Stamp -->
    <rect x="40" y="650" width="520" height="80" rx="8" fill="#ecfdf5" stroke="#a7f3d0"/>
    <text x="60" y="680" font-family="system-ui, -apple-system, sans-serif" font-size="12" font-weight="700" fill="#065f46">Archived Invoice Document (Document ID: ${invoiceNumber})</text>
    <text x="60" y="705" font-family="system-ui, -apple-system, sans-serif" font-size="11" fill="#047857">Parsed and matched against inventory master database. Preserved for culinary audits.</text>
  </svg>`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

