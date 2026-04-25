export interface VerificationEmailTemplate {
  subject: string;
  text: string;
  html: string;
}

export const buildVerificationCodeEmail = (code: string): VerificationEmailTemplate => ({
  subject: 'Your Mini Games verification code',
  text: `Use this verification code to sign in: ${code}. It expires in 10 minutes.`,
  html: `
    <div style="font-family: Arial, sans-serif; background:#07111f; color:#e8f2ff; padding:24px;">
      <div style="max-width:480px; margin:0 auto; background:#0f1c2f; border:1px solid rgba(72,163,255,0.25); border-radius:18px; padding:24px;">
        <p style="margin:0 0 12px; color:#76c6ff; letter-spacing:0.12em; text-transform:uppercase; font-size:12px;">HTL Mini Games</p>
        <h1 style="margin:0 0 12px; font-size:24px;">Verification Code</h1>
        <p style="margin:0 0 20px; color:#bfdcff;">Enter the code below to finish signing in. The code expires in 10 minutes.</p>
        <div style="font-size:32px; font-weight:700; letter-spacing:0.35em; color:#ffffff; background:#07111f; border:1px solid rgba(72,163,255,0.35); border-radius:14px; padding:16px 20px; text-align:center;">
          ${code}
        </div>
      </div>
    </div>
  `
});
