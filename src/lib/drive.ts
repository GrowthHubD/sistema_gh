/**
 * Google Drive helper using Service Account credentials.
 * Uses Node.js crypto for JWT signing — works in Next.js dev and Cloudflare Workers.
 * Required env vars: GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY, GOOGLE_DRIVE_ROOT_FOLDER_ID
 */

const DRIVE_FILES_API = "https://www.googleapis.com/drive/v3/files";

async function getServiceAccountToken(): Promise<string> {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const rawKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;

  if (!email || !rawKey) {
    throw new Error("Google Drive credentials not configured (GOOGLE_SERVICE_ACCOUNT_EMAIL / GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY)");
  }

  // Normalize key — env vars often have literal \n instead of real newlines
  const privateKey = rawKey.replace(/\\n/g, "\n");

  const now = Math.floor(Date.now() / 1000);

  const headerB64 = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url");
  const payloadB64 = Buffer.from(JSON.stringify({
    iss: email,
    scope: "https://www.googleapis.com/auth/drive.file",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  })).toString("base64url");

  const unsigned = `${headerB64}.${payloadB64}`;

  // Use node:crypto for RSA signing
  const { createSign } = await import("node:crypto");
  const sign = createSign("RSA-SHA256");
  sign.update(unsigned);
  const signature = sign.sign(privateKey, "base64url");

  const jwt = `${unsigned}.${signature}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OAuth token request failed: ${err}`);
  }

  const data = await res.json();
  if (!data.access_token) throw new Error(`No access_token in response: ${JSON.stringify(data)}`);
  return data.access_token as string;
}

export async function uploadFileToDrive(
  fileBuffer: ArrayBuffer,
  fileName: string,
  mimeType: string,
  folderId?: string
): Promise<{ id: string; webViewLink: string }> {
  const token = await getServiceAccountToken();
  const rootFolder = folderId ?? process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID;

  const metadata = {
    name: fileName,
    mimeType,
    ...(rootFolder ? { parents: [rootFolder] } : {}),
  };

  // Build multipart/related body manually
  const boundary = "===growthhub_boundary===";
  const metaPart = [
    `--${boundary}`,
    "Content-Type: application/json; charset=UTF-8",
    "",
    JSON.stringify(metadata),
  ].join("\r\n");

  const filePart = `\r\n--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n`;
  const closing = `\r\n--${boundary}--`;

  const metaBytes = Buffer.from(metaPart, "utf-8");
  const fileBytes = Buffer.from(fileBuffer);
  const filePartBytes = Buffer.from(filePart, "utf-8");
  const closingBytes = Buffer.from(closing, "utf-8");

  const body = Buffer.concat([metaBytes, filePartBytes, fileBytes, closingBytes]);

  const uploadRes = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": `multipart/related; boundary="${boundary}"`,
        "Content-Length": String(body.length),
      },
      body,
    }
  );

  if (!uploadRes.ok) {
    const err = await uploadRes.text();
    throw new Error(`Drive upload failed (${uploadRes.status}): ${err}`);
  }

  const file = await uploadRes.json();
  const fileId = file.id as string;

  // Make file accessible to anyone with the link
  await fetch(`${DRIVE_FILES_API}/${fileId}/permissions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ role: "reader", type: "anyone" }),
  });

  const webViewLink = `https://drive.google.com/file/d/${fileId}/view`;
  return { id: fileId, webViewLink };
}

export async function deleteFileFromDrive(fileId: string): Promise<void> {
  const token = await getServiceAccountToken();
  await fetch(`${DRIVE_FILES_API}/${fileId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
}
