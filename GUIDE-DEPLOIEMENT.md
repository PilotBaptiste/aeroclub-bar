# ✈️ Aéro-Club Bar — Guide de déploiement

## 📁 Structure du projet

```
aeroclub-bar/
├── app/
│   ├── api/
│   │   ├── sumup-checkout/route.js   ← API pour créer les paiements SumUp
│   │   └── sumup-webhook/route.js    ← Webhook de confirmation (optionnel)
│   ├── globals.css
│   ├── layout.js
│   └── page.js
├── components/
│   └── AeroClubBar.js                ← L'appli complète
├── .env.example
├── jsconfig.json
├── next.config.js
├── package.json
├── postcss.config.js
└── tailwind.config.js
```

---

## 🚀 Déploiement sur Vercel (5 minutes)

### Étape 1 — Mettre le code sur GitHub

```bash
cd aeroclub-bar
git init
git add .
git commit -m "Initial commit"
```

Créez un repo sur GitHub, puis :

```bash
git remote add origin https://github.com/VOTRE-USER/aeroclub-bar.git
git push -u origin main
```

### Étape 2 — Déployer sur Vercel

1. Allez sur [vercel.com](https://vercel.com) et connectez-vous avec GitHub
2. Cliquez **"Add New Project"**
3. Sélectionnez votre repo `aeroclub-bar`
4. Vercel détecte automatiquement Next.js — cliquez **Deploy**
5. C'est en ligne ! Vous obtenez une URL du type `aeroclub-bar.vercel.app`

### Étape 3 — Configurer SumUp

1. Créez un compte sur [developer.sumup.com](https://developer.sumup.com)
2. Allez dans **"My Apps"** → **"Create App"**
3. Notez votre **API Key** et votre **Merchant Code** (visible dans votre profil SumUp)
4. Dans Vercel : **Settings** → **Environment Variables**, ajoutez :

| Variable | Valeur |
|----------|--------|
| `SUMUP_API_KEY` | Votre clé API SumUp |
| `SUMUP_MERCHANT_CODE` | Votre code marchand |
| `NEXT_PUBLIC_APP_URL` | `https://votre-app.vercel.app` |
| `ADMIN_PIN` | Votre code PIN admin (ex: `4567`) |

5. **Redéployez** (Settings → Deployments → Redeploy)

---

## 💳 Comment ça marche

### Côté membre :
1. Le membre scanne le **QR code principal** affiché au bar (= l'URL du site)
2. Il choisit son produit (café, boisson, snack...)
3. Il entre son **nom & prénom**
4. Il choisit : **payer par carte** (QR code SumUp généré automatiquement) ou **espèces**
5. Le stock se décrémente, la transaction est enregistrée

### Côté trésorier :
1. Cliquer sur ⚙️ → entrer le PIN
2. **Stock** : ajuster les quantités quand vous réapprovisionnez
3. **Historique** : voir toutes les transactions, filtrer par nom
4. **Export CSV** : télécharger l'historique pour la compta
5. **Config** : modifier le nom du club, le PIN, voir les instructions SumUp

---

## 💰 Coûts

| Élément | Coût |
|---------|------|
| Hébergement Vercel | **Gratuit** (plan Hobby) |
| Abonnement SumUp | **Gratuit** |
| Frais par transaction carte | **1,5%** (soit 0,75 cts sur un café à 50 cts) |
| Nom de domaine (optionnel) | ~10€/an |

---

## 🖨️ QR Code à imprimer

Une fois déployé, créez un QR code qui pointe vers votre URL Vercel
et imprimez-le en format A5 ou A4 à afficher au bar :

→ Utilisez [qr-code-generator.com](https://www.qr-code-generator.com/)
→ URL : `https://votre-app.vercel.app`

---

## 📱 Installation sur tablette (optionnel)

Pour que ça ressemble à une vraie appli sur une tablette au bar :

### iPad / iPhone :
1. Ouvrez Safari → votre URL
2. Bouton partage → "Sur l'écran d'accueil"

### Android :
1. Ouvrez Chrome → votre URL
2. Menu ⋮ → "Ajouter à l'écran d'accueil"

---

## ⚠️ Limitations et notes

- **Stockage** : les données (stock, transactions) sont en `localStorage` du navigateur.
  Si vous effacez le cache, les données sont perdues. Pour un usage plus robuste,
  ajoutez une base de données (Vercel KV ou Supabase, tous deux gratuits).
- **Multi-appareils** : chaque appareil a ses propres données. Si le trésorier
  modifie le stock sur sa tablette, ça n'apparaît pas sur le téléphone d'un membre.
  → Solution : migrer vers Vercel KV ou Supabase pour un stockage partagé.
- **SumUp** : le paiement par carte repose sur la confirmation manuelle du membre
  ("J'ai payé par carte"). Pour une confirmation automatique à 100%, il faudrait
  implémenter le webhook SumUp (le fichier est déjà prêt dans `/api/sumup-webhook`).
