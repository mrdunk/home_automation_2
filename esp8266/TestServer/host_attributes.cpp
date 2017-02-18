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

#include <ESP8266WiFi.h>
#include "FS.h"

#include "host_attributes.h"
#include "serve_files.h"

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
  WiFi.hostname(config.hostname);
}


// The URL to an HTTP server where firmware can be pulled from.
void SetFirmwareServer(const char* new_fws, char* dest_buffer) {
  strncpy(dest_buffer, new_fws, STRING_LEN -1);
  dest_buffer[STRING_LEN -1] = '\0';
}

bool Config::load(const String& filename, bool test){
	bool result = SPIFFS.begin();
  if(!result){
		Serial.println("Unable to use SPIFFS.");
    return false;
  }

	// this opens the file in read-mode
	File file = SPIFFS.open(filename, "r");

	if (!file) {
		Serial.println("File doesn't exist.");
    return false;
  }

  int line_num = 0;
  String line = "";
  int level = 0;
  int list_index = 0;
  bool inside_list = false;
  String parent = "root";
  String key = "";
  String value = "";

  while(file.available() || line != "") {
    // Remove any preceding "," which are left from previous iterations.
    line.trim();

    //Lets read line by line from the file
    if(line == "" || line == ":"){
      line_num++;
      line += file.readStringUntil('\n');
    }
  
    if(line.startsWith("#")){
      // Rest of line is a comment so ignore it.
      line = "";
    } else if(getKeyValue(line, key, value)){
      key.toLowerCase();
      if(!test){
        if(parent == "root"){
          Serial.printf("%i:%s  %s : %s\n", level, parent.c_str(), key.c_str(), value.c_str());
          if(key == "hostname"){
            SetHostname(value.c_str());
          } else if(key == "ip"){
            ip = string_to_ip(value);
          } else if(key == "gateway"){
            gateway = string_to_ip(value);
          } else if(key == "subnet"){
            subnet = string_to_ip(value);
          } else if(key == "broker_ip"){
            broker_ip = string_to_ip(value);
          } else if(key == "broker_port"){
            broker_port = value.toInt();
          } else if(key == "subscribe_prefix"){
            SetPrefix(value.c_str(), subscribe_prefix);
          } else if(key == "publish_prefix"){
            SetPrefix(value.c_str(), publish_prefix);
          } else if(key == "firmware_host"){
            SetFirmwareServer(value.c_str(), firmware_host);
          } else if(key == "firmware_directory"){
            SetFirmwareServer(value.c_str(), firmware_directory);
          } else if(key == "firmware_port"){
            firmware_port = value.toInt();
          } else if(key == "enable_passphrase"){
            value.toCharArray(enable_passphrase, STRING_LEN);
          } else if(key == "enable_io_pin"){
            enable_io_pin = value.toInt();
          } else if(key == "wifi_ssid"){
            // TODO
          } else if(key == "wifi_passwd"){
            // TODO
          } else if(key == "brokers"){
            parent = key;
            key = "";
          }
        } else if(parent == "brokers"){
          Serial.printf("%i:%s  %s : %s\n", level, parent.c_str(), key.c_str(), value.c_str());
        }
      }
      key = "";
    } else if((key != "") && (value != "error")) {
      // Pass.
    } else if(enterSubSet(line, level) or enterList(line, inside_list, list_index, level)) {
      if(level == 1 and !inside_list){
        parent = "root";
      }
    } else if(line.startsWith(",")) {
      // pass
    } else if((key == "") && (line == "")) {
      //blank line
    } else {
      Serial.println(level);
      Serial.println(line);
      Serial.printf("Problem in file: %s  on line: %i\n", filename.c_str(), line_num);
      Serial.printf("  near: \"%s\"\n", line.c_str());
      return false;
    }
  }

  file.close();
  return true;
}

bool enterSubSet(String& input, int& level){
  input.trim();
  if(input.startsWith("{")){
    level++;
    input.remove(0, 1);
    input.trim();
    return true;
  }
  if(input.startsWith("}")){
    level--;
    input.remove(0, 1);
    input.trim();
    return true;
  }
  return false;
}

// Note: Recursive lists do not work. No lists inside lists.
bool enterList(String& input, bool& inside_list, int& list_index,
               int& current_level){
  static int list_level;
  input.trim();
  if(!inside_list and input.startsWith("[")){
    list_level = current_level;
    list_index = 0;
    inside_list = true;
    input.remove(0, 1);
    input.trim();
    return true;
  } else if(inside_list and input.startsWith("]")){
    inside_list = false;
    input.remove(0, 1);
    input.trim();
    
    if(input.startsWith(",")){
      input.remove(0, 1);
    }
    return true;
  } else if(inside_list and input.startsWith(",") and current_level == list_level){
    list_index++;
    Serial.print("list_index: ");
    Serial.println(list_index);
    input.remove(0, 1);
    input.trim();
    return true;
  }
  return false;
}

bool getKeyValue(String& input, String& key, String& value){
  value = "";
  if(key == ""){
    input.trim();
    if(!input.startsWith("\"") || input.indexOf("\"", 1) < 0){
      return false;
    }
    key = input.substring(1, input.indexOf("\"", 1));
    key.trim();
    input = input.substring(input.indexOf("\"", 1) +1);
  }

  input.trim();
  if(!input.startsWith(":")){
    if(input.length() > 0){
      value = "error";
    }
    return false;
  }
  input = input.substring(1);
  input.trim();

  if(input.length() == 0){
    input = ":";
    return false;
  } else if(input.startsWith("[")){
    // value is a collection. We deal with those in the upper loop.
    return true;
  } else if(input.startsWith("{")){
    // value is a collection. We deal with those in the upper loop.
    return true;
  } else if(input.startsWith("\"")){
    if(input.indexOf("\"", 1) < 0){
      value = "error";
      return false;
    }
    value = input.substring(1, input.indexOf("\"", 1));
    input = input.substring(input.indexOf("\"", 1) +1);

    input.trim();
    if(input.startsWith(",")){
      input.remove(0, 1);
    }
    return true;
  } else {
    // Presumably a number.
    while(input.length()){  
      if(input.c_str()[0] < '0' || input.c_str()[0] > '9'){
        break;
      }
      value += input.c_str()[0];
      input.remove(0, 1);
    }


    input.trim();
    if(input.startsWith(",")){
      input.remove(0, 1);
    }
    return true;
  }
  return false;
}

