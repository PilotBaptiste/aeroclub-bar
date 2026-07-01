/*
 * AEROCLUB DU BASSIN D'ARCACHON - ESP32 4-Relay Board
 * ====================================================
 * Carte : LC-Relay-ESP32-4R-A2
 * R1(GPIO33)=Café(1s)  R2(GPIO25)=Frigo(3s)  R3(GPIO26)=Congél(5s)  R4(GPIO32)=LED vitrine
 *
 * LED WS2812B : bande adressable dans le frigo (180 LEDs, 3 étagères x 60)
 *   - L'API renvoie "leds":"0-2:FF0000,5-7:00FF00" = plages de LED a allumer
 *   - Allumées pendant l'ouverture du frigo ou seules (test admin lock=none)
 *   - Éteintes après DUREE_LEDS
 *
 * Librairies requises :
 *   - OneWire           (par Jim Studt)
 *   - DallasTemperature (par Miles Burton)
 *   - FastLED           (par Daniel Garcia)
 */

#include <WiFi.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>
#include <OneWire.h>
#include <DallasTemperature.h>
#include <FastLED.h>

// === CONFIG ===
const char* WIFI_SSID     = "ACBA-H7";
const char* WIFI_PASSWORD = "villemarie-H7";
const char* API_URL       = "https://aeroclub-bar.vercel.app/api/fridge";
const char* TEMP_URL      = "https://aeroclub-bar.vercel.app/api/temperature";
// ==============

// === GPIO RELAIS ===
const int RELAY_CAFE        = 33;
const int RELAY_FRIGO       = 25;
const int RELAY_CONGELATEUR = 26;
const int RELAY_LED         = 32;

// === DUREES D'OUVERTURE (ms) ===
const unsigned long DUREE_CAFE   = 1000;
const unsigned long DUREE_FRIGO  = 3000;
const unsigned long DUREE_CONGEL = 5000;
const unsigned long DUREE_LEDS   = 5000;  // durée affichage LED produits

// === LED WS2812B ===
const int LED_PIN       = 27;
const int NUM_LEDS      = 180;  // 3 étagères x 60 LEDs
CRGB leds[180];

// === PLAGES LED ===
const int MAX_RANGES = 40;
struct LedRange {
  int start;
  int end;
  CRGB color;
};
LedRange ranges[MAX_RANGES];
int rangeCount = 0;

// === ANIMATION ===
String currentAnim = "none";
int ledsPerShelf = 30;
int ledBrightness = 150;

// === GPIO CAPTEURS TEMPERATURE ===
const int TEMP_FRIGO_PIN    = 16;
const int TEMP_CONGEL_PIN   = 14;

// Relais actifs en HIGH sur cette carte
const bool RELAY_ACTIVE_HIGH = true;

// --- TIMING ---
const unsigned long POLL_INTERVAL = 2000;
const unsigned long TEMP_INTERVAL = 30000;

// --- CAPTEURS ---
OneWire oneWireFrigo(TEMP_FRIGO_PIN);
OneWire oneWireCongel(TEMP_CONGEL_PIN);
DallasTemperature capteurFrigo(&oneWireFrigo);
DallasTemperature capteurCongel(&oneWireCongel);

// --- VARIABLES ---
unsigned long lastPoll = 0;
unsigned long lastTemp = 0;
unsigned long tempRequestTime = 0;
bool tempRequested = false;
bool ledState = false;
float tempFrigo = -127.0;
float tempCongel = -127.0;

void relayOn(int pin) { digitalWrite(pin, RELAY_ACTIVE_HIGH ? HIGH : LOW); }
void relayOff(int pin) { digitalWrite(pin, RELAY_ACTIVE_HIGH ? LOW : HIGH); }

// ============================================================
// PARSING DES PLAGES LED  — "0-2:FF0000,5-7:00FF00"
// ============================================================
void parseRanges(String input) {
  rangeCount = 0;
  if (input.length() == 0) return;

  int idx = 0;
  while (idx < (int)input.length() && rangeCount < MAX_RANGES) {
    int dashPos = input.indexOf('-', idx);
    if (dashPos < 0) break;

    int commaPos = input.indexOf(',', dashPos);
    if (commaPos < 0) commaPos = input.length();

    int colonPos = input.indexOf(':', dashPos);
    CRGB color = CRGB::White;
    int endPos;

    if (colonPos > 0 && colonPos < commaPos) {
      endPos = colonPos;
      String hexColor = input.substring(colonPos + 1, commaPos);
      long rgb = strtol(hexColor.c_str(), NULL, 16);
      color = CRGB((rgb >> 16) & 0xFF, (rgb >> 8) & 0xFF, rgb & 0xFF);
    } else {
      endPos = commaPos;
    }

    int s = input.substring(idx, dashPos).toInt();
    int e = input.substring(dashPos + 1, endPos).toInt();

    ranges[rangeCount].start = s;
    ranges[rangeCount].end = e;
    ranges[rangeCount].color = color;
    rangeCount++;

    idx = commaPos + 1;
  }

  Serial.printf("  Parsed %d plages LED\n", rangeCount);
}

// ============================================================
// ALLUMER LES LED SELON LES PLAGES (sans animation)
// ============================================================
void allumerLedsDirect() {
  for (int i = 0; i < NUM_LEDS; i++) leds[i] = CRGB::Black;
  for (int r = 0; r < rangeCount; r++) {
    for (int i = ranges[r].start; i <= ranges[r].end && i < NUM_LEDS; i++) {
      if (i >= 0) leds[i] = ranges[r].color;
    }
  }
  FastLED.show();
}

// ============================================================
// ETEINDRE TOUTES LES LED
// ============================================================
void eteindreLeds() {
  for (int i = 0; i < NUM_LEDS; i++) leds[i] = CRGB::Black;
  FastLED.show();
  delay(50);
  for (int i = 0; i < NUM_LEDS; i++) leds[i] = CRGB::Black;
  FastLED.show();
  rangeCount = 0;  // ← réactive le nettoyage anti-bruit dans loop()
}

// ============================================================
// ANIMATIONS LED
// ============================================================
void animSnake(int shelfSize) {
  // Arc-en-ciel qui parcourt chaque étagère puis dépose les couleurs produits
  int totalShelves = (NUM_LEDS + shelfSize - 1) / shelfSize;
  for (int shelf = 0; shelf < totalShelves; shelf++) {
    int shelfStart = shelf * shelfSize;
    int shelfEnd = min(shelfStart + shelfSize - 1, NUM_LEDS - 1);
    // Snake arc-en-ciel sur cette étagère
    for (int pos = shelfStart; pos <= shelfEnd; pos++) {
      for (int i = 0; i < NUM_LEDS; i++) leds[i] = CRGB::Black;
      // Dessiner le serpent (5 LED de queue)
      for (int t = 0; t < 5; t++) {
        int p = pos - t;
        if (p >= shelfStart && p <= shelfEnd) {
          leds[p] = CHSV((pos * 10 + t * 30) % 256, 255, 255 - t * 40);
        }
      }
      // Garder les produits déjà déposés sur les étagères précédentes
      for (int r = 0; r < rangeCount; r++) {
        if (ranges[r].end < shelfStart) {
          for (int i = ranges[r].start; i <= ranges[r].end && i < NUM_LEDS; i++) {
            if (i >= 0) leds[i] = ranges[r].color;
          }
        }
      }
      FastLED.show();
      delay(8);
    }
  }
  // Fin : afficher les couleurs finales
  allumerLedsDirect();
}

void animSerpentin(int shelfSize) {
  // Descend toutes les étagères en serpentin et dépose les couleurs
  int totalShelves = (NUM_LEDS + shelfSize - 1) / shelfSize;
  for (int shelf = 0; shelf < totalShelves; shelf++) {
    int shelfStart = shelf * shelfSize;
    int shelfEnd = min(shelfStart + shelfSize - 1, NUM_LEDS - 1);
    bool reverse = (shelf % 2 == 1);
    int len = shelfEnd - shelfStart + 1;
    for (int step = 0; step < len; step++) {
      int pos = reverse ? (shelfEnd - step) : (shelfStart + step);
      // Effacer cette étagère sauf les couleurs déjà déposées
      for (int i = shelfStart; i <= shelfEnd; i++) {
        bool isProduct = false;
        for (int r = 0; r < rangeCount; r++) {
          if (ranges[r].end < shelfStart) continue; // étagère précédente, garder
          if (i >= ranges[r].start && i <= ranges[r].end) {
            // Vérifier si on a déjà dépassé ce produit
            bool passed = reverse ? (pos < ranges[r].start) : (pos > ranges[r].end);
            if (passed) { leds[i] = ranges[r].color; isProduct = true; }
          }
        }
        if (!isProduct && i >= shelfStart) {
          // Seulement effacer sur l'étagère courante
          bool keepFromPrev = false;
          for (int r = 0; r < rangeCount; r++) {
            if (i >= ranges[r].start && i <= ranges[r].end && ranges[r].end < shelfStart) {
              keepFromPrev = true;
            }
          }
          if (!keepFromPrev) leds[i] = CRGB::Black;
        }
      }
      // Tête du serpentin
      leds[pos] = CHSV((shelf * 80 + step * 5) % 256, 255, 255);
      if (reverse ? (pos + 1 <= shelfEnd) : (pos - 1 >= shelfStart)) {
        int tail = reverse ? pos + 1 : pos - 1;
        leds[tail] = CHSV((shelf * 80 + step * 5) % 256, 255, 120);
      }
      // Garder les étagères précédentes
      for (int r = 0; r < rangeCount; r++) {
        if (ranges[r].end < shelfStart) {
          for (int i = ranges[r].start; i <= ranges[r].end && i < NUM_LEDS; i++) {
            if (i >= 0) leds[i] = ranges[r].color;
          }
        }
      }
      FastLED.show();
      delay(10);
    }
  }
  allumerLedsDirect();
}

void animChase() {
  // Scanner Knight Rider sur toute la bande
  for (int rep = 0; rep < 3; rep++) {
    for (int pos = 0; pos < NUM_LEDS; pos++) {
      for (int i = 0; i < NUM_LEDS; i++) leds[i] = CRGB::Black;
      for (int t = 0; t < 5; t++) {
        int p = pos - t;
        if (p >= 0 && p < NUM_LEDS) {
          leds[p] = CRGB(255 - t * 50, 0, 0);
        }
      }
      FastLED.show();
      delay(3);
    }
    for (int pos = NUM_LEDS - 1; pos >= 0; pos--) {
      for (int i = 0; i < NUM_LEDS; i++) leds[i] = CRGB::Black;
      for (int t = 0; t < 5; t++) {
        int p = pos + t;
        if (p >= 0 && p < NUM_LEDS) {
          leds[p] = CRGB(255 - t * 50, 0, 0);
        }
      }
      FastLED.show();
      delay(3);
    }
  }
  allumerLedsDirect();
}

void animConverge() {
  // Les LED convergent depuis les bords vers chaque produit
  int maxDist = 0;
  for (int r = 0; r < rangeCount; r++) {
    int center = (ranges[r].start + ranges[r].end) / 2;
    maxDist = max(maxDist, max(center, NUM_LEDS - center));
  }
  for (int dist = maxDist; dist >= 0; dist--) {
    for (int i = 0; i < NUM_LEDS; i++) leds[i] = CRGB::Black;
    for (int r = 0; r < rangeCount; r++) {
      int center = (ranges[r].start + ranges[r].end) / 2;
      int lo = center - dist;
      int hi = center + dist;
      if (lo >= 0 && lo < NUM_LEDS) leds[lo] = ranges[r].color;
      if (hi >= 0 && hi < NUM_LEDS) leds[hi] = ranges[r].color;
      // Si on est arrivé au produit, remplir
      if (dist <= (ranges[r].end - ranges[r].start) / 2) {
        for (int i = ranges[r].start; i <= ranges[r].end && i < NUM_LEDS; i++) {
          if (i >= 0) leds[i] = ranges[r].color;
        }
      }
    }
    FastLED.show();
    delay(8);
  }
  allumerLedsDirect();
}

void animEdges() {
  // Flash des bords puis remplissage produit
  for (int flash = 0; flash < 3; flash++) {
    for (int r = 0; r < rangeCount; r++) {
      if (ranges[r].start >= 0 && ranges[r].start < NUM_LEDS)
        leds[ranges[r].start] = ranges[r].color;
      if (ranges[r].end >= 0 && ranges[r].end < NUM_LEDS)
        leds[ranges[r].end] = ranges[r].color;
    }
    FastLED.show();
    delay(150);
    for (int i = 0; i < NUM_LEDS; i++) leds[i] = CRGB::Black;
    FastLED.show();
    delay(100);
  }
  allumerLedsDirect();
}

void animFlash() {
  // 3 flashs blancs puis affichage final
  for (int f = 0; f < 3; f++) {
    for (int r = 0; r < rangeCount; r++) {
      for (int i = ranges[r].start; i <= ranges[r].end && i < NUM_LEDS; i++) {
        if (i >= 0) leds[i] = CRGB::White;
      }
    }
    FastLED.show();
    delay(80);
    for (int i = 0; i < NUM_LEDS; i++) leds[i] = CRGB::Black;
    FastLED.show();
    delay(80);
  }
  allumerLedsDirect();
}

// Dispatch animation
void allumerLedsAvecAnim(String anim, int shelfSize) {
  if (rangeCount == 0) return;
  if (anim == "snake") animSnake(shelfSize);
  else if (anim == "serpentin") animSerpentin(shelfSize);
  else if (anim == "chase") animChase();
  else if (anim == "converge") animConverge();
  else if (anim == "edges") animEdges();
  else if (anim == "flash") animFlash();
  else allumerLedsDirect();
}

// ============================================================
// SETUP
// ============================================================
void setup() {
  Serial.begin(115200);
  delay(1000);

  pinMode(RELAY_CAFE, OUTPUT);
  pinMode(RELAY_FRIGO, OUTPUT);
  pinMode(RELAY_CONGELATEUR, OUTPUT);
  pinMode(RELAY_LED, OUTPUT);
  relayOff(RELAY_CAFE);
  relayOff(RELAY_FRIGO);
  relayOff(RELAY_CONGELATEUR);
  relayOff(RELAY_LED);

  // Init bande LED WS2812B
  FastLED.addLeds<WS2812B, 27, GRB>(leds, NUM_LEDS);
  FastLED.setBrightness(150);
  // Nettoyage complet au démarrage
  for (int i = 0; i < NUM_LEDS; i++) leds[i] = CRGB::Black;
  FastLED.show();

  capteurFrigo.begin();
  capteurCongel.begin();

  Serial.println();
  Serial.println("=== AERO-CLUB DU BASSIN D'ARCACHON ===");
  Serial.println("=== Carte 4-Relay + LED WS2812B ===");
  Serial.printf("DS18B20 - Frigo: %d, Congelateur: %d\n",
                capteurFrigo.getDeviceCount(), capteurCongel.getDeviceCount());
  Serial.printf("WS2812B - %d LEDs sur GPIO %d\n", NUM_LEDS, LED_PIN);

  Serial.print("WiFi : ");
  Serial.println(WIFI_SSID);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 30) {
    delay(500); Serial.print(".");
    attempts++;
  }
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\nWiFi OK - IP : " + WiFi.localIP().toString());
  } else {
    Serial.println("\nERREUR WiFi !");
  }

  capteurFrigo.requestTemperatures();
  capteurCongel.requestTemperatures();
  delay(800);
  lireTemperatures();
  envoyerTemperatures();

  Serial.println("=== Init OK ===\n");
}

// ============================================================
// LOOP
// ============================================================
void loop() {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("WiFi perdu, reconnexion...");
    WiFi.disconnect();
    delay(1000);
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
    delay(5000);
    return;
  }

  unsigned long now = millis();

  // Anti-bruit : nettoyage périodique quand aucune LED produit n'est active
  if (rangeCount == 0 && now - lastPoll >= 1000) {
    for (int i = 0; i < NUM_LEDS; i++) leds[i] = CRGB::Black;
    FastLED.show();
  }

  if (now - lastPoll >= POLL_INTERVAL) {
    lastPoll = now;
    pollSerrures();
  }

  if (!tempRequested && now - lastTemp >= TEMP_INTERVAL) {
    lastTemp = now;
    capteurFrigo.requestTemperatures();
    capteurCongel.requestTemperatures();
    tempRequestTime = now;
    tempRequested = true;
  }
  if (tempRequested && now - tempRequestTime >= 800) {
    tempRequested = false;
    lireTemperatures();
    envoyerTemperatures();
  }
}

// ============================================================
// POLL + ACTIVATION DIRECTE
// ============================================================
void pollSerrures() {
  WiFiClientSecure client;
  client.setInsecure();
  HTTPClient http;

  if (http.begin(client, String(API_URL) + "?action=check")) {
    int httpCode = http.GET();
    if (httpCode == 200) {
      String body = http.getString();
      http.end();

      Serial.println("Body: " + body);

      bool needCafe = body.indexOf("\"cafe\":true") >= 0;
      bool needFrigo = body.indexOf("\"frigo\":true") >= 0;
      bool needCongelateur = body.indexOf("\"congelateur\":true") >= 0;

      if (body.indexOf("\"both\":true") >= 0) {
        needCafe = true;
        needFrigo = true;
        needCongelateur = true;
      }

      // Extraire les plages LED de la réponse
      String ledRanges = "";
      int ledsIdx = body.indexOf("\"leds\":\"");
      if (ledsIdx >= 0) {
        int start = ledsIdx + 8;
        int end = body.indexOf("\"", start);
        if (end > start) {
          ledRanges = body.substring(start, end);
        }
      }

      // Extraire animation
      String anim = "none";
      int animIdx = body.indexOf("\"anim\":\"");
      if (animIdx >= 0) {
        int start = animIdx + 8;
        int end = body.indexOf("\"", start);
        if (end > start) anim = body.substring(start, end);
      }

      // Extraire shelf (LEDs par étagère)
      int shelfIdx = body.indexOf("\"shelf\":");
      if (shelfIdx >= 0) {
        int start = shelfIdx + 8;
        int end = start;
        while (end < (int)body.length() && (body[end] >= '0' && body[end] <= '9')) end++;
        if (end > start) ledsPerShelf = body.substring(start, end).toInt();
      }

      // Extraire luminosité
      int brightIdx = body.indexOf("\"bright\":");
      if (brightIdx >= 0) {
        int start = brightIdx + 9;
        int end = start;
        while (end < (int)body.length() && (body[end] >= '0' && body[end] <= '9')) end++;
        if (end > start) {
          ledBrightness = body.substring(start, end).toInt();
          FastLED.setBrightness(ledBrightness);
        }
      }

      // ═══ CAS 1 : Serrures à ouvrir (avec ou sans LEDs) ═══
      if (needCafe || needFrigo || needCongelateur) {
        Serial.print(">>> DEVERROUILLAGE:");
        if (needCafe) Serial.print(" CAFE(1s)");
        if (needFrigo) Serial.print(" FRIGO(3s)");
        if (needCongelateur) Serial.print(" CONGELATEUR(5s)");
        Serial.println(" <<<");

        // Couper la LED vitrine pendant l'affichage produits
        if (ledState) relayOff(RELAY_LED);

        // Allumer les LED des produits achetés
        if (ledRanges.length() > 0) {
          parseRanges(ledRanges);
          allumerLedsAvecAnim(anim, ledsPerShelf);
        }

        // Tout activer en même temps
        if (needCafe) relayOn(RELAY_CAFE);
        if (needFrigo) relayOn(RELAY_FRIGO);
        if (needCongelateur) relayOn(RELAY_CONGELATEUR);

        unsigned long startTime = millis();
        bool cafeOff = !needCafe;
        bool frigoOff = !needFrigo;
        bool congelOff = !needCongelateur;
        bool ledsOff = (ledRanges.length() == 0);

        // Couper chaque relais à sa durée
        while (!cafeOff || !frigoOff || !congelOff || !ledsOff) {
          unsigned long elapsed = millis() - startTime;
          if (!cafeOff && elapsed >= DUREE_CAFE) {
            relayOff(RELAY_CAFE);
            cafeOff = true;
            Serial.println("  Cafe ferme");
          }
          if (!frigoOff && elapsed >= DUREE_FRIGO) {
            relayOff(RELAY_FRIGO);
            frigoOff = true;
            Serial.println("  Frigo ferme");
          }
          if (!congelOff && elapsed >= DUREE_CONGEL) {
            relayOff(RELAY_CONGELATEUR);
            congelOff = true;
            Serial.println("  Congelateur ferme");
          }
          if (!ledsOff && elapsed >= DUREE_LEDS) {
            eteindreLeds();
            ledsOff = true;
            Serial.println("  LEDs eteintes");
          }
          delay(10);
        }

        // Si les LEDs n'avaient pas de timer séparé
        if (ledRanges.length() > 0 && rangeCount > 0) {
          eteindreLeds();
        }

        Serial.println(">>> VERROUILLE <<<");

        // Restaurer la LED vitrine
        if (ledState) relayOn(RELAY_LED);

        // Confirmer à l'API
        WiFiClientSecure c2;
        c2.setInsecure();
        HTTPClient h2;
        if (h2.begin(c2, String(API_URL) + "?action=done")) { h2.GET(); h2.end(); }
      }
      // ═══ CAS 2 : LED seules, pas de serrure (test admin, lock=none) ═══
      else if (ledRanges.length() > 0) {
        Serial.println(">>> LED SEULES (test admin) <<<");

        // Couper la LED vitrine pendant l'affichage
        if (ledState) relayOff(RELAY_LED);

        parseRanges(ledRanges);
        allumerLedsAvecAnim(anim, ledsPerShelf);

        // Garder allumé DUREE_LEDS
        delay(DUREE_LEDS);
        eteindreLeds();

        Serial.println(">>> LED ETEINTES <<<");

        // Restaurer la LED vitrine
        if (ledState) relayOn(RELAY_LED);
      }

      // LED vitrine (relais R4)
      bool wantLed = body.indexOf("\"led\":true") >= 0;
      if (wantLed != ledState) {
        ledState = wantLed;
        if (ledState) relayOn(RELAY_LED); else relayOff(RELAY_LED);
        Serial.printf("LED vitrine : %s\n", ledState ? "ON" : "OFF");
      }

    } else {
      Serial.printf("HTTP erreur : %d\n", httpCode);
      http.end();
    }
  }
}

// ============================================================
// TEMPERATURES
// ============================================================
void lireTemperatures() {
  float t;
  t = capteurFrigo.getTempCByIndex(0);
  // Toujours mettre à jour : valeur valide OU -127 si capteur absent
  if (t != DEVICE_DISCONNECTED_C && t != -127.0 && t != 85.0) {
    tempFrigo = t;
  } else {
    tempFrigo = -127.0;  // capteur absent/erreur → signaler au frontend
  }
  t = capteurCongel.getTempCByIndex(0);
  if (t != DEVICE_DISCONNECTED_C && t != -127.0 && t != 85.0) {
    tempCongel = t;
  } else {
    tempCongel = -127.0;
  }
  Serial.printf("Temp - Frigo: %.1f C | Congel: %.1f C\n", tempFrigo, tempCongel);
}

void envoyerTemperatures() {
  if (WiFi.status() != WL_CONNECTED) return;
  // Toujours envoyer, même si les deux sont invalides (-127)
  // pour que le frontend ait un timestamp frais et sache que l'ESP32 est vivant

  WiFiClientSecure client;
  client.setInsecure();
  HTTPClient http;

  if (http.begin(client, TEMP_URL)) {
    http.addHeader("Content-Type", "application/json");
    String json = "{\"frigo\":";
    json += (tempFrigo != -127.0) ? String(tempFrigo, 1) : "null";
    json += ",\"congelateur\":";
    json += (tempCongel != -127.0) ? String(tempCongel, 1) : "null";
    json += "}";

    int code = http.POST(json);
    Serial.printf("Temp envoi : HTTP %d\n", code);
    http.end();
  }
}
