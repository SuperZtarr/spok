import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { HelpCircle, X } from 'lucide-react';
import { PublicHeader } from './PublicHeader';
import { PublicFooter } from './PublicFooter';

const PAGE_HELP: Record<string, { title: string; text: string }> = {
  '/': {
    title: 'Bienvenue sur SPOK',
    text: 'SPOK est une plateforme collaborative pour structurer, lier et planifier vos projets. Creez un compte gratuit ou connectez-vous pour acceder a vos espaces de travail.',
  },
  '/login': {
    title: 'Connexion',
    text: 'Entrez votre email et mot de passe pour acceder a votre compte SPOK. Si vous n\'avez pas encore de compte, cliquez sur "S\'inscrire". En cas d\'oubli, utilisez le lien "Mot de passe oublie".',
  },
  '/register': {
    title: 'Inscription',
    text: 'Creez votre compte SPOK en renseignant votre nom, email et mot de passe (8 caracteres minimum). Un espace personnel sera automatiquement cree pour vous.',
  },
  '/forgot-password': {
    title: 'Mot de passe oublie',
    text: 'Entrez l\'adresse email associee a votre compte. Si un compte existe, vous recevrez un email avec un lien pour reinitialiser votre mot de passe. Pensez a verifier vos courriers indesirables.',
  },
  '/reset-password': {
    title: 'Nouveau mot de passe',
    text: 'Choisissez un nouveau mot de passe (8 caracteres minimum). Apres la mise a jour, vous serez redirige vers la page de connexion.',
  },
  '/verify-email': {
    title: 'Verification email',
    text: 'Cette page confirme la validation de votre adresse email. Le lien de verification est valable une seule fois.',
  },
  '/invitation': {
    title: 'Invitation',
    text: 'Vous avez ete invite a rejoindre une communaute ou un espace SPOK. Connectez-vous ou creez un compte pour accepter l\'invitation.',
  },
  '/sitemap': {
    title: 'Plan du site',
    text: 'Vue d\'ensemble de toutes les pages de SPOK, organisees par categorie et niveau d\'acces. Les pages visibles dependent de votre connexion et de votre role.',
  },
};

export function HelpBubble({ title, text }: { title?: string; text?: string }) {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();

  const pageHelp = PAGE_HELP[pathname];
  const finalTitle = title || pageHelp?.title;
  const finalText = text || pageHelp?.text;
  if (!finalTitle || !finalText) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {open && (
        <div className="absolute bottom-12 right-0 w-72 bg-card border border-border rounded-lg shadow-lg p-4 mb-2 animate-in fade-in slide-in-from-bottom-2 duration-200">
          <div className="flex items-start justify-between mb-2">
            <h3 className="text-sm font-semibold">{finalTitle}</h3>
            <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground p-0.5">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">{finalText}</p>
        </div>
      )}
      <button
        onClick={() => setOpen(!open)}
        className={`p-2.5 rounded-full shadow-lg transition-colors ${
          open
            ? 'bg-primary text-primary-foreground'
            : 'bg-card border border-border text-muted-foreground hover:text-foreground hover:border-primary/50'
        }`}
        title="Aide"
      >
        <HelpCircle className="w-5 h-5" />
      </button>
    </div>
  );
}

interface PublicPageLayoutProps {
  children: React.ReactNode;
  maxWidth?: string;
  showBack?: boolean;
  centered?: boolean;
  helpTitle?: string;
  helpText?: string;
}

export function PublicPageLayout({ children, maxWidth, showBack, centered, helpTitle, helpText }: PublicPageLayoutProps) {
  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <PublicHeader maxWidth={maxWidth} showBack={showBack} />
      {centered ? (
        <div className="flex-1 flex items-center justify-center p-4">
          {children}
        </div>
      ) : (
        <div className="flex-1">
          {children}
        </div>
      )}
      <HelpBubble title={helpTitle} text={helpText} />
      <PublicFooter />
    </div>
  );
}
