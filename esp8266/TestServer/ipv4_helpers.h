#ifndef ESP8266__IPV4_HELPERS__H
#define ESP8266__IPV4_HELPERS__H


// Convert string containing ipv4 address in the format "XX.XX.XX.XX" to an IPAddress.
String ip_to_string(IPAddress ip);

// Convert IPAddress to printable string.
IPAddress string_to_ip(String ip_str);

// Convert MAC address to printable string.
String macToStr(const uint8_t* mac);


#endif  // ESP8266__IPV4_HELPERS__H
