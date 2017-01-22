#include "host_attributes.h"

extern Config config;


// Ensure buffer contains only valid hostname characters.
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

void SetHostname(const char* new_hostname) {
  strncpy(config.hostname, new_hostname, HOSTNAME_LEN -1);
  config.hostname[HOSTNAME_LEN -1] = '\0';
  sanitizeHostname(config.hostname);
}


// The URL to an HTTP server where firmware can be pulled from.
void SetFirmwareServer(const char* new_fws, char* dest_buffer) {
  strncpy(dest_buffer, new_fws, FIRMWARE_SERVER_LEN -1);
  dest_buffer[FIRMWARE_SERVER_LEN -1] = '\0';
}

