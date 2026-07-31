# basilico — minuteur de focus open source (GitHub + GitHub Pages)

## Context

Rien n'existe aujourd'hui : le projet part de zéro dans un nouveau repo public **`maxgfr/basilico`**,
déployé en site statique sur **`https://maxgfr.github.io/basilico/`**.

Le besoin : un outil de focus complet, **sans backend, sans compte, sans tracking**, qui permet
d'enchaîner des sessions avec pauses courtes et longues, de rattacher chaque session à une tâche,
d'être prévenu par **notification + son**, de consulter des **statistiques de temps de travail**, et
de tout **configurer** et **exporter**. Les données vivent uniquement dans le navigateur.

Le nom évite « Pomodoro », marque déposée de Francesco Cirillo dont les guidelines interdisent son
usage dans un nom de produit ou de domaine (d'où _Marinara_, _Pomatez_, _FocusTide_ chez les projets
sérieux). Le README décrira l'app comme « un minuteur de focus basé sur la technique Pomodoro® » avec
le disclaimer de non-affiliation — usage explicitement autorisé.

**Le vrai angle du projet.** La revue de l'existant est nette : _le minuteur est un problème résolu,
tout le monde s'arrête à l'historique, aux rapports et à l'export_. FocusTide (401 ★) n'a aucune
statistique. Marinara (2,5 k ★) est mort avec Manifest V3. Pomofocus met l'export CSV derrière un
paywall. Aucun projet open source recensé ne livre de heatmap, de compteur d'interruptions, ni
d'import. C'est là qu'on se place.

### Décisions arrêtées avec l'utilisateur

| Décision           | Choix                                                                                                          |
| ------------------ | -------------------------------------------------------------------------------------------------------------- |
| Repo / URL         | `maxgfr/basilico` → `maxgfr.github.io/basilico/`, Pages via GitHub Actions                                     |
| Alertes            | PWA (notif + son + titre d'onglet) **et** rattrapage au retour d'onglet **et** extension Chrome MV3 en phase 2 |
| Données            | 100 % local (localStorage derrière un module unique) + export/import JSON + export CSV                         |
| Direction visuelle | calme & focus : anneau de progression, chiffres tabulaires, teinte par mode, sombre par défaut                 |
| Extras v1          | mode overtime/Flowtime · affichage du temps configurable · compteur d'interruptions · fenêtre flottante PiP    |

## Périmètre fonctionnel

**Minuteur**

- Modes `focus` / `shortBreak` / `longBreak`, durées configurables. Défauts canoniques Cirillo :
  25 / 5 / 15, longue pause tous les 4 focus. **Presets** 25-5, 50-10, 52-17 (le 25 fixe est le
  reproche le plus récurrent — les profils TDAH demandent des sessions plus longues).
- Start / pause / reprise / reset / skip, auto-start des pauses et des focus (deux réglages distincts).
- **Affichage configurable** : exact `23:41` · approximatif « environ 24 minutes » · pourcentage · caché.
  Répond à l'anxiété du compte à rebours, très demandée et quasi jamais implémentée.
- **Mode overtime** : à zéro, le compteur continue en positif au lieu de s'arrêter, chime doux puis
  relance toutes les 10 min. **Mode Flowtime** : chronomètre libre, pause proposée proportionnelle au
  temps travaillé (~1/5). C'est la réponse à l'objection n°1 (« ça casse mon flow »).
- Alertes échelonnées optionnelles : 60 s avant la fin du focus, 30 s avant la fin de la pause.
- Titre d'onglet qui décompte, favicon coloré par mode.
- **Fenêtre flottante** via l'API Document Picture-in-Picture (Chromium) : minuteur toujours visible
  au-dessus des autres fenêtres, avec repli propre là où l'API n'existe pas.
- Wake Lock optionnel, désactivé par défaut.

**Tâches**

- Liste avec estimation en pomodoros affichée en pastilles `●●●○○ 3/5`, tâche active à laquelle les
  sessions se rattachent, réordonnancement, terminer, archiver, supprimer.
- Tag/projet et note libre par tâche. Intention avant la session, note et ressenti après (optionnels) —
  c'est ce qui transforme un rapport d'heures en journal de travail.
- Compteur incrémenté **à la fin** d'un focus, jamais au début.

**Interruptions** (canon Cirillo, presque jamais implémenté)

- Un bouton pendant le focus : interruption **interne** (`'`) ou **externe** (`-`).
- Un focus définitivement interrompu est enregistré `voided` — pas de demi-pomodoro, conformément à
  la règle « A Pomodoro Is Indivisible ». Les stats distinguent terminé / voidé / passé.
- Alimente une stat « qui te coupe, combien de fois, à quelle heure ».

**Alertes**

- Notification système à chaque fin de session, avec actions (« Démarrer la pause » / « +5 min »).
- Son configurable (synthétisé + fichiers CC0), volume, test dans les réglages, tic-tac optionnel.
- Changement d'état visible dans la page + annonce `aria-live`.
- **Rattrapage** : si l'onglet était masqué, gelé ou rechargé, l'app clôture la session à l'heure
  exacte et affiche « ta session s'est terminée il y a X min ».

**Statistiques** (le différenciateur)

- Aujourd'hui : minutes de focus, sessions terminées, tâches terminées, objectif quotidien.
- Barres jour par jour, tendance semaine/mois, **heatmap annuelle** type contributions GitHub, streak.
- Répartition par tâche et par tag, heures de la journée les plus productives.
- **Précision d'estimation** (estimé vs réel par tâche) — l'objectif III de Cirillo, jamais livré ailleurs.
- Interruptions par jour et par type. Taux de complétion.
- Export CSV, export/import JSON complet, et export au **Open Pomodoro Format** pour l'interopérabilité.

**Réglages**

- Durées et presets, intervalle de longue pause, auto-start, objectif quotidien, mode overtime/Flowtime.
- Sons, notifications, wake lock, PiP, alertes échelonnées.
- Thème système/clair/sombre, langue FR/EN, début de semaine, format 12/24 h, mode d'affichage du temps.
- Raccourcis clavier (espace start/pause, `R` reset, `S` skip, `N` nouvelle tâche, `?` aide).
- Sauvegarde : bouton d'export, état du stockage persistant, rappel si aucune sauvegarde depuis N jours,
  réinitialisation avec confirmation explicite.

## Architecture

Le cœur du projet est un **noyau de domaine sans DOM**, réutilisable par l'app web et par l'extension.
C'est ce qui rend le minuteur testable (temps injecté, aucun `setInterval` dans la logique) et ce qui
évite de réécrire la logique une deuxième fois pour l'extension.

```
basilico/
├─ packages/core/          # TypeScript pur, zéro DOM, testé exhaustivement
│   ├─ timer.ts            # machine à états : idle|running|paused|overtime|finished × focus|short|long
│   ├─ cycle.ts            # enchaînement des modes, intervalle de longue pause, auto-start, Flowtime
│   ├─ sessions.ts         # journal append-only
│   ├─ tasks.ts            # CRUD, estimations, compteurs
│   ├─ stats.ts            # agrégations pures (jour/semaine/mois/tag/heure/streak/précision)
│   ├─ settings.ts         # schéma + défauts + migrations versionnées
│   └─ backup.ts           # export/import JSON validé, CSV, Open Pomodoro Format
├─ apps/web/               # Vite + React + TypeScript + Tailwind, PWA
│   ├─ src/features/{timer,tasks,stats,settings}/
│   ├─ src/platform/       # adaptateurs navigateur : notifications, audio, stockage, wakelock, PiP, titre
│   └─ public/sw.js        # servi à la racine /basilico/ — obligatoire (voir pièges)
├─ apps/extension/         # phase 2 — Chrome MV3
└─ .github/workflows/      # ci.yml + deploy.yml
```

**Ports de plateforme** : `core` ne connaît que des interfaces (`Clock`, `SessionStore`,
`SettingsStore`, `Notifier`, `SoundPlayer`). L'app web et l'extension fournissent leurs
implémentations, les tests fournissent des fakes — aucun test ne dépend du vrai temps.

### Règle d'or du minuteur

L'état persisté est `{ mode, startedAt, endsAt, pausedAt, pausedTotalMs }`. Le temps restant est
**calculé** (`endsAt - now`), jamais décrémenté. Trois mécanismes complémentaires, parce qu'aucun
n'est fiable seul :

1. **`Date.now()`, pas `performance.now()`** — l'horloge monotone ne tourne pas pendant la veille
   système sur macOS et Linux : capot fermé 20 min = minuteur en retard de 20 min. Garde-fou contre
   les sauts d'horloge : un delta supérieur à la durée de session est traité comme « terminée pendant
   l'absence », pas comme une dérive.
2. **Deux timers distincts** : un `setInterval(~250 ms)` uniquement pour repeindre les chiffres quand
   la page est visible (arrêté dès qu'elle est masquée), et **un seul `setTimeout(restant)` non
   imbriqué** armé sur l'échéance exacte. Un `setTimeout` de niveau d'imbrication 1 échappe à
   l'_intensive throttling_ de Chrome (qui exige ≥ 5 niveaux) : au pire il tire ~1 s en retard.
   Réarmé à chaque `visibilitychange`.
3. **Réconciliation** sur `visibilitychange`, `pageshow` (bfcache), `resume` (Page Lifecycle) et
   `document.wasDiscarded` au boot. C'est ce qui produit « ta session s'est terminée il y a X min »
   au lieu d'un saut silencieux à 00:00.

Ce qui reste hors de notre contrôle : depuis Chrome 133, l'**Energy Saver gèle** un onglet caché et
silencieux depuis plus de 5 min s'il consomme du CPU — le JS s'arrête net, sans erreur. D'où (a) une
consommation quasi nulle quand la page est masquée, (b) l'alarme **planifiée sur l'horloge audio**,
qui survit au gel, (c) la réconciliation au retour, (d) l'extension de la phase M7 comme seule vraie
réponse.

**Son** : l'alarme est planifiée sur l'horloge audio (`source.start(ctx.currentTime + restant)`),
matérielle et indépendante de la boucle JS — elle sonne à la seconde près même si le thread principal
est ralenti ou gelé. Un déclenchement JS de secours, protégé par un drapeau anti-doublon, couvre le
cas Safari. Chime synthétisé à l'`OscillatorNode` (zéro octet, zéro licence) plus quelques fichiers CC0.

### Pièges navigateur à traiter dès l'implémentation

| Piège                                       | Conséquence si ignoré                                                                                                                                        | Traitement                                                                                                       |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| `new Notification()` sur Android            | `TypeError`, aucune alerte, échec silencieux                                                                                                                 | `registration.showNotification()` **partout**, constructeur en simple repli                                      |
| Permission demandée au chargement           | refus automatique, état **définitif** et non reproposable                                                                                                    | demandée au premier clic « Démarrer », derrière un pré-prompt maison ; écran d'aide si `denied`                  |
| `actions` sur les notifications             | ignorées hors service worker, rendu variable selon l'OS                                                                                                      | jamais le seul chemin vers une action                                                                            |
| `requireInteraction`                        | absent de Safari, approximatif sur macOS                                                                                                                     | décoration, on ne s'appuie jamais dessus                                                                         |
| `AudioContext` créé au chargement           | `suspended`, alarme muette                                                                                                                                   | `resume()` dans le handler du clic « Démarrer », buffer décodé une fois                                          |
| Safari en arrière-plan                      | contexte `interrupted`, alarme planifiée perdue                                                                                                              | vérification de `ctx.state` sur `visibilitychange` + repli JS                                                    |
| Astuce « audio silencieux » anti-throttling | ne marche pas (Chrome ignore les flux silencieux), allume l'indicateur audio, vide la batterie                                                               | on n'y touche pas                                                                                                |
| `beforeunload` pour sauvegarder             | perte d'état sur mobile, casse le bfcache                                                                                                                    | sauvegarde sur `visibilitychange → hidden`                                                                       |
| `sw.js` dans un sous-dossier                | enregistrement refusé (scope trop large), **aucun contournement possible** sur Pages (pas d'en-têtes)                                                        | `sw.js` servi à la racine `/basilico/`                                                                           |
| `"start_url": "/"`                          | l'app installée ouvre `maxgfr.github.io` au lieu de basilico                                                                                                 | `start_url: "./"`, `scope: "./"`, `id` explicite                                                                 |
| **Origine partagée `maxgfr.github.io`**     | collisions de clés avec tes autres projets Pages, et l'éviction supprime **toute** l'origine d'un coup ; un service worker de scope `/` peut prendre la main | tout préfixé `basilico:v1:`, base IndexedDB et caches nommés, purge des caches non correspondants à l'`activate` |
| Wake lock                                   | libéré dès que la page est masquée, jamais restauré                                                                                                          | ré-acquisition sur `visibilitychange`, option désactivée par défaut                                              |
| Routing SPA sur Pages                       | 404 au rechargement d'une sous-vue                                                                                                                           | **routing par hash** (`#/stats`) — zéro serveur, zéro flash de redirection, marche à l'identique en PWA          |

## Modèle de données

Journal **append-only** : une session écrite n'est jamais modifiée, ce qui rend les stats
recalculables et l'import/export triviaux.

```ts
type SessionRecord = {
  id: string
  mode: 'focus' | 'shortBreak' | 'longBreak'
  startedAt: number // epoch ms
  endedAt: number
  plannedMs: number
  actualMs: number // hors temps de pause
  overtimeMs: number // temps travaillé au-delà de zéro
  outcome: 'completed' | 'voided' | 'skipped'
  taskId?: string
  tag?: string
  interruptions: { internal: number; external: number }
  intention?: string
  note?: string
  rating?: 1 | 2 | 3 | 4 | 5
}

type Task = {
  id: string
  title: string
  notes?: string
  tag?: string
  estimatedPomodoros: number
  completedPomodoros: number
  status: 'active' | 'done' | 'archived'
  order: number
  createdAt: number
  completedAt?: number
}

type Settings = {
  schemaVersion: number
  durations: { focus: number; shortBreak: number; longBreak: number }
  longBreakEvery: number
  autoStartBreaks: boolean
  autoStartFocus: boolean
  mode: 'classic' | 'overtime' | 'flowtime'
  display: 'exact' | 'approximate' | 'percent' | 'hidden'
  dailyGoalMinutes: number
  sound: { enabled: boolean; alarm: string; volume: number; ticking: boolean }
  notifications: { enabled: boolean; staged: boolean }
  wakeLock: boolean
  pip: boolean
  theme: 'system' | 'light' | 'dark'
  locale: 'fr' | 'en'
  weekStartsOn: 0 | 1
  hourFormat: 12 | 24
}
```

- **localStorage**, clés `basilico:v1:{state,settings,sessions,tasks}`, derrière un unique
  `storage.ts`. L'écriture synchrone est ici une qualité : elle est garantie avant que l'onglet soit
  déchargé, et la lecture au boot évite le flash. Écriture aux transitions d'état et sur
  `visibilitychange`, **jamais à chaque tick**.
- `schemaVersion` + migrations pures et testées dès la v1 (les rétrofiter plus tard est douloureux).
- `navigator.storage.persist()` demandé après la première interaction utile (les chances augmentent
  si la permission notification est accordée ou l'app installée), état affiché dans les réglages.

## Stack

Versions vérifiées sur le registre npm au 31/07/2026 — plusieurs ont bougé récemment et les
tutoriels en circulation sont périmés.

| Besoin     | Choix                                           | Version               | Raison                                                                                                                                                                    |
| ---------- | ----------------------------------------------- | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Build      | **Vite** (Rolldown par défaut)                  | `^8.2.0`              | build statique ; Node 22 requis                                                                                                                                           |
| UI         | **React + TypeScript**                          | `^19.2.8`             | l'écosystème où sont les contributeurs de passage                                                                                                                         |
| TypeScript | **épinglé en 6.x**                              | `~6.0.3`              | ⚠️ voir gotcha ci-dessous                                                                                                                                                 |
| Lint       | **oxlint** (+ `oxlint-tsgolint`)                | `^1.76`               | c'est ce que livre désormais le template officiel `create-vite`, et ça contourne le problème TS 7                                                                         |
| Styles     | **Tailwind v4** via `@tailwindcss/vite`         | `^4.3.3`              | thème en CSS (`@theme`), plus aucun fichier de config JS, ni PostCSS ni autoprefixer                                                                                      |
| État       | **zustand** + `persist`                         | `^5.0.14`             | 0,5 ko gz ; sélecteurs par champ, indispensable quand le minuteur tick                                                                                                    |
| PWA        | **vite-plugin-pwa** (Workbox)                   |                       | manifest + service worker générés                                                                                                                                         |
| Graphiques | **SVG écrit à la main**                         | 0 ko                  | ~120 lignes pour l'anneau, les barres et la heatmap. Recharts pèse 144 ko gz — plus que toute l'app — et ses charts canvas ne rendent _rien_ dans l'arbre d'accessibilité |
| Validation | **zod**                                         |                       | imports JSON et migrations                                                                                                                                                |
| Tests      | **Vitest 4** + Testing Library + **Playwright** | `^4.1.10` / `^1.62.1` |                                                                                                                                                                           |
| Format     | Prettier + `.editorconfig`                      |                       |                                                                                                                                                                           |

**Gotchas à ne pas découvrir en route :**

- 🔴 **Ne pas installer TypeScript 7.** Il est `latest` depuis juillet 2026 (réécriture Go, 8–12× plus
  rapide) mais n'expose pas encore d'API programmatique stable : `typescript-eslint` déclare
  `<6.1.0` en peer et `npm install` échoue en `ERESOLVE`. Le template officiel React-TS épingle
  lui-même `~6.0.2`. On prend `~6.0.3` et **oxlint**, dont le moteur type-aware est bâti sur TS 7.
- 🟠 **Vite 8 a renommé la config** : `build.rollupOptions` → `build.rolldownOptions`. Silencieux si
  on se trompe. `@vitejs/plugin-react@6` exige Vite 8 et a **supprimé Babel** (donc plus d'option
  `react({ babel })`). On saute le React Compiler : il réintroduit une passe Babel dans un pipeline
  tout-Rust pour mémoïser une UI qui re-rend une fois par seconde.
- 🟠 **Vitest 4** : `coverage.all` supprimé, `coverage.include` devient **obligatoire** sinon la
  couverture ne compte que les fichiers touchés et affiche un score flatteur et faux.
- 🟡 **Tailwind v4** : la couleur de bordure par défaut est `currentColor` (plus `gray-200`), le `!`
  est un **suffixe**. Plancher navigateur **Firefox 128+ / Safari 16.4+ / Chrome 111+** — plus strict
  que la cible par défaut de Vite, à écrire dans le README.
- 🟡 **zustand `persist`** : ne jamais persister `remainingMs` ni `isRunning` (un rechargement
  ressusciterait un minuteur périmé). On persiste `endsAt` absolu via `partialize`, et on pose
  `version: 1` + `migrate` dès le premier jour. Le `merge` par défaut est **superficiel** : un champ
  ajouté dans un objet `settings` imbriqué n'apparaîtra jamais chez les utilisateurs existants — d'où
  un merge profond explicite.
- 🟡 **`userEvent` + `vi.useFakeTimers()` se bloquent** l'un l'autre sauf en passant
  `advanceTimers: vi.advanceTimersByTime` à `userEvent.setup()`. On teste plutôt le store avec de faux
  timers (sans React, rapide et déterministe) et les composants avec de vrais timers sur état injecté.

**Stockage : localStorage suffit, et c'est un choix, pas un raccourci.** Un enregistrement de session
pèse ~100 octets ; 10 sessions par jour pendant un an ≈ 300 ko, pour un quota de ~5 Mo. IndexedDB
n'apporterait rien (il subit exactement la même éviction Safari) tout en ajoutant de l'asynchrone
partout. Tout passe donc par un module `storage.ts` unique, avec `idb-keyval` comme porte de sortie
documentée si l'historique dépassait un jour ~2 Mo (contrôlé via `navigator.storage.estimate()`).

Monorepo **pnpm workspaces** : `packages/core` est consommé par `apps/web` puis par `apps/extension`.
C'est ce partage qui justifie le workspace — sans l'extension, un dossier `src/core` suffirait.

## Déploiement

Les versions d'actions publiées dans la plupart des tutoriels (et dans la doc GitHub elle-même) sont
en retard sur les tags réels. Les bonnes, vérifiées aujourd'hui :

```yaml
# .github/workflows/deploy.yml
permissions: { contents: read, pages: write, id-token: write }
concurrency: { group: pages, cancel-in-progress: false } # ne jamais annuler un déploiement en cours
jobs:
  build:
    steps:
      - uses: actions/checkout@v7
      - uses: actions/setup-node@v7 # node-version: 22 — Vite 8 exige >=20.19 ou >=22.12
      - run: pnpm install --frozen-lockfile && pnpm build
      - uses: actions/configure-pages@v6
      - uses: actions/upload-pages-artifact@v5
        with: { path: apps/web/dist }
  deploy:
    needs: build # sans ça, le job attend un artefact qui n'existera jamais
    environment: { name: github-pages, url: '${{ steps.deployment.outputs.page_url }}' }
    steps:
      - id: deployment
        uses: actions/deploy-pages@v5
```

- **Étape manuelle unique** : Settings → Pages → Source = **GitHub Actions**. Aucun workflow ne peut
  la faire à ta place ; sans elle le déploiement échoue en 404 sur l'API Pages.
- Si le job de déploiement renvoie un 403 à la résolution de l'artefact, ajouter `actions: read` —
  c'est documenté dans les notes de version de `deploy-pages@v4`, jamais dans son README.
- `base` sensible à l'environnement pour que `vite dev` et Vitest restent à la racine :
  `base: process.env.GITHUB_ACTIONS ? '/basilico/' : '/'`. Tout chemin absolu écrit en dur
  (`/sounds/ding.mp3`) casse : on passe par `import.meta.env.BASE_URL` ou par un import d'asset.
- `.nojekyll` est **inutile** avec un déploiement par Actions (Jekyll ne tourne pas) — c'est le seul
  conseil des vieux tutoriels qu'on peut supprimer sans risque.
- CI séparée du déploiement : `ci.yml` (lint, typecheck, tests, build) avec
  `cancel-in-progress: true`, plus un job e2e distinct pour qu'un flake Playwright ne masque pas une
  erreur de type. Cache Playwright indexé sur la **version exacte** (pas de `restore-keys`, un hit
  partiel donne la mauvaise révision de navigateur) et `--with-deps` jamais oublié.

## Brief design (mode Operate)

Direction épinglée : **calme & focus**. En mode Operate l'outil doit disparaître dans la tâche ;
la personnalité passe par la précision des détails, pas par le volume.

- **Écran principal** : l'anneau de progression et le temps occupent le premier viewport, tâche active
  juste dessous, liste de tâches en colonne latérale sur desktop et feuille repliable sur mobile.
  Stats et réglages sont des vues à part entière, pas des modales.
- **Couleur** : stratégie _Restrained_ — neutres plus une teinte porteuse qui change selon le mode.
  La teinte occupe l'anneau et l'ambiance de fond, pas des accents dispersés. Sombre par défaut
  (scène réelle : bureau, sessions longues, souvent le soir).
- **Typo** : une seule famille, **chiffres tabulaires** pour le compte à rebours (sinon les chiffres
  dansent), échelle rem fixe, ratio serré (1,125–1,2).
- **Motion** : 150–250 ms, uniquement pour signaler un changement d'état. `prefers-reduced-motion`
  respecté. Aucune chorégraphie au chargement.
- **États obligatoires** : premier lancement, permission notification refusée, stockage évincé, import
  invalide, overtime en cours, 500+ tâches, aucune donnée dans les stats.
- **Anti-objectifs** : gamification, badges, streak culpabilisant, modale de bienvenue, décor inutile.
- Chaque composant interactif livre `default / hover / focus / active / disabled`.
- Accessibilité visée WCAG AA : contraste vérifié dans les deux thèmes, `role="timer"` +
  `aria-live="polite"` sur les changements d'état (pas chaque seconde), navigation clavier complète.
- **Graphiques accessibles**, ce que la plupart des libs ne savent pas faire : chaque graphe est un
  `<figure>` contenant un `<svg role="img">` avec `<title>`/`<desc>`, doublé d'un tableau `sr-only`
  reprenant les mêmes chiffres — lisible au lecteur d'écran, sélectionnable, copiable. Jamais de
  distinction par la couleur seule (WCAG 1.4.1) : forme ou libellé en plus. Le premier palier de la
  heatmap doit atteindre 3:1 contre les cases vides.

## Jalons

**M0 — Squelette qui se déploie.** `gh repo create maxgfr/basilico --public`, pnpm workspaces,
`apps/web` (Vite + React + TS + Tailwind), `packages/core`, lint/format, `ci.yml` (lint, typecheck,
test, build) et `deploy.yml` vers Pages (source = GitHub Actions, permissions `pages: write` et
`id-token: write`). On met en ligne une page minimale **avant** toute fonctionnalité : le pipeline est
validé tôt, pas la veille. Ce plan est versionné dans le repo en `docs/design.md` au premier commit,
pour que les décisions et leurs raisons restent lisibles par les contributeurs.

**M1 — Noyau de domaine, en TDD.** `timer`, `cycle`, `sessions`, `stats`, `settings`, `backup`.
Tests avec horloge injectée : dérive, pause/reprise, longue pause tous les N, onglet masqué 40 min,
overtime, Flowtime, changement de durée en cours de session, minuit, changement d'heure été/hiver.

**M2 — Minuteur utilisable.** Anneau + compte à rebours, modes d'affichage, contrôles, presets,
persistance et reprise après rechargement, titre d'onglet, favicon dynamique, raccourcis clavier.

**M3 — Tâches.** Liste, tâche active, estimations en pastilles, réordonnancement, terminer/archiver,
rattachement automatique des sessions, intention et note de session.

**M4 — Alertes et interruptions.** Permission au premier geste, notification via service worker avec
actions, alarme planifiée sur l'horloge audio, volume et test, tic-tac, alertes échelonnées,
rattrapage au retour, wake lock, compteur d'interruptions et sessions voidées.

**M5 — Statistiques.** Jour/semaine/mois, heatmap annuelle, streak, répartition tâche et tag, heures
productives, précision d'estimation, interruptions. Export CSV, export/import JSON, Open Pomodoro
Format, `navigator.storage.persist()` et rappel de sauvegarde.

**M6 — Finition.** PWA installable et hors-ligne, fenêtre flottante PiP, i18n FR/EN, thèmes, états
vides et d'erreur, passe accessibilité, passe design `impeccable` (revue de finition + captures),
README avec captures et GIF, LICENSE MIT, disclaimer de marque, CONTRIBUTING, templates d'issues,
Dependabot.

**M7 — Extension Chrome MV3.** Service worker d'extension + `chrome.alarms` pour l'échéance,
`chrome.notifications` pour l'alerte, document _offscreen_ pour le son (un service worker MV3 ne peut
pas jouer d'audio directement), badge avec les minutes restantes, popup réutilisant `packages/core`.
Pont avec l'app web via `externally_connectable` limité à `https://maxgfr.github.io/*` : l'app déclare
son échéance à l'extension, l'extension alerte même onglet fermé, l'app réconcilie le journal au retour.
Publication au Chrome Web Store optionnelle (compte développeur 5 $) — l'extension reste installable
en mode développeur sans publier.

## Limites assumées, écrites dans le README

Ce sont exactement les reproches faits aux minuteurs web existants ; mieux vaut les annoncer que les
subir en issue.

- **Sans onglet ouvert, pas de notification** côté web : le Web Push exige un serveur et des clés VAPID,
  qu'on n'a pas par choix ; l'API Notification Triggers, qui aurait résolu ça, a été **abandonnée** par
  Chrome ; le Periodic Background Sync impose un intervalle minimum de ~12 h. D'où le rattrapage (M4)
  et l'extension (M7). Une ligne discrète dans l'UI l'explique à côté du bouton Démarrer.
- **Les données sont locales.** Vider les données du navigateur les efface. Safari supprime en plus
  _tout_ le stockage scriptable (localStorage, IndexedDB **et l'enregistrement du service worker**)
  après 7 jours d'utilisation de Safari sans visite du site — un utilisateur qui part deux semaines
  en vacances retrouve l'app vide. D'où `persist()`, l'incitation à installer l'app (exemption
  documentée), le rappel de sauvegarde et l'export en un clic.
- **Un seul navigateur = un seul historique.** Pas de sync : export/import pour changer de machine.

## Hygiène open source

MIT (texte verbatim de choosealicense, sinon GitHub affiche « Other » au lieu du badge), README avec
le lien de démo tout en haut et un GIF (un minuteur se vend en image, pas en prose), fonctionnalités,
raccourcis, dev en trois commandes, limites, plancher navigateur, disclaimer de marque Pomodoro®.
CONTRIBUTING court, CODE_OF_CONDUCT (Contributor Covenant), **issue forms YAML** plutôt que les vieux
templates Markdown — les champs obligatoires suppriment les tickets « ça marche pas » — avec
`blank_issues_enabled: false`. `dependabot.yml` sur npm **et** `github-actions`, avec `groups:` :
sans groupement c'est douze PR par semaine qu'on cesse de lire.

Écartés volontairement : semantic-release et changesets (ils servent à publier sur npm ; ici chaque
push sur `main` est déjà une release, un `CHANGELOG.md` à la main suffit), les hooks pre-commit (la CI
fait déjà barrage et les hooks se font `--no-verify` par les contributeurs de passage), Storybook,
badges de couverture.

## Vérification

- `pnpm lint && pnpm typecheck && pnpm test` — toutes les branches de la machine à états couvertes ;
  les scénarios de dérive se testent avec `vi.setSystemTime` (qui avance l'horloge **sans** déclencher
  les timers, exactement le cas « onglet gelé »), jamais avec de vraies attentes.
- `pnpm build && pnpm preview`, puis : démarrer un focus, masquer l'onglet 2 min, revenir → le temps
  restant est exact à la seconde près.
- Rattrapage réel : focus d'1 min, fermer l'onglet, rouvrir après 3 min → session enregistrée comme
  terminée à la bonne heure, message « terminée il y a 2 min ».
- Notification **et** son testés dans Chrome et Firefox, onglet actif puis en arrière-plan ; parcours
  de refus de permission vérifié (l'app reste utilisable et explique comment débloquer).
- Playwright : un test bout en bout qui démarre une session, la termine (horloge accélérée), vérifie
  l'incrément de la stat du jour et la survie du journal à un rechargement.
- Export → suppression de toutes les données → import → état identique (test automatisé sur `backup.ts`
  plus une vérification manuelle).
- Lighthouse sur l'URL déployée : PWA installable, performance et accessibilité ≥ 95. Stats vérifiées
  au lecteur d'écran (le tableau `sr-only` doit suffire à comprendre chaque graphe).
- Vérification finale sur `https://maxgfr.github.io/basilico/` : chemin de base correct, service worker
  enregistré sur le bon scope, `start_url` qui rouvre bien basilico une fois l'app installée,
  rechargement direct d'une sous-vue sans 404, aucune collision de clés avec tes autres projets Pages.
