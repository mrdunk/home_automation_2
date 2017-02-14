/* Copyright <YEAR> <COPYRIGHT HOLDER>
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
  String parent = "root";
  String key = "";
  String value = "";

  while(file.available() || line != "") {
    // Remove any preceding "," which are left from previous iterations.
    line.trim();
    if(line.startsWith(",")){
      line.remove(0, 1);
      line.trim();
    }

    //Lets read line by line from the file
    if(line == ""){
      line_num++;
      line = file.readStringUntil('\n');
    }
    
    enterSubSet(line, level);

    if(line.startsWith("#")){
      // Rest of line is a comment so ignore it.
      line = "";
    }

    if(level == 1){  // and parent == "root"){
      if(getKeyValue(line, key, value)){
        Serial.printf("%i %s : %s\n", level, key.c_str(), value.c_str());
        key.toLowerCase();
        if(!test){
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
          }
        }
        key = "";
        value = "";
      } else if(key != "") {
        if(key == "brokers"){
          parent = key;
          key = "";
        }
      } else if(line.startsWith(",")) {
        // pass
      } else if(key == "" && line =="") {
        //blank line
      } else {
        Serial.printf("1. Problem in file: %s  on line: %i\n", filename.c_str(), line_num);
        Serial.printf("  near: \"%s\"\n", line.c_str());
        return false;
      }
    } else if(level == 2 and parent == "brokers"){
      if(getKeyValue(line, key, value)){
        Serial.printf("%i %s : %s\n", level, key.c_str(), value.c_str());
        key.toLowerCase();
        if(!test){
        }
        key = "";
      } else if(enterSubSet(line, level)) {
        if(level == 1){
          parent = "root";
        }
      } else if(line.startsWith(",")) {
        // pass
      } else if(key == "" && line =="") {
        //blank line
      } else {
        Serial.printf("2. Problem in file: %s  on line: %i\n", filename.c_str(), line_num);
        Serial.printf("  near: \"%s\"\n", line.c_str());
        return false;
      }
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

bool getKeyValue(String& input, String& key, String& value){
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
    return false;
  }
  input = input.substring(1);
  input.trim();

  if(input.length() == 0){
    return false;
  } else if(input.startsWith("[")){
    return false;
  } else if(input.startsWith("{")){
    return false;
  } else if(input.startsWith("\"")){
    if(!input.indexOf("\"", 1) < 0){
      return false;
    }
    value = input.substring(1, input.indexOf("\"", 1));
    input = input.substring(input.indexOf("\"", 1) +1);
    return true;
  } else {
    // Presumably a number.
    if(input.indexOf(",") > 0){
      value = input.substring(0, input.indexOf(",") -1);
      input = input.substring(input.indexOf(","));
    } else if(input.indexOf("]") > 0){
      value = input.substring(0, input.indexOf("]") -1);
      input = input.substring(input.indexOf("]"));
    } else if(input.indexOf("}") > 0){
      value = input.substring(0, input.indexOf("}") -1);
      input = input.substring(input.indexOf("}"));
    } else {
      value = input;
      input = "";
    }
  }
  return false;
}


