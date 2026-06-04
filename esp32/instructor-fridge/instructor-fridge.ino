/*
 * AEROCLUB DU BASSIN D'ARCACHON - Frigo Instructeurs
 * ===================================================
 * ESP32 #2 — Lecteur RFID RC522 + Serrure
 *
 * Fonctionnement :
 *   - Attend un badge RFID
 *   - Envoie le UID a l'API pour verification
 *   - Si autorise : ouvre la serrure 5s + bip + LED verte
 *   - Si refuse : bip erreur + LED rouge
 *   - Le UID du badge s'affiche dans le moniteur serie (pour config)
 *
 * Branchement RC522 (SPI) :
 *   VCC → 3V3  |  GND → GND  |  SCK → D18  |  MISO → D19
 *   MOSI → D23 |  SDA → D5   |  RST → D22  |  IRQ → (rien)
 *
 * Librairies requises :
 *   - MFRC522 (par GithubCommunity)
 */

#include <WiFi.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>
#include <SPI.h>
#include <MFRC522.h>

// === CONFIG ===
const char* WIFI_SSID     = "ACBA-H7";
const char* WIFI_PASSWORD = "villemarie-H7";
const char* API_URL       = "https://aeroclub-bar.vercel.app/api/instructor-fridge";
// ==============

// === GPIO ===
const int RC522_SS    = 5;    // SDA du RC522
const int RC522_RST   = 22;   // RST du RC522
const int RELAY_PIN   = 26;   // Relais serrure
const int BUZZER_PIN  = 2;    // Buzzer (optionnel)
const int LED_GREEN   = 4;    // LED verte (optionnel)
const int LED_RED     = 15;   // LED rouge (optionnel)

// === TIMING ===
const unsigned long UNLOCK_DURATION = 5000;  // 5 secondes d'ouverture
const unsigned long COOLDOWN        = 3000;  // 3s entre deux lectures

// === RFID ===
MFRC522 rfid(RC522_SS, RC522_RST);

// === VARIABLES ===
unsigned long lastScan = 0;

void setup() {
  Serial.begin(115200);
  delay(1000);

  // Pins
  pinMode(RELAY_PIN, OUTPUT);
  pinMode(BUZZER_PIN, OUTPUT);
  pinMode(LED_GREEN, OUTPUT);
  pinMode(LED_RED, OUTPUT);
  digitalWrite(RELAY_PIN, LOW);
  digitalWrite(BUZZER_PIN, LOW);
  digitalWrite(LED_GREEN, LOW);
  digitalWrite(LED_RED, LOW);

  // SPI + RFID
  SPI.begin();
  rfid.PCD_Init();
  delay(100);

  Serial.println();
  Serial.println("=== AERO-CLUB — FRIGO INSTRUCTEURS ===");
  Serial.print("RC522 firmware : 0x");
  Serial.println(rfid.PCD_ReadRegister(rfid.VersionReg), HEX);

  // WiFi
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

  // LED verte flash au demarrage
  digitalWrite(LED_GREEN, HIGH);
  delay(500);
  digitalWrite(LED_GREEN, LOW);

  Serial.println("=== Pret — Presentez un badge ===\n");
}

void loop() {
  // Reconnexion WiFi
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("WiFi perdu, reconnexion...");
    WiFi.disconnect();
    delay(1000);
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
    delay(5000);
    return;
  }

  // Attendre un badge
  if (!rfid.PICC_IsNewCardPresent() || !rfid.PICC_ReadCardSerial()) {
    return;
  }

  // Cooldown entre deux scans
  if (millis() - lastScan < COOLDOWN) {
    rfid.PICC_HaltA();
    rfid.PCD_StopCrypto1();
    return;
  }
  lastScan = millis();

  // Lire le UID
  String uid = "";
  for (byte i = 0; i < rfid.uid.size; i++) {
    if (i > 0) uid += ":";
    if (rfid.uid.uidByte[i] < 0x10) uid += "0";
    uid += String(rfid.uid.uidByte[i], HEX);
  }
  uid.toUpperCase();

  Serial.println("Badge detecte : " + uid);

  // Fermer la communication RFID
  rfid.PICC_HaltA();
  rfid.PCD_StopCrypto1();

  // Verifier avec l'API
  bool authorized = checkBadge(uid);

  if (authorized) {
    Serial.println(">>> AUTORISE — Ouverture serrure <<<");
    feedbackOK();
    ouvrirSerrure();
  } else {
    Serial.println(">>> REFUSE <<<");
    feedbackRefuse();
  }

  Serial.println();
}

// ============================================================
// VERIFICATION BADGE VIA API
// ============================================================
bool checkBadge(String uid) {
  WiFiClientSecure client;
  client.setInsecure();
  HTTPClient http;

  String url = String(API_URL) + "?action=check&uid=" + uid;

  if (http.begin(client, url)) {
    int httpCode = http.GET();
    if (httpCode == 200) {
      String body = http.getString();
      http.end();

      Serial.println("API reponse : " + body);

      // Verifier si autorise
      if (body.indexOf("\"authorized\":true") >= 0) {
        // Extraire le nom pour l'affichage
        int nameIdx = body.indexOf("\"name\":\"");
        if (nameIdx >= 0) {
          int start = nameIdx + 8;
          int end = body.indexOf("\"", start);
          if (end > start) {
            String name = body.substring(start, end);
            Serial.println("Instructeur : " + name);
          }
        }
        return true;
      } else {
        // Afficher la raison du refus
        if (body.indexOf("unknown_badge") >= 0) {
          Serial.println("Raison : badge inconnu");
        } else if (body.indexOf("badge_disabled") >= 0) {
          Serial.println("Raison : badge desactive");
        } else if (body.indexOf("no_stock") >= 0) {
          Serial.println("Raison : stock epuise");
        }
        return false;
      }
    } else {
      Serial.printf("HTTP erreur : %d\n", httpCode);
      http.end();
      return false;
    }
  }
  return false;
}

// ============================================================
// SERRURE
// ============================================================
void ouvrirSerrure() {
  digitalWrite(RELAY_PIN, HIGH);
  delay(UNLOCK_DURATION);
  digitalWrite(RELAY_PIN, LOW);
  Serial.println("Serrure verrouillee");
}

// ============================================================
// FEEDBACK SONORE ET VISUEL
// ============================================================
void feedbackOK() {
  // LED verte + bip court
  digitalWrite(LED_GREEN, HIGH);
  digitalWrite(BUZZER_PIN, HIGH);
  delay(150);
  digitalWrite(BUZZER_PIN, LOW);
  delay(2000);
  digitalWrite(LED_GREEN, LOW);
}

void feedbackRefuse() {
  // LED rouge + 3 bips rapides
  digitalWrite(LED_RED, HIGH);
  for (int i = 0; i < 3; i++) {
    digitalWrite(BUZZER_PIN, HIGH);
    delay(100);
    digitalWrite(BUZZER_PIN, LOW);
    delay(100);
  }
  delay(1000);
  digitalWrite(LED_RED, LOW);
}
