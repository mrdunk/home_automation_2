/* Copyright 2017 Duncan Law (mrdunk@gmail.com)
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

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
  if(dot == -1){
    return IPAddress(0,0,0,0);
  }
  a = ip_str.substring(last_dot, dot).toInt();
        
  last_dot = dot +1;
  dot = ip_str.indexOf('.', dot +1);
  if(dot == -1){
    return IPAddress(0,0,0,0);
  }
  b = ip_str.substring(last_dot, dot).toInt();
    
  last_dot = dot +1;
  dot = ip_str.indexOf('.', dot +1);
  if(dot == -1){
    return IPAddress(0,0,0,0);
  }
  c = ip_str.substring(last_dot, dot).toInt();
  
  last_dot = dot +1;
  if(dot == -1){
    return IPAddress(0,0,0,0);
  }
  d = ip_str.substring(last_dot).toInt();
  
  if(a < 0 || a > 255 || b < 0 || b > 255 ||
      c < 0 || c > 255 || d < 0 || d > 255)
  {
    return IPAddress(0,0,0,0);
  }
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
