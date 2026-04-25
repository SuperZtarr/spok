# UI — Vignettes communautés, espaces, items

Patterns à réutiliser tel quel. Ne pas inventer de nouvelles variantes.

---

## Communauté — `CommunityListView.tsx` `renderCommunityCard`

```tsx
<div className="relative rounded-xl overflow-hidden border border-border bg-card">
  {/* Bandeau cover */}
  {community.coverUrl ? (
    <div className="aspect-[3/1] overflow-hidden">
      <img
        src={community.coverUrl}
        alt=""
        className="w-full h-full object-cover"
        style={{
          objectPosition: `${community.coverPositionX ?? 50}% ${community.coverPosition ?? 50}%`,
          transform: `scale(${(community.coverZoom ?? 100) / 100})`,
          transformOrigin: `${community.coverPositionX ?? 50}% ${community.coverPosition ?? 50}%`,
        }}
      />
    </div>
  ) : (
    <div className="aspect-[3/1] bg-gradient-to-r from-primary/20 to-primary/5" />
  )}

  {/* Avatar chevauchant le bas du bandeau */}
  <div className="absolute -bottom-4 left-4">
    {community.avatarUrl ? (
      <img src={community.avatarUrl} alt="" className="w-12 h-12 rounded-xl border-4 border-background object-cover shadow" />
    ) : community.coverUrl ? (
      <img src={community.coverUrl} alt="" className="w-12 h-12 rounded-xl border-4 border-background object-cover shadow" style={{ objectPosition: 'top right' }} />
    ) : (
      <div className="w-12 h-12 rounded-xl border-4 border-background bg-primary/10 flex items-center justify-center shadow">
        <Users className="w-5 h-5 text-primary" />
      </div>
    )}
  </div>

  {/* Infos — pt-6 pour laisser place à l'avatar */}
  <div className="px-4 pt-6 pb-3">
    <p className="font-semibold text-sm">{community.name}</p>
    {/* ... membres, description */}
  </div>
</div>
```

**Règles :**
- `aspect-[3/1]` pour le bandeau (ratio fixe)
- Avatar `w-12 h-12 rounded-xl border-4 border-background` positionné `absolute -bottom-4 left-4` sur le parent `relative`
- Fallback avatar sans image : icône `<Users />` dans carré `bg-primary/10`
- Fallback cover sans image : gradient `from-primary/20 to-primary/5`
- `pt-6` dans la zone infos pour compenser l'avatar chevauchant

---

## Espace — `components/ui/SpaceCard.tsx`

```tsx
<Link to={`/spaces/${space.id}`} className="block rounded-lg border border-border hover:border-primary/30 hover:shadow-md transition-all overflow-hidden">
  {/* Bandeau cover */}
  {space.coverUrl ? (
    <div className="h-24 overflow-hidden">
      <img
        src={space.coverUrl}
        alt=""
        className="w-full h-full object-cover"
        style={{
          objectPosition: `${space.coverPositionX ?? 50}% ${space.coverPosition ?? 50}%`,
          transform: `scale(${(space.coverZoom ?? 100) / 100})`,
          transformOrigin: `${space.coverPositionX ?? 50}% ${space.coverPosition ?? 50}%`,
        }}
      />
    </div>
  ) : (
    <div className="h-24 bg-gradient-to-r from-primary/10 to-primary/5" />
  )}

  {/* Barre infos */}
  <div className="p-3 flex items-center gap-3">
    {space.avatarUrl ? (
      <img src={space.avatarUrl} alt="" className="w-9 h-9 rounded-lg object-cover flex-shrink-0" />
    ) : space.coverUrl ? (
      <img src={space.coverUrl} alt="" className="w-9 h-9 rounded-lg object-cover flex-shrink-0" style={{ objectPosition: 'top right' }} />
    ) : (
      <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
        <FolderOpen className="w-4 h-4 text-primary" />
      </div>
    )}
    <div className="flex-1 min-w-0">
      <p className="text-sm font-medium truncate">{space.name}</p>
    </div>
  </div>
</Link>
```

**Différences vs communauté :**
- Bandeau `h-24` (hauteur fixe) au lieu de `aspect-[3/1]`
- Avatar `w-9 h-9 rounded-lg` dans la barre infos (inline, pas chevauchant)
- Fallback gradient plus léger : `from-primary/10`

---

## Item — vignette dans ActivityPage

```tsx
<div
  className="w-48 flex-shrink-0 bg-card border border-border rounded-lg p-3 hover:bg-muted/40 cursor-pointer transition-colors flex flex-col gap-1.5"
  onClick={() => handleOpenItem(item.id, item.spaceId)}
>
  {/* Type + date */}
  <div className="flex items-center justify-between gap-1">
    <span className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-mono uppercase tracking-wide leading-none">
      {TYPE_LABELS[item.type] ?? item.type}
    </span>
    <span className="text-xs text-muted-foreground whitespace-nowrap">
      {timeAgo(item.activityAt)}
    </span>
  </div>

  {/* Titre */}
  <p className="font-medium text-sm line-clamp-2 leading-snug">{item.title}</p>

  {/* Statut + auteur */}
  <div className="flex items-center gap-1.5 mt-auto flex-wrap">
    {item.status && (
      <span className={`text-xs px-1.5 py-0.5 rounded-full ${STATUS_COLOR_MAP[item.status] ?? 'bg-muted text-muted-foreground'}`}>
        {STATUS_LABEL_MAP[item.status] ?? item.status}
      </span>
    )}
    {item.updatedBy && (
      <span className="text-xs text-muted-foreground truncate">{item.updatedBy.name}</span>
    )}
  </div>
</div>
```

**Règles :**
- `w-48 flex-shrink-0` dans un conteneur `flex flex-wrap gap-2`
- Pas d'image — carte compacte texte uniquement
- `mt-auto` sur la zone statut/auteur pour pousser vers le bas
- `line-clamp-2` sur le titre
- Utiliser `STATUS_COLOR_MAP` / `STATUS_LABEL_MAP` de `@spok/shared` pour les couleurs de statut

---

## Disposition groupée (ActivityPage)

```tsx
{/* Communauté */}
<div className="relative">
  <CommunityBanner community={group.community} />
  {/* bouton mute en absolute top-2 right-2 */}
</div>

{/* Espaces dans la communauté */}
{group.spaces.map(spaceGroup => (
  <div className="ml-3 space-y-1.5">
    <SpaceBanner space={spaceGroup.space} />
    {/* Items */}
    <div className="flex flex-wrap gap-2">
      {spaceGroup.items.map(item => <ItemCard key={item.id} item={item} />)}
    </div>
  </div>
))}
```

`CommunityBanner` et `SpaceBanner` dans ActivityPage sont des versions allégées de `CommunityListView.renderCommunityCard` et `SpaceCard` — même HTML/classes, sans les interactions de navigation.
