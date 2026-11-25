/* Icône de chaque section de la zone Contenus (sortes du registre @spok/shared + données sécurisées) — seul module web
 * qui les porte (2026-11-25) : pastilles (ContentBadges), zone Contenus, menu « + Ajouter ». Une sorte ajoutée au
 * registre sans icône ici casse le typecheck (Record exhaustif). */
import { File, Image, Link2, Workflow, Phone, Mail, MapPin, Lock, type LucideIcon } from 'lucide-react';
import type { ItemContentSection } from '@spok/shared';

export const ITEM_CONTENT_ICONS: Record<ItemContentSection, LucideIcon> = {
  IMAGE: Image, FILE: File, LINK: Link2, PHONE: Phone, EMAIL: Mail, ADDRESS: MapPin, DIAGRAM: Workflow, SECRET: Lock,
};
