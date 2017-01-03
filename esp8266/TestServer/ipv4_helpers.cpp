#include "Arduino.h"
#include <ESP8266WiFi.h>


String ip_to_string(IPAddress ip){
  String return_value;
  for (byte thisByte = 0; thisByte < 4; thisByte++) {
    return_value += ip[thisByte];
    if(thisByte < 3) {
      return_value += ".";
    }
  }
  return return_value;
}

IPAddress string_to_ip(String ip_str){
  uint8_t a, b, c, d, dot, last_dot = 0;

  dot = ip_str.indexOf('.');
  a = ip_str.substring(last_dot, dot).toInt();
        
  last_dot = dot +1;
  dot = ip_str.indexOf('.', dot +1);
  b = ip_str.substring(last_dot, dot).toInt();
    
  last_dot = dot +1;
  dot = ip_str.indexOf('.', dot +1);
  c = ip_str.substring(last_dot, dot).toInt();
  
  last_dot = dot +1;
  d = ip_str.substring(last_dot).toInt();
  
  return IPAddress(a, b, c, d);
}

String macToStr(const uint8_t* mac)
{
  String result;
  for (int i = 0; i < 6; ++i) {
    result += String(mac[i], 16);
    if (i < 5)
      result += ':';
  }
  return result;
}
