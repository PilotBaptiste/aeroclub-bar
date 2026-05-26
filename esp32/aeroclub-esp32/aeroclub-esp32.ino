/*
 * AEROCLUB DU BASSIN D'ARCACHON - ESP32 Controller
 * =================================================
 * Gere :
 *   - 3 relais (serrures) : cafe (pin 5), frigo (pin 18), congelateur (pin 19)
 *   - 1 relais (LED frigo) : led vitrine (pin 2)
 *   - 2 capteurs DS18B20  : frigo (pin 15), congelateur (pin 4)
 *
 * Fonctionnement :
 *   - Poll /api/fridge?action=check toutes les 2s pour serrures + LED
 *   - Envoie les temperatures toutes les 30s via POST /api/temperature
 *   - LED = ON / OFF / auto (horaire) — lu dans la reponse du poll
 *   - Serrures : double-impulsion avec 1s de repos (simule "reouvrir")
 *   - Lectures temperature non-bloquantes
 *
 * Librairies requises :
 *   - OneWire           (par Jim Studt)
 *   - DallasTemperature (par Miles Burton)
 */

#include <WiFi.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>
#include <OneWire.h>
#include <DallasTemperature.h>

// === CONFIG ===
const char* WIFI_SSID     = "ACBA-H7";
const char* WIFI_PASSWORD = "villemarie-H7";
const char* API_URL       = "https://aeroclub-bar.vercel.app/api/fridge";
const char* TEMP_URL      = "https://aeroclub-bar.vercel.app/api/temperature";
// ==============

// --- PINS ---
const int RELAY_CAFE        = 5;
const int RELAY_FRIGO       = 18;
const int RELAY_CONGELATEUR = 19;
const int RELAY_LED         = 2;
const int TEMP_FRIGO_PIN    = 15;
const int TEMP_CONGEL_PIN   = 4;

// --- TIMING ---
const unsigned long POLL_INTERVAL = 2000;
const unsigned long TEMP_INTERVAL = 30000;
const unsigned long LOCK_HOLD_MS  = 7000;

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

void setup() {
  Serial.begin(115200);
  delay(1000);

  pinMode(RELAY_CAFE, OUTPUT);
  pinMode(RELAY_FRIGO, OUTPUT);
  pinMode(RELAY_CONGELATEUR, OUTPUT);
  pinMode(RELAY_LED, OUTPUT);
  digitalWrite(RELAY_CAFE, HIGH);
  digitalWrite(RELAY_FRIGO, HIGH);
  digitalWrite(RELAY_CONGELATEUR, LOW);
  digitalWrite(RELAY_LED, LOW);

  capteurFrigo.begin();
  capteurCongel.begin();

  Serial.println();
  Serial.println("=== AERO-CLUB DU BASSIN D'ARCACHON ===");
  Serial.printf("DS18B20 - Frigo: %d, Congelateur: %d\n",
                capteurFrigo.getDeviceCount(), capteurCongel.getDeviceCount());

  Serial.print("WiFi : ");
  Serial.println(WIFI_SSID);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 30) {
    delay(500); Serial.print("."); attempts++;
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
// ACTIVATION SERRURE — Double-impulsion avec vrai repos
// ============================================================
// Le "reouvrir" marche a chaque fois parce qu'il y a 3-4s
// entre la 1ere tentative et la 2eme. Le pene se "decolle"
// au 1er coup puis rentre facilement au 2eme.
//
// On reproduit ca : 1s de traction, 1s de repos, puis maintien.
// Le repos de 1s laisse le ressort repousser le pene dans une
// position "desaxee" plus facile a retirer.
// ============================================================
void activerSerrure(int pin, bool activeHigh) {
  int on  = activeHigh ? HIGH : LOW;
  int off = activeHigh ? LOW  : HIGH;

  // Traction 1 : impulsion longue soutenue (1 seconde)
  // Tente de tirer le pene, le decolle au minimum
  digitalWrite(pin, on);
  delay(1000);

  // Repos 1 seconde — le ressort repousse le pene
  // mais il revient "desaxe", plus dans son logement d'origine
  digitalWrite(pin, off);
  delay(1000);

  // Traction 2 : maintien continu
  // Le pene desaxe se retracte completement cette fois
  // = exactement comme quand on appuie "reouvrir"
  digitalWrite(pin, on);
}

// ============================================================
// POLL SERRURES + LED
// ============================================================
void pollSerrures() {
  WiFiClientSecure client;
  client.setInsecure();
  HTTPClient http;

  if (http.begin(client, String(API_URL) + "?action=check")) {
    int httpCode = http.GET();
    if (httpCode == 200) {
      String body = http.getString();

      bool needCafe = body.indexOf("\"cafe\":true") >= 0;
      bool needFrigo = body.indexOf("\"frigo\":true") >= 0;
      bool needCongelateur = body.indexOf("\"congelateur\":true") >= 0;

      if (body.indexOf("\"both\":true") >= 0) {
        needCafe = true;
        needFrigo = true;
        needCongelateur = true;
      }

      http.end();

      if (needCafe || needFrigo || needCongelateur) {
        unsigned long unlockStart = millis();

        Serial.print(">>> DEVERROUILLAGE:");
        if (needCafe) Serial.print(" CAFE");
        if (needFrigo) Serial.print(" FRIGO");
        if (needCongelateur) Serial.print(" CONGELATEUR");
        Serial.println(" <<<");

        // Delai post-WiFi : laisser l'ESP32 se stabiliser
        // Le module WiFi tire ~250mA, ca peut affecter les GPIO
        delay(200);

        // Congelateur (module separe, fonctionne nickel)
        if (needCongelateur) {
          activerSerrure(RELAY_CONGELATEUR, true);
        }

        // Cafe
        if (needCafe) {
          activerSerrure(RELAY_CAFE, false);
        }

        // Frigo
        if (needFrigo) {
          activerSerrure(RELAY_FRIGO, false);
        }

        // Maintenir ouvert pour le temps restant (7s au total)
        unsigned long elapsed = millis() - unlockStart;
        if (elapsed < LOCK_HOLD_MS) {
          delay(LOCK_HOLD_MS - elapsed);
        }

        // Verrouiller
        if (needCongelateur) digitalWrite(RELAY_CONGELATEUR, LOW);
        if (needFrigo) digitalWrite(RELAY_FRIGO, HIGH);
        if (needCafe) digitalWrite(RELAY_CAFE, HIGH);
        Serial.println(">>> VERROUILLE <<<");

        // Restaurer LED a son etat normal
        digitalWrite(RELAY_LED, ledState ? HIGH : LOW);

        // Confirmer a l'API
        HTTPClient h2;
        if (h2.begin(client, String(API_URL) + "?action=done")) { h2.GET(); h2.end(); }
      }

      // LED frigo vitrine — etat lu dans la meme reponse
      bool wantLed = body.indexOf("\"led\":true") >= 0;
      if (wantLed != ledState) {
        ledState = wantLed;
        digitalWrite(RELAY_LED, ledState ? HIGH : LOW);
        Serial.printf("LED vitrine : %s\n", ledState ? "ON" : "OFF");
      }

    } else {
      Serial.printf("HTTP erreur : %d\n", httpCode);
    }
    http.end();
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
