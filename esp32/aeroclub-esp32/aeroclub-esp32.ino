/*
 * AEROCLUB DU BASSIN D'ARCACHON - ESP32 4-Relay Board
 * ====================================================
 * Carte : LC-Relay-ESP32-4R-A2
 * R1(GPIO33)=Café(1s)  R2(GPIO25)=Frigo(3s)  R3(GPIO26)=Congél(5s)  R4(GPIO32)=LED
 *
 * LED WS2812B : bande adressable dans le frigo
 *   - L'API renvoie "leds":"0-2,5-7" = plages de LED a allumer
 *   - Allumées pendant l'ouverture du frigo, éteintes après
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

// === LED WS2812B ===
const int LED_PIN       = 27;   // GPIO pour la bande WS2812B — adapter si besoin
const int NUM_LEDS      = 60;   // nombre total de LED sur la bande — adapter
CRGB leds[60];                  // tableau LED (doit correspondre a NUM_LEDS)

// === GPIO CAPTEURS TEMPERATURE ===
const int TEMP_FRIGO_PIN    = 16;  // adapter selon pin libre
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

// === LED WS2812B : allumer les plages recues avec couleur ===
// Format attendu : "0-2:FF0000,5-7:00FF00" (plage:couleurHex)
// Si pas de couleur : blanc par defaut
void allumerLeds(String ranges) {
  FastLED.clear();

  if (ranges.length() == 0) {
    FastLED.show();
    return;
  }

  int idx = 0;
  while (idx < (int)ranges.length()) {
    // Lire le debut de la plage
    int dashPos = ranges.indexOf('-', idx);
    if (dashPos < 0) break;

    // Trouver la fin du segment (virgule ou fin de chaine)
    int commaPos = ranges.indexOf(',', dashPos);
    if (commaPos < 0) commaPos = ranges.length();

    // Chercher la couleur (apres le ':')
    int colonPos = ranges.indexOf(':', dashPos);
    int endPos;
    CRGB color = CRGB::White;

    if (colonPos > 0 && colonPos < commaPos) {
      // Plage avec couleur : "0-2:FF0000"
      endPos = colonPos;
      String hexColor = ranges.substring(colonPos + 1, commaPos);
      // Parser le hex en RGB
      long rgb = strtol(hexColor.c_str(), NULL, 16);
      color = CRGB((rgb >> 16) & 0xFF, (rgb >> 8) & 0xFF, rgb & 0xFF);
    } else {
      // Plage sans couleur : "0-2"
      endPos = commaPos;
    }

    int start = ranges.substring(idx, dashPos).toInt();
    int end = ranges.substring(dashPos + 1, endPos).toInt();

    // Allumer les LED de start a end (inclusive)
    for (int i = start; i <= end && i < NUM_LEDS; i++) {
      if (i >= 0) leds[i] = color;
    }

    idx = commaPos + 1;
  }

  FastLED.show();
  Serial.printf("LED WS2812B : %s\n", ranges.c_str());
}

void eteindreLeds() {
  FastLED.clear();
  FastLED.show();
}

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
  FastLED.setBrightness(150);  // luminosite 0-255
  FastLED.clear();
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

      bool needCafe = body.indexOf("\"cafe\":true") >= 0;
      bool needFrigo = body.indexOf("\"frigo\":true") >= 0;
      bool needCongelateur = body.indexOf("\"congelateur\":true") >= 0;

      if (body.indexOf("\"both\":true") >= 0) {
        needCafe = true;
        needFrigo = true;
        needCongelateur = true;
      }

      // Extraire les plages LED de la reponse
      String ledRanges = "";
      int ledsIdx = body.indexOf("\"leds\":\"");
      if (ledsIdx >= 0) {
        int start = ledsIdx + 8;
        int end = body.indexOf("\"", start);
        if (end > start) {
          ledRanges = body.substring(start, end);
        }
      }

      if (needCafe || needFrigo || needCongelateur) {
        Serial.print(">>> DEVERROUILLAGE:");
        if (needCafe) Serial.print(" CAFE(1s)");
        if (needFrigo) Serial.print(" FRIGO(3s)");
        if (needCongelateur) Serial.print(" CONGELATEUR(5s)");
        Serial.println(" <<<");

        // Allumer les LED des produits achetes
        if (ledRanges.length() > 0) {
          allumerLeds(ledRanges);
        }

        // Tout activer en meme temps
        if (needCafe) relayOn(RELAY_CAFE);
        if (needFrigo) relayOn(RELAY_FRIGO);
        if (needCongelateur) relayOn(RELAY_CONGELATEUR);

        unsigned long startTime = millis();
        bool cafeOff = !needCafe;
        bool frigoOff = !needFrigo;
        bool congelOff = !needCongelateur;

        // Couper chaque relais a sa duree
        while (!cafeOff || !frigoOff || !congelOff) {
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
          delay(10);
        }

        // Eteindre les LED apres fermeture
        eteindreLeds();

        Serial.println(">>> VERROUILLE <<<");

        if (ledState) relayOn(RELAY_LED); else relayOff(RELAY_LED);

        WiFiClientSecure c2;
        c2.setInsecure();
        HTTPClient h2;
        if (h2.begin(c2, String(API_URL) + "?action=done")) { h2.GET(); h2.end(); }
      }

      // LED vitrine
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
  if (t != DEVICE_DISCONNECTED_C && t != -127.0) tempFrigo = t;
  t = capteurCongel.getTempCByIndex(0);
  if (t != DEVICE_DISCONNECTED_C && t != -127.0) tempCongel = t;
  Serial.printf("Temp - Frigo: %.1f C | Congel: %.1f C\n", tempFrigo, tempCongel);
}

void envoyerTemperatures() {
  if (WiFi.status() != WL_CONNECTED) return;
  if (tempFrigo == -127.0 && tempCongel == -127.0) {
    Serial.println("Pas de temp valide");
    return;
  }

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
