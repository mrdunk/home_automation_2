#ifndef ESP8266__DEVICES_H
#define ESP8266__DEVICES_H

#include <Arduino.h>  // String
#include "config.h"
//#include "host_attributes.h"


enum Io_Type {
  test,
  pwm,
  onoff,
  input
};

struct Address_Segment {
  char segment[NAME_LEN];
};

struct Connected_device {
  Address_Segment address_segment[ADDRESS_SEGMENTS];
  Io_Type iotype;
  int io_pin;
  int io_value;
  int io_default;
  bool inverted;
};


// Ensure buffer contains only valid characters for a word in an MQTT topic.
void sanitizeTopicSection(char* buffer);

// Ensure buffer contains only valid format for an MQTT topic.
void sanitizeTopic(char* buffer);

// Return MQTT address of a device.
String DeviceAddress(const Connected_device& device);

// The part of the MQTT topic that is common to all messages on this device.
void SetPrefix(const char* new_prefix, char* dest_buffer);

// A device is a combination of IO pin, IO type (input, output, etc) and Topic.
void SetDevice(const unsigned int index, Connected_device& device);




#endif  // ESP8266__DEVICES_H
