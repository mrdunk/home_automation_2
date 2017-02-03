#ifndef ESP8266__CONFIG_H
#define ESP8266__CONFIG_H


// Reset if unable to connect to WiFi after this many seconds.
#define RESET_ON_CONNECT_FAIL 60

// Maximum size of an incoming mDNS packet. Make this as big as free RAM allows.
#define MAX_MDNS_PACKET_SIZE 256

// Increase this if any changes are made to "struct Config" or you need to reset
// config to default values.
#define CONFIG_VERSION "012"

// Maximum number of devices connected to IO pins.
#define MAX_DEVICES 4

// Maximum number of subscriptions to MQTT.
#define MAX_SUBSCRIPTIONS 10

// Length of name strings. (hostname, room names, lamp names, etc.)
#define HOSTNAME_LEN 32
#define NAME_LEN 16

// Each device has an address in the form 'role/location1/location2/etc'
// eg: 'lighting/kitchen/worktop/left'.
// These map to the second half of the MQTT topic.
#define ADDRESS_SEGMENTS 4

// MQTT topics will start with a prefix.
// eg: in the topic 'homeautomation/0/lighting/kitchen/worktop/left',
//     'homeautomation/0' maps to the prefix.
#define PREFIX_LEN 32

// How many times to retry to upload firmware on failure.
#define UPLOAD_FIRMWARE_RETRIES 10

// Length of Firmware server URL.
#define FIRMWARE_SERVER_LEN 64

// IO Pin that will enable configuration web page.
#define CONFIGURE_PIN 0

// Maximum length of a MQTT topic.
#define MAX_TOPIC_LENGTH  (PREFIX_LEN + ((NAME_LEN +1) * ADDRESS_SEGMENTS) +1)


#endif  // ESP8266__CONFIG_H
