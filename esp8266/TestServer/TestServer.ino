#include <ESP8266WiFi.h>
#include <WiFiClient.h>
#include <ESP8266WebServer.h>
#include <EEPROM.h>
#include <PubSubClient.h>      // Include "PubSubClient" library.
#include <mdns.h>              // Include "esp8266_mdns" library.

#include "ipv4_helpers.h"
#include "secrets.h"
#include "persist_data.h"
#include "persist_data.cpp"   // WHY IS THIS NEEDED?? The linker can't find instances of Persistent.
#include "Brokers.h"
#include "html_primatives.h"


// Maximum size of an incoming mDNS packet. Make this as big as free RAM allows.
#define MAX_MDNS_PACKET_SIZE 512

// Increase this if any changes are made to "struct Config" or you need to reset
// config to default values.
#define CONFIG_VERSION "006"

// Maximum number of devices connected to IO pins.
#define MAX_DEVICES 4

// Maximum number of subscriptions to MQTT.
#define MAX_SUBSCRIPTIONS 10

// Length of name strings. (hostname, room names, lamp names, etc.)
#define HOSTNAME_LEN 32
#define NAME_LEN 16

// Each device has an address in the form 'role/location1/location2/etc'
// eg: 'lighting/kitchen/worktop/left'.
// These map to the second half of the MQTT topic.
#define ADDRESS_SEGMENTS 4

// MQTT topics will start with a prefix.
// eg: in the topic 'homeautomation/0/lighting/kitchen/worktop/left',
//     'homeautomation/0' maps to the prefix.
#define PREFIX_LEN 32

// IO Pin that will enable configuration web page.
#define CONFIGURE_PIN 0

// Maximum length of a MQTT topic.
#define MAX_TOPIC_LENGTH  (PREFIX_LEN + ((NAME_LEN +1) * ADDRESS_SEGMENTS) +1)

enum Io_Type {
  test,
  pwm,
  onoff,
  input
};

typedef struct Address_Segment {
  char segment[NAME_LEN];
} Address_Segment;

typedef struct Connected_device {
  Address_Segment address_segment[ADDRESS_SEGMENTS];
  Io_Type iotype;
  int iopins[3];
  int io_value[3];
} Connected_device;

struct Config {
  char hostname[HOSTNAME_LEN];
  char subscribe_prefix[PREFIX_LEN];
  char publish_prefix[PREFIX_LEN];
  Connected_device devices[MAX_DEVICES];
  IPAddress local_address;
  IPAddress broker_address;
  char config_version[4];
  // TODO: add WFI ssid and password.
} config = {
  "",
  "homeautomation/+",
  "homeautomation/0",
  {},
  {0,0,0,0},
  {0,0,0,0},
  CONFIG_VERSION
};

String mac_address;
bool allow_config = false;


// Configuration
void sanitizeHostname(char* buffer){
  for(int i=0; i< strlen(buffer);i++){
    if(buffer[i] >= 'A' && buffer[i] <= 'Z'){
      buffer[i] = buffer[i] + 'a' - 'A';
    } else if(buffer[i] >= 'a' && buffer[i] <= 'z'){
      // pass
    } else if(buffer[i] >= '0' && buffer[i] <= '9'){
      // pass
    } else if(buffer[i] == '-'){
      // pass
    } else {
      buffer[i] = '-';
    }
  }
}

void sanitizeTopicSection(char* buffer){
  bool wildcard_found = false;
  for(int i=0; i < strlen(buffer);i++){
    if(wildcard_found){
      // Wildcard was found as first character but there is other stuff here too
      // so mask out the wildcard.
      buffer[0] = '_';
    }

    if(buffer[i] >= 'A' && buffer[i] <= 'Z'){
      // pass
    } else if(buffer[i] >= 'a' && buffer[i] <= 'z'){
      // pass
    } else if(buffer[i] >= '0' && buffer[i] <= '9'){
      // pass
    } else if((buffer[i] == '+' || buffer[i] == '#') && (i == 0)){
      // Wildcards only valid if they are the only character present.
      wildcard_found = true;
    } else {
      buffer[i] = '_';
    }
  }
}

void sanitizeTopic(char* buffer){
  bool wildcard_found = false;
  
  // Remove any trailing "/".
  if(buffer[strlen(buffer) -1] == '/'){
    buffer[strlen(buffer) -1] = '\0';
  }

  for(int i=0; i < strlen(buffer); i++){
    if(buffer[i] == '/' && i > 0 && i < strlen(buffer) -1){
      // Section seperator is fine as long as it's not the first or last character
    } else if(buffer[i] >= 'A' && buffer[i] <= 'Z'){
      // pass
    } else if(buffer[i] >= 'a' && buffer[i] <= 'z'){
      // pass
    } else if(buffer[i] >= '0' && buffer[i] <= '9'){
      // pass
    } else if((buffer[i] == '+' || buffer[i] == '#') && 
              (buffer[i +1] == '/' || buffer[i +1] == '\0') &&
              (i == 0 || buffer[i -1] == '/')){
      // Wildcards only valid if they are the only character in a section.
    } else {
      buffer[i] = '_';
    }
  }
}

void SetHostname(const char* new_hostname) {
  strncpy(config.hostname, new_hostname, HOSTNAME_LEN -1);
  config.hostname[HOSTNAME_LEN -1] = '\0';
  sanitizeHostname(config.hostname);
}

void SetPrefix(const char* new_prefix, char* dest_buffer) {
  strncpy(dest_buffer, new_prefix, PREFIX_LEN -1);
  dest_buffer[PREFIX_LEN -1] = '\0';
  sanitizeTopic(dest_buffer);
}

void SetDevice(const unsigned int index, struct Connected_device& device) {
  if (index < MAX_DEVICES) {
    memcpy(&(config.devices[index]), &device, sizeof(device));
  }
}

String DeviceAddress(const Connected_device& device) {
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


// mDNS
Brokers brokers(QUESTION_SERVICE);

void answerCallback(const mdns::Answer* answer) {
  //answer->Display();
  brokers.ParseMDnsAnswer(answer);
}
mdns::MDns my_mdns(NULL, NULL, answerCallback, MAX_MDNS_PACKET_SIZE);


// MQTT

WiFiClient espClient;
PubSubClient mqtt_client(espClient);
char mqtt_subscriptions[MAX_TOPIC_LENGTH * MAX_SUBSCRIPTIONS];
int mqtt_subscription_count = 0;
int mqtt_subscribed_count = 0;


void parse_topic(const char* topic, Address_Segment* address_segments){
  // We only care about the part of the topic without the prefix
  // so check how many segments there are in config.subscribe_prefix
  // so we can ignore that many segments later.
  int i, segment = 0;
  if(strlen(config.subscribe_prefix)){
    for (i=0, segment=-1; config.subscribe_prefix[i]; i++){
      segment -= (config.subscribe_prefix[i] == '/');
    }
  }

  // Casting non-const here as we don't actually modify topic.
  char* p_segment_start = (char*)topic;
  char* p_segment_end = strchr(topic, '/');
  while(p_segment_end != NULL){
    if(segment >= 0){
      int segment_len = p_segment_end - p_segment_start;
      if(segment_len > NAME_LEN){
        segment_len = NAME_LEN;
      }
      strncpy(address_segments[segment].segment, p_segment_start, segment_len);
      address_segments[segment].segment[segment_len] = '\0';
    }
    p_segment_start = p_segment_end +1;
    p_segment_end = strchr(p_segment_start, '/');
    segment++;
  }
  strncpy(address_segments[segment++].segment, p_segment_start, NAME_LEN);
  
  for(; segment < ADDRESS_SEGMENTS; segment++){
    address_segments[segment].segment[0] = '\0';
  }
}

bool compare_addresses(const Address_Segment* address_1, const Address_Segment* address_2){
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

String value_from_payload(const byte* payload, const unsigned int length, const String key) {
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
void mqtt_callback(const char* topic, const byte* payload, const unsigned int length) {
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

  if(strncmp(address_segments[0].segment, "hosts", NAME_LEN) == 0 ||
      strncmp(address_segments[0].segment, "_all", NAME_LEN) == 0)
  {
    if(command == "solicit"){
      //Serial.println("Announce host.");
      mqtt_announce_host();
    }
  }

  for (int i = 0; i < MAX_DEVICES; ++i) {
      if(compare_addresses(address_segments, config.devices[i].address_segment)){
          //Serial.print("Matches: ");
          //Serial.println(i);

          if(command == ""){
            // pass
          } else if(command == "solicit"){
            mqtt_announce(config.devices[i]);
          } else {
            change_state(config.devices[i], command);
          }          
      }
  }
}

void mqtt_announce_host(){
  String parsed_mac = mac_address;
  parsed_mac.replace(":", "_");
  String announce = "_subject:";
  announce += parsed_mac;
  announce += ", _hostname:";
  announce += config.hostname;
  announce += ", _ip:";
  announce += ip_to_string(WiFi.localIP());
  char host[60 + HOSTNAME_LEN];  // eg: "_subject:AA_BB_CC_DD_EE_FF, _hostname:somehost, ip:123.123.123.123"
  announce.toCharArray(host, 60 + HOSTNAME_LEN);

  String address_string = config.publish_prefix;
  address_string += "/hosts/_announce";
  char address_char[PREFIX_LEN + 17];  // eg: "pre/fix/hosts/_announce"
  address_string.toCharArray(address_char, PREFIX_LEN + 17);

  mqtt_client.publish(address_char, host);
}

void mqtt_announce(const Connected_device& device){
  String announce = "_state:";
  if(device.iotype == onoff || device.iotype == pwm || device.iotype == test){
    announce += String(device.io_value[0]);
  } else if(device.iotype == input){
    pinMode(device.iopins[0], INPUT_PULLUP);
    announce += digitalRead(device.iopins[0]);
  }
  
  char target[11];
  announce.toCharArray(target, 11);
  
  String address_string = config.publish_prefix;
  address_string += "/";
  address_string += DeviceAddress(device);
  char address_char[MAX_TOPIC_LENGTH];
  address_string.toCharArray(address_char, MAX_TOPIC_LENGTH);

  mqtt_client.publish(address_char, target);
}

void queue_mqtt_subscription(const char* path){
  for(int i = 0; i < mqtt_subscription_count; i++){
    if(strncmp(&mqtt_subscriptions[i * MAX_TOPIC_LENGTH], path, MAX_TOPIC_LENGTH) == 0){
      return;
    }
  }
  if(mqtt_subscription_count < MAX_SUBSCRIPTIONS){
    Serial.print(mqtt_subscription_count);
    Serial.print(" ");
    Serial.println(path);
    strncpy(&mqtt_subscriptions[mqtt_subscription_count * MAX_TOPIC_LENGTH], path, MAX_TOPIC_LENGTH -1);
    mqtt_subscription_count++;
  } else {
    Serial.println("Error. Too many subscriptions.");
  }
  return;
}

void mqtt_subscribe_one(){
  if(mqtt_subscription_count > mqtt_subscribed_count){
    Serial.print("* ");
    Serial.println(&mqtt_subscriptions[mqtt_subscribed_count * MAX_TOPIC_LENGTH]);
    mqtt_client.subscribe(&mqtt_subscriptions[mqtt_subscribed_count * MAX_TOPIC_LENGTH]);
    mqtt_subscribed_count++;
  }
}

void mqtt_clear_buffers(){
  for(int i = 0; i < MAX_SUBSCRIPTIONS; i++){
    mqtt_subscriptions[i * MAX_TOPIC_LENGTH] = '\0';
  }
  mqtt_subscription_count = 0;
  mqtt_subscribed_count = 0;
}

// Called whenever we want to make sure we are subscribed to necessary topics.
void mqtt_connect() {
  Broker broker = brokers.GetBroker();
  if(broker.address == IPAddress(0,0,0,0)){
    return;
  }
  mqtt_client.setServer(broker.address, 1883);
  mqtt_client.setCallback(mqtt_callback);

  if (mqtt_client.connect(config.hostname)) {
    if(mqtt_subscribed_count > 0){
      // In the event this is a re-connection, clear the subscription buffer.
      mqtt_clear_buffers();
    }

    char address[MAX_TOPIC_LENGTH];
   
    strncpy(address, config.subscribe_prefix, MAX_TOPIC_LENGTH -1);
    strncat(address, "/_all/_all", MAX_TOPIC_LENGTH -1 -strlen(address));
    queue_mqtt_subscription(address);
    
    strncpy(address, config.subscribe_prefix, MAX_TOPIC_LENGTH -1);
    strncat(address, "/hosts/_all", MAX_TOPIC_LENGTH -1 - strlen(address));
    queue_mqtt_subscription(address);

    strncpy(address, config.subscribe_prefix, MAX_TOPIC_LENGTH -1);
    strncat(address, "/hosts/", MAX_TOPIC_LENGTH -1 - strlen(address));
    strncat(address, config.hostname, MAX_TOPIC_LENGTH -1 - strlen(address));
    queue_mqtt_subscription(address);

    for (int i = 0; i < MAX_DEVICES; ++i) {
      if (strlen(config.devices[i].address_segment[0].segment) > 0) {
        mqtt_announce(config.devices[i]);

        strncpy(address, config.subscribe_prefix, MAX_TOPIC_LENGTH -1);
        strncat(address, "/_all", MAX_TOPIC_LENGTH -1 - strlen(address));

        for(int j = 0; j < ADDRESS_SEGMENTS; j++){
          if(strlen(config.devices[i].address_segment[j].segment) <= 0) {
            break;
          }
          address[strlen(address) -4] = '\0';
          strncat(address, config.devices[i].address_segment[j].segment, MAX_TOPIC_LENGTH -1 - strlen(address));
          if (j < (ADDRESS_SEGMENTS -1) &&
              strlen(config.devices[i].address_segment[j +1].segment) > 0) {
            strncat(address, "/_all", MAX_TOPIC_LENGTH -1 - strlen(address));
          }
          queue_mqtt_subscription(address);
        }
      }
    }
  }
  brokers.RateBroker(mqtt_client.connected());
  if (mqtt_client.connected()) {
    Serial.print("MQTT connected to: ");
    Serial.println(broker.address);
  }
  
  mqtt_announce_host();
}


// IO
bool to_service_input = false;
void inputCallback(){
  //Serial.println("inputCallback()");
  to_service_input = true;
}

void inputSerice(){
  if(!to_service_input){
    return;
  }
  //Serial.println("inputSerice()");
  to_service_input = false;
  for(int i=0; i < MAX_DEVICES; i++){
    if(config.devices[i].iotype == input){
      byte value = digitalRead(config.devices[i].iopins[0]);
      if(value != config.devices[i].io_value[0]){
        config.devices[i].io_value[0] = value;
        Serial.print("## ");
        Serial.println(value);
        mqtt_announce(config.devices[i]);

        if(i == CONFIGURE_PIN){
          configInterrupt();
        }
      }
    }
  }
}

void setupIo(){
  for(int i=0; i < MAX_DEVICES; i++){
    if(config.devices[i].iotype == input){
      Serial.println("input");
      config.devices[i].io_value[0] = 1;
      pinMode(config.devices[i].iopins[0], INPUT_PULLUP);
      attachInterrupt(digitalPinToInterrupt(config.devices[i].iopins[0]), inputCallback, CHANGE);
    } else if (config.devices[i].io_value[0] > 255 || config.devices[i].io_value[0] < 0) {
      config.devices[i].io_value[0] = 0;
    }
  }
}

void change_state(Connected_device& device, String command){
  command.toLowerCase();
  device.io_value[0] = command.toInt();
  if(command == "on" || command == "true"){
    device.io_value[0] = 255;
  } else if(command == "off" || command == "false"){
    device.io_value[0] = 0;
  } else if (device.io_value[0] > 255 || device.io_value[0] < 0) {
    device.io_value[0] = 0;
  }
  set_state(device);
}

void set_state(const Connected_device& device){
  if(device.iotype == onoff){
    pinMode(device.iopins[0], OUTPUT);
    // If pin was previously set to Io_Type::pwm we need to switch off analogue output
    // before using digital output.
    analogWrite(device.iopins[0], 0);
    
    digitalWrite(device.iopins[0], device.io_value[0]);
  } else if(device.iotype == pwm){
    pinMode(device.iopins[0], OUTPUT);
    analogWrite(device.iopins[0], device.io_value[0]);
  } else if(device.iotype == test){
    Serial.print("Switching pin: ");
    Serial.print(device.iopins[0]);
    Serial.print(" to value: ");
    Serial.println(device.io_value[0]);
  } else if(device.iotype == input){
  }
	mqtt_announce(device);
}


// HTTP
ESP8266WebServer http_server(80);

void handleRoot() {
  Serial.println("handleRoot()");
  String message = "";
  String description_list ="";
  description_list += descriptionListItem("MAC address", mac_address);
  description_list += descriptionListItem("Hostname", config.hostname);
  description_list += descriptionListItem("IP address", String(ip_to_string(WiFi.localIP())));
  description_list += descriptionListItem("&nbsp", "&nbsp");

  description_list += descriptionListItem("WiFI RSSI", String(WiFi.RSSI()));
  // WiFi.BSSID() does not appear to work as expected.
  // MAC Address changes between a few set values. Possibly the addresses of other APs in range?
  //byte bssid[6];
  //WiFi.BSSID(*bssid);
  //description_list += descriptionListItem("Router MAC address", macToStr(bssid));
  byte numSsid = WiFi.scanNetworks();
  for (int thisNet = 0; thisNet<numSsid; thisNet++) {
    description_list += descriptionListItem("WiFi SSID", WiFi.SSID(thisNet) +
        "&nbsp&nbsp&nbsp(" + String(WiFi.RSSI(thisNet)) + ")");
  }
  description_list += descriptionListItem("&nbsp", "&nbsp");

  description_list += descriptionListItem("CPU frequency", String(ESP.getCpuFreqMHz()));
  description_list += descriptionListItem("Flash size", String(ESP.getFlashChipSize()));
  description_list += descriptionListItem("Flash space",
      String(int(100 * ESP.getFreeSketchSpace() / ESP.getFlashChipSize())) + "%");
  description_list += descriptionListItem("Flash speed", String(ESP.getFlashChipSpeed()));
  description_list += descriptionListItem("Free memory", String(ESP.getFreeHeap()));
  description_list += descriptionListItem("SDK version", ESP.getSdkVersion());
  description_list += descriptionListItem("Core version", ESP.getCoreVersion());
  description_list += descriptionListItem("Config version", config.config_version);
  description_list += descriptionListItem("&nbsp", "&nbsp");
  description_list += descriptionListItem("Analogue in", String(analogRead(A0)));
  description_list += descriptionListItem("System clock", String(millis() / 1000));
  description_list += descriptionListItem("&nbsp", "&nbsp");
  
  description_list += descriptionListItem("Brokers", brokers.Summary());
 
#ifdef DEBUG_STATISTICS
  if(my_mdns.packet_count != 0){
    description_list += descriptionListItem("&nbsp", "&nbsp");
    description_list += descriptionListItem("mDNS decode success rate",
        String(my_mdns.packet_count - my_mdns.buffer_size_fail) + " / " + 
        String(my_mdns.packet_count) + "&nbsp&nbsp&nbsp" +
        String(100 - (100 * my_mdns.buffer_size_fail / my_mdns.packet_count)) + "%");
    description_list += descriptionListItem("Largest mDNS packet size",
        String(my_mdns.largest_packet_seen) + " / " + 
        String(MAX_MDNS_PACKET_SIZE) + " bytes");
  }
#endif

  message += descriptionList(description_list);
  
  http_server.send(200, "text/html", page(style, javascript, "", message));
  Serial.println("handleRoot() -");
}

void handleConfig() {
  Serial.println("handleConfig()");
  String message = "";
  
  if(allow_config){
    String description_list = "";
    description_list += descriptionListItem("mac_address", mac_address);
    description_list += descriptionListItem("hostname", 
        textField("hostname", "hostname", config.hostname, "hostname") +
        submit("Save", "save_hostname" , "save('hostname')"));
    description_list += descriptionListItem("MQTT subscription prefix",
        textField("subscribeprefix", "subscribeprefix", config.subscribe_prefix,
          "subscribeprefix") +
        submit("Save", "save_subscribeprefix" , "save('subscribeprefix')"));
    description_list += descriptionListItem("MQTT publish prefix",
        textField("publishprefix", "publishprefix", config.publish_prefix,
          "publishprefix") +
        submit("Save", "save_publishprefix" , "save('publishprefix')"));
    description_list += descriptionListItem("IP address", String(ip_to_string(WiFi.localIP())));

    message = descriptionList(description_list);

    String rows = row(header("index") + header("Topic") + header("type") + 
        header("IO pin") + header("") + header(""), "");
    int empty_device = -1;
    for (int i = 0; i < MAX_DEVICES; ++i) {
      if (strlen(config.devices[i].address_segment[0].segment) > 0) {
        String cells = cell(String(i));
        String name = "topic_";
        name += i;
        cells += cell(config.subscribe_prefix + String("/") +
            textField(name, "some/topic", DeviceAddress(config.devices[i]),
              "device_" + String(i) + "_topic"));
        if (config.devices[i].iotype == Io_Type::pwm) {
          cells += cell(outletType("pwm", "device_" + String(i) + "_iotype"));
        } else if (config.devices[i].iotype == Io_Type::onoff) {
          cells += cell(outletType("onoff", "device_" + String(i) + "_iotype"));
        } else if (config.devices[i].iotype == Io_Type::input) {
          cells += cell(outletType("input", "device_" + String(i) + "_iotype"));
        } else {
          cells += cell(outletType("test", "device_" + String(i) + "_iotype"));
        }
        name = "pin_";
        name += i;
        cells += cell(ioPin(String(config.devices[i].iopins[0]),
              "device_" + String(i) + "_iopins"));
        cells += cell(submit("Save", "save_" + String(i), "save('device_" + String(i) +"')"));
        cells += cell(submit("Delete", "del_" + String(i), "del('device_" + String(i) +"')"));
        rows += row(cells, "device_" + String(i));
      } else if (empty_device < 0){
        empty_device = i;
      }
    }
    if (empty_device >= 0){
      // An empty slot for new device.
      String cells = cell(String(empty_device));
      String name = "address_";
      name += empty_device;
      cells += cell(config.subscribe_prefix + String("/") +
          textField(name, "new/topic", "", "device_" + String(empty_device) + "_topic"));
      cells += cell(outletType("onoff", "device_" + String(empty_device) + "_iotype"));
      name = "pin_";
      name += empty_device;
      cells += cell(ioPin("", "device_" + String(empty_device) + "_iopins"));
      cells += cell(submit("Save", "save_" + String(empty_device),
            "save('device_" + String(empty_device) + "')"));
      cells += cell("");
      rows += row(cells, "device_" + String(empty_device));
    }
    message += table(rows);

    description_list ="";
    description_list += descriptionListItem("Brokers", brokers.Summary());
    message += descriptionList(description_list);
  } else {
    Serial.println("Not allowed to handleConfig()");
    message += "Configuration mode not enabled.\nPress button connected to IO ";
    message += String(CONFIGURE_PIN);
    message += " and reload.";
  }
  
  http_server.send(200, "text/html", page(style, javascript, "", message));
  Serial.println("handleConfig() -");
}

void handleSet() {
  Serial.println("handleSet() +");
  if(!allow_config){
    Serial.println("Not allowed to handleSet()");
    http_server.send(200, "text/html", "Not allowed to handleSet()");
    return;
  }

  const unsigned int now = millis() / 1000;

  String message = "";

  for(int i = 0; i < http_server.args(); i++){
    message += http_server.argName(i);
    message += '\t';
    message += http_server.arg(i);
    message += '\n';
    Serial.print(http_server.argName(i));
    Serial.print("\t");
    Serial.println(http_server.arg(i));
  }
  message += '\n';

  if (http_server.hasArg("test_arg")) {
    message += "test_arg: " + http_server.arg("test_arg") + "\n";
  } else if (http_server.hasArg("hostname")) {
    char tmp_buffer[HOSTNAME_LEN];
    http_server.arg("hostname").toCharArray(tmp_buffer, HOSTNAME_LEN);
    SetHostname(tmp_buffer);
    message += "hostname: " + http_server.arg("hostname") + "\n";
  } else if (http_server.hasArg("publishprefix")) {
    char tmp_buffer[PREFIX_LEN];
    http_server.arg("publishprefix").toCharArray(tmp_buffer, PREFIX_LEN);
    SetPrefix(tmp_buffer, config.publish_prefix);
    message += "publishprefix: " + http_server.arg("publishprefix") + "\n";
  } else if (http_server.hasArg("subscribeprefix")) {
    char tmp_buffer[PREFIX_LEN];
    http_server.arg("subscribeprefix").toCharArray(tmp_buffer, PREFIX_LEN);
    SetPrefix(tmp_buffer, config.subscribe_prefix);
    message += "subscribeprefix: " + http_server.arg("subscribeprefix") + "\n";
  } else if (http_server.hasArg("device") and http_server.hasArg("address_segment") and
      http_server.hasArg("iotype") and http_server.hasArg("iopins")) {
    unsigned int index = http_server.arg("device").toInt();
    Connected_device device;

    int segment_counter = 0;
    for(int i = 0; i < http_server.args(); i++){
      if(http_server.argName(i) == "address_segment" && segment_counter < ADDRESS_SEGMENTS){
        http_server.arg(i).toCharArray(device.address_segment[segment_counter].segment,
                                       NAME_LEN);
        sanitizeTopicSection(device.address_segment[segment_counter].segment);
        segment_counter++;
      }
    }
    for(int i = segment_counter; i < ADDRESS_SEGMENTS; i++){
      device.address_segment[segment_counter++].segment[0] = '\0';
    }

    if (http_server.arg("iotype") == "pwm") {
      device.iotype = Io_Type::pwm;
    } else if (http_server.arg("iotype") == "onoff") {
      device.iotype = Io_Type::onoff;
    } else if (http_server.arg("iotype") == "input") {
      device.iotype = Io_Type::input;
    } else {
      device.iotype = Io_Type::test;
    }

    // strtok() is broken in esp8266 Arduino so we must parse by hand.
    char io_pins_buffer[NAME_LEN];
    char pin_buffer[4];
    http_server.arg("iopins").toCharArray(io_pins_buffer, NAME_LEN);
    if (strlen(io_pins_buffer) + 1 < NAME_LEN) {
      io_pins_buffer[strlen(io_pins_buffer) + 1] = '\0';
      io_pins_buffer[strlen(io_pins_buffer)] = ',';
    }

    unsigned int pin_num = 0, pin_buffer_pointer = 0;
    memset(pin_buffer, '\0', 4);
    for (unsigned int i = 0; i < strlen(io_pins_buffer); ++i) {
      if (io_pins_buffer[i] == ',') {
        device.iopins[pin_num++] = atoi(pin_buffer);
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

    // Force reconnect to MQTT so we subscribe to any new addresses.
    mqtt_client.disconnect();
    setupIo();
  }
  
  Persist_Data::Persistent<Config> persist_config(CONFIG_VERSION, &config);
  persist_config.writeConfig();

  Serial.println(message);

  http_server.send(200, "text/plain", message);
  Serial.println("handleSet() -");
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
  http_server.on("/configure", handleConfig);
  http_server.on("/configure/", handleConfig);
  http_server.on("/set/", handleSet);
  http_server.onNotFound(handleNotFound);

  http_server.begin();
  Serial.println("HTTP server started");

  brokers.RegisterMDns(&my_mdns);
}

void configInterrupt(){
  Serial.println("configInterrupt");
  allow_config = true;
}

void setup(void) {
  Serial.begin(115200);
  Serial.println();
  Serial.println("Reset.");

  Persist_Data::Persistent<Config> persist_config(CONFIG_VERSION, &config);
  persist_config.readConfig();

  WiFi.begin(ssid, pass);
  Serial.println("");

  uint8_t mac[6];
  WiFi.macAddress(mac);
  mac_address = macToStr(mac);

  if (strlen(config.hostname) == 0){
    String hostname = "esp8266_";
    hostname += mac_address;
    char hostname_arr[HOSTNAME_LEN];
    hostname.toCharArray(hostname_arr, HOSTNAME_LEN);
    SetHostname(hostname_arr);
  }

  pinMode(CONFIGURE_PIN, INPUT_PULLUP);
  attachInterrupt(digitalPinToInterrupt(CONFIGURE_PIN), configInterrupt, CHANGE);
  config.devices[CONFIGURE_PIN].io_value[0] = 1;

  setupIo();
}

bool mqtt_connected = true;
int count = 0;
void loop(void) {
  http_server.handleClient();
  mqtt_client.loop();

  if (WiFi.status() != WL_CONNECTED) {
    setup_network();
  }

  if(!my_mdns.Check()){
    //Serial.println("mDNS error.");
  }

  if (!mqtt_client.connected()) {
    if(mqtt_connected){
      Serial.println("MQTT disconnected.");
      mqtt_connected = false;
    }
    mqtt_connect();
    delay(500);
    //if((++count % 10000) == 0){
    //  Serial.print("-");
    //}
  } else {
    if(!mqtt_connected){
      // Serial.println("MQTT connected.");
      mqtt_connected = true;
    }
    mqtt_subscribe_one();
  }

  inputSerice();
}
