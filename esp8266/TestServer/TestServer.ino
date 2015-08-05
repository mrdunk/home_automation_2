#include <ESP8266WiFi.h>
#include <WiFiClient.h>
#include <ESP8266WebServer.h>
#include <PubSubClient.h>
#include <EEPROM.h>
#include <mdns.h>

#include "ipv4_helpers.h"
#include "secrets.h"
#include "persist_data.h"
#include "persist_data.cpp"   // WHY IS THIS NEEDED?? The linker can't find instances of Persistent.
#include "Brokers.h"

// Increase this if any changes are made to "struct Config".
#define CONFIG_VERSION "001"

// Maximum number of devices connected to IO pins.
#define MAX_DEVICES 8


enum Io_Type {
  test,
  rgb,
  pwm,
  onoff
};

typedef struct Connected_device {
  char unique_id[32];
  char room[32];
  Io_Type io_type;
  int io_pins[4];
} Connected_device;

struct Config {
  char hostname[32];
  Connected_device devices[MAX_DEVICES];
  char config_version[4];
  // TODO: add WFI ssid and password.
} config = {
  "esp8266",
  {},
  CONFIG_VERSION
};

String mac_address;
const int led = 2;



// mDNS
//extern String brokers[MAX_BROKERS][4];  // Array containing information about brokers received over mDNS.
Brokers brokers(QUESTION_SERVICE);

void answerCallback(const mdns::Answer* answer){ brokers.ParseMDnsAnswer(answer); }
mdns::MDns my_mdns(NULL, NULL, answerCallback);




// MQTT
IPAddress mqtt_broker_address(0, 0, 0, 0);
PubSubClient mqtt_client(mqtt_broker_address);

void mqtt_callback(const MQTT::Publish& pub) {
  Serial.print("MQTT callback");
  Serial.print(pub.topic());
  Serial.print(" => ");
  Serial.println(pub.payload_string());
}

void mqtt_connect() {
  Broker broker = brokers.GetBroker();
  mqtt_client = PubSubClient(broker.address);
  mqtt_client.set_callback(mqtt_callback);
  if (mqtt_client.connect(config.hostname)) {
    String lamp = "unconfigured/";
    lamp += config.hostname;
    lamp += "/off";
    mqtt_client.publish("homeautomation/lighting/advertise", lamp);
    mqtt_client.subscribe("homeautomation/lighting/all/all/set");
    mqtt_client.subscribe("homeautomation/lighting/unconfigured/all/set");
    //mqtt_client.subscribe("homeautomation/lighting/unconfigured/" + config.hostname + "/set");
    mqtt_client.subscribe("homeautomation/lighting/all/all/solicit");
  }
  brokers.RateBroker(mqtt_client.connected());
  if (mqtt_client.connected()) {
    Serial.println("MQTT connected.");
  }
}



// HTTP
ESP8266WebServer http_server(80);

void handleRoot() {
  digitalWrite(led, 1);
  int b;

  String message = "hello from esp8266!\n";

  for (b = 0; b < http_server.args(); ++b) {
    message += "arg: " + http_server.argName(b) + " val: " + http_server.arg(b) + "\n";
  }
  message += "hostname: ";
  message += config.hostname;
  message += "\n";

  message += "mac_address: ";
  message += mac_address;
  message += "\n";

  message += "method: ";
  if ( http_server.method() == HTTP_GET) {
    message += "HTTP_GET";
  } else if (http_server.method() == HTTP_POST) {
    message += "HTTP_POST";
  } else {
    message += "unknown";
  }
  message += "\n";

  message += "\n";
  message += "version: ";
  message += config.config_version;
  message += "\n";

  message += brokers.Summary();

  http_server.send(200, "text/plain", message);
  digitalWrite(led, 0);
}

void handleConfig() {
  String message = "";
  if (http_server.hasArg("test_arg")) {
    message += "test_arg: " + http_server.arg("test_arg") + "\n";
  }

  http_server.send(200, "text/plain", message);
}

void handleNotFound() {
  digitalWrite(led, 1);
  String message = "File Not Found\n\n";
  message += "URI: ";
  message += http_server.uri();
  message += "\nMethod: ";
  message += (http_server.method() == HTTP_GET) ? "GET" : "POST";
  message += "\nArguments: ";
  message += http_server.args();
  message += "\n";
  for (uint8_t i = 0; i < http_server.args(); i++) {
    message += " " + http_server.argName(i) + ": " + http_server.arg(i) + "\n";
  }
  http_server.send(404, "text/plain", message);
  digitalWrite(led, 0);
}



void setup_network(void) {
  // Wait for connection
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("");
  Serial.print("Connected to ");
  Serial.println(ssid);
  Serial.print("IP address: ");
  Serial.println(WiFi.localIP());


  http_server.on("/", handleRoot);
  http_server.on("/configure/", handleConfig);
  http_server.onNotFound(handleNotFound);

  http_server.begin();
  Serial.println("HTTP server started");

  brokers.RegisterMDns(my_mdns);
}

void setup(void) {
  pinMode(led, OUTPUT);
  digitalWrite(led, 0);

  Serial.begin(115200);

  Persist_Data::Persistent<Config> persist_config(CONFIG_VERSION, &config);
  persist_config.readConfig();

  WiFi.begin(ssid, password);
  Serial.println("");

  uint8_t mac[6];
  WiFi.macAddress(mac);
  mac_address = macToStr(mac);

  setup_network();
}

void loop(void) {
  http_server.handleClient();
  mqtt_client.loop();

  if (WiFi.status() != WL_CONNECTED) {
    setup_network();
  }

  my_mdns.Check();

  if (!mqtt_client.connected()) {
    Serial.println("MQTT disconnected.");
    mqtt_connect();
  }  
}
