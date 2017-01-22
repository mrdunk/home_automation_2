#ifndef ESP8266__HOST_ATTRIBUTES_H
#define ESP8266__HOST_ATTRIBUTES_H

#include <ESP8266WiFi.h>
#include "devices.h"
#include "config.h"

struct Config {
  char hostname[HOSTNAME_LEN];
  char subscribe_prefix[PREFIX_LEN];
  char publish_prefix[PREFIX_LEN];
  Connected_device devices[MAX_DEVICES];
  IPAddress local_address;
  IPAddress broker_address;
  char firmware_server[FIRMWARE_SERVER_LEN];
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
