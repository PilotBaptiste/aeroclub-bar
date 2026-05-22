/*
 * AEROCLUB DU BASSIN D'ARCACHON - ESP32 Controller
 * =================================================
 * Gere :
 *   - 3 relais (serrures) : cafe (pin 5), frigo (pin 18), congelateur (pin 19)
 *   - 2 capteurs DS18B20  : frigo (pin 4), congelateur (pin 15)
 *
 * Fonctionnement :
 *   - Poll /api/fridge?action=check toutes les 2s pour les serrures
 *   - Envoie les temperatures toutes les 30s via /api/temperature
 *   - Les relais cafe/frigo = active LOW (pas de jumper) -> LOW = ouvert
 *   - Le relais congelateur = active HIGH (jumper)       -> HIGH = ouvert
 *   - Les DS18B20 utilisent le protocole OneWire (1 fil data + pull-up 4.7k)
 *
 * Librairies requises (installer via Arduino IDE > Gestionnaire de bibliotheques) :
 *   - OneWire         (par Jim Studt)
 *   - DallasTemperature (par Miles Burton)
 */

#include <WiFi.h>
#include <HTTPClient.h>
#include <OneWire.h>
#include <DallasTemperature.h>

// ============================================================
// CONFIGURATION - A MODIFIER SELON TON RESEAU
// ============================================================
const char* WIFI_SSID     = "REMPLACER_PAR_TON_SSID";
const char* WIFI_PASSWORD = "REMPLACER_PAR_TON_MOT_DE_PASSE";
const char* SERVER_URL    = "https://aeroclub-bar.vercel.app";
// ============================================================

// --- PINS RELAIS (serrures) ---
#define RELAY_CAFE        5
#define RELAY_FRIGO       18
#define RELAY_CONGELATEUR 19

// --- PINS CAPTEURS DS18B20 ---
#define TEMP_FRIGO_PIN    4    // DS18B20 du frigo
#define TEMP_CONGEL_PIN   15   // DS18B20 du congelateur

// --- TIMING ---
#define POLL_INTERVAL     2000   // Poll serrures toutes les 2s
#define TEMP_INTERVAL     30000  // Envoi temperatures toutes les 30s
#define UNLOCK_DURATION   5000   // Serrure ouverte pendant 5s
#define WIFI_RETRY_DELAY  5000   // Retry WiFi toutes les 5s

// --- OBJETS CAPTEURS ---
OneWire oneWireFrigo(TEMP_FRIGO_PIN);
OneWire oneWireCongel(TEMP_CONGEL_PIN);
DallasTemperature capteurFrigo(&oneWireFrigo);
DallasTemperature capteurCongel(&oneWireCongel);

// --- VARIABLES ---
unsigned long lastPoll = 0;
unsigned long lastTemp = 0;
unsigned long cafeUnlockTime = 0;
unsigned long frigoUnlockTime = 0;
unsigned long congelateurUnlockTime = 0;
bool cafeOpen = false;
bool frigoOpen = false;
bool congelateurOpen = false;

// Dernieres temperatures lues
float tempFrigo = -127.0;
float tempCongel = -127.0;

void setup() {
  Serial.begin(115200);
  Serial.println("\n=== AEROCLUB ESP32 - Demarrage ===");

  // --- Init relais ---
  pinMode(RELAY_CAFE, OUTPUT);
  pinMode(RELAY_FRIGO, OUTPUT);
  pinMode(RELAY_CONGELATEUR, OUTPUT);

  // Etat initial : tout verrouille
  // Cafe & Frigo = active LOW -> HIGH = verrouille
  digitalWrite(RELAY_CAFE, HIGH);
  digitalWrite(RELAY_FRIGO, HIGH);
  // Congelateur = active HIGH -> LOW = verrouille
  digitalWrite(RELAY_CONGELATEUR, LOW);

  Serial.println("Relais initialises (tout verrouille)");

  // --- Init capteurs temperature ---
  capteurFrigo.begin();
  capteurCongel.begin();

  int nbFrigo = capteurFrigo.getDeviceCount();
  int nbCongel = capteurCongel.getDeviceCount();
  Serial.printf("Capteurs trouves - Frigo: %d, Congelateur: %d\n", nbFrigo, nbCongel);

  if (nbFrigo == 0) Serial.println("ATTENTION: Aucun DS18B20 sur pin 4 (frigo)!");
  if (nbCongel == 0) Serial.println("ATTENTION: Aucun DS18B20 sur pin 15 (congelateur)!");

  // Resolution 12 bits (precision 0.0625C, conversion ~750ms)
  capteurFrigo.setResolution(12);
  capteurCongel.setResolution(12);
  // Mode asynchrone pour ne pas bloquer la boucle
  capteurFrigo.setWaitForConversion(false);
  capteurCongel.setWaitForConversion(false);

  // --- WiFi ---
  connectWiFi();

  // Premiere lecture temperature immediatement
  capteurFrigo.requestTemperatures();
  capteurCongel.requestTemperatures();
  delay(800); // Attendre la premiere conversion
  lireTemperatures();
  envoyerTemperatures();

  Serial.println("=== Initialisation terminee ===\n");
}

void loop() {
  // Reconnecter WiFi si deconnecte
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("WiFi deconnecte, reconnexion...");
    connectWiFi();
  }

  unsigned long now = millis();

  // --- POLL SERRURES (toutes les 2s) ---
  if (now - lastPoll >= POLL_INTERVAL) {
    lastPoll = now;
    pollSerrures();
  }

  // --- ENVOI TEMPERATURES (toutes les 30s) ---
  if (now - lastTemp >= TEMP_INTERVAL) {
    lastTemp = now;
    // Lancer la conversion (asynchrone)
    capteurFrigo.requestTemperatures();
    capteurCongel.requestTemperatures();
    // La lecture se fera au prochain cycle (~750ms plus tard c'est OK)
    // On lit les valeurs precedentes et on envoie
    lireTemperatures();
    envoyerTemperatures();
  }

  // --- GESTION TIMERS SERRURES ---
  if (cafeOpen && now - cafeUnlockTime >= UNLOCK_DURATION) {
    digitalWrite(RELAY_CAFE, HIGH); // Verrouiller (active LOW)
    cafeOpen = false;
    Serial.println("Cafe: VERROUILLE (timeout)");
  }

  if (frigoOpen && now - frigoUnlockTime >= UNLOCK_DURATION) {
    digitalWrite(RELAY_FRIGO, HIGH); // Verrouiller (active LOW)
    frigoOpen = false;
    Serial.println("Frigo: VERROUILLE (timeout)");
  }

  if (congelateurOpen && now - congelateurUnlockTime >= UNLOCK_DURATION) {
    digitalWrite(RELAY_CONGELATEUR, LOW); // Verrouiller (active HIGH)
    congelateurOpen = false;
    Serial.println("Congelateur: VERROUILLE (timeout)");
  }
}

// ============================================================
// WIFI
// ============================================================
void connectWiFi() {
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.printf("Connexion WiFi '%s'", WIFI_SSID);

  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 20) {
    delay(500);
    Serial.print(".");
    attempts++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.printf("\nWiFi connecte! IP: %s\n", WiFi.localIP().toString().c_str());
  } else {
    Serial.println("\nEchec WiFi - retry dans 5s");
  }
}

// ============================================================
// POLL SERRURES (API /api/fridge?action=check)
// ============================================================
void pollSerrures() {
  if (WiFi.status() != WL_CONNECTED) return;

  HTTPClient http;
  String url = String(SERVER_URL) + "/api/fridge?action=check";
  http.begin(url);
  http.setTimeout(5000);

  int code = http.GET();

  if (code == 200) {
    String body = http.getString();

    // Parse JSON simple (evite ArduinoJson pour reduire la taille)
    bool triggerCafe = body.indexOf("\"cafe\":true") >= 0;
    bool triggerFrigo = body.indexOf("\"frigo\":true") >= 0;
    bool triggerCongelateur = body.indexOf("\"congelateur\":true") >= 0;
    bool triggerBoth = body.indexOf("\"both\":true") >= 0;

    unsigned long now = millis();

    if (triggerCafe || triggerBoth) {
      digitalWrite(RELAY_CAFE, LOW); // Deverrouiller (active LOW)
      cafeOpen = true;
      cafeUnlockTime = now;
      Serial.println(">>> Cafe: DEVERROUILLE");
    }

    if (triggerFrigo || triggerBoth) {
      digitalWrite(RELAY_FRIGO, LOW); // Deverrouiller (active LOW)
      frigoOpen = true;
      frigoUnlockTime = now;
      Serial.println(">>> Frigo: DEVERROUILLE");
    }

    if (triggerCongelateur || triggerBoth) {
      digitalWrite(RELAY_CONGELATEUR, HIGH); // Deverrouiller (active HIGH)
      congelateurOpen = true;
      congelateurUnlockTime = now;
      Serial.println(">>> Congelateur: DEVERROUILLE");
    }

    // Confirmer la reception
    if (triggerCafe || triggerFrigo || triggerCongelateur || triggerBoth) {
      HTTPClient http2;
      http2.begin(String(SERVER_URL) + "/api/fridge?action=done");
      http2.GET();
      http2.end();
    }
  } else if (code > 0) {
    Serial.printf("Poll HTTP %d\n", code);
  } else {
    Serial.printf("Poll erreur: %s\n", http.errorToString(code).c_str());
  }

  http.end();
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
// ENVOI TEMPERATURES AU SERVEUR
// ============================================================
void envoyerTemperatures() {
  if (WiFi.status() != WL_CONNECTED) return;
  if (tempFrigo == -127.0 && tempCongel == -127.0) {
    Serial.println("Pas de temperature valide, envoi ignore");
    return;
  }

  HTTPClient http;
  String url = String(SERVER_URL) + "/api/temperature";
  http.begin(url);
  http.addHeader("Content-Type", "application/json");
  http.setTimeout(5000);

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
