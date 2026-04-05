/**
 * Item 412: Split Sheet PDF Export
 *
 * Cloud Function that generates a print-ready HTML split sheet document,
 * stores it in Firebase Storage, and returns a signed download URL.
 *
 * PDF generation is done client-side via the browser's print dialog
 * (window.print()) against the served HTML. The HTML uses @media print
 * CSS so it renders as a clean, court-admissible document.
 */
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getStorage } from 'firebase-admin/storage';
import { getFirestore } from 'firebase-admin/firestore';
import { z } from 'zod';

/* ── Validation ──────────────────────────────────────────────────────────── */

const CollaboratorSchema = z.object({
    name: z.string().min(1),
    role: z.string().min(1),
    splitPct: z.number().min(0).max(100),
    email: z.string().email().optional(),
    signed: z.boolean().optional().default(false),
    signedAt: z.string().optional(),
});

const ExportSplitSheetSchema = z.object({
    splitSheetId: z.string().min(1),
    releaseTitle: z.string().min(1),
    releaseIsrc: z.string().optional(),
    upc: z.string().optional(),
    collaborators: z.array(CollaboratorSchema).min(1),
    totalEscrowAmount: z.number().min(0).optional(),
    effectiveDate: z.string().optional(),
    notes: z.string().optional(),
});

type ExportSplitSheetInput = z.infer<typeof ExportSplitSheetSchema>;

/* ── HTML Template ───────────────────────────────────────────────────────── */

function buildSplitSheetHtml(data: ExportSplitSheetInput, generatedAt: string): string {
    const colRows = data.collaborators.map(c => {
        const signed = c.signed ? '✓ Signed' : '⏳ Pending';
        const signedAt = c.signedAt ? `<br><small style="color:#666">${c.signedAt}</small>` : '';
        return `
        <tr>
            <td>${escapeHtml(c.name)}</td>
            <td>${escapeHtml(c.role)}</td>
            <td>${c.email ? escapeHtml(c.email) : '—'}</td>
            <td style="text-align:center;font-weight:bold">${c.splitPct.toFixed(2)}%</td>
            <td style="text-align:center">${signed}${signedAt}</td>
        </tr>`;
    }).join('\n');

    const totalSplit = data.collaborators.reduce((s, c) => s + c.splitPct, 0);
    const escrowLine = data.totalEscrowAmount !== undefined
        ? `<p><strong>Escrow Amount:</strong> $${data.totalEscrowAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>`
        : '';

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Split Sheet — ${escapeHtml(data.releaseTitle)}</title>
<style>
  /* Screen styles */
  body { font-family: Georgia, 'Times New Roman', serif; margin: 0; padding: 24px; color: #111; background: #fff; }
  .container { max-width: 760px; margin: 0 auto; }
  h1 { font-size: 22px; margin-bottom: 4px; }
  h2 { font-size: 14px; font-weight: normal; color: #555; margin-top: 0; }
  .section { margin: 24px 0; }
  .section h3 { font-size: 13px; text-transform: uppercase; letter-spacing: 1px; color: #888; border-bottom: 1px solid #ddd; padding-bottom: 4px; margin-bottom: 12px; }
  .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 24px; font-size: 13px; }
  .meta-grid p { margin: 4px 0; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th { background: #f5f5f5; text-align: left; padding: 8px 10px; border: 1px solid #ddd; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; }
  td { padding: 8px 10px; border: 1px solid #ddd; vertical-align: top; }
  tr:nth-child(even) td { background: #fafafa; }
  .totals-row td { font-weight: bold; background: #f0f0f0; }
  .warning { color: #c0392b; font-size: 12px; margin-top: 4px; }
  .legal { font-size: 11px; color: #666; line-height: 1.6; background: #f9f9f9; border: 1px solid #e0e0e0; padding: 12px 16px; border-radius: 4px; }
  .footer { margin-top: 40px; font-size: 11px; color: #aaa; text-align: center; border-top: 1px solid #eee; padding-top: 12px; }
  .no-print { margin-top: 20px; text-align: center; }
  .no-print button { padding: 10px 24px; background: #1a1a2e; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 14px; }
  .no-print button:hover { background: #16213e; }

  /* Print styles */
  @media print {
    body { padding: 0; margin: 0; }
    .no-print { display: none; }
    .container { max-width: 100%; }
    table { page-break-inside: avoid; }
    .legal { page-break-inside: avoid; }
  }
</style>
</head>
<body>
<div class="container">
  <div style="display:flex; justify-content:space-between; align-items:flex-start; border-bottom: 2px solid #111; padding-bottom:16px; margin-bottom:20px">
    <div>
      <h1>Split Sheet Agreement</h1>
      <h2>${escapeHtml(data.releaseTitle)}</h2>
    </div>
    <div style="text-align:right;font-size:12px;color:#666">
      <div style="font-size:18px;font-weight:bold;letter-spacing:2px;color:#111">indiiOS</div>
      <div>Generated: ${escapeHtml(generatedAt)}</div>
      <div>ID: ${escapeHtml(data.splitSheetId)}</div>
    </div>
  </div>

  <div class="section">
    <h3>Release Information</h3>
    <div class="meta-grid">
      <p><strong>Release Title:</strong> ${escapeHtml(data.releaseTitle)}</p>
      ${data.releaseIsrc ? `<p><strong>ISRC:</strong> ${escapeHtml(data.releaseIsrc)}</p>` : '<p></p>'}
      ${data.upc ? `<p><strong>UPC:</strong> ${escapeHtml(data.upc)}</p>` : '<p></p>'}
      <p><strong>Effective Date:</strong> ${data.effectiveDate ? escapeHtml(data.effectiveDate) : escapeHtml(generatedAt.split('T')[0])}</p>
      ${escrowLine}
      ${data.notes ? `<p style="grid-column:1/-1"><strong>Notes:</strong> ${escapeHtml(data.notes)}</p>` : ''}
    </div>
  </div>

  <div class="section">
    <h3>Royalty Split Table</h3>
    <table>
      <thead>
        <tr>
          <th>Collaborator</th>
          <th>Role / Contribution</th>
          <th>Email</th>
          <th style="text-align:center">Split %</th>
          <th style="text-align:center">Signature Status</th>
        </tr>
      </thead>
      <tbody>
        ${colRows}
        <tr class="totals-row">
          <td colspan="3" style="text-align:right">Total</td>
          <td style="text-align:center">${totalSplit.toFixed(2)}%</td>
          <td></td>
        </tr>
      </tbody>
    </table>
    ${Math.abs(totalSplit - 100) > 0.01 ? `<p class="warning">⚠ Split percentages do not sum to 100% (total: ${totalSplit.toFixed(2)}%)</p>` : ''}
  </div>

  <div class="section">
    <h3>Legal Agreement</h3>
    <div class="legal">
      <p>This Split Sheet Agreement ("Agreement") is entered into by the collaborators listed above ("Parties") for the sound recording titled <strong>"${escapeHtml(data.releaseTitle)}"</strong> (the "Work").</p>
      <p><strong>1. Ownership &amp; Royalties.</strong> The Parties agree that royalties, advances, and other revenue generated by the Work shall be allocated according to the percentages set forth in the Split Table above. This allocation applies to master recording royalties, synchronization fees, performance royalties, and any other income derived from the Work.</p>
      <p><strong>2. Representations.</strong> Each Party represents that they are the original creator of their contribution to the Work and that no portion of their contribution infringes any third-party intellectual property rights.</p>
      <p><strong>3. Administration.</strong> Unless separately agreed in writing, each Party retains the right to administer and license their respective ownership share independently.</p>
      <p><strong>4. Governing Law.</strong> This Agreement shall be governed by the laws of the jurisdiction in which the majority of the Parties reside, or as mutually agreed in writing.</p>
      <p><em>This document was generated by indiiOS and is intended for reference purposes. Parties are advised to have this Agreement reviewed by qualified legal counsel before relying on it for legal purposes.</em></p>
    </div>
  </div>

  <div class="section">
    <h3>Signatures</h3>
    <table>
      <thead>
        <tr><th>Name</th><th>Role</th><th>Signature</th><th>Date</th></tr>
      </thead>
      <tbody>
        ${data.collaborators.map(c => `
        <tr>
          <td>${escapeHtml(c.name)}</td>
          <td>${escapeHtml(c.role)}</td>
          <td style="height:40px">${c.signed ? '(Digitally signed via indiiOS)' : ''}</td>
          <td>${c.signedAt ? escapeHtml(c.signedAt) : ''}</td>
        </tr>`).join('\n')}
      </tbody>
    </table>
  </div>

  <div class="footer">
    Split Sheet generated by indiiOS v0.1.0-beta.2 · ${escapeHtml(generatedAt)} · ID: ${escapeHtml(data.splitSheetId)}
  </div>

  <div class="no-print">
    <button onclick="window.print()">Print / Save as PDF</button>
  </div>
</div>
</body>
</html>`;
}

function escapeHtml(str: string): string {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

/* ── Cloud Function ──────────────────────────────────────────────────────── */

export const exportSplitSheet = onCall<ExportSplitSheetInput, Promise<{ url: string; storagePath: string }>>(
    { cors: true, enforceAppCheck: true },
    async (request) => {
        const uid = request.auth?.uid;
        if (!uid) {
            throw new HttpsError('unauthenticated', 'Authentication required.');
        }

        // Validate input
        const parseResult = ExportSplitSheetSchema.safeParse(request.data);
        if (!parseResult.success) {
            throw new HttpsError('invalid-argument', `Invalid split sheet data: ${parseResult.error.message}`);
        }
        const data = parseResult.data;

        const generatedAt = new Date().toISOString();
        const htmlContent = buildSplitSheetHtml(data, generatedAt);

        // Store in Firebase Storage
        const bucket = getStorage().bucket();
        const storagePath = `split_sheets/${uid}/${data.splitSheetId}/split_sheet_${Date.now()}.html`;
        const file = bucket.file(storagePath);

        await file.save(Buffer.from(htmlContent, 'utf-8'), {
            metadata: {
                contentType: 'text/html; charset=utf-8',
                metadata: {
                    userId: uid,
                    splitSheetId: data.splitSheetId,
                    releaseTitle: data.releaseTitle,
                    generatedAt,
                },
            },
        });

        // Generate signed URL valid for 7 days
        const [signedUrl] = await file.getSignedUrl({
            action: 'read',
            expires: Date.now() + 7 * 24 * 60 * 60 * 1000,
        });

        // Record generation in Firestore audit log
        const db = getFirestore();
        await db.collection('split_sheet_exports').add({
            uid,
            splitSheetId: data.splitSheetId,
            releaseTitle: data.releaseTitle,
            storagePath,
            collaboratorCount: data.collaborators.length,
            generatedAt,
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        });

        return { url: signedUrl, storagePath };
    }
);
