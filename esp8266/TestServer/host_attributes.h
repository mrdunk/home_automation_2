#ifndef ESP8266__HOST_ATTRIBUTES_H
#define ESP8266__HOST_ATTRIBUTES_H

#include <ESP8266WiFi.h>
#include "devices.h"
#include "config.h"

struct Config {
  char hostname[HOSTNAME_LEN];
  IPAddress ip;
  IPAddress gateway;
  IPAddress subnet;
  IPAddress broker_ip;
  char subscribe_prefix[PREFIX_LEN];
  char publish_prefix[PREFIX_LEN];
  Connected_device devices[MAX_DEVICES];
  char firmware_server[FIRMWARE_SERVER_LEN];
  char enable_passphrase[FIRMWARE_SERVER_LEN];
  int enable_io_pin;
  bool pull_firmware;
  // TODO: add WFI ssid and password.
  char config_version[4];
}; 


// Ensure buffer contains only valid hostname characters.
void sanitizeHostname(char* buffer);

void SetHostname(const char* new_hostname);

// The URL to an HTTP server where firmware can be pulled from.
void SetFirmwareServer(const char* new_fws, char* dest_buffer);


#endif  // ESP8266__HOST_ATTRIBUTES_H
