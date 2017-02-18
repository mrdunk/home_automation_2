/* Copyright 2017 Duncan Law (mrdunk@gmail.com)
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

#include <ESP8266WiFi.h>
#include <ESP8266WebServer.h>
#include <EEPROM.h>
#include <PubSubClient.h>      // Include "PubSubClient" library.
#include <mdns.h>              // Include "esp8266_mdns" library.

#include "ESP8266httpUpdate.h"
#include "FS.h"

#include "devices.h"
#include "mqtt.h"
#include "ipv4_helpers.h"
#include "secrets.h"
#include "persist_data.h"
#include "persist_data.cpp"   // Template arguments confuse the linker so need to include .cpp .
#include "mdns_actions.h"
#include "host_attributes.h"
#include "config.h"
#include "http_server.h"
#include "serve_files.h"


Config config = {
  "",
  {0,0,0,0},  // Null IP address means use DHCP.
  {0,0,0,0},
  {0,0,0,0},
  {0,0,0,0},
  1883,
  "homeautomation/+",
  "homeautomation/0",
  {},
  "192.168.192.54",
  "/",
  8000,
  "",
  0,
  false,
  CONFIG_VERSION
};

// Global to track whether access to configuration WebPages should be allowed.
int allow_config;

// Large buffer to be used by MDns and HttpServer.
byte buffer[BUFFER_SIZE];

// mDNS
MdnsLookup brokers(QUESTION_SERVICE);
mdns::MDns my_mdns(NULL,
                   NULL,
                   [](const mdns::Answer* answer){brokers.ParseMDnsAnswer(answer);},
                   buffer,
                   BUFFER_SIZE);

// MQTT
WiFiClient wifiClient;
Mqtt mqtt(wifiClient, &brokers);
void mqttCallback(const char* topic, const byte* payload, const unsigned int length){
  mqtt.callback(topic, payload, length);
}

// IO
Io io(&mqtt);

// Web page configuration interface.
HttpServer http_server((char*)buffer, BUFFER_SIZE, &config, &brokers,
                       &my_mdns, &mqtt, &io, &allow_config);


// If we boot with the config.pull_firmware bit set in flash we should pull new firmware
// from an HTTP server.
bool pullFirmware(){
  config.pull_firmware = false;
  Persist_Data::Persistent<Config> persist_config(&config);
  persist_config.writeConfig();

  for(int tries = 0; tries < UPLOAD_FIRMWARE_RETRIES; tries++){
    ESPhttpUpdate.rebootOnUpdate(false);
    const String uri(String(config.firmware_directory) + String("firmware.bin"));
    t_httpUpdate_return ret = ESPhttpUpdate.update(config.firmware_host,
                                                   config.firmware_port,
                                                   uri);

    switch(ret) {
      case HTTP_UPDATE_FAILED:
        Serial.printf("HTTP_UPDATE_FAILED Error (%d): %s", 
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
        return true;
    }
    Serial.println("Retry...");
    delay(1000);
  }
  Serial.println("Giving up firmware pull.");
  return false;
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
  int timer = RESET_ON_CONNECT_FAIL * 100;
  while (WiFi.status() != WL_CONNECTED){
    delay(10);
    if(timer % 100 == 0){
      Serial.print(".");
    }
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
    brokers.InsertManual("broker_hint", config.broker_ip, config.broker_port);
    brokers.RegisterMDns(&my_mdns);
  }
}

void configInterrupt(){
  Serial.println("configInterrupt");
  allow_config = 100;
}

void setup(void) {
  Serial.begin(115200);
  delay(10);
  Serial.println();
  Serial.println("Reset.");
  Serial.println();

  Persist_Data::Persistent<Config> persist_config(&config);
  persist_config.readConfig();

  if(config.pull_firmware){
    Serial.println("Pull Firmware mode!!");
  } else {
    pinMode(config.enable_io_pin, INPUT_PULLUP);
    attachInterrupt(digitalPinToInterrupt(config.enable_io_pin), configInterrupt, CHANGE);
    io.registerCallback([]() {io.inputCallback();});  // Inline callback function.
    io.setup();

    if (strlen(config.hostname) == 0){
      uint8_t mac[6];
      WiFi.macAddress(mac);
      String hostname = "esp8266_" + macToStr(mac);
      SetHostname(hostname.c_str());
    }

    mqtt.registerCallback(mqttCallback);

    allow_config = 0;
  }
}

void loop(void) {
  if (WiFi.status() != WL_CONNECTED) {
    setup_network();
  }

  if(config.pull_firmware){
    bool result = pullFirmware();
	  result &= pullFile("style.css", config);
	  result &= pullFile("script.js", config);
	  result &= pullFile("config.cfg", config);
    if(result){
			Serial.println("Upgrade successful.");
    }
		ESP.reset();
  } else {
    mqtt.loop();
    io.loop();
    my_mdns.loop();
    http_server.loop();
  }
}
