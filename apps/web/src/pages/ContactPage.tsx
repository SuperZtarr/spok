/* Formulaire de contact (/contact) : crée un item dans l'espace Support via POST /contact. */
import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Send, CheckCircle, MessageSquare, Bug, Lightbulb, Wrench } from 'lucide-react';
import { contactApi, ApiError } from '../lib/api';
import { useAuthStore } from '../stores/auth';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Card, CardContent } from '../components/ui/Card';

const CATEGORIES = [
  { value: 'question', label: 'Question generale', icon: MessageSquare, color: 'text-blue-500' },
  { value: 'bug', label: 'Signalement de bug', icon: Bug, color: 'text-red-500' },
  { value: 'feature', label: 'Demande de fonctionnalite', icon: Lightbulb, color: 'text-amber-500' },
  { value: 'technical', label: 'Demande technique', icon: Wrench, color: 'text-purple-500' },
];

export function ContactPage() {
  const user = useAuthStore(s => s.user);
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [category, setCategory] = useState('question');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const submitMutation = useMutation({
    mutationFn: contactApi.submit,
    onSuccess: () => setSuccess(true),
    onError: (err) => {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Une erreur est survenue');
      }
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    submitMutation.mutate({ name, email, category, message });
  };

  if (success) {
    return (
      <div className="flex-1 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-8 pb-8 text-center">
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold mb-2">Message envoye !</h2>
            <p className="text-muted-foreground">
              Votre message a ete transmis aux administrateurs. Vous recevrez une reponse dans les meilleurs delais.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto p-4 md:p-8">
      <div className="max-w-2xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">Contact & Support</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Une question, un bug, une idee ? Ecrivez-nous.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-md">
              {error}
            </div>
          )}

          {/* Category selection */}
          <div>
            <label className="text-sm font-medium mb-2 block">Categorie</label>
            <div className="grid grid-cols-2 gap-2">
              {CATEGORIES.map(cat => {
                const Icon = cat.icon;
                const selected = category === cat.value;
                return (
                  <button
                    key={cat.value}
                    type="button"
                    onClick={() => setCategory(cat.value)}
                    className={`flex items-center gap-2.5 p-3 rounded-lg border text-left text-sm transition-colors ${
                      selected
                        ? 'border-primary bg-primary/5 text-foreground'
                        : 'border-border hover:border-primary/30 text-muted-foreground'
                    }`}
                  >
                    <Icon className={`w-4 h-4 flex-shrink-0 ${selected ? cat.color : ''}`} />
                    {cat.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Name & Email */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="contact-name" className="text-sm font-medium mb-1 block">Nom</label>
              <Input
                id="contact-name"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Votre nom"
                required
              />
            </div>
            <div>
              <label htmlFor="contact-email" className="text-sm font-medium mb-1 block">Email</label>
              <Input
                id="contact-email"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="vous@exemple.com"
                required
              />
            </div>
          </div>

          {/* Message */}
          <div>
            <label htmlFor="contact-message" className="text-sm font-medium mb-1 block">Message</label>
            <textarea
              id="contact-message"
              value={message}
              onChange={e => setMessage(e.target.value)}
              placeholder="Decrivez votre demande en detail..."
              required
              minLength={10}
              rows={6}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-y"
            />
          </div>

          <Button type="submit" disabled={submitMutation.isPending} className="w-full sm:w-auto">
            {submitMutation.isPending ? 'Envoi...' : (
              <>
                <Send className="w-4 h-4 mr-2" />
                Envoyer
              </>
            )}
          </Button>
        </form>
      </div>
    </div>
  );
}
