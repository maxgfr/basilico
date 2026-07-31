# basilico

[![CI](https://github.com/maxgfr/basilico/actions/workflows/ci.yml/badge.svg)](https://github.com/maxgfr/basilico/actions/workflows/ci.yml)
[![Licence MIT](https://img.shields.io/badge/licence-MIT-blue.svg)](LICENSE)

### **[→ Ouvrir l'application](https://maxgfr.github.io/basilico/)**

Un minuteur de focus basé sur la technique Pomodoro®, avec des tâches, des alertes et de vraies
statistiques. Tout est local : pas de compte, pas de serveur, pas de tracking, pas de publicité.

![L'écran principal de basilico : anneau de progression, tâches et compteur d'interruptions](docs/images/timer.png)

## Pourquoi encore un minuteur

Le minuteur est un problème résolu. Ce qui manque partout, c'est ce qui vient après : l'historique,
les rapports, et la possibilité de récupérer ses données. basilico met l'accent là-dessus.

|                          |                                                                                                                                                                                                        |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Statistiques**         | Heatmap sur un an, série de jours, répartition par tâche et par tag, heures les plus productives, et la précision de tes estimations — l'objectif III de Cirillo, que presque aucun outil ne restitue. |
| **Interruptions**        | Comptées comme dans la méthode originale : internes (`'`) et externes (`-`). Un focus définitivement interrompu est annulé, pas comptabilisé à moitié.                                                 |
| **Overtime et Flowtime** | Le compteur peut continuer au-delà de zéro, ou tourner en chronomètre libre avec une pause proportionnelle. Pour ceux que l'arrêt net à 25 minutes sort de leur flow.                                  |
| **Affichage réglable**   | Exact, approché (« environ 24 minutes »), pourcentage, ou caché. Regarder les secondes s'égrener angoisse beaucoup de gens.                                                                            |
| **Export et import**     | JSON, CSV et [Open Pomodoro Format](https://github.com/open-pomodoro), en libre-service. Tes données t'appartiennent.                                                                                  |
| **Fenêtre flottante**    | Le minuteur détaché en petite fenêtre toujours au-dessus, via l'API Document Picture-in-Picture (Chromium).                                                                                            |
| **Hors ligne**           | Installable en PWA, fonctionne sans réseau.                                                                                                                                                            |

![Les statistiques : quatorze jours, heatmap annuelle, heures productives, interruptions et précision d'estimation](docs/images/stats.png)

<sub>Les captures utilisent des données de démonstration générées, pas de vraies sessions.</sub>

## Ce qu'il faut savoir avant de s'en servir

Ce sont les reproches classiques faits aux minuteurs web. Autant les dire franchement.

- **Sans onglet ouvert, pas de notification.** Le Web Push exige un serveur et des clés VAPID, qu'on
  n'a pas par choix ; l'API qui aurait résolu ça sans serveur (Notification Triggers) a été
  abandonnée par Chrome. Deux réponses : l'app **rattrape** le temps écoulé à ton retour — la session
  est enregistrée à sa vraie heure de fin, avec un « terminé il y a X minutes » — et
  [l'extension Chrome](#extension-chrome) couvre vraiment le cas de l'onglet fermé.
- **Les données vivent dans ton navigateur.** Vider les données du site les efface. Safari supprime
  en plus tout le stockage des sites non visités depuis 7 jours. L'app demande le stockage persistant
  et propose l'export en un clic — fais-en.
- **Pas de synchronisation.** Un navigateur, un historique. L'export/import sert à changer de machine.

## Extension Chrome

Sans elle, aucune notification ne peut partir quand l'onglet est fermé. L'extension pose une vraie
alarme système, qui survit à la fermeture de l'onglet et à la mise en veille du service worker.

Elle est délibérément **un notificateur, pas un second minuteur** : l'application reste la seule
source de vérité et lui annonce simplement son échéance. Deux minuteurs indépendants finiraient par
diverger, et il faudrait arbitrer lequel a raison.

```bash
pnpm --filter @basilico/extension build
```

Puis, dans Chrome : `chrome://extensions` → activer le mode développeur → **Charger l'extension non
empaquetée** → choisir `apps/extension/dist`. Recharge l'onglet basilico : les réglages affichent
« Extension Chrome — Détectée ».

Elle n'est pas publiée au Chrome Web Store pour l'instant (compte développeur payant et délai de
revue). Le dialogue avec la page passe par un content script limité à l'origine de l'application ;
l'extension ne lit rien d'autre.

## Raccourcis clavier

| Touche    | Action                                     |
| --------- | ------------------------------------------ |
| `Espace`  | Démarrer ou mettre en pause                |
| `R`       | Réinitialiser la phase                     |
| `S`       | Passer à la phase suivante                 |
| `I` / `E` | Compter une interruption interne / externe |
| `T`       | Aller aux statistiques                     |

## Développement

```bash
pnpm install
pnpm dev          # http://localhost:5173
pnpm test         # noyau + composants
pnpm typecheck
pnpm lint
pnpm build
```

Monorepo pnpm :

- **`packages/core`** — le domaine : minuteur, cycles, sessions, tâches, statistiques, sauvegardes.
  TypeScript pur, aucune dépendance au DOM, testé avec une horloge injectée plutôt qu'avec de vraies
  attentes.
- **`apps/web`** — l'interface React et les adaptateurs navigateur (notifications, audio, stockage,
  wake lock).

Le minuteur est piloté par une **échéance absolue** et jamais par un compteur décrémenté : le temps
restant se recalcule à partir de l'horloge, ce qui le rend insensible au throttling des onglets en
arrière-plan, à la mise en veille de la machine et au rechargement de la page. Les décisions de
conception et leurs raisons sont dans [`docs/design.md`](docs/design.md).

Les graphes sont du SVG écrit à la main : zéro dépendance, et chaque figure est doublée d'un tableau
lisible au lecteur d'écran — ce qu'aucune bibliothèque de charts en canvas ne sait faire.

## Navigateurs

Chrome 111+, Firefox 128+, Safari 16.4+.

## Pas encore fait

- **Interface en anglais** — le réglage `locale` existe déjà dans le schéma mais n'est pas branché
  sur les textes ([#4](https://github.com/maxgfr/basilico/issues/4)).

## Contribuer

Les issues et les pull requests sont bienvenues — voir [CONTRIBUTING.md](CONTRIBUTING.md).

## Licence

[MIT](LICENSE).

Pomodoro® et The Pomodoro Technique® sont des marques déposées de Francesco Cirillo. basilico n'est
ni affilié, ni associé, ni approuvé par Pomodoro®.
