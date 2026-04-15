/**
 * Quick Resend Email Test Script
 *
 * Sends a branded test email to verify the Resend integration.
 * Run: npx tsx scripts/test-resend-email.ts
 */

const RESEND_API_KEY = process.env.RESEND_KEY || 're_6Cf2uU5r_Mp37WJBW5yhZ4MW9NDV7j1wr';
const TARGET_EMAIL = process.argv[2] || 'williamroberts321@hotmail.com';

async function sendTestEmail() {
    console.log(`\n🚀 Sending test email to: ${TARGET_EMAIL}\n`);

    const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body { margin: 0; padding: 0; background-color: #0a0a0f; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; }
        .container { max-width: 600px; margin: 0 auto; background: linear-gradient(135deg, #111118 0%, #0d0d14 100%); border: 1px solid rgba(99, 102, 241, 0.15); border-radius: 16px; overflow: hidden; }
        .header { background: linear-gradient(135deg, rgba(99, 102, 241, 0.12) 0%, rgba(139, 92, 246, 0.08) 100%); padding: 32px 40px; border-bottom: 1px solid rgba(99, 102, 241, 0.1); }
        .logo { font-size: 28px; font-weight: 800; color: #ffffff; letter-spacing: -0.5px; }
        .logo span { color: #6366f1; }
        .badge { display: inline-block; background: rgba(34, 197, 94, 0.15); color: #86efac; font-size: 11px; font-weight: 600; padding: 4px 12px; border-radius: 20px; margin-top: 8px; text-transform: uppercase; letter-spacing: 0.5px; }
        .body { padding: 40px; color: #e2e8f0; }
        .body h2 { color: #ffffff; font-size: 22px; font-weight: 700; margin: 0 0 20px 0; }
        .body p { color: #94a3b8; font-size: 15px; line-height: 1.8; margin: 0 0 16px 0; }
        .feature-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin: 24px 0; }
        .feature { background: rgba(99, 102, 241, 0.06); border: 1px solid rgba(99, 102, 241, 0.12); border-radius: 10px; padding: 16px; }
        .feature .icon { font-size: 20px; margin-bottom: 8px; }
        .feature .label { color: #e2e8f0; font-size: 13px; font-weight: 600; }
        .feature .desc { color: #64748b; font-size: 12px; margin-top: 4px; }
        .status-bar { background: rgba(34, 197, 94, 0.08); border: 1px solid rgba(34, 197, 94, 0.2); border-radius: 12px; padding: 20px; margin: 24px 0; text-align: center; }
        .status-bar .check { color: #22c55e; font-size: 32px; }
        .status-bar p { color: #86efac; font-size: 14px; font-weight: 600; margin: 8px 0 0 0; }
        .timestamp { color: #475569; font-size: 12px; text-align: center; margin-top: 16px; }
        .footer { padding: 24px 40px; border-top: 1px solid rgba(255,255,255,0.06); text-align: center; }
        .footer p { color: #475569; font-size: 12px; margin: 0; }
        .footer a { color: #6366f1; text-decoration: none; }
    </style>
</head>
<body>
    <div style="padding: 24px;">
        <div class="container">
            <div class="header">
                <div class="logo">indii<span>OS</span></div>
                <div class="badge">✅ System Online</div>
            </div>
            <div class="body">
                <h2>Email Pipeline Active</h2>
                <p>
                    Your indiiOS email delivery system is now fully operational. 
                    This is a live test confirming the Resend integration is working end-to-end.
                </p>
                
                <div class="status-bar">
                    <div class="check">✓</div>
                    <p>All Systems Operational</p>
                </div>

                <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 24px 0;">
                    <tr>
                        <td width="48%" style="background: rgba(99, 102, 241, 0.06); border: 1px solid rgba(99, 102, 241, 0.12); border-radius: 10px; padding: 16px; vertical-align: top;">
                            <div style="font-size: 20px; margin-bottom: 8px;">📄</div>
                            <div style="color: #e2e8f0; font-size: 13px; font-weight: 600;">Contract Delivery</div>
                            <div style="color: #64748b; font-size: 12px; margin-top: 4px;">NDA, IP, Performance PDFs</div>
                        </td>
                        <td width="4%"></td>
                        <td width="48%" style="background: rgba(99, 102, 241, 0.06); border: 1px solid rgba(99, 102, 241, 0.12); border-radius: 10px; padding: 16px; vertical-align: top;">
                            <div style="font-size: 20px; margin-bottom: 8px;">🔔</div>
                            <div style="color: #e2e8f0; font-size: 13px; font-weight: 600;">Notifications</div>
                            <div style="color: #64748b; font-size: 12px; margin-top: 4px;">Distribution, releases, alerts</div>
                        </td>
                    </tr>
                    <tr><td colspan="3" height="12"></td></tr>
                    <tr>
                        <td width="48%" style="background: rgba(99, 102, 241, 0.06); border: 1px solid rgba(99, 102, 241, 0.12); border-radius: 10px; padding: 16px; vertical-align: top;">
                            <div style="font-size: 20px; margin-bottom: 8px;">👥</div>
                            <div style="color: #e2e8f0; font-size: 13px; font-weight: 600;">Team Invitations</div>
                            <div style="color: #64748b; font-size: 12px; margin-top: 4px;">Collaborate with your team</div>
                        </td>
                        <td width="4%"></td>
                        <td width="48%" style="background: rgba(99, 102, 241, 0.06); border: 1px solid rgba(99, 102, 241, 0.12); border-radius: 10px; padding: 16px; vertical-align: top;">
                            <div style="font-size: 20px; margin-bottom: 8px;">⚖️</div>
                            <div style="color: #e2e8f0; font-size: 13px; font-weight: 600;">DMCA Notices</div>
                            <div style="color: #64748b; font-size: 12px; margin-top: 4px;">Automated takedown requests</div>
                        </td>
                    </tr>
                </table>

                <p style="color: #64748b; font-size: 13px;">
                    This email was sent by the indiiOS platform at
                    ${new Date().toLocaleString('en-US', { timeZone: 'America/Detroit', dateStyle: 'full', timeStyle: 'long' })}.
                </p>
            </div>
            <div class="footer">
                <p>Powered by <a href="https://indiios.com">indiiOS</a> — The Creative Operating System</p>
                <p style="margin-top: 8px;">© ${new Date().getFullYear()} IndiiOS LLC. All rights reserved.</p>
            </div>
        </div>
    </div>
</body>
</html>`;

    const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${RESEND_API_KEY}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            from: 'indiiOS <onboarding@resend.dev>',
            to: [TARGET_EMAIL],
            subject: '🚀 indiiOS Email Pipeline — Live & Operational',
            html: html,
            text: `indiiOS Email Pipeline — Live & Operational\n\nYour email delivery system is now fully operational. This confirms the Resend integration is working end-to-end.\n\nCapabilities:\n- Contract Delivery (NDA, IP, Performance PDFs)\n- Notifications (Distribution, releases, alerts)\n- Team Invitations\n- DMCA Notices\n\nSent at: ${new Date().toISOString()}\n\n© ${new Date().getFullYear()} IndiiOS LLC`,
        }),
    });

    const result = await response.json();

    if (response.ok) {
        console.log('✅ Email sent successfully!');
        console.log(`   Message ID: ${result.id}`);
        console.log(`   Recipient:  ${TARGET_EMAIL}`);
        console.log(`   Subject:    🚀 indiiOS Email Pipeline — Live & Operational`);
        console.log(`\n   Check your inbox! 📬\n`);
    } else {
        console.error('❌ Email send failed:');
        console.error(JSON.stringify(result, null, 2));
    }
}

sendTestEmail().catch(console.error);
