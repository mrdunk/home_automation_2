#ifndef ESP8266__HTTP_SERVER__H
#define ESP8266__HTTP_SERVER__H

#include "html_primatives.h"
#include "host_attributes.h"
#include "Brokers.h"

class HttpServer{
 public:
  HttpServer(char* _buffer, 
             const int _buffer_size,
             Config* _config,
             Brokers* _brokers,
             mdns::MDns* _mdns,
             Mqtt* _mqtt,
             Io* _io,
             int* _allow_config);
  void loop();
 private:
  ESP8266WebServer esp8266_http_server;
  void onTest();
  void onRoot();
  void onScript();
  void onStyle();
  void onConfig();
  void onSet();
  void onPullFirmware();
  void onReset();
  char* buffer;
  const int buffer_size;
  Config* config;
  Brokers* brokers;
  mdns::MDns* mdns;
  Mqtt* mqtt;
  Io* io;
  int* allow_config;
  void bufferClear();
  bool bufferAppend(const String& to_add);
  bool bufferAppend(const char* to_add);
  bool bufferInsert(const String& to_insert);
  bool bufferInsert(const char* to_insert);
};


#endif  // ESP8266__HTTP_SERVER__H
