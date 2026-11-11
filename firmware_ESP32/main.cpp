
#include "esp_camera.h"
#include <WiFi.h>
#include <WiFiClient.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <ESP32Servo.h>
#include <WebServer.h>
#include <Wire.h>
#include <VL53L0X.h>
#include "esp_heap_caps.h"

// =====================================================
// 1. WIFI - THAY THONG TIN CUA BAN
// =====================================================

const char* WIFI_SSID = "Redmi Note 11S";
const char* WIFI_PASSWORD = "123456789";

// IP tinh cua ESP32 tren hotspot. Gateway/subnet dang gia dinh hotspot dung
// mang 192.168.1.0/24; doi gateway neu dia chi hotspot khac.
IPAddress ESP32_IP(192, 168, 1, 31);
IPAddress WIFI_GATEWAY(192, 168, 1, 1);
IPAddress WIFI_SUBNET(255, 255, 255, 0);
IPAddress WIFI_DNS(192, 168, 1, 1);

// IP laptop tren cung hotspot, noi chay Flask server.
const char* API_URL = "http://192.168.1.30:5000/predict";

// Laptop va ESP32 can ket noi duoc qua mang
// =====================================================
// 2. GPIO
// =====================================================

// GPIO gan cho ngoai vi theo danh sach chan ban bao con trong.
#define SERVO1_PIN 38
#define SERVO2_PIN 39
#define IR_PIN     40

// VL53L0X dung chung bus I2C; tung cam bien duoc chon qua XSHUT.
#define TOF_SDA_PIN 21
#define TOF_SCL_PIN 2
const uint8_t BIN_COUNT = 3;
// GPIO35-37 dang duoc OPI PSRAM su dung tren cau hinh board nay.
// GPIO21/2 lam I2C; GPIO41/42/1 lam XSHUT, khong trung camera, servo va IR.
const uint8_t BIN_XSHUT_PINS[BIN_COUNT] = {41, 42, 1}; // giay, nhua, kim loai
const char* BIN_NAMES[BIN_COUNT] = {"giay", "nhua", "kim_loai"};
const uint8_t BIN_I2C_ADDRESSES[BIN_COUNT] = {0x30, 0x31, 0x32};
// Chieu cao moi ngan tu mat cam bien den day (mm); can sua theo thung thuc te.
const uint16_t BIN_EMPTY_DISTANCE_MM[BIN_COUNT] = {300, 300, 300};
const unsigned long BIN_READ_INTERVAL_MS = 2000;

// IR LM393 thuong OUT LOW khi phat hien vat
#define IR_ACTIVE_LEVEL LOW

// =====================================================
// 3. SERVO
// =====================================================

Servo servo1;
Servo servo2;
WebServer controlServer(80);
VL53L0X binSensors[BIN_COUNT];
bool binSensorReady[BIN_COUNT] = {false, false, false};
uint16_t binDistanceMm[BIN_COUNT] = {0, 0, 0};
int binFillPercent[BIN_COUNT] = {-1, -1, -1};
unsigned long lastBinReadMs = 0;

void readBinSensors() {
    for (uint8_t i = 0; i < BIN_COUNT; ++i) {
        if (!binSensorReady[i]) continue;
        uint16_t distance = binSensors[i].readRangeContinuousMillimeters();
        if (!binSensors[i].timeoutOccurred() && distance > 0 && distance < 8190) {
            binDistanceMm[i] = distance;
            int fill = 100 - (int)((uint32_t)distance * 100 / BIN_EMPTY_DISTANCE_MM[i]);
            binFillPercent[i] = constrain(fill, 0, 100);
        }
    }
    lastBinReadMs = millis();
}

void handleBinStatus() {
    JsonDocument doc;
    JsonArray bins = doc["bins"].to<JsonArray>();
    for (uint8_t i = 0; i < BIN_COUNT; ++i) {
        JsonObject bin = bins.add<JsonObject>();
        bin["name"] = BIN_NAMES[i];
        bin["sensor_ok"] = binSensorReady[i];
        if (binSensorReady[i] && binFillPercent[i] >= 0) {
            bin["distance_mm"] = binDistanceMm[i];
            bin["fill_percent"] = binFillPercent[i];
        } else {
            bin["distance_mm"] = nullptr;
            bin["fill_percent"] = nullptr;
        }
    }
    String response;
    serializeJson(doc, response);
    controlServer.send(200, "application/json", response);
}

void initBinSensors() {
    Serial.println("Initializing VL53L0X sensors...");
    Wire.begin(TOF_SDA_PIN, TOF_SCL_PIN);
    Wire.setClock(100000);
    for (uint8_t i = 0; i < BIN_COUNT; ++i) {
        pinMode(BIN_XSHUT_PINS[i], OUTPUT);
        digitalWrite(BIN_XSHUT_PINS[i], LOW);
    }
    delay(10);
    Wire.beginTransmission(0x29);
    uint8_t allOffProbe = Wire.endTransmission();
    Serial.printf(
        "I2C probe with all XSHUT LOW: %s at 0x29 (expected NO ACK)\n",
        allOffProbe == 0 ? "ACK" : "NO ACK"
    );
    for (uint8_t i = 0; i < BIN_COUNT; ++i) {
        digitalWrite(BIN_XSHUT_PINS[i], HIGH);
        delay(20);
        Wire.beginTransmission(0x29); // moi VL53L0X vua bat len dung dia chi mac dinh
        uint8_t probeResult = Wire.endTransmission();
        uint8_t modelId = 0xFF;
        if (probeResult == 0) {
            Wire.beginTransmission(0x29);
            Wire.write(0xC0); // IDENTIFICATION_MODEL_ID, VL53L0X phai tra ve 0xEE
            if (Wire.endTransmission() == 0 && Wire.requestFrom((uint8_t)0x29, (uint8_t)1) == 1) {
                modelId = Wire.read();
            }
        }
        Serial.printf(
            "I2C probe %s (GPIO%d): %s, model ID=0x%02X, SDA=%d SCL=%d\n",
            BIN_NAMES[i],
            BIN_XSHUT_PINS[i],
            probeResult == 0 ? "ACK at 0x29" : "NO ACK at 0x29",
            modelId,
            digitalRead(TOF_SDA_PIN),
            digitalRead(TOF_SCL_PIN)
        );
        // init() doi SPAD va hieu chuan; cho toi da 5 giay de tranh timeout gia.
        binSensors[i].setTimeout(5000);
        if (!binSensors[i].init()) {
            Serial.printf("VL53L0X %s (XSHUT GPIO%d) init failed\n", BIN_NAMES[i], BIN_XSHUT_PINS[i]);
            digitalWrite(BIN_XSHUT_PINS[i], LOW);
            continue;
        }
        binSensors[i].setAddress(BIN_I2C_ADDRESSES[i]);
        binSensors[i].startContinuous(100);
        binSensorReady[i] = true;
        Serial.printf("VL53L0X %s ready at 0x%02X\n", BIN_NAMES[i], BIN_I2C_ADDRESSES[i]);
    }
    readBinSensors();
    Serial.println("VL53L0X initialization finished.");
}

const int SERVO1_CLOSED = 105;
const int SERVO1_OPEN   = 0;

// Goc co khi da ne khoi dung hanh trinh de giam rung va tranh ep truc.
const int SERVO2_PAPER  = 0;
const int SERVO2_BOTTLE = 90;
const int SERVO2_CAN    = 180;

// Vi tri khoi dong cua servo 2. Khong co phan hoi goc, nen servo se duoc
// detach sau khi den vi tri de khong co gang giu chinh xac va gay rung.
const int SERVO2_HOME   = 0;

const int SERVO_MIN_US = 600;
const int SERVO_MAX_US = 2425;
const unsigned long SERVO_MOVE_TIME = 2000;

void handleServoCommand() {
    if (!controlServer.hasArg("servo") || !controlServer.hasArg("angle")) {
        controlServer.send(400, "application/json", "{\"success\":false,\"error\":\"servo and angle required\"}");
        return;
    }

    int servoNumber = controlServer.arg("servo").toInt();
    int angle = controlServer.arg("angle").toInt();

    if (angle < 0 || angle > 180 || (servoNumber != 1 && servoNumber != 2)) {
        controlServer.send(400, "application/json", "{\"success\":false,\"error\":\"invalid servo or angle\"}");
        return;
    }

    if (servoNumber == 1) {
        if (!servo1.attached()) {
            servo1.attach(SERVO1_PIN, SERVO_MIN_US, SERVO_MAX_US);
        }
        servo1.write(angle);
    } else {
        if (!servo2.attached()) {
            servo2.attach(SERVO2_PIN, SERVO_MIN_US, SERVO_MAX_US);
        }
        servo2.write(angle);
        delay(SERVO_MOVE_TIME);
        servo2.detach();
    }

    String response = "{\"success\":true,\"servo\":" + String(servoNumber) +
                      ",\"angle\":" + String(angle) + "}";
    controlServer.send(200, "application/json", response);
}

// Thoi gian co khi - can dieu chinh thuc te
const unsigned long DROP_TIME = 4000;

// =====================================================
// 4. CAMERA ESP32-S3-EYE PINOUT
// Dung khi board cua ban dung pinout ESP32S3_EYE
// =====================================================

#define CAM_PIN_PWDN    -1
#define CAM_PIN_RESET   -1
#define CAM_PIN_XCLK    15
#define CAM_PIN_SIOD    4
#define CAM_PIN_SIOC    5

#define CAM_PIN_Y9      16
#define CAM_PIN_Y8      17
#define CAM_PIN_Y7      18
#define CAM_PIN_Y6      12
#define CAM_PIN_Y5      10
#define CAM_PIN_Y4      8
#define CAM_PIN_Y3      9
#define CAM_PIN_Y2      11

#define CAM_PIN_VSYNC   6
#define CAM_PIN_HREF    7
#define CAM_PIN_PCLK    13

// =====================================================
// 5. CHUP 5 ANH
// =====================================================

#define IMAGE_COUNT 5

uint8_t* imageBuffers[IMAGE_COUNT] = {nullptr};
size_t imageSizes[IMAGE_COUNT] = {0};

const int IMAGE_INTERVAL_MS = 200;
const unsigned long SENSOR_SETTLE_TIME_MS = 1000;

// =====================================================
// 6. TRANG THAI
// =====================================================

bool processing = false;
bool cameraReady = false;

// =====================================================
// 7. WIFI
// =====================================================

void connectWiFi() {
    WiFi.mode(WIFI_STA);
    if (!WiFi.config(ESP32_IP, WIFI_GATEWAY, WIFI_SUBNET, WIFI_DNS)) {
        Serial.println("Failed to configure static ESP32 IP!");
        return;
    }
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

    Serial.print("Connecting WiFi");

    unsigned long start = millis();

    while (WiFi.status() != WL_CONNECTED) {
        delay(500);
        Serial.print(".");

        if (millis() - start > 20000) {
            Serial.println("\nWiFi timeout!");
            return;
        }
    }

    Serial.println("\nWiFi connected!");
    Serial.print("ESP32 IP: ");
    Serial.println(WiFi.localIP());
}

// =====================================================
// 8. KHOI TAO CAMERA
// =====================================================

bool initCamera() {

    Serial.printf("PSRAM found: %s\n", psramFound() ? "yes" : "no");
    Serial.printf("Free internal heap: %u bytes\n", (unsigned int)ESP.getFreeHeap());
    Serial.printf("Free PSRAM: %u bytes\n", (unsigned int)ESP.getFreePsram());

    // The five captured JPEGs are kept in PSRAM until they are uploaded.
    if (!psramFound()) {
        Serial.println("PSRAM is required. Enable PSRAM in the board settings.");
        return false;
    }

    camera_config_t config = {};

    config.ledc_channel = LEDC_CHANNEL_0;
    config.ledc_timer = LEDC_TIMER_0;

    config.pin_d0 = CAM_PIN_Y2;
    config.pin_d1 = CAM_PIN_Y3;
    config.pin_d2 = CAM_PIN_Y4;
    config.pin_d3 = CAM_PIN_Y5;
    config.pin_d4 = CAM_PIN_Y6;
    config.pin_d5 = CAM_PIN_Y7;
    config.pin_d6 = CAM_PIN_Y8;
    config.pin_d7 = CAM_PIN_Y9;

    config.pin_xclk = CAM_PIN_XCLK;
    config.pin_pclk = CAM_PIN_PCLK;
    config.pin_vsync = CAM_PIN_VSYNC;
    config.pin_href = CAM_PIN_HREF;

    config.pin_sccb_sda = CAM_PIN_SIOD;
    config.pin_sccb_scl = CAM_PIN_SIOC;

    config.pin_pwdn = CAM_PIN_PWDN;
    config.pin_reset = CAM_PIN_RESET;

    config.xclk_freq_hz = 20000000;

    config.pixel_format = PIXFORMAT_JPEG;

    // QVGA reduces camera DMA/frame-buffer memory use.
    config.frame_size = FRAMESIZE_QVGA;

    // JPEG quality: smaller files reduce ESP32 memory use and upload size.
    config.jpeg_quality = 15;

    config.fb_count = 1;
    config.fb_location = CAMERA_FB_IN_PSRAM;
    config.grab_mode = CAMERA_GRAB_WHEN_EMPTY;

    esp_err_t err = esp_camera_init(&config);

    if (err != ESP_OK) {
        Serial.printf("Camera init failed: 0x%x\n", err);
        return false;
    }

    sensor_t* sensor = esp_camera_sensor_get();

    // OV3660
    if (sensor != nullptr) {
        sensor->set_brightness(sensor, 0);
        sensor->set_contrast(sensor, 0);
        sensor->set_saturation(sensor, 0);
    }

    Serial.println("Camera ready!");
    return true;
}

// =====================================================
// 9. GIAI PHONG 5 ANH
// =====================================================

void freeImages() {

    for (int i = 0; i < IMAGE_COUNT; i++) {

        if (imageBuffers[i] != nullptr) {
            heap_caps_free(imageBuffers[i]);
            imageBuffers[i] = nullptr;
        }

        imageSizes[i] = 0;
    }
}

// =====================================================
// 10. CHUP 5 ANH VA LUU VAO PSRAM
// =====================================================

bool captureFiveImages() {

    freeImages();

    Serial.println("\nCapturing 5 images...");

    // With one frame buffer and CAMERA_GRAB_WHEN_EMPTY, a frame may remain
    // queued while the ESP32 uploads the previous batch. Discard that stale
    // frame so all five images below are captured for the current trigger.
    camera_fb_t* queuedFrame = esp_camera_fb_get();
    if (queuedFrame != nullptr) {
        esp_camera_fb_return(queuedFrame);
        Serial.println("Discarded one queued camera frame before batch capture.");
    }

    for (int i = 0; i < IMAGE_COUNT; i++) {

        camera_fb_t* fb = esp_camera_fb_get();

        if (fb == nullptr) {
            Serial.println("Camera capture failed!");
            freeImages();
            return false;
        }

        if (fb->format != PIXFORMAT_JPEG) {
            Serial.println("Invalid image format!");
            esp_camera_fb_return(fb);
            freeImages();
            return false;
        }

        imageBuffers[i] = (uint8_t*) heap_caps_malloc(
            fb->len,
            MALLOC_CAP_SPIRAM | MALLOC_CAP_8BIT
        );

        if (imageBuffers[i] == nullptr) {
            Serial.println("PSRAM allocation failed!");
            esp_camera_fb_return(fb);
            freeImages();
            return false;
        }

        memcpy(imageBuffers[i], fb->buf, fb->len);
        imageSizes[i] = fb->len;

        Serial.printf(
            "Image %d: %u bytes\n",
            i + 1,
            (unsigned int)fb->len
        );

        esp_camera_fb_return(fb);

        delay(IMAGE_INTERVAL_MS);
    }

    Serial.println("Captured 5 images successfully!");

    return true;
}

// =====================================================
// 11. TAO MULTIPART VA GUI 5 ANH LEN LAPTOP
// =====================================================

bool sendFiveImages(
    String& className,
    int& servoAngle,
    float& confidence
) {

    HTTPClient http;

    http.setTimeout(60000);

    if (!http.begin(API_URL)) {
        Serial.println("HTTP begin failed!");
        return false;
    }

    String boundary = "----ESP32SmartBinBoundary";

    http.addHeader(
        "Content-Type",
        "multipart/form-data; boundary=" + boundary
    );

    String body;

    // Them 5 file vao cung mot request
    for (int i = 0; i < IMAGE_COUNT; i++) {

        body += "--" + boundary + "\r\n";

        body += "Content-Disposition: form-data; ";
        body += "name=\"images\"; ";
        body += "filename=\"image_" + String(i + 1) + ".jpg\"\r\n";

        body += "Content-Type: image/jpeg\r\n\r\n";

        body.concat(
            (const char*)imageBuffers[i],
            imageSizes[i]
        );

        body += "\r\n";
    }

    body += "--" + boundary + "--\r\n";

    Serial.printf(
        "Uploading total: %u bytes\n",
        (unsigned int)body.length()
    );

    int httpCode = http.POST(
        (uint8_t*)body.c_str(),
        body.length()
    );

    bool success = false;

    if (httpCode > 0) {

        Serial.printf("HTTP status: %d\n", httpCode);

        String response = http.getString();

        Serial.println("Server response:");
        Serial.println(response);

        if (httpCode == HTTP_CODE_OK) {

            JsonDocument doc;

            DeserializationError error =
                deserializeJson(doc, response);

            if (!error) {

                bool serverSuccess =
                    doc["success"] | false;

                if (serverSuccess) {

                    className =
                        doc["class_name"].as<String>();

                    servoAngle =
                        doc["servo_angle"] | -1;

                    confidence =
                        doc["confidence"] | 0.0f;

                    success = true;
                }
            }
            else {
                Serial.println("JSON parsing failed!");
            }
        }
    }
    else {
        Serial.printf(
            "HTTP request failed: %s\n",
            http.errorToString(httpCode).c_str()
        );
    }

    http.end();

    return success;
}

// =====================================================
// 12. DIEU KHIEN SERVO
// =====================================================

void sortWaste(int targetAngle) {

    // Cua sap phai dong truoc
    servo1.write(SERVO1_CLOSED);
    delay(500);

    Serial.println("Moving Servo 2...");

    // Bat servo, quay den huong phan loai, cho co khi dung roi ngat xung.
    if (!servo2.attached()) {
        servo2.attach(SERVO2_PIN, SERVO_MIN_US, SERVO_MAX_US);
    }
    servo2.write(targetAngle);
    delay(SERVO_MOVE_TIME);
    servo2.detach();

    Serial.println("Opening flap...");

    // Mo cua sap
    servo1.write(SERVO1_OPEN);

    delay(DROP_TIME);

    // Dong cua
    Serial.println("Closing flap...");

    servo1.write(SERVO1_CLOSED);

    delay(SERVO_MOVE_TIME);

    // Giu bo chon huong tai ngan da chon; servo 2 da detach de giam rung.

    Serial.println("Sorting completed!");
}

// =====================================================
// 13. XU LY MOT LUOT RAC
// =====================================================

void processWaste() {

    processing = true;

    Serial.println("\n==============================");
    Serial.println("NEW WASTE DETECTED");
    Serial.println("==============================");

    // Dam bao cua dong
    servo1.write(SERVO1_CLOSED);

    // 1. Chup 5 anh
    if (!captureFiveImages()) {
        Serial.println("Capture failed. Skip sorting.");
        freeImages();
        processing = false;
        return;
    }

    // 2. Gui len laptop
    String className = "";
    int servoAngle = -1;
    float confidence = 0;

    bool result = sendFiveImages(
        className,
        servoAngle,
        confidence
    );

    // 3. Giai phong bo nho sau khi gui
    freeImages();

    if (!result) {
        Serial.println("YOLO result invalid. No sorting!");
        processing = false;
        return;
    }

    Serial.println("\nYOLO RESULT:");
    Serial.println("Class: " + className);
    Serial.printf("Confidence: %.2f\n", confidence);
    Serial.printf("Servo angle: %d\n", servoAngle);

    // 4. Kiem tra class va goc hop le
    if (className == "paper cup" && servoAngle == 0) {

        sortWaste(SERVO2_PAPER);

    }
    else if (className == "bottle" && servoAngle == 90) {

        sortWaste(SERVO2_BOTTLE);

    }
    else if (className == "can" && servoAngle == 180) {

        sortWaste(SERVO2_CAN);

    }
    else {

        Serial.println("Unknown or inconsistent result!");
        Serial.println("Do not open flap!");
    }

    processing = false;

    Serial.println("\nReady for next waste.");
}

// =====================================================
// 14. SETUP
// =====================================================

void setup() {

    Serial.begin(115200);

    delay(1000);

    Serial.println("\nSMART BIN STARTING...");

    // IR
    pinMode(IR_PIN, INPUT_PULLUP);

    // Servo
    servo1.setPeriodHertz(50);
    servo2.setPeriodHertz(50);

    servo1.attach(
        SERVO1_PIN,
        SERVO_MIN_US,
        SERVO_MAX_US
    );

    servo2.attach(
        SERVO2_PIN,
        SERVO_MIN_US,
        SERVO_MAX_US
    );

    // Vi tri ban dau: cua dong 105 do, bo chon huong tai 0 do.
    servo1.write(SERVO1_CLOSED);
    servo2.write(SERVO2_HOME);

    delay(1000);
    servo2.detach();

    // WiFi
    connectWiFi();

    controlServer.on("/servo", HTTP_GET, handleServoCommand);
    controlServer.on("/", HTTP_GET, []() {
        controlServer.send(200, "text/plain", "ESP32 servo control ready. Use /servo?servo=1&angle=105");
    });
    controlServer.on("/bins", HTTP_GET, handleBinStatus);
    controlServer.begin();
    Serial.println("Servo control API ready on port 80 (/servo?servo=1&angle=105)");

    initBinSensors();

    // Camera
    cameraReady = initCamera();

    if (!cameraReady) {
        Serial.println("Camera unavailable!");
        Serial.println("Servo API remains available; check PSRAM, board selection, and camera pinout.");
    } else {
        Serial.println("Camera ready!");
    }

    Serial.println("\nSYSTEM READY!");
}

// =====================================================
// 15. LOOP
// =====================================================

void loop() {

    controlServer.handleClient();

    if (millis() - lastBinReadMs >= BIN_READ_INTERVAL_MS) {
        readBinSensors();
        for (uint8_t i = 0; i < BIN_COUNT; ++i) {
            if (binSensorReady[i] && binFillPercent[i] >= 0) {
                Serial.printf("Bin %s: %u mm, %d%% full\n", BIN_NAMES[i], binDistanceMm[i], binFillPercent[i]);
            }
        }
    }

    if (processing) {
        return;
    }

    if (!cameraReady) {
        delay(1000);
        return;
    }

    if (WiFi.status() != WL_CONNECTED) {
        Serial.println("WiFi disconnected!");
        WiFi.reconnect();
        delay(1000);
        return;
    }

    int irValue = digitalRead(IR_PIN);

    if (irValue == IR_ACTIVE_LEVEL) {

        // Doi 1 giay sau khi phat hien de vat on dinh truoc khi chup anh.
        delay(SENSOR_SETTLE_TIME_MS);

        if (digitalRead(IR_PIN) == IR_ACTIVE_LEVEL) {

            processWaste();

            // Cho vat roi va roi khoi vung IR
            Serial.println("Waiting for IR clear...");

            unsigned long start = millis();

            while (
                digitalRead(IR_PIN) == IR_ACTIVE_LEVEL &&
                millis() - start < 10000
            ) {
                delay(50);
            }

            delay(300);
        }
    }

    delay(20);
}
