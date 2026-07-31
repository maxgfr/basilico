# basilico

**[→ Ouvrir l'application](https://maxgfr.github.io/basilico/)**

Un minuteur de focus basé sur la technique Pomodoro®, avec des tâches, des alertes et de vraies
statistiques. Tout est local : pas de compte, pas de serveur, pas de tracking.

> 🚧 En construction. Le squelette est déployé, le noyau de domaine est écrit et testé.

## Pourquoi encore un minuteur

Le minuteur est un problème résolu. Ce qui manque partout, c'est ce qui vient après : l'historique,
les rapports, et la possibilité de récupérer ses données. basilico met l'accent là-dessus.

- **Statistiques** — heatmap annuelle, série de jours, répartition par tâche et par tag, heures les
  plus productives, et la précision de tes estimations (l'objectif III de Cirillo, que presque
  personne ne restitue).
- **Compteur d'interruptions** — internes et externes, comme dans la méthode originale. Un focus
  définitivement interrompu est annulé, pas comptabilisé à moitié.
- **Modes overtime et Flowtime** — pour ceux que l'arrêt net à 25 minutes sort de leur flow.
- **Export/import** — JSON, CSV et [Open Pomodoro Format](https://github.com/open-pomodoro), en
  libre-service. Tes données t'appartiennent.

## Limites, dites franchement

- **Sans onglet ouvert, pas de notification.** Le Web Push exige un serveur, qu'on n'a pas par choix.
  L'app rattrape le temps écoulé à ton retour, et une extension Chrome est prévue pour couvrir le cas.
- **Les données vivent dans ton navigateur.** Vider ses données les efface. Safari supprime en plus
  tout le stockage des sites non visités depuis 7 jours. Fais des exports.
- **Pas de synchronisation.** Un navigateur, un historique. L'export/import sert à changer de machine.

## Développement

```bash
pnpm install
pnpm dev        # http://localhost:5173
pnpm test       # noyau + composants
pnpm typecheck
pnpm lint
pnpm build
```

Le projet est un monorepo pnpm :

- `packages/core` — le domaine (minuteur, cycles, sessions, tâches, statistiques). TypeScript pur,
  aucune dépendance au DOM, entièrement testé avec une horloge injectée.
- `apps/web` — l'interface React, et les adaptateurs navigateur (notifications, audio, stockage).

Les décisions de conception et leurs raisons sont dans [`docs/design.md`](docs/design.md).

## Navigateurs

Chrome 111+, Firefox 128+, Safari 16.4+ (contraintes de Tailwind v4).

## Licence

[MIT](LICENSE).

Pomodoro® et The Pomodoro Technique® sont des marques déposées de Francesco Cirillo. basilico n'est
ni affilié, ni associé, ni approuvé par Pomodoro®.
