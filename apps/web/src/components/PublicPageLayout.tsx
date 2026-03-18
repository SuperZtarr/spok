import { PublicHeader } from './PublicHeader';
import { PublicFooter } from './PublicFooter';

interface PublicPageLayoutProps {
  children: React.ReactNode;
  maxWidth?: string;
  showBack?: boolean;
  centered?: boolean;
}

export function PublicPageLayout({ children, maxWidth, showBack, centered }: PublicPageLayoutProps) {
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
      <PublicFooter />
    </div>
  );
}
