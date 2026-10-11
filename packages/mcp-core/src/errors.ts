/*
 * Erreurs remontées au modèle par les outils MCP. ConventionError : donnée non conforme aux
 * conventions SPOK (message actionnable, en français, listant les valeurs acceptées).
 * SpokApiError : réponse non 2xx de l'API (status + corps brut).
 */
export class ConventionError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ConventionError'
  }
}

export class SpokApiError extends Error {
  constructor(public status: number, public body: string, path: string) {
    super(`SPOK API ${status} sur ${path}: ${body}`)
    this.name = 'SpokApiError'
  }
}
