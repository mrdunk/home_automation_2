#include <ESP8266WiFi.h>
#include <WiFiClient.h>
#include <ESP8266WebServer.h>
#include <ESP8266mDNS.h>
#include <PubSubClient.h>
#include <EEPROM.h>
#include "ipv4_helpers.h"
#include "secrets.h"
#include "persist_data.h"
#include "persist_data.cpp"   // WHY IS THIS NEEDED?? The linker can't find instances of Persistent.

// Increase this if any changes are made to "struct Config".
#define CONFIG_VERSION "001"

// Remember this many MQTT brokers.
#define MAX_BROKERS 16

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
  IPAddress brokers[MAX_BROKERS];
  int port;
  Connected_device devices[MAX_DEVICES];
  char version_of_program[4];
  // TODO: add WFI ssid and password.
} config = {
  "esp8266",
  {IPAddress(192, 168, 192, 9)},
  1883,
  {},
  CONFIG_VERSION
};

MDNSResponder mdns;
String mac_address;
const int led = 2;



// Configuration
bool configAddBroker(String broker) {
  for (uint8_t b = 0; b < MAX_BROKERS; ++b) {
    if (config.brokers[b] == string_to_ip(broker)) {
      // Already exists.
      return true;
    }
    if (config.brokers[b] == IPAddress(0, 0, 0, 0)) {
      // Empty slot so add the new one.
      config.brokers[b] = string_to_ip(broker);
      return true;
    }
  }
  return false;
}

bool configRemoveBroker(String broker) {
  for (uint8_t b = 0; b < MAX_BROKERS; ++b) {
    if (config.brokers[b] == string_to_ip(broker)) {
      config.brokers[b] == IPAddress(0, 0, 0, 0);
      return true;
    }
  }
  return false;
}


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
  for (uint8_t b = 0; b < MAX_BROKERS; ++b) {
    if (config.brokers[b] != IPAddress(0, 0, 0, 0)) {
      mqtt_client = PubSubClient(config.brokers[b]);

      mqtt_client.set_callback(mqtt_callback);
      if (mqtt_client.connect("esp8266")) {
        mqtt_client.publish("homeautomation/announce/esp8266", mac_address);
        mqtt_client.subscribe("homeautomation/configure/" + mac_address);
      }
      delay(10);
      if (mqtt_client.connected()) {
        break;
      }
    }
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

  message += "brokers:\n";
  for (b = 0; b < MAX_BROKERS; ++b) {
    message += " " + ip_to_string(config.brokers[b]);
    message += "\n";
  }
  message += "\n";
  message += "port: ";
  message += config.port;
  message += "\n";
  message += "version: ";
  message += config.version_of_program;

  message += "\n";
  message += "<form action='/configure/'>";
  message += "<input type='text' name='add_broker' pattern='\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}' value='0.0.0.0'>";
  message += "<input type='submit' value='Add Broker'>";
  message += "</form>";

  http_server.send(200, "text/plain", message);
  digitalWrite(led, 0);
}

void handleConfig() {
  String message = "";
  if (http_server.hasArg("add_broker")) {
    if (configAddBroker(http_server.arg("add_broker"))) {
      message += "Added broker: " + http_server.arg("add_broker") + "\n";
    } else {
      message += "Failed to add broker: " + http_server.arg("add_broker") + "\n";
    }
  }
  if (http_server.hasArg("delete_broker")) {
    if (configRemoveBroker(http_server.arg("delete_broker"))) {
      message += "Deleted broker: " + http_server.arg("add_broker") + "\n";
    } else {
      message += "Failed to delete broker: " + http_server.arg("add_broker") + "\n";
    }
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

  if (mdns.begin("esp8266", WiFi.localIP())) {
    Serial.println("MDNS responder started");
  }

  http_server.on("/", handleRoot);
  http_server.on("/configure/", handleConfig);
  http_server.onNotFound(handleNotFound);

  http_server.begin();
  Serial.println("HTTP server started");


  mqtt_connect();
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

  if (!mqtt_client.connected()) {
    Serial.println("MQTT disconnected.");
    mqtt_connect();
  }
}
