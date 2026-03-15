const SITE_URL = process.env.SITE_URL || 'https://spok.space';
const LOGO_URL = `${SITE_URL}/logo.png`;

/**
 * Wrap email content in a branded template with header and footer.
 */
export function wrapEmailTemplate(content: string, options?: { subject?: string }): string {
  return `
<!DOCTYPE html>
<html lang="fr">
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /></head>
<body style="margin: 0; padding: 0; background-color: #f4f4f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <div style="max-width: 600px; margin: 0 auto; padding: 24px 16px;">

    <!-- Header -->
    <div style="text-align: center; padding: 24px 0 16px;">
      <a href="${SITE_URL}" style="text-decoration: none;">
        <img src="${LOGO_URL}" alt="SPOK" style="height: 48px; width: auto;" />
      </a>
      <p style="margin: 8px 0 0; font-size: 12px; color: #a1a1aa; letter-spacing: 1px;">
        SINGLE POINT OF KNOWLEDGE
      </p>
    </div>

    <!-- Content -->
    <div style="background: #ffffff; border-radius: 8px; padding: 24px; border: 1px solid #e4e4e7;">
      ${content}
    </div>

    <!-- Footer -->
    <div style="text-align: center; padding: 20px 0; font-size: 12px; color: #a1a1aa;">
      <p style="margin: 0 0 8px;">
        <a href="${SITE_URL}" style="color: #6366f1; text-decoration: none;">Accéder à SPOK</a>
      </p>
      <p style="margin: 0;">
        Vous recevez cet email car vous êtes membre de SPOK.<br />
        Gérez vos préférences de notification dans votre
        <a href="${SITE_URL}" style="color: #6366f1; text-decoration: none;">profil</a>.
      </p>
    </div>

  </div>
</body>
</html>`;
}
