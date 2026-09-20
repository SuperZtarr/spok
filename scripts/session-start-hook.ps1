# Hook SessionStart : injecte le contexte de session (journal + TODO)
#
# Ne lance PLUS Docker/dev server automatiquement (retire le 2026-09-20) : Thomas ouvre parfois
# une session sans avoir besoin de l'environnement de dev. Le démarrage explicite passe par le
# skill spok-start, déclenché uniquement quand il le demande (start/démarre/lance le dev).

# Lire les fichiers de contexte
$journal = Get-Content "C:/_dev/spok/docs/session-journal.md" -Raw -ErrorAction SilentlyContinue
$todo = Get-Content "C:/_dev/spok/docs/TODO.md" -Raw -ErrorAction SilentlyContinue

# Tronquer pour ne pas saturer le contexte
$journalLines = ($journal -split "`n")[0..80] -join "`n"
$todoLines = ($todo -split "`n")[0..60] -join "`n"

$rappel = "Une fois une direction de depannage/action technique validee par Thomas, enchainer les sous-etapes de meme nature (edition config locale, suppression fichier casse, redemarrage process local) SANS redemander confirmation a chaque sous-etape. Ne redemander que pour une action reellement destructive/irreversible (perte de donnees, prod, financier, envoi de message) ou un vrai changement de direction."

$ctx = "=== RAPPEL COMPORTEMENT ===`n$rappel`n`n=== SESSION JOURNAL (EN COURS) ===`n$journalLines`n`n=== TODO ===`n$todoLines"

@{
    hookSpecificOutput = @{
        hookEventName  = "SessionStart"
        additionalContext = $ctx
    }
} | ConvertTo-Json -Compress
