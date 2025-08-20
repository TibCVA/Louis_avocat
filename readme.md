# Prépa déonto 98‑1 — App de révision (Flashcards)

Application **100% statique** (HTML/CSS/JS) optimisée pour **iPhone/iOS** et GitHub Pages.

## Points clés
- Révision carte par carte (question ➜ réponse)
- Marquage **Je maîtrise** / **À revoir**
- **Filtres** (Toutes, À revoir, Non vues, Maîtrisées) + **aléatoire**
- **Progression** : anneau de progression + compteurs
- **Améliorations UX** : confetti (réussite), lecture vocale, anti‑veille (Wake Lock), auto‑suivant, swipe, raccourcis clavier
- **Liste** avec recherche **surlignée** et favoris
- **Export / import** de la progression (localStorage JSON)
- **Dark mode** natif (prefers‑color‑scheme)
- Données **locales et privées** (aucun serveur)

## Déploiement GitHub Pages
1. Créez un dépôt (ex. `deonto-98-1`) et ajoutez **tous** les fichiers de ce dossier.
2. **Settings → Pages** :
   - **Source** : `Deploy from a branch`
   - **Branch** : `main` (répertoire `/`)
3. Ouvrez l’URL publique `https://<votre-user>.github.io/deonto-98-1/`.

## Mise à jour du contenu
- Modifiez `questions.json` (tableau d’objets `{ "question", "reponse", "points_specifiques": [] }`).
- Aucune modification de code n’est nécessaire. Jusqu’à **200** items sans problème.

## Confidentialité
Toutes les données (progression, favoris) sont stockées **localement** (localStorage).  
Utilisez **Exporter** pour sauvegarder/partager la progression ; **Importer** pour la recharger.

---

_Design iOS : typographie system, surfaces douces, arrondis 16px, focus visibles, animations légères (désactivées si `prefers-reduced-motion`)._