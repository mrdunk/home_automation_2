#include "devices.h"
#include "host_attributes.h"


extern Config config;

// Ensure buffer contains only valid characters for a word in an MQTT topic.
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

// Ensure buffer contains only valid format for an MQTT topic.
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

// Return MQTT address of a device.
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

// The part of the MQTT topic that is common to all messages on this device.
void SetPrefix(const char* new_prefix, char* dest_buffer) {
  strncpy(dest_buffer, new_prefix, PREFIX_LEN -1);
  dest_buffer[PREFIX_LEN -1] = '\0';
  sanitizeTopic(dest_buffer);
}

// A device is a combination of IO pin, IO type (input, output, etc) and Topic.
void SetDevice(const unsigned int index, struct Connected_device& device) {
  if (index < MAX_DEVICES) {
    memcpy(&(config.devices[index]), &device, sizeof(device));
  }
}

