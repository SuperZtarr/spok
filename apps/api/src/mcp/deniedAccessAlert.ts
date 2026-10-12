/*
 * Alerte admin quand un utilisateur connu utilise un jeton personnel valide sans accès MCP accordé (jamais
 * accordé, ou retiré) : notification MCP_ACCESS_DENIED aux admins actifs, au plus une par utilisateur toutes les
 * 24 h (un Claude refusé réessaie en boucle). Appelée par plugins/jwt.ts, sans attendre ni bloquer la réponse 403.
 * Mémoire du process : un redémarrage de l'API peut produire une alerte de plus, sans conséquence.
 * Les tentatives anonymes (jeton inconnu) ne sont pas signalées : rattachées à personne, c'est du bruit.
 */
import { createNotification } from '../utils/notifications.js'

const ALERT_INTERVAL_MS = 24 * 3600_000
const lastAlertAt = new Map<string, number>()

export function notifyDeniedMcpAttempt(prisma: any, userId: string, tokenName: string): void {
  const now = Date.now()
  const last = lastAlertAt.get(userId)
  if (last !== undefined && now - last < ALERT_INTERVAL_MS) return
  lastAlertAt.set(userId, now)

  void (async () => {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { name: true, email: true } })
    if (!user) return
    const admins = await prisma.user.findMany({ where: { globalRole: 'ADMIN', disabledAt: null }, select: { id: true } })
    await Promise.all(admins.map((admin: { id: string }) => createNotification(prisma, {
      userId: admin.id,
      type: 'MCP_ACCESS_DENIED',
      title: `Accès Claude refusé : ${user.name}`,
      message: `${user.name} (${user.email}) a tenté d'utiliser le serveur MCP avec le jeton « ${tokenName} » sans accès accordé.`,
      link: '/admin/users',
      metadata: { userId, userName: user.name, userEmail: user.email, tokenName },
    } as any)))
  })().catch(() => {})
}

/** Tests uniquement : oublie les alertes déjà envoyées. */
export function resetDeniedMcpAlerts(): void {
  lastAlertAt.clear()
}
