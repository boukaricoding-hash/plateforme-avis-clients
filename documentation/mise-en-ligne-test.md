# Lancer la version de test en ligne (tunnel Cloudflare)

Cette procédure rend la plateforme joignable depuis Internet : la page d'avis (QR codes) et le tableau de bord des responsables. À refaire à chaque nouvelle session, car l'adresse du tunnel change à chaque lancement.

## Adresses (ADRESSE = l'adresse du tunnel)

- Page d'avis : `https://ADRESSE/q/CODE` (adresse écrite dans les QR codes)
- Tableau de bord : `https://ADRESSE/tableau-de-bord/`
- Santé du serveur : `https://ADRESSE/api/v1/sante`

## Règles à retenir

- Le PC qui héberge la plateforme doit rester allumé et connecté à Internet.
- Le terminal du tunnel (terminal B) doit rester ouvert. Si on le ferme, l'adresse ne répond plus.
- Les testeurs doivent être sur un autre réseau que le PC : 4G ou un autre Wi-Fi.
- Il faut deux terminaux : le terminal A pour les commandes, le terminal B pour le tunnel.
- Dans `$adresse`, on met l'adresse **sans** `https://`. La commande l'ajoute elle-même.
- La variable `PUBLIC_BASE_URL` n'existe que dans le terminal A où on l'a définie. Dans un nouveau terminal, il faut la redéfinir (étape 3) avant tout `docker compose up -d`. Sinon le serveur repart avec l'adresse locale et les QR codes et les liens d'e-mails sont faux.

## Étapes

### 1. Ouvrir Docker Desktop

Attendre qu'il soit complètement démarré.

### 2. Terminal B : lancer le tunnel (à laisser ouvert)

Ouvrir un terminal dans VS Code (menu Terminal, puis New Terminal).

```powershell
cloudflared tunnel --url http://localhost:3000
```

Repérer dans l'encadré l'adresse `https://xxxx-xxxx-xxxx-xxxx.trycloudflare.com` et la copier. Ne pas fermer ce terminal.

### 3. Terminal A : définir l'adresse du tunnel

Ouvrir un deuxième terminal avec le bouton `+` du panneau terminal. Mettre l'adresse **sans** `https://`.

```powershell
cd C:\projets\plateforme-avis-clients
$adresse = "xxxx-xxxx-xxxx-xxxx.trycloudflare.com"
$env:PUBLIC_BASE_URL = "https://$adresse"
```

`PUBLIC_BASE_URL` règle trois choses : l'adresse écrite dans les QR codes, les origines autorisées et le lien des e-mails (vers le tableau de bord).

### 4. Terminal A : démarrer la plateforme

```powershell
docker compose up -d --build
```

`--build` reconstruit l'image si le code a changé (quasi instantané sinon). Attendre environ 15 secondes.

### 5. Terminal A : vérifier que l'adresse répond

```powershell
curl.exe -s "https://$adresse/api/v1/sante"
```

Réponse attendue : `{"statut":"ok"}`. Si ça ne répond pas, attendre 30 secondes et recommencer.

### 6. Ouvrir le tableau de bord

Dans le navigateur : `https://ADRESSE/tableau-de-bord/` (avec l'adresse du tunnel). La page de connexion s'affiche. Le responsable se connecte, puis génère les QR codes depuis le tableau de bord : ils contiennent l'adresse du tunnel.

### 7. Scanner

Scanner un QR code avec un téléphone en 4G (Wi-Fi coupé), répondre au questionnaire et envoyer l'avis. L'avis apparaît ensuite dans la liste du tableau de bord.

## Générer un QR code sans le tableau de bord (méthode manuelle)

Définir le code de la table (pour la table 12 de la démo : `efXoxH0f4_Dc`), puis générer l'image :

```powershell
$code = "efXoxH0f4_Dc"
docker compose exec application node -e "require('qrcode').toFile('/tmp/qr.png','https://$adresse/q/$code',{width:600})"
docker compose cp application:/tmp/qr.png ./qr.png
start qr.png
```

## Retrouver le code public d'une table

```powershell
docker compose exec base-de-donnees psql -P pager=off -U avis_admin -d plateforme_avis -c "SELECT p.nom, p.code_public FROM point_contact p JOIN organisation o ON o.id = p.organisation_id WHERE o.nom = 'La 8e Tranche' AND p.nom ILIKE '%12' AND p.supprime_le IS NULL;"
```

## Vérifier qu'un avis est arrivé dans la base

```powershell
docker compose exec base-de-donnees psql -P pager=off -U avis_admin -d plateforme_avis -c "SELECT id, note_globale, langue, soumis_le FROM avis ORDER BY soumis_le DESC LIMIT 3;"
```

## Quand c'est fini

Dans le terminal B, faire `Ctrl + C` : l'adresse cesse de répondre. Dans le terminal A, revenir à la configuration locale :

```powershell
Remove-Item Env:PUBLIC_BASE_URL
docker compose up -d
```

## Sécurité du test

- Toute personne qui connaît l'adresse du tunnel peut ouvrir la page de connexion du tableau de bord. N'envoyer l'adresse qu'aux testeurs.
- Utiliser des comptes de test, et vérifier qu'aucun compte n'a encore un mot de passe d'exemple (ceux du modèle `.env.example`).

## Limites connues

- « Mot de passe oublié » n'envoie pas encore d'e-mail : le service d'e-mails n'est pas branché (prévu au jour 16). Le lien généré est déjà le bon (`/tableau-de-bord/reinitialiser-mot-de-passe`).

## Erreurs fréquentes

- **Le QR ouvre une page introuvable** : l'adresse du QR est périmée ou `$adresse` contient `https://`. Refaire les étapes 3 et 4 avec l'adresse actuelle du terminal B.
- **Plus rien ne répond** : le terminal B a été fermé. Refaire les étapes 2 à 6 (la nouvelle adresse est différente).
- **L'adresse a changé** : normal, elle change à chaque lancement du tunnel. Refaire les étapes 3 et 4, sinon les QR codes du tableau de bord pointent vers l'ancienne adresse.
- **Les QR codes du tableau de bord contiennent `localhost`** : `PUBLIC_BASE_URL` n'était pas définie dans ce terminal. Refaire l'étape 3, puis `docker compose up -d`.
- **`/tableau-de-bord/` ne s'ouvre pas (page « Adresse introuvable » ou page d'avis)** : l'image n'a pas été reconstruite. Lancer `docker compose up -d --build`.