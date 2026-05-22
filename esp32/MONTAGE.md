# Montage ESP32 + 2x DS18B20 - Aeroclub ACBA

## Materiel necessaire

| Composant | Qte | Ref / Detail |
|-----------|-----|-------------|
| DS18B20 (etanche, cable) | 2 | Version sonde etanche avec cable ~1m (pour mettre dans les frigos) |
| Resistance 4.7k ohm | 2 | 1/4W (une par capteur) |
| Fils dupont / cables | ~6 | Male-femelle pour connexions |

> Tu as deja l'ESP32 et les 3 relais (pins 5, 18, 19).
> Les DS18B20 etanches sont les meilleurs pour les frigos (sondes en inox).

---

## Schema de cablage

```
                        ESP32 DevKit
                   ┌──────────────────┐
                   │                  │
                   │  3V3 ──────┐     │
                   │            │     │
                   │  GND ──┐   │     │
                   │        │   │     │
                   │  GPIO4 ┤   │     │    << Capteur FRIGO
                   │        │   │     │
                   │ GPIO15 ┤   │     │    << Capteur CONGELATEUR
                   │        │   │     │
                   │  GPIO5 ┤   │     │    (Relais cafe - deja cable)
                   │ GPIO18 ┤   │     │    (Relais frigo - deja cable)
                   │ GPIO19 ┤   │     │    (Relais congelateur - deja cable)
                   │        │   │     │
                   └────────┤───┤─────┘
                            │   │
          ┌─────────────────┤   │
          │                 │   │
          │   CAPTEUR FRIGO (DS18B20 #1) sur GPIO4
          │
          │    DS18B20 (3 fils)
          │   ┌─────────────┐
          │   │  NOIR (GND) ├──── GND ESP32
          │   │ ROUGE (VCC) ├──── 3V3 ESP32
          │   │ JAUNE (DATA)├──┬─ GPIO4 ESP32
          │   └─────────────┘  │
          │                    │
          │              ┌─────┘
          │              │
          │         [R 4.7k]     << Resistance pull-up 4.7k
          │              │         entre DATA et 3V3
          │              │
          │              └──── 3V3 ESP32
          │
          │
          │   CAPTEUR CONGELATEUR (DS18B20 #2) sur GPIO15
          │
          │    DS18B20 (3 fils)
          │   ┌─────────────┐
          │   │  NOIR (GND) ├──── GND ESP32
          │   │ ROUGE (VCC) ├──── 3V3 ESP32
          │   │ JAUNE (DATA)├──┬─ GPIO15 ESP32
          │   └─────────────┘  │
          │                    │
          │              ┌─────┘
          │              │
          │         [R 4.7k]     << Resistance pull-up 4.7k
          │              │         entre DATA et 3V3
          │              │
          │              └──── 3V3 ESP32
          │
          └─────────────────────
```

## Cablage simplifie par capteur

Chaque DS18B20 a 3 fils (sonde etanche avec cable) :

### Capteur FRIGO (GPIO 4)
```
DS18B20 NOIR  ──────────────── GND (ESP32)
DS18B20 ROUGE ──────────────── 3V3 (ESP32)
DS18B20 JAUNE ──┬───────────── GPIO 4 (ESP32)
                │
            [4.7k ohm]
                │
               3V3 (ESP32)
```

### Capteur CONGELATEUR (GPIO 15)
```
DS18B20 NOIR  ──────────────── GND (ESP32)
DS18B20 ROUGE ──────────────── 3V3 (ESP32)
DS18B20 JAUNE ──┬───────────── GPIO 15 (ESP32)
                │
            [4.7k ohm]
                │
               3V3 (ESP32)
```

## Couleurs des fils DS18B20 (standard)

| Fil | Couleur | Connexion |
|-----|---------|-----------|
| GND | **Noir** | GND de l'ESP32 |
| VCC | **Rouge** | 3V3 de l'ESP32 (PAS 5V !) |
| DATA | **Jaune** (ou blanc) | GPIO du capteur + pull-up 4.7k vers 3V3 |

> **IMPORTANT** : La resistance 4.7k est OBLIGATOIRE entre le fil DATA (jaune)
> et le 3V3. Sans elle, le capteur ne fonctionnera pas. Il en faut UNE par capteur.

## Placement des sondes

- **Sonde frigo** : fixer la sonde etanche a l'interieur du frigo, idealement au milieu (pas contre les parois). Le cable passe par le joint de la porte.
- **Sonde congelateur** : idem dans le congelateur.
- Les joints de porte des frigos/congelateurs sont souples et laissent passer un cable fin sans probleme.

## Verification

Apres branchement, ouvre le moniteur serie Arduino (115200 baud).
Tu devrais voir :

```
=== AEROCLUB ESP32 - Demarrage ===
Relais initialises (tout verrouille)
Capteurs trouves - Frigo: 1, Congelateur: 1
WiFi connecte! IP: 192.168.x.x
Temperatures - Frigo: 4.5 C | Congelateur: -18.2 C
Temperatures envoyees OK
=== Initialisation terminee ===
```

Si tu vois `Capteurs trouves - Frigo: 0` = probleme de cablage sur ce capteur.

## Librairies Arduino a installer

Dans Arduino IDE > Outils > Gestionnaire de bibliotheques :
1. Chercher **"OneWire"** par Jim Studt → Installer
2. Chercher **"DallasTemperature"** par Miles Burton → Installer
3. Board : **ESP32 Dev Module** (tu l'as deja)

## Resume des pins ESP32

| Pin | Fonction | Composant |
|-----|----------|-----------|
| GPIO 4 | DATA capteur temp | DS18B20 frigo |
| GPIO 5 | Relais serrure | Cafe (active LOW) |
| GPIO 15 | DATA capteur temp | DS18B20 congelateur |
| GPIO 18 | Relais serrure | Frigo (active LOW) |
| GPIO 19 | Relais serrure | Congelateur (active HIGH) |
| 3V3 | Alimentation capteurs | 2x DS18B20 VCC + 2x pull-up |
| GND | Masse capteurs | 2x DS18B20 GND |
