#ifndef ESP8266__HTTP_SERVER__H
#define ESP8266__HTTP_SERVER__H

#include "html_primatives.h"
#include "host_attributes.h"
#include "Brokers.h"

#define HTTP_PORT 82

class HttpServer{
 public:
  HttpServer(char* _buffer, 
             const int _buffer_size,
             Config* _config,
             Brokers* _brokers,
             mdns::MDns* _mdns,
             int* _allow_config);
  void loop();
 private:
  ESP8266WebServer esp8266_http_server;
  void onTest();
  void onRoot();
  void onScript();
  void onConfig();
  char* buffer;
  const int buffer_size;
  Config* config;
  Brokers* brokers;
  mdns::MDns* mdns;
  int* allow_config;
  void bufferClear();
  bool bufferAppend(const String& to_add);
  bool bufferAppend(const char* to_add);
  bool bufferInsert(const String& to_insert);
  bool bufferInsert(const char* to_insert);
};


#endif  // ESP8266__HTTP_SERVER__H
