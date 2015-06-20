#include <ESP8266WiFi.h>
#include <WiFiClient.h>
#include <ESP8266WebServer.h>
#include <ESP8266mDNS.h>
#include <PubSubClient.h>
#include <EEPROM.h>

#define CONFIG_VERSION "001"
#define MAX_BROKERS 16

enum device_type {
  test,
  rgb,
  pwm,
  onoff
};

typedef struct Connected_device {
  char unique_id[32];
  char room[32];
  device_type type;
  int io_pins[4];
} Connected_device;

struct Config {
  char hostname[32];
  IPAddress brokers[MAX_BROKERS];
  int port;
  Connected_device devices[8];
  char version_of_program[4];
} config = {
  "esp8266",
  {IPAddress(192, 168, 192, 9)},
  1883,
  {},
  "000"
};



const char* ssid = "Pretty fly for a wifi";
const char* password = "white1331";
MDNSResponder mdns;
String mac_address;
const int led = 2;


String ip_to_string(IPAddress ip){
  String return_value;
  for (byte thisByte = 0; thisByte < 4; thisByte++) {
    return_value += ip[thisByte];
    return_value += ".";
  }
  return return_value;
}

IPAddress string_to_ip(String ip_str){
  uint8_t a, b, c, d, dot, last_dot = 0;

  dot = ip_str.indexOf('.');
  a = ip_str.substring(last_dot, dot).toInt();
        
  last_dot = dot +1;
  dot = ip_str.indexOf('.', dot +1);
  b = ip_str.substring(last_dot, dot).toInt();
    
  last_dot = dot +1;
  dot = ip_str.indexOf('.', dot +1);
  c = ip_str.substring(last_dot, dot).toInt();
  
  last_dot = dot +1;
  d = ip_str.substring(last_dot).toInt();
  
  return IPAddress(a, b, c, d);
}


// Read/write config to EPROM.
void epromSetup()
{
  EEPROM.begin(sizeof(config));
}

int readConfig() {
  if (EEPROM.read(sizeof(config) - 1) == config.version_of_program[3] && // this is '\0'
      EEPROM.read(sizeof(config) - 2) == config.version_of_program[2] &&
      EEPROM.read(sizeof(config) - 3) == config.version_of_program[1] &&
      EEPROM.read(sizeof(config) - 4) == config.version_of_program[0]) {
    // config version matches.
    for (unsigned int t = 0; t < sizeof(config); t++) {
      *((char*)&config + t) = EEPROM.read(t);
    }
  } else {
    Serial.println("");
    Serial.print("Invalid config version:");
    Serial.println(config.version_of_program);
    Serial.println("Using defaults.");
    return 0;
  }
  return 1;
}

int writeConfig() {
  int return_value = 1;
  for (unsigned int t = 0; t < sizeof(config); t++) {
    EEPROM.write(t, *((char*)&config + t));
    if (EEPROM.read(t) != *((char*)&config + t)){
      Serial.print("Error writing config.");
      return_value = 0;
    }
  }
  EEPROM.commit();
  return return_value;
}

// Configuration
bool configAddBroker(String broker){
  for (uint8_t b = 0; b < MAX_BROKERS; ++b){
    if(config.brokers[b] == string_to_ip(broker)){
      // Already exists.
      return true;
    }
    if(config.brokers[b] == IPAddress(0,0,0,0)){
      // Empty slot so add the new one.
      config.brokers[b] = string_to_ip(broker);
      return true;
    }
  }
  return false;
}

bool configRemoveBroker(String broker){
  for (uint8_t b = 0; b < MAX_BROKERS; ++b){
    if(config.brokers[b] == string_to_ip(broker)){
      config.brokers[b] == IPAddress(0,0,0,0);
      return true;
    }
  }
  return false;
}


// MQTT
IPAddress mqtt_broker(192, 168, 192, 9);

void mqtt_callback(const MQTT::Publish& pub) {
  Serial.print("MQTT callback");
  Serial.print(pub.topic());
  Serial.print(" => ");
  Serial.println(pub.payload_string());
}

PubSubClient mqtt_client(mqtt_broker);


// HTTP
ESP8266WebServer http_server(80);

void handleRoot() {
  digitalWrite(led, 1);
  int b;
  
  String message = "hello from esp8266!\n";

  for (b = 0; b < http_server.args(); ++b){
    message += "arg: " + http_server.argName(b) + " val: " + http_server.arg(b) + "\n";
  }
  message += "hostname: ";
  message += config.hostname;
  message += "\n";
  
  message += "method: ";
  if ( http_server.method() == HTTP_GET) {
    message += "HTTP_GET";
  } else if (http_server.method() == HTTP_POST){
    message += "HTTP_POST";
  } else {
    message += "unknown";
  }
  message += "\n";
  
  message += "brokers:\n";
  for (b = 0; b < MAX_BROKERS; ++b){
    message += " " + ip_to_string(config.brokers[b]);
    message += "\n";
  }
  message += "\n";
  message += "port: ";
  message += config.port;
  message += "\n";
  message += "version: ";
  message += config.version_of_program;
  
  http_server.send(200, "text/plain", message);
  digitalWrite(led, 0);
}

void handleConfig() {
  String message = "";
  if(http_server.hasArg("add_broker")){
    if(configAddBroker(http_server.arg("add_broker"))){
      message += "Added broker: " + http_server.arg("add_broker") + "\n";
    } else {
      message += "Failed to add broker: " + http_server.arg("add_broker") + "\n";
    }
  }
  if(http_server.hasArg("delete_broker")){
    if(configRemoveBroker(http_server.arg("delete_broker")){
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


// ---------
String macToStr(const uint8_t* mac)
{
  String result;
  for (int i = 0; i < 6; ++i) {
    result += String(mac[i], 16);
    if (i < 5)
      result += ':';
  }
  return result;
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


  mqtt_client.set_callback(mqtt_callback);
  if (mqtt_client.connect("esp8266")) {
    mqtt_client.publish("homeautomation/announce/esp8266", mac_address);
    mqtt_client.subscribe("homeautomation/configure/" + mac_address);
  }    
}

void setup(void) {
  pinMode(led, OUTPUT);
  digitalWrite(led, 0);
  Serial.begin(115200);

  readConfig();
  
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
}
