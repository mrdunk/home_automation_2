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

// Length of name strings. (hostname, room names, lamp names, etc.)
#define NAME_LEN 32


enum Io_Type {
  test,
  rgb,
  pwm,
  onoff
};

typedef struct Connected_device {
  char name[NAME_LEN];
  char room[NAME_LEN];
  Io_Type io_type;
  int io_pins[3];
  int io_value[3];
} Connected_device;

struct Config {
  char hostname[NAME_LEN];
  Connected_device devices[MAX_DEVICES];
  char config_version[4];
  // TODO: add WFI ssid and password.
} config = {
  "esp8266",
  {},
  CONFIG_VERSION
};

String mac_address;
const int led = 12;
const int led2 = 13;


// Configuration
void SetHostname(const char* new_hostname) {
  strncpy(config.hostname, new_hostname, NAME_LEN);
}

void SetDevice(const unsigned int index, struct Connected_device device) {
  if (index < MAX_DEVICES) {
    memcpy(&(config.devices[index]), &device, sizeof(device));
  }
}


// mDNS
Brokers brokers(QUESTION_SERVICE);

void answerCallback(const mdns::Answer* answer) {
  brokers.ParseMDnsAnswer(answer);
}
mdns::MDns my_mdns(NULL, NULL, answerCallback);




// MQTT

WiFiClient espClient;
PubSubClient mqtt_client(espClient);


void mqtt_callback(char* topic, byte* payload, unsigned int length) {
  Serial.print("Message arrived [");
  Serial.print(topic);
  Serial.print("] ");
  for (int i = 0; i < length; i++) {
    Serial.print((char)payload[i]);
  }
  Serial.println();

  // Switch on the LED if an 1 was received as first character
  if ((char)payload[0] == '1') {
    digitalWrite(led2, LOW);   // Turn the LED on (Note that LOW is the voltage level
    // but actually the LED is on; this is because
    // it is acive low on the ESP-01)
  } else {
    digitalWrite(led2, HIGH);  // Turn the LED off by making the voltage HIGH
  }
}

void mqtt_connect() {
  Broker broker = brokers.GetBroker();
  mqtt_client.setServer(broker.address, 1883);
  mqtt_client.setCallback(mqtt_callback);
  if (mqtt_client.connect(config.hostname)) {
    char lamp[255];
    strncpy(lamp, "_subject : lighting/unconfigured/", 254);
    strncat(lamp, config.hostname, 254 - strlen(lamp));
    strncat(lamp, " , _state : off", 254 - strlen(lamp));

    mqtt_client.publish("homeautomation/0/lighting/_announce", lamp);
    //mqtt_client.subscribe("homeautomation/+/lighting/unconfigured/" + config.hostname);
    mqtt_client.subscribe("homeautomation/+/lighting/unconfigured/_all");
    mqtt_client.subscribe("homeautomation/+/lighting/_all");
    mqtt_client.subscribe("homeautomation/+/_all/_all");
  }
  brokers.RateBroker(mqtt_client.connected());
  if (mqtt_client.connected()) {
    Serial.print("MQTT connected. Server: ");
    Serial.println(broker.address);
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

  for (int i = 0; i < MAX_DEVICES; ++i) {
    if (strlen(config.devices[i].name)) {
      message += i;
      message += "  ";
      message += config.devices[i].name;
      message += "  ";
      message += config.devices[i].room;
      message += "  ";
      if (config.devices[i].io_type == Io_Type::test) {
        message += "test";
      } else if (config.devices[i].io_type == Io_Type::rgb) {
        message += "rgb";
      } else if (config.devices[i].io_type == Io_Type::pwm) {
        message += "pwm";
      } else if (config.devices[i].io_type == Io_Type::onoff) {
        message += "onoff";
      }
      message += "  ";
      
      for(int j = 0; j < 3; ++j){
        if(config.devices[i].io_pins[0] >= 0){
          if(j > 0){
            message +=  ",";
          }
          message += config.devices[i].io_pins[0];
        }
      }
      
      message += "\n";
    }
  }

  message += brokers.Summary();

  http_server.send(200, "text/plain", message);
  digitalWrite(led, 0);
}

void handleConfig() {
  const unsigned int now = millis() / 1000;

  String message = "";

  if (http_server.hasArg("test_arg")) {
    message += "test_arg: " + http_server.arg("test_arg") + "\n";
  }
  if (http_server.hasArg("hostname")) {
    char tmp_buffer[NAME_LEN];
    http_server.arg("hostname").toCharArray(tmp_buffer, NAME_LEN);
    SetHostname(tmp_buffer);
    message += "hostname: " + http_server.arg("hostname") + "\n";
  }
  Serial.println("device");
  if (http_server.hasArg("device") and http_server.hasArg("name") and http_server.hasArg("room") and http_server.hasArg("io_type") and http_server.hasArg("io_pins")) {
    unsigned int index = http_server.arg("device").toInt();
    Connected_device device;
    http_server.arg("name").toCharArray(device.name, NAME_LEN);
    http_server.arg("room").toCharArray(device.room, NAME_LEN);
    if (http_server.arg("io_type") == "test") {
      device.io_type = Io_Type::test;
    } else if (http_server.arg("io_type") == "rgb") {
      device.io_type = Io_Type::rgb;
    } else if (http_server.arg("io_type") == "pwm") {
      device.io_type = Io_Type::pwm;
    } else if (http_server.arg("io_type") == "onoff") {
      device.io_type = Io_Type::onoff;
    }

    // strtok() is broken in esp8266 Arduino so we must parse by hand.
    char io_pins_buffer[NAME_LEN];
    char pin_buffer[4];
    http_server.arg("io_pins").toCharArray(io_pins_buffer, NAME_LEN);
    if (strlen(io_pins_buffer) + 1 < NAME_LEN) {
      io_pins_buffer[strlen(io_pins_buffer) + 1] = '\0';
      io_pins_buffer[strlen(io_pins_buffer)] = ',';
    }

    Serial.println(io_pins_buffer);
    Serial.println();

    unsigned int pin_num = 0, pin_buffer_pointer = 0;
    memset(pin_buffer, '\0', 4);
    for (unsigned int i = 0; i < strlen(io_pins_buffer); ++i) {
      if (io_pins_buffer[i] == ',') {
        Serial.println(pin_buffer);
        device.io_pins[pin_num++] = atoi(pin_buffer);
        memset(pin_buffer, '\0', 4);
        pin_buffer_pointer = 0;
      } else if (pin_buffer_pointer < 4) {
        pin_buffer[pin_buffer_pointer++] = io_pins_buffer[i];
      }
      if(pin_num >= 3){
        // Already have maximum number of pins that can be associated with a device.
        break;
      }
    }
    Serial.println();

    SetDevice(index, device);

    message += "device: " + http_server.arg("device") + "\n";
    Serial.println(message);
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

  
  Serial.print("VCC:");
  Serial.println(analogRead(A0));

  Persist_Data::Persistent<Config> persist_config(CONFIG_VERSION, &config);
  persist_config.readConfig();

  WiFi.begin(ssid, pass);
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
