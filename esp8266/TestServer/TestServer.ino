#include <ESP8266WiFi.h>
#include <ESP8266WebServer.h>
#include <EEPROM.h>
#include <PubSubClient.h>      // Include "PubSubClient" library.
#include <mdns.h>              // Include "esp8266_mdns" library.

#include "ESP8266httpUpdate.h"

#include "devices.h"
#include "mqtt.h"
#include "ipv4_helpers.h"
#include "secrets.h"
#include "persist_data.h"
#include "persist_data.cpp"   // Template arguments confuse the linker so need to include .cpp .
#include "Brokers.h"
#include "html_primatives.h"
#include "host_attributes.h"
#include "config.h"


Config config = {
  "",
  "homeautomation/+",
  "homeautomation/0",
  {},
  {0,0,0,0},
  {0,0,0,0},
  "http://192.168.192.54:8000/firmware.bin",
  "",
  0,
  false,
  CONFIG_VERSION
};

String mac_address;
int allow_config = 0;


// mDNS

Brokers brokers(QUESTION_SERVICE);

void answerCallback(const mdns::Answer* answer) {
  //answer->Display();
  brokers.ParseMDnsAnswer(answer);
}
mdns::MDns my_mdns(NULL, NULL, answerCallback, MAX_MDNS_PACKET_SIZE);


// MQTT

WiFiClient wifiClient;
Mqtt mqtt(wifiClient, &brokers);

void mqttCallback(const char* topic, const byte* payload, const unsigned int length){
  mqtt.callback(topic, payload, length);
}


// IO
Io io(&mqtt);
void ioCallbackWrapper(){
  Serial.println("ioCallbackWrapper");
  io.inputCallback();
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

  description_list += descriptionListItem("&nbsp", "&nbsp");
  description_list += descriptionListItem("Configure", link("go", "configure"));

  message += descriptionList(description_list);
  
  http_server.send(200, "text/html", page(style, javascript, "", message));
  Serial.println("handleRoot() -");
}

void handleConfig() {
  Serial.println("handleConfig()");
  String message = "";
  if(allow_config){
    --allow_config;
  }
  if(http_server.hasArg("enablepassphrase") &&
      config.enable_passphrase != "" &&
      http_server.arg("enablepassphrase") == config.enable_passphrase){
    allow_config = 1;
  }
  
  if(allow_config){
    message += descriptionListItem("mac_address", mac_address);
    message += descriptionListItem("hostname", 
        textField("hostname", "hostname", config.hostname, "hostname") +
        submit("Save", "save_hostname" , "save('hostname')"));
    message += descriptionListItem("MQTT subscription prefix",
        textField("subscribeprefix", "subscribeprefix", config.subscribe_prefix,
          "subscribeprefix") +
        submit("Save", "save_subscribeprefix" , "save('subscribeprefix')"));
    message += descriptionListItem("MQTT publish prefix",
        textField("publishprefix", "publishprefix", config.publish_prefix,
          "publishprefix") +
        submit("Save", "save_publishprefix" , "save('publishprefix')"));
    message += descriptionListItem("HTTP Firmware URL",
        textField("firmware_server", "firmware_server", config.firmware_server,
          "firmwareserver") +
        submit("Save", "save_firmwareserver" , "save('firmwareserver')"));
    message += descriptionListItem("Enable passphrase",
        textField("enable_passphrase", "enable_passphrase", config.enable_passphrase,
          "enablepassphrase") +
        submit("Save", "save_enablepassphrase" , "save('enablepassphrase')"));
    message += descriptionListItem("Enable IO pin",
        ioPin(config.enable_io_pin, "enableiopin") +
        submit("Save", "save_enableiopin" , "save('enableiopin')"));

    message += descriptionListItem("IP address", String(ip_to_string(WiFi.localIP())));

    String rows = row(header("index") + header("Topic") + header("type") + 
        header("IO pin") + header("Default val") + header("Inverted") +
        header("") + header(""), "");
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
        cells += cell(ioPin(config.devices[i].io_pin,
              "device_" + String(i) + "_io_pin"));
        cells += cell(ioValue(config.devices[i].io_default,
              "device_" + String(i) + "_io_default"));
        cells += cell(ioInverted(config.devices[i].inverted,
              "device_" + String(i) + "_inverted"));

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
      cells += cell(ioPin(0, "device_" + String(empty_device) + "_io_pin"));
      cells += cell(ioValue(0, "device_" + String(empty_device) + "_io_default"));
      cells += cell(ioInverted(false, "device_" + String(empty_device) + "_inverted"));
      cells += cell(submit("Save", "save_" + String(empty_device),
            "save('device_" + String(empty_device) + "')"));
      cells += cell("");
      rows += row(cells, "device_" + String(empty_device));
    }
    message += table(rows);
    message += descriptionListItem("Pull firmware", link("go", "pullfirmware"));

  } else {
    Serial.println("Not allowed to handleConfig()");
    message += "Configuration mode not enabled.\nPress button connected to IO ";
    message += String(config.enable_io_pin);
    message += " and reload.";
  }
  
  http_server.send(200, "text/html", page(style, javascript, "", message));
  Serial.println("handleConfig() -");
}

void handleSet() {
  Serial.println("handleSet() +");
  if(allow_config <= 0){
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
  } else if (http_server.hasArg("firmwareserver")) {
    char tmp_buffer[FIRMWARE_SERVER_LEN];
    http_server.arg("firmwareserver").toCharArray(tmp_buffer, FIRMWARE_SERVER_LEN);
    SetFirmwareServer(tmp_buffer, config.firmware_server);
    message += "firmwareserver: " + http_server.arg("firmwareserver") + "\n";
  } else if (http_server.hasArg("enablepassphrase")) {
    http_server.arg("enablepassphrase").toCharArray(config.enable_passphrase, NAME_LEN);
    message += "enablepassphrase: " + http_server.arg("enablepassphrase") + "\n";
  } else if (http_server.hasArg("enableiopin")) {
    config.enable_io_pin = http_server.arg("enableiopin").toInt();
    message += "enableiopin: " + http_server.arg("enableiopin") + "\n";
  } else if (http_server.hasArg("device") and http_server.hasArg("address_segment") and
      http_server.hasArg("iotype") and http_server.hasArg("io_pin")) {
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

    if(http_server.hasArg("iotype")){
      if (http_server.arg("iotype") == "pwm") {
        device.iotype = Io_Type::pwm;
      } else if (http_server.arg("iotype") == "onoff") {
        device.iotype = Io_Type::onoff;
      } else if (http_server.arg("iotype") == "input") {
        device.iotype = Io_Type::input;
      } else {
        device.iotype = Io_Type::test;
      }
    }

    if(http_server.hasArg("io_pin")){
      device.io_pin = http_server.arg("io_pin").toInt();
    }
    if(http_server.hasArg("io_default")){
      device.io_default = http_server.arg("io_default").toInt();
    }
    if(http_server.hasArg("inverted")){
      if(http_server.arg("inverted") == "true"){
        device.inverted = true;
      } else if(http_server.arg("inverted") == "false"){
        device.inverted = false;
      } else {
        device.inverted = http_server.arg("inverted").toInt();
      }
    }

    SetDevice(index, device);

    message += "device: " + http_server.arg("device") + "\n";
    Serial.println(message);

    // Force reconnect to MQTT so we subscribe to any new addresses.
    mqtt.forceDisconnect();
    io.setup();
  }
  
  Persist_Data::Persistent<Config> persist_config(&config);
  persist_config.writeConfig();

  Serial.println(message);

  http_server.send(200, "text/plain", message);
  Serial.println("handleSet() -");
}

// Set the config.pull_firmware bit in flash and reboot so we pull new firmware on
// next boot.
void handlePullFirmware(){
  String message = "Pulling firmware\n";
  http_server.send(404, "text/plain", message);
  
  config.pull_firmware = true;
  Persist_Data::Persistent<Config> persist_config(&config);
  persist_config.writeConfig();
  
  delay(100);
  ESP.reset();
}

// If we boot with the config.pull_firmware bit set in flash we should pull new firmware
// from an HTTP server.
void pullFirmware(){
  config.pull_firmware = false;
  Persist_Data::Persistent<Config> persist_config(&config);
  persist_config.writeConfig();

  for(int tries = 0; tries < UPLOAD_FIRMWARE_RETRIES; tries++){
    ESPhttpUpdate.rebootOnUpdate(false);
    t_httpUpdate_return ret = ESPhttpUpdate.update(config.firmware_server);
    //t_httpUpdate_return  ret = ESPhttpUpdate.update("https://server/file.bin");

    switch(ret) {
      case HTTP_UPDATE_FAILED:
        Serial.printf("HTTP_UPDATE_FAILD Error (%d): %s", 
            ESPhttpUpdate.getLastError(),
            ESPhttpUpdate.getLastErrorString().c_str());
        Serial.println();
        break;

      case HTTP_UPDATE_NO_UPDATES:
        Serial.println("HTTP_UPDATE_NO_UPDATES");
        break;

      case HTTP_UPDATE_OK:
        Serial.println("HTTP_UPDATE_OK");
        delay(100);
        ESP.reset();
        return;
    }
    Serial.println("Retry...");
    delay(1000);
  }
  Serial.println("Giving up firmware pull.");
}

void handleReset() {
  Serial.println("restarting host");
  delay(100);
  ESP.reset();

  http_server.send(404, "text/plain", "restarting host");
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
  //Serial.setDebugOutput(true);
 
  if(WiFi.SSID() != ssid || WiFi.psk() != pass){
    Serial.println("Reassigning WiFi username and password.");
    WiFi.mode(WIFI_STA);
    WiFi.begin(ssid, pass);
  }
  WiFi.setAutoConnect(true);
  WiFi.setAutoReconnect(true);
 
  /*IPAddress staticIP(192,168,192,200);
  IPAddress gateway(192,168,192,1);
  IPAddress subnet(255,255,255,0);

  WiFi.config(staticIP, gateway, subnet);*/

  // Wait for connection
  int timer = RESET_ON_CONNECT_FAIL * 10;
  while (WiFi.status() != WL_CONNECTED){
    delay(100);
    Serial.print(".");
    if(timer-- == 0){
      timer = RESET_ON_CONNECT_FAIL;
      ESP.reset();
      Serial.println();
    }
  }
  Serial.println("");
  Serial.print("Connected to: ");
  Serial.println(ssid);
  Serial.print("IP address: ");
  Serial.println(WiFi.localIP());

  if(!config.pull_firmware){
    http_server.on("/", handleRoot);
    http_server.on("/configure", handleConfig);
    http_server.on("/configure/", handleConfig);
    http_server.on("/set/", handleSet);
    http_server.on("/reset", handleReset);
    http_server.on("/pullfirmware", handlePullFirmware);
    http_server.onNotFound(handleNotFound);

    http_server.begin();
    Serial.println("HTTP server started");

    brokers.RegisterMDns(&my_mdns);
  }
}

void configInterrupt(){
  Serial.println("configInterrupt");
  allow_config = 100;
}

void setup(void) {
  Serial.begin(115200);
  delay(100);
  Serial.println();
  Serial.println("Reset.");
  Serial.println();

  Persist_Data::Persistent<Config> persist_config(&config);
  persist_config.readConfig();

  Serial.println("");
  
  if(config.pull_firmware){
    Serial.println("Pull Firmware mode!!");
  } else {
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

    pinMode(config.enable_io_pin, INPUT_PULLUP);
    attachInterrupt(digitalPinToInterrupt(config.enable_io_pin), configInterrupt, CHANGE);
    io.registerCallback(ioCallbackWrapper);
    io.setup();

    mqtt.registerCallback(mqttCallback);
  }
}

bool mqtt_connected = true;
void loop(void) {
  if (WiFi.status() != WL_CONNECTED) {
    setup_network();
  }

  if(config.pull_firmware){
    pullFirmware();
  } else {
    http_server.handleClient();
    mqtt.loop();

    if(!my_mdns.Check()){
      //Serial.println("mDNS error.");
    }

    if (!mqtt.connected()) {
      if(mqtt_connected){
        Serial.println("MQTT disconnected.");
        mqtt_connected = false;
      }
      Serial.print("-");
      mqtt.connect();
      delay(1000);
    } else {
      if(!mqtt_connected){
        // Serial.println("MQTT connected.");
        mqtt_connected = true;
      }
      mqtt.subscribeOne();
    }

    io.loop();
  }
}
