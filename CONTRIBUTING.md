# Contribuer à basilico

Merci d'y jeter un œil. Les issues et les pull requests sont bienvenues.

## Démarrer

```bash
pnpm install
pnpm dev
```

Avant d'ouvrir une pull request :

```bash
pnpm lint && pnpm typecheck && pnpm test && pnpm build
```

Les tests de bout en bout demandent un navigateur :

```bash
pnpm --filter @basilico/web exec playwright install chromium
pnpm --filter @basilico/web e2e
```

## Où mettre quoi

- `packages/core` — toute logique métier. **Aucune dépendance au DOM, et jamais d'accès direct à
  l'horloge** : le temps est toujours passé en paramètre. C'est ce qui rend le minuteur testable.
- `apps/web/src/platform` — tout ce qui touche au navigateur (notifications, audio, stockage, wake
  lock). Isolé ici pour que le reste de l'app reste testable en jsdom.
- `apps/web/src/features` — un dossier par écran.

## Deux règles qui ne se négocient pas

1. **Le temps restant se calcule, il ne se décrémente pas.** Toute logique qui fait `restant -= 1000`
   dérivera de plusieurs minutes dès que l'onglet passera en arrière-plan. On stocke une échéance
   absolue et on la compare à `Date.now()`.
2. **Le journal des sessions ne se réécrit pas.** Les statistiques sont recalculées à partir de lui ;
   une session enregistrée ne change plus, à l'exception de l'annotation (note, ressenti, tag).

## Avant de proposer une grosse fonctionnalité

Ouvre une issue d'abord — ça évite d'écrire du code pour rien si la direction ne colle pas.

## Style

Prettier et oxlint s'en chargent (`pnpm format`). Les commentaires expliquent **pourquoi**, pas quoi :
le code dit déjà ce qu'il fait. Les messages de commit et les commentaires sont en français, comme le
reste du projet.
