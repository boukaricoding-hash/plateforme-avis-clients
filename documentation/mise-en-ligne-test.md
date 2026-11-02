# Lancer la version de test en ligne (tunnel Cloudflare)

Cette procédure rend la plateforme joignable depuis Internet, pour que les testeurs puissent scanner un QR code. À refaire à chaque nouvelle session, car l'adresse du tunnel change à chaque lancement.

## Règles à retenir

- Le PC qui héberge la plateforme doit rester allumé et connecté à Internet.
- Le terminal du tunnel (terminal B) doit rester ouvert. Si on le ferme, l'adresse ne répond plus.
- Les testeurs doivent être sur un autre réseau que le PC : 4G ou un autre Wi-Fi.
- Il faut deux terminaux : le terminal A pour les commandes, le terminal B pour le tunnel.
- Dans `$adresse`, on met l'adresse **sans** `https://`. La commande l'ajoute elle-même.

## Étapes

### 1. Ouvrir Docker Desktop

Attendre qu'il soit complètement démarré.

### 2. Terminal A : démarrer la plateforme

Dans VS Code : menu Terminal, puis New Terminal. Être à la racine `C:\projets\plateforme-avis-clients`.

```powershell
docker compose up -d
```

### 3. Terminal B : lancer le tunnel (à laisser ouvert)

Ouvrir un deuxième terminal avec le bouton `+` du panneau terminal.

```powershell
cloudflared tunnel --url http://localhost:3000
```

Repérer dans l'encadré l'adresse `https://xxxx-xxxx-xxxx-xxxx.trycloudflare.com` et la copier. Ne pas fermer ce terminal.

### 4. Terminal A : vérifier que l'adresse répond

Ouvrir dans le navigateur du PC :

```
 https://mails-sydney-jesse-primarily.trycloudflare.com/api/v1/sante
```

Réponse attendue : `ok`. Si ça ne répond pas, attendre 30 secondes et recharger.

### 5. Terminal A : définir l'adresse (sans https://)

```powershell
$adresse = "storm-gateway-amongst-stem.trycloudflare.com"
```

### 6. Terminal A : définir le code de la table

```powershell
$code = "efXoxH0f4_Dc"
```

Pour la table 12 de la démo : `efXoxH0f4_Dc`.

### 7. Terminal A : générer le QR dans le conteneur

```powershell
docker compose exec application node -e "require('qrcode').toFile('/tmp/qr.png','https://$adresse/q/$code',{width:600})"
```

### 8. Terminal A : copier l'image sur le PC

```powershell
docker compose cp application:/tmp/qr.png ./qr.png
```

### 9. Terminal A : ouvrir le QR

```powershell
start qr.png
```

### 10. Scanner

Scanner le QR avec un téléphone en 4G (Wi-Fi coupé), répondre au questionnaire et envoyer l'avis.

## Retrouver le code public d'une table

```powershell
docker compose exec base-de-donnees psql -P pager=off -U avis_admin -d plateforme_avis -c "SELECT p.nom, p.code_public FROM point_contact p JOIN organisation o ON o.id = p.organisation_id WHERE o.nom = 'La 8e Tranche' AND p.nom ILIKE '%12' AND p.supprime_le IS NULL;"
```

## Vérifier qu'un avis est arrivé dans la base

```powershell
docker compose exec base-de-donnees psql -P pager=off -U avis_admin -d plateforme_avis -c "SELECT id, note_globale, langue, soumis_le FROM avis ORDER BY soumis_le DESC LIMIT 3;"
```

## Quand c'est fini

Dans le terminal B, faire `Ctrl + C`. L'adresse cesse de répondre.

## Erreurs fréquentes

- **Le QR ouvre une page introuvable** : l'adresse du QR est périmée ou `$adresse` contient `https://`. Relancer les étapes 5 à 9 avec l'adresse actuelle du terminal B.
- **Plus rien ne répond** : le terminal B a été fermé. Refaire les étapes 3 à 9.
- **L'adresse a changé** : normal, elle change à chaque lancement du tunnel. Il faut régénérer le QR.