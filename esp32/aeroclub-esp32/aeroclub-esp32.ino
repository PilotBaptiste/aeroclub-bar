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
 *   - Serrures : double activation auto (1ere tentative + "reouvrir")
 *   - 500ms de delai post-WiFi avant activation relais
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

// --- FLAGS SERRURES (activation differee du WiFi) ---
bool pendingCafe = false;
bool pendingFrigo = false;
bool pendingCongelateur = false;
bool pendingUnlock = false;
unsigned long pendingTime = 0;
String pendingBody = "";  // Garder le body pour la LED

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

  // --- POLL SERRURES + LED (toutes les 2s) ---
  // Le poll ne fait QUE lire l'API et stocker les flags.
  // L'activation des relais est differee de 500ms pour que
  // le module WiFi soit completement au repos.
  if (now - lastPoll >= POLL_INTERVAL) {
    lastPoll = now;
    pollSerrures();
  }

  // --- ACTIVATION DIFFEREE DES SERRURES ---
  // 500ms apres le poll WiFi, le 3.3V est stable,
  // les GPIO delivrent pleine tension aux relais
  if (pendingUnlock && now - pendingTime >= 500) {
    pendingUnlock = false;
    activerSerrures();
  }

  // --- TEMPERATURES (non-bloquant) ---
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
// POLL — Lit l'API, stocke les flags, N'ACTIVE RIEN
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

      // Lire les flags serrures
      bool needCafe = body.indexOf("\"cafe\":true") >= 0;
      bool needFrigo = body.indexOf("\"frigo\":true") >= 0;
      bool needCongelateur = body.indexOf("\"congelateur\":true") >= 0;

      if (body.indexOf("\"both\":true") >= 0) {
        needCafe = true;
        needFrigo = true;
        needCongelateur = true;
      }

      // Stocker pour activation differee (pas maintenant !)
      if (needCafe || needFrigo || needCongelateur) {
        pendingCafe = needCafe;
        pendingFrigo = needFrigo;
        pendingCongelateur = needCongelateur;
        pendingUnlock = true;
        pendingTime = millis();

        Serial.print(">>> FLAGS RECUS:");
        if (needCafe) Serial.print(" CAFE");
        if (needFrigo) Serial.print(" FRIGO");
        if (needCongelateur) Serial.print(" CONGELATEUR");
        Serial.println(" (activation dans 500ms) <<<");
      }

      // LED — traiter immediatement (pas de probleme de courant)
      bool wantLed = body.indexOf("\"led\":true") >= 0;
      if (wantLed != ledState) {
        ledState = wantLed;
        digitalWrite(RELAY_LED, ledState ? HIGH : LOW);
        Serial.printf("LED vitrine : %s\n", ledState ? "ON" : "OFF");
      }

    } else {
      Serial.printf("HTTP erreur : %d\n", httpCode);
      http.end();
    }
  }
}

// ============================================================
// ACTIVATION SERRURES — WiFi au repos, GPIO pleine puissance
// ============================================================
// Appelee 500ms apres le poll. Le module WiFi est inactif,
// le 3.3V est stable, les GPIO delivrent la tension max
// aux optocouplers des relais.
//
// Double activation automatique :
//   Tentative 1 : 2s d'activation (decolle le pene)
//   Repos       : 1.5s (le ressort repousse, pene se desaxe)
//   Tentative 2 : 5s de maintien (= "reouvrir", ca passe)
//
// C'est exactement ce qui se passe quand on appuie manuellement
// sur "reouvrir" et que ca marche a chaque fois.
// ============================================================
void activerSerrures() {
  Serial.println(">>> DEVERROUILLAGE - Tentative 1 <<<");

  // --- TENTATIVE 1 : activer 2 secondes ---
  if (pendingCongelateur) digitalWrite(RELAY_CONGELATEUR, HIGH);
  if (pendingCafe) { digitalWrite(RELAY_CAFE, LOW); delay(300); }
  if (pendingFrigo) digitalWrite(RELAY_FRIGO, LOW);

  delay(2000);

  // --- REPOS 1.5s : couper cafe/frigo, laisser congelateur ---
  // (le congelateur est sur un module separe, pas de probleme)
  if (pendingCafe) digitalWrite(RELAY_CAFE, HIGH);
  if (pendingFrigo) digitalWrite(RELAY_FRIGO, HIGH);
  Serial.println(">>> REPOS 1.5s <<<");
  delay(1500);

  // --- TENTATIVE 2 : "reouvrir" automatique, maintien 5s ---
  Serial.println(">>> DEVERROUILLAGE - Tentative 2 (auto-reouvrir) <<<");
  if (pendingCafe) { digitalWrite(RELAY_CAFE, LOW); delay(300); }
  if (pendingFrigo) digitalWrite(RELAY_FRIGO, LOW);

  delay(5000);

  // --- VERROUILLER ---
  if (pendingCongelateur) digitalWrite(RELAY_CONGELATEUR, LOW);
  if (pendingFrigo) digitalWrite(RELAY_FRIGO, HIGH);
  if (pendingCafe) digitalWrite(RELAY_CAFE, HIGH);
  Serial.println(">>> VERROUILLE <<<");

  // Restaurer LED
  digitalWrite(RELAY_LED, ledState ? HIGH : LOW);

  // Confirmer a l'API
  WiFiClientSecure client;
  client.setInsecure();
  HTTPClient h2;
  if (h2.begin(client, String(API_URL) + "?action=done")) { h2.GET(); h2.end(); }
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
