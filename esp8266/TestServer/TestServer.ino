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
#include "html_primatives.h"


// Increase this if any changes are made to "struct Config".
#define CONFIG_VERSION "001"

// Maximum number of devices connected to IO pins.
#define MAX_DEVICES 3

// Maximum number of subscriptions to MQTT.
#define MAX_SUBSCRIPTIONS 8

// Length of name strings. (hostname, room names, lamp names, etc.)
#define NAME_LEN 32

// Each device has an address in the form 'role/location1/location2/etc'
// eg: 'lighting/kitchen/worktop/left'.
#define ADDRESS_SEGMENTS 4
#define ADDRESS_SEGMENT_LEN 32




enum Io_Type {
  test,
  rgb,
  pwm,
  onoff
};

typedef struct Address_Segment {
  char segment[ADDRESS_SEGMENT_LEN];
} Address_Segment;

typedef struct Connected_device {
  Address_Segment address_segment[ADDRESS_SEGMENTS];
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


// Configuration
void SetHostname(const char* new_hostname) {
  strncpy(config.hostname, new_hostname, NAME_LEN -1);
  config.hostname[NAME_LEN] = '\0';
}

void SetDevice(const unsigned int index, struct Connected_device& device) {
  if (index < MAX_DEVICES) {
    memcpy(&(config.devices[index]), &device, sizeof(device));
  }
}

String DeviceAddress(Connected_device& device) {
  String return_value = "";
  for(int i = 0; i < ADDRESS_SEGMENTS; i++){
    if(strlen(device.address_segment[i].segment) > 0){
      if(i > 0){
        return_value += "/";
      }
      return_value += device.address_segment[i].segment;
    } else {
      break;
    }
  }
  return return_value;
}


// IO
void change_state(Connected_device& device, String command){
  if(device.io_type == test || device.io_type == onoff){
    Serial.print("Switching ");
    Serial.println(command);
    if(command == "on"){
      device.io_value[0] = 1;
      pinMode(device.io_pins[0], OUTPUT);
      digitalWrite(device.io_pins[0], 1);
    } else if(command == "off"){
      device.io_value[0] = 0;
      pinMode(device.io_pins[0], OUTPUT);
      digitalWrite(device.io_pins[0], 0);
    }
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
char mqtt_subscriptions[255 * (MAX_SUBSCRIPTIONS +1)];
int mqtt_subscription_count = 0;
int mqtt_subscribed_count = 0;


void parse_topic(char* topic, Address_Segment* address_segments){
  int segment = -2;  // We don't care about the first 2 segments.
  char* p_segment_start = topic;
  char* p_segment_end = strchr(topic, '/');
  while(p_segment_end != NULL){
    if(segment >= 0){
      int segment_len = p_segment_end - p_segment_start;
      if(segment_len > ADDRESS_SEGMENT_LEN){
        segment_len = ADDRESS_SEGMENT_LEN;
      }
      strncpy(address_segments[segment].segment, p_segment_start, segment_len);
      address_segments[segment].segment[segment_len] = '\0';
    }
    p_segment_start = p_segment_end +1;
    p_segment_end = strchr(p_segment_start, '/');
    segment++;
  }
  strncpy(address_segments[segment++].segment, p_segment_start, ADDRESS_SEGMENT_LEN);
  
  for(; segment < ADDRESS_SEGMENTS; segment++){
    address_segments[segment].segment[0] = '\0';
  }
}

bool compare_addresses(Address_Segment* address_1, Address_Segment* address_2){
  if(strlen(address_2[0].segment) <= 0){
    return false;
  }
  if(strcmp(address_1[0].segment, "_all") != 0 &&
      strcmp(address_1[0].segment, address_2[0].segment) != 0){
    return false;
  }
  for(int s=1; s < ADDRESS_SEGMENTS; s++){
    if(strcmp(address_1[s].segment, "_all") == 0){
      return true;
    }
    if(strcmp(address_1[s].segment, address_2[s].segment) != 0){
      return false;
    }
  }
  return true;
}

String value_from_payload(byte* payload, unsigned int length, String key) {
  key.trim();
  String buffer;
  int index = 0;
  for (int i = 0; i < length; i++) {
    buffer += (char)payload[i];
  }
  buffer.trim();
  
  while(buffer.length()){
    index = buffer.indexOf(",", index);
    if(index < 0){
      index = buffer.length();
    }
    String substring = buffer.substring(0, index);
    int seperator_pos = substring.indexOf(":");
    if(seperator_pos > 0){
      String k = substring.substring(0, seperator_pos);
      String v = substring.substring(seperator_pos +1);
      k.trim();
      v.trim();
      if(k == key){
        return v;
      }
    }

    buffer = buffer.substring(index +1);
    buffer.trim();
  }

  return "";
}

// Called whenever a MQTT topic we are subscribed to arrives.
void mqtt_callback(char* topic, byte* payload, unsigned int length) {
  Serial.print("Message arrived [");
  Serial.print(topic);
  Serial.print("] ");
  for (int i = 0; i < length; i++) {
    Serial.print((char)payload[i]);
  }
  Serial.println();
  
  Address_Segment address_segments[ADDRESS_SEGMENTS];
  parse_topic(topic, address_segments);

  String command = value_from_payload(payload, length, "_command");

  if(strncmp(address_segments[0].segment, "hosts", ADDRESS_SEGMENT_LEN) == 0 ||
      strncmp(address_segments[0].segment, "_all", ADDRESS_SEGMENT_LEN) == 0)
  {
    if(command == "solicit"){
      Serial.println("Announce host.");
      mqtt_announce_host();
    }
  }

  for (int i = 0; i < MAX_DEVICES; ++i) {
      if(compare_addresses(address_segments, config.devices[i].address_segment)){
          Serial.print("Matches: ");
          Serial.println(i);

          if(command == "solicit"){
            mqtt_announce(config.devices[i]);
          } else {
            change_state(config.devices[i], command);
          }          
      }
  }
  Serial.println();
}

void mqtt_announce_host(){
  char host[512];
  String parsed_mac = mac_address;
  parsed_mac.replace(":", "_");
  String announce = "_subject : ";
  announce += parsed_mac;
  announce += ", _hostname : ";
  announce += config.hostname;
  announce += ", _ip : ";
  announce += ip_to_string(WiFi.localIP());

  announce.toCharArray(host, 512);
  mqtt_client.publish("homeautomation/0/hosts/_announce", host);
}

void mqtt_announce(Connected_device& device){
  char lamp[255];
  String announce = "_subject : " + DeviceAddress(device);
  announce += " , _state : ";
  
  if(device.io_type == test || device.io_type == onoff){
    if(device.io_value[0] <= 0){
      announce += "off";
    } else {
      announce += "on";
    }
  } else {
    announce += "TODO";
  }
  
  announce.toCharArray(lamp, 255);
  mqtt_client.publish("homeautomation/0/lighting/_announce", lamp);
}

void queue_mqtt_subscription(const char* path){
  for(int i = 0; i < mqtt_subscription_count; i++){
    if(strncmp(&mqtt_subscriptions[i * 255], path, 255) == 0){
      return;
    }
  }
  if(mqtt_subscription_count <= MAX_SUBSCRIPTIONS){
    Serial.print(mqtt_subscription_count);
    Serial.print(" ");
    Serial.println(path);
    strncpy(&mqtt_subscriptions[mqtt_subscription_count * 255], path, 255);
    mqtt_subscription_count++;
  } else {
    Serial.println("Error. Too many subscriptions.");
  }
  return;
}

void mqtt_subscribe_one(){
  if(mqtt_subscription_count > mqtt_subscribed_count){
    Serial.print("* ");
    Serial.println(&mqtt_subscriptions[mqtt_subscribed_count * 255]);
    mqtt_client.subscribe(&mqtt_subscriptions[mqtt_subscribed_count * 255]);
    mqtt_subscribed_count++;
  }
}

void mqtt_clear_buffers(){
  for(int i = 0; i < MAX_SUBSCRIPTIONS; i++){
    mqtt_subscriptions[i * 255] = '\0';
  }
  mqtt_subscription_count = 0;
  mqtt_subscribed_count = 0;
}

// Called whenever we want to make sure we are subscribed to necessary topics.
void mqtt_connect() {
  Broker broker = brokers.GetBroker();
  mqtt_client.setServer(broker.address, 1883);
  mqtt_client.setCallback(mqtt_callback);

  if (mqtt_client.connect(config.hostname)) {
    if(mqtt_subscribed_count > 0){
      // In the event this is a re-connection, clear the subscription buffer.
      mqtt_clear_buffers();
    }

    char lamp[255];
    char address[255];
   
    strncpy(address, "homeautomation/+/_all/_all", 254);
    queue_mqtt_subscription(address);
    
    strncpy(address, "homeautomation/+/hosts/_all", 254);
    queue_mqtt_subscription(address);
    strncpy(address, "homeautomation/+/hosts/", 254);
    strncat(address, config.hostname, 254 - strlen(address));
    queue_mqtt_subscription(address);

    for (int i = 0; i < MAX_DEVICES; ++i) {
      if (strlen(config.devices[i].address_segment[0].segment) > 0) {
        mqtt_announce(config.devices[i]);

        strncpy(address, "homeautomation/+/_all", 254);

        for(int j = 0; j < ADDRESS_SEGMENTS; j++){
          if(strlen(config.devices[i].address_segment[j].segment) <= 0) {
            break;
          }
          address[strlen(address) -4] = '\0';
          strncat(address, config.devices[i].address_segment[j].segment, 254 - strlen(address));
          if (j < (ADDRESS_SEGMENTS -1) &&
              strlen(config.devices[i].address_segment[j +1].segment) > 0) {
            strncat(address, "/_all", 254 - strlen(address));
          }
          queue_mqtt_subscription(address);
        }
      }
    }
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
  int b;

  String message = "";

  //for (b = 0; b < http_server.args(); ++b) {
  //  message += "\narg: " + http_server.argName(b) + " val: " + http_server.arg(b);
  //}

  String description_list = "";
  description_list += descriptionListItem("CPU frequency", String(ESP.getCpuFreqMHz()));
  description_list += descriptionListItem("Flash size", String(ESP.getFlashChipSize()));
  description_list += descriptionListItem("Flash speed", String(ESP.getFlashChipSpeed()));
  description_list += descriptionListItem("Free memory", String(ESP.getFreeHeap()));
  description_list += descriptionListItem("SDK version", ESP.getSdkVersion());
  description_list += descriptionListItem("Core version", ESP.getCoreVersion());
  description_list += descriptionListItem("Config version", config.config_version);
  description_list += descriptionListItem("Analouge in", String(analogRead(A0)));
  description_list += descriptionListItem("mac_address", mac_address);
  description_list += descriptionListItem("IP address", String(ip_to_string(WiFi.localIP())));
  description_list += descriptionListItem("hostname", String(config.hostname));

  message = page(style(), "", descriptionList(description_list));

  /*message += "\n";
  message += "\nCPU frequency:\t";
  message += ESP.getCpuFreqMHz();
  message += "\nFlash size:\t";
  message += ESP.getFlashChipSize();
  message += "\nFlash speed:\t";
  message += ESP.getFlashChipSpeed();
  message += "\nFree memory:\t";
  message += ESP.getFreeHeap();
  message += "\n";
  message += "\nSDK version:\t";
  message += ESP.getSdkVersion();
  message += "\nCore version:\t";
  message += ESP.getCoreVersion();
  message += "\nConfig version: ";
  message += config.config_version;
  message += "\n";
  message += "\nAnalouge in:\t";
  message += analogRead(A0);
  message += "\n";
  message += "\nmac_address:\t";
  message += mac_address;
  message += "\nIP address:\t";
  message += ip_to_string(WiFi.localIP());
  message += "\n";
  message += "\nhostname:\t";
  message += config.hostname;

  message += "\nmethod:\t";
  if ( http_server.method() == HTTP_GET) {
    message += "HTTP_GET";
  } else if (http_server.method() == HTTP_POST) {
    message += "HTTP_POST";
  } else {
    message += "unknown";
  }
  message += "\n";

  for (int i = 0; i < MAX_DEVICES; ++i) {
    if (strlen(config.devices[i].address_segment[0].segment) > 0) {
      message += i;
      message += "  ";
      message += DeviceAddress(config.devices[i]);
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

  message += brokers.Summary();*/

  http_server.send(200, "text/html", message);
}

void handleConfig() {
  Serial.println("handleConfig()");
  const unsigned int now = millis() / 1000;

  String message = "";

  for(int i = 0; i < http_server.args(); i++){
    message += http_server.argName(i);
    message += '\t';
    message += http_server.arg(i);
    message += '\n';
  }
  message += '\n';

  if (http_server.hasArg("test_arg")) {
    message += "test_arg: " + http_server.arg("test_arg") + "\n";
  }

  if (http_server.hasArg("hostname")) {
    char tmp_buffer[NAME_LEN];
    http_server.arg("hostname").toCharArray(tmp_buffer, NAME_LEN);
    SetHostname(tmp_buffer);
    message += "hostname: " + http_server.arg("hostname") + "\n";
  }

  if (http_server.hasArg("device") and http_server.hasArg("address_segment") and
      http_server.hasArg("io_type") and http_server.hasArg("io_pins")) {
    unsigned int index = http_server.arg("device").toInt();
    Connected_device device;

    int segment_counter = 0;
    for(int i = 0; i < http_server.args(); i++){
      if(http_server.argName(i) == "address_segment"){
        http_server.arg(i).toCharArray(device.address_segment[segment_counter++].segment, ADDRESS_SEGMENT_LEN);
      }
    }
    for(int i = segment_counter; i < ADDRESS_SEGMENTS; i++){
      device.address_segment[segment_counter++].segment[0] = '\0';
    }

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

    unsigned int pin_num = 0, pin_buffer_pointer = 0;
    memset(pin_buffer, '\0', 4);
    for (unsigned int i = 0; i < strlen(io_pins_buffer); ++i) {
      if (io_pins_buffer[i] == ',') {
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

    SetDevice(index, device);

    message += "device: " + http_server.arg("device") + "\n";
    Serial.println(message);

    // Force reconnect to MQTT so we subscribe to any new addreses.
    mqtt_client.disconnect();
  }
  
  Persist_Data::Persistent<Config> persist_config(CONFIG_VERSION, &config);
  persist_config.writeConfig();

  http_server.send(200, "text/plain", message);
}

void handleNotFound() {
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
  Serial.begin(115200);

  Persist_Data::Persistent<Config> persist_config(CONFIG_VERSION, &config);
  persist_config.readConfig();

  WiFi.begin(ssid, pass);
  Serial.println("");

  uint8_t mac[6];
  WiFi.macAddress(mac);
  mac_address = macToStr(mac);

  setup_network();
  my_mdns.Check();
  mqtt_connect();
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
  } else {
    mqtt_subscribe_one();
  }
}
