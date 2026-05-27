# Marche à suivre — reprendre ce projet dans Claude Code

Ce dossier est prêt à être ouvert dans Claude Code. Voici comment procéder.

## 1. Installation

```bash
cd circuit-simulator
npm install
```

Premier check :

```bash
npm run dev
```

Doit ouvrir l'app sur localhost:5173.

## 2. Vérifier que le parse passe

```bash
npm run parse-check
```

Doit afficher `OK`. C'est ton garde-fou : à lancer après toute modification importante du gros fichier.

## 3. Ouvrir dans Claude Code

```bash
claude
```

(Depuis le dossier `circuit-simulator/`.)

Claude Code lira automatiquement **`CLAUDE.md`** au démarrage. C'est le fichier le plus important du projet pour l'IA — il contient tout le contexte nécessaire (architecture, conventions, état d'avancement, pièges connus).

## 4. Premiers prompts utiles

Pour démarrer une session, je suggère un de ceux-ci selon ton intention :

**Continuer la phase 5b (séquentielle suite) :**

> Lis CLAUDE.md et ROADMAP.md. On en est à la phase 5a terminée. Avant de coder, fais-moi un plan détaillé pour la phase 5b en commençant par le SR latch (composant primitif, pas un construit à partir de NOR). Pose-moi des questions si besoin.

**Améliorer un point précis :**

> Lis CLAUDE.md. Je voudrais améliorer X dans le simulateur. Avant de coder, propose un plan et indique-moi les fichiers et zones que tu vas toucher.

**Corriger un bug :**

> Lis CLAUDE.md. Voici le bug : [description précise + reproduction]. Diagnostique avant de proposer un fix, et confirme avec moi avant de modifier le fichier.

**Tester quelque chose :**

> Lis CLAUDE.md et docs/test-examples.md. Écris-moi un test isolé pour vérifier le comportement de [composant ou fonction]. Lance-le avec node.

## 5. Astuces de prompting pour ce projet

- **Toujours faire faire un plan avant de coder.** Le fichier est gros (3800+ lignes), une modification mal placée casse le parse. Demande à Claude de te dire exactement les zones qu'il va toucher avant qu'il édite.
- **Demander un `npm run parse-check` après chaque grosse édition.** Claude peut le faire avec son outil bash.
- **Tester visuellement.** Pour les changements UI, refuse les réponses « j'ai modifié, ça devrait marcher » sans avoir lancé le dev server et observé le résultat. Demande à Claude de te décrire ce qui devrait être visible et compare.
- **Si le contexte se charge :** Claude Code peut perdre le fil après beaucoup de modifs. Re-énonce le but de la session de temps en temps (« on est en train de faire X pour atteindre Y »).
- **Éviter les refactorings cosmétiques.** Le fichier est volontairement plat. Pas besoin de découper, renommer, extraire. Sauf nécessité fonctionnelle.

## 6. Documents à donner à Claude en début de session

Le minimum requis : **CLAUDE.md** (lu automatiquement). Ça suffit pour la plupart des sessions.

Pour les sessions plus longues ou complexes, mentionner aussi :

- `ROADMAP.md` (où on en est dans la progression du projet)
- `docs/architecture.md` (détails internes, plan du fichier, modèle de données)
- `docs/test-examples.md` (comment tester sans React)

Tu peux dire simplement : « Lis CLAUDE.md et ROADMAP.md avant de commencer. »

## 7. Workflow recommandé pour une nouvelle phase

1. Décrire l'objectif pédagogique de la phase en une phrase ou deux.
2. Demander un plan détaillé (composants à ajouter, choix d'architecture, points d'intégration). Itérer.
3. Laisser Claude implémenter par petits chunks, avec parse-check entre chaque.
4. Tester dans le navigateur après chaque chunk.
5. Mettre à jour `ROADMAP.md` et `CLAUDE.md` à la fin de la phase.

## 8. Si tu veux exporter ailleurs

Le projet est un Vite standard. Pour déployer en statique :

```bash
npm run build
```

Le contenu de `dist/` est uploadable tel quel sur GitHub Pages, Netlify, Vercel, n'importe quel hébergement statique. Pas de backend, pas de base de données.

## 9. Si tu prêtes le code à un collègue enseignant

Il a besoin de Node.js 18+ et de ce dossier. Le `README.md` lui explique le strict nécessaire pour lancer l'app. Pas besoin de Claude Code pour utiliser le simulateur.
