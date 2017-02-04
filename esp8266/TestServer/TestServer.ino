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
#include "html_primatives.h"  // TODO remove?
#include "host_attributes.h"
#include "config.h"
#include "http_server.h"


Config config = {
  "",
  {0,0,0,0},  // Null IP address means use DHCP.
  {0,0,0,0},
  {0,0,0,0},
  {0,0,0,0},
  "homeautomation/+",
  "homeautomation/0",
  {},
  "http://192.168.192.54:8000/firmware.bin",
  "",
  0,
  false,
  CONFIG_VERSION
};

String mac_address;
int allow_config;


// mDNS

Brokers brokers(QUESTION_SERVICE);
mdns::MDns my_mdns(NULL,
                   NULL,
                   [](const mdns::Answer* answer){brokers.ParseMDnsAnswer(answer);},
                   MAX_MDNS_PACKET_SIZE);


// MQTT

WiFiClient wifiClient;
Mqtt mqtt(wifiClient, &brokers);

void mqttCallback(const char* topic, const byte* payload, const unsigned int length){
  mqtt.callback(topic, payload, length);
}


// IO
Io io(&mqtt);



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

void setup_network(void) {
  //Serial.setDebugOutput(true);
 
  if(WiFi.SSID() != ssid || WiFi.psk() != pass){
    Serial.println("Reassigning WiFi username and password.");
    WiFi.mode(WIFI_STA);
    WiFi.begin(ssid, pass);
  }
  WiFi.setAutoConnect(true);
  WiFi.setAutoReconnect(true);
 
  if(config.ip != IPAddress(0,0,0,0) && config.subnet != IPAddress(0,0,0,0)){
    WiFi.config(config.ip, config.gateway, config.subnet);
  }

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
    io.registerCallback([]() {io.inputCallback();});  // Inline callback function.
    io.setup();

    mqtt.registerCallback(mqttCallback);

    allow_config = 0;
  }
}

char test_http_buffer[HTTP_BUFFER_SIZE];
HttpServer http_server(test_http_buffer, HTTP_BUFFER_SIZE, &config, &brokers,
                       &my_mdns, &mqtt, &io, &allow_config);

void loop(void) {
  if (WiFi.status() != WL_CONNECTED) {
    setup_network();
  }

  if(config.pull_firmware){
    pullFirmware();
  } else {
    mqtt.loop();
    io.loop();
    if(!my_mdns.Check()){
      //Serial.println("mDNS error.");
    }

    http_server.loop();
  }
}
