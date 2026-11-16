# Tests sur appareils : page de connexion

Cette liste sert à vérifier à la main la page de connexion (et les pages publiques liées) sur de vrais écrans. Elle correspond au point 3 des six améliorations de la page. Pour me renvoyer tes résultats, écris le numéro du test, l'appareil et ce que tu vois, par exemple : `2 - iPhone Safari - le pied de page est caché derrière la barre du bas`.

## Avant de commencer

- Adresse à ouvrir : `<adresse publique>/tableau-de-bord/connexion`. L'aperçu de partage (test 4) ne marche pas avec `npm run dev` (port 5174) : il faut la version servie par le backend, avec `PUBLIC_BASE_URL` réglée sur l'adresse publique (tunnel Cloudflare).
- Ouvre la page en navigation privée, pour ne pas voir une ancienne version en cache.
- Les coordonnées sont dans `frontend/tableau-de-bord/src/utilitaires/coordonnees.ts`. Tant que `whatsapp` et `email` sont vides, le bouton « Demander une démo » et le lien « Contact » n'apparaissent pas : c'est normal.

## 1. Portable 1366 × 768 (Chrome)

Fenêtre réelle, ou F12 puis mode appareil, en « Responsive » à 1366 × 768.

- [ ] Aucun défilement : la barre du haut, le message, la scène, la bande des secteurs et le pied de page sont tous visibles.
- [ ] La scène n'est pas coupée en bas.
- [ ] « Demander une démo » apparaît dans la barre du haut, à côté du bouton de thème.
- [ ] « Espace client » remplace la scène par le formulaire ; « Retour » ramène la scène ; le pied de page reste visible.
- [ ] Avec le zoom du navigateur à 125 %, rien ne se chevauche.

## 2. Téléphone (Chrome Android, puis Safari sur iPhone)

Tailles de repère : 360 × 640 (Android) et 390 × 844 (iPhone). Le mode appareil de F12 aide, mais un vrai téléphone vaut mieux, surtout Safari.

- [ ] L'accueil montre, en faisant défiler : le badge, le titre, le texte, « Accéder à mon espace », « Demander une démo », les trois points forts, les secteurs, les garanties et le pied de page.
- [ ] Le formulaire n'apparaît pas avant l'appui sur « Accéder à mon espace ».
- [ ] Après l'appui : le formulaire seul. Note si le clavier s'ouvre tout de suite et si cela gêne.
- [ ] « Retour » ramène à l'accueil.
- [ ] La barre du haut (logo, nom, thème, FR/EN) ne déborde pas ; le nom peut passer sur deux lignes.
- [ ] Aucun défilement horizontal.
- [ ] iPhone : l'encoche et la barre du bas ne cachent rien ; en touchant un champ, la page ne zoome pas toute seule.
- [ ] Téléphone en paysage : tout reste accessible en défilant.
- [ ] Les boutons et les liens se touchent facilement du pouce.
- [ ] Thème clair et thème sombre, en français puis en anglais.
- [ ] « Demander une démo » ouvre WhatsApp avec le message déjà écrit ; « ou par e-mail » ouvre la messagerie avec un sujet.

## 3. Téléphone d'entrée de gamme et connexion lente

F12, onglet Performance : ralentissement du processeur « 6x slowdown ». Onglet Réseau : « Slow 4G ». Ou prête-toi un vieux téléphone.

- [ ] Le texte et les boutons de l'accueil s'affichent vite (repère : moins de 3 secondes en Slow 4G).
- [ ] Le défilement est fluide, sans saccades.
- [ ] Onglet Réseau : seul `data-logo.webp` (environ 7 Ko) est chargé comme logo. Les anciennes images `data.png` (740 Ko) et `connexion.png` (1,7 Mo) ne doivent pas apparaître.
- [ ] Note le total transféré affiché en bas de l'onglet Réseau (en Ko ou en Mo).

## 4. Aperçu du lien dans WhatsApp

- [ ] Ouvre `<adresse publique>/tableau-de-bord/apercu-partage.png` dans le navigateur : l'image de 1200 × 630 s'affiche.
- [ ] Dans la page de connexion, Ctrl+U puis cherche `__URL_SITE__` : aucun résultat (le serveur l'a remplacé par l'adresse publique).
- [ ] Colle `<adresse publique>/tableau-de-bord/` dans une discussion WhatsApp (avec toi-même) : le titre, la description et l'image apparaissent.
- [ ] Si l'aperçu reste vide ou ancien, WhatsApp l'a gardé en mémoire : ajoute `?v=2` à la fin de l'adresse et recommence.
- [ ] Facultatif : Facebook Sharing Debugger et LinkedIn Post Inspector.

La page garde `noindex` : les moteurs de recherche ne la listent pas, mais l'aperçu WhatsApp fonctionne quand même.

## 5. Confiance : pied de page et pages légales

- [ ] Sur la connexion et sur « Mot de passe oublié », le pied de page montre le copyright, « Mentions légales », « Confidentialité » et (si les coordonnées sont remplies) « Contact ».
- [ ] `/tableau-de-bord/mentions-legales` et `/tableau-de-bord/confidentialite` s'ouvrent sans être connecté, se lisent bien sur téléphone, et « Retour à la connexion » fonctionne.
- [ ] Dans les mentions légales, les lignes vides (responsable, adresse, hébergeur) ne s'affichent pas.
- [ ] Avant la Foire : remplir `coordonnees.ts` (whatsapp, email, responsable, adresse, hébergeur) et faire relire les deux textes légaux par DTS.
- [ ] Aucun chiffre inventé sur la page : des chiffres réels seulement, quand ils existeront.

## 6. Finitions : clavier, lisibilité, animations

- [ ] Touche Tab : un cadre visible suit chaque bouton et chaque lien ; dans un champ, un trait d'accent épais apparaît sous le champ.
- [ ] Le texte gris reste lisible au soleil, avec la luminosité du téléphone au maximum.
- [ ] Avec « réduire les animations » activé dans le système (Windows : effets d'animation désactivés ; iPhone : réduire les animations), la scène et les messages ne bougent plus.

## À noter

- Le tableau de bord part en un seul fichier JavaScript d'environ 400 Ko compressés. C'est lui, plus que les images, qui pèse sur une connexion lente : à surveiller si le test 3 est mauvais.
- Les images `data.png` et `connexion.png` ne sont plus utilisées par la page ; elles sont encore dans `public/` et peuvent être retirées plus tard.