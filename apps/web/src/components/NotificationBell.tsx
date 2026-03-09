import { useState, useRef, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Bell, Check, CheckCheck, Trash2, UserPlus, ClipboardList, MessageSquare, AtSign, Mail, Loader2, CheckCircle, XCircle } from 'lucide-react';
import { notificationsApi, invitationsApi, authApi } from '../lib/api';
import type { Notification, NotificationType, Invitation } from '@spok/shared';

const TYPE_CONFIG: Record<NotificationType, { icon: typeof Bell; color: string }> = {
  INVITATION: { icon: UserPlus, color: 'text-blue-500' },
  ASSIGNMENT: { icon: ClipboardList, color: 'text-orange-500' },
  CONTRIBUTION: { icon: MessageSquare, color: 'text-green-500' },
  MENTION: { icon: AtSign, color: 'text-purple-500' },
  EMAIL_VERIFICATION: { icon: Mail, color: 'text-amber-500' },
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'à l\'instant';
  if (minutes < 60) return `il y a ${minutes}min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `il y a ${hours}h`;
  const days = Math.floor(hours / 24);
  return `il y a ${days}j`;
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  // Poll unread count every 30s
  const { data: unreadData } = useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: notificationsApi.unreadCount,
    refetchInterval: 30000,
  });

  // Fetch notifications list only when dropdown is open
  const { data: notifications } = useQuery({
    queryKey: ['notifications', 'list'],
    queryFn: () => notificationsApi.list(20, 0),
    enabled: open,
    refetchInterval: open ? 30000 : false,
  });

  const markReadMutation = useMutation({
    mutationFn: notificationsApi.markRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: notificationsApi.markAllRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: notificationsApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const resendVerificationMutation = useMutation({
    mutationFn: () => authApi.resendVerification(),
  });

  // Pending invitations
  const { data: pendingInvitations } = useQuery({
    queryKey: ['invitations', 'my'],
    queryFn: invitationsApi.my,
    refetchInterval: 60000,
  });

  const acceptInvitationMutation = useMutation({
    mutationFn: (token: string) => invitationsApi.accept(token),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invitations'] });
      queryClient.invalidateQueries({ queryKey: ['communities'] });
      queryClient.invalidateQueries({ queryKey: ['spaces'] });
    },
  });

  const declineInvitationMutation = useMutation({
    mutationFn: (token: string) => invitationsApi.decline(token),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invitations'] });
    },
  });

  const invitationCount = pendingInvitations?.length ?? 0;
  const unreadCount = (unreadData?.count ?? 0) + invitationCount;

  // Close dropdown on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handleClick = useCallback((notif: Notification) => {
    if (!notif.read) {
      markReadMutation.mutate(notif.id);
    }
    if (notif.link) {
      navigate(notif.link);
      setOpen(false);
    }
  }, [markReadMutation, navigate]);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2 rounded-md hover:bg-accent transition-colors"
        title="Notifications"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center text-[10px] font-bold text-white bg-red-500 rounded-full px-1">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 w-80 max-h-[420px] bg-card border border-border rounded-lg shadow-xl z-50 flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-border">
            <span className="text-sm font-semibold">Notifications</span>
            {unreadCount > 0 && (
              <button
                onClick={() => markAllReadMutation.mutate()}
                className="text-xs text-primary hover:underline flex items-center gap-1"
                title="Tout marquer comme lu"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                Tout lu
              </button>
            )}
          </div>

          {/* Pending invitations */}
          {pendingInvitations && pendingInvitations.length > 0 && (
            <div className="border-b border-border">
              <div className="px-3 py-1.5 bg-blue-50 dark:bg-blue-950/20 text-xs font-medium text-blue-600 dark:text-blue-400">
                Invitations en attente
              </div>
              {pendingInvitations.map((inv: Invitation) => {
                const targetName = inv.community?.name || inv.space?.name || '';
                const targetType = inv.communityId ? 'communauté' : 'espace';
                return (
                  <div key={inv.id} className="flex items-start gap-2 px-3 py-2.5 bg-primary/5 border-b border-border/50 last:border-0">
                    <div className="mt-0.5 flex-shrink-0 text-blue-500">
                      <UserPlus className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium leading-snug">
                        {inv.invitedBy?.name || 'Quelqu\'un'} vous invite à rejoindre {targetType === 'communauté' ? 'la' : "l'"}{targetType} « {targetName} »
                      </p>
                      {inv.message && (
                        <p className="text-xs text-muted-foreground mt-0.5 italic">« {inv.message} »</p>
                      )}
                      <div className="flex items-center gap-2 mt-1.5">
                        <button
                          onClick={() => acceptInvitationMutation.mutate(inv.token)}
                          disabled={acceptInvitationMutation.isPending || declineInvitationMutation.isPending}
                          className="flex items-center gap-1 px-2 py-0.5 text-xs font-medium text-green-700 dark:text-green-400 bg-green-100 dark:bg-green-950/30 rounded hover:bg-green-200 dark:hover:bg-green-950/50 transition-colors"
                        >
                          <CheckCircle className="w-3 h-3" />
                          Accepter
                        </button>
                        <button
                          onClick={() => declineInvitationMutation.mutate(inv.token)}
                          disabled={acceptInvitationMutation.isPending || declineInvitationMutation.isPending}
                          className="flex items-center gap-1 px-2 py-0.5 text-xs font-medium text-red-700 dark:text-red-400 bg-red-100 dark:bg-red-950/30 rounded hover:bg-red-200 dark:hover:bg-red-950/50 transition-colors"
                        >
                          <XCircle className="w-3 h-3" />
                          Décliner
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* List */}
          <div className="flex-1 overflow-y-auto">
            {!notifications || notifications.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                Aucune notification
              </div>
            ) : (
              notifications.map((notif) => {
                const config = TYPE_CONFIG[notif.type as NotificationType] || TYPE_CONFIG.CONTRIBUTION;
                const Icon = config.icon;
                return (
                  <div
                    key={notif.id}
                    className={`flex items-start gap-2 px-3 py-2.5 hover:bg-accent/50 cursor-pointer border-b border-border/50 last:border-0 transition-colors ${
                      !notif.read ? 'bg-primary/5' : ''
                    }`}
                    onClick={() => handleClick(notif)}
                  >
                    <div className={`mt-0.5 flex-shrink-0 ${config.color}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm leading-snug ${!notif.read ? 'font-medium' : 'text-muted-foreground'}`}>
                        {notif.title}
                      </p>
                      {notif.message && (
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">{notif.message}</p>
                      )}
                      {notif.type === 'EMAIL_VERIFICATION' && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            resendVerificationMutation.mutate();
                          }}
                          disabled={resendVerificationMutation.isPending || resendVerificationMutation.isSuccess}
                          className="text-xs text-amber-600 hover:text-amber-800 underline hover:no-underline mt-0.5 flex items-center gap-1"
                        >
                          {resendVerificationMutation.isPending && <Loader2 className="w-3 h-3 animate-spin" />}
                          {resendVerificationMutation.isSuccess ? 'Email renvoyé !' : 'Renvoyer l\'email'}
                        </button>
                      )}
                      <p className="text-[10px] text-muted-foreground/70 mt-0.5">{timeAgo(notif.createdAt)}</p>
                    </div>
                    <div className="flex items-center gap-0.5 flex-shrink-0 mt-0.5">
                      {!notif.read && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            markReadMutation.mutate(notif.id);
                          }}
                          className="p-1 rounded hover:bg-accent"
                          title="Marquer comme lu"
                        >
                          <Check className="w-3.5 h-3.5 text-muted-foreground" />
                        </button>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteMutation.mutate(notif.id);
                        }}
                        className="p-1 rounded hover:bg-accent"
                        title="Supprimer"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-muted-foreground" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
