/*
 * AEROCLUB DU BASSIN D'ARCACHON - ESP32 Controller
 * =================================================
 * Gere :
 *   - 3 relais (serrures) : cafe (pin 5), frigo (pin 18), congelateur (pin 19)
 *   - 1 relais (LED frigo) : led vitrine (pin 21)
 *   - 2 capteurs DS18B20  : frigo (pin 4), congelateur (pin 15)
 *
 * Fonctionnement :
 *   - Poll /api/fridge?action=check toutes les 2s pour les serrures
 *   - Envoie les temperatures toutes les 30s via POST /api/temperature
 *   - Poll /api/fridge-led toutes les 30s pour la LED du frigo vitrine
 *   - Les relais cafe/frigo = active LOW (pas de jumper) -> LOW = ouvert
 *   - Le relais congelateur = active HIGH (jumper)       -> HIGH = ouvert
 *   - Le relais LED = active HIGH -> HIGH = LED allumee
 *   - Activation decalee 500ms entre relais pour eviter chute de courant
 *   - Les DS18B20 utilisent le protocole OneWire (1 fil data + pull-up 4.7k)
 *
 * Librairies requises (Arduino IDE > Gestionnaire de bibliotheques) :
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

// --- PINS RELAIS (serrures) ---
const int RELAY_CAFE        = 5;
const int RELAY_FRIGO       = 18;
const int RELAY_CONGELATEUR = 19;

// --- PIN RELAIS LED FRIGO VITRINE ---
const int RELAY_LED         = 2;   // GPIO 2 — relais LED vitrine

// --- PINS CAPTEURS DS18B20 ---
const int TEMP_FRIGO_PIN  = 4;   // DS18B20 du frigo
const int TEMP_CONGEL_PIN = 15;  // DS18B20 du congelateur

// --- TIMING ---
const unsigned long POLL_INTERVAL = 2000;   // Poll serrures toutes les 2s
const unsigned long TEMP_INTERVAL = 30000;  // Envoi temperatures toutes les 30s
const unsigned long LOCK_HOLD_MS  = 7000;   // Maintenir serrures ouvertes 7s (avant: 5s)
// LED lue dans la reponse du poll serrures (toutes les 2s, pas de requete en plus)

// --- OBJETS CAPTEURS ---
OneWire oneWireFrigo(TEMP_FRIGO_PIN);
OneWire oneWireCongel(TEMP_CONGEL_PIN);
DallasTemperature capteurFrigo(&oneWireFrigo);
DallasTemperature capteurCongel(&oneWireCongel);

// --- VARIABLES ---
unsigned long lastPoll = 0;
unsigned long lastTemp = 0;
unsigned long tempRequestTime = 0;  // Quand on a lance requestTemperatures()
bool tempRequested = false;          // true = en attente de conversion
bool ledState = false;     // Etat actuel de la LED

// Dernieres temperatures lues
float tempFrigo = -127.0;
float tempCongel = -127.0;

void setup() {
  Serial.begin(115200);
  delay(1000);

  // --- Init relais ---
  pinMode(RELAY_CAFE, OUTPUT);
  pinMode(RELAY_FRIGO, OUTPUT);
  pinMode(RELAY_CONGELATEUR, OUTPUT);
  pinMode(RELAY_LED, OUTPUT);
  digitalWrite(RELAY_CAFE, HIGH);       // HIGH = verrouille (actif LOW)
  digitalWrite(RELAY_FRIGO, HIGH);      // HIGH = verrouille (actif LOW)
  digitalWrite(RELAY_CONGELATEUR, LOW); // LOW = verrouille (actif HIGH, jumper)
  digitalWrite(RELAY_LED, LOW);         // LED eteinte au demarrage

  // --- Init capteurs temperature ---
  capteurFrigo.begin();
  capteurCongel.begin();

  int nbFrigo = capteurFrigo.getDeviceCount();
  int nbCongel = capteurCongel.getDeviceCount();

  Serial.println();
  Serial.println("=== AERO-CLUB DU BASSIN D'ARCACHON ===");
  Serial.println("=== ESP32 : Serrures + Temperatures + LED ===");
  Serial.printf("Capteurs DS18B20 - Frigo: %d, Congelateur: %d\n", nbFrigo, nbCongel);
  if (nbFrigo == 0) Serial.println("  ATTENTION: Aucun DS18B20 sur pin 4 (frigo) !");
  if (nbCongel == 0) Serial.println("  ATTENTION: Aucun DS18B20 sur pin 15 (congelateur) !");

  // --- WiFi ---
  Serial.print("Connexion au WiFi : ");
  Serial.println(WIFI_SSID);

  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 30) {
    delay(500);
    Serial.print(".");
    attempts++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println();
    Serial.println("WiFi connecte !");
    Serial.print("Adresse IP : ");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println();
    Serial.println("ERREUR : WiFi non connecte !");
  }

  // --- Premiere lecture temperature ---
  capteurFrigo.requestTemperatures();
  capteurCongel.requestTemperatures();
  delay(800); // Attendre la premiere conversion (12 bits = ~750ms)
  lireTemperatures();
  envoyerTemperatures();

  Serial.println("=== Initialisation terminee ===");
  Serial.println();
}

void loop() {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("WiFi deconnecte, reconnexion...");
    WiFi.disconnect();
    delay(1000);
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
    delay(5000);
    return;
  }

  unsigned long now = millis();

  // --- POLL SERRURES (toutes les 2s) ---
  if (now - lastPoll >= POLL_INTERVAL) {
    lastPoll = now;
    pollSerrures();
  }

  // --- ENVOI TEMPERATURES (toutes les 30s, non-bloquant) ---
  if (!tempRequested && now - lastTemp >= TEMP_INTERVAL) {
    lastTemp = now;
    capteurFrigo.requestTemperatures();
    capteurCongel.requestTemperatures();
    tempRequestTime = now;
    tempRequested = true;
  }
  // Lire les temperatures apres 800ms de conversion (sans bloquer le polling)
  if (tempRequested && now - tempRequestTime >= 800) {
    tempRequested = false;
    lireTemperatures();
    envoyerTemperatures();
  }

}

// ============================================================
// POLL SERRURES (API /api/fridge?action=check)
// ============================================================
// Double-pulse : bref coup fort (100ms) + repos (50ms) + maintien
// Coupe la LED pendant le deverrouillage pour liberer du courant
// ============================================================
void activerSerrure(int pin, bool activeHigh) {
  // Pulse initiale forte pour vaincre l'inertie du mecanisme
  digitalWrite(pin, activeHigh ? HIGH : LOW);
  delay(100);
  // Bref repos puis maintien continu
  digitalWrite(pin, activeHigh ? LOW : HIGH);
  delay(50);
  digitalWrite(pin, activeHigh ? HIGH : LOW);
}

void pollSerrures() {
  WiFiClientSecure client;
  client.setInsecure(); // Necessaire pour HTTPS sur ESP32
  HTTPClient http;
  String checkUrl = String(API_URL) + "?action=check";

  if (http.begin(client, checkUrl)) {
    int httpCode = http.GET();
    if (httpCode == 200) {
      String body = http.getString();

      // PRIORITE 1 : Serrures — lire les flags IMMEDIATEMENT
      bool needCafe = body.indexOf("\"cafe\":true") >= 0;
      bool needFrigo = body.indexOf("\"frigo\":true") >= 0;
      bool needCongelateur = body.indexOf("\"congelateur\":true") >= 0;

      // "both" = fallback, ouvrir tout
      if (body.indexOf("\"both\":true") >= 0) {
        needCafe = true;
        needFrigo = true;
        needCongelateur = true;
      }

      http.end();

      // PRIORITE 2 : Serrures d'abord, LED ensuite
      if (needCafe || needFrigo || needCongelateur) {
        Serial.print(">>> DEVERROUILLAGE:");
        if (needCafe) Serial.print(" CAFE");
        if (needFrigo) Serial.print(" FRIGO");
        if (needCongelateur) Serial.print(" CONGELATEUR");
        Serial.println(" <<<");

        // Couper la LED pendant le deverrouillage pour liberer du courant
        bool ledWasOn = ledState;
        if (ledWasOn) {
          digitalWrite(RELAY_LED, LOW);
          delay(50); // Laisser le courant se stabiliser
        }

        // Activation avec double-pulse, decalee entre chaque serrure
        if (needCafe) { activerSerrure(RELAY_CAFE, false); delay(300); }
        if (needFrigo) { activerSerrure(RELAY_FRIGO, false); delay(300); }
        if (needCongelateur) { activerSerrure(RELAY_CONGELATEUR, true); }

        delay(LOCK_HOLD_MS); // Maintenir ouvert

        // Verrouiller tout ce qui a ete ouvert
        if (needCongelateur) digitalWrite(RELAY_CONGELATEUR, LOW);
        if (needFrigo) digitalWrite(RELAY_FRIGO, HIGH);
        if (needCafe) digitalWrite(RELAY_CAFE, HIGH);
        Serial.println(">>> VERROUILLE <<<");

        // Restaurer la LED si elle etait allumee
        if (ledWasOn) {
          delay(100);
          digitalWrite(RELAY_LED, HIGH);
        }

        // Confirmer a l'API
        HTTPClient h2;
        if (h2.begin(client, String(API_URL) + "?action=done")) { h2.GET(); h2.end(); }
      }

      // PRIORITE 3 : LED frigo vitrine (apres les serrures)
      bool wantLed = body.indexOf("\"led\":true") >= 0;
      if (wantLed != ledState) {
        ledState = wantLed;
        digitalWrite(RELAY_LED, ledState ? HIGH : LOW);
        Serial.printf("LED frigo vitrine : %s\n", ledState ? "ALLUMEE" : "ETEINTE");
      }

    } else {
      Serial.print("Erreur HTTP : ");
      Serial.println(httpCode);
    }
    http.end();
  }
}

// ============================================================
// LECTURE TEMPERATURES DS18B20
// ============================================================
void lireTemperatures() {
  float t;

  // Frigo
  t = capteurFrigo.getTempCByIndex(0);
  if (t != DEVICE_DISCONNECTED_C && t != -127.0) {
    tempFrigo = t;
  }

  // Congelateur
  t = capteurCongel.getTempCByIndex(0);
  if (t != DEVICE_DISCONNECTED_C && t != -127.0) {
    tempCongel = t;
  }

  Serial.printf("Temperatures - Frigo: %.1f C | Congelateur: %.1f C\n",
                tempFrigo, tempCongel);
}

// ============================================================
// ENVOI TEMPERATURES AU SERVEUR (POST /api/temperature)
// ============================================================
void envoyerTemperatures() {
  if (WiFi.status() != WL_CONNECTED) return;
  if (tempFrigo == -127.0 && tempCongel == -127.0) {
    Serial.println("Pas de temperature valide, envoi ignore");
    return;
  }

  WiFiClientSecure client;
  client.setInsecure();
  HTTPClient http;

  if (http.begin(client, TEMP_URL)) {
    http.addHeader("Content-Type", "application/json");

    // JSON payload
    String json = "{";
    json += "\"frigo\":";
    json += (tempFrigo != -127.0) ? String(tempFrigo, 1) : "null";
    json += ",\"congelateur\":";
    json += (tempCongel != -127.0) ? String(tempCongel, 1) : "null";
    json += "}";

    int code = http.POST(json);

    if (code == 200) {
      Serial.println("Temperatures envoyees OK");
    } else {
      Serial.printf("Envoi temperature HTTP %d\n", code);
    }

    http.end();
  }
}

// LED frigo vitrine : etat lu dans pollSerrures() (meme requete, pas de poll separe)
