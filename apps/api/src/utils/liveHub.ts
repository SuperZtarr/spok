/*
 * Hub temps réel des séances live : abonnés SSE par séance, diffusion d'événements, présence.
 * En mémoire = valable pour UNE instance d'API (cas Railway actuel). Si l'API passe à plusieurs
 * instances, remplacer broadcast() par un relais PostgreSQL LISTEN/NOTIFY — l'interface ne change pas.
 * Les abonnés qui lèvent une erreur (socket fermée) sont retirés silencieusement.
 * broadcastEach : événement calculé par abonné (ex. programme complet pour l'animateur, filtré pour les participants).
 */
import type { LiveEvent, LiveUser } from '@spok/shared';

interface Subscriber { user: LiveUser; send: (event: LiveEvent) => void }

export class LiveHub {
  private sessions = new Map<string, Set<Subscriber>>();

  subscribe(sessionId: string, user: LiveUser, send: (event: LiveEvent) => void): () => void {
    const sub: Subscriber = { user, send };
    let set = this.sessions.get(sessionId);
    if (!set) { set = new Set(); this.sessions.set(sessionId, set); }
    set.add(sub);
    this.broadcastPresence(sessionId);
    return () => {
      const current = this.sessions.get(sessionId);
      if (!current || !current.delete(sub)) return;
      if (current.size === 0) this.sessions.delete(sessionId);
      else this.broadcastPresence(sessionId);
    };
  }

  broadcast(sessionId: string, event: LiveEvent): void {
    this.broadcastEach(sessionId, () => event);
  }

  broadcastEach(sessionId: string, eventFor: (user: LiveUser) => LiveEvent | null): void {
    const set = this.sessions.get(sessionId);
    if (!set) return;
    const dead: Subscriber[] = [];
    for (const sub of set) {
      try {
        const event = eventFor(sub.user);
        if (event) sub.send(event);
      } catch { dead.push(sub); }
    }
    if (dead.length > 0) {
      for (const sub of dead) set.delete(sub);
      if (set.size === 0) this.sessions.delete(sessionId);
      else this.broadcastPresence(sessionId);
    }
  }

  presence(sessionId: string): LiveUser[] {
    const set = this.sessions.get(sessionId);
    if (!set) return [];
    const byId = new Map<string, LiveUser>();
    for (const sub of set) byId.set(sub.user.id, sub.user);
    return [...byId.values()];
  }

  private broadcastPresence(sessionId: string): void {
    this.broadcast(sessionId, { type: 'presence', presence: this.presence(sessionId) });
  }
}

export const liveHub = new LiveHub();
