/**
 * Direct-to-storage invoice upload.
 *
 * Matches the integration Abhay (AI/OCR) provided: files are PUT straight into
 * the OCI Object Storage bucket via a Pre-Authenticated Request (PAR) URL. Once
 * a file lands in the bucket, the OCR pipeline picks it up and processes it —
 * the frontend's only job is to upload the raw document.
 *
 * NOTE: a PAR URL embeds a pre-authorised token and expires. It's read from
 * `NEXT_PUBLIC_OCI_PAR_URL` so it can be rotated without a code change; the value below
 * is only a dev fallback. For production, uploads should ideally go through a
 * backend ingestion endpoint so the storage credential isn't exposed in the
 * browser bundle.
 */
const PAR_URL =
  process.env.NEXT_PUBLIC_OCI_PAR_URL ??
  'https://objectstorage.me-riyadh-1.oraclecloud.com/p/w5nk6CfntcPt3SWhfxwNk1i-Cwh0RZsRzl09EWnFUyX0OOo4Q_dYN-zRlK6u5Go7/n/bmuyboptp83n/b/netlink-poc-storage/o/';

/** Accepted invoice document types (PRD ING-01: PDF, JPG, PNG, TIF). */
export const ACCEPTED_UPLOAD_EXTENSIONS = [
  '.pdf',
  '.jpg',
  '.jpeg',
  '.png',
  '.tif',
  '.tiff',
] as const;

export const ACCEPTED_UPLOAD_ACCEPT_ATTR =
  '.pdf,.jpg,.jpeg,.png,.tif,.tiff,application/pdf,image/jpeg,image/png,image/tiff';

/** Max document size — 10 MB (PRD ING-01). */
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

/** Returns an error message if the file is invalid, or null if it's acceptable. */
export function validateInvoiceFile(file: File): string | null {
  const name = file.name.toLowerCase();
  const okType = ACCEPTED_UPLOAD_EXTENSIONS.some((ext) => name.endsWith(ext));
  if (!okType) {
    return 'Unsupported type — use PDF, JPG, PNG, or TIF.';
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return 'Too large — the limit is 10 MB.';
  }
  if (file.size === 0) {
    return 'File is empty.';
  }
  return null;
}

/**
 * Uploads a single document to object storage. Resolves on success, throws with
 * a readable message on failure.
 */
export async function uploadInvoiceFile(file: File): Promise<void> {
  const url = PAR_URL + encodeURIComponent(file.name);
  let res: Response;
  try {
    res = await fetch(url, {
      method: 'PUT',
      headers: { 'Content-Type': file.type || 'application/octet-stream' },
      body: file,
    });
  } catch {
    // A network/CORS failure surfaces here (no HTTP status available).
    throw new Error(
      'Network/CORS error — the storage bucket may not allow uploads from this site.',
    );
  }
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(detail.trim() || `Upload failed (HTTP ${res.status}).`);
  }
}
