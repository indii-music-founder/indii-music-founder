import * as admin from 'firebase-admin';
import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { logger } from 'firebase-functions/v2';
import { resendApiKey, sendTransactionalEmail } from '../lib/notify';

function escapeHtml(value: string): string {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

export interface PassportReportEmailPayload {
    assessmentId: string;
    artistName: string;
    email: string;
    careerStage: string;
    genre: string;
    proAffiliation: string;
    mlcRegistered: string;
    distributor: string;
    releaseStatus: string;
    goals: string[];
}

export function buildPassportReportContent(
    payload: PassportReportEmailPayload,
    baseUrl: string = 'https://indii.music'
): { subject: string; html: string; text: string } {
    const name = escapeHtml(payload.artistName || 'Artist');
    const claimUrl = `${baseUrl}/signup?assessmentId=${encodeURIComponent(payload.assessmentId)}`;

    const proGap = payload.proAffiliation === 'None' || !payload.proAffiliation;
    const mlcGap = payload.mlcRegistered !== 'Yes';
    const isMastering = payload.releaseStatus.toLowerCase().includes('mixing') || payload.releaseStatus.toLowerCase().includes('mastering');

    const subject = `Your indii.music Artist Passport & Diagnostic Report`;

    const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body { margin: 0; padding: 0; background-color: #050508; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #f1f5f9; }
        .wrapper { max-width: 600px; margin: 0 auto; background: #0c0d14; border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 16px; overflow: hidden; }
        .header { background: linear-gradient(135deg, rgba(245, 158, 11, 0.15) 0%, rgba(99, 102, 241, 0.15) 100%); padding: 36px 32px; border-bottom: 1px solid rgba(255, 255, 255, 0.08); }
        .logo { font-size: 20px; font-weight: 800; letter-spacing: -0.02em; color: #ffffff; }
        .logo span { color: #f59e0b; }
        .tagline { font-size: 11px; text-transform: uppercase; letter-spacing: 0.1em; color: #94a3b8; margin-top: 4px; }
        .content { padding: 32px; }
        h1 { font-size: 22px; font-weight: 700; color: #ffffff; margin: 0 0 12px 0; }
        p { font-size: 15px; line-height: 1.6; color: #cbd5e1; margin: 0 0 20px 0; }
        .card { background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.06); border-radius: 12px; padding: 20px; margin-bottom: 20px; }
        .card-title { font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #f59e0b; margin-bottom: 12px; }
        .item { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid rgba(255, 255, 255, 0.04); font-size: 14px; }
        .item-label { color: #94a3b8; }
        .item-value { color: #f8fafc; font-weight: 600; }
        .alert-box { background: rgba(245, 158, 11, 0.08); border-left: 4px solid #f59e0b; padding: 14px 18px; border-radius: 4px; margin: 20px 0; font-size: 14px; color: #fef3c7; }
        .cta-btn { display: inline-block; background: #f59e0b; color: #000000 !important; font-weight: 700; font-size: 15px; text-decoration: none; padding: 14px 28px; border-radius: 8px; margin-top: 10px; }
        .footer { padding: 24px 32px; border-top: 1px solid rgba(255, 255, 255, 0.06); text-align: center; font-size: 12px; color: #64748b; }
        .footer a { color: #94a3b8; text-decoration: underline; }
    </style>
</head>
<body>
    <div style="padding: 24px 12px;">
        <div class="wrapper">
            <div class="header">
                <div class="logo">indii<span>.music</span></div>
                <div class="tagline">Music business at the speed of you</div>
            </div>
            <div class="content">
                <h1>Hello ${name},</h1>
                <p>Thank you for completing your <strong>Artist Passport Diagnostic</strong>. Here is your music business readiness summary:</p>

                <div class="card">
                    <div class="card-title">Profile & Setup</div>
                    <div class="item"><span class="item-label">Career Stage:</span><span class="item-value">${escapeHtml(payload.careerStage)}</span></div>
                    <div class="item"><span class="item-label">Genre:</span><span class="item-value">${escapeHtml(payload.genre)}</span></div>
                    <div class="item"><span class="item-label">PRO Affiliation:</span><span class="item-value">${escapeHtml(payload.proAffiliation)}</span></div>
                    <div class="item"><span class="item-label">The MLC Registered:</span><span class="item-value">${escapeHtml(payload.mlcRegistered)}</span></div>
                    <div class="item"><span class="item-label">Distributor:</span><span class="item-value">${escapeHtml(payload.distributor)}</span></div>
                    <div class="item"><span class="item-label">Release Status:</span><span class="item-value">${escapeHtml(payload.releaseStatus)}</span></div>
                </div>

                ${proGap ? `
                <div class="alert-box">
                    <strong>⚠️ Uncollected Performance Royalties:</strong> Without a PRO (ASCAP, BMI, SESAC), radio, streaming, and venue performance royalties remain uncollected.
                </div>` : ''}

                ${mlcGap ? `
                <div class="alert-box">
                    <strong>⚠️ Mechanical Royalty Gap:</strong> If you are not registered with The MLC, interactive streaming mechanical royalties in the US are diverted to the black box.
                </div>` : ''}

                ${isMastering ? `
                <div class="alert-box">
                    <strong>💡 Release Preparation Notice:</strong> Since your project is in mixing/mastering, ensure your master is checked for -14 LUFS streaming normalization and 3000×3000 artwork specifications before final submission.
                </div>` : ''}

                <p>Your answers have been securely staged. When you enter indii Studio, your profile is automatically pre-filled—no repetitive forms.</p>

                <div style="text-align: center; margin: 28px 0;">
                    <a href="${claimUrl}" class="cta-btn">Claim Your Artist Passport & Enter Studio →</a>
                </div>
            </div>
            <div class="footer">
                <p>indii.music • AI Manages the Business • Humans Create the Music</p>
                <p><a href="${claimUrl}">Access Your Passport Online</a></p>
            </div>
        </div>
    </div>
</body>
</html>
    `;

    const text = `Hello ${payload.artistName || 'Artist'},

Thank you for completing your Artist Passport Diagnostic with indii.music.

Your Profile & Setup:
- Career Stage: ${payload.careerStage}
- Genre: ${payload.genre}
- PRO Affiliation: ${payload.proAffiliation}
- The MLC Registered: ${payload.mlcRegistered}
- Distributor: ${payload.distributor}
- Release Status: ${payload.releaseStatus}
${proGap ? '\n[Warning] Without a PRO, your performance royalties remain uncollected.' : ''}
${mlcGap ? '\n[Warning] Interactive streaming mechanicals require The MLC registration.' : ''}
${isMastering ? '\n[Notice] Check master dynamic range (-14 LUFS) and prepare 3000x3000 cover art.' : ''}

Claim your passport and enter the Studio here:
${claimUrl}

indii.music • Music business at the speed of you
`;

    return { subject, html, text };
}

export const sendPassportReportEmail = onDocumentWritten(
    {
        document: 'prospect_assessments/{assessmentId}',
        region: 'us-central1',
        secrets: [resendApiKey],
        memory: '512MiB',
        timeoutSeconds: 60,
    },
    async (event) => {
        const after = event.data?.after;
        if (!after || !after.exists) {
            return;
        }

        const data = after.data() as Partial<PassportReportEmailPayload> & {
            reportEmailSentAt?: unknown;
            emailSentAt?: unknown;
            id?: string;
        };

        const email = data.email?.trim().toLowerCase();
        if (!email || !email.includes('@')) {
            return;
        }

        // Strict idempotency: if already delivered, do not send again
        if (data.reportEmailSentAt || data.emailSentAt) {
            return;
        }

        const assessmentId = event.params.assessmentId || data.id || '';
        const payload: PassportReportEmailPayload = {
            assessmentId,
            artistName: data.artistName || '',
            email,
            careerStage: data.careerStage || 'Independent Artist',
            genre: data.genre || 'General',
            proAffiliation: data.proAffiliation || 'None',
            mlcRegistered: data.mlcRegistered || 'Not sure',
            distributor: data.distributor || 'None',
            releaseStatus: data.releaseStatus || 'In development',
            goals: Array.isArray(data.goals) ? data.goals : [],
        };

        const { subject, html, text } = buildPassportReportContent(payload);

        try {
            const result = await sendTransactionalEmail(email, subject, html, {
                text,
                idempotencyKey: `passport-report-${assessmentId}`,
            });

            if (result.sent) {
                logger.info('[PassportEmail] Report email delivered successfully', {
                    assessmentId,
                    email,
                    messageId: result.messageId,
                });

                await after.ref.update({
                    reportEmailSentAt: admin.firestore.FieldValue.serverTimestamp(),
                    reportEmailMessageId: result.messageId || 'sent',
                });
            } else {
                logger.warn('[PassportEmail] Email dispatch skipped or failed', {
                    assessmentId,
                    email,
                    reason: result.reason,
                });
            }
        } catch (error) {
            logger.error('[PassportEmail] Error during report email delivery', {
                assessmentId,
                email,
                error: error instanceof Error ? error.message : String(error),
            });
        }
    }
);
