

#include <ESP8266WebServer.h>

#include "http_server.h"
#include "html_primatives.h"
#include "ipv4_helpers.h"

HttpServer::HttpServer(char* _buffer,
                       const int _buffer_size,
                       Config* _config,
                       Brokers* _brokers,
                       mdns::MDns* _mdns,
                       int* _allow_config) : 
    buffer(_buffer),
    buffer_size(_buffer_size),
    config(_config),
    brokers(_brokers),
    mdns(_mdns),
    allow_config(_allow_config)
{
  esp8266_http_server = ESP8266WebServer(HTTP_PORT);
  esp8266_http_server.on("/test", [&]() {onTest();});
  esp8266_http_server.on("/", [&]() {onRoot();});
  esp8266_http_server.on("/script.js", [&]() {onScript();});
  esp8266_http_server.on("/configure", [&]() {onConfig();});
  esp8266_http_server.on("/configure/", [&]() {onConfig();});

  esp8266_http_server.begin();

  bufferClear();
}

void HttpServer::loop(){
  esp8266_http_server.handleClient();
}

void HttpServer::onTest(){
  bufferAppend("testing");
  esp8266_http_server.send(200, "text/plain", buffer);
}

void HttpServer::onRoot(){
  Serial.println("onRoot() +");
  bool sucess = true;
  bufferClear();
  uint8_t mac[6];
  WiFi.macAddress(mac);
  sucess &= bufferAppend(descriptionListItem("MAC address", macToStr(mac)));
  sucess &= bufferAppend(descriptionListItem("Hostname", config->hostname));
  sucess &= bufferAppend(descriptionListItem("IP address", String(ip_to_string(WiFi.localIP()))));
  sucess &= bufferAppend(descriptionListItem("&nbsp", "&nbsp"));

  sucess &= bufferAppend(descriptionListItem("WiFI RSSI", String(WiFi.RSSI())));
  
  byte numSsid = WiFi.scanNetworks();
  for (int thisNet = 0; thisNet<numSsid; thisNet++) {
    sucess &= bufferAppend(descriptionListItem("WiFi SSID", WiFi.SSID(thisNet) +
        "&nbsp&nbsp&nbsp(" + String(WiFi.RSSI(thisNet)) + ")"));
  }
  sucess &= bufferAppend(descriptionListItem("&nbsp", "&nbsp"));

  sucess &= bufferAppend(descriptionListItem("CPU frequency", String(ESP.getCpuFreqMHz())));
  sucess &= bufferAppend(descriptionListItem("Flash size", String(ESP.getFlashChipSize())));
  sucess &= bufferAppend(descriptionListItem("Flash space",
      String(int(100 * ESP.getFreeSketchSpace() / ESP.getFlashChipSize())) + "%"));
  sucess &= bufferAppend(descriptionListItem("Flash speed", String(ESP.getFlashChipSpeed())));
  sucess &= bufferAppend(descriptionListItem("Free memory", String(ESP.getFreeHeap())));
  sucess &= bufferAppend(descriptionListItem("SDK version", ESP.getSdkVersion()));
  sucess &= bufferAppend(descriptionListItem("Core version", ESP.getCoreVersion()));
  sucess &= bufferAppend(descriptionListItem("Config version", config->config_version));
  sucess &= bufferAppend(descriptionListItem("&nbsp", "&nbsp"));
  sucess &= bufferAppend(descriptionListItem("Analogue in", String(analogRead(A0))));
  sucess &= bufferAppend(descriptionListItem("System clock", String(millis() / 1000)));
  sucess &= bufferAppend(descriptionListItem("&nbsp", "&nbsp"));
  
  sucess &= bufferAppend(descriptionListItem("Brokers", brokers->Summary()));
  
#ifdef DEBUG_STATISTICS
  if(mdns->packet_count != 0){
    sucess &= bufferAppend(descriptionListItem("&nbsp", "&nbsp"));
    sucess &= bufferAppend(descriptionListItem("mDNS decode success rate",
        String(mdns->packet_count - mdns->buffer_size_fail) + " / " + 
        String(mdns->packet_count) + "&nbsp&nbsp&nbsp" +
        String(100 - (100 * mdns->buffer_size_fail / mdns->packet_count)) + "%"));
    sucess &= bufferAppend(descriptionListItem("Largest mDNS packet size",
        String(mdns->largest_packet_seen) + " / " + 
        String(MAX_MDNS_PACKET_SIZE) + " bytes"));
  }
#endif

  sucess &= bufferAppend(descriptionListItem("&nbsp", "&nbsp"));
  sucess &= bufferAppend(descriptionListItem("Configure", link("go", "configure")));

  sucess &= bufferInsert(listStart());
  sucess &= bufferAppend(listEnd());
  
  sucess &= bufferInsert(pageHeader(style, ""));
  sucess &= bufferAppend(pageFooter());

  Serial.println(sucess);
  Serial.println("onRoot() -");
  esp8266_http_server.send((sucess ? 200 : 500), "text/html", buffer);
}

void HttpServer::onScript(){
  Serial.println("onScript() +");
  bufferClear();
  bufferAppend(javascript);
  Serial.println(strlen(buffer));
  Serial.println("onScript() -");
  esp8266_http_server.send(200, "text/javascript", buffer);
  //esp8266_http_server.send(200, "text/plain", buffer);
}

void HttpServer::onConfig(){
  Serial.println("onConfig() +");
  bool sucess = true;
  bufferClear();

  if(*allow_config){
    *allow_config--;
  }
  if(*allow_config <= 0 && esp8266_http_server.hasArg("enablepassphrase") &&
      config->enable_passphrase != "" &&
      esp8266_http_server.arg("enablepassphrase") == config->enable_passphrase){
    *allow_config = 1;
  }
  Serial.print("allow_config: ");
  Serial.println(*allow_config);
  
  if(*allow_config){
    uint8_t mac[6];
    WiFi.macAddress(mac);
    bufferAppend(descriptionListItem("mac_address", macToStr(mac)));
    
    if(config->ip == IPAddress(0, 0, 0, 0)) {
      bufferAppend(descriptionListItem("IP address by DHCP",
                                     String(ip_to_string(WiFi.localIP()))));
    }
    bufferAppend(descriptionListItem("hostname", 
        textField("hostname", "hostname", config->hostname, "hostname") +
        submit("Save", "save_hostname" , "save('hostname')")));
    bufferAppend(descriptionListItem("&nbsp", "&nbsp"));

    bufferAppend(descriptionListItem("IP address",
        ipField("ip", ip_to_string(config->ip), ip_to_string(config->ip), "ip") +
        submit("Save", "save_ip" , "save('ip')") +
        String("(0.0.0.0 for DHCP. Static boots quicker.)")));
    if(config->ip != IPAddress(0, 0, 0, 0)) {
      bufferAppend(descriptionListItem("Subnet mask",
          ipField("subnet", ip_to_string(config->subnet), ip_to_string(config->subnet), "subnet") +
          submit("Save", "save_subnet" , "save('subnet')")));
      bufferAppend(descriptionListItem("Gateway",
          ipField("gateway", ip_to_string(config->gateway),
            ip_to_string(config->gateway), "gateway") +
          submit("Save", "save_gateway" , "save('gateway')")));
    }
    bufferAppend(descriptionListItem("&nbsp", "&nbsp"));

    bufferAppend(descriptionListItem("MQTT broker hint",
        ipField("broker_ip", ip_to_string(config->broker_ip),
                ip_to_string(config->broker_ip), "brokerip") +
        submit("Save", "save_brokerip" , "save('brokerip')") +
        String("(0.0.0.0 to only use auto discovery)")));
    bufferAppend(descriptionListItem("MQTT subscription prefix",
        textField("subscribeprefix", "subscribeprefix", config->subscribe_prefix,
          "subscribeprefix") +
        submit("Save", "save_subscribeprefix" , "save('subscribeprefix')")));
    bufferAppend(descriptionListItem("MQTT publish prefix",
        textField("publishprefix", "publishprefix", config->publish_prefix,
          "publishprefix") +
        submit("Save", "save_publishprefix" , "save('publishprefix')")));
    bufferAppend(descriptionListItem("&nbsp", "&nbsp"));
    
    bufferAppend(descriptionListItem("HTTP Firmware URL",
        textField("firmware_server", "firmware_server", config->firmware_server,
          "firmwareserver") +
        submit("Save", "save_firmwareserver" , "save('firmwareserver')")));
    bufferAppend(descriptionListItem("Enable passphrase",
        textField("enable_passphrase", "enable_passphrase", config->enable_passphrase,
          "enablepassphrase") +
        submit("Save", "save_enablepassphrase" , "save('enablepassphrase')")));
    bufferAppend(descriptionListItem("Enable IO pin",
        ioPin(config->enable_io_pin, "enableiopin") +
        submit("Save", "save_enableiopin" , "save('enableiopin')")));


    bufferAppend(tableStart());

    bufferAppend(row(header("index") + header("Topic") + header("type") + 
        header("IO pin") + header("Default val") + header("Inverted") +
        header("") + header(""), ""));

    int empty_device = -1;
    for (int i = 0; i < MAX_DEVICES; ++i) {
      if (strlen(config->devices[i].address_segment[0].segment) > 0) {
        bufferAppend(rowStart("device_" + String(i)));
        bufferAppend(cell(String(i)));
        String name = "topic_";
        name.concat(i);
        bufferAppend(cell(config->subscribe_prefix + String("/") +
            textField(name, "some/topic", DeviceAddress(config->devices[i]),
              "device_" + String(i) + "_topic")));
        if (config->devices[i].iotype == Io_Type::pwm) {
          bufferAppend(cell(outletType("pwm", "device_" + String(i) + "_iotype")));
        } else if (config->devices[i].iotype == Io_Type::onoff) {
          bufferAppend(cell(outletType("onoff", "device_" + String(i) + "_iotype")));
        } else if (config->devices[i].iotype == Io_Type::input) {
          bufferAppend(cell(outletType("input", "device_" + String(i) + "_iotype")));
        } else {
          bufferAppend(cell(outletType("test", "device_" + String(i) + "_iotype")));
        }
        bufferAppend(cell(ioPin(config->devices[i].io_pin,
              "device_" + String(i) + "_io_pin")));
        bufferAppend(cell(ioValue(config->devices[i].io_default,
              "device_" + String(i) + "_io_default")));
        bufferAppend(cell(ioInverted(config->devices[i].inverted,
              "device_" + String(i) + "_inverted")));

        bufferAppend(cell(submit("Save", "save_" + String(i),
                                 "save('device_" + String(i) +"')")));
        bufferAppend(cell(submit("Delete", "del_" + String(i),
                                  "del('device_" + String(i) +"')")));
        bufferAppend(rowEnd());
      } else if (empty_device < 0){
        empty_device = i;
      }
    }
    if (empty_device >= 0){
      // An empty slot for new device.
      bufferAppend(rowStart("device_" + String(empty_device)));
      bufferAppend(cell(String(empty_device)));
      String name = "address_";
      name.concat(empty_device);
      bufferAppend(cell(config->subscribe_prefix + String("/") +
          textField(name, "new/topic", "", "device_" + String(empty_device) + "_topic")));
      bufferAppend(cell(outletType("onoff", "device_" + String(empty_device) + "_iotype")));
      name = "pin_";
      name.concat(empty_device);
      bufferAppend(cell(ioPin(0, "device_" + String(empty_device) + "_io_pin")));
      bufferAppend(cell(ioValue(0, "device_" + String(empty_device) + "_io_default")));
      bufferAppend(cell(ioInverted(false, "device_" + String(empty_device) + "_inverted")));
      bufferAppend(cell(submit("Save", "save_" + String(empty_device),
            "save('device_" + String(empty_device) + "')")));
      bufferAppend(cell(""));
      bufferAppend(rowEnd());
    }
    
    bufferAppend(tableEnd());

    bufferAppend(descriptionListItem("Pull firmware", link("go", "pullfirmware")));
  
    sucess &= bufferInsert(listStart());
    sucess &= bufferAppend(listEnd());
  } else {
    Serial.println("Not allowed to handleConfig()");
    bufferAppend("Configuration mode not enabled.<br>Press button connected to IO ");
    bufferAppend(String(config->enable_io_pin));
    bufferAppend("<br>or append \"?enablepassphrase=PASSWORD\" to this URL<br>and reload.");
  }

  
  sucess &= bufferInsert(pageHeader(style, "script.js"));
  sucess &= bufferAppend(pageFooter());


  Serial.println(sucess);
  Serial.println(strlen(buffer));
  Serial.println("onConfig() -");
  esp8266_http_server.send((sucess ? 200 : 500), "text/html", buffer);
}

void HttpServer::bufferClear(){
  buffer[0] = '\0';
}

bool HttpServer::bufferAppend(const String& to_add){
  char char_array[to_add.length() +1];
  to_add.toCharArray(char_array, to_add.length() +1);
  return bufferAppend(char_array);
}

bool HttpServer::bufferAppend(const char* to_add){
  strncat(buffer, to_add, buffer_size - strlen(buffer) -1);
  return ((buffer_size - strlen(buffer) -1) >= strlen(to_add));
}

bool HttpServer::bufferInsert(const String& to_insert){
  char char_array[to_insert.length() +1];
  to_insert.toCharArray(char_array, to_insert.length() +1);
  return bufferInsert(char_array);
}

bool HttpServer::bufferInsert(const char* to_insert){
  if((buffer_size - strlen(buffer) -1) >= strlen(to_insert)){
    *(buffer + strlen(to_insert) + strlen(buffer)) = '\0';
    memmove(buffer + strlen(to_insert), buffer, strlen(buffer));
    memcpy(buffer, to_insert, strlen(to_insert));
    return true;
  }
  return false;
}

